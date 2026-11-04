<!-- 大型比赛管理台（PC 官网）：建赛事 / 抽签 / 管名单 / 录赛果 / 看对阵 -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuth } from '../composables/useAuth'
import TournamentBracketView from '../components/TournamentBracketView.vue'
import TournamentBracketPreview from '../components/TournamentBracketPreview.vue'
import * as api from '../api/tournament'

const emit = defineEmits<{ back: [] }>()
const { isLoggedIn, has } = useAuth()

const canAccess = computed(() => isLoggedIn.value && has('tournament:manage'))

/* ==================== 状态 ==================== */

const STATUS_TABS: { value: number | null; label: string }[] = [
  { value: null, label: '全部' },
  { value: 0, label: '报名中' },
  { value: 1, label: '已抽签' },
  { value: 2, label: '进行中' },
  { value: 3, label: '已结束' },
  { value: 4, label: '已取消' },
]

const list = ref<api.TournamentManageItem[]>([])
const loading = ref(true)
const error = ref('')
const statusFilter = ref<number | null>(null)
const keyword = ref('')

const selectedId = ref<number | null>(null)
const selected = computed(() => list.value.find((t) => t.id === selectedId.value) ?? null)

type ConsoleTab = 'overview' | 'entries' | 'matches' | 'bracket' | 'simulate'
const CONSOLE_TABS: { value: ConsoleTab; label: string }[] = [
  { value: 'overview', label: '概览' },
  { value: 'entries', label: '报名名单' },
  { value: 'matches', label: '赛程录入' },
  { value: 'bracket', label: '对阵图' },
  { value: 'simulate', label: '模拟赛程' },
]
const tab = ref<ConsoleTab>('overview')

const detail = ref<api.TournamentDetail | null>(null)
const entries = ref<api.TournamentEntryItem[]>([])
const matches = ref<api.TournamentMatches | null>(null)
const bracket = ref<api.TournamentBracket | null>(null)
const consoleLoading = ref(false)
const consoleError = ref('')

/* ==================== 赛事表单 ==================== */

interface TournamentFormState {
  title: string
  location: string
  playDate: string
  remark: string
  formats: number[]
  groupSize: number
  advancePerGroup: number
  maxEntries: number
  /** 小组赛轮数：0 = 自动（打满单循环） */
  groupRounds: number
  /** 淘汰赛轮数：0 = 自动（按晋级人数推导） */
  knockoutRounds: number
}

const FORMAT_OPTIONS = [
  { value: 1, label: '单打' },
  { value: 2, label: '男双' },
  { value: 3, label: '女双' },
  { value: 4, label: '混双' },
]

const formOpen = ref(false)
/** 新建 / 编辑弹窗里的晋级图预览 */
const previewOpen = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const formSaving = ref(false)
const formError = ref('')
/** 已抽签后赛制配置锁定，只能改标题 / 地点 / 日期 / 说明 */
const formLocked = ref(false)
const form = ref<TournamentFormState>({
  title: '',
  location: '',
  playDate: '',
  remark: '',
  formats: [1, 2, 3, 4],
  groupSize: 4,
  advancePerGroup: 1,
  maxEntries: 64,
  groupRounds: 0,
  knockoutRounds: 0,
})

/* ==================== 录分弹窗 ==================== */

const scoreOpen = ref(false)
const scoreTarget = ref<api.TournamentMatch | null>(null)
const scoreA = ref('')
const scoreB = ref('')
/** 0 = 按比分自动判定；1 / 2 = 手动改判为 A 队 / B 队胜 */
const scoreOverride = ref<0 | 1 | 2>(0)
const scoreSaving = ref(false)
const scoreError = ref('')

/* ==================== 数据加载 ==================== */

async function loadList(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    list.value = await api.listManageTournaments({
      status: statusFilter.value ?? undefined,
      keyword: keyword.value.trim() || undefined,
    })
    // 选中项可能已被筛掉，清掉避免控制台显示陈旧数据
    if (selectedId.value != null && !list.value.some((t) => t.id === selectedId.value)) {
      selectedId.value = null
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

async function loadConsole(): Promise<void> {
  if (selectedId.value == null) return
  consoleLoading.value = true
  consoleError.value = ''
  try {
    const id = selectedId.value
    const [d, m, b] = await Promise.all([
      api.getTournament(id),
      api.getMatches(id),
      api.getBracket(id),
    ])
    detail.value = d
    matches.value = m
    bracket.value = b
    entries.value = await api.getManageEntries(id)
  } catch (e) {
    consoleError.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    consoleLoading.value = false
  }
}

async function selectTournament(id: number): Promise<void> {
  selectedId.value = id
  tab.value = 'overview'
  await loadConsole()
}

/* ==================== 抽签前置预校验 ==================== */

/**
 * 抽签前本地算出「能不能凑出完整签表」，避免点了才报错。
 * 规则与后端 draw() 一致：组数 = ceil(该组别报名数 / 每组队数)，
 * 晋级数 = 组数 × 每组名额，必须是 4/8/16/32/64/128/256 才打得了淘汰赛。
 */
function drawBlockReason(t: api.TournamentManageItem): string | null {
  const playable = t.formatCounts.filter((c) => c.entryCount >= 2)
  if (playable.length === 0) {
    return '没有任何组别凑够 2 队，无法抽签'
  }
  for (const c of playable) {
    if (!c.knockoutSizeValid) {
      return `${c.formatName}组共 ${c.entryCount} 队，按每组 ${t.groupSize} 队 × 每组 ${t.advancePerGroup} 名 = 晋级 ${c.knockoutSize} 人，淘汰赛需要 2 的幂规模（4/8/16/32/64/128）`
    }
  }
  return null
}

const selectedDrawBlock = computed(() => (selected.value ? drawBlockReason(selected.value) : null))

async function handleDraw(t: api.TournamentManageItem): Promise<void> {
  const reason = drawBlockReason(t)
  if (reason) {
    alert(`无法抽签：${reason}`)
    return
  }
  if (!confirm(`确定对「${t.title}」执行抽签分组吗？\n\n抽签不可撤销，分组与小组赛程会立即生成。`)) return
  try {
    const res = await api.drawTournament(t.id)
    const detailText = (res.formats ?? [])
      .map((f) => `${f.formatName}：${f.entryCount} 队分 ${f.groupCount} 组，晋级 ${f.knockoutSize} 强`)
      .join('\n')
    alert(`抽签完成\n${detailText}`)
    await loadList()
    if (selectedId.value === t.id) await loadConsole()
  } catch (e) {
    alert(e instanceof Error ? e.message : '抽签失败')
  }
}

/* ==================== 新建 / 编辑 ==================== */

function openCreate(): void {
  formMode.value = 'create'
  formLocked.value = false
  formError.value = ''
  previewOpen.value = false
  form.value = {
    title: '',
    location: '',
    playDate: '',
    remark: '',
    formats: [1, 2, 3, 4],
    groupSize: 4,
    advancePerGroup: 1,
    maxEntries: 64,
    groupRounds: 0,
    knockoutRounds: 0,
  }
  formOpen.value = true
}

function openEdit(t: api.TournamentManageItem): void {
  formMode.value = 'edit'
  formLocked.value = t.drawn
  formError.value = ''
  previewOpen.value = false
  form.value = {
    title: t.title,
    location: t.location ?? '',
    playDate: t.playDate ?? '',
    remark: t.remark ?? '',
    formats: [...t.formats],
    groupSize: t.groupSize,
    advancePerGroup: t.advancePerGroup,
    maxEntries: t.maxEntries,
    groupRounds: t.groupRounds ?? 0,
    knockoutRounds: t.knockoutRounds ?? 0,
  }
  formOpen.value = true
}

function toggleFormat(v: number): void {
  const idx = form.value.formats.indexOf(v)
  if (idx >= 0) {
    if (form.value.formats.length <= 1) {
      formError.value = '至少要开设 1 个组别'
      return
    }
    form.value.formats.splice(idx, 1)
  } else {
    form.value.formats.push(v)
    form.value.formats.sort((a, b) => a - b)
  }
  formError.value = ''
}

async function handleSave(): Promise<void> {
  const title = form.value.title.trim()
  if (!title) {
    formError.value = '赛事名称不能为空'
    return
  }
  if (form.value.advancePerGroup >= form.value.groupSize) {
    formError.value = `每组晋级名额必须小于每组 ${form.value.groupSize} 队`
    return
  }
  if (form.value.groupRounds < 0 || form.value.groupRounds > 45) {
    formError.value = '小组赛轮数需在 0 ~ 45 之间（0 = 自动打满单循环）'
    return
  }
  if (form.value.knockoutRounds < 0 || form.value.knockoutRounds > 7) {
    formError.value = '淘汰赛轮数需在 0 ~ 7 之间（0 = 自动按晋级人数推导）'
    return
  }
  formSaving.value = true
  formError.value = ''
  const payload: api.TournamentForm = {
    title,
    location: form.value.location.trim() || undefined,
    playDate: form.value.playDate || undefined,
    remark: form.value.remark.trim() || undefined,
    groupSize: form.value.groupSize,
    advancePerGroup: form.value.advancePerGroup,
    maxEntries: form.value.maxEntries,
    groupRounds: form.value.groupRounds || 0,
    knockoutRounds: form.value.knockoutRounds || 0,
  }
  // 已抽签后组别与赛制锁定，不提交这几个字段
  if (!formLocked.value) {
    payload.formats = form.value.formats
  }
  try {
    if (formMode.value === 'create') {
      const res = await api.createTournament(payload)
      formOpen.value = false
      await loadList()
      await selectTournament(res.tournamentId)
    } else if (selectedId.value != null) {
      await api.updateTournament(selectedId.value, payload)
      formOpen.value = false
      await loadList()
      await loadConsole()
    }
  } catch (e) {
    formError.value = e instanceof Error ? e.message : '保存失败'
  } finally {
    formSaving.value = false
  }
}

/* ==================== 取消赛事 ==================== */

async function handleCancel(t: api.TournamentManageItem): Promise<void> {
  if (!confirm(`确定取消赛事「${t.title}」吗？\n\n取消后球友将无法报名，已报名记录会保留在历史中。`)) return
  try {
    await api.cancelTournament(t.id)
    await loadList()
    if (selectedId.value === t.id) await loadConsole()
  } catch (e) {
    alert(e instanceof Error ? e.message : '取消失败')
  }
}

/* ==================== 报名名单 ==================== */

const entriesByFormat = computed(() => {
  const map = new Map<number, api.TournamentEntryItem[]>()
  for (const e of entries.value) {
    if (!map.has(e.format)) map.set(e.format, [])
    map.get(e.format)!.push(e)
  }
  return map
})

async function handleRemoveEntry(e: api.TournamentEntryItem): Promise<void> {
  const drawn = selected.value?.drawn ?? false
  const warn = drawn
    ? `确定把「${e.name}」移出参赛名单吗？\n\n赛事已抽签，移出会打乱该组的小组赛比分与晋级判定，可能需要整组重打。`
    : `确定把「${e.name}」移出参赛名单吗？`
  if (!confirm(warn)) return
  try {
    await api.removeEntry(e.tournamentId, e.entryId)
    await loadConsole()
    await loadList()
  } catch (err) {
    alert(err instanceof Error ? err.message : '移出失败')
  }
}

/* ==================== 赛程录入 ==================== */

/** 比分必填，按比分自动判定胜方；可手动改判 */
const autoWinner = computed(() => {
  const a = Number(scoreA.value)
  const b = Number(scoreB.value)
  if (!Number.isFinite(a) || !Number.isFinite(b) || scoreA.value === '' || scoreB.value === '') return 0
  if (a === b) return 0
  return a > b ? 1 : 2
})

const finalWinner = computed(() => (scoreOverride.value !== 0 ? scoreOverride.value : autoWinner.value))

/** 手动改判与比分不一致时提示，避免留下「比分 10:21 却判 A 胜」这种看不懂的数据 */
const overrideMismatch = computed(
  () => scoreOverride.value !== 0 && autoWinner.value !== 0 && scoreOverride.value !== autoWinner.value,
)

function openScore(m: api.TournamentMatch): void {
  scoreTarget.value = m
  scoreA.value = m.scoreA != null ? String(m.scoreA) : ''
  scoreB.value = m.scoreB != null ? String(m.scoreB) : ''
  scoreOverride.value = 0
  scoreError.value = ''
  scoreOpen.value = true
}

async function handleSubmitScore(): Promise<void> {
  const m = scoreTarget.value
  if (!m) return
  const a = Number(scoreA.value)
  const b = Number(scoreB.value)
  if (scoreA.value === '' || scoreB.value === '') {
    scoreError.value = '比分必填，请填写双方的得分'
    return
  }
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
    scoreError.value = '比分必须是不小于 0 的整数'
    return
  }
  if (a === b) {
    scoreError.value = '比分不能相同，羽毛球没有平局'
    return
  }
  const winner = finalWinner.value
  if (winner === 0) {
    scoreError.value = '无法判定胜方，请填写不同的比分'
    return
  }
  scoreSaving.value = true
  scoreError.value = ''
  try {
    await api.scoreMatch(m.id, { winner, scoreA: a, scoreB: b })
    scoreOpen.value = false
    await loadConsole()
    await loadList()
  } catch (e) {
    scoreError.value = e instanceof Error ? e.message : '录分失败'
  } finally {
    scoreSaving.value = false
  }
}

async function handleRevoke(m: api.TournamentMatch): Promise<void> {
  const roundText = m.stage === 1 ? '本组' : '本轮及后续所有轮次'
  if (!confirm(`确定撤销「${m.teamA?.name ?? '?'} vs ${m.teamB?.name ?? '?'}」的赛果吗？\n\n撤销会连带清空${roundText}的赛果，并把参赛队伍状态整体回退，后续需要重新录入。`)) return
  try {
    await api.scoreMatch(m.id, { winner: 0 })
    await loadConsole()
    await loadList()
  } catch (e) {
    alert(e instanceof Error ? e.message : '撤销失败')
  }
}

/* ==================== 成绩导出 ==================== */

function exportCsv(): void {
  const b = bracket.value
  const t = selected.value
  if (!b || !t) {
    alert('请先在「对阵图」页加载数据后再导出')
    return
  }
  const rows: string[][] = [['赛事名称', '组别', '名次', '队伍', '队员', '小组', '止步说明']]
  for (const f of b.formats) {
    for (const r of f.ranking) {
      rows.push([
        t.title,
        f.formatName,
        String(r.rank),
        r.name,
        r.members.map((m) => m.name).join(' / '),
        r.groupNo ?? '',
        r.eliminatedText ?? '',
      ])
    }
    for (const alive of f.alive) {
      rows.push([t.title, f.formatName, '仍在赛', alive.name, alive.members.map((m) => m.name).join(' / '), alive.groupNo ?? '', ''])
    }
  }
  if (rows.length === 1) {
    alert('暂无可导出的成绩')
    return
  }
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\r\n')
  // 加 BOM，Excel 打开中文不乱码
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${t.title}-成绩表.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/* ==================== 模拟赛程 ==================== */

const simResult = ref<api.TournamentBracket | null>(null)
const simRunning = ref(false)
const simError = ref('')
/** 模拟队数；留空表示沿用真实报名数 */
const simEntryCount = ref<number | ''>('')
const simGroupSize = ref(4)
const simAdvance = ref(1)
const simGroupRounds = ref(0)
const simKnockoutRounds = ref(0)
const simFormats = ref<number[]>([1])

function toggleSimFormat(v: number): void {
  const idx = simFormats.value.indexOf(v)
  if (idx >= 0) {
    if (simFormats.value.length <= 1) return
    simFormats.value.splice(idx, 1)
  } else {
    simFormats.value.push(v)
    simFormats.value.sort((a, b) => a - b)
  }
}

async function handleSimulate(): Promise<void> {
  simRunning.value = true
  simError.value = ''
  try {
    const payload: api.TournamentSimulateForm = {
      formats: simFormats.value,
      groupSize: simGroupSize.value,
      advancePerGroup: simAdvance.value,
      groupRounds: simGroupRounds.value,
      knockoutRounds: simKnockoutRounds.value,
    }
    if (selectedId.value != null) payload.tournamentId = selectedId.value
    if (simEntryCount.value !== '') payload.entryCount = Number(simEntryCount.value)
    simResult.value = await api.simulateTournament(payload)
  } catch (e) {
    simError.value = e instanceof Error ? e.message : '模拟失败'
    simResult.value = null
  } finally {
    simRunning.value = false
  }
}

/** 模拟的赛制结构摘要：直接用后端返回的分组 / 轮次统计，不用前端再算一遍 */
const simSummary = computed(() => {
  const b = simResult.value
  if (!b) return []
  return b.formats.map((f) => {
    const groupRounds = f.groups.reduce(
      (max, g) => Math.max(max, new Set(g.matches.map((m) => m.roundNo)).size),
      0,
    )
    const groupMatches = f.groups.reduce((sum, g) => sum + g.matches.length, 0)
    const koMatches = f.knockouts.reduce((sum, r) => sum + r.matches.length, 0)
    const koRounds = f.knockouts.filter((r) => r.roundSize > 0).length
    return {
      name: f.formatName,
      groupCount: f.groups.length,
      groupRounds,
      groupMatches,
      koRounds,
      koMatches,
      total: groupMatches + koMatches,
    }
  })
})

/* ==================== 工具 ==================== */

function teamLabel(m: api.TournamentMatch): string {
  return `${m.teamA?.name ?? '待定'} vs ${m.teamB?.name ?? '待定'}`
}

function winnerName(m: api.TournamentMatch): string {
  if (m.winner === 1) return m.teamA?.name ?? 'A 队'
  if (m.winner === 2) return m.teamB?.name ?? 'B 队'
  return '—'
}

onMounted(async () => {
  if (!isLoggedIn.value) return
  if (!canAccess.value) return
  await loadList()
})
</script>

<template>
  <div class="admin-page">
    <header class="top">
      <button class="back" @click="emit('back')">← 返回官网</button>
      <h1>大型比赛管理</h1>
      <div class="top-actions">
        <button class="btn" :disabled="!selected" @click="exportCsv">导出成绩</button>
        <button class="btn primary" @click="openCreate">+ 新建赛事</button>
      </div>
    </header>

    <section v-if="!canAccess" class="denied">
      <h2>需要赛事管理权限</h2>
      <p>请用持「赛事管理」权限的账号登录后再访问此页面。</p>
      <button class="btn primary" @click="emit('back')">返回</button>
    </section>

    <section v-else class="content">
      <!-- 赛事列表 -->
      <section class="panel">
        <div class="panel-head">
          <h2>赛事列表</h2>
          <div class="toolbar">
            <div class="tabs">
              <button
                v-for="s in STATUS_TABS"
                :key="String(s.value)"
                class="tab"
                :class="{ active: statusFilter === s.value }"
                @click="statusFilter = s.value; loadList()"
              >
                {{ s.label }}
              </button>
            </div>
            <input
              v-model="keyword"
              class="search"
              placeholder="搜索赛事名称 / 地点"
              @keyup.enter="loadList()"
            />
            <button class="btn" @click="loadList()">搜索</button>
          </div>
        </div>

        <div v-if="loading" class="loading">加载中…</div>
        <div v-else-if="error" class="error">{{ error }}</div>
        <div v-else-if="list.length === 0" class="empty">还没有赛事，点右上角「新建赛事」开始</div>

        <table v-else class="table">
          <thead>
            <tr>
              <th>赛事名称</th>
              <th>日期</th>
              <th>组别</th>
              <th>报名</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="t in list"
              :key="t.id"
              :class="{ picked: selectedId === t.id }"
              @click="selectTournament(t.id)"
            >
              <td class="name-cell" data-label="赛事名称">
                {{ t.title }}
                <span class="sub block">{{ t.location || '未填地点' }} · 创建人 {{ t.creatorName }}</span>
              </td>
              <td class="sub" data-label="日期">{{ t.playDate || '—' }}</td>
              <td class="sub" data-label="组别">{{ t.formatNames.join(' / ') }}</td>
              <td class="sub" data-label="报名">{{ t.entryCount }} 队</td>
              <td data-label="状态">
                <span class="tag" :class="'st' + t.status">{{ t.statusText }}</span>
              </td>
              <td class="actions" data-label="操作">
                <button class="btn mini" @click.stop="selectTournament(t.id)">管理</button>
                <button
                  class="btn mini"
                  :disabled="t.status === 2 || t.status === 3 || t.status === 4"
                  @click.stop="openEdit(t)"
                >
                  编辑
                </button>
                <button
                  class="btn mini"
                  :disabled="t.status !== 0"
                  :title="drawBlockReason(t) ?? '抽签分组'"
                  @click.stop="handleDraw(t)"
                >
                  抽签
                </button>
                <button
                  class="btn mini danger"
                  :disabled="t.status === 2 || t.status === 3 || t.status === 4"
                  @click.stop="handleCancel(t)"
                >
                  取消
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- 操作台 -->
      <section v-if="selected" class="panel console">
        <div class="panel-head console-head">
          <div>
            <h2>{{ selected.title }}</h2>
            <p class="console-sub">
              {{ selected.playDate || '未定日期' }} · {{ selected.location || '未定地点' }} ·
              每组 {{ selected.groupSize }} 队 × 每组 {{ selected.advancePerGroup }} 名 ·
              单组上限 {{ selected.maxEntries }} 队
            </p>
          </div>
          <span class="tag" :class="'st' + selected.status">{{ selected.statusText }}</span>
        </div>

        <div v-if="selectedDrawBlock" class="notice warn">
          暂时不能抽签：{{ selectedDrawBlock }}。可调整「每组人数 × 每组名额」凑成 2 的幂。
        </div>

        <div class="tabs console-tabs">
          <button
            v-for="c in CONSOLE_TABS"
            :key="c.value"
            class="tab"
            :class="{ active: tab === c.value }"
            @click="tab = c.value"
          >
            {{ c.label }}
          </button>
        </div>

        <div v-if="consoleLoading" class="loading">加载中…</div>
        <div v-else-if="consoleError" class="error">{{ consoleError }}</div>

        <template v-else>
          <!-- 概览 -->
          <div v-if="tab === 'overview'" class="tab-body">
            <div class="info-grid">
              <div class="info-item"><span>赛事名称</span><strong>{{ selected.title }}</strong></div>
              <div class="info-item"><span>比赛日期</span><strong>{{ selected.playDate || '未设置' }}</strong></div>
              <div class="info-item"><span>比赛地点</span><strong>{{ detail?.locationName || selected.location || '未设置' }}</strong></div>
              <div class="info-item"><span>创建人</span><strong>{{ selected.creatorName }}</strong></div>
              <div class="info-item"><span>参赛队数</span><strong>{{ selected.entryCount }}</strong></div>
              <div class="info-item"><span>冠军</span><strong>{{ selected.championName || '未产生' }}</strong></div>
            </div>

            <h3 class="sub-title">组别报名情况</h3>
            <table class="table compact">
              <thead>
                <tr>
                  <th>组别</th>
                  <th>已报名</th>
                  <th>上限</th>
                  <th>推算淘汰赛规模</th>
                  <th>签表合法性</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in selected.formatCounts" :key="c.format">
                  <td class="name-cell" data-label="组别">{{ c.formatName }}</td>
                  <td class="sub" data-label="已报名">{{ c.entryCount }}</td>
                  <td class="sub" data-label="上限">{{ c.maxEntries }}</td>
                  <td class="sub" data-label="推算淘汰赛规模">
                    {{ c.knockoutSize > 0 ? c.knockoutSize + ' 强' : '—' }}
                  </td>
                  <td data-label="签表合法性">
                    <span v-if="c.entryCount < 2" class="tag off">不足 2 队，不参与</span>
                    <span v-else-if="c.knockoutSizeValid" class="tag ok">可抽签</span>
                    <span v-else class="tag bad">规模非 2 的幂</span>
                  </td>
                </tr>
              </tbody>
            </table>

            <h3 class="sub-title">赛程结构</h3>
            <p class="sub tip">按当前报名人数与赛制配置推算，正式抽签后即为实际赛程。</p>
            <div class="plan-grid">
              <div v-for="c in selected.formatCounts" :key="c.format" class="plan-card">
                <div class="plan-head">
                  <strong>{{ c.formatName }}组</strong>
                  <span class="sub">{{ c.entryCount }} 队</span>
                </div>
                <div v-if="c.entryCount < 2" class="plan-empty">不足 2 队，本组别不参与</div>
                <template v-else>
                  <div class="plan-row">
                    <span class="plan-label">小组赛</span>
                    <span class="plan-value">
                      {{ c.groupCount }} 组 · 每组 {{ c.teamSizePerGroup }} 队
                      <b>{{ c.groupRounds }} 轮</b>
                      <em>{{ c.groupMatches }} 场</em>
                      <span v-if="c.groupRoundsConfigured" class="tag ok">指定</span>
                    </span>
                  </div>
                  <div class="plan-row">
                    <span class="plan-label">淘汰赛</span>
                    <span class="plan-value">
                      <template v-if="c.knockoutSizeValid">
                        {{ c.knockoutSize }} 强 <b>{{ c.knockoutRounds }} 轮</b>
                        <em>{{ c.knockoutMatches }} 场</em>
                        <span v-if="c.byeCount > 0" class="tag warn">{{ c.byeCount }} 支轮空</span>
                      </template>
                      <template v-else>规模非法，无法生成</template>
                    </span>
                  </div>
                  <div class="plan-row">
                    <span class="plan-label">收官战</span>
                    <span class="plan-value">季军赛 + 决赛 <em>{{ c.finalMatches }} 场</em></span>
                  </div>
                  <div class="plan-total">
                    <span>合计</span>
                    <b>{{ c.totalMatches }} 场</b>
                  </div>
                </template>
              </div>
            </div>

            <template v-if="detail?.podium?.length">
              <h3 class="sub-title">领奖台</h3>
              <div class="podium">
                <div v-for="p in detail.podium" :key="p.rank" class="podium-item">
                  <span class="podium-rank" :class="'r' + p.rank">{{ p.rankName }}</span>
                  <div>
                    <strong>{{ p.name }}</strong>
                    <span class="sub block">{{ p.formatName }}</span>
                  </div>
                </div>
              </div>
            </template>

            <p v-if="detail?.remark" class="remark">赛事说明：{{ detail.remark }}</p>
          </div>

          <!-- 报名名单 -->
          <div v-else-if="tab === 'entries'" class="tab-body">
            <div v-if="entries.length === 0" class="empty">还没有人报名</div>
            <div v-for="[format, list] in entriesByFormat" :key="format" class="group-block">
              <h3 class="sub-title">
                {{ list[0]?.formatName }}组
                <span class="sub">共 {{ list.length }} 队</span>
              </h3>
              <table class="table compact">
                <thead>
                  <tr>
                    <th>队伍</th>
                    <th>小组</th>
                    <th>战绩</th>
                    <th>净胜分</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="e in list" :key="e.entryId">
                    <td class="name-cell" data-label="队伍">
                      {{ e.name }}
                      <span class="sub block">{{ e.members.map((m) => m.name).join(' / ') }}</span>
                    </td>
                    <td class="sub" data-label="小组">{{ e.groupNo || '—' }}</td>
                    <td class="sub" data-label="战绩">
                      {{ e.groupWin }} 胜 {{ e.groupLoss }} 负
                      <span v-if="e.groupRank" class="sub block">组内第 {{ e.groupRank }}</span>
                    </td>
                    <td class="sub" data-label="净胜分">{{ e.groupPointDiff > 0 ? '+' : '' }}{{ e.groupPointDiff }}</td>
                    <td data-label="状态">
                      <span class="tag" :class="'st' + e.status">{{ e.statusText }}</span>
                      <span v-if="e.finalRank" class="tag ok block">第 {{ e.finalRank }} 名</span>
                    </td>
                    <td class="actions" data-label="操作">
                      <button class="btn mini danger" @click="handleRemoveEntry(e)">
                        {{ selected.drawn ? '移出名单' : '移出报名' }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 赛程录入 -->
          <div v-else-if="tab === 'matches'" class="tab-body">
            <div v-if="!matches || matches.formats.length === 0" class="empty">
              还没有赛程。赛事处于「报名中」时抽签后才会生成对阵。
            </div>
            <div v-for="f in matches?.formats ?? []" :key="f.format" class="group-block">
              <h3 class="sub-title">{{ f.formatName }}组</h3>

              <h4 class="round-title">待录入（{{ f.pending.length }}）</h4>
              <div v-if="f.pending.length === 0" class="empty small">本组别赛果已全部录入</div>
              <table v-else class="table compact">
                <thead>
                  <tr>
                    <th>轮次</th>
                    <th>对阵</th>
                    <th>场地</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="m in f.pending" :key="m.id">
                    <td class="sub" data-label="轮次">{{ m.roundName }}</td>
                    <td class="name-cell" data-label="对阵">{{ teamLabel(m) }}</td>
                    <td class="sub" data-label="场地">{{ m.court ? m.court + ' 号场' : '—' }}</td>
                    <td class="actions" data-label="操作">
                      <button class="btn mini primary" @click="openScore(m)">录分</button>
                    </td>
                  </tr>
                </tbody>
              </table>

              <h4 class="round-title">已出结果（{{ f.done.length }}）</h4>
              <div v-if="f.done.length === 0" class="empty small">还没有已完成的比赛</div>
              <table v-else class="table compact">
                <thead>
                  <tr>
                    <th>轮次</th>
                    <th>对阵</th>
                    <th>比分</th>
                    <th>胜方</th>
                    <th>计分人</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="m in f.done" :key="m.id">
                    <td class="sub" data-label="轮次">{{ m.roundName }}</td>
                    <td class="name-cell" data-label="对阵">{{ teamLabel(m) }}</td>
                    <td class="sub" data-label="比分">
                      {{ m.scoreA ?? '—' }} : {{ m.scoreB ?? '—' }}
                    </td>
                    <td class="sub" data-label="胜方">{{ winnerName(m) }}</td>
                    <td class="sub" data-label="计分人">{{ m.refereeName || '—' }}</td>
                    <td class="actions" data-label="操作">
                      <button class="btn mini" @click="openScore(m)">改判</button>
                      <button class="btn mini warn" @click="handleRevoke(m)">撤销</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 对阵图 -->
          <div v-else-if="tab === 'bracket'" class="tab-body">
            <TournamentBracketView :bracket="bracket" />
          </div>

          <!-- 模拟赛程 -->
          <div v-else-if="tab === 'simulate'" class="tab-body">
            <div class="sim-panel">
              <div class="sim-params">
                <div class="field">
                  <span>模拟组别</span>
                  <div class="format-picker">
                    <button
                      v-for="f in FORMAT_OPTIONS"
                      :key="f.value"
                      class="chip"
                      :class="{ on: simFormats.includes(f.value) }"
                      @click="toggleSimFormat(f.value)"
                    >
                      {{ f.label }}
                    </button>
                  </div>
                </div>
                <div class="row">
                  <label class="field half">
                    <span>每组队数（2~16）</span>
                    <input v-model.number="simGroupSize" type="number" min="2" max="16" />
                  </label>
                  <label class="field half">
                    <span>每组晋级名额（1~8）</span>
                    <input v-model.number="simAdvance" type="number" min="1" max="8" />
                  </label>
                </div>
                <div class="row">
                  <label class="field half">
                    <span>小组赛轮数（0 = 自动）</span>
                    <input v-model.number="simGroupRounds" type="number" min="0" max="45" />
                  </label>
                  <label class="field half">
                    <span>淘汰赛轮数（0 = 自动）</span>
                    <input v-model.number="simKnockoutRounds" type="number" min="0" max="7" />
                  </label>
                </div>
                <label class="field">
                  <span>模拟队伍数</span>
                  <input
                    v-model="simEntryCount"
                    type="number"
                    min="0"
                    max="512"
                    :placeholder="selected ? `留空 = 按真实报名数（${selected.entryCount} 队）` : '留空 = 不模拟'"
                  />
                </label>
                <p class="sub tip">
                  分组与配对规则与真实抽签完全一致，赛果随机生成；全程不写库，每次结果都不同。
                </p>
                <p v-if="simError" class="error">{{ simError }}</p>
                <div class="actions">
                  <button class="btn primary" :disabled="simRunning" @click="handleSimulate">
                    {{ simRunning ? '模拟中…' : '开始模拟' }}
                  </button>
                  <button class="btn" :disabled="simRunning" @click="simResult = null">清空结果</button>
                </div>
              </div>

              <div v-if="simResult" class="sim-summary">
                <div v-for="s in simSummary" :key="s.name" class="plan-card">
                  <div class="plan-head">
                    <strong>{{ s.name }}组</strong>
                    <span class="sub">模拟</span>
                  </div>
                  <div class="plan-row">
                    <span class="plan-label">小组赛</span>
                    <span class="plan-value">
                      {{ s.groupCount }} 组 · <b>{{ s.groupRounds }} 轮</b> <em>{{ s.groupMatches }} 场</em>
                    </span>
                  </div>
                  <div class="plan-row">
                    <span class="plan-label">淘汰赛</span>
                    <span class="plan-value">
                      <b>{{ s.koRounds }} 轮</b> <em>{{ s.koMatches }} 场（含收官战）</em>
                    </span>
                  </div>
                  <div class="plan-total">
                    <span>合计</span>
                    <b>{{ s.total }} 场</b>
                  </div>
                </div>
              </div>
            </div>

            <TournamentBracketView v-if="simResult" :bracket="simResult" simulated />
            <div v-else class="empty">调整参数后点「开始模拟」，可预览分组、各轮对阵与最终名次</div>
          </div>
        </template>
      </section>
    </section>

    <!-- 新建 / 编辑赛事 -->
    <div v-if="formOpen" class="mask" @click.self="formOpen = false">
      <div class="modal">
        <div class="modal-head">
          <h3>{{ formMode === 'create' ? '新建赛事' : '编辑赛事' }}</h3>
          <button class="close" @click="formOpen = false">×</button>
        </div>
        <div class="form">
          <label class="field">
            <span>赛事名称 *</span>
            <input v-model="form.title" placeholder="例如：2026 春季新生杯" maxlength="64" />
          </label>
          <div class="row">
            <label class="field half">
              <span>比赛日期</span>
              <input v-model="form.playDate" type="date" />
            </label>
            <label class="field half">
              <span>比赛地点</span>
              <input v-model="form.location" placeholder="例如：健康城羽毛球馆" maxlength="255" />
            </label>
          </div>

          <div class="field">
            <span>开设组别</span>
            <div class="format-picker">
              <button
                v-for="f in FORMAT_OPTIONS"
                :key="f.value"
                class="chip"
                :class="{ on: form.formats.includes(f.value) }"
                :disabled="formLocked"
                @click="toggleFormat(f.value)"
              >
                {{ f.label }}
              </button>
            </div>
            <small v-if="formLocked" class="lock-tip">已抽签，组别与赛制配置已锁定</small>
          </div>

          <div class="row">
            <label class="field half">
              <span>每组队数（2~16）</span>
              <input v-model.number="form.groupSize" type="number" min="2" max="16" :disabled="formLocked" />
            </label>
            <label class="field half">
              <span>每组晋级名额（1~8）</span>
              <input v-model.number="form.advancePerGroup" type="number" min="1" max="8" :disabled="formLocked" />
            </label>
          </div>
          <label class="field">
            <span>单组别参赛上限（队）</span>
            <input v-model.number="form.maxEntries" type="number" min="4" max="512" :disabled="formLocked" />
          </label>
          <div class="row">
            <label class="field half">
              <span>小组赛轮数（0 = 自动）</span>
              <input v-model.number="form.groupRounds" type="number" min="0" max="45" :disabled="formLocked" />
            </label>
            <label class="field half">
              <span>淘汰赛轮数（0 = 自动）</span>
              <input v-model.number="form.knockoutRounds" type="number" min="0" max="7" :disabled="formLocked" />
            </label>
          </div>
          <p class="sub tip">
            小组赛：0 = 按每组队数打满单循环；指定轮数可少于满轮（部分循环）或多于满轮（双循环及以上，主客互换）。<br />
            淘汰赛：0 = 按晋级人数自动推导；指定轮数后规模 = 2^(轮数+1)，晋级人数放不下时自动扩容，放得下但有多余签位时首轮出现轮空。
          </p>
          <div class="preview-entry">
            <button type="button" class="btn ghost" @click="previewOpen = true">预览晋级图 →</button>
            <span class="sub">按当前配置与单组别满员人数，实时预估分组与淘汰赛签表</span>
          </div>
          <label class="field">
            <span>赛事说明</span>
            <textarea v-model="form.remark" rows="3" maxlength="500" placeholder="赛制补充说明、集合时间等" />
          </label>

          <p v-if="formError" class="error">{{ formError }}</p>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="formOpen = false">取消</button>
          <button class="btn primary" :disabled="formSaving" @click="handleSave">
            {{ formSaving ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 晋级图预览 -->
    <div v-if="previewOpen" class="mask" @click.self="previewOpen = false">
      <div class="modal wide">
        <div class="modal-head">
          <h3>晋级图预览</h3>
          <button class="close" @click="previewOpen = false">×</button>
        </div>
        <div class="preview-body">
          <TournamentBracketPreview
            :group-size="Number(form.groupSize) || 0"
            :advance-per-group="Number(form.advancePerGroup) || 0"
            :max-entries="Number(form.maxEntries) || 0"
            :group-rounds="Number(form.groupRounds) || 0"
            :knockout-rounds="Number(form.knockoutRounds) || 0"
          />
        </div>
        <div class="modal-foot">
          <button class="btn primary" @click="previewOpen = false">知道了</button>
        </div>
      </div>
    </div>

    <!-- 录分 -->
    <div v-if="scoreOpen" class="mask" @click.self="scoreOpen = false">
      <div class="modal narrow">
        <div class="modal-head">
          <h3>录入赛果</h3>
          <button class="close" @click="scoreOpen = false">×</button>
        </div>
        <div class="form">
          <p class="score-target">
            <strong>{{ scoreTarget?.teamA?.name ?? '待定' }}</strong>
            <span>vs</span>
            <strong>{{ scoreTarget?.teamB?.name ?? '待定' }}</strong>
            <em v-if="scoreTarget?.roundName">{{ scoreTarget.roundName }}</em>
          </p>

          <div class="row score-row">
            <label class="field half">
              <span>{{ scoreTarget?.teamA?.name ?? 'A 队' }} 得分 *</span>
              <input v-model="scoreA" type="number" min="0" max="99" placeholder="21" />
            </label>
            <label class="field half">
              <span>{{ scoreTarget?.teamB?.name ?? 'B 队' }} 得分 *</span>
              <input v-model="scoreB" type="number" min="0" max="99" placeholder="15" />
            </label>
          </div>

          <div class="field">
            <span>胜方判定</span>
            <div class="winner-picker">
              <span class="auto-hint">
                {{ autoWinner === 0 ? '填写不同比分后自动判定' : `按比分判定：${autoWinner === 1 ? scoreTarget?.teamA?.name : scoreTarget?.teamB?.name} 胜` }}
              </span>
              <button
                class="chip"
                :class="{ on: scoreOverride === 1 }"
                @click="scoreOverride = scoreOverride === 1 ? 0 : 1"
              >
                改判 {{ scoreTarget?.teamA?.name ?? 'A 队' }} 胜
              </button>
              <button
                class="chip"
                :class="{ on: scoreOverride === 2 }"
                @click="scoreOverride = scoreOverride === 2 ? 0 : 2"
              >
                改判 {{ scoreTarget?.teamB?.name ?? 'B 队' }} 胜
              </button>
            </div>
            <small v-if="overrideMismatch" class="lock-tip danger">
              手动改判与比分不一致，将按改判结果记录
            </small>
          </div>

          <p v-if="scoreError" class="error">{{ scoreError }}</p>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="scoreOpen = false">取消</button>
          <button class="btn primary" :disabled="scoreSaving" @click="handleSubmitScore">
            {{ scoreSaving ? '提交中…' : '提交赛果' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-page { min-height: 100vh; background: #faf7f0; padding: 24px 28px 48px; max-width: 1280px; margin: 0 auto; }
.top { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
.top h1 { font-size: 20px; font-weight: 700; color: #1a2e2a; margin: 0; }
.back { background: none; border: none; color: #14665b; font-size: 14px; cursor: pointer; }
.top-actions { margin-left: auto; display: flex; gap: 10px; }

.btn { border: none; border-radius: 8px; padding: 7px 14px; cursor: pointer; font-size: 13px; font-weight: 600; background: #e3e8e6; color: #1a2e2a; }
.btn.primary { background: #14665b; color: #fff; }
.btn.danger { background: #b33a2e; color: #fff; }
.btn.warn { background: #7a4f1b; color: #fff; }
.btn:disabled { opacity: .45; cursor: not-allowed; }
.btn.mini { padding: 4px 10px; font-size: 12px; }

.denied { text-align: center; padding: 60px 20px; color: #1a2e2a; }
.denied h2 { margin: 0 0 12px; }
.denied p { color: #5a726d; margin-bottom: 24px; }

.content { display: flex; flex-direction: column; gap: 20px; }
.panel { background: #fff; border-radius: 14px; padding: 18px 20px; box-shadow: 0 2px 8px rgba(20,102,91,.08); }
.panel-head { display: flex; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 14px; }
.panel-head h2 { font-size: 16px; font-weight: 700; color: #1a2e2a; margin: 0; }
.console-head { align-items: center; margin-bottom: 10px; }
.console-sub { margin: 4px 0 0; font-size: 12px; color: #5a726d; }

.toolbar { margin-left: auto; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.tabs { display: flex; gap: 4px; background: #f1f5f3; padding: 3px; border-radius: 8px; }
.tab { border: none; background: transparent; padding: 5px 12px; border-radius: 6px; font-size: 13px; color: #5a726d; cursor: pointer; font-weight: 500; }
.tab.active { background: #14665b; color: #fff; }
.console-tabs { margin-bottom: 14px; }
.search { border: 1px solid #e3e8e6; border-radius: 8px; padding: 6px 10px; font-size: 13px; width: 180px; color: #1a2e2a; }

.notice { padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 14px; }
.notice.warn { background: #fdf6e3; color: #7a4f1b; border: 1px solid #f0dfae; }

.table { width: 100%; border-collapse: separate; border-spacing: 0; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(20,102,91,.08); }
.table th, .table td { padding: 10px 12px; border-bottom: 1px solid #f0efea; font-size: 13px; text-align: left; vertical-align: middle; }
.table thead th { background: #f1f5f3; color: #5a726d; font-weight: 600; font-size: 12px; }
.table tbody tr:last-child td { border-bottom: none; }
.table tbody tr.picked { background: #f2f8f6; }
.table tbody tr { cursor: pointer; }
.table.compact { box-shadow: none; border: 1px solid #f0efea; }
.table.tiny th, .table.tiny td { padding: 6px 8px; font-size: 12px; }
.name-cell { font-weight: 600; color: #1a2e2a; }
.sub { color: #5a726d; font-size: 12px; font-weight: 400; }
.sub.block, .tag.block { display: block; }
.actions { text-align: right; display: flex; gap: 6px; justify-content: flex-end; }
.tag { font-size: 11px; padding: 2px 8px; border-radius: 4px; display: inline-block; background: #f0efea; color: #5a726d; }
.tag.ok { background: #e0f1ec; color: #14665b; }
.tag.warn { background: #fdf6e3; color: #7a4f1b; }
.tag.bad { background: #fbe6e3; color: #b33a2e; }
.tag.off { background: #f0efea; color: #9aa8a4; }
.tag.st0 { background: #e0f1ec; color: #14665b; }
.tag.st1 { background: #eaf0fb; color: #2c5aa0; }
.tag.st2 { background: #fdf6e3; color: #7a4f1b; }
.tag.st3 { background: #f0efea; color: #5a726d; }
.tag.st4 { background: #fbe6e3; color: #b33a2e; }

.loading, .error, .empty { padding: 32px; text-align: center; color: #5a726d; }
.empty.small { padding: 12px; font-size: 12px; text-align: left; }
.error { color: #b33a2e; }

.tab-body { display: flex; flex-direction: column; gap: 14px; }
.info-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
.info-item { background: #f7f9f8; border-radius: 8px; padding: 10px 12px; }
.info-item span { display: block; font-size: 11px; color: #5a726d; margin-bottom: 3px; }
.info-item strong { font-size: 14px; color: #1a2e2a; }
.sub-title { font-size: 14px; font-weight: 700; color: #1a2e2a; margin: 6px 0 0; }
.sub-title .sub { font-weight: 400; margin-left: 8px; }
.round-title { font-size: 13px; font-weight: 600; color: #5a726d; margin: 4px 0 0; }
.group-block { display: flex; flex-direction: column; gap: 8px; }

.podium { display: flex; gap: 10px; flex-wrap: wrap; }
.podium-item { display: flex; align-items: center; gap: 10px; background: #f7f9f8; border-radius: 8px; padding: 10px 14px; min-width: 200px; }
.podium-rank { font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 6px; background: #e0f1ec; color: #14665b; }
.podium-rank.r1 { background: #e5c84b; color: #1a2e2a; }
.remark { font-size: 13px; color: #5a726d; background: #f7f9f8; border-radius: 8px; padding: 10px 14px; margin: 0; }

.plan-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.plan-card { border: 1px solid #f0efea; border-radius: 10px; padding: 12px 14px; background: #f7f9f8; }
.plan-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 13px; }
.plan-empty { font-size: 12px; color: #9aa8a4; padding: 6px 0; }
.plan-row { display: flex; justify-content: space-between; gap: 10px; padding: 5px 0; font-size: 12px; border-top: 1px solid #eceae4; }
.plan-label { color: #5a726d; flex-shrink: 0; }
.plan-value { color: #1a2e2a; text-align: right; }
.plan-value b { font-weight: 700; }
.plan-value em { font-style: normal; color: #5a726d; margin-left: 6px; }
.plan-total { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; padding-top: 8px; border-top: 1px solid #dcd9d1; font-size: 13px; color: #5a726d; }
.plan-total b { font-size: 15px; color: #14665b; }
.tip { font-size: 12px; margin: 0 0 8px; }

.sim-panel { display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
.sim-params { flex: 1; min-width: 280px; background: #f7f9f8; border-radius: 10px; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
.sim-params .field { font-size: 13px; color: #5a726d; }
.sim-params .field input { padding: 8px 12px; border: 1px solid #e3e8e6; border-radius: 8px; font-size: 14px; color: #1a2e2a; width: 100%; box-sizing: border-box; }
.sim-params .row { display: flex; gap: 12px; }
.sim-params .field.half { flex: 1; }
.sim-summary { flex: 1; min-width: 280px; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.sim-params .actions { display: flex; gap: 8px; }
.sim-params .actions .btn { flex: 1; }

.mask { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center; z-index: 999; padding: 16px; }
.modal { width: 520px; max-width: 94vw; max-height: 90vh; overflow-y: auto; background: #fff; border-radius: 14px; overflow: hidden; }
.modal.narrow { width: 420px; }
.modal.wide { width: 900px; }
.preview-body { padding: 18px 20px; }
.preview-entry { display: flex; align-items: center; gap: 10px; margin: 2px 0 10px; flex-wrap: wrap; }
.btn.ghost { background: #fff; border: 1px solid #14665b; color: #14665b; }
.btn.ghost:hover { background: #f2f8f6; }
.modal-head { padding: 16px 20px; border-bottom: 1px solid #f0efea; display: flex; align-items: center; justify-content: space-between; }
.modal-head h3 { margin: 0; font-size: 15px; font-weight: 700; color: #1a2e2a; }
.close { background: none; border: none; font-size: 20px; cursor: pointer; color: #5a726d; }
.form { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #5a726d; }
.field span { font-weight: 500; }
.field input, .field select, .field textarea { padding: 8px 12px; border: 1px solid #e3e8e6; border-radius: 8px; font-size: 14px; color: #1a2e2a; font-family: inherit; }
.field input:disabled, .field textarea:disabled { background: #f4f4f2; color: #9aa8a4; }
.row { display: flex; gap: 12px; }
.field.half { flex: 1; }
.modal-foot { padding: 14px 20px; border-top: 1px solid #f0efea; display: flex; justify-content: flex-end; gap: 10px; }

.format-picker { display: flex; gap: 8px; flex-wrap: wrap; }
.chip { border: 1px solid #e3e8e6; background: #fff; color: #5a726d; border-radius: 999px; padding: 5px 14px; font-size: 13px; cursor: pointer; }
.chip.on { background: #14665b; border-color: #14665b; color: #fff; }
.chip:disabled { opacity: .5; cursor: not-allowed; }
.lock-tip { font-size: 12px; color: #9aa8a4; }
.lock-tip.danger { color: #b33a2e; }

.score-target { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 13px; color: #1a2e2a; flex-wrap: wrap; }
.score-target em { font-style: normal; font-size: 12px; color: #5a726d; background: #f1f5f3; padding: 2px 8px; border-radius: 4px; }
.winner-picker { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.auto-hint { font-size: 12px; color: #5a726d; }

/* ===== 手机适配（≤640px） ===== */
@media (max-width: 640px) {
  .admin-page { padding: 16px 14px 40px; }
  .top { flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
  .top h1 { font-size: 18px; order: 2; flex-basis: 100%; }
  .back { order: 1; }
  .top-actions { order: 3; margin-left: 0; flex: 1; }
  .top-actions .btn { flex: 1; }

  .panel { padding: 14px; border-radius: 12px; }
  .toolbar { margin-left: 0; width: 100%; }
  .tabs { overflow-x: auto; max-width: 100%; }
  .search { flex: 1; width: auto; }

  .table thead { display: none; }
  .table, .table tbody, .table tr, .table td { display: block; width: 100%; }
  .table { background: transparent; box-shadow: none; border-radius: 0; }
  .table tbody { display: flex; flex-direction: column; gap: 10px; }
  .table tr { background: #fff; border-radius: 12px; padding: 4px 0; box-shadow: 0 2px 8px rgba(20,102,91,.08); }
  .table td { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 14px; border-bottom: 1px solid #f4f1ea; font-size: 13px; }
  .table td:last-child { border-bottom: none; }
  .table td::before { content: attr(data-label); color: #5a726d; font-size: 12px; font-weight: 600; flex-shrink: 0; }
  .table td.name-cell::before { display: none; }
  .table td.name-cell { justify-content: flex-start; flex-direction: column; align-items: flex-start; gap: 2px; }
  .table td.actions { flex-direction: row; flex-wrap: wrap; justify-content: flex-end; gap: 6px; padding-top: 10px; }
  .table td.actions::before { display: none; }
  .table td.actions .btn { flex: 1; min-width: 68px; }
  .table td.empty { display: block; text-align: center; padding: 32px 16px; }
  .table td.empty::before { display: none; }

  .plan-grid { grid-template-columns: 1fr; }
  .sim-panel { flex-direction: column; }
  .sim-params, .sim-summary { width: 100%; min-width: 0; }
  .info-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
  .row { flex-direction: column; gap: 12px; }
  .modal { width: 100%; }
  .modal-foot { flex-direction: column-reverse; }
  .modal-foot .btn { width: 100%; }
}
</style>

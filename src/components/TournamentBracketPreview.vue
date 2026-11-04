<!-- 晋级图预览：新建赛事时按当前赛制配置实时推算签表结构（纯前端，不调接口） -->
<!-- 假设单组别报满「参赛上限」队，规则与后端 TournamentEngine 完全一致：
     组数 = ceil(上限 / 每组队数)；晋级 = 组数 × 每组名额；
     签表规模 = max(容纳晋级队的最小 2 的幂, 2^(指定轮数+1))，上限 256；
     首轮签位按标准种子位 (i, size-1-i) 排列，空签位即轮空。 -->
<script setup lang="ts">
import { computed } from 'vue'
import type { TournamentMatch, TournamentRoundBoard, TournamentTeam } from '../api/tournament'
import TournamentBracketTree from './TournamentBracketTree.vue'

const props = defineProps<{
  groupSize: number
  advancePerGroup: number
  maxEntries: number
  /** 小组赛轮数：0 = 自动（打满单循环） */
  groupRounds: number
  /** 淘汰赛轮数：0 = 自动（按晋级人数推导） */
  knockoutRounds: number
}>()

const MIN_KNOCKOUT = 4
const MAX_KNOCKOUT = 256

const ROUND_NAMES: Record<number, string> = {
  4: '四强',
  8: '八强',
  16: '十六强',
  32: '三十二强',
  64: '六十四强',
  128: '一百二十八强',
  256: '二百五十六强',
}

interface StatItem {
  label: string
  value: string
  warn?: boolean
}

interface PreviewResult {
  valid: boolean
  error?: string
  hints: string[]
  stats: StatItem[]
  rounds: TournamentRoundBoard[]
}

/** 组序号（从 0 起）转组名：0→A，25→Z，26→AA，与后端一致 */
function groupName(seq: number): string {
  let n = seq + 1
  let s = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    // 注意必须整除：JS 的 / 是浮点除法，不 floor 会算出小数导致死循环与脏字符
    n = Math.floor((n - 1) / 26)
  }
  return s
}

/** 满员时各组实际队数（后端均摊策略：尽量平均，不会出现 1 人组） */
function groupSizes(total: number, groupCount: number): number[] {
  const base = Math.floor(total / groupCount)
  const extra = total % groupCount
  return Array.from({ length: groupCount }, (_, i) => base + (i < extra ? 1 : 0))
}

/** 组内单循环轮数：偶数队 n-1 轮，奇数队 n 轮 */
function autoGroupRounds(teamCount: number): number {
  if (teamCount < 2) return 0
  return teamCount % 2 === 0 ? teamCount - 1 : teamCount
}

/** 每轮真比赛场次 */
function groupMatchesPerRound(teamCount: number): number {
  if (teamCount < 2) return 0
  return teamCount % 2 === 0 ? teamCount / 2 : (teamCount - 1) / 2
}

const result = computed<PreviewResult>(() => {
  const groupSize = Number(props.groupSize)
  const advancePerGroup = Number(props.advancePerGroup)
  const maxEntries = Number(props.maxEntries)
  const configuredKoRounds = Number(props.knockoutRounds)
  const configuredGroupRounds = Number(props.groupRounds)

  if (!Number.isFinite(groupSize) || groupSize < 2 || groupSize > 16) {
    return { valid: false, error: '每组队数需在 2 ~ 16 之间', hints: [], stats: [], rounds: [] }
  }
  if (!Number.isFinite(advancePerGroup) || advancePerGroup < 1 || advancePerGroup > 8) {
    return { valid: false, error: '每组晋级名额需在 1 ~ 8 之间', hints: [], stats: [], rounds: [] }
  }
  if (advancePerGroup >= groupSize) {
    return {
      valid: false,
      error: `每组晋级名额（${advancePerGroup}）必须小于每组队数（${groupSize}），否则没有淘汰`,
      hints: [],
      stats: [],
      rounds: [],
    }
  }
  if (!Number.isFinite(maxEntries) || maxEntries < 4) {
    return { valid: false, error: '单组别参赛上限至少 4 队', hints: [], stats: [], rounds: [] }
  }

  const groupCount = Math.ceil(maxEntries / groupSize)
  const advance = groupCount * advancePerGroup

  if (advance < MIN_KNOCKOUT) {
    return {
      valid: false,
      error: `满员 ${maxEntries} 队分 ${groupCount} 组、每组晋级 ${advancePerGroup} 队，共 ${advance} 队晋级，不足 ${MIN_KNOCKOUT} 队无法开展淘汰赛。可调高参赛上限或每组晋级名额。`,
      hints: [],
      stats: [],
      rounds: [],
    }
  }
  if (advance > MAX_KNOCKOUT) {
    return {
      valid: false,
      error: `满员时共 ${advance} 队晋级，超过淘汰赛最大规模 ${MAX_KNOCKOUT} 队，请调低参赛上限或每组晋级名额。`,
      hints: [],
      stats: [],
      rounds: [],
    }
  }

  // 签表规模：与 TournamentEngine.knockoutBracketSize 同口径
  let fit = 2 ** Math.floor(Math.log2(advance))
  if (fit < advance) fit *= 2
  const cappedReq = Math.min(Math.max(configuredKoRounds, 0), 7)
  const want = cappedReq >= 1 ? 2 ** (cappedReq + 1) : 0
  const size = Math.max(fit, want)
  const byes = size - advance
  const koRounds = Math.log2(size) - 1
  const hints: string[] = []
  if (configuredKoRounds >= 1 && want < fit) {
    hints.push(`指定的 ${configuredKoRounds} 轮淘汰赛放不下 ${advance} 支晋级队，已自动扩容为 ${size} 强（${koRounds} 轮）。`)
  } else if (configuredKoRounds >= 1 && want > fit) {
    hints.push(`按指定的 ${configuredKoRounds} 轮预留 ${size} 个签位，${advance} 支晋级队落位后首轮 ${byes} 支轮空。`)
  } else if (byes > 0) {
    hints.push(`签表 ${size} 个签位、晋级队 ${advance} 支，首轮 ${byes} 支队伍轮空自动晋级。`)
  }

  // 小组赛估算（满员均摊分组）
  const sizes = groupSizes(maxEntries, groupCount)
  let groupMatchesTotal = 0
  sizes.forEach((k) => {
    const rounds = configuredGroupRounds > 0 ? configuredGroupRounds : autoGroupRounds(k)
    groupMatchesTotal += rounds * groupMatchesPerRound(k)
  })
  const sampleRounds =
    configuredGroupRounds > 0 ? configuredGroupRounds : autoGroupRounds(Math.min(groupSize, maxEntries))

  /* ---- 构造空签表（与 seedPairs 同口径） ---- */
  let seq = 0
  const nid = (): number => -(++seq)
  const qualifierTeam = (label: string, gSeq: number): TournamentTeam => ({
    entryId: nid(),
    name: label,
    members: [],
    groupNo: groupName(gSeq),
    advance: true,
    finalRank: null,
  })

  // 晋级队按（小组名次 → 组序）排列：先各组第 1，再各组第 2……
  const qualifiers: { team: TournamentTeam | null }[] = []
  for (let rank = 0; rank < advancePerGroup; rank++) {
    for (let g = 0; g < groupCount; g++) {
      qualifiers.push({ team: qualifierTeam(`${groupName(g)}组第${rank + 1}`, g) })
    }
  }

  // 标准种子签位
  const positions: ({ team: TournamentTeam | null } | null)[] = new Array(size).fill(null)
  const half = size / 2
  const leftCount = Math.min(Math.ceil(advance / 2), half)
  for (let i = 0; i < advance; i++) {
    if (i < leftCount) positions[i] = qualifiers[i]
    else positions[half + (i - leftCount)] = qualifiers[i]
  }

  const emptyMatch = (
    stage: number,
    roundNo: number,
    roundSize: number,
    roundName: string,
    matchNo: number,
    a: TournamentTeam | null,
    b: TournamentTeam | null,
  ): TournamentMatch => ({
    id: nid(),
    stage,
    roundNo,
    roundSize,
    roundName,
    groupNo: null,
    matchNo,
    court: null,
    teamA: a,
    teamB: b,
    winner: 0,
    scoreA: null,
    scoreB: null,
    refereeName: null,
    finished: false,
    involved: false,
  })

  const rounds: TournamentRoundBoard[] = []

  // 首轮：种子位两两配对 (i, size-1-i)
  let roundSize = size
  const firstRound: TournamentMatch[] = []
  for (let i = 0; i < half; i++) {
    const a = positions[i]?.team ?? null
    const b = positions[size - 1 - i]?.team ?? null
    firstRound.push(emptyMatch(2, 1, size, ROUND_NAMES[size] ?? `${size} 强`, i + 1, a, b))
  }
  rounds.push({ roundNo: 1, roundSize: size, roundName: ROUND_NAMES[size] ?? `${size} 强`, finished: false, matches: firstRound })

  // 其余各轮：待定对阵，按序汇聚两场
  let prev = firstRound
  let rNo = 2
  while (roundSize > 4) {
    const nextSize = roundSize / 2
    const list: TournamentMatch[] = []
    for (let i = 0; i < prev.length; i += 2) {
      const m = emptyMatch(
        2,
        rNo,
        nextSize,
        ROUND_NAMES[nextSize] ?? `${nextSize} 强`,
        i / 2 + 1,
        null,
        null,
      )
      m.childMatchIds = [prev[i].id, prev[i + 1].id]
      list.push(m)
    }
    rounds.push({ roundNo: rNo, roundSize: nextSize, roundName: ROUND_NAMES[nextSize] ?? `${nextSize} 强`, finished: false, matches: list })
    prev = list
    roundSize = nextSize
    rNo++
  }

  // 收官战：季军赛（虚线挂半决赛）+ 决赛
  const semiIds = prev.map((m) => m.id)
  const bronze = emptyMatch(3, 0, 0, '季军赛', 1, null, null)
  bronze.childMatchIds = semiIds
  const finalM = emptyMatch(4, 0, 0, '决赛', 1, null, null)
  finalM.childMatchIds = semiIds
  rounds.push({ roundNo: 0, roundSize: 0, roundName: '季军赛', finished: false, matches: [bronze] })
  rounds.push({ roundNo: 0, roundSize: 0, roundName: '决赛', finished: false, matches: [finalM] })

  const koMatches = size - 2 + 2 // 淘汰赛 size-2 + 季军赛/决赛 2 场

  const stats: StatItem[] = [
    { label: '满员队伍', value: `${maxEntries} 队` },
    { label: '分组', value: `${groupCount} 组（每组约 ${sizes[0]}${sizes[0] !== sizes[sizes.length - 1] ? '~' + sizes[sizes.length - 1] : ''} 队）` },
    { label: '小组赛', value: `每队约 ${sampleRounds} 轮 · 共约 ${groupMatchesTotal} 场` },
    { label: '晋级淘汰赛', value: `${advance} 队` },
    { label: '签表规模', value: `${size} 强 · ${koRounds} 轮` },
    { label: '首轮轮空', value: byes > 0 ? `${byes} 支` : '无', warn: byes > 0 },
    { label: '淘汰赛场次', value: `${koMatches} 场（含季军赛/决赛）` },
  ]

  return { valid: true, hints, stats, rounds }
})
</script>

<template>
  <div class="preview">
    <template v-if="result.valid">
      <div class="stat-grid">
        <div v-for="s in result.stats" :key="s.label" class="stat" :class="{ warn: s.warn }">
          <span class="stat-label">{{ s.label }}</span>
          <strong class="stat-value">{{ s.value }}</strong>
        </div>
      </div>
      <p v-for="(h, i) in result.hints" :key="i" class="hint">{{ h }}</p>
      <div class="tree-box">
        <TournamentBracketTree :rounds="result.rounds" />
      </div>
      <p class="note">
        本预览按「单组别报满 {{ maxEntries }} 队」预估，叶子为各组晋级名额（如 A组第1）；实际签位以报名人数与抽签结果为准。
      </p>
    </template>
    <div v-else class="invalid">
      <strong>当前配置无法生成淘汰赛签表</strong>
      <p>{{ result.error }}</p>
    </div>
  </div>
</template>

<style scoped>
.preview { display: flex; flex-direction: column; gap: 12px; }
.stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.stat { background: #f7f9f8; border: 1px solid #eceae4; border-radius: 8px; padding: 8px 12px; display: flex; flex-direction: column; gap: 2px; }
.stat.warn { background: #fdf6e3; border-color: #f0dfae; }
.stat-label { font-size: 11px; color: #5a726d; }
.stat-value { font-size: 13px; color: #1a2e2a; font-weight: 700; }
.hint { margin: 0; font-size: 12px; color: #7a4f1b; background: #fdf6e3; border: 1px solid #f0dfae; border-radius: 8px; padding: 8px 12px; }
.tree-box { border: 1px solid #eceae4; border-radius: 10px; background: #fff; padding: 10px; max-height: 58vh; overflow: auto; }
.note { margin: 0; font-size: 12px; color: #9aa8a4; }
.invalid { padding: 28px 20px; text-align: center; color: #b33a2e; background: #fbe6e3; border: 1px solid #f0c9c4; border-radius: 10px; }
.invalid strong { font-size: 14px; }
.invalid p { margin: 8px 0 0; font-size: 13px; color: #7a4a45; }
</style>

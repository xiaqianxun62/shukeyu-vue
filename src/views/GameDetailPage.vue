<!--球局详情-->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { cancelRegisterGame, getGame, registerGame, type Game } from '../api/game'
import { useAuth } from '../composables/useAuth'
import QqMap from '../components/QqMap.vue'
import SmartImage from '../components/SmartImage.vue'

const props = defineProps<{ gameId: number }>()
const emit = defineEmits<{ back: [] }>()

const { user, isLoggedIn } = useAuth()

const loading = ref(true)
const game = ref<Game | null>(null)
const error = ref('')
const joining = ref(false)

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    game.value = await getGame(props.gameId)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => props.gameId, load)

const STATUS_TEXT: Record<number, string> = { 0: '报名中', 1: '已编排', 2: '已结束' }
const GENDER_TEXT: Record<number, string> = { 1: '男', 2: '女', 0: '' }

const statusText = computed(() => {
  if (!game.value) return ''
  if (game.value.status !== 0) return STATUS_TEXT[game.value.status] ?? '已编排'
  return isFull.value ? '已满员' : '报名中'
})

const statusClass = computed(() => {
  if (!game.value) return ''
  if (game.value.status !== 0) return 'done'
  return isFull.value ? 'full' : 'open'
})

const isFull = computed(() => {
  if (!game.value) return false
  return game.value.registeredCount >= game.value.maxPlayers
})

const isOnsite = computed(() => !!game.value && game.value.mode === 1)

const timeText = computed(() => {
  if (!game.value) return ''
  const g = game.value
  const start = g.startTime ? g.startTime.slice(0, 5) : ''
  const end = g.endTime ? g.endTime.slice(0, 5) : ''
  const span = start && end ? `${start} - ${end}` : start || end
  return span ? `${g.playDate} ${span}` : g.playDate
})

const locationText = computed(() => {
  if (!game.value) return ''
  const g = game.value
  if (g.courtName && g.location && g.location !== g.courtName) {
    return `${g.courtName}（${g.location}）`
  }
  return g.courtName || g.location || ''
})

const registered = computed(() => {
  if (!game.value || !user.value) return false
  return game.value.registrations.some((r) => r.userId === user.value!.userId)
})

/*const canHide = computed(() => {
  if (!game.value || !user.value) return false
  return game.value.creatorId === user.value.userId || !!user.value.isAdmin
})*/

const genderStat = computed(() => {
  const list = game.value?.registrations ?? []
  let male = 0, female = 0
  list.forEach((r) => {
    if (r.gender === 1) male++
    else if (r.gender === 2) female++
  })
  return { total: list.length, male, female }
})

// ===== 头像取色（与小程序 colorOf 保持一致） =====
const AVATAR_COLORS = ['#E8A87C', '#85DCBA', '#C38D9E', '#41B3A3', '#E27D60', '#5C4B99', '#F18F01', '#2E4057', '#D5573B', '#0E7C7B']
function colorOf(userId: number): string {
  return AVATAR_COLORS[Math.abs(userId) % AVATAR_COLORS.length]
}

function initialOf(name: string): string {
  if (!name) return '球'
  return name.trim().charAt(0).slice(0, 1)
}

/** 默认封面图（当game.cover 为空时使用） */
const DEFAULT_COVER = '/uploads/cover_1791509309948_6080.jpg'
const coverUrl = computed(() => game.value?.cover || DEFAULT_COVER)

async function handleJoin(): Promise<void> {
  if (!isLoggedIn.value) { window.location.hash = '#/login'; return }
  if (!game.value || registered.value || isFull.value) return
  joining.value = true
  try {
    const updated = await registerGame(props.gameId)
    game.value = updated
  } catch (e: any) {
    alert(e?.message || '报名失败')
  } finally {
    joining.value = false
  }
}

async function handleCancel(): Promise<void> {
  if (!game.value || !registered.value) return
  if (!confirm('确定要取消报名吗？')) return
  joining.value = true
  try {
    const updated = await cancelRegisterGame(props.gameId)
    game.value = updated
  } catch (e: any) {
    alert(e?.message || '取消失败')
  } finally {
    joining.value = false
  }
}

function btnState(): { text: string; disabled: boolean; kind: 'primary' | 'ghost' } {
  if (!game.value) return { text: '加载中', disabled: true, kind: 'primary' }
  if (game.value.status !== 0) return { text: STATUS_TEXT[game.value.status], disabled: true, kind: 'ghost' }
  if (registered.value) return { text: '取消报名', disabled: false, kind: 'ghost' }
  if (isFull.value) return { text: '已满员', disabled: true, kind: 'ghost' }
  return {
    text: isLoggedIn.value ? '立即报名' : '登录并报名',
    disabled: false,
    kind: 'primary',
  }
}

function openCourtMap(): void {
  if (!game.value?.courtLat || !game.value?.courtLng) return
  const g = game.value
  const name = encodeURIComponent(g.courtName || g.location || '球场')
  const addr = encodeURIComponent(g.location || '')
  const url = `https://api.tianditu.gov.cn/api/navigation?postStr=${g.courtLng},${g.courtLat},${name},${addr}&type=0&dev=1`
  window.open(url, '_blank')
}

function openMini(): void {
  alert('打开微信小程序「羽毛球约球」查看轮排安排、对阵和计分')
}
</script>

<template>
  <div class="detail-page">
    <header class="top">
      <button class="back" @click="emit('back')">← 返回球局列表</button>
      <span v-if="loading" class="top-status">加载中…</span>
      <span v-else-if="error" class="top-status err">加载失败</span>
    </header>

    <div v-if="loading" class="wall-state">正在加载球局…</div>
    <div v-else-if="error" class="wall-state err">{{ error }}</div>

    <main v-else-if="game" class="content">
      <!-- 封面 Banner -->
      <section class="cover-banner">
        <SmartImage :src="coverUrl" class="cover-img" alt="" />
        <div class="cover-overlay" />
        <div class="cover-info">
          <h1 class="head-title">{{ game.title }}</h1>
          <span class="status-tag" :class="statusClass">{{ statusText }}</span>
        </div>
      </section>

      <!-- 主信息卡 -->
      <section class="card head-card">
        <div v-if="game.remark" class="head-remark">{{ game.remark }}</div>

        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">时间</span>
            <span class="info-value">{{ isOnsite ? '现场报名（人齐后编排开打）' : timeText }}</span>
          </div>
          <div v-if="locationText" class="info-row clickable" @click="openCourtMap">
            <span class="info-label">地点</span>
            <span class="info-value">{{ locationText }}
              <span v-if="game.courtLat && game.courtLng" class="map-hint">（点此打开导航）</span>
            </span>
          </div>
          <div class="info-row">
            <span class="info-label">人数</span>
            <span class="info-value">{{ game.registeredCount }} / {{ game.maxPlayers }}
              <span class="gender-sub" v-if="genderStat.total">
                （男 {{ genderStat.male }} · 女 {{ genderStat.female }}）
              </span>
              <span v-if="game.courtCount && game.courtCount > 1" class="court-sub"> · {{ game.courtCount }} 片场地</span>
            </span>
          </div>
        </div>

        <!-- 发起人 -->
        <div v-if="game.creatorName" class="creator-row">
          <div
            class="avatar"
            :style="{ background: colorOf(game.creatorId) }"
          >
            <SmartImage v-if="game.creatorAvatar" :src="game.creatorAvatar" alt="" />
            <span v-else>{{ initialOf(game.creatorName) }}</span>
          </div>
          <div class="creator-info">
            <span class="creator-name">{{ game.creatorName }}</span>
            <span v-if="game.creatorGender" class="gender-tag" :class="game.creatorGender === 1 ? 'm' : 'f'">{{ GENDER_TEXT[game.creatorGender] }}</span>
            <span v-if="game.creatorRating" class="rating-tag">ELO {{ game.creatorRating }}</span>
            <span class="creator-label">发起人</span>
          </div>
        </div>

        <!-- 主操作 -->
        <div class="actions-row">
          <button
            class="btn"
            :class="btnState().kind"
            :disabled="btnState().disabled || joining"
            @click="btnState().kind === 'ghost' && registered ? handleCancel() : handleJoin()"
          >
            {{ joining ? '处理中…' : btnState().text }}
          </button>
          <button class="btn ghost" @click="openMini">前往小程序查看轮排/计分</button>
        </div>
      </section>

      <!-- 地图 -->
      <section v-if="game.courtLat && game.courtLng" class="card map-card">
        <div class="map-card-head">
          <div class="map-card-title-row">
            <span class="card-title">📍 {{ game.courtName || game.location || '球场位置' }}</span>
            <a
              class="nav-link"
              target="_blank"
              :href="`https://api.tianditu.gov.cn/v2/search?postStr=${game.courtLng},${game.courtLat}&type=geocode`"
            >打开地图 →</a>
          </div>
          <div v-if="game.courtName && game.location !== game.courtName" class="map-address">{{ game.location }}</div>
        </div>
        <QqMap
          :lat="Number(game.courtLat)"
          :lng="Number(game.courtLng)"
          :title="game.courtName || game.location || '球场位置'"
          :subtitle="(game.courtName && game.location && game.location !== game.courtName) ? game.location : ''"
          height="380px"
          :zoom="16"
        />
        <div class="map-actions">
          <a
            class="map-btn primary"
            :href="`https://uri.amap.com/navigation?to=${game.courtLng},${game.courtLat},${encodeURIComponent(game.courtName || game.location || '球场')}&mode=car&policy=1`"
            target="_blank"
          >
            🧭 导航到此（高德）
          </a>
          <a
            class="map-btn"
            :href="`https://map.qq.com/api/dir?from=我的位置&to=${game.courtLat},${game.courtLng}&type=0`"
            target="_blank"
          >
            🗺️ 腾讯地图
          </a>
        </div>
      </section>

      <!-- 报名名单 -->
      <section class="card roster-card">
        <div class="card-head">
          <h2 class="card-title">报名名单（{{ game.registeredCount }}）</h2>
        </div>
        <div v-if="!game.registrations?.length" class="empty-state">还没有人报名，成为第一个加入球局的球友吧~</div>
        <ul v-else class="roster-list">
          <li
            v-for="r in game.registrations"
            :key="r.userId"
            class="roster-item"
            :class="{ me: user?.userId === r.userId }"
          >
            <div class="avatar" :style="{ background: colorOf(r.userId) }">
              <SmartImage v-if="r.avatar" :src="r.avatar" alt="" />
              <span v-else>{{ initialOf(r.displayName || '') }}</span>
            </div>
            <div class="roster-info">
              <span class="roster-name">{{ r.displayName || '球友' + r.userId }}</span>
              <span v-if="r.gender" class="gender-tag" :class="r.gender === 1 ? 'm' : 'f'">{{ GENDER_TEXT[r.gender] }}</span>
            </div>
            <span v-if="r.rating" class="rating">{{ r.rating }}</span>
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>

<style scoped>
.detail-page { min-height: 100vh; background: #faf7f0; padding-bottom: 48px; }

.top {
  position: sticky; top: 0; z-index: 10;
  display: flex; align-items: center; gap: 16px;
  padding: 12px 32px; background: #fff; border-bottom: 1px solid #f0efea;
}
.back { background: none; border: none; color: #14665b; font-size: 14px; font-weight: 600; cursor: pointer; }
.back:hover { text-decoration: underline; }
.top-status { font-size: 13px; color: #5a726d; }
.top-status.err { color: #b33a2e; }

.wall-state { padding: 80px 20px; text-align: center; color: #5a726d; font-size: 14px; }
.wall-state.err { color: #b33a2e; }

.content {
  max-width: 760px; margin: 0 auto; padding: 24px 20px;
  display: flex; flex-direction: column; gap: 16px;
}

.card {
  background: #fff; border-radius: 14px; padding: 20px 22px;
  box-shadow: 0 2px 8px rgba(20,102,91,.06);
}

/* ===== 封面 Banner ===== */
.cover-banner {
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  height: 200px;
  margin-bottom: -4px;
}
.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.cover-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(26,46,42,0) 40%, rgba(26,46,42,0.85) 100%);
}
.cover-info {
  position: absolute;
  left: 20px; right: 20px; bottom: 16px;
  display: flex; align-items: flex-end; justify-content: space-between; gap: 12px;
}
.cover-info .head-title { color: #fff; text-shadow: 0 2px 6px rgba(0,0,0,.4); }
.cover-info .status-tag { flex-shrink: 0; }

/* ===== 头卡 ===== */
.head-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.head-title { margin: 0; font-size: 22px; font-weight: 800; color: #1a2e2a; line-height: 1.3; }
.status-tag {
  font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 20px; flex-shrink: 0;
  background: #e0f1ec; color: #14665b;
}
.status-tag.done { background: #e6e3d4; color: #7a4f1b; }
.status-tag.full { background: #fce4d6; color: #b33a2e; }

.head-remark {
  margin-top: 12px; font-size: 13px; color: #5a726d;
  background: #f6f8f7; padding: 10px 14px; border-radius: 8px; line-height: 1.6;
}

.info-grid {
  margin-top: 16px; display: flex; flex-direction: column; gap: 10px;
}
.info-row {
  display: flex; gap: 12px; align-items: baseline; font-size: 14px;
}
.info-row.clickable { cursor: pointer; }
.info-row.clickable .info-value { color: #14665b; }
.info-row.clickable:hover .info-value { text-decoration: underline; }
.info-label {
  width: 48px; flex-shrink: 0; color: #5a726d; font-size: 12px; font-weight: 500;
}
.info-value { color: #1a2e2a; font-weight: 600; }
.map-hint { color: #5a726d; font-size: 12px; font-weight: 500; }
.gender-sub { color: #5a726d; font-size: 12px; font-weight: 500; margin-left: 4px; }
.court-sub { color: #5a726d; font-size: 12px; font-weight: 500; }

/* ===== 发起人 ===== */
.creator-row {
  margin-top: 16px; display: flex; align-items: center; gap: 12px;
  padding-top: 16px; border-top: 1px solid #f0efea;
}
.avatar {
  width: 44px; height: 44px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 700; font-size: 18px; overflow: hidden;
  flex-shrink: 0;
}
.avatar img { width: 100%; height: 100%; object-fit: cover; }
.creator-info { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.creator-name { font-weight: 700; color: #1a2e2a; font-size: 14px; }
.gender-tag {
  font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 600;
}
.gender-tag.m { background: #e0f1ec; color: #14665b; }
.gender-tag.f { background: #f6dfe3; color: #9a2c4f; }
.rating-tag {
  font-size: 11px; background: #f6f8f7; color: #5a726d; padding: 2px 8px; border-radius: 4px; font-weight: 600;
}
.creator-label {
  font-size: 11px; background: #fce4d6; color: #b33a2e; padding: 2px 8px; border-radius: 4px; font-weight: 600;
}

/* ===== 操作按钮 ===== */
.actions-row {
  margin-top: 16px; display: flex; gap: 10px; flex-wrap: wrap;
}
.btn {
  border: none; border-radius: 10px; padding: 10px 22px;
  cursor: pointer; font-size: 14px; font-weight: 700;
  transition: all .15s;
}
.btn.primary { background: #14665b; color: #fff; }
.btn.primary:hover:not(:disabled) { background: #0f4f47; }
.btn.ghost { background: #f0efea; color: #1a2e2a; }
.btn.ghost:hover:not(:disabled) { background: #e3e8e6; }
.btn:disabled { opacity: .5; cursor: not-allowed; }

/* ===== 通用 ===== */
.card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.card-title { margin: 0; font-size: 15px; font-weight: 700; color: #1a2e2a; }

/* ===== 报名名单 ===== */
.empty-state { padding: 32px; text-align: center; color: #5a726d; font-size: 13px; }

.roster-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.roster-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px; border-radius: 10px;
  background: #f9faf9;
}
.roster-item.me { background: #e0f1ec; outline: 1px solid #14665b; }
.roster-info { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.roster-name { font-weight: 600; color: #1a2e2a; font-size: 14px; }
.roster-info .gender-tag { align-self: flex-start; }
.rating { font-weight: 700; color: #14665b; font-size: 14px; }

/* ===== 地图卡 ===== */
.map-card { padding-bottom: 14px; }
.map-card-head { margin-bottom: 10px; }
.map-card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.nav-link {
  font-size: 12px;
  color: #14665b;
  text-decoration: none;
  flex-shrink: 0;
}
.nav-link:hover { text-decoration: underline; }
.map-address {
  margin-top: 3px;
  font-size: 12px;
  color: #6b7b78;
}
.map-actions {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}
.map-btn {
  flex: 1;
  text-align: center;
  padding: 9px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #14665b;
  background: #eef5f2;
  text-decoration: none;
  transition: all .15s;
}
.map-btn:hover { background: #dceee8; color: #0e4a42; }
.map-btn.primary {
  background: linear-gradient(135deg, #14665b, #1a8575);
  color: #fff;
}
.map-btn.primary:hover {
  background: linear-gradient(135deg, #0f544a, #156c5f);
}
</style>

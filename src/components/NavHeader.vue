<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import SvgIcon from './SvgIcon.vue'
import { useAuth } from '../composables/useAuth'

const emit = defineEmits<{
  ctaClick: []
  /** 用户菜单「编辑个人信息」 */
  profileClick: []
  /** 用户菜单「站点文案设置」 */
  settingsClick: []
  /** 用户菜单「首页公告设置」（仅管理员） */
  noticeClick: []
  /** 用户菜单「用户管理」（仅管理员） */
  adminClick: []
  /** 用户菜单「球场场地管理」（仅管理员） */
  courtsClick: []
  /** 用户菜单「身份校验问题管理」（仅管理员） */
  questionsClick: []
  /** 用户菜单「访问日志」（仅管理员） */
  visitLogsClick: []
}>()

const { isLoggedIn, isAdmin, user, logout } = useAuth()

interface MenuItem {
  id: string
  label: string
  /** true = 桌面端平铺在导航栏，false = 收进「更多」下拉 */
  primary: boolean
}

/** 顺序与页面自上而下一致：滚动高亮依赖这个顺序 */
const MENU: MenuItem[] = [
  { id: 'hero', label: '首页', primary: true },
  { id: 'features', label: '核心功能', primary: false },
  { id: 'howto', label: '如何加入', primary: false },
  { id: 'platforms', label: '多端平台', primary: false },
  { id: 'signup', label: '报名', primary: false },
  { id: 'arrange', label: '自动编排', primary: true },
  { id: 'ranking', label: '积分榜', primary: true },
  { id: 'elo-lab', label: 'ELO 试算', primary: false },
  { id: 'avatar-wall', label: '在线头像墙', primary: false },
]

/** 桌面端断点：≥1024px 平铺主导航 + 下拉，以下走抽屉 */
const DESKTOP_QUERY = '(min-width: 1024px)'

const primaryItems = computed(() => MENU.filter((i) => i.primary))
const moreItems = computed(() => MENU.filter((i) => !i.primary))

const headerRef = ref<HTMLElement | null>(null)
const moreBtnRef = ref<HTMLButtonElement | null>(null)
const userBtnRef = ref<HTMLButtonElement | null>(null)
const moreMenuRef = ref<HTMLElement | null>(null)
const userMenuRef = ref<HTMLElement | null>(null)
const drawerRef = ref<HTMLElement | null>(null)
const activeId = ref<string>('hero')
const moreOpen = ref(false)
const userOpen = ref(false)
const drawerOpen = ref(false)
/** 桌面下拉 Teleport 到 body 后，按触发按钮的视口坐标摆放 */
const morePos = ref<{ top: number; left: number } | null>(null)
const userPos = ref<{ top: number; left: number } | null>(null)
// 首帧就按真实视口渲染，避免桌面端闪一下汉堡按钮
const isDesktop = ref(
  typeof window !== 'undefined' ? window.matchMedia(DESKTOP_QUERY).matches : false,
)

const moreActive = computed(() => moreItems.value.some((i) => i.id === activeId.value))
const activeLabel = computed(
  () => MENU.find((i) => i.id === activeId.value)?.label ?? '首页',
)

/** 滚动高亮：取最后一个已滚过的区块 */
function updateActive(): void {
  const scrollY = window.scrollY + 100
  let active = MENU[0].id
  for (const item of MENU) {
    const el = document.getElementById(item.id)
    if (el && el.offsetTop <= scrollY) active = item.id
  }
  activeId.value = active
  // 滚动时收起下拉，避免浮层跟着页面跑
  moreOpen.value = false
  userOpen.value = false
}

function go(id: string): void {
  closeAll()
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  activeId.value = id
  // 同步 hash（replaceState 不触发 hashchange，不会误切登录页）
  history.replaceState(null, '', `#${id}`)
}

function closeAll(): void {
  moreOpen.value = false
  userOpen.value = false
  drawerOpen.value = false
}

/** 以触发按钮为锚点计算 fixed 浮层位置，右对齐按钮并夹在视口内 */
function anchorPos(btn: HTMLElement, width: number): { top: number; left: number } {
  const rect = btn.getBoundingClientRect()
  return {
    top: rect.bottom + 8,
    left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
  }
}

function toggleMore(): void {
  userOpen.value = false
  moreOpen.value = !moreOpen.value
  if (moreOpen.value && moreBtnRef.value) {
    morePos.value = anchorPos(moreBtnRef.value, 168)
  }
}

function toggleUser(): void {
  moreOpen.value = false
  userOpen.value = !userOpen.value
  if (userOpen.value && userBtnRef.value) {
    userPos.value = anchorPos(userBtnRef.value, 208)
  }
}

function toggleDrawer(): void {
  drawerOpen.value = !drawerOpen.value
}

function handleCta(e: MouseEvent): void {
  e.preventDefault()
  closeAll()
  emit('ctaClick')
}

async function handleLogout(): Promise<void> {
  closeAll()
  await logout()
}

function openProfile(): void {
  closeAll()
  emit('profileClick')
}

function openSettings(): void {
  closeAll()
  emit('settingsClick')
}

/** 点击浮层外部 / 按 ESC 关闭。浮层已 Teleport 到 body，需逐一放行内部点击 */
function onDocumentClick(e: MouseEvent): void {
  const t = e.target as Node
  if (
    headerRef.value?.contains(t) ||
    moreMenuRef.value?.contains(t) ||
    userMenuRef.value?.contains(t) ||
    drawerRef.value?.contains(t)
  ) {
    return
  }
  closeAll()
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeAll()
}

function onViewportChange(e: MediaQueryListEvent): void {
  isDesktop.value = e.matches
  if (e.matches) closeAll()
}

let mql: MediaQueryList | null = null

// 抽屉打开时锁住页面滚动，关闭后恢复
watch(drawerOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})

onMounted(() => {
  mql = window.matchMedia(DESKTOP_QUERY)
  isDesktop.value = mql.matches
  mql.addEventListener('change', onViewportChange)
  window.addEventListener('scroll', updateActive, { passive: true })
  // 浮层为 fixed 定位，窗口尺寸变化后锚点坐标会失真，直接收起
  window.addEventListener('resize', closeAll)
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
  updateActive()
})

onBeforeUnmount(() => {
  mql?.removeEventListener('change', onViewportChange)
  window.removeEventListener('scroll', updateActive)
  window.removeEventListener('resize', closeAll)
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <header ref="headerRef" class="header">
    <div class="container header-inner">
      <a href="#hero" class="logo" @click.prevent="go('hero')">
        <SvgIcon type="logo" :size="24" class="logo-icon" />
        <span>数科羽 shukeyu</span>
      </a>

      <!-- 桌面导航：主项平铺 + 「更多」下拉 -->
      <nav v-if="isDesktop" class="nav-desk" aria-label="主导航">
        <a
          v-for="item in primaryItems"
          :key="item.id"
          :href="'#' + item.id"
          class="nav-link"
          :class="{ active: activeId === item.id }"
          @click.prevent="go(item.id)"
        >
          {{ item.label }}
        </a>

        <div class="menu-wrap">
          <button
            ref="moreBtnRef"
            type="button"
            class="nav-link nav-more"
            :class="{ active: moreActive || moreOpen }"
            :aria-expanded="moreOpen"
            aria-controls="nav-more-menu"
            @click="toggleMore"
          >
            更多
            <SvgIcon type="chevron" :size="14" class="nav-more-icon" :class="{ up: moreOpen }" />
          </button>
        </div>
      </nav>

      <!-- 下拉浮层 Teleport 到 body：header 的 backdrop-filter 会成为 fixed 后代的
           包含块并裁剪浮层，挂到 body 后按按钮视口坐标定位，不受任何祖先容器影响 -->
      <Teleport to="body">
        <div
          v-show="moreOpen"
          ref="moreMenuRef"
          id="nav-more-menu"
          class="dropdown"
          :style="morePos ? { top: morePos.top + 'px', left: morePos.left + 'px' } : undefined"
        >
          <a
            v-for="item in moreItems"
            :key="item.id"
            :href="'#' + item.id"
            class="dropdown-item"
            :class="{ active: activeId === item.id }"
            @click.prevent="go(item.id)"
          >
            {{ item.label }}
          </a>
        </div>
      </Teleport>
      <Teleport to="body">
        <div
          v-show="userOpen"
          ref="userMenuRef"
          id="nav-user-menu"
          class="dropdown dropdown-user"
          :style="userPos ? { top: userPos.top + 'px', left: userPos.left + 'px' } : undefined"
        >
          <div class="user-meta">
            <div class="user-meta-name">{{ user?.name }}</div>
            <div v-if="user?.account" class="user-meta-sub">账号 {{ user.account }}</div>
            <div class="user-meta-stats">
              <span>ELO <strong>{{ user?.rating ?? 1200 }}</strong></span>
              <span>场次 <strong>{{ user?.gamesPlayed ?? 0 }}</strong></span>
            </div>
          </div>
          <button type="button" class="dropdown-item" @click="openProfile">
            <SvgIcon type="person" :size="15" />
            编辑个人信息
          </button>
          <button v-if="isAdmin" type="button" class="dropdown-item" @click="openSettings">
            <SvgIcon type="engine" :size="15" />
            站点文案
          </button>
          <button v-if="isAdmin" type="button" class="dropdown-item" @click="emit('noticeClick')">
            <SvgIcon type="engine" :size="15" />
            首页公告
          </button>
          <button v-if="isAdmin" type="button" class="dropdown-item" @click="emit('adminClick')">
            <SvgIcon type="users" :size="15" />
            用户管理
          </button>
          <button v-if="isAdmin" type="button" class="dropdown-item" @click="emit('courtsClick')">
            <SvgIcon type="location" :size="15" />
            球场管理
          </button>
          <button v-if="isAdmin" type="button" class="dropdown-item" @click="emit('questionsClick')">
            <SvgIcon type="engine" :size="15" />
            问题管理
          </button>
          <button v-if="isAdmin" type="button" class="dropdown-item" @click="emit('visitLogsClick')">
            <SvgIcon type="users" :size="15" />
            访问日志
          </button>
          <button type="button" class="dropdown-item danger" @click="handleLogout">
            <SvgIcon type="logout" :size="15" />
            退出登录
          </button>
        </div>
      </Teleport>

      <div class="header-right">
        <a v-if="!isLoggedIn" href="#hero" class="cta-btn" @click="handleCta">
          <span>登陆</span>
        </a>

        <div v-else class="menu-wrap">
          <button
            ref="userBtnRef"
            type="button"
            class="user-chip"
            :aria-expanded="userOpen"
            aria-controls="nav-user-menu"
            @click="toggleUser"
          >
            <span class="user-chip-avatar">{{ (user?.name ?? '球').charAt(0) }}</span>
            <span class="user-chip-name">{{ user?.name }}</span>
            <SvgIcon type="chevron" :size="14" class="user-chip-icon" :class="{ up: userOpen }" />
          </button>
        </div>

        <button
          v-if="!isDesktop"
          type="button"
          class="hamburger"
          :class="{ open: drawerOpen }"
          :aria-expanded="drawerOpen"
          aria-controls="nav-drawer"
          :aria-label="drawerOpen ? '关闭菜单' : '打开菜单'"
          @click="toggleDrawer"
        >
          <SvgIcon :type="drawerOpen ? 'close' : 'menu'" :size="22" />
        </button>
      </div>
    </div>

    <!-- 移动端抽屉：Teleport 到 body，避免被 header 的 backdrop-filter
         建立的包含块压缩（fixed 定位会以 56px 高的 header 为参照而塌陷） -->
    <Teleport to="body">
      <div v-show="drawerOpen" class="drawer-mask" @click="closeAll"></div>
      <aside
        v-show="drawerOpen"
        ref="drawerRef"
        id="nav-drawer"
        class="drawer"
        :class="{ open: drawerOpen }"
      >
      <div class="drawer-head">
        <span class="drawer-title">全部功能</span>
        <span class="drawer-current">当前：{{ activeLabel }}</span>
      </div>
      <nav class="drawer-nav" aria-label="全站导航">
        <a
          v-for="item in MENU"
          :key="item.id"
          :href="'#' + item.id"
          class="drawer-item"
          :class="{ active: activeId === item.id }"
          @click.prevent="go(item.id)"
        >
          {{ item.label }}
        </a>
      </nav>
      <div class="drawer-foot">
        <template v-if="isLoggedIn">
          <div class="drawer-user">
            <span class="user-chip-avatar">{{ (user?.name ?? '球').charAt(0) }}</span>
            <span class="drawer-user-info">
              <strong>{{ user?.name }}</strong>
              <small>ELO {{ user?.rating ?? 1200 }} · {{ user?.gamesPlayed ?? 0 }} 场</small>
            </span>
          </div>
          <button type="button" class="drawer-profile" @click="openProfile">
            <SvgIcon type="person" :size="16" />
            编辑个人信息
          </button>
          <button v-if="isAdmin" type="button" class="drawer-profile" @click="openSettings">
            <SvgIcon type="engine" :size="16" />
            站点文案
          </button>
          <button v-if="isAdmin" type="button" class="drawer-profile" @click="emit('noticeClick')">
            <SvgIcon type="engine" :size="16" />
            首页公告
          </button>
          <button v-if="isAdmin" type="button" class="drawer-profile" @click="emit('adminClick')">
            <SvgIcon type="users" :size="16" />
            用户管理
          </button>
          <button v-if="isAdmin" type="button" class="drawer-profile" @click="emit('courtsClick')">
            <SvgIcon type="location" :size="16" />
            球场管理
          </button>
          <button v-if="isAdmin" type="button" class="drawer-profile" @click="emit('questionsClick')">
            <SvgIcon type="engine" :size="16" />
            问题管理
          </button>
          <button v-if="isAdmin" type="button" class="drawer-profile" @click="emit('visitLogsClick')">
            <SvgIcon type="users" :size="16" />
            访问日志
          </button>
          <button type="button" class="drawer-logout" @click="handleLogout">
            <SvgIcon type="logout" :size="16" />
            退出登录
          </button>
        </template>
        <button v-else type="button" class="drawer-login" @click="handleCta">登录 / 注册</button>
      </div>
      </aside>
    </Teleport>
  </header>
</template>

<style scoped>
.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.menu-wrap {
  position: relative;
}

/* 已登录用户胶囊 */
.user-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 140px;
  height: 36px;
  padding: 0 10px 0 6px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--card);
  color: var(--text);
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.user-chip:hover {
  border-color: var(--primary-light);
  background: var(--success-bg);
  color: var(--primary);
}
.user-chip-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--primary);
  color: var(--bg);
  font-size: 12px;
  font-weight: 700;
}
.user-chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 桌面主导航 */
.nav-desk {
  display: flex;
  align-items: center;
  gap: 2px;
}
.nav-more {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  border: none;
  background: transparent;
  font-family: inherit;
  cursor: pointer;
}
.nav-more-icon,
.user-chip-icon {
  transition: transform 0.2s ease;
}
.nav-more-icon.up,
.user-chip-icon.up {
  transform: rotate(180deg);
}

/* 下拉浮层：fixed 定位（已 Teleport 到 body），top/left 由 JS 按按钮位置注入 */
.dropdown {
  position: fixed;
  min-width: 168px;
  max-width: calc(100vw - 16px);
  padding: 6px;
  border: 1px solid var(--border-light);
  border-radius: 12px;
  background: var(--card);
  box-shadow: var(--shadow-md);
  z-index: 300;
}
.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 9px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  font-family: inherit;
  font-size: 14px;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.dropdown-item:hover,
.dropdown-item.active {
  background: var(--success-bg);
  color: var(--primary);
}
.dropdown-item.danger {
  margin-top: 4px;
  border-top: 1px solid var(--border-light);
  border-radius: 0 0 8px 8px;
  color: #a0522d;
}
.dropdown-item.danger:hover {
  background: rgba(160, 82, 45, 0.1);
  color: #a0522d;
}

/* 用户菜单资料区 */
.dropdown-user {
  min-width: 208px;
}
.user-meta {
  padding: 10px 12px 12px;
  border-bottom: 1px solid var(--border-light);
  margin-bottom: 4px;
}
.user-meta-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}
.user-meta-sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-muted);
}
.user-meta-stats {
  display: flex;
  gap: 12px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.user-meta-stats strong {
  color: var(--primary);
}

/* 汉堡按钮 */
.hamburger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--card);
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s;
}
.hamburger:hover,
.hamburger.open {
  border-color: var(--primary-light);
  color: var(--primary);
  background: var(--success-bg);
}

/* 抽屉 */
.drawer-mask {
  position: fixed;
  inset: 56px 0 0;
  background: rgba(26, 46, 42, 0.32);
  z-index: 110;
}
.drawer {
  position: fixed;
  top: 56px;
  right: 0;
  bottom: 0;
  width: min(300px, 82vw);
  display: flex;
  flex-direction: column;
  padding: 16px 14px calc(16px + env(safe-area-inset-bottom));
  background: var(--card);
  border-left: 1px solid var(--border-light);
  box-shadow: -8px 0 24px rgba(20, 102, 91, 0.12);
  overflow-y: auto;
  z-index: 115;
  animation: drawer-in 0.22s ease-out;
}
@keyframes drawer-in {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}
.drawer-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0 4px 10px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--border-light);
}
.drawer-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}
.drawer-current {
  font-size: 12px;
  color: var(--text-muted);
}
.drawer-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.drawer-item {
  padding: 11px 12px;
  border-radius: 10px;
  color: var(--text);
  font-size: 15px;
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
}
.drawer-item:hover,
.drawer-item.active {
  background: var(--success-bg);
  color: var(--primary);
  font-weight: 600;
}
.drawer-foot {
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px solid var(--border-light);
}
.drawer-user {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.drawer-user-info {
  display: flex;
  flex-direction: column;
  line-height: 1.4;
}
.drawer-user-info small {
  font-size: 12px;
  color: var(--text-muted);
}
.drawer-login,
.drawer-logout {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 42px;
  border-radius: 12px;
  font-family: inherit;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}
.drawer-login {
  border: none;
  background: var(--accent);
  color: var(--text);
}
.drawer-login:hover {
  background: var(--accent-dark);
}
.drawer-profile {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 42px;
  margin-bottom: 8px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--success-bg);
  color: var(--primary);
  font-family: inherit;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}
.drawer-profile:hover {
  border-color: var(--primary-light);
}
.drawer-logout {
  border: 1px solid var(--border);
  background: var(--card);
  color: #a0522d;
}
.drawer-logout:hover {
  background: rgba(160, 82, 45, 0.08);
}

.nav-link:focus-visible,
.dropdown-item:focus-visible,
.hamburger:focus-visible,
.user-chip:focus-visible,
.drawer-item:focus-visible,
.drawer-login:focus-visible,
.drawer-logout:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

@media (max-width: 420px) {
  .drawer {
    top: 52px;
    width: 86vw;
  }
  .hamburger {
    width: 34px;
    height: 34px;
  }
  .user-chip {
    max-width: 108px;
    height: 32px;
    padding: 0 8px 0 4px;
    font-size: 13px;
  }
  .user-chip-avatar {
    width: 21px;
    height: 21px;
    font-size: 11px;
  }
}
</style>

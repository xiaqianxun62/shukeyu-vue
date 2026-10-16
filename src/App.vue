<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import NavHeader from './components/NavHeader.vue'
import HeroSection from './components/HeroSection.vue'
import FeaturesSection from './components/FeaturesSection.vue'
import HowToSection from './components/HowToSection.vue'
import PlatformsSection from './components/PlatformsSection.vue'
import SignupSection from './components/SignupSection.vue'
import ArrangeSection from './components/ArrangeSection.vue'
import RankingSection from './components/RankingSection.vue'
import EloLabSection from './components/EloLabSection.vue'
import AvatarWallSection from './components/AvatarWallSection.vue'
import CtaToast from './components/CtaToast.vue'
import FooterSection from './components/FooterSection.vue'
import AuthPage from './views/AuthPage.vue'
import ProfilePage from './views/ProfilePage.vue'
import SettingsPage from './views/SettingsPage.vue'
import AdminUsersPage from './views/AdminUsersPage.vue'
import CourtManagementPage from './views/CourtManagementPage.vue'
import QuestionManagementPage from './views/QuestionManagementPage.vue'
import VisitLogPage from './views/VisitLogPage.vue'
import GameDetailPage from './views/GameDetailPage.vue'
import { useAuth } from './composables/useAuth'
import { isMobileDevice, mobileSiteUrl } from './utils/device'

/**
 * 极简 hash 路由：官网用 #hero 等锚点做滚动，登录页用 #/login、#/register 区分。
 * 不引入 vue-router，保持零依赖。
 */
type Route = 'home' | 'login' | 'register' | 'profile' | 'settings' | 'admin' | 'courts' | 'questions' | 'visitlogs' | 'game'

const showCtaToast = ref(false)
const gameId = ref<number | null>(null)
// gameId 必须在 currentRoute() 之前声明，因为 currentRoute 内部要写 gameId.value
const route = ref<Route>(currentRoute())

/** 手机浏览器访问 PC 官网：首页顶部提示「前往手机版」，仅提示不强制跳转，可关闭（本次访问不再出现） */
const showMobileBanner = ref(false)
const mobileUrl = mobileSiteUrl()

function dismissMobileBanner(): void {
  showMobileBanner.value = false
  try {
    sessionStorage.setItem('shukeyu_mobile_banner_dismissed', '1')
  } catch {
    /* 隐私模式等场景忽略 */
  }
}

onMounted(() => {
  let dismissed = false
  try {
    dismissed = sessionStorage.getItem('shukeyu_mobile_banner_dismissed') === '1'
  } catch {
    dismissed = false
  }
  showMobileBanner.value = isMobileDevice() && !dismissed
})

const { restore } = useAuth()

const authTab = computed<'login' | 'register'>(() =>
  route.value === 'register' ? 'register' : 'login',
)

function currentRoute(): Route {
  const hash = window.location.hash.replace(/^#\/?/, '')
  // 带 ID 的球局详情：#/game/123
  const gameMatch = hash.match(/^game\/(\d+)$/)
  if (gameMatch) {
    gameId.value = Number(gameMatch[1])
    return 'game'
  }
  gameId.value = null
  if (hash === 'login' || hash === 'register' || hash === 'profile' || hash === 'settings' || hash === 'admin' || hash === 'courts' || hash === 'questions' || hash === 'visitlogs') return hash as Route
  return 'home'
}

function syncRoute(): void {
  route.value = currentRoute()
}

/** 导航栏「加入球局」/ 用户头像：进入独立登录页 */
function handleCtaClick(): void {
  window.location.hash = '#/login'
}

/** 用户菜单「编辑个人信息」 */
function handleProfileClick(): void {
  window.location.hash = '#/profile'
}

/** 用户菜单「站点文案设置」 */
function handleSettingsClick(): void {
  window.location.hash = '#/settings'
}

/** 用户菜单「用户管理」（仅管理员） */
function handleAdminClick(): void {
  window.location.hash = '#/admin'
}

/** 用户菜单「球场管理」（仅管理员） */
function handleCourtsClick(): void {
  window.location.hash = '#/courts'
}

/** 用户菜单「身份校验问题管理」（仅管理员） */
function handleQuestionsClick(): void {
  window.location.hash = '#/questions'
}

/** 用户菜单「访问日志」（仅管理员） */
function handleVisitLogsClick(): void {
  window.location.hash = '#/visitlogs'
}

/** 从登录页返回官网（回到首页锚点，hash 变化会自动切回官网视图） */
function handleBack(): void {
  if (window.location.hash.startsWith('#/')) {
    window.location.hash = '#hero'
  } else {
    route.value = 'home'
  }
}

function closeCtaToast(): void {
  showCtaToast.value = false
}

/** 登录后引导前往微信小程序继续约球 */
function handleOpenMini(): void {
  handleBack()
  showCtaToast.value = true
}

// 带着本地 token 刷新页面时，先向后端确认身份是否仍然有效
onMounted(() => {
  restore()
  window.addEventListener('hashchange', syncRoute)
})

onBeforeUnmount(() => {
  window.removeEventListener('hashchange', syncRoute)
})
</script>

<template>
  <div class="app">
    <GameDetailPage
      v-if="route === 'game' && gameId"
      :game-id="gameId"
      @back="handleBack"
    />
    <ProfilePage v-else-if="route === 'profile'" @back="handleBack" />
    <SettingsPage v-else-if="route === 'settings'" @back="handleBack" />
    <AdminUsersPage v-else-if="route === 'admin'" @back="handleBack" />
    <CourtManagementPage v-else-if="route === 'courts'" @back="handleBack" />
    <QuestionManagementPage v-else-if="route === 'questions'" @back="handleBack" />
    <VisitLogPage v-else-if="route === 'visitlogs'" @back="handleBack" />
    <AuthPage
      v-else-if="route !== 'home'"
      :tab="authTab"
      @back="handleBack"
      @open-mini="handleOpenMini"
    />
    <template v-else>
      <div v-if="showMobileBanner" class="mobile-banner">
        <a class="mobile-banner-link" :href="mobileUrl">
          检测到手机访问，点此前往手机版约球页面
        </a>
        <button
          type="button"
          class="mobile-banner-close"
          aria-label="关闭提示"
          @click="dismissMobileBanner"
        >
          ×
        </button>
      </div>
      <NavHeader @cta-click="handleCtaClick" @profile-click="handleProfileClick" @settings-click="handleSettingsClick" @admin-click="handleAdminClick" @courts-click="handleCourtsClick" @questions-click="handleQuestionsClick" @visit-logs-click="handleVisitLogsClick" />
      <main>
        <HeroSection />
        <FeaturesSection />
        <HowToSection />
        <PlatformsSection />
        <SignupSection />
        <ArrangeSection />
        <RankingSection />
        <EloLabSection />
        <AvatarWallSection />
      </main>
      <FooterSection />
    </template>
    <CtaToast :visible="showCtaToast" @close="closeCtaToast" />
  </div>
</template>

<style scoped>
/* 手机访问 PC 官网时的顶部提示横幅：只提示、不强制跳转 */
.mobile-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 8px 40px 8px 16px;
  background: #14665b;
  color: #edf4ee;
  font-size: 13px;
  position: relative;
}

.mobile-banner-link {
  color: #f0d878;
  text-decoration: none;
  font-weight: 600;
}

.mobile-banner-link:hover {
  text-decoration: underline;
}

.mobile-banner-close {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: #edf4ee;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 4px 8px;
}
</style>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AuthForm from './AuthForm.vue'
import { useAuth } from '../composables/useAuth'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  /** 已登录后点击「在微信小程序中打开」 */
  openMini: []
}>()

const { user, logout } = useAuth()

const loginTab = ref<'login' | 'register'>('login')

async function handleLogout(): Promise<void> {
  await logout()
  loginTab.value = 'login'
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && props.visible) {
    emit('close')
  }
}

watch(
  () => props.visible,
  (open) => {
    document.body.style.overflow = open ? 'hidden' : ''
  },
)

onMounted(() => window.addEventListener('keydown', onKeydown))

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Transition name="auth-fade">
    <div v-if="visible" class="auth-mask" @click.self="emit('close')">
      <div class="auth-card" role="dialog" aria-modal="true" aria-label="登录或注册">
        <button class="auth-close" type="button" aria-label="关闭" @click="emit('close')">
          &times;
        </button>

        <!-- 已登录：个人信息 -->
        <template v-if="user">
          <div class="profile-head">
            <div class="profile-avatar">{{ user.name.charAt(0) }}</div>
            <div class="profile-name">{{ user.name }}</div>
            <div v-if="user.account" class="profile-meta">账号 {{ user.account }}</div>
          </div>
          <div class="profile-stats">
            <div class="stat">
              <strong>{{ user.rating }}</strong>
              <span>ELO 积分</span>
            </div>
            <div class="stat">
              <strong>{{ user.gamesPlayed }}</strong>
              <span>历史场次</span>
            </div>
          </div>
          <!-- 分类 ELO 明细：单打 / 双打(同性别) / 混双 -->
          <div class="cat-stats">
            <div class="cat-row">
              <span class="cat-name">单打</span>
              <strong class="cat-rating">{{ user.ratingSingles ?? user.rating ?? 1200 }}</strong>
              <span class="cat-record">{{ user.singlesWin ?? 0 }}胜 {{ user.singlesLoss ?? 0 }}负</span>
            </div>
            <div class="cat-row">
              <span class="cat-name">双打</span>
              <strong class="cat-rating">{{ user.ratingDoubles ?? user.rating ?? 1200 }}</strong>
              <span class="cat-record">{{ user.doublesWin ?? 0 }}胜 {{ user.doublesLoss ?? 0 }}负</span>
            </div>
            <div class="cat-row">
              <span class="cat-name">混双</span>
              <strong class="cat-rating">{{ user.ratingMixed ?? user.rating ?? 1200 }}</strong>
              <span class="cat-record">{{ user.mixedWin ?? 0 }}胜 {{ user.mixedLoss ?? 0 }}负</span>
            </div>
          </div>
          <div class="auth-actions">
            <button class="auth-submit" type="button" @click="emit('openMini')">
              在微信小程序中打开
            </button>
            <button class="auth-ghost" type="button" @click="handleLogout">退出登录</button>
          </div>
        </template>

        <!-- 未登录：登录 / 注册 -->
        <AuthForm v-else :initial-tab="loginTab" />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.auth-fade-enter-active,
.auth-fade-leave-active {
  transition: opacity 0.25s ease;
}
.auth-fade-enter-from,
.auth-fade-leave-to {
  opacity: 0;
}
.auth-fade-enter-active .auth-card,
.auth-fade-leave-active .auth-card {
  transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.auth-fade-enter-from .auth-card,
.auth-fade-leave-to .auth-card {
  transform: translateY(12px) scale(0.98);
}

.auth-mask {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(11, 58, 51, 0.45);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.auth-card {
  position: relative;
  width: 100%;
  max-width: 380px;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  padding: 26px 22px 22px;
  background: var(--card);
  border-radius: 18px;
  box-shadow: 0 18px 48px rgba(11, 58, 51, 0.28);
}

.auth-close {
  position: absolute;
  top: 10px;
  right: 12px;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.auth-close:hover {
  background: var(--bg);
  color: var(--text);
}

.auth-submit {
  width: 100%;
  height: 46px;
  margin-top: 6px;
  border: none;
  border-radius: 12px;
  background: var(--accent);
  color: var(--text);
  font-family: inherit;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
}
.auth-submit:hover:not(:disabled) {
  background: var(--accent-dark);
}
.auth-submit:active:not(:disabled) {
  transform: scale(0.98);
}

.auth-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 20px;
}
.auth-ghost {
  width: 100%;
  height: 42px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--card);
  color: var(--text-muted);
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.auth-ghost:hover {
  background: var(--bg);
  color: var(--text);
}

.profile-head {
  text-align: center;
  padding-top: 8px;
}
.profile-avatar {
  width: 64px;
  height: 64px;
  margin: 0 auto 12px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary);
  color: var(--bg);
  font-size: 26px;
  font-weight: 700;
}
.profile-name {
  font-size: 18px;
  font-weight: 800;
  color: var(--text);
}
.profile-meta {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 2px;
}
.profile-stats {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}
/* 分类 ELO 明细：单打 / 双打 / 混双 */
.cat-stats {
  margin-top: 10px;
  border: 1px solid var(--border-light);
  border-radius: 14px;
  background: var(--bg);
  overflow: hidden;
}
.cat-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  font-size: 13px;
}
.cat-row + .cat-row {
  border-top: 1px solid var(--border-light);
}
.cat-name {
  width: 40px;
  color: var(--text-muted);
}
.cat-rating {
  color: var(--primary);
  font-variant-numeric: tabular-nums;
}
.cat-record {
  margin-left: auto;
  color: var(--text-muted);
  font-size: 12px;
}
.stat {
  flex: 1;
  padding: 14px 10px;
  border: 1px solid var(--border-light);
  border-radius: 14px;
  background: var(--bg);
  text-align: center;
}
.stat strong {
  display: block;
  font-size: 20px;
  font-weight: 800;
  color: var(--primary);
  font-variant-numeric: tabular-nums;
}
.stat span {
  font-size: 12px;
  color: var(--text-muted);
}

@media (max-width: 375px) {
  .auth-card {
    padding: 22px 16px 18px;
  }
}
</style>

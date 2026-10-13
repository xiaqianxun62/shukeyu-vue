import { computed, ref } from 'vue'
import * as authApi from '../api/auth'
import type { AuthResult, LoginPayload, RegisterPayload } from '../api/auth'
import { clearToken, getToken, setToken } from '../api/http'

/**
 * 全局登录状态。
 * 模块级 ref 单例：任何组件调用 useAuth() 拿到的都是同一份状态。
 */

const USER_KEY = 'yuyue_user'

function readCachedUser(): AuthResult | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as AuthResult) : null
  } catch {
    return null
  }
}

const user = ref<AuthResult | null>(readCachedUser())
const submitting = ref(false)
/** 首次 token 校验是否完成（避免刷新页面闪一下未登录态） */
const restored = ref(false)

/** 落盘时只存用户资料，token 由 http 层单独管理 */
function persist(next: AuthResult | null): void {
  user.value = next
  if (next) {
    const profile: AuthResult = {
      token: null,
      userId: next.userId,
      name: next.name,
      nickname: next.nickname ?? null,
      gender: next.gender,
      account: next.account ?? null,
      avatar: next.avatar ?? null,
      rating: next.rating,
      gamesPlayed: next.gamesPlayed,
      isAdmin: next.isAdmin ?? false,
    }
    localStorage.setItem(USER_KEY, JSON.stringify(profile))
  } else {
    localStorage.removeItem(USER_KEY)
  }
}

function accept(result: AuthResult): AuthResult {
  if (result.token) {
    setToken(result.token)
  }
  persist(result)
  return result
}

async function login(payload: LoginPayload): Promise<AuthResult> {
  submitting.value = true
  try {
    return accept(await authApi.login(payload))
  } finally {
    submitting.value = false
  }
}

async function register(payload: RegisterPayload): Promise<AuthResult> {
  submitting.value = true
  try {
    return accept(await authApi.register(payload))
  } finally {
    submitting.value = false
  }
}

/** 编辑资料后同步本地缓存 */
function applyProfile(profile: Partial<AuthResult>): void {
  if (user.value) {
    persist({ ...user.value, ...profile })
  }
}

async function logout(): Promise<void> {
  try {
    // 让后端把 token 拉黑；即便失败也必须清本地，不能把用户卡在登录态
    if (getToken()) {
      await authApi.logout()
    }
  } catch {
    /* 忽略：本地登出一定要成功 */
  } finally {
    clearToken()
    persist(null)
  }
}

/** 应用启动时用本地 token 换一次用户信息；token 失效则静默登出 */
async function restore(): Promise<void> {
  if (restored.value) {
    return
  }
  restored.value = true
  if (!getToken()) {
    persist(null)
    return
  }
  try {
    const me = await authApi.fetchMe()
    persist({ ...me, token: null })
  } catch {
    clearToken()
    persist(null)
  }
}

/**
 * token 过期 / 被登出时由请求层广播：这里同步清掉登录态，页面会立刻回到未登录
 */
window.addEventListener('yuyue:unauthorized', () => {
  restored.value = false
  persist(null)
})

export function useAuth() {
  return {
    user,
    isLoggedIn: computed(() => user.value !== null),
    isAdmin: computed(() => (user.value?.isAdmin ?? false) === true),
    submitting,
    restored,
    login,
    register,
    applyProfile,
    logout,
    restore,
  }
}

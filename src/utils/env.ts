/**
 * 后端环境配置：运行时切换，持久化到 localStorage。
 *
 * 与小程序端 common/config.js 同构：预定义「本地开发 / 线上环境」+ 自定义地址。
 * 区别在于 PC 端多一个「默认」项——直接用构建期的 VITE_API_BASE_URL，
 * 线上部署时它就是同源的 /api（nginx 反代），不选任何环境时行为与原来完全一致。
 */

export interface EnvItem {
  id: string
  label: string
  /** 后端地址，需以 / 结尾（含 /api） */
  url: string
}

const ENV_KEY = 'yuyue_env'
const CUSTOM_KEY = 'yuyue_custom_url'

/** 构建期配置的后端地址：开发为 http://localhost:8080/api，生产为同源 /api */
const BUILD_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api'

/** 预定义环境 */
export const ENVIRONMENTS: EnvItem[] = [
  { id: 'default', label: '默认（构建配置）', url: BUILD_BASE_URL },
  { id: 'local', label: '本地开发', url: 'http://localhost:8080/api' },
  { id: 'prod', label: '线上环境', url: 'http://20.89.53.251/api' },
]

/** 当前选中的环境 id（默认 default） */
export function getEnvId(): string {
  try {
    return localStorage.getItem(ENV_KEY) || 'default'
  } catch {
    return 'default'
  }
}

/** 设置当前环境 id */
export function setEnvId(id: string): void {
  try {
    localStorage.setItem(ENV_KEY, id)
  } catch {
    /* 隐私模式等场景忽略 */
  }
}

/** 自定义后端地址 */
export function getCustomUrl(): string {
  try {
    return localStorage.getItem(CUSTOM_KEY) || ''
  } catch {
    return ''
  }
}

/** 保存自定义后端地址 */
export function setCustomUrl(url: string): void {
  try {
    localStorage.setItem(CUSTOM_KEY, url)
  } catch {
    /* 隐私模式等场景忽略 */
  }
}

/**
 * 是否允许切换到跨环境的后端地址。
 *
 * 已部署的站点（域名访问）固定走同源 /api：
 * 1. 页面若是 https，直连 http:// 的后端会被浏览器按混合内容拦截；
 * 2. 直连会绕开 nginx 的反代与静态映射（/uploads 等）。
 * 与小程序端 H5 的处理一致：只有本地开发（localhost / 127.0.0.1）才允许切。
 */
export function isEnvSwitchEnabled(): boolean {
  const host = typeof location !== 'undefined' ? location.hostname : ''
  return !host || host === 'localhost' || host === '127.0.0.1'
}

/** 当前生效的环境信息（用于 UI 展示） */
export function getCurrentEnv(): EnvItem {
  const id = getEnvId()
  if (id === 'custom') {
    return { id: 'custom', label: '自定义', url: getCustomUrl() }
  }
  return ENVIRONMENTS.find((e) => e.id === id) ?? ENVIRONMENTS[0]
}

/**
 * 当前生效的后端地址。每次请求时读取，切换后无需刷新即可生效。
 * 已部署站点固定返回同源地址；自定义地址为空时回退到构建期地址。
 */
export function getBaseUrl(): string {
  if (!isEnvSwitchEnabled()) {
    return BUILD_BASE_URL
  }
  const env = getCurrentEnv()
  if (env.id === 'custom') {
    return env.url || BUILD_BASE_URL
  }
  return env.url || BUILD_BASE_URL
}

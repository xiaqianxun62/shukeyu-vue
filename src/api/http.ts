/**
 * 统一请求层：把后端 ApiResponse{code,message,data} 解包成业务数据。
 * 约定：HTTP 状态码始终是 200，code === 0 才算成功（见后端 GlobalExceptionHandler）。
 */

/** 后端统一响应体 */
export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

/** 业务异常：带后端错误码，便于上层区分「账号已注册」「密码错误」等场景 */
export class ApiError extends Error {
  readonly code: number

  constructor(code: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

/** 后端地址：所有接口统一挂在 /api 下。开发期由 vite proxy 转发到 8080，生产由 nginx 反代。 */
const BASE_URL: string = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api'

const TOKEN_KEY = 'yuyue_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

/** 后端相对路径补全为完整 URL（如 /uploads/xxx → http://localhost:8080/api/uploads/xxx） */
export function resolveUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (/^https?:\/\//.test(url)) return url
  if (url.startsWith('/')) return BASE_URL + url
  return BASE_URL + '/' + url
}

/**
 * 根据后端命名约定推导缩略图路径。
 * 后端 uploadAvatar / uploadCover 会把 xxx.ext 存一份 xxx_thumb.jpg，
 * 前端 SmartImage 组件用这个函数算出缩略图 URL，避免后端多返回字段。
 *
 *   /uploads/avatar_2_1789979220803_3.jpeg → /uploads/avatar_2_1789979220803_3_thumb.jpg
 *   /uploads/cover_xxx.png                → /uploads/cover_xxx_thumb.jpg
 *
 * 跨域/第三方 URL（http 开头的头像 CDN 等）原样返回，不做缩略图处理。
 */
export function thumbUrl(originalUrl: string | null | undefined): string {
  if (!originalUrl) return ''
  if (/^https?:\/\//.test(originalUrl)) return originalUrl
  // GIF 动图：后端 uploadAvatar 跳过压缩、不生成 _thumb.jpg（保留动画帧），直接用原图
  if (/\.gif$/i.test(originalUrl)) return originalUrl
  const lastDot = originalUrl.lastIndexOf('.')
  if (lastDot < 0) return originalUrl + '_thumb.jpg'
  return originalUrl.slice(0, lastDot) + '_thumb.jpg'
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const init: RequestInit = { method: options.method ?? 'GET', headers }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(options.body)
  }

  let res: Response
  try {
    res = await fetch(BASE_URL + path, init)
  } catch {
    throw new ApiError(-1, `无法连接服务器，请确认后端已启动`)
  }

  if (!res.ok) {
    throw new ApiError(res.status, `请求失败（HTTP ${res.status}）`)
  }

  const payload = (await res.json()) as ApiResponse<T>
  if (payload.code !== 0) {
    // token 失效：清掉本地凭证，并广播给登录状态，避免 UI 还显示已登录、后续请求继续 401
    if (payload.code === 401) {
      clearToken()
      window.dispatchEvent(new CustomEvent('yuyue:unauthorized'))
    }
    throw new ApiError(payload.code, payload.message || '请求失败')
  }
  return payload.data
}

/**
 * multipart 文件上传：带 token，返回业务数据（与 request 一样解包 ApiResponse）
 * @param path 接口路径
 * @param file 要上传的文件
 * @param field 文件字段名，默认 file
 */
export async function uploadFile<T>(path: string, file: File, field = 'file'): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const form = new FormData()
  form.append(field, file)

  let res: Response
  try {
    res = await fetch(BASE_URL + path, { method: 'POST', headers, body: form })
  } catch {
    throw new ApiError(-1, `无法连接服务器，请确认后端已启动`)
  }

  if (!res.ok) {
    throw new ApiError(res.status, `请求失败（HTTP ${res.status}）`)
  }

  const payload = (await res.json()) as ApiResponse<T>
  if (payload.code !== 0) {
    if (payload.code === 401) {
      clearToken()
      window.dispatchEvent(new CustomEvent('yuyue:unauthorized'))
    }
    throw new ApiError(payload.code, payload.message || '上传失败')
  }
  return payload.data
}

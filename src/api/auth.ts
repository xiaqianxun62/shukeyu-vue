import { request, resolveUrl, uploadFile } from './http'

/** 注册 / 登录 / 我的信息 的统一返回结构 */
export interface AuthResult {
  /** 仅注册、登录时返回；/auth/me 返回 null */
  token: string | null
  userId: number
  name: string
  /** 昵称：积分榜等非姓名场景展示，未设置时为 null */
  nickname?: string | null
  /** 1男 2女 0未知 */
  gender: number
  /** 登录账号：绑定后才有，未绑定时为 null */
  account: string | null
  /** 个人头像 URL */
  avatar: string | null
  rating: number
  gamesPlayed: number
  /** 是否管理员（后端 user.isAdmin == 1） */
  isAdmin?: boolean
  /* ---------- 分类 ELO：单打 / 双打 / 混双（个人页明细） ---------- */
  ratingSingles?: number | null
  singlesWin?: number | null
  singlesLoss?: number | null
  ratingDoubles?: number | null
  doublesWin?: number | null
  doublesLoss?: number | null
  ratingMixed?: number | null
  mixedWin?: number | null
  mixedLoss?: number | null
}

export interface LoginPayload {
  account: string
  password: string
  captchaUuid: string
  captchaCode: string
}

export interface RegisterPayload {
  account: string
  name: string
  /** 1男 2女 */
  gender: number
  password: string
  captchaUuid: string
  captchaCode: string
}

/** 编辑个人信息：字段留空表示不修改 */
export interface ProfilePayload {
  name?: string
  /** 昵称：不传表示不修改，传空串表示清除 */
  nickname?: string
  gender?: number
  account?: string
  /** 个人头像 URL（http(s):// 或 / 开头） */
  avatar?: string
}

export function login(payload: LoginPayload): Promise<AuthResult> {
  return request<AuthResult>('/auth/login', { method: 'POST', body: payload })
}

export function register(payload: RegisterPayload): Promise<AuthResult> {
  return request<AuthResult>('/auth/register', { method: 'POST', body: payload })
}

/** 获取图形验证码：{ uuid, image }（data:image/png;base64,...） */
export async function fetchCaptcha(): Promise<{ uuid: string; image: string }> {
  return request<{ uuid: string; image: string }>('/auth/captcha')
}

export function fetchMe(): Promise<AuthResult> {
  return request<AuthResult>('/auth/me')
}

/** 编辑个人信息（PUT /auth/profile） */
export function updateProfile(payload: ProfilePayload): Promise<AuthResult> {
  return request<AuthResult>('/auth/profile', { method: 'PUT', body: payload })
}

export function logout(): Promise<void> {
  return request<void>('/auth/logout', { method: 'POST' })
}

/** 上传个人头像，返回 { avatar: url } */
export async function uploadAvatar(file: File): Promise<string> {
  const res = await uploadFile<{ avatar: string }>('/auth/avatar', file, 'file')
  return res?.avatar ?? ''
}

/** 把后端返回的头像 URL 补全为完整 URL */
export function resolveAvatarUrl(url: string | null | undefined): string {
  return resolveUrl(url)
}

import { request } from './http'

export interface UserItem {
  id: number
  account?: string
  name: string
  gender?: number
  avatar?: string
  isAdmin: number
  rating: number
  gamesPlayed: number
  winCount: number
  lossCount: number
  createTime?: string
}

export function listUsers(): Promise<UserItem[]> {
  return request<UserItem[]>('/users')
}

export function setAdmin(id: number, admin: boolean): Promise<UserItem> {
  return request<UserItem>(`/users/${id}/admin?admin=${admin}`, { method: 'PUT' })
}

/** 管理员：把该账号密码重置为默认密码 123456 */
export function resetPassword(id: number): Promise<void> {
  return request<void>(`/users/${id}/reset-password`, { method: 'PUT' })
}

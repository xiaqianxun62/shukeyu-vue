import { request } from './http'

export interface Court {
  id: number
  name: string
  address?: string
  lat?: number | null
  lng?: number | null
  sort: number
  enabled: number
  createTime?: string
  updateTime?: string
}

export interface CourtForm {
  name: string
  address?: string
  lat?: number | null
  lng?: number | null
  sort?: number
  enabled?: number
}

/** 公开：列出启用的球场（下拉用） */
export function listCourts(): Promise<Court[]> {
  return request<Court[]>('/courts')
}

/** 管理端列表项：场地 + 被球局 / 赛事引用的次数 */
export interface CourtAdminItem extends Court {
  gameCount: number
  tournamentCount: number
}

/** 管理员：列出全部（含停用），附引用计数 */
export function listAllCourts(): Promise<CourtAdminItem[]> {
  return request<CourtAdminItem[]>('/courts/admin')
}

export function createCourt(payload: CourtForm): Promise<Court> {
  return request<Court>('/courts', { method: 'POST', body: payload })
}

export function updateCourt(id: number, payload: CourtForm): Promise<Court> {
  return request<Court>(`/courts/${id}`, { method: 'PUT', body: payload })
}

export function deleteCourt(id: number): Promise<void> {
  return request(`/courts/${id}`, { method: 'DELETE' })
}

export function toggleCourt(id: number): Promise<Court> {
  return request<Court>(`/courts/${id}/toggle`, { method: 'PUT' })
}

/**
 * 访问日志 API：管理员查看浏览用户 IP 与访问轨迹。
 * 后端接口：GET /visit-logs?ip=&limit=（仅管理员）
 */
import { request } from './http'

export interface VisitLog {
  id: number
  ip: string
  userId: number | null
  userName: string | null
  path: string
  method: string
  userAgent: string
  referer: string
  /** ISO-8601 字符串，如 2026-10-13T12:34:56 */
  createTime: string
}

export function listVisitLogs(ip?: string, limit = 100): Promise<VisitLog[]> {
  const params = new URLSearchParams()
  if (ip && ip.trim()) params.set('ip', ip.trim())
  params.set('limit', String(limit))
  return request<VisitLog[]>(`/visit-logs?${params.toString()}`)
}

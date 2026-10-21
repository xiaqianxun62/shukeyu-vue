import { request } from './http'

/** 积分榜条目（后端 RankingItem）：rating/win/loss 均为所请求类别（type）的口径 */
export interface RankingItem {
  userId: number
  name: string
  rating: number
  win: number
  loss: number
  /** 名次，从 1 开始 */
  rank: number
  /** 用户头像相对路径（/uploads/xxx），为空时前端显示首字母占位 */
  avatar?: string
}

/**
 * 积分榜 Top N：官网与小程序同源，读 Redis ZSet。
 * @param type 类别：1单打(默认) 2双打(同性别) 3混双
 */
export function fetchRanking(n = 10, type = 1): Promise<RankingItem[]> {
  return request<RankingItem[]>(`/ranking?n=${n}&type=${type}`)
}

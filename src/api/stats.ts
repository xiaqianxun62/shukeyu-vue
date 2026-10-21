import { request } from './http'

/** 首页数据概览（后端 StatsOverviewResponse，公开聚合数据） */
export interface StatsOverview {
  totalUsers: number
  totalGames: number
  totalMatches: number
  totalRegistrations: number
  /** 近 7 日每日对局数（MM-dd 升序，空天为 0） */
  last7Days: { date: string; count: number }[]
  /** ELO 分布四段（<1000 / 1000-1199 / 1200-1399 / ≥1400） */
  ratingBuckets: { label: string; count: number }[]
}

export function fetchOverview(): Promise<StatsOverview> {
  return request<StatsOverview>('/stats/overview')
}

/**
 * 大型比赛（锦标赛）接口封装
 *
 * 与小程序端共用同一套后端接口，PC 端只是换了操作台形态：
 * 小程序面向球友（报名 / 看对阵），PC 端面向组织者（建赛事 / 抽签 / 录分 / 移人）。
 */
import { request } from './http'

/* ==================== 通用结构 ==================== */

export interface TournamentMember {
  userId: number
  name: string
  avatar: string | null
  /** 0 未知 1 男 2 女 */
  gender: number
}

export interface TournamentTeam {
  entryId: number
  name: string
  members: TournamentMember[]
  groupNo: string | null
  advance: boolean | null
  finalRank: number | null
}

export interface TournamentMatch {
  id: number
  /** 1 小组赛 2 淘汰赛 3 季军赛 4 决赛 */
  stage: number
  roundNo: number
  roundSize: number
  roundName: string
  groupNo: string | null
  matchNo: number
  court: number | null
  teamA: TournamentTeam | null
  teamB: TournamentTeam | null
  /** 0 未出结果 1 A队胜 2 B队胜 */
  winner: number
  scoreA: number | null
  scoreB: number | null
  refereeName: string | null
  finished: boolean
  /** 本场由上一轮的哪几场产生（树形对阵图用） */
  childMatchIds?: number[]
  involved: boolean
}

/* ==================== 赛事广场 / 详情 ==================== */

export interface TournamentListItem {
  id: number
  title: string
  location: string | null
  playDate: string | null
  status: number
  statusText: string
  formats: number[]
  formatNames: string[]
  entryCount: number
  maxEntries: number
  maxPeople: number
  joined: boolean
  championName: string | null
}

export interface TournamentPodiumItem {
  rank: number
  rankName: string
  format: number
  formatName: string
  name: string
  members: TournamentMember[]
}

export interface TournamentFormatStat {
  format: number
  formatName: string
  teamSize: number
  entryCount: number
  maxEntries: number
  maxPeople: number
  full: boolean
  joined: boolean
  groupCount: number
}

export interface TournamentDetail {
  id: number
  title: string
  location: string | null
  locationName: string | null
  playDate: string | null
  remark: string | null
  status: number
  statusText: string
  groupSize: number
  advancePerGroup: number
  maxEntries: number
  drawn: boolean
  admin: boolean
  openForEntry: boolean
  formats: TournamentFormatStat[]
  podium: TournamentPodiumItem[]
}

/* ==================== 对阵图 ==================== */

export interface TournamentStanding {
  entryId: number
  name: string
  members: TournamentMember[]
  rank: number
  win: number
  loss: number
  pointDiff: number
  advance: boolean
}

export interface TournamentGroupBoard {
  groupId: number
  groupNo: string
  entryCount: number
  /** 0 未开始 1 进行中 2 已完赛 */
  status: number
  standings: TournamentStanding[]
  matches: TournamentMatch[]
}

export interface TournamentRoundBoard {
  roundNo: number
  roundSize: number
  roundName: string
  finished: boolean
  matches: TournamentMatch[]
}

export interface TournamentRankItem {
  rank: number
  entryId: number
  name: string
  members: TournamentMember[]
  groupNo: string | null
  eliminatedText: string | null
}

export interface TournamentFormatBoard {
  format: number
  formatName: string
  groups: TournamentGroupBoard[]
  knockouts: TournamentRoundBoard[]
  ranking: TournamentRankItem[]
  alive: TournamentTeam[]
}

export interface TournamentBracket {
  id: number
  title: string
  status: number
  statusText: string
  formats: TournamentFormatBoard[]
}

/* ==================== 赛程录入 ==================== */

export interface TournamentFormatMatches {
  format: number
  formatName: string
  pending: TournamentMatch[]
  done: TournamentMatch[]
}

export interface TournamentMatches {
  id: number
  title: string
  status: number
  statusText: string
  admin: boolean
  formats: TournamentFormatMatches[]
}

/* ==================== 管理端 ==================== */

export interface TournamentFormatCount {
  format: number
  formatName: string
  entryCount: number
  maxEntries: number
  full: boolean
  /** 按当前配置推算的淘汰赛规模；不合法时为 0 */
  knockoutSize: number
  /** 淘汰赛规模是否合法（2 的幂且 ≥4） */
  knockoutSizeValid: boolean
  /* ---- 赛程结构 ---- */
  /** 小组数 */
  groupCount: number
  /** 每组实际队数（均摊后的结果） */
  teamSizePerGroup: number
  /** 小组赛轮数 */
  groupRounds: number
  /** 小组赛场次合计 */
  groupMatches: number
  /** 小组赛是否被指定了轮数（未指定时按单循环自动推算） */
  groupRoundsConfigured: boolean
  /** 淘汰赛轮数（不含季军赛 / 决赛） */
  knockoutRounds: number
  /** 淘汰赛场次合计（不含季军赛 / 决赛） */
  knockoutMatches: number
  /** 收官战场次（季军赛 + 决赛） */
  finalMatches: number
  /** 首轮轮空队数（签位多于晋级队时出现） */
  byeCount: number
  /** 该组别总场次 */
  totalMatches: number
}

export interface TournamentManageItem {
  id: number
  title: string
  location: string | null
  playDate: string | null
  remark: string | null
  status: number
  statusText: string
  formats: number[]
  formatNames: string[]
  groupSize: number
  advancePerGroup: number
  maxEntries: number
  /** 小组赛轮数配置：0 = 自动（打满单循环） */
  groupRounds: number
  /** 淘汰赛轮数配置：0 = 自动（按晋级人数推导） */
  knockoutRounds: number
  entryCount: number
  formatCounts: TournamentFormatCount[]
  creatorId: number
  creatorName: string
  drawn: boolean
  championName: string | null
  createTime: string | null
}

export interface TournamentEntryItem {
  entryId: number
  tournamentId: number
  format: number
  formatName: string
  name: string
  members: TournamentMember[]
  contact: string | null
  seedNo: number | null
  groupNo: string | null
  groupRank: number | null
  groupWin: number
  groupLoss: number
  groupPointDiff: number
  advance: boolean
  status: number
  statusText: string
  eliminatedStage: number | null
  finalRank: number | null
  createTime: string | null
}

/** 创建 / 修改赛事的表单 */
export interface TournamentForm {
  title: string
  location?: string
  courtId?: number
  playDate?: string
  remark?: string
  formats?: number[]
  groupSize?: number
  advancePerGroup?: number
  maxEntries?: number
  /** 小组赛轮数：0 = 自动（打满单循环）；> 0 = 指定轮数（可多循环） */
  groupRounds?: number
  /** 淘汰赛轮数：0 = 自动（按晋级人数推导）；> 0 = 指定轮数 */
  knockoutRounds?: number
}

/* ==================== 接口 ==================== */

/** 赛事广场（公开） */
export function listTournaments(): Promise<TournamentListItem[]> {
  return request<TournamentListItem[]>('/tournaments')
}

/** 赛事详情 */
export function getTournament(id: number): Promise<TournamentDetail> {
  return request<TournamentDetail>(`/tournaments/${id}`)
}

/** 对阵图 */
export function getBracket(id: number): Promise<TournamentBracket> {
  return request<TournamentBracket>(`/tournaments/${id}/bracket`)
}

/** 赛程录入数据 */
export function getMatches(id: number): Promise<TournamentMatches> {
  return request<TournamentMatches>(`/tournaments/${id}/matches`)
}

/** 管理端赛事列表（含已取消） */
export function listManageTournaments(params?: {
  status?: number
  keyword?: string
}): Promise<TournamentManageItem[]> {
  const q: string[] = []
  if (params?.status != null) q.push(`status=${params.status}`)
  if (params?.keyword) q.push(`keyword=${encodeURIComponent(params.keyword)}`)
  const suffix = q.length ? `?${q.join('&')}` : ''
  return request<TournamentManageItem[]>(`/tournaments/manage${suffix}`)
}

/** 管理端参赛名单 */
export function getManageEntries(id: number): Promise<TournamentEntryItem[]> {
  return request<TournamentEntryItem[]>(`/tournaments/${id}/entries`)
}

/** 创建赛事 */
export function createTournament(form: TournamentForm): Promise<{ tournamentId: number }> {
  return request<{ tournamentId: number }>('/tournaments', { method: 'POST', body: form })
}

/** 修改赛事 */
export function updateTournament(
  id: number,
  form: TournamentForm,
): Promise<{ id: number; title: string; configLocked: boolean }> {
  return request<{ id: number; title: string; configLocked: boolean }>(`/tournaments/${id}`, {
    method: 'PUT',
    body: form,
  })
}

/** 抽签分组 */
export function drawTournament(
  id: number,
): Promise<{
  tournamentId: number
  formats: { format: number; formatName: string; entryCount: number; groupCount: number; knockoutSize: number }[]
}> {
  return request(`/tournaments/${id}/draw`, { method: 'POST' })
}

/** 取消赛事 */
export function cancelTournament(id: number): Promise<void> {
  return request<void>(`/tournaments/${id}/cancel`, { method: 'PUT' })
}

/** 移出参赛者 */
export function removeEntry(tournamentId: number, entryId: number): Promise<void> {
  return request<void>(`/tournaments/${tournamentId}/entries/${entryId}`, { method: 'DELETE' })
}

/** 录入赛果：winner=1 A队胜 2 B队胜 0 撤销本场 */
export function scoreMatch(
  matchId: number,
  payload: { winner: number; scoreA?: number; scoreB?: number },
): Promise<{ matchId: number; winner: number; scoreA: number; scoreB: number; advanced?: string; revoked?: boolean }> {
  return request(`/tournaments/matches/${matchId}/score`, { method: 'PUT', body: payload })
}

/** 模拟赛程请求 */
export interface TournamentSimulateForm {
  /** 基于哪个赛事预演；不传则纯参数预演 */
  tournamentId?: number
  /** 开设组别 */
  formats?: number[]
  /** 小组赛每组队数 */
  groupSize?: number
  /** 每组晋级名额 */
  advancePerGroup?: number
  /** 模拟的队伍数；不传则取真实报名数 */
  entryCount?: number
  /** 小组赛轮数：0 = 自动（打满单循环）；> 0 = 指定轮数（可多循环） */
  groupRounds?: number
  /** 淘汰赛轮数：0 = 自动（按晋级人数推导）；> 0 = 指定轮数 */
  knockoutRounds?: number
}

/** 模拟赛程：不落库，返回结构与对阵图一致 */
export function simulateTournament(form: TournamentSimulateForm): Promise<TournamentBracket> {
  return request<TournamentBracket>('/tournaments/simulate', { method: 'POST', body: form })
}

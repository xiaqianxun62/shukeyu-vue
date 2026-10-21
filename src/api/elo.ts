import { request } from './http'

/** 试算中一名球员在一场对局里的结算结果 */
export interface SimSide {
  id: number
  label: string
  ratingBefore: number
  delta: number
  ratingAfter: number
  kFactor: number
  expected: number
}

export interface SimMatch {
  format: number
  /** 单打 / 男双 / 女双 / 混双 */
  formatName: string
  /** 1=A队 2=B队 */
  winner: number
  teamA: SimSide[]
  teamB: SimSide[]
  expectedA: number
  expectedB: number
}

export interface SimPlayer {
  id: number
  /** 1男 2女 */
  gender: number
  label: string
  /** 初始积分 */
  rating: number
  /** 打完全部场次后的积分 */
  finalRating?: number | null
  gamesPlayed: number
  kFactor: number
}

export interface SimulateResult {
  schemeId: number
  schemeName: string
  players: SimPlayer[]
  matches: SimMatch[]
}

export interface SimulatePayload {
  maleCount: number
  femaleCount: number
  /** 按「先男后女」顺序的初始积分 */
  ratings: number[]
  gamesPlayed: number
  /** 指定编排方案 1-8；不传则按性别构成自动过滤 */
  schemeId?: number
  /** false=单轮（每人一场） true=循环赛（队伍两两互打，积分逐场累计） */
  roundRobin?: boolean
  /** 每场胜方：1=A队 2=B队 */
  winners?: number[]
  /** 试算类别：1单打 2双打 3混双（未指定 schemeId 时后端按类别预设赛制） */
  category?: number
}

/** ELO 试算：复用后端真实编排引擎与 ELO 计算器，不落库 */
export function simulateElo(payload: SimulatePayload): Promise<SimulateResult> {
  return request<SimulateResult>('/elo/simulate', { method: 'POST', body: payload })
}

/** K 因子档位：加减分由后端用真实 expected() 算出，前端不写死 */
export interface EloKRule {
  games: string
  k: number
  strongWin: number
  strongLoss: number
  weakWin: number
  weakLoss: number
}

export interface EloRuleScenario {
  scene: string
  matchup: string
  /** 己方期望胜率 0-1 */
  expect: number
  winDelta: number
  lossDelta: number
  /** true = 同队每人都是这个变化（双打） */
  perPlayer: boolean
  note: string
}

/** ELO 规则说明：全部来自后端 EloCalculator，改了 K 因子前端会跟着变 */
export interface EloRules {
  defaultRating: number
  principle: string
  formula: string
  kRules: EloKRule[]
  scenarios: EloRuleScenario[]
  notes: string[]
  doublesNotes: string[]
}

export function fetchEloRules(): Promise<EloRules> {
  return request<EloRules>('/elo/rules')
}

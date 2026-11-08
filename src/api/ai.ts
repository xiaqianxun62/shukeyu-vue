import { ApiError, BASE_URL, clearToken, getToken, request } from './http'
import type { ApiResponse } from './http'

/**
 * AI 智能问答接口。
 *
 * 后端 `POST /ai/chat` 是 SSE 流，帧顺序固定：meta → delta* → done（失败为 error）。
 * 这里不能用 EventSource：它只能发 GET 且带不了 Authorization 头，
 * 所以用 fetch + ReadableStream 自己解析帧。
 */

export interface AiCitation {
  /** 引用序号，从 1 开始，对应回答正文里的 [1] */
  index: number
  title: string
  doc: string
}

export interface AiStreamMeta {
  conversationId: number
  title: string
  citations: AiCitation[]
  /** 本次回答调用的数据工具标识，如 MY_RATING */
  tools: string[]
}

export interface AiStreamDone {
  conversationId: number | null
  messageId: number | null
  totalTokens: number
  latencyMs: number
}

export interface AiStreamError {
  code: number
  message: string
}

export interface AiConversationSummary {
  id: number
  title: string
  messageCount: number
  lastMessageAt: string | null
  createTime: string
}

export interface AiMessageItem {
  id: number
  role: 'USER' | 'ASSISTANT'
  content: string
  citations: string[]
  tools: string[]
  totalTokens: number | null
  latencyMs: number | null
  createTime: string
}

export interface AiConversationDetail {
  conversation: AiConversationSummary
  messages: AiMessageItem[]
}

export interface AiHealth {
  enabled: boolean
  provider: string
  chatModel: string
  chatModelPresent: boolean
  apiKeyConfigured: boolean
  /** UP 可用 / DISABLED 未启用 / UNCONFIGURED 缺配置 / DOWN 探活失败 */
  status: string
  latencyMs: number | null
  message: string
  checkedAt: string
}

/** 数据工具标识 → 中文标签（与后端 AiDataTool.label() 对应） */
export const TOOL_LABELS: Record<string, string> = {
  MY_RATING: '我的积分与战绩',
  MY_GAMES: '我的球局',
  UPCOMING_GAMES: '近期开放球局',
}

export interface StreamHandlers {
  onMeta?: (meta: AiStreamMeta) => void
  onDelta?: (text: string) => void
  onDone?: (done: AiStreamDone) => void
  /** 业务失败：已开始推流后由 error 帧下发，不再是 HTTP 状态码 */
  onError?: (error: AiStreamError) => void
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

/** 一帧 SSE：`event: xxx` + 若干 `data: ...` 行 */
function parseFrame(raw: string): { event: string; data: string } | null {
  let event = 'message'
  const data: string[] = []
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      // 规范允许 `data:` 后紧跟一个空格，去掉它
      data.push(line.slice(5).replace(/^ /, ''))
    }
  }
  return data.length ? { event, data: data.join('\n') } : null
}

/**
 * 发起一次提问并消费 SSE 流。
 *
 * @param payload conversationId 为空表示新建会话
 * @param handlers 各类帧的回调（按到达顺序调用）
 * @param signal 取消信号；前端「停止」或组件卸载时中断上游生成
 * @throws ApiError 建流前的失败（未登录、参数错误、网络不通）
 */
export async function streamChat(
  payload: { conversationId?: number | null; message: string },
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response
  try {
    res = await fetch(BASE_URL + '/ai/chat', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
      signal,
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    throw new ApiError(-1, '无法连接服务器，请确认后端已启动')
  }

  if (!res.ok) {
    throw new ApiError(res.status, `请求失败（HTTP ${res.status}）`)
  }

  // 流还没开始就失败（鉴权、参数校验、会话不属于本人）会走统一异常处理返回普通 JSON
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('text/event-stream')) {
    const body = (await res.json().catch(() => null)) as ApiResponse<unknown> | null
    const code = body?.code ?? -1
    if (code === 401) {
      clearToken()
      window.dispatchEvent(new CustomEvent('yuyue:unauthorized'))
    }
    throw new ApiError(code, body?.message || '问答服务暂时不可用')
  }

  if (!res.body) {
    throw new ApiError(-1, '浏览器不支持流式响应')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  const dispatch = (event: string, data: string): void => {
    let parsed: unknown
    try {
      parsed = JSON.parse(data)
    } catch {
      return
    }
    if (event === 'meta') handlers.onMeta?.(parsed as AiStreamMeta)
    else if (event === 'delta') handlers.onDelta?.((parsed as { text?: string }).text ?? '')
    else if (event === 'done') handlers.onDone?.(parsed as AiStreamDone)
    else if (event === 'error') handlers.onError?.(parsed as AiStreamError)
  }

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      // 帧以空行分隔；最后一段可能不完整，留在 buffer 里等下一块
      const frames = buffer.split(/\r?\n\r?\n/)
      buffer = frames.pop() ?? ''
      for (const raw of frames) {
        const frame = parseFrame(raw)
        if (frame) dispatch(frame.event, frame.data)
      }
    }
    // 个别代理会吞掉结尾空行，收尾时再尝试解析残留
    if (buffer.trim()) {
      const frame = parseFrame(buffer)
      if (frame) dispatch(frame.event, frame.data)
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    throw new ApiError(-1, e instanceof Error ? e.message : '流式响应中断')
  } finally {
    // 主动取消 / 正常读完都要释放读锁，避免连接挂住
    try {
      reader.releaseLock()
    } catch {
      /* 已关闭则忽略 */
    }
  }
}

/** 我的会话列表（最多 30 条，按最后消息时间倒序） */
export function listConversations(): Promise<AiConversationSummary[]> {
  return request<AiConversationSummary[]>('/ai/conversations')
}

/** 会话详情：元信息 + 最近 100 条消息（按时间正序） */
export function getConversation(id: number): Promise<AiConversationDetail> {
  return request<AiConversationDetail>(`/ai/conversations/${id}`)
}

/** 删除会话（软删除） */
export function deleteConversation(id: number): Promise<void> {
  return request<void>(`/ai/conversations/${id}`, { method: 'DELETE' })
}

/** AI 健康检查（公开）：用于提示「AI 未启用 / 缺 API Key」 */
export function aiHealth(): Promise<AiHealth> {
  return request<AiHealth>('/ai/health')
}

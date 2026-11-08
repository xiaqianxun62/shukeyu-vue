<!-- 智能问答页面：规则答疑 + 个人数据查询，SSE 流式输出 -->
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useAuth } from '../composables/useAuth'
import * as aiApi from '../api/ai'
import { ApiError } from '../api/http'

const emit = defineEmits<{ back: [] }>()
const { isLoggedIn } = useAuth()

interface ChatMessage {
  role: 'USER' | 'ASSISTANT'
  content: string
  /** 引用条目标题，已回答为「[1] 标题」 */
  citationTexts: string[]
  /** 数据工具标识，如 MY_RATING */
  tools: string[]
  /** 业务错误 / 网络错误文案；有值时气泡按失败展示 */
  error?: string
  /** 是否仍在流式接收 */
  streaming?: boolean
  /** 用户主动停止，内容可能不完整 */
  stopped?: boolean
}

const conversations = ref<aiApi.AiConversationSummary[]>([])
const activeId = ref<number | null>(null)
const messages = ref<ChatMessage[]>([])
const draft = ref('')
const streaming = ref(false)
const loadingList = ref(false)
const loadingDetail = ref(false)
const pageError = ref('')
/** AI 未启用 / 缺配置时的提示，不让用户对着必然失败的输入框发问 */
const statusHint = ref('')

const controller = ref<AbortController | null>(null)
const scrollRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)

/** 示例问题：都对应知识库里真实存在的规则，不会答非所问 */
const SAMPLES = [
  '双打积分怎么算？',
  '我的积分和战绩如何？',
  '球局有哪几种发布模式？',
  '轮排为什么总让我换搭档？',
]

const canAccess = computed(() => isLoggedIn.value)
const activeTitle = computed(
  () => conversations.value.find((c) => c.id === activeId.value)?.title ?? '新对话',
)

function scrollToBottom(): void {
  void nextTick(() => {
    const el = scrollRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function formatTime(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  if (sameDay) return `${hh}:${mm}`
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function toolLabel(name: string): string {
  return aiApi.TOOL_LABELS[name] ?? name
}

async function loadConversations(): Promise<void> {
  loadingList.value = true
  try {
    conversations.value = await aiApi.listConversations()
  } catch (e) {
    pageError.value = e instanceof Error ? e.message : '会话列表加载失败'
  } finally {
    loadingList.value = false
  }
}

/** 健康检查：AI 总开关关着 / 没配 Key 时给一句明确提示，而不是让每次提问都报错 */
async function loadHealth(): Promise<void> {
  try {
    const health = await aiApi.aiHealth()
    statusHint.value = health.status === 'UP' ? '' : health.message || '智能问答暂不可用'
  } catch {
    // 健康检查失败不影响页面本身，提问时会走 error 帧提示
    statusHint.value = ''
  }
}

/** 新会话在 meta 帧才拿到 ID，先塞进列表顶部，避免左侧留空 */
function upsertConversation(id: number, title: string): void {
  const index = conversations.value.findIndex((c) => c.id === id)
  const now = new Date().toISOString()
  if (index >= 0) {
    const item = conversations.value[index]
    conversations.value[index] = { ...item, title, lastMessageAt: now }
    return
  }
  conversations.value.unshift({
    id,
    title,
    messageCount: 2,
    lastMessageAt: now,
    createTime: now,
  })
}

function newConversation(): void {
  stopStreaming()
  activeId.value = null
  messages.value = []
  pageError.value = ''
  void nextTick(() => inputRef.value?.focus())
}

async function openConversation(item: aiApi.AiConversationSummary): Promise<void> {
  if (item.id === activeId.value || loadingDetail.value) return
  stopStreaming()
  loadingDetail.value = true
  pageError.value = ''
  try {
    const detail = await aiApi.getConversation(item.id)
    activeId.value = item.id
    messages.value = detail.messages.map((m) => ({
      role: m.role,
      content: m.content,
      citationTexts: m.citations ?? [],
      tools: m.tools ?? [],
    }))
    scrollToBottom()
  } catch (e) {
    pageError.value = e instanceof Error ? e.message : '会话加载失败'
  } finally {
    loadingDetail.value = false
  }
}

async function removeConversation(item: aiApi.AiConversationSummary): Promise<void> {
  if (!confirm(`确定删除会话「${item.title}」吗？`)) return
  try {
    await aiApi.deleteConversation(item.id)
    conversations.value = conversations.value.filter((c) => c.id !== item.id)
    if (activeId.value === item.id) newConversation()
  } catch (e) {
    alert(e instanceof Error ? e.message : '删除失败')
  }
}

function stopStreaming(): void {
  controller.value?.abort()
  controller.value = null
  streaming.value = false
}

/** 手动停止：保留已收到的内容并标注「已停止」 */
function handleStop(): void {
  const last = messages.value[messages.value.length - 1]
  if (last && last.role === 'ASSISTANT' && last.streaming) {
    last.streaming = false
    last.stopped = true
  }
  stopStreaming()
}

async function send(text?: string): Promise<void> {
  const message = (text ?? draft.value).trim()
  if (!message || streaming.value) return

  draft.value = ''
  pageError.value = ''
  messages.value.push({ role: 'USER', content: message, citationTexts: [], tools: [] })
  const reply = reactive<ChatMessage>({
    role: 'ASSISTANT',
    content: '',
    citationTexts: [],
    tools: [],
    streaming: true,
  })
  messages.value.push(reply)
  streaming.value = true
  scrollToBottom()

  const ac = new AbortController()
  controller.value = ac
  try {
    await aiApi.streamChat(
      { conversationId: activeId.value, message },
      {
        onMeta(meta) {
          activeId.value = meta.conversationId
          reply.citationTexts = meta.citations.map((c) => `[${c.index}] ${c.title}`)
          reply.tools = meta.tools
          upsertConversation(meta.conversationId, meta.title)
        },
        onDelta(delta) {
          reply.content += delta
          scrollToBottom()
        },
        onDone() {
          reply.streaming = false
          void loadConversations()
        },
        onError(error) {
          reply.streaming = false
          reply.error = error.message || '回答失败'
        },
      },
      ac.signal,
    )
  } catch (e) {
    reply.error = e instanceof Error ? e.message : '发送失败'
    // 401 已由请求层广播登出，这里只把错误显示出来
    if (e instanceof ApiError && e.code === 401) pageError.value = '登录已失效，请重新登录'
  } finally {
    reply.streaming = false
    streaming.value = false
    controller.value = null
    scrollToBottom()
  }
}

function askSample(question: string): void {
  void send(question)
}

/** Enter 发送，Shift+Enter 换行 */
function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    void send()
  }
}

function goLogin(): void {
  window.location.hash = '#/login'
}

onMounted(async () => {
  if (!canAccess.value) return
  await Promise.all([loadConversations(), loadHealth()])
})

// 离开页面要断开上游：否则模型继续生成、token 继续烧
onBeforeUnmount(stopStreaming)
</script>

<template>
  <div class="ai-page">
    <header class="top">
      <button class="back" type="button" @click="emit('back')">← 返回官网</button>
      <h1>智能问答</h1>
      <button v-if="canAccess" class="btn primary" type="button" @click="newConversation">
        + 新对话
      </button>
    </header>

    <section v-if="!canAccess" class="denied">
      <h2>需要登录后使用</h2>
      <p>智能问答会读取你的积分、战绩与球局数据，因此仅对已登录用户开放。</p>
      <button class="btn primary" type="button" @click="goLogin">去登录</button>
    </section>

    <template v-else>
      <p v-if="statusHint" class="status-hint">{{ statusHint }}</p>

      <div class="layout">
        <aside class="side">
          <div class="side-head">
            <span>我的会话</span>
            <button class="side-new" type="button" title="新建对话" @click="newConversation">＋</button>
          </div>
          <div v-if="loadingList" class="side-empty">加载中…</div>
          <div v-else-if="!conversations.length" class="side-empty">还没有对话</div>
          <ul v-else class="conv-list">
            <li v-for="item in conversations" :key="item.id">
              <button
                type="button"
                class="conv"
                :class="{ active: item.id === activeId }"
                @click="openConversation(item)"
              >
                <span class="conv-title">{{ item.title }}</span>
                <span class="conv-time">{{ formatTime(item.lastMessageAt) }}</span>
              </button>
              <button
                class="conv-del"
                type="button"
                title="删除会话"
                @click="removeConversation(item)"
              >
                ×
              </button>
            </li>
          </ul>
        </aside>

        <section class="chat">
          <div class="chat-head">
            <strong>{{ activeTitle }}</strong>
            <span class="chat-model">规则库 + 实时数据</span>
          </div>

          <div ref="scrollRef" class="messages">
            <div v-if="!messages.length" class="welcome">
              <h2>问点什么？</h2>
              <p>我了解本站的积分规则、球局与报名、轮排编排、赛事赛制，也能查你自己的积分和球局。</p>
              <div class="samples">
                <button
                  v-for="s in SAMPLES"
                  :key="s"
                  type="button"
                  class="sample"
                  @click="askSample(s)"
                >
                  {{ s }}
                </button>
              </div>
            </div>

            <div v-else-if="loadingDetail" class="loading">加载会话…</div>

            <div v-for="(m, i) in messages" :key="i" class="msg" :class="m.role.toLowerCase()">
              <div class="bubble" :class="{ failed: !!m.error }">
                <p v-if="m.content" class="text">{{ m.content }}</p>
                <p v-else-if="m.streaming" class="text typing">正在思考…</p>
                <p v-if="m.error" class="text error-text">{{ m.error }}</p>
                <span v-if="m.stopped" class="stopped">已停止生成</span>
              </div>
              <div v-if="m.role === 'ASSISTANT' && (m.tools.length || m.citationTexts.length)" class="meta">
                <span v-for="t in m.tools" :key="t" class="tool-tag">已查：{{ toolLabel(t) }}</span>
                <span v-for="c in m.citationTexts" :key="c" class="cite">{{ c }}</span>
              </div>
            </div>
          </div>

          <div v-if="pageError" class="page-error">{{ pageError }}</div>

          <div class="composer">
            <textarea
              ref="inputRef"
              v-model="draft"
              rows="2"
              maxlength="1000"
              placeholder="问我积分怎么算、最近有哪些球局…（Enter 发送，Shift+Enter 换行）"
              @keydown="handleKeydown"
            ></textarea>
            <button v-if="streaming" class="btn stop" type="button" @click="handleStop">
              停止
            </button>
            <button
              v-else
              class="btn primary send"
              type="button"
              :disabled="!draft.trim()"
              @click="send()"
            >
              发送
            </button>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ai-page {
  min-height: 100vh;
  max-width: 1080px;
  margin: 0 auto;
  padding: 24px 28px 48px;
  background: var(--bg);
}

.top {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;
}
.top h1 {
  margin: 0;
  font-size: 22px;
  color: var(--text);
}
.back {
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 6px 14px;
  background: var(--card);
  color: var(--text-muted);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}
.back:hover {
  border-color: var(--primary-light);
  color: var(--primary);
}

.denied {
  padding: 64px 24px;
  border-radius: 16px;
  background: var(--card);
  box-shadow: var(--shadow-sm);
  text-align: center;
}
.denied h2 {
  margin: 0 0 10px;
  font-size: 18px;
  color: var(--text);
}
.denied p {
  margin: 0 0 20px;
  color: var(--text-muted);
  font-size: 14px;
}

.status-hint {
  margin: 0 0 12px;
  padding: 10px 14px;
  border-left: 3px solid var(--accent);
  border-radius: 8px;
  background: #fdf6e3;
  color: #8a6d1f;
  font-size: 13px;
}

.layout {
  display: grid;
  grid-template-columns: 232px minmax(0, 1fr);
  gap: 16px;
  height: calc(100vh - 180px);
  min-height: 520px;
}

/* 会话列表 */
.side {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--border-light);
  border-radius: 14px;
  background: var(--card);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.side-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-light);
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
}
.side-new {
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 6px;
  background: var(--success-bg);
  color: var(--primary);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}
.side-empty {
  padding: 28px 14px;
  color: var(--text-muted);
  font-size: 13px;
  text-align: center;
}
.conv-list {
  flex: 1;
  margin: 0;
  padding: 6px;
  list-style: none;
  overflow-y: auto;
}
.conv-list li {
  position: relative;
}
.conv {
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 100%;
  padding: 9px 30px 9px 10px;
  border: none;
  border-radius: 9px;
  background: transparent;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}
.conv:hover {
  background: var(--border-light);
}
.conv.active {
  background: var(--success-bg);
}
.conv-title {
  overflow: hidden;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.conv.active .conv-title {
  color: var(--primary);
}
.conv-time {
  color: var(--text-muted);
  font-size: 11px;
}
.conv-del {
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--leave);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: all 0.15s;
}
.conv-list li:hover .conv-del {
  opacity: 1;
}
.conv-del:hover {
  background: rgba(179, 58, 46, 0.1);
  color: #b33a2e;
}

/* 对话区 */
.chat {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--border-light);
  border-radius: 14px;
  background: var(--card);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.chat-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--border-light);
}
.chat-head strong {
  overflow: hidden;
  color: var(--text);
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chat-model {
  flex-shrink: 0;
  color: var(--text-muted);
  font-size: 11px;
}

.messages {
  flex: 1;
  padding: 18px;
  overflow-y: auto;
}
.welcome {
  max-width: 520px;
  margin: 32px auto 0;
  text-align: center;
}
.welcome h2 {
  margin: 0 0 8px;
  color: var(--text);
  font-size: 19px;
}
.welcome p {
  margin: 0 0 20px;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.7;
}
.samples {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}
.sample {
  padding: 7px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg);
  color: var(--primary);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.sample:hover {
  border-color: var(--primary-light);
  background: var(--success-bg);
}

.msg {
  display: flex;
  flex-direction: column;
  margin-bottom: 16px;
}
.msg.user {
  align-items: flex-end;
}
.msg.assistant {
  align-items: flex-start;
}
.bubble {
  max-width: 86%;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.7;
}
.msg.user .bubble {
  background: var(--primary);
  color: #fff;
  border-bottom-right-radius: 4px;
}
.msg.assistant .bubble {
  background: var(--bg);
  border: 1px solid var(--border-light);
  color: var(--text);
  border-bottom-left-radius: 4px;
}
.bubble.failed {
  border-color: rgba(179, 58, 46, 0.35);
  background: #fdf1ef;
}
.text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
.text.typing {
  color: var(--text-muted);
}
.error-text {
  color: #b33a2e;
}
.stopped {
  display: inline-block;
  margin-top: 6px;
  color: var(--text-muted);
  font-size: 11px;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-width: 86%;
  margin-top: 6px;
}
.tool-tag {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--success-bg);
  color: var(--primary);
  font-size: 11px;
}
.cite {
  padding: 2px 8px;
  border: 1px dashed var(--border);
  border-radius: 999px;
  color: var(--text-muted);
  font-size: 11px;
}

.loading {
  padding: 40px;
  color: var(--text-muted);
  text-align: center;
}
.page-error {
  padding: 0 18px 8px;
  color: #b33a2e;
  font-size: 12px;
}

.composer {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 12px 16px 14px;
  border-top: 1px solid var(--border-light);
}
.composer textarea {
  flex: 1;
  min-height: 46px;
  max-height: 140px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg);
  color: var(--text);
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;
}
.composer textarea:focus {
  outline: none;
  border-color: var(--primary-light);
  background: var(--card);
}
.btn {
  flex-shrink: 0;
  height: 42px;
  padding: 0 18px;
  border-radius: 10px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.btn.primary {
  border: none;
  background: var(--accent);
  color: var(--text);
}
.btn.primary:hover:not(:disabled) {
  background: var(--accent-dark);
}
.btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.btn.stop {
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text-muted);
}
.btn.stop:hover {
  border-color: #b33a2e;
  color: #b33a2e;
}

/* ===== 手机适配（≤760px） ===== */
@media (max-width: 760px) {
  .ai-page {
    padding: 16px 14px 32px;
  }
  .top {
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 14px;
  }
  .top h1 {
    order: 2;
    flex-basis: 100%;
    font-size: 18px;
  }
  .top .btn {
    order: 3;
    margin-left: auto;
  }
  .layout {
    grid-template-columns: 1fr;
    height: auto;
    min-height: 0;
  }
  .side {
    max-height: 168px;
  }
  .conv-list {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    overflow-y: hidden;
  }
  .conv-list li {
    flex-shrink: 0;
    max-width: 180px;
  }
  .conv-del {
    opacity: 1;
  }
  .chat {
    height: calc(100vh - 240px);
    min-height: 440px;
  }
  .bubble,
  .meta {
    max-width: 94%;
  }
}
</style>

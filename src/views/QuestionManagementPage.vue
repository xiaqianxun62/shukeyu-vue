<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuth } from '../composables/useAuth'
import * as questionsApi from '../api/verification'
import type { QuestionCreateRequest, VerificationQuestion } from '../api/verification'

const emit = defineEmits<{ back: [] }>()

const { isLoggedIn, has } = useAuth()
const loading = ref(true)
const list = ref<VerificationQuestion[]>([])
const error = ref('')

/** 模态框状态：null = 新增；有值 = 编辑中的 ID */
const editingId = ref<number | null>(null)
const showModal = ref(false)
const form = ref<QuestionCreateRequest>({ question: '', answer: '', enabled: 1 })
const submitting = ref(false)
const formError = ref('')

const canAccess = computed(() => isLoggedIn.value && has('verify:manage'))
const editingItem = computed(() => list.value.find((q) => q.id === editingId.value))

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    list.value = await questionsApi.listQuestions()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  editingId.value = null
  form.value = { question: '', answer: '', enabled: 1 }
  formError.value = ''
  showModal.value = true
}

function openEdit(q: VerificationQuestion): void {
  editingId.value = q.id
  form.value = { question: q.question, answer: q.answer, enabled: q.enabled }
  formError.value = ''
  showModal.value = true
}

function closeModal(): void {
  showModal.value = false
}

async function handleSubmit(): Promise<void> {
  if (!form.value.question.trim() || !form.value.answer.trim()) {
    formError.value = '问题和答案都不能为空'
    return
  }
  submitting.value = true
  formError.value = ''
  try {
    if (editingId.value) {
      await questionsApi.updateQuestion(editingId.value, form.value)
    } else {
      await questionsApi.createQuestion(form.value)
    }
    closeModal()
    await load()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : '保存失败'
  } finally {
    submitting.value = false
  }
}

async function handleDelete(q: VerificationQuestion): Promise<void> {
  if (!confirm(`确定要删除问题「${q.question.slice(0, 30)}${q.question.length > 30 ? '…' : ''}」吗？此操作不可恢复。`)) return
  try {
    await questionsApi.deleteQuestion(q.id)
    list.value = list.value.filter((item) => item.id !== q.id)
  } catch (e) {
    alert(e instanceof Error ? e.message : '删除失败')
  }
}

onMounted(load)
</script>

<template>
  <div class="admin-page">
    <header class="top">
      <button class="back" @click="emit('back')">← 返回官网</button>
      <h1>身份校验 · 问题管理</h1>
      <span v-if="canAccess" class="hint">共 {{ list.length }} 道题</span>
      <button v-if="canAccess" class="btn primary" @click="openCreate">+ 新增问题</button>
    </header>

    <section v-if="!canAccess" class="denied">
      <h2>需要管理员权限</h2>
      <p>请用管理员账号登录后再访问此页面。</p>
      <button class="btn primary" @click="emit('back')">返回</button>
    </section>

    <section v-else class="content">
      <div v-if="loading" class="loading">加载中…</div>
      <div v-else-if="error" class="error">{{ error }}</div>

      <table v-else class="questions-table">
        <thead>
          <tr>
            <th class="col-id">#</th>
            <th>问题</th>
            <th>正确答案（多个用 | 分隔）</th>
            <th>状态</th>
            <th class="col-actions"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="q in list" :key="q.id" :class="{ disabled: q.enabled === 0 }">
            <td class="col-id">{{ q.id }}</td>
            <td class="question-cell">{{ q.question }}</td>
            <td class="answer-cell">
              <code>{{ q.answer }}</code>
            </td>
            <td>
              <span :class="['tag', q.enabled === 1 ? 'on' : 'off']">
                {{ q.enabled === 1 ? '启用中' : '已停用' }}
              </span>
            </td>
            <td class="col-actions">
              <button class="btn" @click="openEdit(q)">编辑</button>
              <button class="btn danger" @click="handleDelete(q)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="!loading && !error && list.length === 0" class="empty">
        还没有任何问题，点击右上角「+ 新增问题」开始配置吧。
      </div>
    </section>

    <!-- 新增 / 编辑 模态框 -->
    <div v-if="showModal" class="modal-mask" @click.self="closeModal">
      <div class="modal">
        <h2>{{ editingItem ? '编辑问题' : '新增问题' }}</h2>
        <label class="field">
          <span>问题文本</span>
          <textarea
            v-model="form.question"
            rows="2"
            maxlength="500"
            placeholder="例如：羽毛球场地的长和宽分别是多少米？"
          />
        </label>
        <label class="field">
          <span>正确答案</span>
          <input
            v-model="form.answer"
            type="text"
            maxlength="500"
            placeholder="多个答案用 | 分隔，如：答案A|答案B"
          />
          <small>比对时会 trim + 忽略大小写</small>
        </label>
        <label class="field inline">
          <span>启用状态</span>
          <select v-model="form.enabled">
            <option :value="1">启用（前台可抽到此题）</option>
            <option :value="0">停用（前台不会抽到此题）</option>
          </select>
        </label>

        <div v-if="formError" class="form-error">{{ formError }}</div>

        <div class="modal-actions">
          <button class="btn" @click="closeModal">取消</button>
          <button class="btn primary" :disabled="submitting" @click="handleSubmit">
            {{ submitting ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-page {
  min-height: 100vh;
  background: #faf7f0;
  padding: 24px 28px 48px;
  max-width: 1100px;
  margin: 0 auto;
}
.top {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}
.top h1 { font-size: 20px; font-weight: 700; color: #1a2e2a; margin: 0; }
.back { background: none; border: none; color: #14665b; font-size: 14px; cursor: pointer; }
.hint { margin-left: auto; color: #5a726d; font-size: 13px; }
.denied { text-align: center; padding: 60px 20px; color: #1a2e2a; }
.denied h2 { margin: 0 0 12px; }
.denied p { color: #5a726d; margin-bottom: 24px; }

.btn {
  border: none; border-radius: 8px; padding: 8px 16px; cursor: pointer;
  font-size: 13px; font-weight: 600;
}
.btn.primary { background: #14665b; color: #fff; }
.btn.danger { background: #b33a2e; color: #fff; }
.btn:disabled { opacity: .6; cursor: not-allowed; }

.questions-table {
  width: 100%; border-collapse: separate; border-spacing: 0;
  background: #fff; border-radius: 12px; overflow: hidden;
  box-shadow: 0 2px 8px rgba(20,102,91,.08);
}
.questions-table th, .questions-table td {
  text-align: left; padding: 12px 14px;
  border-bottom: 1px solid #f0efea; font-size: 13px;
}
.questions-table thead th {
  background: #f1f5f3; color: #5a726d; font-weight: 600; font-size: 12px;
}
.questions-table tbody tr:last-child td { border-bottom: none; }
.questions-table tr.disabled { opacity: 0.55; }

.col-id { width: 40px; color: #5a726d; text-align: center; }
.col-actions { width: 160px; text-align: right; }
.col-actions .btn { margin-left: 6px; }

.question-cell { max-width: 360px; }
.answer-cell code {
  background: #f1f5f3; padding: 2px 6px; border-radius: 4px;
  font-size: 12px; color: #14665b; word-break: break-all;
}

.tag {
  font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 600;
}
.tag.on { background: #e8f4e0; color: #27ae60; }
.tag.off { background: #f0efea; color: #999; }

.loading, .error, .empty { padding: 40px; text-align: center; color: #5a726d; }
.error { color: #b33a2e; }

/* 模态框 */
.modal-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,.4);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal {
  background: #fff; border-radius: 12px; padding: 24px;
  width: 480px; max-width: 90vw; box-shadow: 0 20px 48px rgba(0,0,0,.2);
}
.modal h2 { margin: 0 0 20px; font-size: 18px; color: #1a2e2a; }
.field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; font-size: 13px; color: #5a726d; }
.field span { font-weight: 600; color: #1a2e2a; }
.field textarea, .field input, .field select {
  border: 1px solid #d0d0c8; border-radius: 6px; padding: 8px 10px;
  font-size: 13px; color: #1a2e2a; font-family: inherit;
}
.field textarea { resize: vertical; }
.field small { color: #999; font-size: 11px; }
.form-error { background: #fdecea; color: #b33a2e; padding: 8px 12px; border-radius: 6px; font-size: 12px; margin-bottom: 12px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
</style>

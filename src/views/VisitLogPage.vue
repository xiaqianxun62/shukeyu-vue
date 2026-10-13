<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuth } from '../composables/useAuth'
import * as visitLogApi from '../api/visitLog'

const emit = defineEmits<{ back: [] }>()
const { isLoggedIn, isAdmin } = useAuth()

const loading = ref(true)
const list = ref<visitLogApi.VisitLog[]>([])
const error = ref('')
const ipFilter = ref('')
const limit = ref(100)

const canAccess = computed(() => isLoggedIn.value && isAdmin.value)

async function load(): Promise<void> {
  loading.value = true; error.value = ''
  try { list.value = await visitLogApi.listVisitLogs(ipFilter.value, limit.value) }
  catch (e) { error.value = e instanceof Error ? e.message : '加载失败' }
  finally { loading.value = false }
}

function handleSearch(): void {
  load()
}

function clearFilter(): void {
  ipFilter.value = ''
  load()
}

/** 2026-10-13T12:34:56 → 2026-10-13 12:34:56 */
function formatTime(iso: string): string {
  if (!iso) return '—'
  return iso.replace('T', ' ').slice(0, 19)
}

/** UA 太长了，截断展示，完整内容放 title */
function truncate(s: string, max: number): string {
  if (!s) return '—'
  return s.length > max ? s.slice(0, max) + '…' : s
}

onMounted(load)
</script>

<template>
  <div class="admin-page">
    <header class="top">
      <button class="back" @click="emit('back')">← 返回官网</button>
      <h1>访问日志</h1>
      <button class="btn primary refresh-btn" @click="load">刷新</button>
    </header>

    <section v-if="!canAccess" class="denied">
      <h2>需要管理员权限</h2>
      <p>请用管理员账号登录后再访问此页面。</p>
      <button class="btn primary" @click="emit('back')">返回</button>
    </section>

    <section v-else class="content">
      <div class="toolbar">
        <input
          v-model="ipFilter"
          class="ip-input"
          placeholder="按 IP 精确过滤，如 112.10.20.30"
          @keyup.enter="handleSearch"
        />
        <select v-model.number="limit" class="limit-select" @change="load">
          <option :value="50">最近 50 条</option>
          <option :value="100">最近 100 条</option>
          <option :value="200">最近 200 条</option>
          <option :value="500">最近 500 条</option>
        </select>
        <button class="btn primary" @click="handleSearch">查询</button>
        <button v-if="ipFilter" class="btn" @click="clearFilter">清除</button>
      </div>

      <div v-if="loading" class="loading">加载中…</div>
      <div v-else-if="error" class="error">{{ error }}</div>

      <table v-else class="table">
        <thead>
          <tr>
            <th>时间</th>
            <th>IP</th>
            <th>用户</th>
            <th>路径</th>
            <th>来源页</th>
            <th>UA</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="v in list" :key="v.id">
            <td class="time-cell">{{ formatTime(v.createTime) }}</td>
            <td class="ip-cell">{{ v.ip || '—' }}</td>
            <td>
              <span v-if="v.userId" class="tag ok">{{ v.userName || ('#' + v.userId) }}</span>
              <span v-else class="tag off">游客</span>
            </td>
            <td class="sub path-cell" :title="v.path">{{ v.method }} {{ truncate(v.path, 42) }}</td>
            <td class="sub" :title="v.referer">{{ truncate(v.referer, 30) }}</td>
            <td class="sub" :title="v.userAgent">{{ truncate(v.userAgent, 40) }}</td>
          </tr>
          <tr v-if="list.length === 0">
            <td colspan="6" class="empty">暂无访问记录</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
.admin-page { min-height: 100vh; background: #faf7f0; padding: 24px 28px 48px; max-width: 1200px; margin: 0 auto; }
.top { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
.top h1 { font-size: 20px; font-weight: 700; color: #1a2e2a; margin: 0; }
.back { background: none; border: none; color: #14665b; font-size: 14px; cursor: pointer; }
.refresh-btn { margin-left: auto; }
.btn { border: none; border-radius: 8px; padding: 7px 14px; cursor: pointer; font-size: 13px; font-weight: 600; background: #e3e8e6; color: #1a2e2a; }
.btn.primary { background: #14665b; color: #fff; }

.denied { text-align: center; padding: 60px 20px; color: #1a2e2a; }
.denied h2 { margin: 0 0 12px; }
.denied p { color: #5a726d; margin-bottom: 24px; }

.toolbar { display: flex; gap: 10px; margin-bottom: 14px; }
.ip-input { flex: 1; max-width: 320px; padding: 8px 12px; border: 1px solid #e3e8e6; border-radius: 8px; font-size: 13px; color: #1a2e2a; background: #fff; }
.limit-select { padding: 8px 10px; border: 1px solid #e3e8e6; border-radius: 8px; font-size: 13px; color: #1a2e2a; background: #fff; }

.table { width: 100%; border-collapse: separate; border-spacing: 0; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(20,102,91,.08); }
.table th, .table td { padding: 10px 14px; border-bottom: 1px solid #f0efea; font-size: 13px; text-align: left; }
.table thead th { background: #f1f5f3; color: #5a726d; font-weight: 600; font-size: 12px; }
.table tbody tr:last-child td { border-bottom: none; }
.time-cell { font-variant-numeric: tabular-nums; color: #1a2e2a; white-space: nowrap; }
.ip-cell { font-weight: 600; color: #1a2e2a; white-space: nowrap; }
.path-cell { font-family: ui-monospace, monospace; }
.sub { color: #5a726d; font-size: 12px; }
.tag { font-size: 11px; padding: 2px 8px; border-radius: 4px; white-space: nowrap; }
.tag.ok { background: #e0f1ec; color: #14665b; }
.tag.off { background: #f0efea; color: #5a726d; }
.loading, .error, .empty { padding: 40px; text-align: center; color: #5a726d; }
.error { color: #b33a2e; }
</style>

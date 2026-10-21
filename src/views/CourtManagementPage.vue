<!-- 球场管理页面 -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuth } from '../composables/useAuth'
import * as courtApi from '../api/court'

const emit = defineEmits<{ back: [] }>()
const { isLoggedIn, isAdmin } = useAuth()

const loading = ref(true)
const list = ref<courtApi.Court[]>([])
const error = ref('')
const modalOpen = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)

type Form = { name: string; address: string; lat: string; lng: string; sort: number; enabled: number }
const form = ref<Form>({ name: '', address: '', lat: '', lng: '', sort: 0, enabled: 1 })

const canAccess = computed(() => isLoggedIn.value && isAdmin.value)

async function load(): Promise<void> {
  loading.value = true; error.value = ''
  try { list.value = await courtApi.listAllCourts() }
  catch (e) { error.value = e instanceof Error ? e.message : '加载失败' }
  finally { loading.value = false }
}

function openAdd(): void {
  editingId.value = null
  form.value = { name: '', address: '', lat: '', lng: '', sort: (list.value.length || 0) * 10 + 10, enabled: 1 }
  modalOpen.value = true
}

function openEdit(c: courtApi.Court): void {
  editingId.value = c.id
  form.value = {
    name: c.name,
    address: c.address || '',
    lat: c.lat == null ? '' : String(c.lat),
    lng: c.lng == null ? '' : String(c.lng),
    sort: c.sort,
    enabled: c.enabled,
  }
  modalOpen.value = true
}

function closeModal(): void { modalOpen.value = false }

async function handleSave(): Promise<void> {
  const name = form.value.name.trim()
  if (!name) { alert('球场名称不能为空'); return }
  saving.value = true
  try {
    const payload: courtApi.CourtForm = {
      name,
      address: form.value.address.trim() || undefined,
      lat: form.value.lat ? Number(form.value.lat) : null,
      lng: form.value.lng ? Number(form.value.lng) : null,
      sort: Number(form.value.sort) || 0,
      enabled: Number(form.value.enabled),
    }
    if (editingId.value) await courtApi.updateCourt(editingId.value, payload)
    else await courtApi.createCourt(payload)
    modalOpen.value = false
    await load()
  } catch (e) { alert(e instanceof Error ? e.message : '保存失败') }
  finally { saving.value = false }
}

async function handleToggle(c: courtApi.Court): Promise<void> {
  try { await courtApi.toggleCourt(c.id); await load() }
  catch (e) { alert(e instanceof Error ? e.message : '操作失败') }
}

async function handleDelete(c: courtApi.Court): Promise<void> {
  if (!confirm(`确定要删除球场「${c.name}」吗？（已发布的球局不受影响）`)) return
  try { await courtApi.deleteCourt(c.id); await load() }
  catch (e) { alert(e instanceof Error ? e.message : '删除失败') }
}

onMounted(load)
</script>

<template>
  <div class="admin-page">
    <header class="top">
      <button class="back" @click="emit('back')">← 返回官网</button>
      <h1>球场场地管理</h1>
      <button class="btn primary add-btn" @click="openAdd">+ 新增球场</button>
    </header>

    <section v-if="!canAccess" class="denied">
      <h2>需要管理员权限</h2>
      <p>请用管理员账号登录后再访问此页面。</p>
      <button class="btn primary" @click="emit('back')">返回</button>
    </section>

    <section v-else class="content">
      <div v-if="loading" class="loading">加载中…</div>
      <div v-else-if="error" class="error">{{ error }}</div>

      <table v-else class="table">
        <thead>
          <tr>
            <th>排序</th>
            <th>球场名称</th>
            <th>地址</th>
            <th>经纬度</th>
            <th>状态</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in list" :key="c.id">
            <td>{{ c.sort }}</td>
            <td class="name-cell">{{ c.name }}<span v-if="!c.enabled" class="tag-disabled">已停用</span></td>
            <td class="sub">{{ c.address || '—' }}</td>
            <td class="sub">
              <span v-if="c.lat != null && c.lng != null">{{ c.lat.toFixed(5) }}, {{ c.lng.toFixed(5) }}</span>
              <span v-else>—</span>
            </td>
            <td>
              <span :class="['tag', c.enabled ? 'ok' : 'off']">{{ c.enabled ? '启用' : '停用' }}</span>
            </td>
            <td class="actions">
              <button class="btn" @click="openEdit(c)">编辑</button>
              <button class="btn" :class="c.enabled ? 'warn' : 'primary'" @click="handleToggle(c)">
                {{ c.enabled ? '停用' : '启用' }}
              </button>
              <button class="btn danger" @click="handleDelete(c)">删除</button>
            </td>
          </tr>
          <tr v-if="list.length === 0">
            <td colspan="6" class="empty">还没有球场场地，点右上角 + 新增</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- 新增 / 编辑弹框 -->
    <div v-if="modalOpen" class="mask" @click.self="closeModal">
      <div class="modal">
        <div class="modal-head">
          <h3>{{ editingId ? '编辑球场' : '新增球场' }}</h3>
          <button class="close" @click="closeModal">×</button>
        </div>
        <div class="form">
          <label class="field">
            <span>球场名称 *</span>
            <input v-model="form.name" placeholder="例如：健康城羽毛球馆" maxlength="64" />
          </label>
          <label class="field">
            <span>地址</span>
            <input v-model="form.address" placeholder="可选，如 XX市XX区XX路" maxlength="255" />
          </label>
          <div class="row">
            <label class="field half">
              <span>纬度</span>
              <input v-model="form.lat" placeholder="可选" />
            </label>
            <label class="field half">
              <span>经度</span>
              <input v-model="form.lng" placeholder="可选" />
            </label>
          </div>
          <div class="row">
            <label class="field half">
              <span>排序（越小越前）</span>
              <input type="number" v-model.number="form.sort" />
            </label>
            <label class="field half">
              <span>状态</span>
              <select v-model.number="form.enabled">
                <option :value="1">启用</option>
                <option :value="0">停用</option>
              </select>
            </label>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="closeModal">取消</button>
          <button class="btn primary" :disabled="saving" @click="handleSave">
            {{ saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-page { min-height: 100vh; background: #faf7f0; padding: 24px 28px 48px; max-width: 1200px; margin: 0 auto; }
.top { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
.top h1 { font-size: 20px; font-weight: 700; color: #1a2e2a; margin: 0; }
.back { background: none; border: none; color: #14665b; font-size: 14px; cursor: pointer; }
.add-btn { margin-left: auto; }
.btn { border: none; border-radius: 8px; padding: 7px 14px; cursor: pointer; font-size: 13px; font-weight: 600; background: #e3e8e6; color: #1a2e2a; }
.btn.primary { background: #14665b; color: #fff; }
.btn.danger { background: #b33a2e; color: #fff; }
.btn.warn { background: #7a4f1b; color: #fff; }
.btn:disabled { opacity: .6; cursor: not-allowed; }

.denied { text-align: center; padding: 60px 20px; color: #1a2e2a; }
.denied h2 { margin: 0 0 12px; }
.denied p { color: #5a726d; margin-bottom: 24px; }

.table { width: 100%; border-collapse: separate; border-spacing: 0; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(20,102,91,.08); }
.table th, .table td { padding: 12px 14px; border-bottom: 1px solid #f0efea; font-size: 13px; text-align: left; }
.table thead th { background: #f1f5f3; color: #5a726d; font-weight: 600; font-size: 12px; }
.table tbody tr:last-child td { border-bottom: none; }
.name-cell { font-weight: 600; color: #1a2e2a; }
.sub { color: #5a726d; font-size: 12px; }
.actions { text-align: right; display: flex; gap: 6px; justify-content: flex-end; }
.tag { font-size: 11px; padding: 2px 8px; border-radius: 4px; }
.tag.ok { background: #e0f1ec; color: #14665b; }
.tag.off { background: #f0efea; color: #5a726d; }
.tag-disabled { margin-left: 6px; font-size: 10px; background: #b33a2e; color: #fff; padding: 1px 6px; border-radius: 4px; font-weight: 500; }
.loading, .error, .empty { padding: 40px; text-align: center; color: #5a726d; }
.error { color: #b33a2e; }

.mask { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center; z-index: 999; }
.modal { width: 460px; max-width: 92vw; background: #fff; border-radius: 14px; overflow: hidden; }
.modal-head { padding: 16px 20px; border-bottom: 1px solid #f0efea; display: flex; align-items: center; justify-content: space-between; }
.modal-head h3 { margin: 0; font-size: 15px; font-weight: 700; color: #1a2e2a; }
.close { background: none; border: none; font-size: 20px; cursor: pointer; color: #5a726d; }
.form { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #5a726d; }
.field span { font-weight: 500; }
.field input, .field select { padding: 8px 12px; border: 1px solid #e3e8e6; border-radius: 8px; font-size: 14px; color: #1a2e2a; }
.row { display: flex; gap: 12px; }
.field.half { flex: 1; }
.modal-foot { padding: 14px 20px; border-top: 1px solid #f0efea; display: flex; justify-content: flex-end; gap: 10px; }
</style>

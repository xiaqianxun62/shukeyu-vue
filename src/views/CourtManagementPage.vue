<!-- 球场管理页面 -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuth } from '../composables/useAuth'
import * as courtApi from '../api/court'

const emit = defineEmits<{ back: [] }>()
const { isLoggedIn, has } = useAuth()

const loading = ref(true)
const list = ref<courtApi.CourtAdminItem[]>([])
const error = ref('')
const modalOpen = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)

type Form = { name: string; address: string; lat: string; lng: string; sort: number; enabled: number }
const form = ref<Form>({ name: '', address: '', lat: '', lng: '', sort: 0, enabled: 1 })

const canAccess = computed(() => isLoggedIn.value && has('court:manage'))

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

function openEdit(c: courtApi.CourtAdminItem): void {
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

async function handleToggle(c: courtApi.CourtAdminItem): Promise<void> {
  try { await courtApi.toggleCourt(c.id); await load() }
  catch (e) { alert(e instanceof Error ? e.message : '操作失败') }
}

/** 被球局 / 赛事引用的球场不能删：删了历史记录会丢场地名与定位，只能停用 */
function refCount(c: courtApi.CourtAdminItem): number {
  return (c.gameCount || 0) + (c.tournamentCount || 0)
}

function refText(c: courtApi.CourtAdminItem): string {
  const parts: string[] = []
  if (c.gameCount) parts.push(`${c.gameCount} 个球局`)
  if (c.tournamentCount) parts.push(`${c.tournamentCount} 个赛事`)
  return parts.length ? parts.join(' / ') : '未被引用'
}

async function handleDelete(c: courtApi.CourtAdminItem): Promise<void> {
  if (refCount(c) > 0) {
    alert(`「${c.name}」已被 ${refText(c)}使用，删除会让这些记录的场地名与定位失效。\n请改为「停用」。`)
    return
  }
  if (!confirm(`确定要删除球场「${c.name}」吗？`)) return
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
            <th>引用</th>
            <th>状态</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in list" :key="c.id">
            <td data-label="排序">{{ c.sort }}</td>
            <td class="name-cell" data-label="球场名称">{{ c.name }}<span v-if="!c.enabled" class="tag-disabled">已停用</span></td>
            <td class="sub" data-label="地址">{{ c.address || '—' }}</td>
            <td class="sub" data-label="经纬度">
              <span v-if="c.lat != null && c.lng != null">{{ c.lat.toFixed(5) }}, {{ c.lng.toFixed(5) }}</span>
              <span v-else>—</span>
            </td>
            <td class="sub" data-label="引用">{{ refText(c) }}</td>
            <td data-label="状态">
              <span :class="['tag', c.enabled ? 'ok' : 'off']">{{ c.enabled ? '启用' : '停用' }}</span>
            </td>
            <td class="actions">
              <button class="btn" @click="openEdit(c)">编辑</button>
              <button class="btn" :class="c.enabled ? 'warn' : 'primary'" @click="handleToggle(c)">
                {{ c.enabled ? '停用' : '启用' }}
              </button>
              <button
                class="btn danger"
                :disabled="refCount(c) > 0"
                :title="refCount(c) > 0 ? '已被业务数据引用，请改为停用' : '删除场地'"
                @click="handleDelete(c)"
              >删除</button>
            </td>
          </tr>
          <tr v-if="list.length === 0">
            <td colspan="7" class="empty">还没有球场场地，点右上角 + 新增</td>
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
.btn:disabled { opacity: .5; cursor: not-allowed; }
.btn.danger:disabled { background: #d9d6cf; color: #8a9a96; }

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

/* ===== 手机适配（≤640px） ===== */
@media (max-width: 640px) {
  .admin-page { padding: 16px 14px 40px; }
  .top { flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
  .top h1 { font-size: 18px; order: 2; flex-basis: 100%; }
  .back { order: 1; }
  .add-btn { order: 3; margin-left: 0; flex: 1; }

  .table thead { display: none; }
  .table, .table tbody, .table tr, .table td { display: block; width: 100%; }
  .table { background: transparent; box-shadow: none; border-radius: 0; }
  .table tbody { display: flex; flex-direction: column; gap: 10px; }
  .table tr {
    background: #fff; border-radius: 12px; padding: 4px 0;
    box-shadow: 0 2px 8px rgba(20,102,91,.08);
  }
  .table td {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; padding: 8px 14px; border-bottom: 1px solid #f4f1ea;
    font-size: 13px;
  }
  .table td:last-child { border-bottom: none; }
  .table td::before {
    content: attr(data-label);
    color: #5a726d; font-size: 12px; font-weight: 600; flex-shrink: 0;
  }
  .table td.name-cell::before { display: none; }
  .table td.name-cell { justify-content: flex-start; }
  .table td.actions {
    flex-direction: row; flex-wrap: wrap; justify-content: flex-end;
    gap: 6px; padding-top: 10px;
  }
  .table td.actions::before { display: none; }
  .table td.actions .btn { flex: 1; min-width: 70px; }
  .table td.empty { display: block; text-align: center; padding: 32px 16px; }
  .table td.empty::before { display: none; }

  .row { flex-direction: column; gap: 14px; }
  .modal { width: 92vw; }
  .modal-head { padding: 14px 16px; }
  .form { padding: 16px; }
  .modal-foot { padding: 12px 16px; flex-direction: column-reverse; }
  .modal-foot .btn { width: 100%; }
}
</style>

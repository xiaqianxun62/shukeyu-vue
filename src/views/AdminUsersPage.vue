<!-- 用户管理页面：RBAC 角色分配（持 user:manage 权限） -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuth } from '../composables/useAuth'
import * as usersApi from '../api/users'
import SmartImage from '../components/SmartImage.vue'

const emit = defineEmits<{ back: [] }>()

const { isLoggedIn, has } = useAuth()
const loading = ref(true)
const list = ref<usersApi.UserItem[]>([])
const rolesList = ref<usersApi.RoleItem[]>([])
/** 每个用户的当前角色码：userId -> 角色码组（降序） */
const roleMap = ref<Record<number, string[]>>({})
const resettingId = ref<number | null>(null)
const error = ref('')

const canAccess = computed(() => isLoggedIn.value && has('user:manage'))

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const [users, roles] = await Promise.all([usersApi.listUsers(), usersApi.listRoles()])
    list.value = users
    rolesList.value = roles
    // 每人查一次当前角色（量级 = 社团人数，可接受；后端有 Redis 缓存）
    const entries = await Promise.all(
      users.map(async (u) => [u.id, await usersApi.getUserRoles(u.id)] as const),
    )
    roleMap.value = Object.fromEntries(entries)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

/* ---------- 角色分配模态框 ---------- */
const modalOpen = ref(false)
const editingUser = ref<usersApi.UserItem | null>(null)
const picked = ref<string[]>([])
const saving = ref(false)

function openRoles(u: usersApi.UserItem): void {
  editingUser.value = u
  picked.value = [...(roleMap.value[u.id] ?? [])]
  modalOpen.value = true
}

function closeModal(): void {
  modalOpen.value = false
  editingUser.value = null
}

function toggleRole(code: string): void {
  picked.value = picked.value.includes(code)
    ? picked.value.filter((c) => c !== code)
    : [...picked.value, code]
}

async function saveRoles(): Promise<void> {
  const u = editingUser.value
  if (!u) return
  saving.value = true
  try {
    const assigned = await usersApi.assignRoles(u.id, picked.value)
    roleMap.value = { ...roleMap.value, [u.id]: assigned }
    closeModal()
  } catch (e) {
    alert(e instanceof Error ? e.message : '操作失败')
  } finally {
    saving.value = false
  }
}

/** 角色列显示文本：按权限从低到高映射已授角色 */
function roleText(u: usersApi.UserItem): string {
  const codes = roleMap.value[u.id] ?? []
  if (!codes.length) return '普通社员'
  return codes
    .map((c) => rolesList.value.find((r) => r.code === c)?.name ?? c)
    .join('、')
}

async function resetPassword(u: usersApi.UserItem): Promise<void> {
  if (!confirm(`确定要把用户「${u.name}」的密码重置为 123456 吗？`)) return
  resettingId.value = u.id
  try {
    await usersApi.resetPassword(u.id)
    alert(`已将「${u.name}」的密码重置为 123456`)
  } catch (e) {
    alert(e instanceof Error ? e.message : '操作失败')
  } finally {
    resettingId.value = null
  }
}

function initial(name: string): string {
  return (name || '?').charAt(0)
}

const AVATAR_COLORS = ['#e5c84b', '#14665b', '#b33a2e', '#5a726d', '#7a4f1b', '#2e5c52']
function colorFor(id: number): string {
  return AVATAR_COLORS[id % AVATAR_COLORS.length]
}

onMounted(load)
</script>

<template>
  <div class="admin-page">
    <header class="top">
      <button class="back" @click="emit('back')">← 返回官网</button>
      <h1>用户管理</h1>
      <span v-if="canAccess" class="hint">共 {{ list.length }} 位用户</span>
    </header>

    <section v-if="!canAccess" class="denied">
      <h2>需要 user:manage 权限</h2>
      <p>请用社长或系统管理员账号登录后再访问此页面。</p>
      <button class="btn primary" @click="emit('back')">返回</button>
    </section>

    <section v-else class="content">
      <div v-if="loading" class="loading">加载中…</div>
      <div v-else-if="error" class="error">{{ error }}</div>

      <table v-else class="users-table">
        <thead>
          <tr>
            <th>用户</th>
            <th>性别</th>
            <th>ELO</th>
            <th>战绩</th>
            <th>角色</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in list" :key="u.id">
            <td class="user-cell" data-label="用户">
              <div class="avatar" :style="{ background: colorFor(u.id) }">
                <SmartImage v-if="u.avatar" :src="u.avatar" class="avatar-img" />
                <span v-else>{{ initial(u.name) }}</span>
              </div>
              <div class="user-info">
                <div class="user-name">
                  {{ u.name }}
                  <span v-if="u.isVerified === 1" class="tag admin">已认证</span>
                </div>
                <div class="user-sub">
                  #{{ u.id }}<span v-if="u.account"> · {{ u.account }}</span>
                </div>
              </div>
            </td>
            <td data-label="性别">{{ u.gender === 1 ? '男' : u.gender === 2 ? '女' : '-' }}</td>
            <td data-label="ELO">{{ u.rating }}</td>
            <td data-label="战绩">{{ u.winCount }}胜 / {{ u.lossCount }}负 · {{ u.gamesPlayed }}场</td>
            <td data-label="角色">{{ roleText(u) }}</td>
            <td class="actions">
              <button class="btn primary" @click="openRoles(u)">分配角色</button>
              <button
                class="btn warn"
                :disabled="resettingId === u.id"
                @click="resetPassword(u)"
              >
                {{ resettingId === u.id ? '重置中…' : '重置密码' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- 角色分配模态框 -->
    <div v-if="modalOpen && editingUser" class="modal-mask" @click.self="closeModal">
      <div class="modal">
        <h3>分配角色 · {{ editingUser.name }}</h3>
        <p class="modal-hint">
          整体覆盖：勾选的角色会替换该用户现有角色；全部不勾 = 降回普通社员。
          系统管理员角色仅 ADMIN 可授，且至少保留一名系统管理员。
        </p>
        <div class="role-picker">
          <label
            v-for="r in rolesList"
            :key="r.code"
            class="role-option"
            :class="{ picked: picked.includes(r.code) }"
          >
            <input
              type="checkbox"
              :checked="picked.includes(r.code)"
              @change="toggleRole(r.code)"
            />
            <span class="role-name">{{ r.name }}</span>
            <span class="role-code">{{ r.code }}</span>
          </label>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="closeModal">取消</button>
          <button class="btn primary" :disabled="saving" @click="saveRoles">
            {{ saving ? '保存中…' : '保存' }}
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
.back {
  background: none; border: none; color: #14665b; font-size: 14px; cursor: pointer;
}
.hint { margin-left: auto; color: #5a726d; font-size: 13px; }
.denied {
  text-align: center; padding: 60px 20px; color: #1a2e2a;
}
.denied h2 { margin: 0 0 12px; }
.denied p { color: #5a726d; margin-bottom: 24px; }
.btn {
  border: none; border-radius: 8px; padding: 8px 16px; cursor: pointer;
  font-size: 13px; font-weight: 600;
}
.btn.primary { background: #14665b; color: #fff; }
.btn.warn { background: #7a4f1b; color: #fff; margin-left: 8px; }
.btn:disabled { opacity: .6; cursor: not-allowed; }

.loading { padding: 40px 0; text-align: center; color: #5a726d; }
.error { padding: 40px 0; text-align: center; color: #b33a2e; }
.users-table {
  width: 100%; border-collapse: separate; border-spacing: 0;
  background: #fff; border-radius: 12px; overflow: hidden;
  box-shadow: 0 2px 8px rgba(20,102,91,.08);
}
.users-table th, .users-table td {
  text-align: left; padding: 12px 14px;
  border-bottom: 1px solid #f0efea;
  font-size: 13px;
}
.users-table th { color: #5a726d; font-weight: 600; }
.user-cell { display: flex; align-items: center; gap: 10px; }
.avatar {
  width: 36px; height: 36px; border-radius: 50%; flex: none;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 700; font-size: 15px; overflow: hidden;
}
.avatar-img { width: 100%; height: 100%; object-fit: cover; }
.user-name { font-weight: 600; color: #1a2e2a; display: flex; align-items: center; gap: 6px; }
.user-sub { color: #8a9a96; font-size: 12px; margin-top: 2px; }
.tag.admin {
  background: #ede7d3; color: #7a4f1b; padding: 1px 8px; border-radius: 10px; font-size: 11px;
}
.actions { white-space: nowrap; }
.modal-mask {
  position: fixed; inset: 0; background: rgba(26,46,42,.45);
  display: flex; align-items: center; justify-content: center; z-index: 50;
}
.modal {
  background: #fff; border-radius: 14px; padding: 22px 24px; width: min(480px, 92vw);
  box-shadow: 0 12px 40px rgba(0,0,0,.2);
}
.modal h3 { margin: 0 0 8px; color: #1a2e2a; }
.modal-hint { margin: 0 0 14px; font-size: 12px; color: #5a726d; line-height: 1.6; }
.role-picker { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; }
.role-option {
  display: flex; align-items: center; gap: 10px; padding: 10px 12px;
  border: 1px solid #e4e0d5; border-radius: 10px; cursor: pointer; font-size: 13px;
}
.role-option.picked { border-color: #14665b; background: #eef4f2; }
.role-name { font-weight: 600; color: #1a2e2a; }
.role-code { margin-left: auto; color: #8a9a96; font-size: 12px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; }

/* ===== 手机适配（≤640px） ===== */
@media (max-width: 640px) {
  .admin-page { padding: 16px 14px 40px; }
  .top { flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
  .top h1 { font-size: 18px; }
  .hint { margin-left: 0; width: 100%; font-size: 12px; }

  /* 表格转卡片 */
  .users-table thead { display: none; }
  .users-table, .users-table tbody, .users-table tr, .users-table td {
    display: block; width: 100%;
  }
  .users-table { background: transparent; box-shadow: none; border-radius: 0; }
  .users-table tbody { display: flex; flex-direction: column; gap: 10px; }
  .users-table tr {
    background: #fff; border-radius: 12px; padding: 4px 0;
    box-shadow: 0 2px 8px rgba(20,102,91,.08);
  }
  .users-table td {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; padding: 8px 14px; border-bottom: 1px solid #f4f1ea;
    font-size: 13px;
  }
  .users-table td:last-child { border-bottom: none; }
  .users-table td::before {
    content: attr(data-label);
    color: #5a726d; font-size: 12px; font-weight: 600; flex-shrink: 0;
  }
  .users-table td.user-cell { justify-content: flex-start; }
  .users-table td.user-cell::before { display: none; }
  .users-table td.actions {
    flex-direction: row; justify-content: flex-end; padding-top: 10px;
  }
  .users-table td.actions::before { display: none; }
  .users-table td.actions .btn { flex: 1; }
  .actions .btn.warn { margin-left: 0; }

  .modal { width: 92vw; padding: 18px 16px; }
  .modal-actions { flex-direction: column-reverse; }
  .modal-actions .btn { width: 100%; }
}
</style>

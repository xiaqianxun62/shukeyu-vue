<!-- 用户管理页面 -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuth } from '../composables/useAuth'
import * as usersApi from '../api/users'
import SmartImage from '../components/SmartImage.vue'

const emit = defineEmits<{ back: [] }>()

const { isLoggedIn, isAdmin } = useAuth()
const loading = ref(true)
const list = ref<usersApi.UserItem[]>([])
const togglingId = ref<number | null>(null)
const resettingId = ref<number | null>(null)
const error = ref('')

const canAccess = computed(() => isLoggedIn.value && isAdmin.value)

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    list.value = await usersApi.listUsers()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

async function toggleAdmin(u: usersApi.UserItem): Promise<void> {
  if (!confirm(`确定要${u.isAdmin ? '取消' : '授予'}用户「${u.name}」的管理员权限吗？`)) return
  togglingId.value = u.id
  try {
    const updated = await usersApi.setAdmin(u.id, !u.isAdmin)
    u.isAdmin = updated.isAdmin
  } catch (e) {
    alert(e instanceof Error ? e.message : '操作失败')
  } finally {
    togglingId.value = null
  }
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
      <h2>需要管理员权限</h2>
      <p>请用管理员账号登录后再访问此页面。</p>
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
            <td class="user-cell">
              <div class="avatar" :style="{ background: colorFor(u.id) }">
                <SmartImage v-if="u.avatar" :src="u.avatar" class="avatar-img" />
                <span v-else>{{ initial(u.name) }}</span>
              </div>
              <div class="user-info">
                <div class="user-name">
                  {{ u.name }}
                  <span v-if="u.isAdmin" class="tag admin">管理员</span>
                </div>
                <div class="user-sub">
                  #{{ u.id }}<span v-if="u.account"> · {{ u.account }}</span>
                </div>
              </div>
            </td>
            <td>{{ u.gender === 1 ? '男' : u.gender === 2 ? '女' : '-' }}</td>
            <td>{{ u.rating }}</td>
            <td>{{ u.winCount }}胜 / {{ u.lossCount }}负 · {{ u.gamesPlayed }}场</td>
            <td>{{ u.isAdmin ? '管理员' : '普通用户' }}</td>
            <td class="actions">
              <button
                class="btn"
                :class="u.isAdmin ? 'danger' : 'primary'"
                :disabled="togglingId === u.id"
                @click="toggleAdmin(u)"
              >
                {{ togglingId === u.id ? '处理中…' : u.isAdmin ? '取消管理员' : '设为管理员' }}
              </button>
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
.btn.danger { background: #b33a2e; color: #fff; }
.btn.warn { background: #7a4f1b; color: #fff; margin-left: 8px; }
.btn:disabled { opacity: .6; cursor: not-allowed; }

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
.users-table thead th {
  background: #f1f5f3; color: #5a726d; font-weight: 600; font-size: 12px;
}
.users-table tbody tr:last-child td { border-bottom: none; }
.user-cell { display: flex; align-items: center; gap: 12px; }
.avatar {
  width: 36px; height: 36px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 14px; font-weight: 700; overflow: hidden;
}
.avatar-img { width: 100%; height: 100%; object-fit: cover; }
.user-name { font-weight: 600; color: #1a2e2a; display: flex; align-items: center; gap: 6px; }
.user-sub { color: #5a726d; font-size: 12px; margin-top: 2px; }
.tag {
  font-size: 10px; padding: 1px 6px; border-radius: 4px;
}
.tag.admin { background: #e5c84b; color: #1a2e2a; }
.actions { text-align: right; }
.loading, .error { padding: 40px; text-align: center; color: #5a726d; }
.error { color: #b33a2e; }
</style>

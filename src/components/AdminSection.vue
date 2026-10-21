<script setup lang="ts">
import { computed } from 'vue'
import SvgIcon from './SvgIcon.vue'
import { useAuth } from '../composables/useAuth'

/**
 * 管理功能快捷入口：仅管理员渲染，点击直达对应 hash 路由管理页。
 */
const { isAdmin } = useAuth()

interface Entry {
  hash: string
  icon: 'users' | 'court' | 'card' | 'megaphone' | 'engine' | 'chart'
  label: string
  desc: string
}

const ENTRIES: Entry[] = [
  { hash: '#/admin', icon: 'users', label: '用户管理', desc: '账号列表 · 管理员权限' },
  { hash: '#/courts', icon: 'court', label: '球场管理', desc: '场馆字典 · 启停排序' },
  { hash: '#/questions', icon: 'card', label: '问题管理', desc: '身份校验题库 CRUD' },
  { hash: '#/notice', icon: 'megaphone', label: '首页公告', desc: '弹窗频率 · 配色 · 媒体' },
  { hash: '#/settings', icon: 'engine', label: '站点文案', desc: '首页诗句等展示文案' },
  { hash: '#/visitlogs', icon: 'chart', label: '访问日志', desc: '访客 IP · 来源 · 轨迹' },
]

const visible = computed(() => isAdmin.value)

function go(hash: string): void {
  window.location.hash = hash
}
</script>

<template>
  <section v-if="visible" id="admin-entries" class="section section-alt">
    <div class="container">
      <div class="section-header">
        <h2 class="section-title">管理功能</h2>
        <p class="section-desc">数据管理与站点配置的快捷入口</p>
      </div>

      <div class="entry-grid">
        <button
          v-for="e in ENTRIES"
          :key="e.hash"
          type="button"
          class="entry-card"
          @click="go(e.hash)"
        >
          <span class="entry-icon">
            <SvgIcon :type="e.icon" :size="24" />
          </span>
          <span class="entry-text">
            <span class="entry-name">{{ e.label }}</span>
            <span class="entry-desc">{{ e.desc }}</span>
          </span>
          <span class="entry-arrow">›</span>
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.entry-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
.entry-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 16px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--card);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: var(--shadow-sm, 0 2px 8px rgba(20, 102, 91, 0.06));
}
.entry-card:hover {
  border-color: var(--primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md, 0 8px 20px rgba(20, 102, 91, 0.12));
}
.entry-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 46px;
  height: 46px;
  border-radius: 12px;
  background: var(--success-bg, #e0f1ec);
  color: var(--primary);
}
.entry-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.entry-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
}
.entry-desc {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.entry-arrow {
  margin-left: auto;
  font-size: 20px;
  color: var(--text-muted);
  line-height: 1;
}

@media (max-width: 860px) {
  .entry-grid {
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 520px) {
  .entry-grid {
    grid-template-columns: 1fr;
  }
}
</style>

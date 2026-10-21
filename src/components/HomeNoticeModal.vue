<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getHomeNotice, type HomeNotice } from '../api/settings'
import { resolveUrl } from '../api/http'

/**
 * 首页弹窗公告：拉取管理员配置的公告，enabled=1 且有内容才弹。
 * 展示频率（管理员配置）：
 *   always — 每次进入首页都弹
 *   daily  — 关闭后当天不再弹，隔天再弹（默认）
 *   once   — 同一内容只弹一次；管理员更新公告（version 变化）后重新弹
 * 颜色与宽高也由管理员配置，height=0 时高度自适应。
 * 只在官网首页挂载（App.vue home 分支）。
 */
const visible = ref(false)
const cfg = ref<HomeNotice | null>(null)

const STORAGE_KEY = 'yuyue_notice_dismissed'

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

/** 当前关闭标记：按频率构造，always 不记，daily 带日期，once 只记版本 */
function dismissKey(n: HomeNotice): string {
  if (n.frequency === 'once') return n.version
  if (n.frequency === 'always') return ''
  return `${n.version}|${today()}`
}

function dismiss(): void {
  if (!cfg.value) {
    visible.value = false
    return
  }
  visible.value = false
  const key = dismissKey(cfg.value)
  if (!key) return
  try {
    localStorage.setItem(STORAGE_KEY, key)
  } catch {
    /* 隐私模式等场景忽略 */
  }
}

/** 弹窗卡片样式：管理员配置的背景色 / 宽 / 高（height=0 自适应） */
const cardStyle = computed(() => {
  const n = cfg.value
  if (!n) return {}
  const style: Record<string, string> = { background: n.bgColor || '#fffdf8' }
  const w = parseInt(n.width, 10)
  if (!isNaN(w) && w > 0) {
    style.width = `${w}px`
    style.maxWidth = '100%'
  }
  const h = parseInt(n.height, 10)
  if (!isNaN(h) && h > 0) {
    style.height = `${h}px`
  }
  return style
})

onMounted(async () => {
  try {
    const data = await getHomeNotice()
    if (data.enabled !== '1' || !data.content?.trim()) return
    const key = dismissKey(data)
    if (key) {
      let saved = ''
      try {
        saved = localStorage.getItem(STORAGE_KEY) || ''
      } catch {
        saved = ''
      }
      if (saved === key) return
    }
    cfg.value = data
    visible.value = true
  } catch {
    /* 拉取失败不弹，不影响首页 */
  }
})
</script>

<template>
  <div v-if="visible && cfg" class="notice-mask" @click.self="dismiss">
    <div class="notice-card" role="dialog" aria-modal="true" :aria-label="cfg.title" :style="cardStyle">
      <button type="button" class="notice-close" aria-label="关闭弹窗" @click="dismiss">×</button>
      <h3 class="notice-title" :style="{ color: cfg.titleColor || '#1a2e2a' }">
        {{ cfg.title?.trim() || '公告' }}
      </h3>
      <div class="notice-content" :style="{ color: cfg.contentColor || '#5a726d' }">
        {{ cfg.content }}
        <img
          v-if="cfg.mediaType === 'image' && cfg.mediaUrl"
          :src="resolveUrl(cfg.mediaUrl)"
          class="notice-media"
          alt=""
        />
        <video
          v-else-if="cfg.mediaType === 'video' && cfg.mediaUrl"
          :src="resolveUrl(cfg.mediaUrl)"
          class="notice-media-video"
          controls
          preload="metadata"
        ></video>
      </div>
      <button
        type="button"
        class="notice-ok"
        :style="{ background: cfg.btnBgColor || '#14665b', color: cfg.btnTextColor || '#fff' }"
        @click="dismiss"
      >
        我知道了
      </button>
    </div>
  </div>
</template>

<style scoped>
.notice-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 30, 26, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 400;
  padding: 20px;
  animation: notice-fade 0.18s ease-out;
}
@keyframes notice-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

.notice-card {
  position: relative;
  width: min(420px, 100%);
  background: var(--card, #fff);
  border-radius: 16px;
  padding: 28px 24px 22px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  animation: notice-pop 0.22s ease-out;
}
@keyframes notice-pop {
  from { transform: scale(0.94); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.notice-close {
  position: absolute;
  top: 10px;
  right: 12px;
  border: none;
  background: transparent;
  font-size: 22px;
  line-height: 1;
  color: var(--text-muted, #8a9490);
  cursor: pointer;
  padding: 4px 8px;
}
.notice-close:hover { opacity: 0.7; }

.notice-title {
  margin: 0 0 12px;
  font-size: 17px;
  font-weight: 800;
}

.notice-content {
  font-size: 14px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.notice-media {
  display: block;
  width: 100%;
  max-height: 220px;
  object-fit: contain;
  border-radius: 10px;
  margin-top: 10px;
}
.notice-media-video {
  display: block;
  width: 100%;
  max-height: 240px;
  border-radius: 10px;
  margin-top: 10px;
  background: #000;
}

.notice-ok {
  display: block;
  flex-shrink: 0;
  width: 100%;
  height: 42px;
  margin-top: 18px;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s;
}
.notice-ok:hover { opacity: 0.9; }
</style>

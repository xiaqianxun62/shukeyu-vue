<!--公告管理页面-->
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import SvgIcon from '../components/SvgIcon.vue'
import * as settingsApi from '../api/settings'
import { resolveUrl } from '../api/http'
import { useAuth } from '../composables/useAuth'

/** 首页弹窗公告设置页：#/notice，仅管理员。开关/频率/标题/正文/颜色/宽高 + 实时预览 */
const emit = defineEmits<{
  back: []
}>()

const { isLoggedIn, isAdmin, restore } = useAuth()

interface NoticeForm {
  enabled: string
  title: string
  content: string
  frequency: string
  bgColor: string
  titleColor: string
  contentColor: string
  btnBgColor: string
  btnTextColor: string
  width: string
  height: string
  mediaType: string
  mediaUrl: string
}

const form = reactive<NoticeForm>({
  enabled: '0',
  title: '',
  content: '',
  frequency: 'daily',
  bgColor: '#fffdf8',
  titleColor: '#22312a',
  contentColor: '#5a726d',
  btnBgColor: '#14665b',
  btnTextColor: '#ffffff',
  width: '420',
  height: '0',
  mediaType: '',
  mediaUrl: '',
})
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const success = ref('')
const uploading = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

/** 预览：当前表单配置的弹窗卡片样式（宽高同线上逻辑，超出预览区自适应） */
const previewStyle = computed(() => {
  const style: Record<string, string> = { background: form.bgColor || '#fffdf8' }
  const w = Number(form.width)
  if (!isNaN(w) && w > 0) style.width = `${w}px`
  const h = Number(form.height)
  if (!isNaN(h) && h > 0) style.height = `${h}px`
  return style
})

/** 预览：当前频率文案 */
const freqLabel = computed(() => {
  const map: Record<string, string> = {
    daily: '每天最多一次',
    always: '每次进入首页都弹',
    once: '同一内容只弹一次',
  }
  return map[form.frequency] ?? '每天最多一次'
})

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const data = await settingsApi.getHomeNotice()
    form.enabled = data.enabled ?? '0'
    form.title = data.title ?? ''
    form.content = data.content ?? ''
    form.frequency = data.frequency ?? 'daily'
    form.bgColor = data.bgColor || '#fffdf8'
    form.titleColor = data.titleColor || '#22312a'
    form.contentColor = data.contentColor || '#5a726d'
    form.btnBgColor = data.btnBgColor || '#14665b'
    form.btnTextColor = data.btnTextColor || '#ffffff'
    form.width = data.width || '420'
    form.height = data.height || '0'
    form.mediaType = data.mediaType || ''
    form.mediaUrl = data.mediaUrl || ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

/** 选择媒体文件（图片 / 视频） */
function pickMediaFile(): void {
  fileInputRef.value?.click()
}

async function onMediaFileChange(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // 允许重复选择同一文件
  if (!file) return
  error.value = ''
  success.value = ''
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
    error.value = '仅支持图片或视频文件'
    return
  }
  uploading.value = true
  try {
    const res = await settingsApi.uploadNoticeMedia(file)
    form.mediaType = res.mediaType
    form.mediaUrl = res.mediaUrl
    success.value = '媒体已上传，记得点「保存公告」生效'
  } catch (e) {
    error.value = e instanceof Error ? e.message : '上传失败'
  } finally {
    uploading.value = false
  }
}

/** 移除媒体（保存时生效：mediaType 传空串，后端会连带清空 mediaUrl） */
function removeMedia(): void {
  form.mediaType = ''
  form.mediaUrl = ''
  success.value = ''
}

/** 保存公告（仅管理员；内容更新后 version 自增，用户端按频率重新弹） */
async function handleSave(): Promise<void> {
  if (!isLoggedIn.value) {
    window.location.hash = '#/login'
    return
  }
  if (!isAdmin.value) {
    error.value = '仅管理员可修改公告'
    return
  }
  error.value = ''
  success.value = ''
  if (form.enabled === '1' && !form.content.trim()) {
    error.value = '开启弹窗时正文不能为空'
    return
  }
  // 尺寸校验：宽 200~600px，高 0(自适应)~800px
  const w = Number(form.width)
  const h = Number(form.height)
  if (isNaN(w) || w < 200 || w > 600) {
    error.value = '宽度需在 200 ~ 600 px 之间'
    return
  }
  if (isNaN(h) || h < 0 || h > 800) {
    error.value = '高度需在 0 ~ 800 px 之间（0 = 自适应）'
    return
  }
  saving.value = true
  try {
    const saved = await settingsApi.updateHomeNotice({
      enabled: form.enabled,
      title: form.title.trim() || undefined,
      content: form.content.trim() || undefined,
      frequency: form.frequency,
      bgColor: form.bgColor,
      titleColor: form.titleColor,
      contentColor: form.contentColor,
      btnBgColor: form.btnBgColor,
      btnTextColor: form.btnTextColor,
      width: String(Math.round(w)),
      height: String(Math.round(h)),
      mediaType: form.mediaType, // 空串 = 移除媒体（后端特判）
      mediaUrl: form.mediaUrl || undefined,
    })
    form.enabled = saved.enabled
    form.title = saved.title
    form.content = saved.content
    form.frequency = saved.frequency || 'daily'
    form.bgColor = saved.bgColor || form.bgColor
    form.titleColor = saved.titleColor || form.titleColor
    form.contentColor = saved.contentColor || form.contentColor
    form.btnBgColor = saved.btnBgColor || form.btnBgColor
    form.btnTextColor = saved.btnTextColor || form.btnTextColor
    form.width = saved.width || form.width
    form.height = saved.height ?? form.height
    form.mediaType = saved.mediaType || ''
    form.mediaUrl = saved.mediaUrl || ''
    success.value = '已保存，用户端下次进首页即可看到（内容更新会按频率重新弹）'
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  if (!isLoggedIn.value) await restore()
  if (!isAdmin.value) {
    error.value = '仅管理员可访问此页面'
    return
  }
  await load()
})
</script>

<template>
  <div class="notice-page">
    <header class="page-bar">
      <a class="brand" href="#hero" @click.prevent="emit('back')">
        <SvgIcon type="logo" :size="22" class="brand-icon" />
        <span>数羽 SHUYU</span>
      </a>
      <a class="back-link" href="#hero" @click.prevent="emit('back')">返回官网</a>
    </header>

    <main class="page-main">
      <section class="panel">
        <div class="panel-card">
          <template v-if="isLoggedIn && isAdmin">
            <h1 class="title">首页公告 · 弹窗设置</h1>
            <p class="subtitle">
              开启后，官网首页与小程序首页会弹出此公告。展示频率、颜色、宽高均可自定义；
              修改内容并保存后会按频率重新弹。
            </p>

            <p v-if="loading" class="hint">加载当前公告中…</p>
            <template v-else>
              <div class="field">
                <span class="label">展示开关</span>
                <select v-model="form.enabled" class="input">
                  <option value="1">开启弹窗</option>
                  <option value="0">关闭弹窗</option>
                </select>
              </div>

              <div class="field">
                <span class="label">展示频率</span>
                <select v-model="form.frequency" class="input">
                  <option value="daily">每天最多一次（默认）</option>
                  <option value="always">每次进入首页都弹</option>
                  <option value="once">同一内容只弹一次</option>
                </select>
              </div>

              <div class="field">
                <span class="label">弹窗标题</span>
                <input
                  v-model="form.title"
                  class="input"
                  type="text"
                  placeholder="如：本周六特别活动通知"
                  maxlength="30"
                />
              </div>

              <div class="field">
                <span class="label">弹窗正文</span>
                <textarea
                  v-model="form.content"
                  class="input textarea"
                  rows="5"
                  maxlength="500"
                  placeholder="公告内容，支持多行；空行会保留"
                />
              </div>

              <!-- 配图 / 视频 -->
              <div class="field">
                <span class="label">配图 / 视频（可选）</span>
                <div class="media-box">
                  <template v-if="form.mediaType && form.mediaUrl">
                    <img
                      v-if="form.mediaType === 'image'"
                      :src="resolveUrl(form.mediaUrl)"
                      class="media-thumb"
                      alt="公告图片"
                    />
                    <video
                      v-else
                      :src="resolveUrl(form.mediaUrl)"
                      class="media-thumb"
                      controls
                      preload="metadata"
                    ></video>
                    <div class="media-actions">
                      <span class="media-name">{{ form.mediaType === 'video' ? '视频' : '图片' }}已上传</span>
                      <button type="button" class="mini-btn" :disabled="uploading" @click="pickMediaFile">
                        {{ uploading ? '上传中…' : '更换' }}
                      </button>
                      <button type="button" class="mini-btn danger" @click="removeMedia">移除</button>
                    </div>
                  </template>
                  <button
                    v-else
                    type="button"
                    class="ghost-btn"
                    :disabled="uploading"
                    @click="pickMediaFile"
                  >
                    {{ uploading ? '上传中…' : '+ 上传图片 / 视频' }}
                  </button>
                  <input
                    ref="fileInputRef"
                    type="file"
                    accept="image/*,video/*"
                    class="hidden-file"
                    @change="onMediaFileChange"
                  />
                </div>
                <div class="media-hint">支持 jpg/png/webp/gif 图片与 mp4/webm/ogg/mov/avi 视频，最大 10MB</div>
              </div>

              <!-- 个性化颜色 -->
              <div class="field">
                <span class="label">个性化颜色</span>
                <div class="color-grid">
                  <label class="color-item">
                    <span class="color-name">弹窗背景</span>
                    <span class="color-picker">
                      <input type="color" v-model="form.bgColor" />
                      <input type="text" v-model="form.bgColor" class="color-hex" maxlength="7" />
                    </span>
                  </label>
                  <label class="color-item">
                    <span class="color-name">标题颜色</span>
                    <span class="color-picker">
                      <input type="color" v-model="form.titleColor" />
                      <input type="text" v-model="form.titleColor" class="color-hex" maxlength="7" />
                    </span>
                  </label>
                  <label class="color-item">
                    <span class="color-name">正文颜色</span>
                    <span class="color-picker">
                      <input type="color" v-model="form.contentColor" />
                      <input type="text" v-model="form.contentColor" class="color-hex" maxlength="7" />
                    </span>
                  </label>
                  <label class="color-item">
                    <span class="color-name">按钮底色</span>
                    <span class="color-picker">
                      <input type="color" v-model="form.btnBgColor" />
                      <input type="text" v-model="form.btnBgColor" class="color-hex" maxlength="7" />
                    </span>
                  </label>
                  <label class="color-item">
                    <span class="color-name">按钮文字</span>
                    <span class="color-picker">
                      <input type="color" v-model="form.btnTextColor" />
                      <input type="text" v-model="form.btnTextColor" class="color-hex" maxlength="7" />
                    </span>
                  </label>
                </div>
              </div>

              <!-- 尺寸 -->
              <div class="field">
                <span class="label">弹窗尺寸</span>
                <div class="row">
                  <label class="size-item">
                    <span class="size-name">宽度 (px)</span>
                    <input v-model="form.width" type="number" min="200" max="600" />
                  </label>
                  <label class="size-item">
                    <span class="size-name">高度 (px，0 = 自适应)</span>
                    <input v-model="form.height" type="number" min="0" max="800" step="10" />
                  </label>
                </div>
              </div>

              <!-- 效果预览：模拟遮罩内弹窗，随上方配置实时变化 -->
              <div class="field">
                <span class="label">效果预览</span>
                <div class="preview-mask">
                  <div class="preview-notice" :style="previewStyle">
                    <span class="pn-close">×</span>
                    <div class="pn-title" :style="{ color: form.titleColor || '#1a2e2a' }">
                      {{ form.title.trim() || '公告' }}
                    </div>
                    <div class="pn-content" :style="{ color: form.contentColor || '#5a726d' }">
                      {{ form.content || '弹窗正文会显示在这里。支持多行内容，超长时可在弹窗内滚动查看。' }}
                      <img
                        v-if="form.mediaType === 'image' && form.mediaUrl"
                        :src="resolveUrl(form.mediaUrl)"
                        class="pn-media"
                        alt=""
                      />
                      <video
                        v-else-if="form.mediaType === 'video' && form.mediaUrl"
                        :src="resolveUrl(form.mediaUrl)"
                        class="pn-media-video"
                        controls
                        preload="metadata"
                      ></video>
                    </div>
                    <div
                      class="pn-btn"
                      :style="{
                        background: form.btnBgColor || '#14665b',
                        color: form.btnTextColor || '#ffffff',
                      }"
                    >
                      我知道了
                    </div>
                  </div>
                </div>
                <div class="preview-meta">
                  展示频率：{{ freqLabel }} · 尺寸 {{ form.width || '420' }} ×
                  {{ form.height === '0' || !form.height ? '自适应' : form.height + ' px' }}
                </div>
              </div>

              <p v-if="error" class="msg error">{{ error }}</p>
              <p v-if="success" class="msg success">{{ success }}</p>

              <div class="actions">
                <button class="primary-btn" type="button" :disabled="saving" @click="handleSave">
                  {{ saving ? '保存中…' : '保存公告' }}
                </button>
                <button class="ghost-btn" type="button" @click="emit('back')">返回</button>
              </div>
            </template>
          </template>

          <template v-else-if="isLoggedIn">
            <h1 class="title">需要管理员权限</h1>
            <p class="subtitle">请用管理员账号登录后再访问此页面</p>
            <button class="primary-btn" type="button" @click="emit('back')">返回</button>
          </template>

          <template v-else>
            <h1 class="title">还没有登录</h1>
            <p class="subtitle">登录后即可配置首页弹窗公告</p>
            <button class="primary-btn" type="button" @click="emit('back')">去登录</button>
          </template>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
/* 布局复用 ProfilePage / SettingsPage */
.notice-page { min-height: 100vh; background: var(--bg); }
.page-bar {
  display: flex; align-items: center; justify-content: space-between;
  height: 56px; padding: 0 20px;
  background: var(--card); border-bottom: 1px solid var(--border-light);
}
.brand {
  display: inline-flex; align-items: center; gap: 8px;
  color: var(--primary); font-weight: 800; text-decoration: none;
}
.back-link {
  color: var(--text-muted); font-size: 14px; text-decoration: none;
}
.back-link:hover { color: var(--primary); }
.page-main { display: flex; justify-content: center; padding: 40px 20px 60px; }
.panel { width: 100%; max-width: 520px; }
.panel-card {
  padding: 24px;
  border: 1px solid var(--border-light); border-radius: 16px;
  background: var(--card); box-shadow: var(--shadow-md);
}
.textarea {
  height: auto;
  min-height: 110px;
  padding: 10px 12px;
  line-height: 1.6;
  resize: vertical;
  font-family: inherit;
}

/* 颜色选择：色块 + hex 输入并排 */
.color-grid { display: flex; flex-direction: column; gap: 10px; }
.color-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.color-name { font-size: 13px; color: var(--text); }
.color-picker { display: flex; align-items: center; gap: 8px; }
.color-picker input[type='color'] {
  width: 44px;
  height: 32px;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  cursor: pointer;
}
.color-hex {
  width: 92px;
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font-size: 13px;
  font-family: ui-monospace, monospace;
}
.color-hex:focus { outline: none; border-color: var(--primary); }

/* 尺寸输入 */
.row { display: flex; gap: 12px; }
.size-item { flex: 1; display: flex; flex-direction: column; gap: 6px; }
.size-name { font-size: 12px; color: var(--text-muted); }
.size-item input {
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
}
.size-item input:focus { outline: none; border-color: var(--primary); }

/* 效果预览：模拟遮罩 + 弹窗卡片，随表单实时变化 */
.preview-mask {
  background: rgba(15, 30, 26, 0.55);
  border-radius: 12px;
  padding: 24px 16px;
  display: flex;
  justify-content: center;
}
.preview-notice {
  position: relative;
  background: #fffdf8;
  border-radius: 16px;
  padding: 22px 18px 16px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  max-width: 100%;
}
.pn-close {
  position: absolute;
  top: 6px;
  right: 10px;
  font-size: 18px;
  color: #8a9490;
  line-height: 1;
}
.pn-title {
  font-size: 16px;
  font-weight: 800;
  padding-right: 20px;
  line-height: 1.4;
}
.pn-content {
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  flex: 1;
  min-height: 0;
  max-height: 170px;
  overflow-y: auto;
}
.pn-media {
  display: block;
  width: 100%;
  max-height: 120px;
  object-fit: contain;
  border-radius: 8px;
  margin-top: 8px;
}
.pn-media-video {
  display: block;
  width: 100%;
  max-height: 130px;
  border-radius: 8px;
  margin-top: 8px;
  background: #000;
}
.pn-btn {
  flex-shrink: 0;
  margin-top: 14px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
}
.preview-meta {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-muted);
}

.title { margin: 0; font-size: 20px; font-weight: 800; color: var(--text); }
.subtitle { margin: 6px 0 18px; font-size: 13px; color: var(--text-muted); }
.field { display: block; margin-bottom: 14px; }
.label {
  display: block; margin-bottom: 6px;
  font-size: 13px; font-weight: 700; color: var(--text);
}
.input {
  width: 100%; height: 40px; padding: 0 12px;
  border: 1px solid var(--border); border-radius: 10px;
  background: var(--bg); color: var(--text);
  font-size: 14px; box-sizing: border-box;
  transition: border-color .2s;
}
.input:focus { outline: none; border-color: var(--primary); }
select.input { cursor: pointer; }

/* 媒体上传区 */
.media-box { position: relative; }
.hidden-file { display: none; }
.media-thumb {
  display: block;
  width: 100%;
  max-height: 180px;
  object-fit: contain;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
}
.media-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
.media-name { font-size: 12px; color: var(--text-muted); margin-right: auto; }
.mini-btn {
  padding: 5px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
  transition: all .2s;
}
.mini-btn:hover { border-color: var(--primary); color: var(--primary); }
.mini-btn.danger { color: #b33a2e; }
.mini-btn.danger:hover { border-color: #b33a2e; color: #b33a2e; }
.mini-btn:disabled { opacity: .6; cursor: not-allowed; }
.media-hint { margin-top: 6px; font-size: 12px; color: var(--text-muted); }

.hint { color: var(--text-muted); font-size: 13px; }

.msg { margin: 6px 0; font-size: 13px; }
.msg.error { color: var(--danger); }
.msg.success { color: var(--primary); }

.actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px; }
.primary-btn {
  height: 40px; padding: 0 20px;
  border: none; border-radius: 10px;
  background: var(--primary); color: #fff; font-weight: 700;
  cursor: pointer; transition: opacity .2s;
}
.primary-btn:hover:not(:disabled) { opacity: .9; }
.primary-btn:disabled { opacity: .6; cursor: not-allowed; }
.ghost-btn {
  height: 40px; padding: 0 20px;
  border: 1px solid var(--border); border-radius: 10px;
  background: transparent; color: var(--text); font-size: 14px;
  cursor: pointer; transition: all .2s;
}
.ghost-btn:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
</style>

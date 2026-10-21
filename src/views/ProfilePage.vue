<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import SvgIcon from '../components/SvgIcon.vue'
import * as authApi from '../api/auth'
import type { AuthResult } from '../api/auth'
import { resolveAvatarUrl } from '../api/auth'
import { useAuth } from '../composables/useAuth'

/** 独立「编辑个人信息」页：#/profile */
const emit = defineEmits<{
  back: []
}>()

const { user, isLoggedIn, applyProfile, restore } = useAuth()

interface ProfileForm {
  name: string
  nickname: string
  gender: number
  account: string
  avatar: string
}

const form = reactive<ProfileForm>({
  name: '',
  nickname: '',
  gender: 0,
  account: '',
  avatar: '',
})
const saving = ref(false)
const uploadingAvatar = ref(false)
const error = ref('')
const success = ref('')

function fill(): void {
  if (!user.value) return
  form.name = user.value.name ?? ''
  form.nickname = user.value.nickname ?? ''
  form.gender = user.value.gender ?? 0
  form.account = user.value.account ?? ''
  form.avatar = user.value.avatar ?? ''
}

/** 判断是否为 GIF 文件：跳过裁剪直接上传，保持动画 */
function isGifFile(file: File): boolean {
  if (file.type === 'image/gif') return true
  const name = file.name.toLowerCase()
  return name.endsWith('.gif')
}

/** 选择图片后先打开裁剪弹层；GIF 文件跳过裁剪直传保持动画 */
async function onPickFile(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement
  const file = target.files && target.files[0]
  // 清空 input value，便于同一文件再次触发 change
  target.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    error.value = '请选择图片文件'
    return
  }

  // GIF 文件跳过裁剪，直接上传原图以保持动画
  if (isGifFile(file)) {
    error.value = ''
    try {
      uploadingAvatar.value = true
      const url = await authApi.uploadAvatar(file)
      form.avatar = url
      success.value = 'GIF 头像已上传，记得点保存'
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'GIF 头像上传失败'
    } finally {
      uploadingAvatar.value = false
    }
    return
  }

  error.value = ''
  if (cropObjectUrl) URL.revokeObjectURL(cropObjectUrl)
  cropObjectUrl = URL.createObjectURL(file)
  try {
    const dim = await loadImageSize(cropObjectUrl)
    crop.src = cropObjectUrl
    crop.naturalW = dim.w
    crop.naturalH = dim.h
    crop.minScale = Math.max(CROP_FRAME / dim.w, CROP_FRAME / dim.h)
    crop.scale = crop.minScale
    crop.x = 0
    crop.y = 0
    crop.visible = true
  } catch {
    URL.revokeObjectURL(cropObjectUrl)
    cropObjectUrl = ''
    error.value = '图片加载失败'
  }
}

/* ---------- 头像裁剪（零依赖：指针拖拽 + 按钮/滚轮缩放 + canvas 导出） ---------- */

const CROP_FRAME = 320
const crop = reactive({
  visible: false,
  src: '',
  naturalW: 0,
  naturalH: 0,
  scale: 1,
  minScale: 1,
  x: 0,
  y: 0,
})
const cropping = ref(false)
let cropObjectUrl = ''
let dragStart: { px: number; py: number; x: number; y: number } | null = null

function loadImageSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = reject
    img.src = src
  })
}

function clampCropOffset(): void {
  const maxX = Math.max((crop.naturalW * crop.scale - CROP_FRAME) / 2, 0)
  const maxY = Math.max((crop.naturalH * crop.scale - CROP_FRAME) / 2, 0)
  crop.x = Math.min(maxX, Math.max(-maxX, crop.x))
  crop.y = Math.min(maxY, Math.max(-maxY, crop.y))
}

function onCropPointerDown(e: PointerEvent): void {
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  dragStart = { px: e.clientX, py: e.clientY, x: crop.x, y: crop.y }
}

function onCropPointerMove(e: PointerEvent): void {
  if (!dragStart) return
  crop.x = dragStart.x + (e.clientX - dragStart.px)
  crop.y = dragStart.y + (e.clientY - dragStart.py)
  clampCropOffset()
}

function onCropPointerUp(): void {
  dragStart = null
}

function zoomCrop(delta: number): void {
  crop.scale = Math.min(crop.minScale * 5, Math.max(crop.minScale, crop.scale + delta))
  clampCropOffset()
}

function onCropWheel(e: WheelEvent): void {
  zoomCrop(e.deltaY < 0 ? crop.minScale * 0.2 : -crop.minScale * 0.2)
}

function closeCrop(): void {
  crop.visible = false
  if (cropObjectUrl) {
    URL.revokeObjectURL(cropObjectUrl)
    cropObjectUrl = ''
  }
  crop.src = ''
}

async function confirmCrop(): Promise<void> {
  cropping.value = true
  error.value = ''
  try {
    // 裁剪框映射到原图的正方形区域
    const size = CROP_FRAME / crop.scale
    const sx = (crop.naturalW - size) / 2 - crop.x / crop.scale
    const sy = (crop.naturalH - size) / 2 - crop.y / crop.scale
    const canvas = document.createElement('canvas')
    canvas.width = 480
    canvas.height = 480
    const c = canvas.getContext('2d')
    if (!c) throw new Error('浏览器不支持图片处理')
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('图片读取失败'))
      img.src = crop.src
    })
    c.drawImage(img, sx, sy, size, size, 0, 0, 480, 480)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9),
    )
    if (!blob) throw new Error('图片导出失败')
    const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
    closeCrop()
    uploadingAvatar.value = true
    const url = await authApi.uploadAvatar(file)
    form.avatar = url
    success.value = '头像已上传，记得点保存'
  } catch (e) {
    error.value = e instanceof Error ? e.message : '头像处理失败'
  } finally {
    cropping.value = false
    uploadingAvatar.value = false
  }
}

onMounted(async () => {
  if (!user.value) {
    await restore()
  }
  fill()
})

watch(user, fill)

async function handleSave(): Promise<void> {
  error.value = ''
  success.value = ''
  const name = form.name.trim()
  if (!name) {
    error.value = '请填写姓名'
    return
  }
  saving.value = true
  try {
    const updated: AuthResult = await authApi.updateProfile({
      name,
      // 昵称：空串=清除，不传(null)才是不修改；积分榜优先展示昵称
      nickname: form.nickname.trim(),
      gender: Number(form.gender),
      account: form.account.trim(),
      avatar: form.avatar,
    })
    applyProfile(updated)
    success.value = '资料已保存'
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败，请稍后重试'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="profile-page">
    <header class="page-bar">
      <a class="brand" href="#hero" @click.prevent="emit('back')">
        <SvgIcon type="logo" :size="22" class="brand-icon" />
        <span>数科羽 shukeyu</span>
      </a>
      <a class="back-link" href="#hero" @click.prevent="emit('back')">返回官网</a>
    </header>

    <main class="page-main">
      <section class="panel">
        <div class="panel-card">
          <template v-if="isLoggedIn">
            <!-- 分类 ELO 战绩：单打 / 双打(同性别) / 混双 -->
            <div class="cat-stats">
              <div class="cat-row">
                <span class="cat-name">单打</span>
                <strong class="cat-rating">{{ user?.ratingSingles ?? user?.rating ?? 1200 }}</strong>
                <span class="cat-record">{{ user?.singlesWin ?? 0 }}胜 {{ user?.singlesLoss ?? 0 }}负</span>
              </div>
              <div class="cat-row">
                <span class="cat-name">双打</span>
                <strong class="cat-rating">{{ user?.ratingDoubles ?? user?.rating ?? 1200 }}</strong>
                <span class="cat-record">{{ user?.doublesWin ?? 0 }}胜 {{ user?.doublesLoss ?? 0 }}负</span>
              </div>
              <div class="cat-row">
                <span class="cat-name">混双</span>
                <strong class="cat-rating">{{ user?.ratingMixed ?? user?.rating ?? 1200 }}</strong>
                <span class="cat-record">{{ user?.mixedWin ?? 0 }}胜 {{ user?.mixedLoss ?? 0 }}负</span>
              </div>
            </div>

            <h1 class="title">编辑个人信息</h1>
            <p class="subtitle">修改后会立即生效，群接龙里的称呼也会同步更新</p>

            <label class="field">
              <span class="label">姓名</span>
              <input v-model="form.name" class="input" type="text" placeholder="填写真实姓名" />
            </label>

            <label class="field">
              <span class="label">昵称</span>
              <input v-model="form.nickname" class="input" type="text" placeholder="积分榜等场景展示，可留空" />
              <span class="hint">积分榜优先显示昵称；不填则显示姓名</span>
            </label>

            <div class="field">
              <span class="label">性别</span>
              <div class="gender">
                <button
                  type="button"
                  class="gender-btn"
                  :class="{ active: form.gender === 1 }"
                  @click="form.gender = 1"
                >
                  男
                </button>
                <button
                  type="button"
                  class="gender-btn"
                  :class="{ active: form.gender === 2 }"
                  @click="form.gender = 2"
                >
                  女
                </button>
              </div>
            </div>

            <label class="field">
              <span class="label">账号</span>
              <input
                v-model="form.account"
                class="input"
                type="text"
                placeholder="登录用，可留空"
              />
              <span class="hint">绑定账号后可用「账号 + 密码」登录；留空表示不修改</span>
            </label>

            <div class="field">
              <span class="label">个人头像</span>
              <div class="avatar-row">
                <label class="self-avatar" :class="{ uploading: uploadingAvatar }">
                  <img
                    v-if="form.avatar"
                    class="self-avatar-img"
                    :src="resolveAvatarUrl(form.avatar)"
                    alt="个人头像"
                  />
                  <span v-else class="self-avatar-placeholder">点击上传</span>
                  <span v-if="uploadingAvatar" class="self-avatar-mask">上传中…</span>
                  <input
                    class="avatar-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    @change="onPickFile"
                  />
                </label>
                <span class="hint">轮排表展示真实身份用；支持 jpg / png / webp / gif，≤ 5MB</span>
              </div>
            </div>

            <p v-if="error" class="msg error">{{ error }}</p>
            <p v-if="success" class="msg success">{{ success }}</p>

            <div class="actions">
              <button class="primary-btn" type="button" :disabled="saving" @click="handleSave">
                {{ saving ? '保存中…' : '保存' }}
              </button>
              <button class="ghost-btn" type="button" @click="emit('back')">返回</button>
            </div>
          </template>

          <template v-else>
            <h1 class="title">还没有登录</h1>
            <p class="subtitle">登录后即可编辑个人信息、发布球局、查看 ELO 积分</p>
            <button class="primary-btn" type="button" @click="emit('back')">去登录</button>
          </template>
        </div>
      </section>
    </main>

    <!-- 头像裁剪弹层 -->
    <div
      v-if="crop.visible"
      class="crop-mask"
      @wheel.prevent="onCropWheel"
    >
      <div class="crop-dialog">
        <div class="crop-title">拖动调整位置，缩放后裁剪为方形头像</div>
        <div
          class="crop-frame"
          @pointerdown="onCropPointerDown"
          @pointermove="onCropPointerMove"
          @pointerup="onCropPointerUp"
          @pointercancel="onCropPointerUp"
        >
          <img
            class="crop-img"
            :src="crop.src"
            alt="待裁剪头像"
            draggable="false"
            @dragstart.prevent
            :style="{
              width: crop.naturalW * crop.scale + 'px',
              height: crop.naturalH * crop.scale + 'px',
              transform: `translate(calc(-50% + ${crop.x}px), calc(-50% + ${crop.y}px))`,
            }"
          />
          <span class="crop-ring"></span>
        </div>
        <div class="crop-zoom">
          <button type="button" class="zoom-btn" @click="zoomCrop(-crop.minScale * 0.2)">−</button>
          <button type="button" class="zoom-btn" @click="zoomCrop(crop.minScale * 0.2)">＋</button>
        </div>
        <div class="crop-actions">
          <button class="ghost-btn" type="button" :disabled="cropping" @click="closeCrop">取消</button>
          <button class="primary-btn" type="button" :disabled="cropping" @click="confirmCrop">
            {{ cropping ? '处理中…' : '确定' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-page {
  min-height: 100vh;
  background: var(--bg);
}
.page-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 20px;
  background: var(--card);
  border-bottom: 1px solid var(--border-light);
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--primary);
  font-weight: 800;
  text-decoration: none;
}
.back-link {
  color: var(--text-muted);
  font-size: 14px;
  text-decoration: none;
}
.back-link:hover {
  color: var(--primary);
}
.page-main {
  display: flex;
  justify-content: center;
  padding: 40px 20px 60px;
}
.panel {
  width: 100%;
  max-width: 420px;
}
.panel-card {
  padding: 24px;
  border: 1px solid var(--border-light);
  border-radius: 16px;
  background: var(--card);
  box-shadow: var(--shadow-md);
}
/* 分类 ELO 战绩：单打 / 双打 / 混双 */
.cat-stats {
  margin-bottom: 18px;
  border: 1px solid var(--border-light);
  border-radius: 14px;
  background: var(--bg);
  overflow: hidden;
}
.cat-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  font-size: 13px;
}
.cat-row + .cat-row {
  border-top: 1px solid var(--border-light);
}
.cat-name {
  width: 40px;
  color: var(--text-muted);
}
.cat-rating {
  color: var(--primary);
  font-variant-numeric: tabular-nums;
}
.cat-record {
  margin-left: auto;
  color: var(--text-muted);
  font-size: 12px;
}
.title {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  color: var(--text);
}
.subtitle {
  margin: 6px 0 18px;
  font-size: 13px;
  color: var(--text-muted);
}
.field {
  display: block;
  margin-bottom: 14px;
}
.label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}
.input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg);
  color: var(--text);
  font-family: inherit;
  font-size: 14px;
  box-sizing: border-box;
}
.input:focus {
  outline: none;
  border-color: var(--primary);
  background: var(--card);
}
.hint {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-muted);
}
.gender {
  display: flex;
  gap: 10px;
}
.gender-btn {
  flex: 1;
  height: 40px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg);
  color: var(--text-muted);
  font-family: inherit;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}
.gender-btn.active {
  border-color: var(--primary);
  background: var(--success-bg);
  color: var(--primary);
  font-weight: 700;
}
.msg {
  margin: 0 0 12px;
  font-size: 13px;
}
.msg.error {
  color: #a0522d;
}
.msg.success {
  color: var(--primary);
}
.actions {
  display: flex;
  gap: 10px;
  margin-top: 18px;
}
.primary-btn,
.ghost-btn {
  flex: 1;
  height: 42px;
  border-radius: 12px;
  font-family: inherit;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}
.primary-btn {
  border: none;
  background: var(--primary);
  color: var(--bg);
}
.primary-btn:hover:not(:disabled) {
  background: var(--primary-dark);
}
.primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.ghost-btn {
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text-muted);
}
.ghost-btn:hover {
  border-color: var(--primary-light);
  color: var(--primary);
}
.avatar-row {
  display: flex;
  align-items: center;
  gap: 14px;
}
.self-avatar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 1px dashed var(--border);
  background: var(--bg);
  overflow: hidden;
  cursor: pointer;
}
.self-avatar.uploading {
  cursor: progress;
}
.self-avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}
.self-avatar-placeholder {
  font-size: 12px;
  color: var(--text-muted);
}
.self-avatar-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 12px;
}
.avatar-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

/* 头像裁剪弹层 */
.crop-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(15, 25, 22, 0.82);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.crop-dialog {
  background: var(--card);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.28);
}
.crop-title {
  font-size: 14px;
  color: var(--text-muted);
}
.crop-frame {
  position: relative;
  width: 320px;
  height: 320px;
  overflow: hidden;
  background: #0f1916;
  border-radius: 8px;
  touch-action: none;
  cursor: grab;
}
.crop-frame:active {
  cursor: grabbing;
}
.crop-img {
  position: absolute;
  left: 50%;
  top: 50%;
  user-select: none;
  pointer-events: none;
}
.crop-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.28);
  pointer-events: none;
}
.crop-zoom {
  display: flex;
  gap: 12px;
}
.zoom-btn {
  width: 40px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--border-light);
  background: var(--card);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  color: var(--text);
}
.zoom-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
}
.crop-actions {
  display: flex;
  gap: 12px;
}
</style>

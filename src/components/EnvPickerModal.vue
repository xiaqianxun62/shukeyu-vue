<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  ENVIRONMENTS,
  getCurrentEnv,
  getCustomUrl,
  isEnvSwitchEnabled,
  setCustomUrl,
  setEnvId,
  type EnvItem,
} from '../utils/env'

/**
 * 环境切换弹层：管理员在 PC 官网切换后端环境（本地 / 线上 / 自定义）。
 * 与小程序「我的」页的环境切换同一套语义（utils/env.ts），配置存 localStorage。
 * 切换后需刷新页面，让所有模块重新按新环境拉数据。
 */
const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  /** 环境已切换，父组件负责刷新页面 */
  switched: []
}>()

/** 当前环境 id */
const currentId = ref('default')
/** 自定义地址输入框 */
const customUrlInput = ref('')
/** 自定义地址是否已经生效（用于高亮「自定义」项） */
const customActive = ref(false)

const currentEnv = computed<EnvItem>(() => getCurrentEnv())

/** 已部署站点（域名访问）固定走同源 /api，不允许切到跨环境地址 */
const switchEnabled = computed(() => isEnvSwitchEnabled())

watch(
  () => props.visible,
  (v) => {
    if (!v) return
    const env = getCurrentEnv()
    currentId.value = env.id
    customActive.value = env.id === 'custom'
    customUrlInput.value = getCustomUrl()
  },
  { immediate: true },
)

/** 选中预定义环境 */
function selectEnv(envId: string): void {
  if (!switchEnabled.value) return
  if (envId === 'custom') {
    // 自定义项：先展开输入框，等用户填地址后保存
    currentId.value = 'custom'
    customActive.value = true
    return
  }
  currentId.value = envId
  customActive.value = false
  setEnvId(envId)
  emit('switched')
}

/** 保存自定义地址 */
function saveCustomUrl(): void {
  if (!switchEnabled.value) return
  const url = customUrlInput.value.trim()
  if (!url) return
  setCustomUrl(url)
  setEnvId('custom')
  currentId.value = 'custom'
  customActive.value = true
  emit('switched')
}
</script>

<template>
  <div v-if="visible" class="env-mask" @click.self="emit('close')">
    <div class="env-panel" role="dialog" aria-modal="true" aria-label="切换后端环境">
      <div class="env-head">
        <h3 class="env-title">切换后端环境</h3>
        <button type="button" class="env-close" aria-label="关闭" @click="emit('close')">×</button>
      </div>

      <p class="env-hint">
        当前环境：<strong>{{ switchEnabled ? currentEnv.label : '默认（同源）' }}</strong>
        <span class="env-current-url">{{ switchEnabled ? currentEnv.url || '未设置' : '已部署站点固定使用同源 /api' }}</span>
      </p>

      <div v-if="!switchEnabled" class="env-lock">
        已部署的官网固定走同源 /api，不支持切换到其他环境；环境切换仅在本地开发时可用。
      </div>

      <div class="env-list">
        <button
          v-for="env in ENVIRONMENTS"
          :key="env.id"
          type="button"
          class="env-option"
          :class="{ active: currentId === env.id && !customActive, disabled: !switchEnabled }"
          :disabled="!switchEnabled"
          @click="selectEnv(env.id)"
        >
          <span class="env-option-label">{{ env.label }}</span>
          <span class="env-option-url">{{ env.url }}</span>
        </button>

        <button
          type="button"
          class="env-option"
          :class="{ active: customActive, disabled: !switchEnabled }"
          :disabled="!switchEnabled"
          @click="selectEnv('custom')"
        >
          <span class="env-option-label">自定义</span>
          <span class="env-option-url">{{ getCustomUrl() || '手动填写后端地址' }}</span>
        </button>
      </div>

      <div class="env-custom">
        <input
          v-model="customUrlInput"
          class="env-input"
          type="text"
          placeholder="http://IP:端口/api"
          :disabled="!switchEnabled"
          @keyup.enter="saveCustomUrl"
        />
        <button type="button" class="env-save" :disabled="!switchEnabled" @click="saveCustomUrl">保存</button>
      </div>

      <p class="env-tip">切换后页面会自动刷新，所有数据按新环境重新加载。</p>
    </div>
  </div>
</template>

<style scoped>
.env-mask {
  position: fixed;
  inset: 0;
  z-index: 400;
  background: rgba(15, 30, 26, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: env-fade 0.18s ease-out;
}
@keyframes env-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

.env-panel {
  width: min(460px, 100%);
  background: var(--card, #fff);
  border-radius: 16px;
  padding: 22px 22px 18px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
  box-sizing: border-box;
  animation: env-pop 0.2s ease-out;
}
@keyframes env-pop {
  from { transform: scale(0.96); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.env-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.env-title {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
  color: var(--text, #1a2e2a);
}
.env-close {
  border: none;
  background: transparent;
  font-size: 22px;
  line-height: 1;
  color: var(--text-muted, #8a9490);
  cursor: pointer;
  padding: 4px 8px;
}
.env-close:hover { opacity: 0.7; }

.env-hint {
  margin: 0 0 14px;
  font-size: 13px;
  color: var(--text-muted, #5a726d);
}
.env-hint strong { color: var(--primary, #14665b); }
.env-current-url {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  word-break: break-all;
}

.env-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.env-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid var(--border, #e3e8e6);
  border-radius: 10px;
  background: var(--bg, #faf7f0);
  color: var(--text, #1a2e2a);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: all 0.18s;
}
.env-option:hover { border-color: var(--primary, #14665b); }
.env-option.active {
  border-color: var(--primary, #14665b);
  background: var(--success-bg, #e0f1ec);
}
.env-option.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.env-option.disabled:hover { border-color: var(--border, #e3e8e6); }

/* 已部署站点的锁定提示 */
.env-lock {
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border, #e3e8e6);
  border-radius: 10px;
  background: var(--bg, #faf7f0);
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-muted, #5a726d);
}
.env-option-label {
  font-size: 14px;
  font-weight: 700;
}
.env-option-url {
  font-size: 11px;
  color: var(--text-muted, #5a726d);
  word-break: break-all;
}

.env-custom {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.env-input {
  flex: 1;
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--border, #e3e8e6);
  border-radius: 10px;
  background: var(--bg, #faf7f0);
  color: var(--text, #1a2e2a);
  font-size: 13px;
  box-sizing: border-box;
}
.env-input:focus {
  outline: none;
  border-color: var(--primary, #14665b);
}
.env-save {
  height: 40px;
  padding: 0 16px;
  border: none;
  border-radius: 10px;
  background: var(--primary, #14665b);
  color: #fff;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s;
}
.env-save:hover { opacity: 0.9; }

.env-tip {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--text-muted, #5a726d);
}
</style>

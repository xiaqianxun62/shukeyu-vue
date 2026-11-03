<script setup lang="ts">
import { onMounted, ref } from 'vue'
import SvgIcon from '../components/SvgIcon.vue'
import * as settingsApi from '../api/settings'
import { useAuth } from '../composables/useAuth'

/** 页脚文案设置页：#/footer，仅 settings:manage 权限可编辑 */
const emit = defineEmits<{
  back: []
}>()

const { isLoggedIn, has, restore } = useAuth()

const footerText = ref('')
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const success = ref('')

async function load(): Promise<void> {
  loading.value = true
  try {
    const data = await settingsApi.getFooter()
    footerText.value = data.text ?? ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

async function handleSave(): Promise<void> {
  error.value = ''
  success.value = ''
  saving.value = true
  try {
    const saved = await settingsApi.updateFooter({ text: footerText.value.trim() || undefined })
    footerText.value = saved.text ?? footerText.value
    success.value = '已保存，小程序 & 官网底部会展示新文案'
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  if (!isLoggedIn.value) await restore()
  if (!has('settings:manage')) {
    error.value = '仅持 settings:manage 权限者可访问此页面'
    return
  }
  await load()
})
</script>

<template>
  <div class="footer-page">
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
          <template v-if="isLoggedIn && has('settings:manage')">
            <h1 class="title">页脚文案</h1>
            <p class="subtitle">
              小程序底部 & PC 官网底部共用此文案。留空使用默认。
            </p>

            <p v-if="loading" class="hint">加载当前文案中…</p>
            <template v-else>
              <div class="field">
                <span class="label">页脚文字</span>
                <input
                  v-model="footerText"
                  class="input"
                  type="text"
                  placeholder="如：by 2026@千巽"
                  maxlength="60"
                />
              </div>

              <div class="preview">
                <div class="preview-label">效果预览</div>
                <div class="preview-box">
                  <span class="preview-text">{{ footerText || '© ' + new Date().getFullYear() + ' ·  千巽' }}</span>
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
          </template>

          <template v-else>
            <h1 class="title">没有权限</h1>
            <p class="subtitle">{{ error || '仅持 settings:manage 权限者可访问此页面' }}</p>
            <button class="primary-btn" type="button" @click="emit('back')">返回</button>
          </template>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.footer-page { min-height: 100vh; background: var(--bg); }
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
.preview { margin: 18px 0; }
.preview-label {
  font-size: 12px; color: var(--text-muted);
  margin-bottom: 8px; font-weight: 600;
}
.preview-box {
  background: var(--bg); border: 1px dashed var(--border);
  border-radius: 10px; padding: 20px;
  text-align: center;
}
.preview-text { font-size: 12px; color: var(--text-muted); }
.hint { color: var(--text-muted); font-size: 13px; }
.msg { margin: 6px 0; font-size: 13px; }
.msg.error { color: var(--danger); }
.msg.success { color: var(--success); }
.actions { display: flex; gap: 10px; margin-top: 16px; }
.primary-btn {
  flex: 1; height: 40px; padding: 0 20px;
  border: none; border-radius: 10px; cursor: pointer;
  background: var(--primary); color: var(--primary-foreground);
  font-size: 14px; font-weight: 700;
  transition: opacity .2s;
}
.primary-btn:disabled { opacity: .6; cursor: not-allowed; }
.ghost-btn {
  height: 40px; padding: 0 20px;
  border: 1px solid var(--border); border-radius: 10px; cursor: pointer;
  background: transparent; color: var(--text); font-size: 14px;
}

@media (max-width: 640px) {
  .page-bar { padding: 0 14px; }
  .brand span { display: none; }
  .page-main { padding: 16px 14px 40px; }
  .panel-card { padding: 16px; border-radius: 14px; }
  .title { font-size: 18px; }
  .actions { flex-direction: column-reverse; }
  .actions .primary-btn,
  .actions .ghost-btn { width: 100%; }
}
</style>

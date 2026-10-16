<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import SvgIcon from '../components/SvgIcon.vue'
import * as settingsApi from '../api/settings'
import { useAuth } from '../composables/useAuth'

/** 站点可配置文案设置页：#/settings，登录即可编辑 */
const emit = defineEmits<{
  back: []
}>()

const { isLoggedIn, isAdmin, restore } = useAuth()

interface PoemForm {
  line1: string
  line2: string
  source: string
}

const form = reactive<PoemForm>({
  line1: '',
  line2: '',
  source: '',
})
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const success = ref('')

async function load(): Promise<void> {
  loading.value = true
  try {
    const data = await settingsApi.getHomePoem()
    form.line1 = data.line1 ?? ''
    form.line2 = data.line2 ?? ''
    form.source = data.source ?? ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function resetDefaults(): void {
  form.line1 = '无言独上西楼，月如钩，'
  form.line2 = '寂寞梧桐深院锁清秋。'
  form.source = '—— 五代 · 李煜《相见欢》'
  success.value = ''
  error.value = ''
}

async function handleSave(): Promise<void> {
  if (!isLoggedIn.value) {
    window.location.hash = '#/login'
    return
  }
  if (!isAdmin.value) {
    error.value = '仅管理员可修改站点文案'
    return
  }
  error.value = ''
  success.value = ''
  if (!form.line1.trim() && !form.line2.trim()) {
    error.value = '至少填写一句诗句'
    return
  }
  saving.value = true
  try {
    await settingsApi.updateHomePoem({
      line1: form.line1.trim(),
      line2: form.line2.trim(),
      source: form.source.trim(),
    })
    success.value = '已保存，小程序首页下拉刷新即可看到新文案'
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
            <h1 class="title">站点文案 · 首页诗句</h1>
            <p class="subtitle">
              修改后，小程序首页会展示你写的诗句。下拉刷新即可生效。
            </p>

            <p v-if="loading" class="hint">加载当前文案中…</p>
            <template v-else>
              <div class="field">
                <span class="label">第一句</span>
                <input v-model="form.line1" class="input" type="text" placeholder="如：大江东去，浪淘尽，" />
              </div>

              <div class="field">
                <span class="label">第二句</span>
                <input v-model="form.line2" class="input" type="text" placeholder="如：千古风流人物。" />
              </div>

              <div class="field">
                <span class="label">署名 / 出处</span>
                <input
                  v-model="form.source"
                  class="input"
                  type="text"
                  placeholder="如：—— 宋 · 苏轼《念奴娇·赤壁怀古》"
                />
              </div>

              <div class="preview">
                <div class="preview-label">小程序首页预览</div>
                <div class="preview-box">
                  <span class="qm">"</span>
                  <div class="p-body">
                    <span class="p-line">{{ form.line1 || '第一句' }}</span>
                    <span class="p-line">{{ form.line2 || '第二句' }}<span class="qm">"</span></span>
                    <span class="src">{{ form.source || '—— 署名 / 出处' }}</span>
                  </div>
                </div>
              </div>

              <p v-if="error" class="msg error">{{ error }}</p>
              <p v-if="success" class="msg success">{{ success }}</p>

              <div class="actions">
                <button class="primary-btn" type="button" :disabled="saving" @click="handleSave">
                  {{ saving ? '保存中…' : '保存' }}
                </button>
                <button class="ghost-btn" type="button" :disabled="saving" @click="resetDefaults">
                  恢复默认
                </button>
                <button class="ghost-btn" type="button" @click="emit('back')">返回</button>
              </div>
            </template>
          </template>

          <template v-else>
            <h1 class="title">还没有登录</h1>
            <p class="subtitle">登录后即可修改站点首页展示文案</p>
            <button class="primary-btn" type="button" @click="emit('back')">去登录</button>
          </template>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
/* 布局复用 ProfilePage */
.profile-page { min-height: 100vh; background: var(--bg); }
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

.hint { color: var(--text-muted); font-size: 13px; }

/* 预览区：模拟小程序首页书法字体效果 */
.preview { margin: 10px 0 16px; }
.preview-label { font-size: 12px; color: var(--text-muted); margin-bottom: 8px; }
.preview-box {
  padding: 14px 16px;
  background: var(--bg); border: 1px dashed var(--border);
  border-radius: 10px;
  display: flex; gap: 8px; align-items: flex-start;
}
.qm {
  font-family: "Songti SC", "Noto Serif SC", serif;
  font-size: 22px; line-height: 1; color: var(--primary); font-weight: 700;
}
.p-body { flex: 1; }
.p-line {
  display: block;
  font-family: "Songti SC", "Noto Serif SC", serif;
  font-style: italic; font-size: 15px; line-height: 1.5;
  color: var(--text); letter-spacing: 2px;
}
.src {
  display: block; margin-top: 4px;
  font-family: "Songti SC", "Noto Serif SC", serif;
  font-size: 12px; color: var(--text-muted); letter-spacing: 1px;
}

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
.ghost-btn:disabled { opacity: .6; cursor: not-allowed; }
</style>

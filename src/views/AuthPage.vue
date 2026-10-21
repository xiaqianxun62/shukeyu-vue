<script setup lang="ts">
import AuthForm from '../components/AuthForm.vue'
import SvgIcon from '../components/SvgIcon.vue'
import { useAuth } from '../composables/useAuth'

/** 独立登录 / 注册页：#/login、#/register */
const props = withDefaults(
  defineProps<{
    tab?: 'login' | 'register'
  }>(),
  { tab: 'login' },
)

const emit = defineEmits<{
  back: []
  /** 已登录后点击「在微信小程序中打开」 */
  openMini: []
}>()

const { user, logout } = useAuth()

const HIGHLIGHTS = [
  { title: '匿名报名', desc: '不用加群、不用接龙，一键报上球局' },
  { title: '自动编排', desc: '按报名性别构成自动出 6 套方案' },
  { title: 'ELO 积分', desc: '每场对局自动结算，榜单实时更新' },
]

async function handleLogout(): Promise<void> {
  await logout()
}
</script>

<template>
  <div class="auth-page">
    <header class="page-bar">
      <a class="brand" href="#hero" @click.prevent="emit('back')">
        <SvgIcon type="logo" :size="22" class="brand-icon" />
        <span>数科羽 shukeyu</span>
      </a>
      <a class="back-link" href="#hero" @click.prevent="emit('back')">返回官网</a>
    </header>

    <main class="page-main">
      <section class="promo">
        <p class="promo-tag">校园羽毛球系统</p>
        <!--<h1 class="promo-title">约球这件事，<br />一次报名就够了。</h1>
        <p class="promo-desc">
          注册账号后即可发布球局、匿名报名、查看 ELO 积分榜。
        </p>-->
        <ul class="promo-list">
          <li v-for="item in HIGHLIGHTS" :key="item.title">
            <strong>{{ item.title }}</strong>
            <span>{{ item.desc }}</span>
          </li>
        </ul>
      </section>

      <section class="panel">
        <div class="panel-card">
          <!-- 已登录：个人信息 -->
          <template v-if="user">
            <div class="profile-head">
              <div class="profile-avatar">{{ user.name.charAt(0) }}</div>
              <div class="profile-name">{{ user.name }}</div>
              <div v-if="user.account" class="profile-meta">账号 {{ user.account }}</div>
            </div>
            <div class="profile-stats">
              <div class="stat">
                <strong>{{ user.rating }}</strong>
                <span>ELO 积分</span>
              </div>
              <div class="stat">
                <strong>{{ user.gamesPlayed }}</strong>
                <span>历史场次</span>
              </div>
            </div>
            <!-- 分类 ELO 明细：单打 / 双打(同性别) / 混双 -->
            <div class="cat-stats">
              <div class="cat-row">
                <span class="cat-name">单打</span>
                <strong class="cat-rating">{{ user.ratingSingles ?? user.rating ?? 1200 }}</strong>
                <span class="cat-record">{{ user.singlesWin ?? 0 }}胜 {{ user.singlesLoss ?? 0 }}负</span>
              </div>
              <div class="cat-row">
                <span class="cat-name">双打</span>
                <strong class="cat-rating">{{ user.ratingDoubles ?? user.rating ?? 1200 }}</strong>
                <span class="cat-record">{{ user.doublesWin ?? 0 }}胜 {{ user.doublesLoss ?? 0 }}负</span>
              </div>
              <div class="cat-row">
                <span class="cat-name">混双</span>
                <strong class="cat-rating">{{ user.ratingMixed ?? user.rating ?? 1200 }}</strong>
                <span class="cat-record">{{ user.mixedWin ?? 0 }}胜 {{ user.mixedLoss ?? 0 }}负</span>
              </div>
            </div>
            <div class="profile-actions">
              <button class="primary-btn" type="button" @click="emit('back')">
                进入管理页面
              </button>
              <button class="ghost-btn" type="button" @click="handleLogout">退出登录</button>
            </div>
          </template>

          <!-- 未登录：登录 / 注册 -->
          <AuthForm v-else :initial-tab="props.tab" />
        </div>
        <p class="panel-foot">继续即表示同意《用户协议》与《隐私政策》</p>
      </section>
    </main>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(1200px 400px at 12% -10%, var(--success-bg), transparent 60%),
    var(--bg);
}

/* 顶栏 */
.page-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  padding: 0 24px;
  border-bottom: 1px solid var(--border-light);
  background: var(--card);
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--primary);
  font-size: 16px;
  font-weight: 800;
  text-decoration: none;
}
.brand-icon {
  color: var(--primary);
}
.back-link {
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: color 0.2s;
}
.back-link:hover {
  color: var(--primary);
}

/* 主体：左宣传 + 右表单 */
.page-main {
  flex: 1;
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 48px;
  align-items: center;
  max-width: 1040px;
  width: 100%;
  margin: 0 auto;
  padding: 48px 24px 64px;
}

.promo-tag {
  display: inline-block;
  padding: 5px 12px;
  margin-bottom: 18px;
  border-radius: 999px;
  background: var(--success-bg);
  color: var(--primary);
  font-size: 12px;
  font-weight: 700;
}
.promo-title {
  font-size: 34px;
  line-height: 1.35;
  font-weight: 800;
  color: var(--text);
  margin-bottom: 14px;
}
.promo-desc {
  font-size: 15px;
  line-height: 1.8;
  color: var(--text-muted);
  margin-bottom: 28px;
}
.promo-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.promo-list li {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding-left: 14px;
  border-left: 3px solid var(--primary-light);
}
.promo-list strong {
  flex-shrink: 0;
  font-size: 14px;
  color: var(--primary);
}
.promo-list span {
  font-size: 13px;
  color: var(--text-muted);
}

.panel {
  width: 100%;
  max-width: 400px;
  margin-left: auto;
}
.panel-card {
  padding: 28px 26px 26px;
  border: 1px solid var(--border-light);
  border-radius: 20px;
  background: var(--card);
  box-shadow: 0 16px 40px rgba(11, 58, 51, 0.12);
}
.panel-foot {
  margin-top: 14px;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
}

/* 已登录态 */
.profile-head {
  text-align: center;
  padding-top: 6px;
}
.profile-avatar {
  width: 64px;
  height: 64px;
  margin: 0 auto 12px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary);
  color: var(--bg);
  font-size: 26px;
  font-weight: 700;
}
.profile-name {
  font-size: 18px;
  font-weight: 800;
  color: var(--text);
}
.profile-meta {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 2px;
}
.profile-stats {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}
/* 分类 ELO 明细：单打 / 双打 / 混双 */
.cat-stats {
  margin-top: 10px;
  border: 1px solid var(--border-light);
  border-radius: 14px;
  background: var(--bg);
  overflow: hidden;
}
.cat-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
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
.stat {
  flex: 1;
  padding: 14px 10px;
  border: 1px solid var(--border-light);
  border-radius: 14px;
  background: var(--bg);
  text-align: center;
}
.stat strong {
  display: block;
  font-size: 20px;
  font-weight: 800;
  color: var(--primary);
  font-variant-numeric: tabular-nums;
}
.stat span {
  font-size: 12px;
  color: var(--text-muted);
}
.profile-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 20px;
}
.primary-btn {
  height: 46px;
  border: none;
  border-radius: 12px;
  background: var(--accent);
  color: var(--text);
  font-family: inherit;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s;
}
.primary-btn:hover {
  background: var(--accent-dark);
}
.ghost-btn {
  height: 42px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--card);
  color: var(--text-muted);
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.ghost-btn:hover {
  background: var(--bg);
  color: var(--text);
}

@media (max-width: 900px) {
  .page-main {
    grid-template-columns: 1fr;
    gap: 32px;
    padding: 32px 20px 48px;
  }
  .promo {
    text-align: center;
  }
  .promo-list {
    display: none;
  }
  .panel {
    margin: 0 auto;
  }
  .promo-title {
    font-size: 26px;
  }
}
</style>

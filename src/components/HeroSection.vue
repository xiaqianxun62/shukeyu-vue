<script setup lang="ts">
const emit = defineEmits<{
  /** 「立即加入」→ App 层进入登录页 */
  cta: []
}>()

function scrollTo(id: string) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <section id="hero" class="section hero">
    <div class="container">
      <div class="hero-banner">
        <!-- 球场线条装饰 -->
          <svg class="hero-court" viewBox="-40 -20 650 540" preserveAspectRatio="xMidYMid slice" role="img" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5"
      markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke"
        stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
  </defs>
  <rect x="85" y="130" width="509.2" height="231.8" fill="#1D9E75" stroke="#FFFFFF" stroke-width="3"/>

  <g stroke="#FFFFFF" stroke-width="3">
    <line x1="85" y1="147.48" x2="594.2" y2="147.48"/>
    <line x1="85" y1="344.32" x2="594.2" y2="344.32"/>
    <line x1="264.36" y1="130" x2="264.36" y2="361.8"/>
    <line x1="414.84" y1="130" x2="414.84" y2="361.8"/>
    <line x1="113.88" y1="130" x2="113.88" y2="361.8"/>
    <line x1="565.32" y1="130" x2="565.32" y2="361.8"/>
    <line x1="85" y1="245.9" x2="264.36" y2="245.9"/>
    <line x1="414.84" y1="245.9" x2="594.2" y2="245.9"/>
  </g>

  <rect x="336" y="118" width="7" height="266" fill="#2C2C2A"/>
  <circle cx="339.5" cy="119" r="4" fill="#2C2C2A"/>
  <circle cx="339.5" cy="383" r="4" fill="#2C2C2A"/>

  <g font-size="11" fill="#FFFFFF" text-anchor="middle">
    <text x="480" y="338">单打边线</text>
    <text x="480" y="259">中线</text>
    <text x="480" y="123">双打底线</text>
  </g>

  <g stroke="#888780" stroke-width="0.5" stroke-dasharray="3 3" fill="none">
    <line x1="200" y1="118" x2="262" y2="132"/>
    <line x1="339.5" y1="106" x2="339.5" y2="116"/>
    <line x1="565" y1="118" x2="565" y2="128"/>
  </g>
     </svg>


        <div class="hero-content">
          <h1 class="hero-title">
            让每一个羽毛球爱好者<br />
            都能打上<span style="color: var(--accent)">势均力敌</span>的球局
          </h1>
          <p class="hero-subtitle">
            约球 · ELO 积分 · 自动轮转引擎 · 到场即开打
          </p>
          <div class="hero-buttons">
            <button class="btn-primary" type="button" @click="emit('cta')">
              立即加入
            </button>
            <button class="btn-secondary" type="button" @click="scrollTo('dashboard')">
              查看数据
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

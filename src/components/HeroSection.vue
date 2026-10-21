<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * 球场装饰图随断点切换视图：
 * - 窄屏（<540px）：全宽 slice，铺满整条横幅；
 * - 桌面（≥540px）：只截取右半场（网柱 + 右半场地 + 标注），meet 等比缩放，
 *   配合 .hero-content 蒙板盖住左半区，右侧正好露出完整的半个球场（不再被 slice 裁掉顶线）。
 *
 * 注意：viewBox / preserveAspectRatio 不能用 v-bind 动态绑定——Vue 会把它们当 DOM prop
 * 赋给只读的 SVGAnimatedRect / SVGAnimatedPreserveAspectRatio 而静默失败，
 * 因此这里用 ref + setAttribute 手动切换（SVG 命名空间下大小写会被保留）。
 */
const NARROW_QUERY = '(max-width: 539px)'

const NARROW_VIEW = { viewBox: '-40 -20 650 540', par: 'xMidYMid slice' }
const DESKTOP_VIEW = { viewBox: '330 105 285 285', par: 'xMidYMid meet' }

/** 初始值直接按当前视口求值：首帧就用正确的视图，避免先按窄屏渲染再切换 */
const isNarrow = ref(
  typeof window === 'undefined' ? true : window.matchMedia(NARROW_QUERY).matches,
)

const svgRef = ref<SVGSVGElement | null>(null)
let mql: MediaQueryList | null = null

/** 按当前断点写入 SVG 视图属性 */
function applyView(): void {
  const el = svgRef.value
  if (!el) return
  const v = isNarrow.value ? NARROW_VIEW : DESKTOP_VIEW
  el.setAttribute('viewBox', v.viewBox)
  el.setAttribute('preserveAspectRatio', v.par)
}

onMounted(() => {
  mql = window.matchMedia(NARROW_QUERY)
  isNarrow.value = mql.matches
  mql.addEventListener('change', syncWidth)
  applyView()
})

function syncWidth(e: MediaQueryListEvent): void {
  isNarrow.value = e.matches
}

watch(isNarrow, applyView)

onBeforeUnmount(() => {
  mql?.removeEventListener('change', syncWidth)
})
</script>

<template>
  <section id="hero" class="section hero">
    <div class="container">
      <div class="hero-banner">
        <!-- 球场线条装饰 -->
          <svg
            ref="svgRef"
            class="hero-court"
            viewBox="-40 -20 650 540"
            preserveAspectRatio="xMidYMid slice"
            role="img"
            xmlns="http://www.w3.org/2000/svg"
          >
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
            拳打<span style="color: var(--accent);font-size:42px">小冯<br /></span>
            脚踢<span style="color: var(--accent);font-size:42px">广森<br/></span>
            <span style="font-size:22px;display: block;text-align: right;">--奶娃<br/></span>
          </h1>
          <p class="hero-subtitle">
            ELO 积分 · 轮转引擎
          </p>
          <!--<div class="hero-buttons">
            <button class="btn-primary" type="button" @click="emit('cta')">
              立即加入
            </button>
            <button class="btn-secondary" type="button" @click="scrollTo('dashboard')">
              查看数据
            </button>
          </div>-->
        </div>
      </div>
    </div>
  </section>
</template>

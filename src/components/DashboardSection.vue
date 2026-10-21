<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fetchOverview, type StatsOverview } from '../api/stats'

/**
 * 数据概览看板：总量指标卡 + 近 7 日场次柱状图 + ELO 分布。
 * 公开聚合数据（不含个人信息），接口失败时整块显示占位，不影响首页其他区块。
 */
const data = ref<StatsOverview | null>(null)
const failed = ref(false)

const totals = computed(() => [
  { key: 'users', label: '注册球友', value: data.value?.totalUsers },
  { key: 'games', label: '累计球局', value: data.value?.totalGames },
  { key: 'matches', label: '累计对局', value: data.value?.totalMatches },
  { key: 'regs', label: '报名人次', value: data.value?.totalRegistrations },
])

/** 近 7 日柱高（按最大值归一，最小保底 4% 便于看到 0 值附近的柱） */
const dayMax = computed(() =>
  Math.max(1, ...(data.value?.last7Days ?? []).map((d) => d.count)),
)

function barHeight(count: number): string {
  if (count <= 0) return '4%'
  return `${Math.max(8, Math.round((count / dayMax.value) * 100))}%`
}

/** ELO 分布条宽（按最大段归一） */
const bucketMax = computed(() =>
  Math.max(1, ...(data.value?.ratingBuckets ?? []).map((b) => b.count)),
)

function bucketWidth(count: number): string {
  if (count <= 0) return '0%'
  return `${Math.max(3, Math.round((count / bucketMax.value) * 100))}%`
}

const bucketTotal = computed(() =>
  (data.value?.ratingBuckets ?? []).reduce((s, b) => s + b.count, 0),
)

function bucketPct(count: number): string {
  if (!bucketTotal.value) return '0%'
  return `${Math.round((count / bucketTotal.value) * 100)}%`
}

function fmt(v: number | undefined | null): string {
  if (v == null) return '—'
  return v.toLocaleString('zh-CN')
}

onMounted(async () => {
  try {
    data.value = await fetchOverview()
  } catch {
    failed.value = true
  }
})
</script>

<template>
  <section id="dashboard" class="section">
    <div class="container">
      <div class="section-header">
        <h2 class="section-title">数据概览</h2>
        <p class="section-desc">平台运营数据实时汇总 · 公开聚合统计</p>
      </div>

      <!-- 总量指标卡 -->
      <div class="stat-grid">
        <div v-for="t in totals" :key="t.key" class="stat-card">
          <div class="stat-num">{{ fmt(t.value) }}</div>
          <div class="stat-label">{{ t.label }}</div>
        </div>
      </div>

      <p v-if="failed" class="dash-error">数据加载失败，请稍后刷新重试</p>

      <template v-else-if="data">
        <!-- 图表区：近 7 日场次 + ELO 分布 -->
        <div class="charts">
          <div class="chart-card">
            <div class="chart-title">近 7 日场次</div>
            <div class="bars">
              <div v-for="d in data.last7Days" :key="d.date" class="bar-col">
                <span class="bar-val">{{ d.count }}</span>
                <div class="bar-track">
                  <div class="bar" :style="{ height: barHeight(d.count) }" />
                </div>
                <span class="bar-label">{{ d.date }}</span>
              </div>
            </div>
          </div>

          <div class="chart-card">
            <div class="chart-title">ELO 分布</div>
            <div class="dist">
              <div v-for="b in data.ratingBuckets" :key="b.label" class="dist-row">
                <span class="dist-label">{{ b.label }}</span>
                <div class="dist-track">
                  <div class="dist-fill" :style="{ width: bucketWidth(b.count) }" />
                </div>
                <span class="dist-meta">{{ b.count }} 人 · {{ bucketPct(b.count) }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
/* 指标卡 */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 18px;
}
.stat-card {
  padding: 20px 16px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--card);
  text-align: center;
  box-shadow: var(--shadow-sm, 0 2px 8px rgba(20, 102, 91, 0.06));
}
.stat-num {
  font-size: 30px;
  font-weight: 800;
  color: var(--primary);
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}
.stat-label {
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-muted);
}

.dash-error {
  text-align: center;
  color: var(--danger, #b33a2e);
  font-size: 14px;
  padding: 24px 0;
}

/* 图表区两列 */
.charts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.chart-card {
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--card);
  box-shadow: var(--shadow-sm, 0 2px 8px rgba(20, 102, 91, 0.06));
}
.chart-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 16px;
}

/* 近 7 日柱状图 */
.bars {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  height: 180px;
}
.bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}
.bar-val {
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  margin-bottom: 4px;
}
.bar-track {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.bar {
  width: 60%;
  max-width: 34px;
  min-height: 4px;
  background: var(--primary);
  border-radius: 6px 6px 0 0;
  transition: height 0.4s ease;
}
.bar-label {
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}

/* ELO 分布条形 */
.dist {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.dist-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.dist-label {
  width: 84px;
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.dist-track {
  flex: 1;
  height: 14px;
  background: var(--bg);
  border: 1px solid var(--border-light);
  border-radius: 999px;
  overflow: hidden;
}
.dist-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), var(--accent, #e5c84b));
  border-radius: 999px;
  transition: width 0.4s ease;
}
.dist-meta {
  width: 96px;
  font-size: 12px;
  color: var(--text-muted);
  text-align: right;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

@media (max-width: 860px) {
  .stat-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .charts {
    grid-template-columns: 1fr;
  }
}
</style>

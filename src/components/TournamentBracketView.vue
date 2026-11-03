<!-- 赛事对阵图：小组积分榜 + 淘汰赛逐轮 + 最终名次 -->
<!-- 真实对阵图与模拟赛程共用本组件（后端返回结构一致），避免两套渲染逻辑各写一遍 -->
<script setup lang="ts">
import type { TournamentBracket } from '../api/tournament'
import TournamentBracketTree from './TournamentBracketTree.vue'

const props = defineProps<{
  bracket: TournamentBracket | null
  /** 模拟模式：顶部加一条醒目的「不落库」提示 */
  simulated?: boolean
}>()
</script>

<template>
  <div class="bracket-view">
    <div v-if="props.simulated" class="sim-banner">
      模拟预览 · 数据随机生成且不写入数据库，仅用于确认赛程结构
    </div>

    <div v-if="!props.bracket || props.bracket.formats.length === 0" class="empty">暂无赛程</div>

    <div v-for="f in props.bracket?.formats ?? []" :key="f.format" class="group-block">
      <h3 class="sub-title">{{ f.formatName }}组</h3>

      <!-- 小组积分榜 -->
      <template v-if="f.groups.length">
        <h4 class="round-title">小组赛积分榜</h4>
        <div class="group-grid">
          <div v-for="g in f.groups" :key="g.groupId" class="group-card">
            <div class="group-card-head">
              <strong>{{ g.groupNo }} 组</strong>
              <span class="sub">{{ g.entryCount }} 队</span>
            </div>
            <table class="table tiny">
              <thead>
                <tr>
                  <th>队伍</th>
                  <th>胜</th>
                  <th>负</th>
                  <th>净胜</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in g.standings" :key="s.entryId">
                  <td class="name-cell" data-label="队伍">
                    <span class="rank-dot" :class="{ top: s.rank === 1 }">{{ s.rank }}</span>
                    {{ s.name }}
                    <span v-if="s.advance" class="tag ok">晋级</span>
                  </td>
                  <td class="sub" data-label="胜">{{ s.win }}</td>
                  <td class="sub" data-label="负">{{ s.loss }}</td>
                  <td class="sub" data-label="净胜">{{ s.pointDiff > 0 ? '+' : '' }}{{ s.pointDiff }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>

      <!-- 淘汰赛逐轮（树形） -->
      <template v-if="f.knockouts.length">
        <h4 class="round-title">淘汰赛赛程树</h4>
        <TournamentBracketTree :rounds="f.knockouts" />
      </template>

      <!-- 最终名次 -->
      <template v-if="f.ranking.length">
        <h4 class="round-title">最终名次</h4>
        <table class="table compact">
          <thead>
            <tr>
              <th>名次</th>
              <th>队伍</th>
              <th>小组</th>
              <th>止步</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in f.ranking" :key="r.entryId">
              <td class="name-cell" data-label="名次">{{ r.rank }}</td>
              <td class="name-cell" data-label="队伍">{{ r.name }}</td>
              <td class="sub" data-label="小组">{{ r.groupNo || '—' }}</td>
              <td class="sub" data-label="止步">{{ r.eliminatedText || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </template>
    </div>
  </div>
</template>

<style scoped>
.bracket-view { display: flex; flex-direction: column; gap: 14px; }
.sim-banner {
  padding: 9px 14px; border-radius: 8px; font-size: 12px;
  background: #fdf6e3; color: #7a4f1b; border: 1px solid #f0dfae;
}
.empty { padding: 32px; text-align: center; color: #5a726d; }
.group-block { display: flex; flex-direction: column; gap: 8px; }
.sub-title { font-size: 14px; font-weight: 700; color: #1a2e2a; margin: 6px 0 0; }
.round-title { font-size: 13px; font-weight: 600; color: #5a726d; margin: 4px 0 0; }

.table { width: 100%; border-collapse: separate; border-spacing: 0; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(20,102,91,.08); }
.table th, .table td { padding: 10px 12px; border-bottom: 1px solid #f0efea; font-size: 13px; text-align: left; vertical-align: middle; }
.table thead th { background: #f1f5f3; color: #5a726d; font-weight: 600; font-size: 12px; }
.table tbody tr:last-child td { border-bottom: none; }
.table.compact { box-shadow: none; border: 1px solid #f0efea; }
.table.tiny th, .table.tiny td { padding: 6px 8px; font-size: 12px; }
.name-cell { font-weight: 600; color: #1a2e2a; }
.sub { color: #5a726d; font-size: 12px; font-weight: 400; }
.tag { font-size: 11px; padding: 2px 8px; border-radius: 4px; display: inline-block; background: #f0efea; color: #5a726d; }
.tag.ok { background: #e0f1ec; color: #14665b; }

.group-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.group-card { border: 1px solid #f0efea; border-radius: 10px; overflow: hidden; }
.group-card-head { display: flex; justify-content: space-between; padding: 8px 12px; background: #f1f5f3; font-size: 13px; }
.rank-dot { display: inline-block; min-width: 18px; height: 18px; line-height: 18px; text-align: center; border-radius: 50%; background: #f0efea; color: #5a726d; font-size: 11px; margin-right: 6px; }
.rank-dot.top { background: #14665b; color: #fff; }

@media (max-width: 640px) {
  .table thead { display: none; }
  .table, .table tbody, .table tr, .table td { display: block; width: 100%; }
  .table { background: transparent; box-shadow: none; border-radius: 0; }
  .table tbody { display: flex; flex-direction: column; gap: 10px; }
  .table tr { background: #fff; border-radius: 12px; padding: 4px 0; box-shadow: 0 2px 8px rgba(20,102,91,.08); }
  .table td { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 14px; border-bottom: 1px solid #f4f1ea; font-size: 13px; }
  .table td:last-child { border-bottom: none; }
  .table td::before { content: attr(data-label); color: #5a726d; font-size: 12px; font-weight: 600; flex-shrink: 0; }
  .table td.name-cell::before { display: none; }
  .table td.name-cell { justify-content: flex-start; }
  .group-grid { grid-template-columns: 1fr; }
}
</style>

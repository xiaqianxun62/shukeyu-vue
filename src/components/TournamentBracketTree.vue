<!-- 树形对阵图（bracket）：淘汰赛逐轮收敛成二叉树，季军赛 / 决赛从四强分叉 -->
<!-- 数据依赖后端返回的 childMatchIds——轮次之间是随机配对的，没法从签表静态推出来 -->
<script setup lang="ts">
import { computed } from 'vue'
import type { TournamentMatch, TournamentRoundBoard } from '../api/tournament'

const props = defineProps<{
  rounds: TournamentRoundBoard[]
}>()

/* ---------- 几何常量 ---------- */
const BOX_W = 158
const BOX_H = 52
/** 列宽 = 盒宽 + 列间留白；留白要放得下折线的竖直段 */
const COL_W = 236
const LEAF_GAP = 66
const PAD = { top: 30, right: 18, bottom: 26, left: 14 }
/** 折线转折点距父盒左边缘的距离（必须落在列间留白里） */
const BEND = 40

interface Node {
  match: TournamentMatch
  x: number
  y: number
  depth: number
  children: Node[]
  isBronze: boolean
}

interface Layout {
  nodes: Node[]
  links: { d: string; dashed: boolean }[]
  width: number
  height: number
  columns: { x: number; label: string }[]
}

const layout = computed<Layout | null>(() => {
  const rounds = props.rounds ?? []
  const ko = rounds
    .filter((r) => r.roundNo > 0)
    .sort((a, b) => a.roundNo - b.roundNo)
  const finals = rounds.filter((r) => r.roundNo === 0)
  if (ko.length === 0) return null

  const nodes = new Map<number, Node>()
  const ordered: Node[] = []

  // 1) 建立节点（淘汰赛各轮）
  ko.forEach((r, ri) => {
    r.matches.forEach((m) => {
      const node: Node = {
        match: m,
        x: PAD.left + ri * COL_W,
        y: 0,
        depth: ri,
        children: [],
        isBronze: false,
      }
      nodes.set(m.id, node)
      ordered.push(node)
    })
  })

  // 2) 父子关系（后端给的 childMatchIds）
  ko.forEach((r) => {
    r.matches.forEach((m) => {
      const node = nodes.get(m.id)
      if (!node) return
      for (const cid of m.childMatchIds ?? []) {
        const child = nodes.get(cid)
        if (child && !node.children.includes(child)) node.children.push(child)
      }
    })
  })

  // 3) 纵坐标：首轮按序铺开，后续轮取子树汇聚点（越往右越收敛）
  ko[0].matches.forEach((m, i) => {
    const node = nodes.get(m.id)
    if (node) node.y = PAD.top + i * LEAF_GAP
  })
  for (let r = 1; r < ko.length; r++) {
    ko[r].matches.forEach((m) => {
      const node = nodes.get(m.id)
      if (!node) return
      if (node.children.length > 0) {
        const sum = node.children.reduce((s, c) => s + c.y, 0)
        node.y = sum / node.children.length
      } else {
        // 没有来源（理论上不该出现）：退化成上一列同序号的纵坐标
        const fallback = ko[r - 1].matches[m.matchNo - 1]
        const fb = fallback ? nodes.get(fallback.id) : null
        node.y = fb ? fb.y : PAD.top
      }
    })
  }

  // 4) 收官战：决赛是树的根，季军赛挂在它下方（两者都从四强分叉）
  const finalRound = finals.find((r) => r.roundName === '决赛')
  const bronzeRound = finals.find((r) => r.roundName === '季军赛')
  const lastKo = ko[ko.length - 1]
  const koTeamToNode = new Map<number, Node>()
  lastKo.matches.forEach((m) => {
    const node = nodes.get(m.id)
    if (!node) return
    if (m.teamA?.entryId != null) koTeamToNode.set(m.teamA.entryId, node)
    if (m.teamB?.entryId != null) koTeamToNode.set(m.teamB.entryId, node)
  })

  const finalCol = ko.length
  let finalY = 0
  if (finalRound) {
    finalRound.matches.forEach((m) => {
      const node: Node = {
        match: m,
        x: PAD.left + finalCol * COL_W,
        y: 0,
        depth: finalCol,
        children: [],
        isBronze: false,
      }
      for (const cid of m.childMatchIds ?? []) {
        const child = nodes.get(cid)
        if (child && !node.children.includes(child)) node.children.push(child)
      }
      if (node.children.length > 0) {
        const sum = node.children.reduce((s, c) => s + c.y, 0)
        node.y = sum / node.children.length
      }
      finalY = node.y
      nodes.set(m.id, node)
      ordered.push(node)
    })
  }
  if (bronzeRound) {
    bronzeRound.matches.forEach((m) => {
      const node: Node = {
        match: m,
        x: PAD.left + finalCol * COL_W,
        y: finalY + BOX_H * 2.1,
        depth: finalCol,
        children: [],
        isBronze: true,
      }
      for (const cid of m.childMatchIds ?? []) {
        const child = nodes.get(cid)
        if (child && !node.children.includes(child)) node.children.push(child)
      }
      nodes.set(m.id, node)
      ordered.push(node)
    })
  }

  // 5) 连线：子节点右边缘 → 折线 → 父节点左侧输入槽
  const links: { d: string; dashed: boolean }[] = []
  for (const node of ordered) {
    if (node.children.length === 0) continue
    const parentLeft = node.x
    const midX = parentLeft - BEND
    node.children.forEach((child, idx) => {
      const targetY = node.y + (idx === 0 ? -BOX_H / 4 : BOX_H / 4)
      const fromX = child.x + BOX_W
      const d = `M ${fromX} ${child.y} H ${midX} V ${targetY} H ${parentLeft}`
      links.push({ d, dashed: node.isBronze })
    })
  }

  const maxX = Math.max(...ordered.map((n) => n.x + BOX_W))
  const maxY = Math.max(...ordered.map((n) => n.y + BOX_H))
  const columns = ko.map((r, ri) => ({
    x: PAD.left + ri * COL_W + BOX_W / 2,
    label: r.roundName,
  }))
  if (finalRound) {
    columns.push({ x: PAD.left + finalCol * COL_W + BOX_W / 2, label: '决赛' })
  }
  // 季军赛与决赛同列，列标题会重叠，改为在盒子旁单独标注

  return {
    nodes: ordered,
    links,
    width: maxX + PAD.right,
    height: maxY + PAD.bottom,
    columns,
  }
})

function teamName(m: TournamentMatch, side: 'a' | 'b'): string {
  const t = side === 'a' ? m.teamA : m.teamB
  if (!t) return '轮空'
  return t.name || '待定'
}

function isWinner(m: TournamentMatch, side: 'a' | 'b'): boolean {
  return side === 'a' ? m.winner === 1 : m.winner === 2
}

function scoreText(m: TournamentMatch, side: 'a' | 'b'): string {
  if (!m.finished) return ''
  const v = side === 'a' ? m.scoreA : m.scoreB
  return v == null ? '' : String(v)
}
</script>

<template>
  <div v-if="layout" class="tree-wrap">
    <div class="tree-scroll">
      <svg
        class="tree"
        :viewBox="`0 0 ${layout.width} ${layout.height}`"
        :style="{ width: layout.width + 'px', height: layout.height + 'px' }"
        role="img"
        aria-label="树形对阵图"
      >
        <!-- 列标题 -->
        <text
          v-for="c in layout.columns"
          :key="'col-' + c.label + c.x"
          class="col-label"
          :x="c.x"
          y="16"
          text-anchor="middle"
        >
          {{ c.label }}
        </text>

        <!-- 连线 -->
        <path
          v-for="(l, i) in layout.links"
          :key="'link-' + i"
          :d="l.d"
          class="link"
          :class="{ dashed: l.dashed }"
        />

        <!-- 对阵盒 -->
        <g v-for="n in layout.nodes" :key="'n-' + n.match.id">
          <text
            v-if="n.isBronze"
            class="col-label"
            :x="n.x + BOX_W / 2"
            :y="n.y - BOX_H / 2 - 8"
            text-anchor="middle"
          >
            季军赛
          </text>
          <rect
            class="box"
            :class="{ done: n.match.finished, bronze: n.isBronze }"
            :x="n.x"
            :y="n.y - BOX_H / 2"
            :width="BOX_W"
            :height="BOX_H"
            rx="6"
          />
          <line
            class="split"
            :x1="n.x"
            :x2="n.x + BOX_W"
            :y1="n.y"
            :y2="n.y"
          />
          <text
            class="team"
            :class="{ win: isWinner(n.match, 'a'), bye: !n.match.teamA }"
            :x="n.x + 8"
            :y="n.y - BOX_H / 4 + 4"
          >
            {{ teamName(n.match, 'a') }}
          </text>
          <text
            v-if="scoreText(n.match, 'a')"
            class="score"
            :x="n.x + BOX_W - 8"
            :y="n.y - BOX_H / 4 + 4"
            text-anchor="end"
          >
            {{ scoreText(n.match, 'a') }}
          </text>
          <text
            class="team"
            :class="{ win: isWinner(n.match, 'b'), bye: !n.match.teamB }"
            :x="n.x + 8"
            :y="n.y + BOX_H / 4 + 4"
          >
            {{ teamName(n.match, 'b') }}
          </text>
          <text
            v-if="scoreText(n.match, 'b')"
            class="score"
            :x="n.x + BOX_W - 8"
            :y="n.y + BOX_H / 4 + 4"
            text-anchor="end"
          >
            {{ scoreText(n.match, 'b') }}
          </text>
        </g>
      </svg>
    </div>
    <p class="tree-tip">横向滚動查看完整签表；「轮空」表示该签位首轮直接晋级。</p>
  </div>
  <div v-else class="empty">暂无淘汰赛赛程</div>
</template>

<style scoped>
.tree-wrap { display: flex; flex-direction: column; gap: 8px; }
.tree-scroll { overflow-x: auto; padding-bottom: 8px; }
.tree { display: block; }
.col-label { fill: #5a726d; font: 500 12px/18px 'PingFang SC', system-ui, sans-serif; }
.link { fill: none; stroke: #cfd8d5; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
.link.dashed { stroke-dasharray: 4 4; }
.box { fill: #fff; stroke: #e3e8e6; stroke-width: 1; }
.box.done { stroke: #14665b; }
.box.bronze { stroke-dasharray: 4 3; }
.split { stroke: #f0efea; stroke-width: 1; }
.team { fill: #5a726d; font: 400 12px/18px 'PingFang SC', system-ui, sans-serif; }
.team.win { fill: #1a2e2a; font-weight: 600; }
.team.bye { fill: #9aa8a4; font-style: italic; }
.score { fill: #14665b; font: 600 12px/18px 'SF Pro Text', system-ui, sans-serif; }
.empty { padding: 32px; text-align: center; color: #5a726d; }
.tree-tip { font-size: 12px; color: #9aa8a4; margin: 0; }
</style>

<!-- 树形对阵图（自上而下）：底部参赛队 → 逐轮淘汰 → 顶部冠军，直角折线连接 -->
<!-- 数据依赖后端返回的 childMatchIds——轮次之间是随机配对的，没法从签表静态推出来 -->
<script setup lang="ts">
import { computed } from 'vue'
import type { TournamentMatch, TournamentRoundBoard, TournamentTeam } from '../api/tournament'

const props = defineProps<{
  rounds: TournamentRoundBoard[]
}>()

/* ---------- 几何常量 ---------- */
const MATCH_W = 150
const MATCH_H = 48
const LEAF_W = 134
const LEAF_H = 30
/** 相邻两个参赛队盒子的水平间距（中到中 = LEAF_W + LEAF_GAP） */
const LEAF_GAP = 18
/** 相邻两层之间盒子的净垂直间距 */
const V_GAP = 40
const V_GAP_LEAF = 30
const PAD = { top: 18, right: 24, bottom: 18, left: 78 }

type NodeKind = 'match' | 'leaf'

interface TreeNode {
  kind: NodeKind
  cx: number
  cy: number
  w: number
  h: number
  layer: number
  match?: TournamentMatch
  team?: TournamentTeam | null
  side?: 'a' | 'b'
  isBronze?: boolean
  isRoot?: boolean
  children: TreeNode[]
}

interface Layout {
  width: number
  height: number
  nodes: TreeNode[]
  links: { d: string; dashed: boolean }[]
  /** 每行左侧的轮次名标注 */
  rowLabels: { x: number; y: number; text: string }[]
  rootFinal: boolean
  rootFinished: boolean
}

const layout = computed<Layout | null>(() => {
  const rounds = props.rounds ?? []
  const ko = rounds
    .filter((r) => r.roundNo > 0)
    .sort((a, b) => a.roundNo - b.roundNo)
  const finalRound = rounds.find((r) => r.roundNo === 0 && r.roundName === '决赛')
  const bronzeRound = rounds.find((r) => r.roundNo === 0 && r.roundName === '季军赛')
  if (ko.length === 0 && !finalRound) return null

  const k = ko.length
  const matchNodes = new Map<number, TreeNode>()
  const allNodes: TreeNode[] = []

  /** 各行（自上而下）盒子的顶部 y 坐标：0=决赛，1..k=淘汰赛各轮，k+1=参赛队 */
  const rowTop: number[] = []
  rowTop[0] = PAD.top
  for (let i = 1; i <= k; i++) rowTop[i] = rowTop[i - 1] + MATCH_H + V_GAP
  const leafTop = rowTop[k] + MATCH_H + V_GAP_LEAF

  function makeMatchNode(m: TournamentMatch, layer: number, extra?: Partial<TreeNode>): TreeNode {
    const node: TreeNode = {
      kind: 'match',
      cx: 0,
      cy: rowTop[layer] + MATCH_H / 2,
      w: MATCH_W,
      h: MATCH_H,
      layer,
      match: m,
      children: [],
      ...extra,
    }
    matchNodes.set(m.id, node)
    allNodes.push(node)
    return node
  }

  // 1) 淘汰赛各轮节点（R1 在最底层，Rk 在决赛下一层）
  ko.forEach((r, ri) => {
    const layer = k - ri
    r.matches.forEach((m) => makeMatchNode(m, layer))
  })

  // 2) 决赛（树根）与季军赛
  const finalMatch: TournamentMatch | null = finalRound?.matches[0] ?? null
  const bronzeMatch: TournamentMatch | null = bronzeRound?.matches[0] ?? null
  let rootNode: TreeNode | null = finalMatch
    ? makeMatchNode(finalMatch, 0, { isRoot: true })
    : null
  const bronzeNode: TreeNode | null = bronzeMatch
    ? makeMatchNode(bronzeMatch, 0, { isBronze: true })
    : null
  // 没有决赛时退化为以最后一轮为根
  if (!rootNode && k > 0 && ko[k - 1].matches.length === 1) {
    rootNode = matchNodes.get(ko[k - 1].matches[0].id) ?? null
  }

  // 3) 底部参赛队叶子：每两个签位属于一场最底层比赛
  const baseRound = k > 0 ? ko[0] : null
  const baseMatches: TournamentMatch[] = baseRound
    ? baseRound.matches
    : finalRound
      ? finalRound.matches
      : []

  const leaves: TreeNode[] = []
  baseMatches.forEach((m) => {
    ;(['a', 'b'] as const).forEach((side) => {
      const node: TreeNode = {
        kind: 'leaf',
        cx: 0,
        cy: leafTop + LEAF_H / 2,
        w: LEAF_W,
        h: LEAF_H,
        layer: k + 1,
        match: m,
        team: side === 'a' ? m.teamA : m.teamB,
        side,
        children: [],
      }
      leaves.push(node)
      allNodes.push(node)
    })
  })

  // 4) 横坐标：叶子从左到右等距铺开，父节点取两个子节点的中点
  leaves.forEach((leaf, i) => {
    leaf.cx = PAD.left + LEAF_W / 2 + i * (LEAF_W + LEAF_GAP)
  })

  const childrenOf = (m: TournamentMatch): TreeNode[] =>
    (m.childMatchIds ?? [])
      .map((cid) => matchNodes.get(cid))
      .filter((n): n is TreeNode => !!n)

  if (k === 0) {
    // 无淘汰轮：决赛直接挂两个参赛队叶子
    if (rootNode) rootNode.children = leaves
  } else {
    // 最底层比赛 ← 自己的两个签位叶子
    ko[0].matches.forEach((m: TournamentMatch, mi: number) => {
      const node = matchNodes.get(m.id)
      if (node) node.children = leaves.slice(mi * 2, mi * 2 + 2)
    })
    // 其余各轮 ← childMatchIds（缺失时按序退化：相邻两场汇聚）
    for (let ri = 1; ri < k; ri++) {
      const prev = ko[ri - 1].matches
      ko[ri].matches.forEach((m: TournamentMatch, mi: number) => {
        const node = matchNodes.get(m.id)
        if (!node) return
        let cs = childrenOf(m)
        if (cs.length === 0) {
          cs = [prev[mi * 2], prev[mi * 2 + 1]]
            .map((pm) => (pm ? matchNodes.get(pm.id) : null))
            .filter((n): n is TreeNode => !!n)
        }
        node.children = cs
      })
    }
    // 决赛 ← childMatchIds
    if (rootNode && rootNode.match) {
      const cs = childrenOf(rootNode.match)
      if (cs.length > 0) rootNode.children = cs
    }
  }

  // 5) 自下而上收敛横坐标
  if (k > 0) {
    for (let ri = 0; ri < k; ri++) {
      ko[ri].matches.forEach((m: TournamentMatch) => {
        const node = matchNodes.get(m.id)
        if (node && node.children.length > 0) {
          node.cx = node.children.reduce((s, c) => s + c.cx, 0) / node.children.length
        }
      })
    }
  }
  if (rootNode) {
    if (rootNode.children.length > 0) {
      rootNode.cx = rootNode.children.reduce((s, c) => s + c.cx, 0) / rootNode.children.length
    } else if (leaves.length > 0) {
      rootNode.cx = (leaves[0].cx + leaves[leaves.length - 1].cx) / 2
    } else {
      rootNode.cx = PAD.left + MATCH_W / 2
    }
  }

  // 6) 季军赛：放在整棵树右侧，虚线挂回它的来源场（通常是两场半决赛）
  let rightEdge =
    leaves.length > 0
      ? leaves[leaves.length - 1].cx + LEAF_W / 2
      : PAD.left + MATCH_W
  if (bronzeNode && bronzeNode.match) {
    let cs = childrenOf(bronzeNode.match)
    if (cs.length === 0 && k > 0) {
      cs = ko[k - 1].matches
        .map((pm: TournamentMatch) => matchNodes.get(pm.id))
        .filter((n: TreeNode | undefined): n is TreeNode => !!n)
    }
    bronzeNode.children = cs
    bronzeNode.cx = rightEdge + 30 + MATCH_W / 2
    rightEdge = bronzeNode.cx + MATCH_W / 2
  }

  // 7) 连线：父盒底部中点 → 竖直母线 → 水平汇流排 → 竖直落到子盒顶部
  const links: { d: string; dashed: boolean }[] = []
  for (const node of allNodes) {
    if (node.kind !== 'match' || node.children.length === 0) continue
    const parentBottom = node.cy + node.h / 2
    const childTops = node.children.map((c) => c.cy - c.h / 2)
    // 同层子节点顶部一致，取最小值（季军赛子节点在更下一层时也能兜住）
    const busY = (parentBottom + Math.min(...childTops)) / 2
    const cxs = node.children.map((c) => c.cx)
    links.push({ d: `M ${node.cx} ${parentBottom} V ${busY}`, dashed: !!node.isBronze })
    if (cxs.length > 1) {
      links.push({
        d: `M ${Math.min(...cxs)} ${busY} H ${Math.max(...cxs)}`,
        dashed: !!node.isBronze,
      })
    }
    node.children.forEach((c) => {
      links.push({
        d: `M ${c.cx} ${busY} V ${c.cy - c.h / 2}`,
        dashed: !!node.isBronze,
      })
    })
  }

  // 8) 行标签
  const rowLabels: { x: number; y: number; text: string }[] = []
  ko.forEach((r: TournamentRoundBoard, ri: number) => {
    const layer = k - ri
    rowLabels.push({ x: PAD.left - 12, y: rowTop[layer] + MATCH_H / 2, text: r.roundName })
  })
  if (rootNode && finalRound && !rootNode.match?.finished) {
    rowLabels.push({ x: PAD.left - 12, y: rowTop[0] + MATCH_H / 2, text: '决赛' })
  }
  rowLabels.push({ x: PAD.left - 12, y: leafTop + LEAF_H / 2, text: '参赛队' })

  const width = rightEdge + PAD.right
  const height = leafTop + LEAF_H + PAD.bottom

  return {
    width,
    height,
    nodes: allNodes,
    links,
    rowLabels,
    rootFinal: !!finalRound,
    rootFinished: !!rootNode?.match?.finished,
  }
})

function teamName(m: TournamentMatch, side: 'a' | 'b'): string {
  const t = side === 'a' ? m.teamA : m.teamB
  if (!t) return m.roundNo === 1 ? '轮空' : '待定'
  return t.name || '待定'
}

/** 空签位的样式语义：首轮=轮空，其余轮次=待定（胜者尚未产生） */
function slotClass(m: TournamentMatch, side: 'a' | 'b'): string {
  const t = side === 'a' ? m.teamA : m.teamB
  if (t) return ''
  return m.roundNo === 1 ? 'bye' : 'pending'
}

function isWinner(m: TournamentMatch, side: 'a' | 'b'): boolean {
  return side === 'a' ? m.winner === 1 : m.winner === 2
}

function scoreText(m: TournamentMatch, side: 'a' | 'b'): string {
  if (!m.finished) return ''
  const v = side === 'a' ? m.scoreA : m.scoreB
  return v == null ? '' : String(v)
}

/** 叶子是否为该场胜者 */
function leafWon(n: { match?: TournamentMatch; side?: 'a' | 'b' }): boolean {
  if (!n.match || !n.side || !n.match.finished) return false
  return isWinner(n.match, n.side)
}

function fit(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}

/** 决赛完赛后的冠军队名 */
function championName(m: TournamentMatch): string {
  const t = m.winner === 1 ? m.teamA : m.winner === 2 ? m.teamB : null
  return t?.name || ''
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
        <!-- 行标签 -->
        <text
          v-for="(l, i) in layout.rowLabels"
          :key="'rl-' + i"
          class="row-label"
          :x="l.x"
          :y="l.y + 4"
          text-anchor="end"
        >
          {{ l.text }}
        </text>

        <!-- 连线 -->
        <path
          v-for="(l, i) in layout.links"
          :key="'link-' + i"
          :d="l.d"
          class="link"
          :class="{ dashed: l.dashed }"
        />

        <!-- 节点 -->
        <g v-for="(n, i) in layout.nodes" :key="'n-' + i">
          <!-- 冠军盒（决赛已完赛） -->
          <template v-if="n.isRoot && n.match && n.match.finished">
            <rect
              class="champ-box"
              :x="n.cx - n.w / 2"
              :y="n.cy - n.h / 2"
              :width="n.w"
              :height="n.h"
              rx="8"
            />
            <text class="champ-label" :x="n.cx" :y="n.cy - 7" text-anchor="middle">冠军</text>
            <text class="champ-name" :x="n.cx" :y="n.cy + 12" text-anchor="middle">
              {{ fit(championName(n.match), 9) }}
              <title>{{ championName(n.match) }}</title>
            </text>
          </template>

          <!-- 参赛队叶子盒 -->
          <template v-else-if="n.kind === 'leaf'">
            <rect
              class="leaf-box"
              :class="{ win: leafWon(n), bye: !n.team }"
              :x="n.cx - n.w / 2"
              :y="n.cy - n.h / 2"
              :width="n.w"
              :height="n.h"
              rx="6"
            />
            <text
              class="leaf-text"
              :class="{ win: leafWon(n), bye: !n.team }"
              :x="n.cx"
              :y="n.cy + 4"
              text-anchor="middle"
            >
              {{ n.team ? fit(n.team.name || '待定', 9) : '轮空' }}
              <title v-if="n.team">{{ n.team.name }}</title>
            </text>
          </template>

          <!-- 普通对阵盒（含未赛决赛 / 季军赛） -->
          <template v-else-if="n.match">
            <text
              v-if="n.isBronze"
              class="row-label bronze-tag"
              :x="n.cx"
              :y="n.cy - n.h / 2 - 6"
              text-anchor="middle"
            >
              季军赛
            </text>
            <rect
              class="box"
              :class="{ done: n.match.finished, bronze: n.isBronze }"
              :x="n.cx - n.w / 2"
              :y="n.cy - n.h / 2"
              :width="n.w"
              :height="n.h"
              rx="6"
            />
            <line class="split" :x1="n.cx - n.w / 2" :x2="n.cx + n.w / 2" :y1="n.cy" :y2="n.cy" />
            <text
              class="team"
              :class="[isWinner(n.match, 'a') ? 'win' : '', slotClass(n.match, 'a')]"
              :x="n.cx - n.w / 2 + 8"
              :y="n.cy - 8"
            >
              {{ fit(teamName(n.match, 'a'), 8) }}
            </text>
            <text
              v-if="scoreText(n.match, 'a')"
              class="score"
              :x="n.cx + n.w / 2 - 8"
              :y="n.cy - 8"
              text-anchor="end"
            >
              {{ scoreText(n.match, 'a') }}
            </text>
            <text
              class="team"
              :class="[isWinner(n.match, 'b') ? 'win' : '', slotClass(n.match, 'b')]"
              :x="n.cx - n.w / 2 + 8"
              :y="n.cy + 15"
            >
              {{ fit(teamName(n.match, 'b'), 8) }}
            </text>
            <text
              v-if="scoreText(n.match, 'b')"
              class="score"
              :x="n.cx + n.w / 2 - 8"
              :y="n.cy + 15"
              text-anchor="end"
            >
              {{ scoreText(n.match, 'b') }}
            </text>
          </template>
        </g>
      </svg>
    </div>
    <p class="tree-tip">横向滚动查看完整签表；「轮空」表示该签位首轮直接晋级。</p>
  </div>
  <div v-else class="empty">暂无淘汰赛赛程</div>
</template>

<style scoped>
.tree-wrap { display: flex; flex-direction: column; gap: 8px; }
.tree-scroll { overflow: auto; padding-bottom: 8px; }
.tree { display: block; min-width: 100%; }
.row-label { fill: #5a726d; font: 500 12px/18px 'PingFang SC', system-ui, sans-serif; }
.bronze-tag { font-size: 11px; }
.link { fill: none; stroke: #cfd8d5; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
.link.dashed { stroke: #b9c6c2; stroke-dasharray: 4 4; }

.box { fill: #fff; stroke: #e3e8e6; stroke-width: 1; }
.box.done { stroke: #14665b; }
.box.bronze { stroke-dasharray: 4 3; }
.split { stroke: #f0efea; stroke-width: 1; }
.team { fill: #5a726d; font: 400 12px/18px 'PingFang SC', system-ui, sans-serif; }
.team.win { fill: #1a2e2a; font-weight: 600; }
.team.bye { fill: #9aa8a4; font-style: italic; }
.team.pending { fill: #9aa8a4; }
.score { fill: #14665b; font: 600 12px/18px 'SF Pro Text', system-ui, sans-serif; }

.leaf-box { fill: #fff; stroke: #dfe6e3; stroke-width: 1; }
.leaf-box.win { fill: #f2f8f6; stroke: #8fb8b0; }
.leaf-box.bye { fill: #faf9f5; }
.leaf-text { fill: #1a2e2a; font: 500 12px/18px 'PingFang SC', system-ui, sans-serif; }
.leaf-text.win { fill: #14665b; font-weight: 700; }
.leaf-text.bye { fill: #9aa8a4; font-style: italic; }

.champ-box { fill: #fffdf4; stroke: #14665b; stroke-width: 2; }
.champ-label { fill: #5a726d; font: 500 10px/14px 'PingFang SC', system-ui, sans-serif; letter-spacing: 2px; }
.champ-name { fill: #14665b; font: 700 14px/20px 'PingFang SC', system-ui, sans-serif; }

.empty { padding: 32px; text-align: center; color: #5a726d; }
.tree-tip { font-size: 12px; color: #9aa8a4; margin: 0; }
</style>

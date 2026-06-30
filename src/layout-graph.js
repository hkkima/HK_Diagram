// Layered (Sugiyama-lite) layout for directed graphs: flowchart / state.
// rank by longest path -> dummy-node normalization -> barycenter ordering ->
// breadth coordinate assignment with median alignment.

import { sizeGraphNode } from './shapes.js';
import { CANVAS_PAD } from './theme.js';
import { applyPositions } from './layout-util.js';

const RANK_GAP = 56;
const NODE_SEP = 40;

export function layoutGraph(ir) {
  const dir = ir.direction || 'TB';
  const horiz = dir === 'LR' || dir === 'RL';

  const nodes = {};
  for (const n of ir.nodes) {
    const sz = (n.w && n.h) ? { w: n.w, h: n.h, lines: n.lines || [] } : sizeGraphNode(n);
    nodes[n.id] = { ...n, ...sz, isDummy: false };
  }

  // thickness = size along the rank axis; breadth = size across it
  const thick = (n) => (horiz ? n.w : n.h);
  const breadth = (n) => (horiz ? n.h : n.w);

  // --- rank via longest path (ignore back edges to break cycles) --------
  const adj = new Map();   // id -> [id]
  const radj = new Map();
  for (const id of Object.keys(nodes)) { adj.set(id, []); radj.set(id, []); }
  const treeEdges = [];
  const state = new Map(); // 0=unvisited,1=instack,2=done
  const order = Object.keys(nodes);
  for (const e of ir.edges) if (nodes[e.from] && nodes[e.to]) { /* mark later */ }

  // DFS to classify back edges
  function classify() {
    const out = new Map();
    for (const id of Object.keys(nodes)) out.set(id, []);
    for (const e of ir.edges) if (nodes[e.from] && nodes[e.to]) out.get(e.from).push(e.to);
    const isBack = new Set();
    const st = new Map(Object.keys(nodes).map((id) => [id, 0]));
    const stack = [];
    function dfs(u) {
      st.set(u, 1); stack.push(u);
      for (const v of out.get(u)) {
        if (st.get(v) === 1) isBack.add(`${u}->${v}`);
        else if (st.get(v) === 0) dfs(v);
      }
      st.set(u, 2); stack.pop();
    }
    for (const id of Object.keys(nodes)) if (st.get(id) === 0) dfs(id);
    return isBack;
  }
  const backSet = classify();

  const fwdEdges = [];
  const backEdges = [];
  for (const e of ir.edges) {
    if (!nodes[e.from] || !nodes[e.to]) continue;
    if (e.from === e.to) { backEdges.push(e); continue; }
    if (backSet.has(`${e.from}->${e.to}`)) backEdges.push(e);
    else { fwdEdges.push(e); adj.get(e.from).push(e.to); radj.get(e.to).push(e.from); }
  }

  // longest-path rank on the DAG of forward edges
  const rank = new Map();
  function rankOf(id, seen = new Set()) {
    if (rank.has(id)) return rank.get(id);
    if (seen.has(id)) return 0;
    seen.add(id);
    const ps = radj.get(id);
    const r = ps.length ? 1 + Math.max(...ps.map((p) => rankOf(p, seen))) : 0;
    rank.set(id, r);
    return r;
  }
  for (const id of Object.keys(nodes)) rankOf(id);

  // --- normalize: insert dummy nodes for edges spanning >1 rank ---------
  const segments = []; // {from,to} adjacency for ordering
  const edgeChains = []; // {edge, chain:[ids]}
  let dummyCount = 0;
  function addDummy(r) {
    const id = `__d${dummyCount++}`;
    nodes[id] = { id, isDummy: true, w: 1, h: 1, lines: [] };
    rank.set(id, r);
    return id;
  }
  for (const e of fwdEdges) {
    let r0 = rank.get(e.from), r1 = rank.get(e.to);
    if (r1 < r0) { const t = r0; r0 = r1; r1 = t; }
    if (r1 - r0 <= 1) {
      edgeChains.push({ edge: e, chain: [e.from, e.to] });
      segments.push([e.from, e.to]);
    } else {
      const chain = [e.from];
      for (let r = rank.get(e.from) + 1; r < rank.get(e.to); r++) chain.push(addDummy(r));
      chain.push(e.to);
      for (let i = 0; i < chain.length - 1; i++) segments.push([chain[i], chain[i + 1]]);
      edgeChains.push({ edge: e, chain });
    }
  }

  // --- ranks array + initial ordering -----------------------------------
  const maxRank = Math.max(0, ...[...rank.values()]);
  const ranks = Array.from({ length: maxRank + 1 }, () => []);
  // declaration order as tiebreaker
  const decl = new Map(ir.nodes.map((n, i) => [n.id, i]));
  for (const id of Object.keys(nodes)) ranks[rank.get(id)].push(id);
  for (const arr of ranks) arr.sort((a, b) => (decl.get(a) ?? 1e9) - (decl.get(b) ?? 1e9));

  const succ = new Map(); const pred = new Map();
  for (const id of Object.keys(nodes)) { succ.set(id, []); pred.set(id, []); }
  for (const [a, b] of segments) { succ.get(a).push(b); pred.get(b).push(a); }

  // barycenter sweeps
  function orderIndex() {
    const idx = new Map();
    ranks.forEach((arr) => arr.forEach((id, i) => idx.set(id, i)));
    return idx;
  }
  for (let pass = 0; pass < 6; pass++) {
    const down = pass % 2 === 0;
    const idx = orderIndex();
    const from = down ? 1 : maxRank - 1;
    const to = down ? maxRank : -1;
    const step = down ? 1 : -1;
    for (let r = from; r !== to; r += step) {
      const neigh = down ? pred : succ;
      const bary = (id) => {
        const ns = neigh.get(id);
        if (!ns.length) return idx.get(id);
        return ns.reduce((s, n) => s + idx.get(n), 0) / ns.length;
      };
      ranks[r] = ranks[r].slice().sort((a, b) => bary(a) - bary(b));
      ranks[r].forEach((id, i) => idx.set(id, i));
    }
  }

  // --- breadth coordinates ---------------------------------------------
  const bpos = new Map();
  for (const arr of ranks) {
    let x = 0;
    for (const id of arr) {
      const half = breadth(nodes[id]) / 2;
      x += half;
      bpos.set(id, x);
      x += half + NODE_SEP;
    }
  }
  // median alignment iterations
  for (let it = 0; it < 8; it++) {
    const useDown = it % 2 === 0;
    for (let r = 0; r <= maxRank; r++) {
      const arr = ranks[r];
      const desired = arr.map((id) => {
        const ns = useDown ? pred.get(id) : succ.get(id);
        if (!ns.length) return bpos.get(id);
        const vals = ns.map((n) => bpos.get(n)).sort((a, b) => a - b);
        const m = vals.length;
        return m % 2 ? vals[(m - 1) / 2] : (vals[m / 2 - 1] + vals[m / 2]) / 2;
      });
      // left-to-right separation clamp
      for (let i = 0; i < arr.length; i++) {
        let p = desired[i];
        if (i > 0) {
          const minGap = breadth(nodes[arr[i - 1]]) / 2 + NODE_SEP + breadth(nodes[arr[i]]) / 2;
          p = Math.max(p, bpos.get(arr[i - 1]) + minGap);
        }
        bpos.set(arr[i], p);
      }
    }
  }

  // --- rank coordinates -------------------------------------------------
  const rankThick = ranks.map((arr) => Math.max(1, ...arr.map((id) => thick(nodes[id]))));
  const rankCenter = [];
  let acc = 0;
  for (let r = 0; r <= maxRank; r++) {
    acc += rankThick[r] / 2;
    rankCenter[r] = acc;
    acc += rankThick[r] / 2 + RANK_GAP;
  }
  const totalRank = acc - RANK_GAP;

  // --- map to x/y centers ----------------------------------------------
  for (const id of Object.keys(nodes)) {
    const n = nodes[id];
    let rc = rankCenter[rank.get(id)];
    if (dir === 'BT' || dir === 'RL') rc = totalRank - rc;
    const bc = bpos.get(id);
    const cx = horiz ? rc : bc;
    const cy = horiz ? bc : rc;
    n.x = Math.round(cx - n.w / 2);
    n.y = Math.round(cy - n.h / 2);
  }

  // shift into positive canvas
  let minX = Infinity, minY = Infinity;
  for (const n of Object.values(nodes)) {
    if (n.isDummy) continue;
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
  }
  const dx = CANVAS_PAD - minX, dy = CANVAS_PAD - minY;
  for (const n of Object.values(nodes)) { n.x += dx; n.y += dy; }

  // free-placement overrides + final bounds
  const dim = applyPositions(nodes, ir.positions);
  return { nodes, dir, edges: ir.edges, edgeChains, width: dim.width, height: dim.height };
}

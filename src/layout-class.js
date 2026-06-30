// Layered tree layout for class/object diagrams.
// Parents sit above children; siblings packed left-to-right; parents centered
// over their children (Reingold-Tilford-ish, single pass, good for hierarchies).

import { sizeNode } from './model.js';
import { PAD, CLASS_SWATCH, INSTANCE_PALETTE, CANVAS_PAD } from './theme.js';
import { applyPositions } from './layout-util.js';

export function layoutClass(ir) {
  const nodes = {};
  for (const n of ir.nodes) {
    nodes[n.id] = { ...n, ...sizeNode(n) };
  }

  // --- color assignment -------------------------------------------------
  const typeColorIdx = new Map();
  let nextColor = 0;
  for (const n of Object.values(nodes)) {
    if (n.kind === 'object') {
      const key = n.type || n.id;
      if (!typeColorIdx.has(key)) typeColorIdx.set(key, nextColor++ % INSTANCE_PALETTE.length);
      n.swatch = INSTANCE_PALETTE[typeColorIdx.get(key)];
    } else {
      n.swatch = CLASS_SWATCH;
    }
  }

  // --- hierarchy from edges (parent above, child below) -----------------
  const primaryChildren = new Map(); // parent -> [childId]
  const primaryParent = new Map();   // child  -> parentId (first wins)
  const parents = new Map();          // child  -> [parentId]
  for (const id of Object.keys(nodes)) primaryChildren.set(id, []);

  for (const e of ir.edges) {
    const { parent, child } = e;
    if (!nodes[parent] || !nodes[child]) continue;
    if (!parents.has(child)) parents.set(child, []);
    parents.get(child).push(parent);
    if (!primaryParent.has(child)) {
      primaryParent.set(child, parent);
      primaryChildren.get(parent).push(child);
    }
  }

  // --- depth via longest path from roots --------------------------------
  const depth = new Map();
  function computeDepth(id, seen = new Set()) {
    if (depth.has(id)) return depth.get(id);
    if (seen.has(id)) return 0; // cycle guard
    seen.add(id);
    const ps = parents.get(id);
    let d = 0;
    if (ps && ps.length) {
      d = 1 + Math.max(...ps.map((p) => computeDepth(p, seen)));
    }
    depth.set(id, d);
    return d;
  }
  for (const id of Object.keys(nodes)) computeDepth(id);

  // Row tops keyed by depth, using the tallest box on each row.
  const maxDepth = Math.max(0, ...[...depth.values()]);
  const rowHeight = new Array(maxDepth + 1).fill(0);
  for (const [id, d] of depth) rowHeight[d] = Math.max(rowHeight[d], nodes[id].h);
  const rowTop = new Array(maxDepth + 1).fill(0);
  for (let d = 1; d <= maxDepth; d++) rowTop[d] = rowTop[d - 1] + rowHeight[d - 1] + PAD.rowGap;

  // --- x via post-order leaf cursor over the primary forest -------------
  const roots = Object.keys(nodes).filter((id) => !primaryParent.has(id));
  // Stable root order: declaration order.
  const declOrder = new Map(ir.nodes.map((n, i) => [n.id, i]));
  roots.sort((a, b) => declOrder.get(a) - declOrder.get(b));

  let cursor = 0;
  function place(id) {
    const kids = primaryChildren.get(id);
    const node = nodes[id];
    if (!kids.length) {
      node.cx = cursor + node.w / 2;
      cursor += node.w + PAD.colGap;
    } else {
      kids.forEach(place);
      const f = nodes[kids[0]].cx;
      const l = nodes[kids[kids.length - 1]].cx;
      node.cx = (f + l) / 2;
      // keep the parent from poking left of the cursor's start region
    }
  }
  roots.forEach((r) => {
    place(r);
    cursor += PAD.colGap; // gap between separate trees
  });

  // --- finalize coordinates --------------------------------------------
  for (const id of Object.keys(nodes)) {
    const n = nodes[id];
    n.x = Math.round(n.cx - n.w / 2);
    n.y = Math.round(rowTop[depth.get(id)]);
  }

  // Shift everything into positive canvas with padding.
  let minX = Infinity, minY = Infinity;
  for (const n of Object.values(nodes)) { minX = Math.min(minX, n.x); minY = Math.min(minY, n.y); }
  const dx = CANVAS_PAD - minX, dy = CANVAS_PAD - minY;
  for (const n of Object.values(nodes)) { n.x += dx; n.y += dy; }

  // free-placement overrides + final bounds
  const dim = applyPositions(nodes, ir.positions);
  return { nodes, edges: ir.edges, width: dim.width, height: dim.height };
}

// Orthogonal "bus" routing: parent trunk drops to a shared horizontal bus,
// which branches straight down into each child. Pure vertical/horizontal lines.

export function routeOrtho(layout) {
  const { nodes, edges } = layout;

  // Group edges by parent + line style (solid/dashed share a bus).
  const groups = new Map();
  for (const e of edges) {
    const p = nodes[e.parent], c = nodes[e.child];
    if (!p || !c) continue;
    const key = `${e.parent}|${e.style}`;
    if (!groups.has(key)) groups.set(key, { parent: p, style: e.style, kind: e.kind, children: [] });
    groups.get(key).children.push(c);
  }

  const routes = [];
  for (const g of groups.values()) {
    const p = g.parent;
    const px = Math.round(p.x + p.w / 2);
    const pBottom = p.y + p.h;
    const kids = g.children;

    const childPts = kids.map((c) => ({ x: Math.round(c.x + c.w / 2), top: c.y }));
    const minTop = Math.min(...childPts.map((k) => k.top));

    const segments = [];

    // Single child perfectly aligned -> one straight vertical line.
    if (childPts.length === 1 && childPts[0].x === px) {
      segments.push([[px, pBottom], [px, childPts[0].top]]);
    } else {
      const busY = Math.round((pBottom + minTop) / 2);
      // trunk
      segments.push([[px, pBottom], [px, busY]]);
      // horizontal bus spanning trunk + all children
      const xs = [px, ...childPts.map((k) => k.x)];
      const left = Math.min(...xs), right = Math.max(...xs);
      if (right > left) segments.push([[left, busY], [right, busY]]);
      // drops into each child
      for (const k of childPts) segments.push([[k.x, busY], [k.x, k.top]]);
    }

    routes.push({ style: g.style, kind: g.kind, segments });
  }

  return routes;
}

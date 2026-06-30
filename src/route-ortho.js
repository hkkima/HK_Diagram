// Orthogonal "bus" routing: parent trunk drops to a shared horizontal bus,
// which branches straight down into each child. Pure vertical/horizontal lines.
// Each child drop carries its edge index so it can be selected/edited.

export function routeOrtho(layout) {
  const { nodes, edges } = layout;

  // Group edges by parent + line style (solid/dashed share a bus).
  const groups = new Map();
  edges.forEach((e, idx) => {
    const p = nodes[e.parent], c = nodes[e.child];
    if (!p || !c) return;
    const key = `${e.parent}|${e.style}`;
    if (!groups.has(key)) groups.set(key, { parent: p, style: e.style, kind: e.kind, children: [] });
    groups.get(key).children.push({ node: c, edgeIndex: idx });
  });

  const routes = [];
  for (const g of groups.values()) {
    const p = g.parent;
    const px = Math.round(p.x + p.w / 2);
    const pBottom = p.y + p.h;

    const kids = g.children.map((k) => ({ x: Math.round(k.node.x + k.node.w / 2), top: k.node.y, edgeIndex: k.edgeIndex }));
    const minTop = Math.min(...kids.map((k) => k.top));

    const shared = [];
    const drops = [];

    if (kids.length === 1 && kids[0].x === px) {
      drops.push({ edgeIndex: kids[0].edgeIndex, seg: [[px, pBottom], [px, kids[0].top]] });
    } else {
      const busY = Math.round((pBottom + minTop) / 2);
      shared.push([[px, pBottom], [px, busY]]);
      const xs = [px, ...kids.map((k) => k.x)];
      const left = Math.min(...xs), right = Math.max(...xs);
      if (right > left) shared.push([[left, busY], [right, busY]]);
      for (const k of kids) drops.push({ edgeIndex: k.edgeIndex, seg: [[k.x, busY], [k.x, k.top]] });
    }

    routes.push({ style: g.style, kind: g.kind, shared, drops });
  }

  return routes;
}

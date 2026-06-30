// Orthogonal routing for layered graphs (flowchart / state).
// Forward edges route through their dummy chain; back/self edges use a side elbow.

function center(n) { return [n.x + n.w / 2, n.y + n.h / 2]; }

function exitPoint(n, dir) {
  const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
  if (dir === 'TB') return [cx, n.y + n.h];
  if (dir === 'BT') return [cx, n.y];
  if (dir === 'LR') return [n.x + n.w, cy];
  return [n.x, cy]; // RL
}
function entryPoint(n, dir) {
  const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
  if (dir === 'TB') return [cx, n.y];
  if (dir === 'BT') return [cx, n.y + n.h];
  if (dir === 'LR') return [n.x, cy];
  return [n.x + n.w, cy]; // RL
}
const arrowDirFor = (dir) => ({ TB: 'down', BT: 'up', LR: 'right', RL: 'left' }[dir]);

function orthogonalize(pts, horiz) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = out[out.length - 1], b = pts[i];
    if (a[0] !== b[0] && a[1] !== b[1]) {
      if (!horiz) { const my = (a[1] + b[1]) / 2; out.push([a[0], my], [b[0], my]); }
      else { const mx = (a[0] + b[0]) / 2; out.push([mx, a[1]], [mx, b[1]]); }
    }
    out.push(b);
  }
  return out;
}

export function routeGraph(layout) {
  const { nodes, dir, edgeChains } = layout;
  const horiz = dir === 'LR' || dir === 'RL';
  const routes = [];
  const chainByEdge = new Map(edgeChains.map((c) => [c.edge, c.chain]));

  // diagram bounds (real nodes) for choosing a clear side channel
  const real = Object.values(nodes).filter((n) => !n.isDummy);
  const bounds = {
    left: Math.min(...real.map((n) => n.x)),
    right: Math.max(...real.map((n) => n.x + n.w)),
    top: Math.min(...real.map((n) => n.y)),
    bottom: Math.max(...real.map((n) => n.y + n.h)),
  };

  let ei = -1;
  for (const e of layout.edges) {
    ei++;
    const s = nodes[e.from], t = nodes[e.to];
    if (!s || !t) continue;
    const style = e.style || 'solid';
    const arrow = e.arrow !== false;

    // self loop
    if (e.from === e.to) {
      const cy = s.y + s.h / 2, rx = s.x + s.w;
      const poly = [[rx, cy - 8], [rx + 26, cy - 8], [rx + 26, cy + 8], [rx, cy + 8]];
      routes.push({ edge: e, edgeIndex: ei, poly, style, arrow, label: e.label, arrowAt: [rx, cy + 8], arrowDir: 'left' });
      continue;
    }

    const chain = chainByEdge.get(e);
    const isForward = chain && (chain.length >= 2);

    if (isForward) {
      const pts = [exitPoint(s, dir)];
      for (let i = 1; i < chain.length - 1; i++) pts.push(center(nodes[chain[i]]));
      pts.push(entryPoint(t, dir));
      const poly = orthogonalize(pts, horiz);
      const mid = poly[Math.floor(poly.length / 2)];
      routes.push({ edge: e, edgeIndex: ei, poly, style, arrow, label: e.label, arrowAt: poly[poly.length - 1], arrowDir: arrowDirFor(dir), labelAt: mid });
    } else {
      // back edge: route around through the clearer side channel
      const scy = s.y + s.h / 2, tcy = t.y + t.h / 2;
      const scx = s.x + s.w / 2, tcx = t.x + t.w / 2;
      const gap = 26;
      let poly, arrowAt, arrowDir, labelAt;
      if (!horiz) {
        const useLeft = (scx + tcx) / 2 < (bounds.left + bounds.right) / 2;
        const x = useLeft ? bounds.left - gap : bounds.right + gap;
        const sx = useLeft ? s.x : s.x + s.w;
        const tx = useLeft ? t.x : t.x + t.w;
        poly = [[sx, scy], [x, scy], [x, tcy], [tx, tcy]];
        arrowAt = [tx, tcy]; arrowDir = useLeft ? 'right' : 'left'; labelAt = [x, (scy + tcy) / 2];
      } else {
        const useTop = (scy + tcy) / 2 < (bounds.top + bounds.bottom) / 2;
        const y = useTop ? bounds.top - gap : bounds.bottom + gap;
        const sy = useTop ? s.y : s.y + s.h;
        const ty = useTop ? t.y : t.y + t.h;
        poly = [[scx, sy], [scx, y], [tcx, y], [tcx, ty]];
        arrowAt = [tcx, ty]; arrowDir = useTop ? 'down' : 'up'; labelAt = [(scx + tcx) / 2, y];
      }
      routes.push({ edge: e, edgeIndex: ei, poly, style, arrow, label: e.label, arrowAt, arrowDir, labelAt });
    }
  }
  return routes;
}

// Render layered graph (flowchart / state) + orthogonal routes -> SVG.

import { FONT_STACK, EDGE } from './theme.js';
import { shapeOutline, NODE_FONT } from './shapes.js';
import { lineHeight } from './measure.js';

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STYLE = {
  fill: '#e9f2fb', border: '#3d7ebf', text: '#16324f',
  stateFill: '#eaf3fc', marker: '#28323a',
};

function arrowHead(at, dir, color) {
  const [x, y] = at, s = 5, l = 9;
  let pts;
  if (dir === 'down') pts = `${x - s},${y - l} ${x + s},${y - l} ${x},${y}`;
  else if (dir === 'up') pts = `${x - s},${y + l} ${x + s},${y + l} ${x},${y}`;
  else if (dir === 'left') pts = `${x + l},${y - s} ${x + l},${y + s} ${x},${y}`;
  else pts = `${x - l},${y - s} ${x - l},${y + s} ${x},${y}`;
  return `<polygon points="${pts}" fill="${color}"/>`;
}

function edgeSVG(r) {
  const out = [];
  const d = r.poly.map(([x, y], i) => `${i ? 'L' : 'M'}${x + 0.5} ${y + 0.5}`).join(' ');
  const dash = r.style === 'dashed' ? ` stroke-dasharray="${EDGE.dash}"` : '';
  const w = r.style === 'thick' ? 2.6 : EDGE.width;
  out.push(`<path d="${d}" fill="none" stroke="${EDGE.color}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"${dash}/>`);
  if (r.arrow !== false) out.push(arrowHead(r.arrowAt, r.arrowDir, EDGE.color));
  if (r.label) {
    const [lx, ly] = r.labelAt || r.poly[Math.floor(r.poly.length / 2)];
    const w2 = r.label.length * 7 + 8;
    out.push(`<rect x="${lx - w2 / 2}" y="${ly - 9}" width="${w2}" height="18" rx="3" fill="#ffffff" opacity="0.9"/>`);
    out.push(`<text x="${lx}" y="${ly + 4}" text-anchor="middle" font-family="${FONT_STACK}" font-size="11" fill="#42505a">${esc(r.label)}</text>`);
  }
  return out.join('\n');
}

function nodeSVG(n) {
  if (n.isDummy) return '';
  const isMarker = n.shape === 'start' || n.shape === 'end';
  const fill = isMarker ? STYLE.marker : (n.kind === 'state' ? STYLE.stateFill : STYLE.fill);
  const stroke = isMarker ? STYLE.marker : STYLE.border;
  const parts = [shapeOutline(n, fill, stroke)];
  if (!isMarker && n.lines && n.lines.length) {
    const lh = lineHeight(NODE_FONT);
    const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    const startY = cy - (n.lines.length * lh) / 2 + lh * 0.78;
    n.lines.forEach((ln, i) => {
      parts.push(`<text x="${cx}" y="${startY + i * lh}" text-anchor="middle" font-family="${FONT_STACK}" font-size="${NODE_FONT}" fill="${STYLE.text}">${esc(ln)}</text>`);
    });
  }
  return parts.join('\n');
}

// Content bbox so edge labels / side channels never clip the canvas.
function contentBBox(layout, routes) {
  let minX = 0, minY = 0, maxX = layout.width, maxY = layout.height;
  const grow = (x, y) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); };
  for (const n of Object.values(layout.nodes)) {
    if (n.isDummy) continue; grow(n.x, n.y); grow(n.x + n.w, n.y + n.h);
  }
  for (const r of routes) {
    for (const [x, y] of r.poly) grow(x, y);
    if (r.label) {
      const [lx, ly] = r.labelAt || r.poly[Math.floor(r.poly.length / 2)];
      const w = r.label.length * 7 + 8;
      grow(lx - w / 2, ly - 9); grow(lx + w / 2, ly + 9);
    }
  }
  return { minX, minY, maxX, maxY };
}

export function renderGraph(layout, routes) {
  const { nodes } = layout;
  const m = 6;
  const b = contentBBox(layout, routes);
  const x0 = b.minX - m, y0 = b.minY - m;
  const w = b.maxX - b.minX + m * 2, h = b.maxY - b.minY + m * 2;
  const body = [
    `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#ffffff"/>`,
    ...routes.map(edgeSVG),
    ...Object.values(nodes).map((n) => (n.isDummy ? '' : `<g data-id="${n.id}" class="hk-node">${nodeSVG(n)}</g>`)),
  ].join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x0} ${y0} ${w} ${h}" shape-rendering="geometricPrecision">\n${body}\n</svg>`;
}

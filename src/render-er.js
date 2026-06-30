// ER diagram: entity tables + orthogonal connectors with crow's-foot ends.

import { FONT_STACK, EDGE } from './theme.js';
import { textWidth, lineHeight } from './measure.js';
import { layoutGraph } from './layout-graph.js';
import { routeGraph } from './route-graph.js';

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const HEAD_F = 13, ROW_F = 12;
const STYLE = { header: '#cfe0f0', body: '#ffffff', border: '#5b7aa0', text: '#1f3a55' };

function attrText(a) {
  return { left: `${a.type || ''} ${a.name}`.trim(), right: a.keys.join(', ') };
}

export function layoutER(ir) {
  const nodes = ir.entities.map((ent) => {
    const rows = ent.attrs.map(attrText);
    const headW = textWidth(ent.id, HEAD_F) + 24;
    const rowW = Math.max(40, ...rows.map((r) => textWidth(r.left, ROW_F) + (r.right ? textWidth(r.right, ROW_F) + 18 : 0) + 24));
    const w = Math.max(110, Math.ceil(Math.max(headW, rowW)));
    const headH = lineHeight(HEAD_F) + 10;
    const h = headH + rows.length * (lineHeight(ROW_F) + 4) + (rows.length ? 6 : 0);
    return { id: ent.id, shape: 'rect', w, h, headH, rows, lines: [] };
  });
  const edges = ir.rels.map((r) => ({ from: r.a, to: r.b, style: r.style, arrow: false, label: r.label, rel: r }));
  return layoutGraph({ direction: 'TB', nodes, edges });
}

function symbols(code) {
  return { many: /[{}]/.test(code), optional: /o/.test(code), one: /\|/.test(code) };
}

// P: point on box border; dir: unit vector along the line away from the box.
function crowFoot(P, dir, code, color) {
  const [px, py] = P;
  const ux = dir[0], uy = dir[1];
  const vx = -uy, vy = ux; // perpendicular
  const along = (d) => [px + ux * d, py + uy * d];
  const perp = (pt, d) => [pt[0] + vx * d, pt[1] + vy * d];
  const s = symbols(code);
  const out = [];
  const line = (a, b) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${color}" stroke-width="1.4"/>`;

  if (s.many) {
    const apex = along(14);
    out.push(line(apex, P), line(apex, perp(P, 7)), line(apex, perp(P, -7)));
  }
  let d = s.many ? 16 : 11;
  if (s.optional) {
    const c = along(d + 4);
    out.push(`<circle cx="${c[0]}" cy="${c[1]}" r="4" fill="#fff" stroke="${color}" stroke-width="1.4"/>`);
    if (s.one) { const t = along(d + 12); out.push(line(perp(t, 6), perp(t, -6))); }
  } else if (s.one) {
    const t = along(d);
    out.push(line(perp(t, 6), perp(t, -6)));
    if (!s.many) { const t2 = along(d + 6); out.push(line(perp(t2, 6), perp(t2, -6))); }
  }
  return out.join('');
}

function unit(a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
}

function entitySVG(n) {
  const { x, y, w, h, headH, rows } = n;
  const out = [
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${STYLE.body}" stroke="${STYLE.border}" stroke-width="1.3"/>`,
    `<path d="M${x} ${y + headH} L${x} ${y + 2} Q${x} ${y} ${x + 2} ${y} L${x + w - 2} ${y} Q${x + w} ${y} ${x + w} ${y + 2} L${x + w} ${y + headH} Z" fill="${STYLE.header}"/>`,
    `<text x="${x + w / 2}" y="${y + headH - 8}" text-anchor="middle" font-family="${FONT_STACK}" font-size="${HEAD_F}" font-weight="bold" fill="${STYLE.text}">${esc(n.id)}</text>`,
    `<line x1="${x}" y1="${y + headH}" x2="${x + w}" y2="${y + headH}" stroke="${STYLE.border}" stroke-width="1"/>`,
  ];
  const rh = lineHeight(ROW_F) + 4;
  rows.forEach((r, i) => {
    const ty = y + headH + (i + 1) * rh - 6;
    out.push(`<text x="${x + 10}" y="${ty}" font-family="${FONT_STACK}" font-size="${ROW_F}" fill="#1b1b1b">${esc(r.left)}</text>`);
    if (r.right) out.push(`<text x="${x + w - 10}" y="${ty}" text-anchor="end" font-family="${FONT_STACK}" font-size="${ROW_F}" font-style="italic" fill="#6a3a86">${esc(r.right)}</text>`);
  });
  return out.join('\n');
}

export function renderER(layout) {
  const routes = routeGraph(layout);
  const nodes = Object.values(layout.nodes).filter((n) => !n.isDummy);

  // bbox
  let minX = 0, minY = 0, maxX = layout.width, maxY = layout.height;
  for (const r of routes) for (const [x, y] of r.poly) { minX = Math.min(minX, x - 20); minY = Math.min(minY, y - 20); maxX = Math.max(maxX, x + 20); maxY = Math.max(maxY, y + 20); }
  const m = 6, x0 = minX - m, y0 = minY - m, W = maxX - minX + 2 * m, H = maxY - minY + 2 * m;

  const parts = [`<rect x="${x0}" y="${y0}" width="${W}" height="${H}" fill="#ffffff"/>`];

  for (const r of routes) {
    const d = r.poly.map(([x, y], i) => `${i ? 'L' : 'M'}${x + 0.5} ${y + 0.5}`).join(' ');
    const dash = r.style === 'dashed' ? ` stroke-dasharray="${EDGE.dash}"` : '';
    parts.push(`<path d="${d}" fill="none" stroke="${EDGE.color}" stroke-width="${EDGE.width}" stroke-linejoin="round"${dash}/>`);
    const rel = r.edge.rel;
    const aP = r.poly[0], aDir = unit(r.poly[0], r.poly[1]);
    const bP = r.poly[r.poly.length - 1], bDir = unit(r.poly[r.poly.length - 1], r.poly[r.poly.length - 2]);
    parts.push(crowFoot(aP, aDir, rel.aCard, EDGE.color));
    parts.push(crowFoot(bP, bDir, rel.bCard, EDGE.color));
    if (r.label) {
      const [lx, ly] = r.labelAt || r.poly[Math.floor(r.poly.length / 2)];
      const lw = textWidth(r.label, 11) + 10;
      parts.push(`<rect x="${lx - lw / 2}" y="${ly - 9}" width="${lw}" height="18" rx="3" fill="#fff" opacity="0.9"/>`);
      parts.push(`<text x="${lx}" y="${ly + 4}" text-anchor="middle" font-family="${FONT_STACK}" font-size="11" fill="#42505a">${esc(r.label)}</text>`);
    }
  }
  for (const n of nodes) parts.push(`<g data-id="${n.id}" class="hk-node">${entitySVG(n)}</g>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${x0} ${y0} ${W} ${H}" shape-rendering="geometricPrecision">\n${parts.join('\n')}\n</svg>`;
}

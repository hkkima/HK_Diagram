// Render a laid-out class/object diagram + orthogonal routes into an SVG string.

import { FONT, PAD, FONT_STACK, EDGE } from './theme.js';
import { titleText } from './model.js';
import { textWidth } from './measure.js';

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function pathFromSegments(segments) {
  // half-pixel offset for crisp axis-aligned strokes
  return segments
    .map((seg) => seg.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x + 0.5} ${y + 0.5}`).join(' '))
    .join(' ');
}

function renderEdges(routes) {
  const out = [];
  for (const r of routes) {
    const dash = r.style === 'dashed' ? ` stroke-dasharray="${EDGE.dash}"` : '';
    // shared trunk + bus (non-interactive)
    if (r.shared.length) {
      out.push(
        `<path d="${pathFromSegments(r.shared)}" fill="none" ` +
        `stroke="${EDGE.color}" stroke-width="${EDGE.width}" ` +
        `stroke-linecap="round" stroke-linejoin="miter"${dash}/>`
      );
    }
    // per-edge drop segments (clickable / selectable)
    for (const d of r.drops) {
      const dd = pathFromSegments([d.seg]);
      out.push(
        `<g class="hk-edge" data-edge="${d.edgeIndex}">` +
        `<path class="hit" d="${dd}" fill="none" stroke="transparent" stroke-width="12"/>` +
        `<path d="${dd}" fill="none" stroke="${EDGE.color}" stroke-width="${EDGE.width}" ` +
        `stroke-linecap="round" stroke-linejoin="miter"${dash}/>` +
        `</g>`
      );
    }
  }
  return out.join('\n');
}

function renderNode(n) {
  const { x, y, w, h, headerH, swatch } = n;
  const cx = x + w / 2;
  const parts = [];

  // body
  parts.push(
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" ` +
    `fill="${swatch.body}" stroke="${swatch.border}" stroke-width="1.3"/>`
  );
  // header band (clip top corners by overlaying then redrawing border last)
  parts.push(
    `<path d="M${x} ${y + headerH} L${x} ${y + 2} Q${x} ${y} ${x + 2} ${y} ` +
    `L${x + w - 2} ${y} Q${x + w} ${y} ${x + w} ${y + 2} L${x + w} ${y + headerH} Z" ` +
    `fill="${swatch.header}"/>`
  );

  // title
  const title = titleText(n);
  const titleBaseline = y + PAD.titlePadY + FONT.title * 0.9;
  const italic = n.kind === 'class' ? ' font-style="italic"' : '';
  parts.push(
    `<text x="${cx}" y="${titleBaseline}" text-anchor="middle" ` +
    `font-family="${FONT_STACK}" font-size="${FONT.title}" font-weight="bold"${italic} ` +
    `fill="${swatch.text}">${esc(title)}</text>`
  );
  // object title underline
  if (n.kind === 'object') {
    const tw = textWidth(title, FONT.title);
    parts.push(
      `<line x1="${cx - tw / 2}" y1="${titleBaseline + 2.5}" x2="${cx + tw / 2}" ` +
      `y2="${titleBaseline + 2.5}" stroke="${swatch.text}" stroke-width="1"/>`
    );
  }

  // title separator
  parts.push(
    `<line x1="${x}" y1="${y + headerH}" x2="${x + w}" y2="${y + headerH}" ` +
    `stroke="${swatch.border}" stroke-width="1"/>`
  );

  // body rows: members (left-aligned) and group dividers (centered italic band)
  const rows = n.rows || [];
  rows.forEach((r, i) => {
    if (r.kind === 'group') {
      if (i > 0) parts.push(
        `<line x1="${x}" y1="${y + r.y}" x2="${x + w}" y2="${y + r.y}" stroke="${swatch.border}" stroke-width="1"/>`
      );
      parts.push(`<rect x="${x + 1}" y="${y + r.y}" width="${w - 2}" height="${r.h}" fill="#00000010"/>`);
      const gy = y + r.y + r.h / 2 + FONT.member * 0.34;
      parts.push(
        `<text x="${cx}" y="${gy}" text-anchor="middle" font-family="${FONT_STACK}" ` +
        `font-size="${FONT.member}" font-style="italic" font-weight="bold" fill="#566370">${esc(r.text)}</text>`
      );
    } else {
      const ty = y + r.y + FONT.member * 0.95;
      parts.push(
        `<text x="${x + PAD.boxPadX}" y="${ty}" font-family="${FONT_STACK}" ` +
        `font-size="${FONT.member}" fill="#1b1b1b">${esc(r.text)}</text>`
      );
    }
  });
  // attribute / method divider (no-group mode)
  if (n.methodDivY != null) parts.push(
    `<line x1="${x}" y1="${y + n.methodDivY}" x2="${x + w}" y2="${y + n.methodDivY}" stroke="${swatch.border}" stroke-width="1"/>`
  );

  // re-stroke outer border so it sits above the header fill
  parts.push(
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" ` +
    `fill="none" stroke="${swatch.border}" stroke-width="1.3"/>`
  );

  return parts.join('\n');
}

export function renderSVG(layout, routes) {
  const { width, height, nodes } = layout;
  const body = [
    `<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`,
    renderEdges(routes),
    ...Object.values(nodes).map((n) => `<g data-id="${n.id}" class="hk-node">${renderNode(n)}</g>`),
  ].join('\n');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}" shape-rendering="geometricPrecision">\n${body}\n</svg>`
  );
}

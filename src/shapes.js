// Node shapes for flowchart / state diagrams: sizing + SVG outline.

import { textWidth, lineHeight } from './measure.js';

export const NODE_FONT = 13;

export function splitLabel(label) {
  return String(label ?? '').split(/<br\s*\/?>|\\n|\n/).map((s) => s.trim());
}

export function sizeGraphNode(node) {
  const lines = splitLabel(node.label);
  const tw = Math.max(10, ...lines.map((l) => textWidth(l, NODE_FONT)));
  const th = lines.length * lineHeight(NODE_FONT);
  let w = tw + 30, h = th + 18;

  switch (node.shape) {
    case 'diamond': w = tw * 1.5 + 44; h = th + 46; break;
    case 'circle': { const d = Math.max(tw + 26, th + 26); w = d; h = d; break; }
    case 'stadium':
    case 'round': w = tw + 38; break;
    case 'subroutine': w = tw + 46; break;
    case 'cylinder': h = th + 30; break;
    case 'start': case 'end': w = 20; h = 20; break; // state initial/final markers
  }
  return { w: Math.round(w), h: Math.round(h), lines };
}

// SVG outline element(s) for a node, given resolved geometry + colors.
export function shapeOutline(n, fill, stroke, sw = 1.4) {
  const { x, y, w, h } = n;
  const a = `fill="${fill}" stroke="${stroke}" stroke-width="${sw}"`;
  switch (n.shape) {
    case 'round':
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" ${a}/>`;
    case 'stadium':
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" ${a}/>`;
    case 'diamond': {
      const cx = x + w / 2, cy = y + h / 2;
      return `<polygon points="${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}" ${a}/>`;
    }
    case 'circle':
      return `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" ${a}/>`;
    case 'cylinder': {
      const ry = 7, cx = x + w / 2;
      return (
        `<path d="M${x} ${y + ry} A${w / 2} ${ry} 0 0 1 ${x + w} ${y + ry} ` +
        `L${x + w} ${y + h - ry} A${w / 2} ${ry} 0 0 1 ${x} ${y + h - ry} Z" ${a}/>` +
        `<path d="M${x} ${y + ry} A${w / 2} ${ry} 0 0 0 ${x + w} ${y + ry}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`
      );
    }
    case 'subroutine':
      return (
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${a}/>` +
        `<line x1="${x + 6}" y1="${y}" x2="${x + 6}" y2="${y + h}" stroke="${stroke}" stroke-width="${sw}"/>` +
        `<line x1="${x + w - 6}" y1="${y}" x2="${x + w - 6}" y2="${y + h}" stroke="${stroke}" stroke-width="${sw}"/>`
      );
    case 'start': // filled initial-state dot
      return `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${w / 2}" fill="${stroke}" stroke="${stroke}"/>`;
    case 'end': // final-state ring
      return (
        `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${w / 2}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>` +
        `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${w / 2 - 4}" fill="${stroke}"/>`
      );
    default: // rect
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" ${a}/>`;
  }
}

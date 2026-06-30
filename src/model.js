// Intermediate representation (IR) helpers and box sizing.
//
// Node IR:
//   { id, kind:'class'|'object', name, type, stereotype, sections:[[line,...],...] }
// Edge IR:
//   { from, to, kind:'inheritance'|'realization'|'dependency'|'association', style:'solid'|'dashed' }

import { FONT, PAD } from './theme.js';
import { textWidth, lineHeight } from './measure.js';

// Title text shown in the header band.
export function titleText(node) {
  if (node.kind === 'object') {
    return node.type ? `${node.name} : ${node.type}` : node.name;
  }
  return node.name;
}

// Compute box geometry: total width/height plus per-section vertical layout.
// Returns { w, h, headerH, sections:[{y,h,lines}] }.
export function sizeNode(node) {
  const title = titleText(node);
  const titleLH = lineHeight(FONT.title);
  const stereoLH = node.stereotype ? lineHeight(FONT.stereotype) : 0;
  const headerH = PAD.titlePadY * 2 + titleLH + (node.stereotype ? stereoLH : 0);

  const memberLH = lineHeight(FONT.member);
  const sections = [];
  let y = headerH;
  for (const lines of node.sections) {
    if (!lines.length) continue;
    const h = PAD.rowPadY * 2 + lines.length * memberLH + (lines.length - 1) * (PAD.lineGap - 2);
    sections.push({ y, h, lines });
    y += h;
  }
  const h = y;

  // Width: widest of title, stereotype, and all member lines + padding.
  let contentW = textWidth(title, FONT.title);
  if (node.stereotype) {
    contentW = Math.max(contentW, textWidth(`(${node.stereotype})`, FONT.stereotype));
  }
  for (const lines of node.sections) {
    for (const ln of lines) contentW = Math.max(contentW, textWidth(ln, FONT.member));
  }
  const w = Math.max(120, Math.ceil(contentW + PAD.boxPadX * 2));

  return { w, h, headerH, sections };
}

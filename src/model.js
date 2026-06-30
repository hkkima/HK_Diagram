// IR helpers and box sizing for class/object diagrams.
//
// Node IR:
//   { id, kind:'class'|'object', name, type,
//     body: [ {group:true,label} | {group:false,text} ] }   // ordered
//
// `<<label>>` entries are in-body group dividers (human-facing section labels),
// not class-level stereotypes.

import { FONT, PAD } from './theme.js';
import { textWidth, lineHeight } from './measure.js';

export function titleText(node) {
  if (node.kind === 'object') {
    return node.type ? `${node.name} : ${node.type}` : node.name;
  }
  return node.name;
}

// Lay out body rows. Returns { headerH, rows:[{kind,text,y,h}], methodDivY, h }.
// y is relative to the box top.
export function computeBody(node) {
  const memberLH = lineHeight(FONT.member);
  const groupLH = lineHeight(FONT.member) + 6;
  const entries = node.body || [];
  const hasGroups = entries.some((e) => e.group);
  const headerH = PAD.titlePadY * 2 + lineHeight(FONT.title);

  const rows = [];
  let y = headerH + PAD.rowPadY;
  let methodDivY = null;

  if (hasGroups) {
    for (const e of entries) {
      if (e.group) { rows.push({ kind: 'group', text: e.label, y, h: groupLH }); y += groupLH; }
      else { rows.push({ kind: 'member', text: e.text, y, h: memberLH }); y += memberLH; }
    }
  } else {
    // no explicit groups: classic attribute / method split
    const attrs = entries.filter((e) => !/[()]/.test(e.text));
    const methods = entries.filter((e) => /[()]/.test(e.text));
    for (const e of attrs) { rows.push({ kind: 'member', text: e.text, y, h: memberLH }); y += memberLH; }
    if (attrs.length && methods.length) methodDivY = y;
    for (const e of methods) { rows.push({ kind: 'member', text: e.text, y, h: memberLH }); y += memberLH; }
  }

  const h = rows.length ? y + PAD.rowPadY : headerH;
  return { headerH, rows, methodDivY, h, hasGroups };
}

export function sizeNode(node) {
  const b = computeBody(node);
  let contentW = textWidth(titleText(node), FONT.title);
  for (const e of node.body || []) {
    contentW = Math.max(contentW, textWidth(e.group ? e.label : e.text, FONT.member));
  }
  const w = Math.max(120, Math.ceil(contentW + PAD.boxPadX * 2));
  return { w, h: b.h, headerH: b.headerH, rows: b.rows, methodDivY: b.methodDivY };
}

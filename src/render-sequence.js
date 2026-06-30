// Sequence diagram renderer: participants, lifelines, messages, notes, frames.

import { FONT_STACK, EDGE } from './theme.js';
import { textWidth } from './measure.js';

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const PART = { fill: '#e9f2fb', border: '#3d7ebf', text: '#16324f' };
const NOTE_C = { fill: '#fff6d6', border: '#c9a227', text: '#5a4a00' };
const FRAME_C = { border: '#9aa7b2', label: '#5b6770', tab: '#eef1f4' };

const PAD_X = 16, GAP = 46, TOP = 12, BOX_H = 34;
const MSG_H = 40, NOTE_PAD = 10, FRAME_PAD = 36, ELSE_PAD = 26;

export function renderSequence(model) {
  const { participants, events } = model;

  // participant x positions
  const cx = new Map();
  const boxW = new Map();
  let x = PAD_X;
  for (const p of participants) {
    const w = Math.max(80, textWidth(p.label, 13) + 26);
    boxW.set(p.id, w);
    cx.set(p.id, x + w / 2);
    x += w + GAP;
  }
  const totalW = x - GAP + PAD_X;

  // walk events to assign y + collect drawables
  let y = TOP + BOX_H + 24;
  const msgs = [], notes = [];
  const frameStack = [], frames = [];

  for (const ev of events) {
    if (ev.type === 'msg') {
      if (ev.from === ev.to) {
        msgs.push({ ...ev, self: true, y });
        y += MSG_H + 16;
      } else {
        msgs.push({ ...ev, self: false, y });
        y += MSG_H;
      }
    } else if (ev.type === 'note') {
      const xs = ev.parts.map((id) => cx.get(id));
      let nx, nw;
      if (ev.pos === 'over') {
        const lo = Math.min(...xs), hi = Math.max(...xs);
        nw = Math.max(hi - lo + 80, textWidth(ev.text, 12) + 24);
        nx = (lo + hi) / 2 - nw / 2;
      } else {
        nw = textWidth(ev.text, 12) + 24;
        nx = ev.pos === 'right of' ? xs[0] + 12 : xs[0] - 12 - nw;
      }
      notes.push({ x: nx, y: y, w: nw, h: 30, text: ev.text });
      y += 30 + 14;
    } else if (ev.type === 'frameStart') {
      frameStack.push({ kind: ev.kind, label: ev.label, y0: y, elses: [] });
      y += FRAME_PAD;
    } else if (ev.type === 'frameElse') {
      const f = frameStack[frameStack.length - 1];
      if (f) { f.elses.push({ y, label: ev.label }); y += ELSE_PAD; }
    } else if (ev.type === 'frameEnd') {
      const f = frameStack.pop();
      if (f) { f.y1 = y + 6; frames.push(f); y += 14; }
    }
  }
  const bottomY = y + 8;
  const lifelineBottom = bottomY;
  const totalH = bottomY + BOX_H + TOP;

  // frame x-span = all participants involved between y0 and y1 (approx: all)
  const allLo = Math.min(...participants.map((p) => cx.get(p.id) - boxW.get(p.id) / 2));
  const allHi = Math.max(...participants.map((p) => cx.get(p.id) + boxW.get(p.id) / 2));

  const out = [`<rect x="0" y="0" width="${totalW}" height="${totalH}" fill="#ffffff"/>`];

  // lifelines
  for (const p of participants) {
    const X = cx.get(p.id);
    out.push(`<line x1="${X}" y1="${TOP + BOX_H}" x2="${X}" y2="${lifelineBottom}" stroke="#b8c2cc" stroke-width="1.2" stroke-dasharray="4 4"/>`);
  }

  // frames (behind messages)
  for (const f of frames) {
    const fx = allLo - 8, fw = allHi - allLo + 16;
    out.push(`<rect x="${fx}" y="${f.y0}" width="${fw}" height="${f.y1 - f.y0}" rx="2" fill="none" stroke="${FRAME_C.border}" stroke-width="1.2"/>`);
    const tabW = textWidth(f.kind, 11) + 16;
    out.push(`<path d="M${fx} ${f.y0} h${tabW} l-6 12 h-${tabW - 6} Z" fill="${FRAME_C.tab}" stroke="${FRAME_C.border}" stroke-width="1"/>`);
    out.push(`<text x="${fx + 8}" y="${f.y0 + 11}" font-family="${FONT_STACK}" font-size="11" font-weight="bold" fill="${FRAME_C.label}">${esc(f.kind)}</text>`);
    if (f.label) out.push(`<text x="${fx + tabW + 8}" y="${f.y0 + 12}" font-family="${FONT_STACK}" font-size="11" fill="${FRAME_C.label}">[${esc(f.label)}]</text>`);
    for (const el of f.elses) {
      out.push(`<line x1="${fx}" y1="${el.y}" x2="${fx + fw}" y2="${el.y}" stroke="${FRAME_C.border}" stroke-width="1" stroke-dasharray="4 3"/>`);
      if (el.label) out.push(`<text x="${fx + 8}" y="${el.y + 13}" font-family="${FONT_STACK}" font-size="11" fill="${FRAME_C.label}">[${esc(el.label)}]</text>`);
    }
  }

  // messages
  for (const mmsg of msgs) {
    if (mmsg.self) {
      const X = cx.get(mmsg.from), r = 38;
      const yy = mmsg.y;
      out.push(`<path d="M${X} ${yy} h${r} v22 h-${r}" fill="none" stroke="${EDGE.color}" stroke-width="1.4"${mmsg.style === 'dashed' ? ' stroke-dasharray="6 4"' : ''}/>`);
      out.push(arrowHead([X, yy + 22], 'left', mmsg.arrow));
      out.push(`<text x="${X + r + 6}" y="${yy + 4}" font-family="${FONT_STACK}" font-size="12" fill="#33414b">${esc(mmsg.text)}</text>`);
    } else {
      const x1 = cx.get(mmsg.from), x2 = cx.get(mmsg.to), yy = mmsg.y;
      const dir = x2 > x1 ? 'right' : 'left';
      const tipX = x2 + (dir === 'right' ? -1 : 1);
      out.push(`<line x1="${x1}" y1="${yy}" x2="${x2}" y2="${yy}" stroke="${EDGE.color}" stroke-width="1.4"${mmsg.style === 'dashed' ? ' stroke-dasharray="6 4"' : ''}/>`);
      out.push(arrowHead([x2, yy], dir, mmsg.arrow));
      const mx = (x1 + x2) / 2;
      out.push(`<text x="${mx}" y="${yy - 6}" text-anchor="middle" font-family="${FONT_STACK}" font-size="12" fill="#33414b">${esc(mmsg.text)}</text>`);
    }
  }

  // notes
  for (const n of notes) {
    out.push(`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="2" fill="${NOTE_C.fill}" stroke="${NOTE_C.border}" stroke-width="1.2"/>`);
    out.push(`<text x="${n.x + n.w / 2}" y="${n.y + n.h / 2 + 4}" text-anchor="middle" font-family="${FONT_STACK}" font-size="12" fill="${NOTE_C.text}">${esc(n.text)}</text>`);
  }

  // participant boxes (top + bottom)
  for (const p of participants) {
    const w = boxW.get(p.id), X = cx.get(p.id) - w / 2;
    out.push(`<g data-id="${p.id}" class="hk-node">`);
    for (const ty of [TOP, bottomY]) {
      out.push(`<rect x="${X}" y="${ty}" width="${w}" height="${BOX_H}" rx="3" fill="${PART.fill}" stroke="${PART.border}" stroke-width="1.3"/>`);
      out.push(`<text x="${cx.get(p.id)}" y="${ty + BOX_H / 2 + 4}" text-anchor="middle" font-family="${FONT_STACK}" font-size="13" font-weight="bold" fill="${PART.text}">${esc(p.label)}</text>`);
    }
    out.push('</g>');
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}" shape-rendering="geometricPrecision">\n${out.join('\n')}\n</svg>`;
  return { svg, layout: { width: totalW, height: totalH } };
}

function arrowHead([x, y], dir, kind) {
  const l = 10, s = 4;
  if (kind === 'cross') {
    const d = 5;
    return `<line x1="${x - d}" y1="${y - d}" x2="${x + d}" y2="${y + d}" stroke="${EDGE.color}" stroke-width="1.6"/><line x1="${x - d}" y1="${y + d}" x2="${x + d}" y2="${y - d}" stroke="${EDGE.color}" stroke-width="1.6"/>`;
  }
  const back = dir === 'right' ? -l : l;
  if (kind === 'open') {
    return `<path d="M${x + back} ${y - s} L${x} ${y} L${x + back} ${y + s}" fill="none" stroke="${EDGE.color}" stroke-width="1.4"/>`;
  }
  return `<polygon points="${x + back},${y - s} ${x + back},${y + s} ${x},${y}" fill="${EDGE.color}"/>`;
}

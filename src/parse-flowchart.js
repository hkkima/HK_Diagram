// mermaid flowchart / graph parser -> IR (nodes with shapes, directed edges).

const SHAPES = [
  ['([', '])', 'stadium'],
  ['[[', ']]', 'subroutine'],
  ['[(', ')]', 'cylinder'],
  ['((', '))', 'circle'],
  ['{', '}', 'diamond'],
  ['[', ']', 'rect'],
  ['(', ')', 'round'],
];

const OP_RE = /(-\.->|-->|==>|---|-\.-|===|--x|--o)(?:\|([^|]*)\|)?/;

function opStyle(op) {
  if (op.includes('.')) return 'dashed';
  if (op.includes('=')) return 'thick';
  return 'solid';
}
const opArrow = (op) => op.includes('>') || op.endsWith('x') || op.endsWith('o');

// Normalize `A -- text --> B` style mid-labels into `A -->|text| B`.
function normalizeMidLabels(line) {
  return line
    .replace(/--\s+([^->|]+?)\s+-->/g, '-->|$1|')
    .replace(/==\s+([^=|]+?)\s+==>/g, '==>|$1|')
    .replace(/-\.\s+([^.|]+?)\s+\.->/g, '-.->|$1|');
}

function readNode(str, nodes) {
  const m = str.match(/^([A-Za-z0-9_]+)\s*/);
  if (!m) return null;
  const id = m[1];
  let rest = str.slice(m[0].length);
  let label = id, shape = 'rect', defined = false;
  for (const [open, close, sh] of SHAPES) {
    if (rest.startsWith(open)) {
      const end = rest.indexOf(close, open.length);
      if (end !== -1) {
        label = rest.slice(open.length, end).replace(/^["']|["']$/g, '');
        shape = sh; defined = true;
        rest = rest.slice(end + close.length);
        break;
      }
    }
  }
  if (!nodes.has(id)) nodes.set(id, { id, label, shape });
  else if (defined) { const n = nodes.get(id); n.label = label; n.shape = shape; }
  return { id, rest };
}

export function parseFlowchart(text) {
  const nodes = new Map();
  const edges = [];
  const lines = text.split(/\r?\n/);
  let direction = 'TB';

  for (let raw of lines) {
    let line = raw.trim().replace(/;+$/, '');
    if (!line || line.startsWith('%%')) continue;
    const head = line.match(/^(?:flowchart|graph)\s+(TB|TD|BT|LR|RL)/i);
    if (head) { direction = head[1].toUpperCase() === 'TD' ? 'TB' : head[1].toUpperCase(); continue; }
    if (/^(flowchart|graph)\b/i.test(line)) { direction = 'TB'; continue; }
    if (/^direction\s+(TB|TD|BT|LR|RL)/i.test(line)) {
      direction = RegExp.$1.toUpperCase() === 'TD' ? 'TB' : RegExp.$1.toUpperCase(); continue;
    }
    if (/^(subgraph|end|click|style|classDef|class|linkStyle)\b/.test(line)) continue;

    line = normalizeMidLabels(line);
    // walk: node (op node)+
    let cursor = line;
    let prev = readNode(cursor, nodes);
    if (!prev) continue;
    cursor = prev.rest.trim();
    while (cursor.length) {
      const om = cursor.match(OP_RE);
      if (!om || om.index !== 0) break;
      const op = om[1], label = om[2];
      cursor = cursor.slice(om[0].length).trim();
      const next = readNode(cursor, nodes);
      if (!next) break;
      edges.push({ from: prev.id, to: next.id, style: opStyle(op), arrow: opArrow(op), label: label?.trim() || null });
      prev = next;
      cursor = next.rest.trim();
    }
  }

  return { type: 'flowchart', direction, nodes: [...nodes.values()], edges };
}

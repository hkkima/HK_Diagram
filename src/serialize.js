// IR -> mermaid text (round-trip / reverse generation). Browser-safe.

function serializeClass(ir) {
  const L = ['classDiagram'];
  for (const n of ir.nodes) {
    L.push(`    class ${n.id} {`);
    for (const e of n.body || []) {
      L.push(e.group ? `        <<${e.label}>>` : `        ${e.text}`);
    }
    L.push('    }');
  }
  for (const e of ir.edges) {
    const op = e.kind === 'inheritance' ? '<|--'
      : e.kind === 'realization' ? '<|..'
      : e.style === 'dashed' ? '<..' : '<--';
    L.push(`    ${e.parent} ${op} ${e.child}${e.label ? ` : ${e.label}` : ''}`);
  }
  return L.join('\n');
}

function shapeWrap(n) {
  const l = n.label ?? n.id;
  switch (n.shape) {
    case 'round': return `(${l})`;
    case 'stadium': return `([${l}])`;
    case 'subroutine': return `[[${l}]]`;
    case 'cylinder': return `[(${l})]`;
    case 'circle': return `((${l}))`;
    case 'diamond': return `{${l}}`;
    default: return `[${l}]`;
  }
}
function flowOp(e) {
  if (e.style === 'dashed') return e.arrow === false ? '-.-' : '-.->';
  if (e.style === 'thick') return e.arrow === false ? '===' : '==>';
  return e.arrow === false ? '---' : '-->';
}
function serializeFlowchart(ir) {
  const L = [`flowchart ${ir.direction || 'TB'}`];
  // node declarations first (declaration order is authoritative for layout/drag)
  for (const n of ir.nodes) L.push(`    ${n.id}${shapeWrap(n)}`);
  for (const e of ir.edges) {
    const lbl = e.label ? `|${e.label}|` : '';
    L.push(`    ${e.from} ${flowOp(e)}${lbl} ${e.to}`);
  }
  return L.join('\n');
}

function serializeState(ir) {
  const L = ['stateDiagram-v2'];
  if (ir.direction && ir.direction !== 'TB') L.push(`    direction ${ir.direction}`);
  for (const n of ir.nodes) {
    if (n.shape === 'start' || n.shape === 'end') continue;
    if (n.label && n.label !== n.id) L.push(`    state "${n.label}" as ${n.id}`);
  }
  const disp = (id) => (id === '__start' || id === '__end') ? '[*]' : id;
  for (const e of ir.edges) L.push(`    ${disp(e.from)} --> ${disp(e.to)}${e.label ? ` : ${e.label}` : ''}`);
  return L.join('\n');
}

function serializeER(ir) {
  const L = ['erDiagram'];
  for (const e of ir.entities) {
    if (!e.attrs.length) continue;
    L.push(`    ${e.id} {`);
    for (const a of e.attrs) L.push(`        ${a.type || 'string'} ${a.name}${a.keys.length ? ' ' + a.keys.join(' ') : ''}`);
    L.push('    }');
  }
  for (const r of ir.rels) {
    const link = r.style === 'dashed' ? '..' : '--';
    L.push(`    ${r.a} ${r.aCard}${link}${r.bCard} ${r.b} : ${r.label || ''}`);
  }
  return L.join('\n');
}

function seqTok(ev) {
  if (ev.style === 'dashed') return ev.arrow === 'filled' ? '-->>' : '-->';
  if (ev.arrow === 'filled') return '->>';
  if (ev.arrow === 'cross') return '-x';
  return '->';
}
function serializeSequence(model) {
  const L = ['sequenceDiagram'];
  for (const p of model.participants) L.push(`    participant ${p.id}${p.label !== p.id ? ` as ${p.label}` : ''}`);
  let indent = '    ';
  for (const ev of model.events) {
    if (ev.type === 'msg') L.push(`${indent}${ev.from}${seqTok(ev)}${ev.to}: ${ev.text}`);
    else if (ev.type === 'note') L.push(`${indent}Note ${ev.pos} ${ev.parts.join(',')}: ${ev.text}`);
    else if (ev.type === 'frameStart') { L.push(`${indent}${ev.kind} ${ev.label}`.trimEnd()); indent += '    '; }
    else if (ev.type === 'frameElse') L.push(`${indent.slice(4)}else ${ev.label}`.trimEnd());
    else if (ev.type === 'frameEnd') { indent = indent.slice(4); L.push(`${indent}end`); }
  }
  return L.join('\n');
}

function serializeBody(ir) {
  switch (ir.type) {
    case 'classDiagram': return serializeClass(ir);
    case 'flowchart': return serializeFlowchart(ir);
    case 'stateDiagram': return serializeState(ir);
    case 'erDiagram': return serializeER(ir);
    case 'sequenceDiagram': return serializeSequence(ir);
    default: throw new Error('serialize: unknown type ' + ir.type);
  }
}

export function serialize(ir) {
  let out = serializeBody(ir);
  const pos = ir.positions || {};
  const lines = Object.entries(pos).map(([id, p]) => `%% hkpos ${id} ${Math.round(p.x)} ${Math.round(p.y)}`);
  if (lines.length) out += '\n' + lines.join('\n');
  return out;
}

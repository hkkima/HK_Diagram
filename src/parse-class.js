// Minimal mermaid `classDiagram` parser -> IR.
// Supports: class blocks, <<stereotype>>, +member/+method(), `name = value`
// (auto-detected as object/instance), and relations with parent/child +
// solid/dashed resolution.

function makeNode(id) {
  return { id, kind: 'class', name: id, type: null, stereotype: null,
           _attrs: [], _methods: [], _values: [] };
}

const RELATION =
  /^(\S+)\s+([<>|o*.\-]{2,})\s+(\S+?)(?:\s*:\s*(.+))?$/;

function classifyConnector(conn) {
  const style = conn.includes('..') ? 'dashed' : 'solid';
  const hasTriangle = conn.includes('|');
  // parent = the endpoint the arrow/triangle points at
  let parentSide = 'lhs';
  if (/^<|^\</.test(conn)) parentSide = 'lhs';
  else if (/>$/.test(conn)) parentSide = 'rhs';
  else parentSide = 'lhs';
  const kind = hasTriangle ? (style === 'dashed' ? 'realization' : 'inheritance') : 'dependency';
  return { style, kind, parentSide };
}

export function parseClassDiagram(text) {
  const nodes = new Map();
  const edges = [];
  const get = (id) => {
    if (!nodes.has(id)) nodes.set(id, makeNode(id));
    return nodes.get(id);
  };

  const lines = text.split(/\r?\n/);
  let cur = null; // current class block

  for (let raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('%%')) continue;
    if (/^classDiagram(-v2)?$/.test(line)) continue;
    if (line === 'direction TB' || /^direction\s/.test(line)) continue;

    // close block
    if (line === '}') { cur = null; continue; }

    // open block: `class Foo {` (enters body) or bare `class Foo` (declaration)
    const open = line.match(/^class\s+([^\s{]+)\s*(\{?)$/);
    if (open) {
      const node = get(open[1]);
      cur = open[2] === '{' ? node : null;
      continue;
    }

    // inside a class block
    if (cur) {
      const m = line.match(/^<<(.+)>>$/);
      if (m) { cur.stereotype = m[1].trim(); continue; }
      if (/[=]/.test(line) && !/[()]/.test(line)) { cur._values.push(line); continue; }
      if (/[()]/.test(line)) { cur._methods.push(line); continue; }
      cur._attrs.push(line);
      continue;
    }

    // relation line
    const rel = line.match(RELATION);
    if (rel) {
      const [, lhs, conn, rhs, label] = rel;
      const { style, kind, parentSide } = classifyConnector(conn);
      const parent = parentSide === 'lhs' ? lhs : rhs;
      const child = parentSide === 'lhs' ? rhs : lhs;
      get(parent); get(child);
      edges.push({ parent, child, kind, style, label: label?.trim() || null });
      continue;
    }
  }

  // finalize node kinds + sections
  for (const n of nodes.values()) {
    if (n._values.length) {
      n.kind = 'object';
      n.sections = [n._values];
    } else {
      n.kind = 'class';
      n.sections = [n._attrs, n._methods];
    }
    delete n._attrs; delete n._methods; delete n._values;
  }

  // objects inherit their type name from the class that points at them
  for (const e of edges) {
    const child = nodes.get(e.child), parent = nodes.get(e.parent);
    if (child && parent && child.kind === 'object' && parent.kind === 'class' && !child.type) {
      child.type = parent.name;
    }
  }

  return { type: 'classDiagram', nodes: [...nodes.values()], edges };
}

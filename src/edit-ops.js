// Type-aware IR mutations for the visual editor (browser-safe).

function uniqueId(existing, base) {
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(base + i)) i++;
  return base + i;
}

// Selectable primary elements per type -> [{id, name}]
export function listElements(ir) {
  if (ir.type === 'erDiagram') return ir.entities.map((e) => ({ id: e.id, name: e.id }));
  if (ir.type === 'sequenceDiagram') return ir.participants.map((p) => ({ id: p.id, name: p.label }));
  return ir.nodes.map((n) => ({ id: n.id, name: n.label ?? n.name ?? n.id }));
}

export function findElement(ir, id) {
  if (ir.type === 'erDiagram') return ir.entities.find((e) => e.id === id);
  if (ir.type === 'sequenceDiagram') return ir.participants.find((p) => p.id === id);
  return ir.nodes.find((n) => n.id === id);
}

export function existingIds(ir) {
  return new Set(listElements(ir).map((e) => e.id));
}

export function addNode(ir) {
  const ids = existingIds(ir);
  const id = uniqueId(ids, ir.type === 'erDiagram' ? 'Entity' : 'Node');
  if (ir.type === 'classDiagram') ir.nodes.push({ id, kind: 'class', name: id, type: null, body: [] });
  else if (ir.type === 'flowchart') ir.nodes.push({ id, label: id, shape: 'rect' });
  else if (ir.type === 'stateDiagram') ir.nodes.push({ id, label: id, shape: 'round', kind: 'state' });
  else if (ir.type === 'erDiagram') ir.entities.push({ id, attrs: [{ type: 'int', name: 'id', keys: ['PK'] }] });
  else if (ir.type === 'sequenceDiagram') ir.participants.push({ id, label: id });
  return id;
}

export function deleteNode(ir, id) {
  if (ir.type === 'classDiagram') {
    ir.nodes = ir.nodes.filter((n) => n.id !== id);
    ir.edges = ir.edges.filter((e) => e.parent !== id && e.child !== id);
  } else if (ir.type === 'flowchart' || ir.type === 'stateDiagram') {
    ir.nodes = ir.nodes.filter((n) => n.id !== id);
    ir.edges = ir.edges.filter((e) => e.from !== id && e.to !== id);
  } else if (ir.type === 'erDiagram') {
    ir.entities = ir.entities.filter((e) => e.id !== id);
    ir.rels = ir.rels.filter((r) => r.a !== id && r.b !== id);
  } else if (ir.type === 'sequenceDiagram') {
    ir.participants = ir.participants.filter((p) => p.id !== id);
    ir.events = ir.events.filter((ev) => {
      if (ev.type === 'msg') return ev.from !== id && ev.to !== id;
      if (ev.type === 'note') { ev.parts = ev.parts.filter((p) => p !== id); return ev.parts.length > 0; }
      return true;
    });
  }
}

export function renameNode(ir, oldId, newId) {
  if (!newId || oldId === newId || existingIds(ir).has(newId)) return false;
  const el = findElement(ir, oldId);
  if (!el) return false;
  el.id = newId;
  if (el.name !== undefined) el.name = newId;
  if (ir.type === 'classDiagram') for (const e of ir.edges) { if (e.parent === oldId) e.parent = newId; if (e.child === oldId) e.child = newId; }
  else if (ir.type === 'flowchart' || ir.type === 'stateDiagram') for (const e of ir.edges) { if (e.from === oldId) e.from = newId; if (e.to === oldId) e.to = newId; }
  else if (ir.type === 'erDiagram') for (const r of ir.rels) { if (r.a === oldId) r.a = newId; if (r.b === oldId) r.b = newId; }
  else if (ir.type === 'sequenceDiagram') for (const ev of ir.events) {
    if (ev.type === 'msg') { if (ev.from === oldId) ev.from = newId; if (ev.to === oldId) ev.to = newId; }
    else if (ev.type === 'note') ev.parts = ev.parts.map((p) => (p === oldId ? newId : p));
  }
  return true;
}

// Editable edge array per type (class/flowchart/state: ir.edges; er: ir.rels).
export function edgeList(ir) {
  if (ir.type === 'erDiagram') return ir.rels;
  if (ir.type === 'sequenceDiagram') return null; // sequence edges are events; not edited here
  return ir.edges;
}

export function deleteEdge(ir, index) {
  const list = edgeList(ir);
  if (list && index >= 0 && index < list.length) list.splice(index, 1);
}

export function addEdge(ir, from, to) {
  if (from === to && ir.type !== 'sequenceDiagram' && ir.type !== 'stateDiagram') return;
  if (ir.type === 'classDiagram') ir.edges.push({ parent: from, child: to, kind: 'inheritance', style: 'solid', label: null });
  else if (ir.type === 'flowchart') ir.edges.push({ from, to, style: 'solid', arrow: true, label: null });
  else if (ir.type === 'stateDiagram') ir.edges.push({ from, to, style: 'solid', arrow: true, label: null });
  else if (ir.type === 'erDiagram') ir.rels.push({ a: from, b: to, aCard: '||', bCard: 'o{', style: 'solid', label: '' });
  else if (ir.type === 'sequenceDiagram') ir.events.push({ type: 'msg', from, to, style: 'solid', arrow: 'filled', text: 'message' });
}

// Reorder declaration so the dragged element lands at target index among peers.
export function reorderByPeers(ir, draggedId, orderedPeerIds) {
  const rank = new Map(orderedPeerIds.map((id, i) => [id, i]));
  const key = (id) => (rank.has(id) ? rank.get(id) : Infinity);
  if (ir.type === 'erDiagram') stableReorder(ir.entities, (e) => e.id, key);
  else if (ir.type === 'sequenceDiagram') stableReorder(ir.participants, (p) => p.id, key);
  else if (ir.type === 'classDiagram') {
    // siblings are edge-driven: reorder child-edges sharing the dragged node's parent
    const pe = ir.edges.find((e) => e.child === draggedId);
    if (pe) {
      const parent = pe.parent;
      const sib = ir.edges.filter((e) => e.parent === parent);
      sib.sort((a, b) => key(a.child) - key(b.child));
      let i = 0;
      ir.edges = ir.edges.map((e) => (e.parent === parent ? sib[i++] : e));
    } else stableReorder(ir.nodes, (n) => n.id, key);
  } else stableReorder(ir.nodes, (n) => n.id, key);
}

function stableReorder(arr, idOf, key) {
  const peers = arr.filter((x) => key(idOf(x)) !== Infinity).sort((a, b) => key(idOf(a)) - key(idOf(b)));
  let i = 0;
  for (let j = 0; j < arr.length; j++) if (key(idOf(arr[j])) !== Infinity) arr[j] = peers[i++];
}

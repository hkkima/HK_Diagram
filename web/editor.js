// HK_Diagram visual editor: two-way sync between mermaid text and the diagram.
import { renderToSVG, detectType } from '../src/render.js';
import { parseAny } from '../src/ir.js';
import { serialize } from '../src/serialize.js';
import { findElement, addNode, deleteNode, renameNode, addEdge, reorderByPeers, edgeList, deleteEdge } from '../src/edit-ops.js';

const $ = (id) => document.getElementById(id);
const code = $('code'), stage = $('stage'), panel = $('panel'), kind = $('kind'), example = $('example');

// sel = { kind: 'node'|'edge', id }  (id = node id, or edge index)
let ir = null, sel = null;
let lastSVG = '', lastSize = { w: 0, h: 0 };

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// ---- render from current code -----------------------------------------
function renderFromCode() {
  try {
    kind.textContent = detectType(code.value);
    const { svg } = renderToSVG(code.value);
    lastSVG = svg; stage.innerHTML = svg;
    const el = stage.querySelector('svg');
    lastSize = { w: parseFloat(el.getAttribute('width')), h: parseFloat(el.getAttribute('height')) };
    attachHandlers();
    highlightSelection();
  } catch (e) {
    kind.textContent = ''; stage.innerHTML = '<div class="err">⚠ ' + (e.message || e) + '</div>';
  }
}

function highlightSelection() {
  stage.querySelectorAll('.sel').forEach((g) => g.classList.remove('sel'));
  if (!sel) return;
  const q = sel.kind === 'node' ? `[data-id="${CSS.escape(sel.id)}"]` : `[data-edge="${sel.id}"]`;
  const g = stage.querySelector(q);
  if (g) g.classList.add('sel'); else sel = null;
}

// Mutate IR -> write code -> reparse -> render (keeps everything canonical).
function commit() {
  code.value = serialize(ir);
  ir = parseAny(code.value);
  renderFromCode();
  if (sel) renderPanel(); else clearPanel();
}

// ---- selection + panel -------------------------------------------------
function selectNode(id) { sel = { kind: 'node', id }; highlightSelection(); renderPanel(); }
function selectEdge(index) { sel = { kind: 'edge', id: index }; highlightSelection(); renderPanel(); }

function clearPanel() {
  panel.innerHTML = '<p class="empty">노드·연결선을 클릭해 편집하세요.</p>';
}

function field(label, value, attrs = '') {
  return `<label>${label}</label><input data-f ${attrs} value="${esc(value ?? '')}">`;
}
function area(label, value, rows = 4) {
  return `<label>${label}</label><textarea data-f rows="${rows}">${esc(value ?? '')}</textarea>`;
}

function selOpts(cur, opts) {
  return opts.map(([v, txt]) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${txt}</option>`).join('');
}

function renderPanel() {
  if (!sel) { clearPanel(); return; }
  if (sel.kind === 'edge') return renderEdgePanel();
  renderNodePanel();
}

function renderNodePanel() {
  const el = findElement(ir, sel.id);
  if (!el) { clearPanel(); return; }
  const t = ir.type;
  let html = `<h2>${t} · ${esc(sel.id)}</h2>`;

  if (t === 'classDiagram') {
    html += field('이름 (id)', el.id, 'data-k="id"');
    if (el.kind === 'object') {
      html += area('값 (한 줄에 하나)', (el.sections[0] || []).join('\n'), 4).replace('data-f', 'data-f data-k="values"');
    } else {
      html += field('스테레오타입', el.stereotype || '', 'data-k="stereo"');
      html += area('속성', (el.sections[0] || []).join('\n'), 3).replace('data-f', 'data-f data-k="attrs"');
      html += area('메서드', (el.sections[1] || []).join('\n'), 3).replace('data-f', 'data-f data-k="methods"');
    }
  } else if (t === 'flowchart') {
    html += field('라벨', el.label, 'data-k="label"');
    html += `<label>도형</label><select data-f data-k="shape">${selOpts(el.shape,
      ['rect', 'round', 'stadium', 'diamond', 'circle', 'cylinder', 'subroutine'].map((s) => [s, s]))}</select>`;
    html += field('이름 (id)', el.id, 'data-k="id"');
  } else if (t === 'stateDiagram') {
    if (el.shape === 'start' || el.shape === 'end') { html += '<p class="empty">시작/종료 마커</p>'; }
    else { html += field('라벨', el.label, 'data-k="label"'); html += field('이름 (id)', el.id, 'data-k="id"'); }
  } else if (t === 'erDiagram') {
    html += field('엔티티명 (id)', el.id, 'data-k="id"');
    html += area('속성 (type name [PK/FK])', el.attrs.map((a) => `${a.type} ${a.name}${a.keys.length ? ' ' + a.keys.join(' ') : ''}`).join('\n'), 5)
      .replace('data-f', 'data-f data-k="erattrs"');
  } else if (t === 'sequenceDiagram') {
    html += field('라벨', el.label, 'data-k="label"');
    html += field('이름 (id)', el.id, 'data-k="id"');
  }
  html += `<button class="danger" data-del>이 노드 삭제</button>`;
  panel.innerHTML = html;
  panel.querySelectorAll('[data-f]').forEach((inp) => {
    inp.addEventListener('change', () => applyNodeField(el, inp.getAttribute('data-k'), inp.value));
  });
  panel.querySelector('[data-del]').addEventListener('click', () => { deleteNode(ir, sel.id); sel = null; commit(); });
}

// class relation kind <-> (kind, style)
const CLASS_RELS = [
  ['inheritance', '상속  <|--'],
  ['realization', '실현  <|..'],
  ['dependency', '의존  <..'],
  ['association', '연관  <--'],
];
function classRelKey(e) {
  if (e.kind === 'inheritance') return 'inheritance';
  if (e.kind === 'realization') return 'realization';
  if (e.kind === 'dependency') return 'dependency';
  return 'association';
}

function renderEdgePanel() {
  const list = edgeList(ir);
  const e = list && list[sel.id];
  if (!e) { clearPanel(); return; }
  const t = ir.type;
  let html = `<h2>${t} · 연결</h2>`;

  if (t === 'classDiagram') {
    html += `<label>${esc(e.parent)} → ${esc(e.child)}</label>`;
    html += `<label>관계 종류</label><select data-f data-k="classrel">${selOpts(classRelKey(e), CLASS_RELS)}</select>`;
    html += field('라벨', e.label || '', 'data-k="elabel"');
  } else if (t === 'flowchart') {
    html += `<label>${esc(e.from)} → ${esc(e.to)}</label>`;
    html += `<label>선 종류</label><select data-f data-k="estyle">${selOpts(e.style, [['solid', '실선 -->'], ['dashed', '점선 -.->'], ['thick', '굵게 ==>']])}</select>`;
    html += `<label>화살표</label><select data-f data-k="earrow">${selOpts(e.arrow === false ? 'no' : 'yes', [['yes', '있음'], ['no', '없음']])}</select>`;
    html += field('라벨', e.label || '', 'data-k="elabel"');
  } else if (t === 'stateDiagram') {
    html += `<label>${esc(e.from)} → ${esc(e.to)}</label>`;
    html += field('라벨', e.label || '', 'data-k="elabel"');
  } else if (t === 'erDiagram') {
    html += `<label>${esc(e.a)} — ${esc(e.b)}</label>`;
    const cards = [['||', '정확히 1  ||'], ['|o', '0 또는 1  |o'], ['}o', '0 또는 다  }o'], ['}|', '1 또는 다  }|']];
    html += `<label>${esc(e.a)} 측</label><select data-f data-k="acard">${selOpts(e.aCard, cards)}</select>`;
    html += `<label>${esc(e.b)} 측</label><select data-f data-k="bcard">${selOpts(e.bCard, cards.map(([v, x]) => [mirrorCard(v), x]))}</select>`;
    html += `<label>선</label><select data-f data-k="estyle">${selOpts(e.style, [['solid', '실선 --'], ['dashed', '점선 ..']])}</select>`;
    html += field('라벨', e.label || '', 'data-k="elabel"');
  } else {
    html += '<p class="empty">이 타입의 연결은 코드에서 편집하세요.</p>';
  }
  html += `<button class="danger" data-del>이 연결 삭제</button>`;
  panel.innerHTML = html;
  panel.querySelectorAll('[data-f]').forEach((inp) => {
    inp.addEventListener('change', () => applyEdgeField(e, inp.getAttribute('data-k'), inp.value));
  });
  panel.querySelector('[data-del]').addEventListener('click', () => { deleteEdge(ir, sel.id); sel = null; commit(); });
}

// ER cardinality token mirrors for the right (b) side
function mirrorCard(v) { return { '||': '||', '|o': 'o|', '}o': 'o{', '}|': '|{' }[v] || v; }

function applyNodeField(el, key, value) {
  value = value.trim();
  if (key === 'id') { if (renameNode(ir, sel.id, value)) sel.id = value; }
  else if (key === 'label') el.label = value;
  else if (key === 'stereo') el.stereotype = value || null;
  else if (key === 'shape') el.shape = value;
  else if (key === 'values') el.sections[0] = value.split('\n').map((s) => s.trim()).filter(Boolean);
  else if (key === 'attrs') el.sections[0] = value.split('\n').map((s) => s.trim()).filter(Boolean);
  else if (key === 'methods') el.sections[1] = value.split('\n').map((s) => s.trim()).filter(Boolean);
  else if (key === 'erattrs') el.attrs = value.split('\n').map((s) => s.trim()).filter(Boolean).map((ln) => {
    const p = ln.split(/\s+/); const type = p[0], name = p[1] || p[0];
    return { type: p.length > 1 ? type : 'string', name, keys: p.slice(2).filter((k) => /^(PK|FK|UK)$/.test(k)) };
  });
  commit();
}

function applyEdgeField(e, key, value) {
  if (key === 'classrel') {
    if (value === 'inheritance') { e.kind = 'inheritance'; e.style = 'solid'; }
    else if (value === 'realization') { e.kind = 'realization'; e.style = 'dashed'; }
    else if (value === 'dependency') { e.kind = 'dependency'; e.style = 'dashed'; }
    else { e.kind = 'association'; e.style = 'solid'; }
  } else if (key === 'estyle') e.style = value;
  else if (key === 'earrow') e.arrow = value === 'yes';
  else if (key === 'acard') e.aCard = value;
  else if (key === 'bcard') e.bCard = value;
  else if (key === 'elabel') e.label = value.trim() || null;
  commit();
}

// ---- node interaction (click / drag / connect) -------------------------
function attachHandlers() {
  stage.querySelectorAll('.hk-node').forEach((g) => {
    const id = g.getAttribute('data-id');
    g.addEventListener('mousedown', (ev) => startDrag(ev, g, id));
  });
  stage.querySelectorAll('.hk-edge').forEach((g) => {
    g.addEventListener('mousedown', (ev) => { ev.stopPropagation(); });
    g.addEventListener('click', (ev) => { ev.stopPropagation(); selectEdge(Number(g.getAttribute('data-edge'))); });
  });
}

function svgPoint(clientX, clientY) {
  const svg = stage.querySelector('svg');
  const pt = svg.createSVGPoint(); pt.x = clientX; pt.y = clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  return [p.x, p.y];
}

function nodeUnder(clientX, clientY, exceptId) {
  const el = document.elementFromPoint(clientX, clientY);
  const g = el && el.closest && el.closest('.hk-node');
  if (!g || g.getAttribute('data-id') === exceptId) return null;
  return g;
}

// dragged = source, drop target = the other node; direction is type-aware.
function connectByDrag(sourceId, targetId) {
  if (sourceId === targetId) return;
  if (ir.type === 'classDiagram') addEdge(ir, targetId, sourceId); // 자식을 부모로 끌기 → 부모 <|-- 자식
  else addEdge(ir, sourceId, targetId);                            // 끈 노드 → 놓은 노드
  commit();
}

function startDrag(ev, g, id) {
  ev.preventDefault();
  const x0 = ev.clientX, y0 = ev.clientY;
  const svg = stage.querySelector('svg');
  const sr = g.getBoundingClientRect();
  const [sx, sy] = svgPoint(sr.left + sr.width / 2, sr.top + sr.height / 2);
  let moved = false, cancelled = false, line = null, dropG = null;

  const clearDrop = () => { if (dropG) { dropG.classList.remove('drop'); dropG = null; } };
  const onMove = (e) => {
    if (cancelled) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    if (!moved && Math.abs(dx) + Math.abs(dy) > 4) moved = true;
    if (!moved) return;
    const [cx, cy] = svgPoint(e.clientX, e.clientY);
    if (!line) {
      line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.id = 'hk-linkline';
      line.setAttribute('x1', sx); line.setAttribute('y1', sy);
      line.setAttribute('stroke', '#2f9e44'); line.setAttribute('stroke-width', '1.8');
      line.setAttribute('stroke-dasharray', '5 4');
      svg.appendChild(line);
    }
    line.setAttribute('x2', cx); line.setAttribute('y2', cy);
    const tg = nodeUnder(e.clientX, e.clientY, id);
    if (tg !== dropG) { clearDrop(); if (tg) { dropG = tg; tg.classList.add('drop'); } }
  };
  const onUp = (e) => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.removeEventListener('keydown', onKey);
    if (line) line.remove();
    const tgId = (!cancelled && moved) ? nodeUnder(e.clientX, e.clientY, id)?.getAttribute('data-id') : null;
    clearDrop();
    if (cancelled) return;
    if (!moved) { selectNode(id); return; }
    if (tgId) connectByDrag(id, tgId);
    else dropReorder(id, e.clientX - x0);
  };
  const onKey = (e) => { if (e.key === 'Escape') { cancelled = true; if (line) line.remove(); clearDrop(); } };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  document.addEventListener('keydown', onKey);
}

function dropReorder(id, dxClient) {
  // peers = nodes whose vertical center is on the same row as the dragged node
  const groups = [...stage.querySelectorAll('.hk-node')];
  const rect = (g) => g.getBoundingClientRect();
  const me = stage.querySelector(`[data-id="${CSS.escape(id)}"]`);
  const mr = rect(me);
  const myCy = mr.top + mr.height / 2;
  const band = Math.max(24, mr.height * 0.6);
  const peers = groups.filter((g) => {
    const r = rect(g); return Math.abs((r.top + r.height / 2) - myCy) < band;
  });
  if (peers.length < 2) return;
  const cx = (g) => {
    const r = rect(g);
    const c = r.left + r.width / 2;
    return g === me ? c + dxClient : c;
  };
  peers.sort((a, b) => cx(a) - cx(b));
  const ordered = peers.map((g) => g.getAttribute('data-id'));
  reorderByPeers(ir, id, ordered);
  commit();
}

// ---- toolbar -----------------------------------------------------------
$('add').addEventListener('click', () => { const id = addNode(ir); commit(); selectNode(id); });
$('del').addEventListener('click', () => {
  if (!sel) return;
  if (sel.kind === 'node') deleteNode(ir, sel.id); else deleteEdge(ir, sel.id);
  sel = null; commit();
});
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Delete' || e.key === 'Backspace') && sel && document.activeElement === document.body) {
    if (sel.kind === 'node') deleteNode(ir, sel.id); else deleteEdge(ir, sel.id);
    sel = null; commit();
  }
});

// ---- code <-> ir two-way ----------------------------------------------
let t;
code.addEventListener('input', () => {
  clearTimeout(t);
  t = setTimeout(() => { try { ir = parseAny(code.value); } catch {} renderFromCode(); }, 150);
});

async function loadExample(name) {
  code.value = await (await fetch(new URL('../examples/' + name, import.meta.url))).text();
  ir = parseAny(code.value); sel = null;
  renderFromCode(); clearPanel();
}
example.addEventListener('change', () => loadExample(example.value));

// ---- export ------------------------------------------------------------
function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$('dl-svg').addEventListener('click', () => download('diagram.svg', new Blob([lastSVG], { type: 'image/svg+xml' })));
$('dl-png').addEventListener('click', () => {
  const scale = 2, img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = lastSize.w * scale; c.height = lastSize.h * scale;
    const ctx = c.getContext('2d'); ctx.scale(scale, scale); ctx.drawImage(img, 0, 0);
    c.toBlob((b) => download('diagram.png', b), 'image/png');
  };
  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(lastSVG)));
});

await loadExample('character.mmd');

// HK_Diagram visual editor: two-way sync between mermaid text and the diagram.
import { renderToSVG, detectType } from '../src/render.js';
import { parseAny } from '../src/ir.js';
import { serialize } from '../src/serialize.js';
import { listElements, findElement, addNode, deleteNode, renameNode, addEdge, reorderByPeers } from '../src/edit-ops.js';

const $ = (id) => document.getElementById(id);
const code = $('code'), stage = $('stage'), panel = $('panel'), kind = $('kind'), example = $('example');

let ir = null, selected = null, mode = 'select', connectFrom = null;
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
    if (selected) {
      const g = stage.querySelector(`[data-id="${CSS.escape(selected)}"]`);
      if (g) g.classList.add('sel'); else selected = null;
    }
  } catch (e) {
    kind.textContent = ''; stage.innerHTML = '<div class="err">⚠ ' + (e.message || e) + '</div>';
  }
}

// Mutate IR -> write code -> reparse -> render (keeps everything canonical).
function commit() {
  code.value = serialize(ir);
  ir = parseAny(code.value);
  renderFromCode();
  if (selected) renderPanel(); else clearPanel();
}

// ---- selection + panel -------------------------------------------------
function selectNode(id) {
  selected = id;
  stage.querySelectorAll('.hk-node.sel').forEach((g) => g.classList.remove('sel'));
  const g = stage.querySelector(`[data-id="${CSS.escape(id)}"]`);
  if (g) g.classList.add('sel');
  renderPanel();
}

function clearPanel() {
  panel.innerHTML = '<p class="empty">노드를 클릭해 편집하세요.</p>';
}

function field(label, value, attrs = '') {
  return `<label>${label}</label><input data-f ${attrs} value="${esc(value ?? '')}">`;
}
function area(label, value, rows = 4) {
  return `<label>${label}</label><textarea data-f rows="${rows}">${esc(value ?? '')}</textarea>`;
}

function renderPanel() {
  const el = findElement(ir, selected);
  if (!el) { clearPanel(); return; }
  const t = ir.type;
  let html = `<h2>${t} · ${esc(selected)}</h2>`;
  const f = {}; // map field-key -> input later

  if (t === 'classDiagram') {
    if (el.shape === undefined) { /* class/object */ }
    html += field('이름 (id)', el.id, 'data-k="id"');
    if (el.kind === 'object') {
      html += area('값 (한 줄에 하나)', (el.sections[0] || []).join('\n'), 4) .replace('data-f', 'data-f data-k="values"');
    } else {
      html += field('스테레오타입', el.stereotype || '', 'data-k="stereo"');
      html += area('속성', (el.sections[0] || []).join('\n'), 3).replace('data-f', 'data-f data-k="attrs"');
      html += area('메서드', (el.sections[1] || []).join('\n'), 3).replace('data-f', 'data-f data-k="methods"');
    }
  } else if (t === 'flowchart') {
    html += field('라벨', el.label, 'data-k="label"');
    html += `<label>도형</label><select data-f data-k="shape">${
      ['rect', 'round', 'stadium', 'diamond', 'circle', 'cylinder', 'subroutine']
        .map((s) => `<option ${el.shape === s ? 'selected' : ''}>${s}</option>`).join('')}</select>`;
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
    inp.addEventListener('change', () => applyField(el, inp.getAttribute('data-k'), inp.value));
  });
  panel.querySelector('[data-del]').addEventListener('click', () => { deleteNode(ir, selected); selected = null; commit(); });
}

function applyField(el, key, value) {
  value = value.trim();
  if (key === 'id') { if (renameNode(ir, selected, value)) selected = value; }
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

// ---- node interaction (click / drag / connect) -------------------------
function attachHandlers() {
  stage.querySelectorAll('.hk-node').forEach((g) => {
    const id = g.getAttribute('data-id');
    g.addEventListener('mousedown', (ev) => startDrag(ev, g, id));
  });
}

function startDrag(ev, g, id) {
  ev.preventDefault();
  const x0 = ev.clientX, y0 = ev.clientY;
  let moved = false;
  const onMove = (e) => {
    const dx = e.clientX - x0, dy = e.clientY - y0;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
    if (moved) g.setAttribute('transform', `translate(${dx} ${dy})`);
  };
  const onUp = (e) => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    g.removeAttribute('transform');
    if (!moved) { handleClick(id); return; }
    dropReorder(id, e.clientX - x0);
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function handleClick(id) {
  if (mode === 'connect') {
    if (!connectFrom) {
      connectFrom = id;
      stage.querySelector(`[data-id="${CSS.escape(id)}"]`)?.classList.add('src');
    } else {
      addEdge(ir, connectFrom, id);
      connectFrom = null; setMode('select'); commit();
    }
    return;
  }
  selectNode(id);
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
function setMode(m) {
  mode = m;
  $('connect').classList.toggle('on', m === 'connect');
  if (m !== 'connect' && connectFrom) {
    stage.querySelector(`[data-id="${CSS.escape(connectFrom)}"]`)?.classList.remove('src');
    connectFrom = null;
  }
}

$('add').addEventListener('click', () => { const id = addNode(ir); commit(); selectNode(id); });
$('del').addEventListener('click', () => { if (selected) { deleteNode(ir, selected); selected = null; commit(); } });
$('connect').addEventListener('click', () => setMode(mode === 'connect' ? 'select' : 'connect'));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMode('select'); });

// ---- code <-> ir two-way ----------------------------------------------
let t;
code.addEventListener('input', () => {
  clearTimeout(t);
  t = setTimeout(() => { try { ir = parseAny(code.value); } catch {} renderFromCode(); }, 150);
});

async function loadExample(name) {
  code.value = await (await fetch(new URL('../examples/' + name, import.meta.url))).text();
  ir = parseAny(code.value); selected = null; setMode('select');
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

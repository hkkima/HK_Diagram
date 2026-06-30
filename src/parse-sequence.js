// mermaid sequenceDiagram parser -> { participants, events }.

const ARROW = /^(\w+)\s*(--?(?:>>|>|x|\)))\s*([+-]?)(\w+)\s*:\s*(.*)$/;
const NOTE = /^note\s+(right of|left of|over)\s+([\w ,]+?)\s*:\s*(.*)$/i;
const FRAME = /^(loop|alt|opt|par|critical|break)\b\s*(.*)$/i;

export function parseSequence(text) {
  const order = [];
  const parts = new Map();
  const ensure = (id, label) => {
    if (!parts.has(id)) { parts.set(id, { id, label: label || id }); order.push(id); }
    else if (label) parts.get(id).label = label;
    return id;
  };
  const events = [];

  for (let raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('%%')) continue;
    if (/^sequenceDiagram$/.test(line)) continue;
    if (/^autonumber\b/i.test(line)) continue;

    const pdecl = line.match(/^(participant|actor)\s+(\w+)(?:\s+as\s+(.+))?$/i);
    if (pdecl) { ensure(pdecl[2], pdecl[3]?.trim()); continue; }

    const note = line.match(NOTE);
    if (note) {
      const ids = note[2].split(',').map((s) => s.trim()).filter(Boolean);
      ids.forEach((id) => ensure(id));
      events.push({ type: 'note', pos: note[1].toLowerCase(), parts: ids, text: note[3].trim() });
      continue;
    }

    const fr = line.match(FRAME);
    if (fr) { events.push({ type: 'frameStart', kind: fr[1].toLowerCase(), label: fr[2].trim() }); continue; }
    if (/^else\b/i.test(line)) { events.push({ type: 'frameElse', label: line.replace(/^else\s*/i, '').trim() }); continue; }
    if (/^end$/i.test(line)) { events.push({ type: 'frameEnd' }); continue; }

    const m = line.match(ARROW);
    if (m) {
      const [, from, tok, act, to, txt] = m;
      ensure(from); ensure(to);
      const style = tok.startsWith('--') ? 'dashed' : 'solid';
      const arrow = tok.includes('>>') ? 'filled' : tok.includes('x') ? 'cross' : 'open';
      events.push({ type: 'msg', from, to, style, arrow, activate: act, text: txt.trim() });
      continue;
    }
  }

  return { type: 'sequenceDiagram', participants: order.map((id) => parts.get(id)), events };
}

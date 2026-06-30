// mermaid stateDiagram-v2 parser -> IR. Flat states; [*] -> shared start/end.

export function parseState(text) {
  const nodes = new Map();
  const edges = [];
  const aliases = new Map(); // display alias -> id
  let direction = 'TB';

  const ensure = (id, shape = 'round') => {
    if (!nodes.has(id)) nodes.set(id, { id, label: id, shape, kind: 'state' });
    return nodes.get(id);
  };
  const marker = (kind) => {
    const id = kind === 'start' ? '__start' : '__end';
    if (!nodes.has(id)) nodes.set(id, { id, label: '', shape: kind, kind: 'state' });
    return id;
  };
  const resolve = (tok, asTarget) => {
    tok = tok.trim();
    if (tok === '[*]') return marker(asTarget ? 'end' : 'start');
    if (aliases.has(tok)) return aliases.get(tok);
    ensure(tok); return tok;
  };

  for (let raw of text.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line || line.startsWith('%%')) continue;
    if (/^stateDiagram(-v2)?$/.test(line)) continue;
    if (/^direction\s+(TB|TD|BT|LR|RL)/i.test(line)) {
      direction = RegExp.$1.toUpperCase() === 'TD' ? 'TB' : RegExp.$1.toUpperCase(); continue;
    }
    // state "Display" as Id
    const al = line.match(/^state\s+"([^"]+)"\s+as\s+(\w+)/);
    if (al) { const n = ensure(al[2]); n.label = al[1]; aliases.set(al[1], al[2]); continue; }
    // state Id { ... }  -> treat as a normal state, ignore braces
    const comp = line.match(/^state\s+(\w+)\s*\{?$/);
    if (comp) { ensure(comp[1]); continue; }
    if (line === '}') continue;

    const tr = line.match(/^(.+?)\s*-->\s*(.+?)(?:\s*:\s*(.+))?$/);
    if (tr) {
      const from = resolve(tr[1], false);
      const to = resolve(tr[2], true);
      edges.push({ from, to, style: 'solid', arrow: true, label: tr[3]?.trim() || null });
      continue;
    }
    // bare state declaration
    const bare = line.match(/^(\w+)\s*:?\s*(.*)$/);
    if (bare) { const n = ensure(bare[1]); if (bare[2]) n.label = bare[2]; }
  }

  return { type: 'stateDiagram', direction, nodes: [...nodes.values()], edges };
}

// mermaid erDiagram parser -> { entities, rels }.

const REL = /^(\w[\w-]*)\s+([|}{o]{2})(--|\.\.)([|}{o]{2})\s+(\w[\w-]*)\s*:\s*(.*)$/;

export function parseER(text) {
  const entities = new Map();
  const rels = [];
  const ensure = (id) => {
    if (!entities.has(id)) entities.set(id, { id, attrs: [] });
    return entities.get(id);
  };

  let cur = null;
  for (let raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('%%')) continue;
    if (/^erDiagram$/.test(line)) continue;
    if (line === '}') { cur = null; continue; }

    // entity block open: `NAME {`
    const open = line.match(/^(\w[\w-]*)\s*\{$/);
    if (open) { cur = ensure(open[1]); continue; }

    if (cur) {
      // attr: `type name [PK|FK|UK] ["comment"]`
      const parts = line.replace(/"[^"]*"/g, '').trim().split(/\s+/);
      const [type, name, ...keys] = parts;
      if (name) cur.attrs.push({ type, name, keys: keys.filter((k) => /^(PK|FK|UK)$/.test(k)) });
      continue;
    }

    const rel = line.match(REL);
    if (rel) {
      const [, a, aCard, link, bCard, b, label] = rel;
      ensure(a); ensure(b);
      rels.push({ a, b, aCard, bCard, style: link === '..' ? 'dashed' : 'solid', label: label.trim() });
      continue;
    }
    // lone entity declaration
    const lone = line.match(/^(\w[\w-]*)$/);
    if (lone) ensure(lone[1]);
  }

  return { type: 'erDiagram', entities: [...entities.values()], rels };
}

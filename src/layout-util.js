// Apply user position overrides (free placement) and finalize canvas bounds.
// Positions persist in mermaid as `%% hkpos <id> <x> <y>` comments.

import { CANVAS_PAD } from './theme.js';

export function applyPositions(nodes, positions) {
  if (positions) {
    for (const [id, p] of Object.entries(positions)) {
      const n = nodes[id];
      if (n && !n.isDummy) { n.x = p.x; n.y = p.y; }
    }
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of Object.values(nodes)) {
    if (n.isDummy) continue;
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.w); maxY = Math.max(maxY, n.y + n.h);
  }
  // safety: keep everything in positive canvas (normally a no-op since drags clamp)
  const dx = minX < CANVAS_PAD ? CANVAS_PAD - minX : 0;
  const dy = minY < CANVAS_PAD ? CANVAS_PAD - minY : 0;
  if (dx || dy) for (const n of Object.values(nodes)) { n.x += dx; n.y += dy; }

  return {
    width: Math.ceil(maxX + dx + CANVAS_PAD),
    height: Math.ceil(maxY + dy + CANVAS_PAD),
  };
}

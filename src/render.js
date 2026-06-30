// Browser-safe entry: mermaid text -> SVG (no PNG / node-only deps).

import { parseClassDiagram } from './parse-class.js';
import { layoutClass } from './layout-class.js';
import { routeOrtho } from './route-ortho.js';
import { renderSVG } from './render-svg.js';
import { parseFlowchart } from './parse-flowchart.js';
import { parseState } from './parse-state.js';
import { layoutGraph } from './layout-graph.js';
import { routeGraph } from './route-graph.js';
import { renderGraph } from './render-graph.js';
import { parseER } from './parse-er.js';
import { layoutER, renderER } from './render-er.js';
import { parseSequence } from './parse-sequence.js';
import { renderSequence } from './render-sequence.js';

export function detectType(text) {
  const head = text.trim().split(/\r?\n/)[0].trim();
  if (/^classDiagram/.test(head)) return 'classDiagram';
  if (/^stateDiagram/.test(head)) return 'stateDiagram';
  if (/^erDiagram/.test(head)) return 'erDiagram';
  if (/^sequenceDiagram/.test(head)) return 'sequenceDiagram';
  if (/^(flowchart|graph)\b/.test(head)) return 'flowchart';
  throw new Error('Unknown diagram type. First line: classDiagram / flowchart / graph / stateDiagram / erDiagram / sequenceDiagram.');
}

// `%% hkpos <id> <x> <y>` comments carry free-placement overrides.
export function parsePositions(text) {
  const pos = {};
  const re = /^\s*%%\s*hkpos\s+(\S+)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/gm;
  let m;
  while ((m = re.exec(text))) pos[m[1]] = { x: +m[2], y: +m[3] };
  return pos;
}

export function renderToSVG(text) {
  const positions = parsePositions(text);
  switch (detectType(text)) {
    case 'classDiagram': {
      const ir = parseClassDiagram(text); ir.positions = positions;
      const layout = layoutClass(ir);
      return { svg: renderSVG(layout, routeOrtho(layout)), layout };
    }
    case 'flowchart':
    case 'stateDiagram': {
      const ir = text.trim().startsWith('stateDiagram') ? parseState(text) : parseFlowchart(text);
      ir.positions = positions;
      const layout = layoutGraph(ir);
      return { svg: renderGraph(layout, routeGraph(layout)), layout };
    }
    case 'erDiagram': {
      const ir = parseER(text); ir.positions = positions;
      const layout = layoutER(ir);
      return { svg: renderER(layout), layout };
    }
    case 'sequenceDiagram': {
      const model = parseSequence(text);
      return renderSequence(model);
    }
  }
}

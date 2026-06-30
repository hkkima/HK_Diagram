// Text -> IR dispatcher (browser-safe). Pairs with serialize.js for round-trip.

import { parseClassDiagram } from './parse-class.js';
import { parseFlowchart } from './parse-flowchart.js';
import { parseState } from './parse-state.js';
import { parseER } from './parse-er.js';
import { parseSequence } from './parse-sequence.js';
import { detectType, parsePositions } from './render.js';

export { parsePositions };

export function parseAny(text) {
  let ir;
  switch (detectType(text)) {
    case 'classDiagram': ir = parseClassDiagram(text); break;
    case 'flowchart': ir = parseFlowchart(text); break;
    case 'stateDiagram': ir = parseState(text); break;
    case 'erDiagram': ir = parseER(text); break;
    case 'sequenceDiagram': ir = parseSequence(text); break;
  }
  ir.positions = parsePositions(text);
  return ir;
}

// Text -> IR dispatcher (browser-safe). Pairs with serialize.js for round-trip.

import { parseClassDiagram } from './parse-class.js';
import { parseFlowchart } from './parse-flowchart.js';
import { parseState } from './parse-state.js';
import { parseER } from './parse-er.js';
import { parseSequence } from './parse-sequence.js';
import { detectType } from './render.js';

export function parseAny(text) {
  switch (detectType(text)) {
    case 'classDiagram': return parseClassDiagram(text);
    case 'flowchart': return parseFlowchart(text);
    case 'stateDiagram': return parseState(text);
    case 'erDiagram': return parseER(text);
    case 'sequenceDiagram': return parseSequence(text);
  }
}

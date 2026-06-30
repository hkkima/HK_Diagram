// Node entry: adds PNG rendering on top of the browser-safe SVG pipeline.

import { renderToSVG, detectType } from './render.js';
import { svgToPng } from './png.js';

export { renderToSVG, detectType };

export function renderMermaid(text, { png = true, scale = 2 } = {}) {
  const { svg, layout } = renderToSVG(text);
  return { svg, png: png ? svgToPng(svg, { scale }) : null, layout };
}

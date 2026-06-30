// SVG string -> PNG buffer via resvg (no headless browser). Uses system fonts
// so Korean/CJK text renders (Malgun Gothic on Windows).

import { Resvg } from '@resvg/resvg-js';

export function svgToPng(svg, { scale = 2 } = {}) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'zoom', value: scale },
    font: { loadSystemFonts: true, defaultFontFamily: 'Malgun Gothic' },
    background: 'white',
  });
  return resvg.render().asPng();
}

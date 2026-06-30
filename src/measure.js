// Browser-free text width estimation. Good enough for clean box sizing.
// CJK / fullwidth glyphs ~= 1.0em, latin ~= 0.55em average.

function isWide(cp) {
  return (
    (cp >= 0x1100 && cp <= 0x115f) || // Hangul Jamo
    (cp >= 0x2e80 && cp <= 0x303e) || // CJK radicals, Kangxi
    (cp >= 0x3041 && cp <= 0x33ff) || // Hiragana..CJK symbols
    (cp >= 0x3400 && cp <= 0x4dbf) || // CJK Ext A
    (cp >= 0x4e00 && cp <= 0x9fff) || // CJK Unified
    (cp >= 0xa000 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) || // Hangul Syllables
    (cp >= 0xf900 && cp <= 0xfaff) || // CJK compat
    (cp >= 0xff00 && cp <= 0xff60) || // Fullwidth forms
    (cp >= 0xffe0 && cp <= 0xffe6)
  );
}

// Per-character advance for latin glyphs at 1em, rough proportional metrics.
const NARROW = new Set(['i', 'l', 'I', 'j', 't', 'f', 'r', '.', ',', ':', ';', "'", '|', '!', ' ']);
const WIDE_LATIN = new Set(['m', 'w', 'M', 'W', '@', '%']);

export function textWidth(str, fontSize) {
  let w = 0;
  for (const ch of String(str)) {
    const cp = ch.codePointAt(0);
    if (isWide(cp)) w += fontSize * 1.0;
    else if (NARROW.has(ch)) w += fontSize * 0.32;
    else if (WIDE_LATIN.has(ch)) w += fontSize * 0.85;
    else if (ch >= 'A' && ch <= 'Z') w += fontSize * 0.66;
    else w += fontSize * 0.55;
  }
  return w;
}

export const lineHeight = (fontSize) => Math.round(fontSize * 1.35);

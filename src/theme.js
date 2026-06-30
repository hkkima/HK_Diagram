// Visual style tokens, tuned to match the reference draw.io-style UML look.

export const FONT_STACK =
  "'Malgun Gothic','Noto Sans KR','Apple SD Gothic Neo','Segoe UI',sans-serif";

export const FONT = {
  title: 13,        // class/object name
  stereotype: 11,   // <<...>> line
  member: 12,       // attributes / methods / values
};

export const PAD = {
  boxPadX: 12,      // horizontal text padding inside a box
  titlePadY: 9,     // vertical padding around the title band
  rowPadY: 6,       // vertical padding around a member section
  lineGap: 6,       // extra gap between member lines
  colGap: 60,       // min horizontal gap between sibling boxes
  rowGap: 64,       // vertical gap between hierarchy levels
};

// Blue swatch used for "real" classes (base/derived types).
export const CLASS_SWATCH = {
  header: '#bdd7ee',
  body: '#e9f2fb',
  border: '#3d7ebf',
  text: '#1f4e79',
};

// Auto palette for object/instance boxes, assigned per type.
export const INSTANCE_PALETTE = [
  { header: '#ffe599', body: '#fff7da', border: '#c99400', text: '#7a5c00' }, // gold
  { header: '#f4b6b6', body: '#fce4e4', border: '#c0392b', text: '#8a1f16' }, // red/pink
  { header: '#b6d7a8', body: '#e6f3e0', border: '#38761d', text: '#274e13' }, // green
  { header: '#b4a7d6', body: '#e9e3f5', border: '#674ea7', text: '#351c75' }, // purple
  { header: '#9fc5e8', body: '#e3f0fb', border: '#1c5a96', text: '#0b3a66' }, // blue
  { header: '#f9cb9c', body: '#fdeadb', border: '#b45f06', text: '#7a3f00' }, // orange
  { header: '#a2d9d5', body: '#e0f4f2', border: '#1f8a82', text: '#0d544f' }, // teal
];

export const EDGE = {
  color: '#5b6770',
  width: 1.4,
  dash: '6 4',
};

export const CANVAS_PAD = 28; // margin around the whole diagram

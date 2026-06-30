#!/usr/bin/env node
// Usage: hkdiagram <input.mmd> [-o <out-basename>] [--scale N] [--no-png]

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { renderMermaid } from '../src/index.js';

function parseArgs(argv) {
  const args = { scale: 2, png: true };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-o' || a === '--out') args.out = argv[++i];
    else if (a === '--scale') args.scale = Number(argv[++i]);
    else if (a === '--no-png') args.png = false;
    else rest.push(a);
  }
  args.input = rest[0];
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.input) {
  console.error('Usage: hkdiagram <input.mmd> [-o out] [--scale N] [--no-png]');
  process.exit(1);
}

const text = readFileSync(args.input, 'utf8');
const out = args.out || basename(args.input, extname(args.input));

const { svg, png } = renderMermaid(text, { png: args.png, scale: args.scale });
writeFileSync(`${out}.svg`, svg, 'utf8');
console.log(`wrote ${out}.svg`);
if (png) {
  writeFileSync(`${out}.png`, png);
  console.log(`wrote ${out}.png`);
}

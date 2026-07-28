#!/usr/bin/env node
/**
 * check-prohibitions.mjs — grep the repo for the things this design system
 * forbids. Zero dependencies. Exits non-zero on any violation.
 *
 *   node scripts/check-prohibitions.mjs
 *
 * The six laws are easy to break by accident three months from now, so they are
 * a build gate rather than a paragraph in a README nobody re-reads.
 */
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SKIP_DIRS = new Set(["node_modules", ".git", "fonts", "dist", "baselines"]);

const CHECKS = [
  {
    id: "second-hue",
    what: "hex color outside the color tokens",
    files: /\.css$/,
    /* colors.css defines the palette; effects.css and print.css are documented
       exceptions (glow rgba values, and the black-on-white print palette). */
    exempt: /src[/\\]tokens[/\\]colors\.css$|src[/\\]tokens[/\\]effects\.css$|src[/\\]base[/\\]print\.css$/,
    re: /#[0-9a-fA-F]{3,8}\b/g,
  },
  {
    id: "transition",
    what: "transition/animation easing on a state change",
    files: /\.css$/,
    only: /src[/\\]components[/\\]/,
    re: /\btransition\s*:/g,
  },
  {
    id: "icon-set",
    what: "<svg> or an inline icon",
    files: /\.(css|html|js)$/,
    re: /<svg[\s>]|url\(["']?data:image\/svg/gi,
  },
  {
    id: "emoji",
    what: "emoji",
    files: /\.(css|html|js|md)$/,
    /* Pictographic ranges only. The permitted ornament glyphs (✳ █ ▮ ▯ ▲ ▼ ◄ ►
       and box drawing, U+2500-25FF / U+2733) are deliberately NOT in here. */
    re: /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F0FF}\u{FE0F}\u{2764}\u{2B50}\u{26A0}]/gu,
  },
  {
    id: "radius",
    what: "border-radius above 8px",
    files: /\.css$/,
    re: /border-radius\s*:\s*(?!0|1px|2px|4px|8px|50%|var\(|inherit)([0-9]+)px/g,
    filter: (m) => Number(m[1]) > 8,
  },
  {
    id: "third-font",
    what: "a font family other than VT323 / Silkscreen",
    files: /\.css$/,
    re: /font-family\s*:\s*([^;}]+)/g,
    filter: (m) =>
      !/VT323|Silkscreen|inherit|var\(--font-(terminal|micro)\)|Courier New|ui-monospace|monospace/i.test(
        m[1]
      ),
  },
];

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const failures = [];
let scanned = 0;

for await (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).replaceAll("\\", "/");
  const applicable = CHECKS.filter(
    (c) =>
      c.files.test(file) &&
      !(c.exempt && c.exempt.test(file)) &&
      !(c.only && !c.only.test(file))
  );
  if (!applicable.length) continue;

  const text = await readFile(file, "utf8");
  scanned++;

  for (const check of applicable) {
    for (const m of text.matchAll(check.re)) {
      if (check.filter && !check.filter(m)) continue;
      const line = text.slice(0, m.index).split("\n").length;
      failures.push({ check: check.id, what: check.what, rel, line, text: m[0].trim() });
    }
  }
}

if (failures.length) {
  console.error(`\n  ${failures.length} prohibition(s) violated:\n`);
  for (const f of failures) {
    console.error(`    ${f.rel}:${f.line}  [${f.check}] ${f.what}\n      ${f.text}`);
  }
  process.exit(1);
}

console.log(`  ${scanned} files scanned, ${CHECKS.length} prohibitions, 0 violations`);

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
    /* GLOW IS THE SIGNAL OF ENERGIZATION. A disabled control that glows is a lie
       about the hardware, so --ink-dim and --ink-faint must switch the halo off.
       Since tokens/effects.css applies the glow at the frame and lets it
       INHERIT, that is not automatic: a rule that dims the color inherits the
       halo it was given unless it says otherwise. This is the half of the rule
       that drifts — .ac-panel--dim did exactly this, overriding the color and
       keeping a glow it never asked for — so it is the half that is gated.

       The opposite direction is not checkable and does not need to be: lit text
       glows by inheriting, and there is nothing to forget. */
    id: "unpaired-glow",
    what: "an ink level set without the halo that belongs to it",
    /* HTML too, because the guide builds its specimens out of inline style=""
       and those are exactly as able to strand an element at the wrong halo as a
       stylesheet is — seven of them did. */
    files: /\.(css|html)$/,
    /* print.css blanks --glow-text wholesale, and a11y.css runs where the UA has
       already forced shadows off; both set these colors legitimately. */
    exempt: /src[/\\]base[/\\](print|a11y)\.css$/,
    /* A declaration block, or an inline style attribute. Both are places an ink
       level gets set, so both are places the halo can be left behind. */
    re: /\{[^{}]*\}|style="[^"]*"/g,
    filter: (m) => {
      const body = m[0].replace(/\/\*[\s\S]*?\*\//g, "");
      if (/text-shadow/.test(body)) return false;
      /* Lit must glow; dim, faint and inverse must not. Both halves are
         required, and the second half is the one that surprises people:
         inheritance does NOT cover a rule that brightens its own color inside
         dim prose — it inherits the dim's suppression and stays flat. That is
         how eighty-two inline <code> spans sat at --ink-bright with no halo. */
      /* The leading boundary is load-bearing: without it `border-color` matches
         `color` and every swatch chip in the guide — which sets a border and no
         text at all — is reported as stranded. */
      return (
        /(^|[;{"\s])color\s*:\s*var\(--ink(-bright)?\)/.test(body) ||
        /(^|[;{"\s])color\s*:\s*var\(--(ink-dim|ink-faint|on-fill)\)/.test(body)
      );
    },
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

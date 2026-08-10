#!/usr/bin/env node
/**
 * contrast.mjs — compute WCAG 2.1 contrast ratios for every text/background
 * pair the system actually uses. Zero dependencies.
 *
 *   node scripts/contrast.mjs           human-readable table
 *   node scripts/contrast.mjs --md      markdown, for pasting into README.md
 *
 * Ratios are COMPUTED from src/tokens/colors.css, never typed by hand. If a
 * required pair fails, this exits non-zero and names the number — the fix is to
 * document the limitation, not to quietly lighten the palette.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Parse colors.css into ONE TOKEN MAP PER PALETTE.
 *
 * The file declares every color once per palette — a flat scrape of every
 * `--name: value;` silently keeps whichever block is written last and reports a
 * table for a palette most users never see. Blocks have to be kept apart and the
 * pair table run against each.
 *
 * A palette is identified by the PAIR of technology and emitter, because the
 * emitter alone is not unique across technologies and never will be: two techs
 * can both ship a "white". Blocks are found by their
 * [data-ac-tech][data-ac-emitter] selector; the deprecated [data-ac-gas] aliases
 * ride along on the same blocks and are deliberately not enumerated, so the
 * legacy names cannot double-count a palette that is already being checked.
 */
async function loadTokens() {
  const css = (await readFile(path.join(ROOT, "src/tokens/colors.css"), "utf8"))
    .replace(/\/\*[\s\S]*?\*\//g, ""); /* comments can hold colons and braces */

  /* selector { declarations } — the file has no nesting or at-rules. */
  const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, body]) => ({
    sel: sel.trim(),
    decls: Object.fromEntries(
      [...body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map(([, n, v]) => [n, v.trim()])
    ),
  }));

  const PALETTE_RE =
    /\[data-ac-tech=["']?([\w-]+)["']?\]\[data-ac-emitter=["']?([\w-]+)["']?\]/g;

  const names = [
    ...new Map(
      [...css.matchAll(PALETTE_RE)].map((m) => [`${m[1]}/${m[2]}`, [m[1], m[2]]])
    ),
  ];
  if (!names.length) {
    throw new Error("no [data-ac-tech][data-ac-emitter] palettes found in colors.css");
  }

  return Object.fromEntries(
    names.map(([id, [tech, emitter]]) => {
      /* :root blocks are the shared base — the aliases live in one of them and
         apply to every palette. A palette block then overlays its own colors. */
      const raw = {};
      const mine = new RegExp(
        `\\[data-ac-tech=["']?${tech}["']?\\]\\[data-ac-emitter=["']?${emitter}["']?\\]`
      );
      for (const b of blocks) {
        const isBase = b.sel.split(",").some((s) => s.trim().startsWith(":root"));
        const isMine = mine.test(b.sel);
        if (isBase || isMine) Object.assign(raw, b.decls);
      }

      const resolve = (v, depth = 0) => {
        if (depth > 10) throw new Error("circular var reference");
        const ref = /^var\(\s*--([\w-]+)\s*\)$/.exec(v);
        return ref ? resolve(raw[ref[1]], depth + 1) : v;
      };
      return [id, Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, resolve(v)]))];
    })
  );
}

const srgb = (hex) => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
};

/** WCAG relative luminance. */
const luminance = (hex) => {
  const [r, g, b] = srgb(hex).map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/* Each pair records whether it must pass. "Required" means the pair carries
   information a user has to read. Decorative and disabled pairs are exempt by
   WCAG 1.4.3 itself, but we still report their numbers. */
const PAIRS = [
  ["--ac-ink", "--ac-screen", "Body text on the panel", true, "body"],
  ["--ac-ink-bright", "--ac-screen", "Live values, hover, input text", true, "body"],
  ["--ac-ink-dim", "--ac-screen", "Field labels, legends, secondary text", true, "body"],
  ["--ac-ink-faint", "--ac-screen", "Disabled text — decorative only", false, "disabled"],
  ["--ac-ink-trace", "--ac-screen", "Row separators, leader dots — non-text", false, "decorative"],
  ["--ac-on-fill", "--ac-fill", "Inverse video: dark text on amber", true, "body"],
  ["--ac-on-fill", "--ac-fill-bright", "Inverse video, hover state", true, "body"],
  ["--ac-ink-bright", "--ac-screen-well", "Input text in a recessed well", true, "body"],
  ["--ac-ink-faint", "--ac-screen-well", "Placeholder text", false, "placeholder"],
  ["--ac-ink", "--ac-screen-raised", "Body text on a zebra table row", true, "body"],
  ["--ac-stroke", "--ac-screen", "2px borders — non-text, needs 3:1", true, "ui"],
  ["--ac-stroke-dim", "--ac-screen", "Dim borders — non-text, needs 3:1", true, "ui"],
];

const palettes = await loadTokens();
const md = process.argv.includes("--md");

const table = (tokens) =>
  PAIRS.map(([fg, bg, use, required, kind]) => {
    const r = ratio(tokens[fg.slice(2)], tokens[bg.slice(2)]);
    /* Non-text UI components need 3:1 (WCAG 1.4.11); text needs 4.5:1 (1.4.3).
       All body text here is 18px+, which is "large" at 18.66px bold / 24px
       regular — we hold everything to the stricter 4.5:1 anyway. */
    const threshold = kind === "ui" ? 3 : 4.5;
    return { fg, bg, use, required, threshold, value: r, pass: r >= threshold };
  });

const fmt = (n) => `${n.toFixed(2)}:1`;
const broken = [];

for (const [id, tokens] of Object.entries(palettes)) {
  const [tech, emitter] = id.split("/");
  const rows = table(tokens);
  for (const r of rows) if (r.required && !r.pass) broken.push({ id, ...r });

  if (md) {
    console.log(`\n#### \`data-ac-tech="${tech}" data-ac-emitter="${emitter}"\`\n`);
    console.log("| Foreground | Background | Ratio | Needs | Verdict | Use |");
    console.log("| --- | --- | --- | --- | --- | --- |");
    for (const r of rows) {
      const verdict = r.pass
        ? `**${r.threshold === 3 ? "AA (non-text)" : "AA"}**`
        : r.required
          ? "**FAILS**"
          : "fails — exempt";
      console.log(
        `| \`${r.fg}\` | \`${r.bg}\` | ${fmt(r.value)} | ${r.threshold}:1 | ${verdict} | ${r.use} |`
      );
    }
  } else {
    console.log(`\n  ${tech.toUpperCase()} / ${emitter.toUpperCase()}`);
    for (const r of rows) {
      const mark = r.pass ? "PASS" : r.required ? "FAIL" : "exempt";
      console.log(
        `  ${mark.padEnd(7)}${fmt(r.value).padStart(8)}  (needs ${r.threshold}:1)  ` +
          `${r.fg} on ${r.bg} — ${r.use}`
      );
    }
  }
}

/* A pair that passes under one palette and fails under another is a failure.
   Every palette ships; none of them is a preview. */
if (broken.length) {
  console.error(
    `\n  ${broken.length} REQUIRED pair(s) below threshold:\n` +
      broken.map((r) => `    [${r.id}] ${r.fg} on ${r.bg} = ${fmt(r.value)}`).join("\n")
  );
  process.exit(1);
}

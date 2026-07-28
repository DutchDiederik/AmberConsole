#!/usr/bin/env node
/**
 * derive-gas.mjs — turn an emission line table into a palette block.
 *
 *   node scripts/derive-gas.mjs            every emitter, as CSS, to stdout
 *   node scripts/derive-gas.mjs neon       one emitter
 *   node scripts/derive-gas.mjs --check    re-derive and diff against colors.css
 *   node scripts/derive-gas.mjs --swatch f write an HTML preview of every ramp
 *
 * The colour of a gas is COMPUTED here, never picked, for the same reason
 * scripts/contrast.mjs computes its ratios: a number somebody typed is a number
 * nobody can check. What the emitter radiates decides the hue; what the panel
 * has to stay legible at decides the luminance; and the two are separate
 * decisions that this file keeps separate.
 *
 * HUE FROM THE SPECTRUM, LUMINANCE FROM THE DRIVE LEVEL. That split is the
 * whole method and it is not a compromise, it is how a panel works. Argon really
 * does emit very little visible light — most of its output sits past 700nm where
 * the eye scores under 0.01 — but "argon is dim" is a statement about radiant
 * efficiency, not about what colour the cell is. Drive the cell harder and it is
 * still argon. So every stop below is the emitter's own chromaticity, held
 * exactly, at whatever luminance the contrast gate demands.
 *
 * See scripts/data/emitters.json for the line tables, their source, and the
 * per-gas selection rule with its justification.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  linesToXYZ, xyOf, fitToGamut, hexOf, linearOfHex, luminance, contrast, cmf,
} from "./lib/cie.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The five discharge stops, as contrast ratios against that palette's --screen.
 *
 * These are the ratios the shipped neon palette was solved to, and they are the
 * contract: --ink at 7:1 and --ink-dim at 5.2:1 clear WCAG 1.4.3's 4.5:1 for
 * text, --ink-faint at 3.4:1 clears 1.4.11's 3:1 for the borders that use it,
 * and --*-30 is decorative. Solve to the ratio, never re-tint to taste —
 * rotating hue at constant lightness is what silently drops a stop under the
 * gate, and it is why this file exists.
 */
const STOPS = [
  ["100", 10.5, "hot highlight / focus"],
  ["90", 7.0, "primary discharge"],
  ["70", 5.2, "secondary"],
  ["50", 3.4, "dim / disabled"],
  ["30", 1.63, "trace / ghost, decorative"],
];

/**
 * The unlit panel, as luminances rather than colours.
 *
 * Taken from the shipped neon surfaces (#100600 / #1b0c02 / #060200) so every
 * palette sits at the same depth, and tinted to its own gas: dark glass in front
 * of an argon cell does not glow warm. The tint is deliberately weak — a lit
 * cell is the emitter, an unlit one is mostly just glass.
 */
const SURFACES = [
  ["screen", 0.00278, 0.55],
  ["screen-raised", 0.00713, 0.55],
  ["screen-well", 0.00126, 0.55],
];

/** Four points on the discharge hue, for the glow layers in effects.css. */
const GLOWS = [
  ["gas-1", 0.62, 0.10], ["gas-2", 0.55, 0.04],
  ["gas-3", 0.48, 0.00], ["gas-4", 0.74, 0.24],
];

/**
 * HOW MUCH OF THIS GAS'S LIGHT ENDS UP IN THE HALO RATHER THAN THE STROKE.
 *
 * Rayleigh scattering goes as lambda^-4, so a violet gas throws far more of
 * itself sideways into the glass than a red one does. Neon is the reference at
 * 1.00; argon comes out near 1.5, which is a real difference and a visible one.
 *
 * Weighted by I(lambda)*V(lambda) — what the EYE receives — not by raw radiant
 * intensity, because a halo nobody can see is not a halo. And it is the mean of
 * lambda^-4 rather than lambda^-4 of the mean wavelength: those are not the same
 * number for a spread spectrum, and the second one is wrong. Luminance-weighting
 * a mean wavelength drags every gas toward 555nm by construction and reports a
 * difference of 1.4x where the honest figure is larger.
 *
 * NOT MODELLED, DELIBERATELY: the eye's own longitudinal chromatic aberration,
 * which really does make violet sources look fuzzier and which ratios out at
 * 2.67x for argon. The absolute difference behind that ratio is 0.126 diopters —
 * about half an arcminute at a 4mm pupil, under one pixel at any normal viewing
 * distance. Scaling a bloom radius by it would inflate a sub-pixel effect into
 * a hundred and fifty pixels of fog. The ratio is real; using it here would not
 * be. Radius instead follows sqrt(scatter), because multiple scattering widens
 * the halo as it brightens it, which keeps both numbers tied to one mechanism.
 */
function scatter(lines) {
  let Y = 0;
  let s = 0;
  for (const [nm, i] of lines) {
    const w = i * cmf(nm)[1];
    Y += w;
    s += w * (555 / nm) ** 4;
  }
  return Y === 0 ? 1 : s / Y;
}

/** Solve the luminance that gives `ratio` against a background luminance. */
const yForRatio = (ratio, bgY) => ratio * (bgY + 0.05) - 0.05;

/** Mix a chromaticity toward D65 by `t`, for the surface and glow tints. */
const toward = ([x, y], t, [wx, wy] = [0.3127, 0.329]) => [x + (wx - x) * t, y + (wy - y) * t];

function derive(name, emitter) {
  const sel = emitter.select ?? {};
  const lines = emitter.lines.filter(
    ([nm]) => nm >= (sel.minNm ?? 0) && nm <= (sel.maxNm ?? Infinity)
  );
  const [x, y] = xyOf(linesToXYZ(lines));

  const out = { name, x, y, kept: lines.length, total: emitter.lines.length, tokens: {} };
  out.rawScatter = scatter(lines);

  /* Surfaces first — every ratio below is measured against --screen. */
  for (const [token, Y, tint] of SURFACES) {
    const [sx, sy] = toward([x, y], tint);
    out.tokens[token] = hexOf(fitToGamut(sx, sy, Y).rgb);
  }
  const screenY = luminance(linearOfHex(out.tokens["screen"]));

  for (const [stop, ratio] of STOPS) {
    const fit = fitToGamut(x, y, yForRatio(ratio, screenY));
    out.tokens[`emit-${stop}`] = hexOf(fit.rgb);
    if (stop === "90") out.desat = fit.mixed;
  }

  /* --on-fill is the dark text inside an inverse-video block, so it is solved
     against --fill (which is emit-90), not against the panel. 4.5:1 is the
     floor; we take the darkest tint of the gas that clears it comfortably. */
  const fillY = luminance(linearOfHex(out.tokens["emit-90"]));
  for (let t = 0; t <= 1; t += 0.002) {
    const cand = fitToGamut(...toward([x, y], 0.35), yForRatio(6.0, 0) * t);
    const hex = hexOf(cand.rgb);
    if (contrast(luminance(linearOfHex(hex)), fillY) <= 6.4) {
      out.tokens["on-fill"] = hex;
      break;
    }
  }
  out.onFillRatio = contrast(luminance(linearOfHex(out.tokens["on-fill"])), fillY);

  for (const [token, Y, tint] of GLOWS) {
    const [gx, gy] = toward([x, y], tint);
    const rgb = fitToGamut(gx, gy, Y).rgb;
    out.tokens[token] = rgb
      .map((u) => Math.round(Math.min(1, Math.max(0, u <= 0.0031308 ? 12.92 * u : 1.055 * u ** (1 / 2.4) - 0.055)) * 255))
      .join(", ");
  }

  return out;
}

function toCSS(d, emitter) {
  const t = d.tokens;
  /* Short form on purpose. The full justification for each gas's line set lives
     in scripts/data/emitters.json next to the lines it justifies; duplicating it
     here would give it two places to be edited and one place to go stale. */
  return `/* --- PLASMA / ${d.name.toUpperCase()} — ${emitter.appearance}.

     GENERATED by scripts/derive-gas.mjs. Do not edit these values by hand;
     \`npm test\` re-derives and fails on drift. The line table, its source and
     the reason this gas uses the line selection it does are in
     scripts/data/emitters.json.

     CIE 1931 2-deg integral over ${d.kept === d.total ? `all ${d.total}` : `${d.kept} of ${d.total}`} listed lines: x=${d.x.toFixed(4)} y=${d.y.toFixed(4)}.
     ${d.desat > 0.005
       ? `Outside sRGB at the luminance --emit-90 needs, so it is\n     desaturated ${(d.desat * 100).toFixed(0)}% toward D65 — the gas is paler here than it is in the tube.`
       : `Inside sRGB as measured; no gamut mapping needed.`}
     Stops solved to 10.5 / 7.0 / 5.2 / 3.4 / 1.63 : 1 against this palette's
     own --screen; --on-fill lands at ${d.onFillRatio.toFixed(2)}:1 on --emit-90. --- */
[data-ac-tech="plasma"][data-ac-emitter="${d.name}"] {
  --screen: ${t["screen"]};
  --screen-raised: ${t["screen-raised"]};
  --screen-well: ${t["screen-well"]};

  --emit-100: ${t["emit-100"]};
  --emit-90:  ${t["emit-90"]};
  --emit-70:  ${t["emit-70"]};
  --emit-50:  ${t["emit-50"]};
  --emit-30:  ${t["emit-30"]};
  --on-fill:  ${t["on-fill"]};

  --gas-1: ${t["gas-1"]};
  --gas-2: ${t["gas-2"]};
  --gas-3: ${t["gas-3"]};
  --gas-4: ${t["gas-4"]};

  /* Rayleigh: this gas throws ${d.scatter >= 1 ? `${((d.scatter - 1) * 100).toFixed(0)}% more` : `${((1 - d.scatter) * 100).toFixed(0)}% less`} light into the halo than neon. */
  --gas-scatter: ${t["gas-scatter"]};
  --gas-spread: ${t["gas-spread"]};
}`;
}

/* -------------------------------------------------------------------- main -- */

const raw = JSON.parse(await readFile(path.join(ROOT, "scripts/data/emitters.json"), "utf8"));
const args = process.argv.slice(2);
const only = args.find((a) => !a.startsWith("--"));
const names = Object.keys(raw.emitters).filter((n) => !only || n === only);

const all = names.map((n) => ({ d: derive(n, raw.emitters[n]), e: raw.emitters[n] }));

/* Scatter is stated RELATIVE TO NEON, because the absolute figure is a ratio
   against an arbitrary 555nm reference and means nothing on its own — whereas
   "argon throws half again as much light into the halo as neon does" is a
   sentence somebody can check. Neon is therefore always derived, even when the
   command line asked for one other gas. */
const neonScatter =
  all.find(({ d }) => d.name === "neon")?.d.rawScatter ??
  derive("neon", raw.emitters.neon).rawScatter;

for (const { d } of all) {
  d.scatter = d.rawScatter / neonScatter;
  d.tokens["gas-scatter"] = d.scatter.toFixed(2);
  /* Radius, not intensity: multiple scattering broadens the halo as it
     brightens it, so both come off the same number and cannot disagree. */
  d.tokens["gas-spread"] = Math.sqrt(d.scatter).toFixed(2);
}

/* KNOWN-ANSWER GATE, and it runs first.
   Any emitter carrying `validate` is one whose colour was established
   independently of this script. If the pipeline cannot reproduce it, the
   pipeline is wrong, and finding that out here — against neon, whose answer we
   know — is worth more than any amount of staring at the three palettes whose
   answers we do not. */
for (const { d, e } of all) {
  if (!e.validate) continue;
  const { x, y, tol } = e.validate;
  const off = Math.hypot(d.x - x, d.y - y);
  const ok = off <= tol;
  console.error(
    `  validate ${d.name}: derived x=${d.x.toFixed(4)} y=${d.y.toFixed(4)} vs ` +
    `known x=${x} y=${y} — off by ${off.toFixed(4)} (tol ${tol}) ${ok ? "OK" : "FAIL"}`
  );
  if (!ok) {
    console.error(
      `\n  The colour pipeline no longer reproduces a known answer. Fix that before\n` +
      `  trusting anything else this script emits.`
    );
    process.exit(1);
  }
}

/* `emit: false` means reference-only — used to check the pipeline, never
   written into colors.css. Neon is the only one, and the reason is in its
   `why` block in emitters.json. */
const derived = all.filter(({ e }) => e.emit !== false);

if (args.includes("--swatch")) {
  const file = args[args.indexOf("--swatch") + 1] ?? "gas-swatches.html";
  const row = ({ d, e }) => `<div class="r"><div class="n">${d.name}<em>${e.appearance}</em>
    <b>x=${d.x.toFixed(4)} y=${d.y.toFixed(4)}</b></div><div class="s">${
    STOPS.map(([s]) => `<i style="background:${d.tokens[`emit-${s}`]}">${d.tokens[`emit-${s}`]}</i>`).join("")
  }</div><div class="p" style="background:${d.tokens["screen"]}">
    <span style="color:${d.tokens["emit-90"]}">PANEL TEXT</span>
    <span style="background:${d.tokens["emit-90"]};color:${d.tokens["on-fill"]}">INVERSE</span></div></div>`;
  await writeFile(file, `<style>body{background:#08080a;color:#ccc;font:13px ui-monospace,monospace;padding:26px}
h1{font-size:14px;font-weight:400;color:#777;margin:0 0 20px}
.r{display:flex;align-items:center;gap:16px;margin-bottom:14px}
.n{width:210px}.n em{display:block;color:#777;font-style:normal;font-size:11px}
.n b{display:block;color:#555;font-weight:400;font-size:10px}
.s{display:flex}.s i{width:82px;height:56px;font-style:normal;font-size:9px;color:#0007;display:flex;align-items:flex-end;justify-content:center;padding-bottom:3px}
.p{margin-left:8px;padding:11px 14px;display:flex;gap:12px;align-items:center;min-width:230px}
.p span{padding:2px 7px;font-size:14px;letter-spacing:.05em}</style>
<h1>Derived plasma palettes — stops solved to 10.5 / 7.0 / 5.2 / 3.4 / 1.63 : 1 against each palette's own panel black</h1>
${derived.map(row).join("\n")}`);
  console.log(`  swatches -> ${file}`);
}

if (args.includes("--check")) {
  const css = await readFile(path.join(ROOT, "src/tokens/colors.css"), "utf8");
  const bad = [];
  for (const { d } of derived) {
    const block = css.match(
      new RegExp(`\\[data-ac-emitter="${d.name}"\\][^{]*\\{([^}]*)\\}`)
    );
    if (!block) { bad.push(`${d.name}: no block in colors.css`); continue; }
    for (const [token, want] of Object.entries(d.tokens)) {
      const got = block[1].match(new RegExp(`--${token}\\s*:\\s*([^;]+);`))?.[1].trim();
      if (got && got.toLowerCase() !== want.toLowerCase()) {
        bad.push(`${d.name} --${token}: colors.css has ${got}, derivation says ${want}`);
      }
    }
  }
  /* The guide prints every hex as TEXT under its chip, which is documentation
     that can disagree with the thing it documents and look completely fine doing
     it. Twenty-five of those labels now. Check them against colors.css. */
  const guide = await readFile(path.join(ROOT, "docs/guide.html"), "utf8");
  for (const m of guide.matchAll(
    /--([A-Z-]+\d*)\s*·\s*(#[0-9A-Fa-f]{3,8})<\/span>/g
  )) {
    const token = m[1].toLowerCase();
    const shown = m[2].toLowerCase();
    /* Which palette a label belongs to is the nearest .doc-demo above it. */
    const before = guide.slice(0, m.index);
    const demo = [...before.matchAll(/data-ac-emitter="([\w-]+)"/g)].pop()?.[1];
    if (!demo) continue;
    const block = css.match(new RegExp(`\\[data-ac-emitter="${demo}"\\][^{]*\\{([^}]*)\\}`));
    const real = block?.[1].match(new RegExp(`--${token}\\s*:\\s*([^;]+);`))?.[1].trim().toLowerCase();
    if (real && real !== shown) {
      bad.push(`docs/guide.html --${token} under ${demo}: label says ${shown}, colors.css has ${real}`);
    }
  }

  if (bad.length) {
    console.error(`\n  ${bad.length} value(s) drifted from the derivation:\n` +
      bad.map((b) => `    ${b}`).join("\n"));
    process.exit(1);
  }
  console.log(`  ${derived.length} palettes match their derivation; guide labels match colors.css`);
} else if (!args.includes("--swatch")) {
  for (const { d, e } of derived) console.log(toCSS(d, e) + "\n");
  console.error(derived.map(({ d }) =>
    `  ${d.name.padEnd(9)} x=${d.x.toFixed(4)} y=${d.y.toFixed(4)}  ` +
    `${d.kept}/${d.total} lines  desat ${(d.desat * 100).toFixed(0)}%  ` +
    `on-fill ${d.onFillRatio.toFixed(2)}:1  scatter x${d.scatter.toFixed(2)}`).join("\n"));
}

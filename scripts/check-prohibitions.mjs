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
    /* colors.css defines the palette; print.css is the black-on-white one. The
       two sim files each carry a `#000` inside a mask-image gradient, where the
       color is not a color at all — a mask reads only alpha, and the ribs and the
       smear taper would look identical in any hue. Splitting effects.css let
       this list get SHORTER: the token file no longer contains a hex at all. */
    exempt: /src[/\\]tokens[/\\]colors\.css$|src[/\\]base[/\\]print\.css$|src[/\\]sim[/\\](plasma|afterglow)\.css$/,
    re: /#[0-9a-fA-F]{3,8}\b/g,
  },
  {
    /* STATE CHANGES ARE INSTANT REDRAWS. A screen has no in-between frames, so
       nothing in the framework may ease its way into a new state.

       THIS FILE IS THE SOLE OWNER OF THE RULE. stylelint carried a second,
       overlapping copy of it (declaration-property-value-disallowed-list, with
       its own exemption list in an `overrides` block) and the two had to be kept
       in agreement by hand. This one is now the stricter of the two — it catches
       the longhands, which the stylelint version's `/^transition/` did too but
       which the old regex here did not — so nothing is lost by dropping that.

       The exemptions are the panel's PHYSICS rather than its UI: the decay of a
       phosphor is a timed change and is the one thing here that genuinely is not
       instant. See the header of sim/afterglow.css.

       SPLITTING effects.css MADE THIS LIST MORE HONEST rather than longer. The
       exemption used to cover the whole 1,000-line file — tokens, both hardware
       simulations and the persistence engine — to license the handful of decays
       in one of them. It now names only the two files that actually decay, so a
       `transition` added to the glow tokens or to either hardware simulation
       fails the build the way it always should have. */
    id: "transition",
    what: "transition on a state change — a screen has no in-between frames",
    files: /\.css$/,
    only: /src[/\\]/,
    exempt: /src[/\\]base[/\\](a11y|print)\.css$|src[/\\]sim[/\\](afterglow|frame)\.css$/,
    re: /\btransition(-[a-z]+)?\s*:/g,
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
       about the hardware, so --ac-ink-dim and --ac-ink-faint must switch the halo off.
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
    /* print.css blanks --ac-glow-text wholesale, and a11y.css runs where the UA has
       already forced shadows off; both set these colors legitimately. */
    exempt: /src[/\\]base[/\\](print|a11y)\.css$/,
    /* Selector plus declaration block, or an inline style attribute. The
       SELECTOR is captured because the rule below needs to know whether the
       thing being styled is inert, and only the selector can say so.

       THE STYLE ATTRIBUTE COMES FIRST AND THE ORDER IS LOAD-BEARING. Alternation
       is ordered, and `[^{}]*` is greedy across everything that is not a brace —
       so with the block pattern first, any style="" sitting between two braces
       anywhere in the file is swallowed by the block alternative and never
       inspected. That is not hypothetical: splitting the guide into chapters
       moved the braces around and a stranded --ac-ink-dim specimen that had been
       invisible to this gate for its whole life became visible in the same
       commit. Six inline styles across docs/ were unreachable. Put the narrow,
       unambiguous pattern first and there is nothing to be shadowed. */
    re: /style="[^"]*"|([^{}]*)\{([^{}]*)\}/g,
    filter: (m) => {
      const sel = (m[1] ?? "").replace(/\/\*[\s\S]*?\*\//g, "");
      const body = (m[2] ?? m[0]).replace(/\/\*[\s\S]*?\*\//g, "");

      /* The leading boundary is load-bearing: without it `border-color` matches
         `color` and every swatch chip in the guide — which sets a border and no
         text at all — is reported as stranded. */
      const B = String.raw`(^|[;{"\s])`;
      /* The --ac- prefix is matched explicitly rather than made optional: the
         unprefixed names are deprecated read-aliases that nothing in the
         framework consumes, so a rule setting one is not setting an ink level at
         all. This regex is also why the prefixing had to be checked rather than
         trusted — the pattern sat inside a `var\(--(...)` group, so the rename
         swept past it and the gate would have gone quietly blind. */
      const lit = new RegExp(`${B}color\\s*:\\s*var\\(--ac-(ink|ink-bright|ink-dim|ink-faint)\\)`).test(body);
      const unlit = new RegExp(`${B}color\\s*:\\s*var\\(--ac-on-fill\\)`).test(body);
      if (!lit && !unlit) return false;

      /* The closing quote has to be excluded or an inline style's
         `text-shadow:none"` reads as the value `none"` and never matches. */
      const shadow = body.match(/text-shadow\s*:\s*([^;}"]+)/);

      /* HALF ONE, unchanged: an ink level set with no halo stated either way.
         Inheritance does NOT cover a rule that brightens its own color inside
         dim prose — it inherits the dim's suppression and stays flat, which is
         how eighty-two inline <code> spans sat at --ac-ink-bright with no halo. */
      if (!shadow) return true;

      const isNone = /^\s*none\s*$/.test(shadow[1]);

      /* HALF TWO, and it is new: the halo must point the RIGHT WAY. Stating a
         shadow was enough to pass before, so the drive tiers could have been
         wired backwards and the gate would have shrugged.

         GLOW FOLLOWS THE DRIVE LEVEL. --ac-ink-dim is emit-70 and --ac-ink-faint is
         emit-50 — both lit cells, both scattering, just less. The only things
         that may go flat are genuinely INERT: a disabled control, and the unlit
         text inside an inverse-video block. A disabled control that glows is a
         lie about the hardware; a dim label that does NOT is a different lie,
         and until this release the system was telling it everywhere. */
      /* WHAT COUNTS AS INERT IS A SHORT, PROJECT-SPECIFIC LIST, and it has to be
         written down somewhere because no amount of CSS analysis can infer it: a
         stopped container and an "off" readout mean the cell is not lit, and
         they say so in application vocabulary rather than in a UA state. Add to
         this list when a new state means UNLIT — and only then. Everything else
         that is dim is merely driven softly, and must keep its halo. */
      const inert = /:disabled|--disabled|aria-disabled|\[hidden\]|--off\b|\[data-stopped\]/.test(sel);
      if (lit && isNone && !inert) return true;
      if (unlit && !isNone) return true;

      return false;
    },
  },
  {
    id: "third-font",
    what: "a font family other than VT323 / Silkscreen",
    files: /\.css$/,
    re: /font-family\s*:\s*([^;}]+)/g,
    filter: (m) =>
      !/VT323|Silkscreen|inherit|var\(--ac-font-(terminal|micro)\)|Courier New|ui-monospace|monospace/i.test(
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

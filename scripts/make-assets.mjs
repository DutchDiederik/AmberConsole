#!/usr/bin/env node
/**
 * make-assets.mjs — render the favicon and the social card from the framework
 * itself, so neither can drift from the palette.
 *
 *   node scripts/make-assets.mjs
 *
 * Emits:
 *   docs/favicon.png            32x32   browser tab
 *   docs/apple-touch-icon.png   180x180 iOS home screen
 *   docs/social-card.png        1200x630 og:image / twitter:card
 *
 * WHY THIS IS GENERATED RATHER THAN DRAWN. The mark is the letter A set in
 * VT323 and lit with --glow-text over --screen — the same three tokens the rest
 * of the system uses. Hand-exporting it from a drawing tool would freeze a copy
 * of a palette that `data-ac-gas` can change and that scripts/contrast.mjs
 * gates. Rendering it through dist/amber-console.css means retuning the gas
 * retunes the icon, and it is one command to reprove it.
 *
 * NOT AN SVG, and that is the design law rather than a limitation:
 * scripts/check-prohibitions.mjs greps .html for `<svg` and `data:image/svg`,
 * so the modern inline-SVG favicon would fail this project's own gate. PNG of a
 * typeset character is the version that obeys law 6 — ornament is typographic.
 *
 * Needs playwright, like test/visual/capture.mjs. Run once; the PNGs are
 * committed, so nobody else needs it.
 */
import { writeFile, unlink } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = path.join(ROOT, "docs");
/* A real file inside docs/, not page.setContent(). setContent runs on an
   about:blank opaque origin, which is not allowed to fetch file:// subresources
   — the stylesheet silently does not apply and the mark renders in the browser's
   default serif on white. Navigating to a sibling of the demo pages puts us on
   the same origin they use, so the CSS and the woff2 both load. */
const SCRATCH = path.join(DOCS, ".make-assets.tmp.html");

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error(
    "\n  playwright is not installed — assets cannot be rendered.\n" +
      "  Install it with:  npm i -D playwright && npx playwright install chromium\n"
  );
  process.exit(2);
}

/* Relative, because the scratch page lives in docs/ exactly like the demos. */
const cssHref = "../dist/amber-console.css";

/**
 * The mark. Optical centering, not geometric: VT323's cap height sits high in the
 * em box, so a glyph centered on its line box reads low. The grid is nudged up
 * by 6% of the tile to put the letter's visual mass in the middle.
 */
const icon = (px) => `
<link rel="stylesheet" href="${cssHref}">
<style>
  html, body { margin: 0; background: var(--screen); }
  .tile {
    width: ${px}px; height: ${px}px;
    display: grid; place-items: center;
    background: var(--screen);
    font-family: var(--font-terminal);
    font-size: ${Math.round(px * 0.86)}px;
    line-height: 1;
    color: var(--ink-bright);
    text-shadow: var(--glow-text);
    padding-bottom: ${Math.round(px * 0.06)}px;
    box-sizing: border-box;
  }
</style>
<div class="tile">A</div>`;

/* The card is the console demo, LETTERBOXED to 1.91:1 rather than cropped.
   Filling the frame means center-cropping a 16:10 capture, which slices through
   the footer row and reads as a broken screenshot rather than a bold one. The
   bars are --screen, so on this design they read as the bezel the glass sits in
   — the one case where letterboxing is on-genre instead of apologetic.
   Scaled from the 1440-wide capture the README already uses. */
const card = (shot) => `
<link rel="stylesheet" href="${cssHref}">
<style>
  html, body { margin: 0; background: var(--screen); }
  .card {
    width: 1200px; height: 630px;
    display: grid; place-items: center;
    background: var(--screen);
    overflow: hidden;
  }
  .card img {
    max-width: 1160px; max-height: 594px;
    object-fit: contain;
    display: block;
  }
</style>
<div class="card"><img src="${shot}"></div>`;

const browser = await chromium.launch();

async function shoot(html, width, height, out) {
  await writeFile(SCRATCH, `<!DOCTYPE html><meta charset="utf-8">${html}`);
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(SCRATCH).href, { waitUntil: "networkidle" });

  /* Prove the stylesheet actually applied rather than trusting that it did —
     a silently-unstyled mark is the exact failure this script had first time,
     and it looks plausible enough in a 32px thumbnail to ship by accident. */
  const font = await page.evaluate(() => {
    const el = document.querySelector(".tile, .card");
    return getComputedStyle(el).fontFamily;
  });
  if (html.includes("class=\"tile\"") && !/VT323/.test(font)) {
    throw new Error(`stylesheet did not apply — font resolved to ${font}. Run npm run build first.`);
  }

  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  await writeFile(path.join(DOCS, out), await page.screenshot());
  await ctx.close();
  console.log(`  ${out.padEnd(22)} ${width}x${height}`);
}

await shoot(icon(32), 32, 32, "favicon.png");
await shoot(icon(180), 180, 180, "apple-touch-icon.png");
await shoot(card("screenshot.png"), 1200, 630, "social-card.png");

await unlink(SCRATCH);
await browser.close();

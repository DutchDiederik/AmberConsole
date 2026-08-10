#!/usr/bin/env node
/**
 * make-assets.mjs — render the favicon and the social card from the framework
 * itself, so neither can drift from the palette.
 *
 *   node scripts/make-assets.mjs
 *
 * Emits:
 *   docs/favicon.png            32x32    browser tab
 *   docs/apple-touch-icon.png   180x180  iOS home screen
 *   docs/screenshot.png         1440x900 the README hero, and the card's input
 *   docs/social-card.png        1200x630 og:image / twitter:card
 *
 * WHY THIS IS GENERATED RATHER THAN DRAWN. The mark is the letter A set in
 * VT323 and lit with --ac-glow-text over --ac-screen — the same three tokens the rest
 * of the system uses. Hand-exporting it from a drawing tool would freeze a copy
 * of a palette that `data-ac-tech` / `data-ac-emitter` can change and that
 * scripts/contrast.mjs gates. Rendering it through dist/amber-console.css means
 * retuning an emitter retunes the icon, and it is one command to reprove it.
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
  html, body { margin: 0; background: var(--ac-screen); }
  .tile {
    width: ${px}px; height: ${px}px;
    display: grid; place-items: center;
    background: var(--ac-screen);
    font-family: var(--ac-font-terminal);
    font-size: ${Math.round(px * 0.86)}px;
    line-height: 1;
    color: var(--ac-ink-bright);
    text-shadow: var(--ac-glow-text);
    padding-bottom: ${Math.round(px * 0.06)}px;
    box-sizing: border-box;
  }
</style>
<div class="tile">A</div>`;

/* The card is the console demo, LETTERBOXED to 1.91:1 rather than cropped.
   Filling the frame means center-cropping a 16:10 capture, which slices through
   the footer row and reads as a broken screenshot rather than a bold one. The
   bars are --ac-screen, so on this design they read as the bezel the glass sits in
   — the one case where letterboxing is on-genre instead of apologetic.
   Scaled from the 1440-wide capture the README already uses. */
const card = (shot) => `
<link rel="stylesheet" href="${cssHref}">
<style>
  html, body { margin: 0; background: var(--ac-screen); }
  .card {
    width: 1200px; height: 630px;
    display: grid; place-items: center;
    background: var(--ac-screen);
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

/**
 * THE CONSOLE CAPTURE, WHICH THIS SCRIPT USED TO CONSUME WITHOUT PRODUCING.
 *
 * docs/screenshot.png is the README hero and the image the card letterboxes, and
 * nothing regenerated it — so it went on showing a REV 1.0 nav bar and the old
 * inline gas switches long after the demo had stopped looking like that, and the
 * social card inherited the staleness. It is generated here now, from the same
 * dist/amber-console.css as everything else in this file.
 *
 * THE SETUP BOARD IS HIDDEN FOR THE SHOT, and that is a framing decision rather
 * than a cheat. The board is docs-site chrome — it exists so a visitor can drive
 * the eleven palettes — and the thing both alt texts describe is the console.
 * Scrolling past it does not work: the console is the last content on the page,
 * so the scroll clamps with the board's last row still under the sticky nav.
 */
async function shootConsole(out) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(path.join(DOCS, "index.html")).href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  /* The plasma frame fades in and the readouts settle; 2.5s is what it takes for
     both to finish on a cold load. */
  await page.waitForTimeout(2500);

  const hid = await page.evaluate(() => {
    const board = document.querySelector(".ac-setup, [class*='setup']");
    if (board) board.style.display = "none";
    window.scrollTo(0, 0);
    return !!board;
  });
  if (!hid) throw new Error("setup board not found — the capture would include it.");

  await page.waitForTimeout(1200);
  /* Freeze the blink and the tube drift so the file does not change on every run
     for reasons nobody can see. */
  await page.evaluate(() =>
    document.querySelectorAll("*").forEach((el) => {
      if (getComputedStyle(el).animationName !== "none") el.style.animationPlayState = "paused";
    })
  );
  await page.waitForTimeout(200);

  await writeFile(path.join(DOCS, out), await page.screenshot());
  await ctx.close();
  console.log(`  ${out.padEnd(22)} 1440x900`);
}

/* THE CLEANUP IS IN A `finally` BECAUSE THE FAILURE PATH IS THE ONE THAT MATTERS.
   Both of these used to run only after the last successful capture, so any throw
   — and this script throws on purpose when the stylesheet has not applied — left
   a chromium process alive and the scratch page sitting in docs/.

   The scratch page is the worse of the two. scripts/build.mjs picks up
   `*.html` in docs/ and excludes only `_`-prefixed partials, so a leftover
   `.make-assets.tmp.html` was a real page as far as the next build was
   concerned. That file's own .gitignore entry says it "only survives a crashed
   run", which was true and is no longer the plan. build.mjs skips dotfiles too
   now; belt and braces, because only one of the two is in this repo's control if
   somebody copies this script out of it. */
try {
  await shoot(icon(32), 32, 32, "favicon.png");
  await shoot(icon(180), 180, 180, "apple-touch-icon.png");
  /* Before the card — it is the card's input. */
  await shootConsole("screenshot.png");
  await shoot(card("screenshot.png"), 1200, 630, "social-card.png");
} finally {
  /* Swallowed: the scratch file may never have been written if the very first
     capture threw, and ENOENT here would mask the real error. */
  await unlink(SCRATCH).catch(() => {});
  await browser.close();
}

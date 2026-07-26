#!/usr/bin/env node
/**
 * capture.mjs — visual-regression baselines for both demo pages.
 *
 *   npm i -D playwright && npx playwright install chromium
 *   node test/visual/capture.mjs            compare against baselines
 *   node test/visual/capture.mjs --update   (re)write the baselines
 *
 * Playwright is the ONLY external dependency in this repo and it is needed for
 * nothing except this file. `npm run build`, `npm run check` and
 * `npm run contrast` are pure Node.
 *
 * The matrix covers the two things most likely to regress silently: the
 * responsive collapse (the .ac-btn--pad min-width floor has overflowed a narrow
 * viewport before) and the accessibility fallbacks, which nobody looks at by
 * hand.
 */
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const BASELINES = path.join(HERE, "baselines");
const update = process.argv.includes("--update");

/**
 * `fullPage` is a per-page decision, and the guide is the reason it exists.
 *
 * The console is one screen: capturing it whole is both cheap and exactly what
 * the gate is for. The guide is 15,000-27,000px of body text, and capturing it
 * whole cost 11.6MB of baselines — 80% of everything committed to this repo, for
 * six files, re-written in full on every `--update`. Bytes in git are forever;
 * that is a bad trade for a page whose lower two-thirds is prose.
 *
 * So the guide captures one viewport, scrolled to `anchor`. The anchor is the
 * paired-specimen grid in section 06 rather than the top of the section, and
 * that is a deliberate choice of what to spend one screen on: it puts inputs,
 * selects, an invalid field, checkboxes, radios and both toggle variants in
 * frame at once. Those are the states the forced-colors and print fallbacks get
 * wrong, and they are worth more per pixel than the button row above them.
 *
 * WHAT THIS GIVES UP: a visual regression elsewhere on the guide — the swatches,
 * the type specimens, the tables — is no longer caught. Those are documentation
 * of tokens that `npm run contrast` already gates numerically.
 *
 * WHAT IT DOES NOT GIVE UP: the overflow probe below walks the entire DOM
 * regardless of what is screenshotted, so the responsive-collapse regression
 * this suite was built for is still gated across the whole guide at every width.
 */
const PAGES = [
  { name: "console", file: "docs/index.html", fullPage: true },
  { name: "guide", file: "docs/guide.html", fullPage: false, anchor: "#controls .doc-grid2" },
];

const CASES = [
  { id: "1440-sims-on", width: 1440, height: 900, sims: true },
  { id: "1440-sims-off", width: 1440, height: 900, sims: false },
  { id: "390-sims-on", width: 390, height: 844, sims: true },
  { id: "390-sims-off", width: 390, height: 844, sims: false },
  { id: "1440-reduced-motion", width: 1440, height: 900, sims: true, reducedMotion: "reduce" },
  { id: "1440-forced-colors", width: 1440, height: 900, sims: true, forcedColors: "active" },
  { id: "1280-print", width: 1280, height: 800, sims: true, media: "print" },
];

/**
 * Rasterisation noise floor — the one thing byte equality cannot promise.
 *
 * `backdrop-filter` is composited on the GPU and Chrome has two raster paths for
 * it, picking between them per run. The output is not bit-identical: measured
 * over repeated full-page captures of the guide, the difference was bimodal and
 * perfectly reproducible at either 0 pixels or 0.125% of them, never moving any
 * pixel by more than 22 out of a possible 765. (Those runs predate the switch to
 * viewport captures; the tolerance is kept because the raster paths did not go
 * away, and the console is still captured full-page.)
 *
 * `channelSum` is the real gate. Noise nudges a pixel; a regression flips amber
 * (255,174,30) against the panel's near-black (13,7,0), which is a sum near 440.
 * The count is a second, looser guard — a one-pixel reflow moves a percent of
 * the page, not a fraction of one.
 *
 * Bytes are still compared first, so an identical capture costs nothing.
 */
const TOLERANCE = { fraction: 0.0025, channelSum: 32 };

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error(
    "\n  playwright is not installed — visual baselines cannot be captured.\n" +
      "  Install it with:  npm i -D playwright && npx playwright install chromium\n"
  );
  process.exit(2);
}

await mkdir(BASELINES, { recursive: true });
const browser = await chromium.launch();
const results = [];

/* The comparison page. Playwright's own Chromium is the PNG decoder, so this
   stays at zero dependencies beyond the one already required. */
const differ = await (await browser.newContext()).newPage();

/**
 * How far apart two PNGs are: how many pixels moved, and the worst per-pixel
 * move as a sum over R+G+B. Returns null if the two differ in size.
 */
async function measure(baseline, shot) {
  return differ.evaluate(
    async ([a, b]) => {
      const load = (x) =>
        new Promise((res, rej) => {
          const img = new Image();
          img.onload = () => res(img);
          img.onerror = rej;
          img.src = "data:image/png;base64," + x;
        });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return null;
      const total = ia.width * ia.height;

      const pixels = (img) => {
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, img.width, img.height).data;
      };
      const d1 = pixels(ia);
      const d2 = pixels(ib);

      let moved = 0;
      let worst = 0;
      for (let i = 0; i < d1.length; i += 4) {
        const d =
          Math.abs(d1[i] - d2[i]) +
          Math.abs(d1[i + 1] - d2[i + 1]) +
          Math.abs(d1[i + 2] - d2[i + 2]);
        if (d) {
          moved++;
          if (d > worst) worst = d;
        }
      }
      return { moved, worst, fraction: moved / total };
    },
    [baseline.toString("base64"), shot.toString("base64")]
  );
}

for (const page of PAGES) {
  for (const c of CASES) {
    const context = await browser.newContext({
      viewport: { width: c.width, height: c.height },
      reducedMotion: c.reducedMotion ?? "no-preference",
      forcedColors: c.forcedColors ?? "none",
      deviceScaleFactor: 1,
    });

    /* Seed the simulation state before the page's script reads it. */
    await context.addInitScript((on) => {
      try {
        localStorage.setItem("ac.sim.plasma", on ? "1" : "0");
        /* CRT carries the afterglow; there is no separate key any more. */
        localStorage.setItem("ac.sim.crt", on ? "1" : "0");
      } catch {
        /* ignore */
      }
    }, c.sims);

    /* The console demo renders a live wall clock, so a byte comparison would
       never match twice. Freeze time before any page script runs. */
    await context.addInitScript(() => {
      const FIXED = new Date("2026-07-25T21:30:00").getTime();
      const Real = Date;
      function Frozen(...args) {
        return args.length ? new Real(...args) : new Real(FIXED);
      }
      Frozen.prototype = Real.prototype;
      Frozen.now = () => FIXED;
      Frozen.parse = Real.parse;
      Frozen.UTC = Real.UTC;
      window.Date = Frozen;
    });

    const tab = await context.newPage();
    const errors = [];
    tab.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    tab.on("pageerror", (e) => errors.push(String(e)));

    await tab.goto(pathToFileURL(path.join(ROOT, page.file)).href, {
      waitUntil: "networkidle",
    });

    if (c.media) await tab.emulateMedia({ media: c.media });

    /* Drop every animation to its base state. `animation-play-state: paused`
       would freeze at whatever phase it happened to reach, which is not
       reproducible; `none` renders the un-animated frame every time.

       `transition` has to go for the same reason, and it is not hypothetical:
       initSims paints the toggle state on load, which de-energizes a thumb, and
       .ac-afterglow decays that over --ac-decay-fast — a screenshot taken inside
       that window caught it mid-drain and the suite went intermittently red. The
       token is short enough today that the 250ms wait below would probably cover
       it; that is luck, not a guarantee, and it moves whenever the gas is retuned.

       And the afterglow's scroll smear has to go too, for a reason specific to
       this harness: `fullPage: true` captures a tall page by scrolling it and
       stitching the tiles, which is real scrolling as far as the page is
       concerned. The simulation dutifully blurred whichever tiles happened to be
       mid-stitch, and a tall capture came back different roughly one run in
       three. The `anchor` scroll below would trip it the same way. */
    await tab.addStyleTag({
      content:
        "*,*::before,*::after{animation:none !important;transition:none !important}" +
        ".ac-persist::after{display:none !important}" +
        ".ac-afterglow[data-ac-scrolling]>*{filter:none !important}",
    });
    await tab.waitForTimeout(250);

    /* Page-level scroll is only half the story: .ac-screen sets overflow:clip
       so the simulation overlays can be positioned against it, which silently
       CLIPS a too-wide row instead of scrolling it. So also look for any
       element whose content is wider than its box. */
    const overflow = await tab.evaluate(() => {
      const d = document.documentElement;
      let worst = d.scrollWidth - d.clientWidth;
      for (const el of document.body.querySelectorAll("*")) {
        /* .ac-sr-only is a 1px clip box and .ac-spinner is a 1ch window over a
           4-line block — both are wider than their box on purpose. */
        if (el.closest(".ac-sr-only, .ac-spinner")) continue;
        /* Form controls scroll their own value; that is not a layout bug. */
        if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) continue;

        const style = getComputedStyle(el);
        /* `clip` belongs here with `visible` and `hidden`: like them it cannot
           scroll, so content wider than the box is lost rather than reachable.
           Leaving it out would have silently excused .ac-screen, the one box on
           the page whose clipping hides the most. */
        if (!["visible", "hidden", "clip"].includes(style.overflowX)) continue;
        /* Sub-pixel rounding shows up as 1px on fractional layouts. */
        const diff = el.scrollWidth - el.clientWidth;
        if (diff > 2) worst = Math.max(worst, diff);
      }
      return worst;
    });

    /* Scroll AFTER the overflow probe, so the probe always measures the page in
       its loaded state. `instant` and a settle frame because a smooth scroll is
       still in flight when the shutter opens. */
    if (page.anchor) {
      await tab.evaluate((sel) => {
        document.querySelector(sel)?.scrollIntoView({ behavior: "instant", block: "start" });
      }, page.anchor);
      await tab.waitForTimeout(120);
    }

    const name = `${page.name}-${c.id}.png`;
    const shot = await tab.screenshot({ fullPage: page.fullPage });
    const target = path.join(BASELINES, name);

    let status;
    if (update) {
      await writeFile(target, shot);
      status = "written";
    } else {
      try {
        const existing = await readFile(target);
        if (existing.equals(shot)) {
          status = "match";
        } else {
          /* Bytes differ. Decode and ask by how much before calling it. */
          const d = await measure(existing, shot);
          const pct = d && `${(d.fraction * 100).toFixed(3)}%/${d.worst}`;
          if (d && d.fraction <= TOLERANCE.fraction && d.worst <= TOLERANCE.channelSum) {
            status = `noise ${pct}`;
          } else {
            status = d ? `DIFF ${pct}` : "DIFF size";
            await writeFile(path.join(HERE, name.replace(/\.png$/, ".actual.png")), shot);
          }
        }
      } catch {
        status = "MISSING";
      }
    }

    results.push({ name, status, overflow, errors });
    await context.close();
  }
}

await browser.close();

let failed = 0;
for (const r of results) {
  const problems = [];
  if (r.status.startsWith("DIFF") || r.status === "MISSING") problems.push(r.status);
  if (r.overflow > 0) problems.push(`h-overflow ${r.overflow}px`);
  if (r.errors.length) problems.push(`${r.errors.length} console error(s)`);

  if (problems.length) failed++;
  const note = r.status.startsWith("noise") ? `  (${r.status})` : "";
  console.log(`  ${problems.length ? "FAIL" : "ok  "}  ${r.name}${note}  ${problems.join(", ")}`);
  for (const e of r.errors) console.log(`          ${e}`);
}

console.log(
  `\n  ${results.length} captures, ${failed} problem(s)` +
    (update ? " — baselines updated" : "")
);
if (failed && !update) process.exit(1);

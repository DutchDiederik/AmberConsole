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
 *
 * `click` exists for the server page and states the one thing the probe cannot
 * reach on its own. A hidden tab panel is display:none, which reports a
 * scrollWidth of zero — so a panel nobody opens is not measured, it is merely
 * absent. The server demo hides its widest markup by far behind a tab (a
 * seven-column table with a switch in every row, which overflowed a 390px frame
 * by 214px the first time it was written), and that is exactly the regression
 * this suite exists to catch. So the page is probed as it loads, the tab is
 * opened, and it is probed again; the worse of the two is what gets reported,
 * and the screenshot is taken of the opened state.
 *
 * `click` TAKES A LIST, because the terminal page carries five pages behind one
 * tablist and opening only the first would leave four of the densest tables in
 * the repo ungated. Each selector is clicked in turn and the page is probed
 * after each; the worst figure across all of them is what gets reported. The
 * screenshot is of the LAST one, so put the widest page last — for the terminal
 * that is XRAT, an eight-by-eight matrix.
 */
/**
 * `probeOnly` IS THE ANSWER TO THE GUIDE BECOMING EIGHT PAGES.
 *
 * The two jobs this file does are separable, and the split made that matter. The
 * screenshot gates appearance and costs a PNG in git forever; the overflow probe
 * gates responsive collapse, walks the whole DOM, and costs nothing at all. When
 * the guide was one document, listing it once bought both. Eight chapters would
 * buy eight times the bytes for a shape that is the same on all of them — and
 * NOT listing them would silently drop the overflow probe from six of the seven,
 * which is the regression this suite was actually built to catch.
 *
 * So every chapter is probed and two are photographed: the overview, which is
 * the only page carrying the chapter strip and the directory cards, and CONTROLS,
 * which is where the anchor already pointed and where the forced-colors and print
 * fallbacks have the most to get wrong.
 */
const PAGES = [
  { name: "console", file: "docs/index.html", fullPage: true },
  { name: "server", file: "docs/server.html", fullPage: true, click: "#tab-services" },
  { name: "radar", file: "docs/radar.html", fullPage: true },
  {
    name: "terminal",
    file: "docs/terminal.html",
    fullPage: true,
    click: ["#tab-depo", "#tab-govt", "#tab-indx", "#tab-fxsp", "#tab-xrat"],
  },
  /* The directory rather than the masthead: the cards are the new shape on this
     page, and the board above them is already gated on four other captures. */
  { name: "guide", file: "docs/guide.html", fullPage: false, anchor: "#chapters" },
  { name: "guide-controls", file: "docs/guide-controls.html", fullPage: false, anchor: "#controls .doc-grid2" },
  { name: "guide-color", file: "docs/guide-color.html", probeOnly: true },
  { name: "guide-type", file: "docs/guide-type.html", probeOnly: true },
  { name: "guide-effects", file: "docs/guide-effects.html", probeOnly: true },
  { name: "guide-persistence", file: "docs/guide-persistence.html", probeOnly: true },
  { name: "guide-display", file: "docs/guide-display.html", probeOnly: true },
  { name: "guide-screen", file: "docs/guide-screen.html", probeOnly: true },
];

/**
 * `sims` NAMES ONE SIMULATION, or false for none. It cannot seed both any more:
 * PLASMA and CRT are two display technologies and the module now switches either
 * one off when the other comes on (see EXCLUSIVE_SIMS in src/amber-console.js),
 * so a run that wrote both keys would capture whichever survived restore rather
 * than what it asked for — a baseline nobody could read the intent of.
 *
 * PLASMA carries the "sims-on" cases because it is what the demo ships lit and
 * therefore what a first visitor sees. CRT is not left uncovered: it takes the
 * reduced-motion case, which is a better home for it than plasma was. Nearly
 * every moving part in the system belongs to the tube — the retrace sweep, the
 * line drift, the flicker and the afterglow — so a capture that exists to prove
 * the motion fallbacks fire is now pointed at the thing that moves most.
 */
/**
 * `styles` SEEDS THE STYLE FLAGS, and `only` narrows a case to named pages.
 *
 * The rounded case is the reason both exist. CLASSIC IS THE DEFAULT, so the seven
 * cases above already gate it on all five pages; what nothing covered was the
 * page with it switched OFF, which is a whole second set of corner geometry and an
 * .ac-btn alignment reset. This case is that, and it is CONTROLS-only on the same
 * economics the `fullPage` note above argues: five full-page captures would be
 * five of the largest files in the repo, re-written on every --update, to gate a
 * shape identical on all of them. The guide's CONTROLS chapter is a viewport
 * capture and the paired specimen lives there, so one case costs a screen and
 * covers buttons, a pad, a toggle and the panels around them.
 *
 * WHAT THIS GIVES UP: the rounded path is not gated on the console, server, radar
 * or terminal boards. It is the same CSS on all five — a token override and a
 * corner shape, no per-page markup — so a regression that spared the guide would
 * be a strange one. Every other case still walks every page.
 */
const CASES = [
  { id: "1440-sims-on", width: 1440, height: 900, sims: "plasma" },
  { id: "1440-sims-off", width: 1440, height: 900, sims: false },
  { id: "390-sims-on", width: 390, height: 844, sims: "plasma" },
  { id: "390-sims-off", width: 390, height: 844, sims: false },
  { id: "1440-reduced-motion", width: 1440, height: 900, sims: "crt", reducedMotion: "reduce" },
  { id: "1440-forced-colors", width: 1440, height: 900, sims: "plasma", forcedColors: "active" },
  { id: "1280-print", width: 1280, height: 800, sims: "plasma", media: "print" },
  {
    id: "1440-rounded",
    width: 1440,
    height: 900,
    sims: "plasma",
    styles: { classic: "0" },
    only: ["guide-controls"],
    /* Its own anchor, because the point of the case is the corner and the paired
       specimen is the one place both corners are in frame together. */
    anchor: "#controls .doc-demo:has(.ac-classic)",
  },
];

/**
 * Rasterization noise floor — the one thing byte equality cannot promise.
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
    /* A case may name the pages it applies to. No `only` means every page, so
       the seven that came before this option are untouched by it. */
    if (c.only && !c.only.includes(page.name)) continue;

    const context = await browser.newContext({
      viewport: { width: c.width, height: c.height },
      reducedMotion: c.reducedMotion ?? "no-preference",
      forcedColors: c.forcedColors ?? "none",
      deviceScaleFactor: 1,
    });

    /* Seed the simulation state before the page's script reads it. Both keys are
       always written, and at most one of them says "1" — leaving the other key
       absent would hand it back to its own default, which for plasma is ON. */
    await context.addInitScript(({ want, styles }) => {
      try {
        localStorage.setItem("ac.sim.plasma", want === "plasma" ? "1" : "0");
        /* CRT carries the afterglow; there is no separate key any more. */
        localStorage.setItem("ac.sim.crt", want === "crt" ? "1" : "0");
        /* The radar page fits its own tube on a first visit — CRT · P7, with the
           CRT simulation on — because the display store is shared with the other
           demos and a radar in neon has no flash layer to show. Every context
           here is a fresh profile, so without this the page would seize both sim
           keys on all seven cases and `sims-off` would stop testing anything.
           Marking it already fitted leaves the case in charge of the simulation;
           the display still lands on P7, because that is the radio the page
           ships checked and there is no stored palette to override it. */
        localStorage.setItem("ac.radar.fitted", "1");
        localStorage.setItem("ac.term.fitted", "1");

        /* STYLE FLAGS ARE SEEDED THE SAME WAY AND FOR THE SAME REASON: initStyle
           reads storage on load, so a flag set after the fact would capture the
           page repainting rather than the page as configured. Only the flags a
           case names are written — an absent key means "the user never said",
           which is the state every other case is testing and must keep. */
        for (const [name, on] of Object.entries(styles)) {
          localStorage.setItem(`ac.sim.style.${name}`, on);
        }
      } catch {
        /* ignore */
      }
    }, { want: c.sims, styles: c.styles ?? {} });

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
    /* `content-visibility` HAS TO GO TOO, and for the same class of reason.
       docs.css puts `content-visibility: auto` with `contain-intrinsic-size:
       auto 320px` on every specimen tile, which is a real and worthwhile saving
       on a 27,000px chapter. But `auto` means "remember the size this box was
       the last time it rendered", so an off-screen tile's contribution to page
       height depends on whether it has ever been scrolled through — and the
       anchored scroll below therefore lands at a slightly different offset
       depending on render timing. That surfaces as the whole viewport shifted
       one pixel, which a full-frame comparison scores as ~76% changed.

       Forcing every tile to lay out for real makes the capture depend on the CSS
       and nothing else. It costs a little time on the tall chapters and buys a
       suite that cannot fail for a reason that is not a regression. */
    await tab.addStyleTag({
      content:
        "*,*::before,*::after{animation:none !important;transition:none !important}" +
        "*{content-visibility:visible !important}" +
        ".ac-persist::after{display:none !important}" +
        ".ac-afterglow[data-ac-scrolling]>*{filter:none !important}",
    });
    await tab.waitForTimeout(250);

    /* Page-level scroll is only half the story: .ac-screen sets overflow:clip
       so the simulation overlays can be positioned against it, which silently
       CLIPS a too-wide row instead of scrolling it. So also look for any
       element whose content is wider than its box. */
    const probe = () => tab.evaluate(() => {
      const d = document.documentElement;
      let worst = d.scrollWidth - d.clientWidth;
      for (const el of document.body.querySelectorAll("*")) {
        /* .ac-sr-only is a 1px clip box and .ac-spinner is a 1ch window over a
           4-line block — both are wider than their box on purpose.

           .doc-ppi — the radar dial — is the third of that kind and the least
           obvious. EVERYTHING ON IT IS POLAR: a bearing mark, a contact and the
           bearing line are each a ZERO-WIDTH arm pinned at the center of the
           dial and rotated to their bearing, carrying their mark centered on the
           far end. Both halves of that defeat this measurement. A zero-width box
           reports its mark's full width as overflow, and scroll overflow is
           measured on axis-aligned bounds, so a rotated arm reports a box far
           wider than the thing at the end of it — while every one of those marks
           is inside the circle and clipped by nothing.

           The dial cannot overflow its own parent regardless: it carries
           aspect-ratio: 1 and a max-width, and every box above it is still
           probed at every width.

           .doc-ticker is the fourth and is the same shape of thing as the
           spinner: a marquee is CONTENT WIDER THAN ITS BOX as its entire
           definition, translated through a fixed window. Measuring it reports
           the length of the tape. */
        if (el.closest(".ac-sr-only, .ac-spinner, .doc-ppi, .doc-ticker")) continue;
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

    let overflow = await probe();

    /* Open the tabs the page ships closed, then probe what each one revealed.
       See the note on `click` above: a display:none panel measures zero, so this
       is the only way their markup is gated at all. */
    for (const selector of [page.click ?? []].flat()) {
      await tab.click(selector);
      await tab.waitForTimeout(120);
      overflow = Math.max(overflow, await probe());
    }

    /* Scroll AFTER the overflow probe, so the probe always measures the page in
       its loaded state. `instant` and a settle frame because a smooth scroll is
       still in flight when the shutter opens.

       A CASE MAY POINT SOMEWHERE ELSE THAN ITS PAGE DOES. The page's anchor is
       chosen for what is worth one screen in general; a case that exists to gate
       one feature is worth pointing at that feature instead. */
    const anchor = c.anchor ?? page.anchor;
    if (anchor) {
      await tab.evaluate((sel) => {
        document.querySelector(sel)?.scrollIntoView({ behavior: "instant", block: "start" });
      }, anchor);
      await tab.waitForTimeout(120);
    }

    const name = `${page.name}-${c.id}.png`;

    /* Probed, not photographed — see the note on PAGES. */
    if (page.probeOnly) {
      results.push({ name, status: "probed", overflow, errors });
      await context.close();
      continue;
    }

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

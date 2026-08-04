#!/usr/bin/env node
/**
 * capture.mjs — computed-style regression for the things a SCREENSHOT CANNOT SEE.
 *
 *   npm run test:computed            compare against baselines
 *   npm run test:computed -- --update  (re)write the baselines
 *
 * WHY THIS EXISTS, AND IT IS NOT THEORETICAL.
 *
 * test/visual/ freezes animation before it captures — it has to, or a blinking
 * alarm makes every run non-deterministic. So at the frozen frame a blinking
 * element and a stopped one are both fully opaque and look identical. It also
 * never hovers and never presses, so the extruded key edge, the pressed edge and
 * every :hover state are invisible to it.
 *
 * During the effects.css split an unterminated comment silently swallowed a live
 * rule. stylelint passed. The build passed. All 85 screenshots passed. This
 * suite caught it, because the rule it ate was `display: none` on an overlay
 * whose computed value it checks.
 *
 * WHAT IT COVERS
 *   blink    5 blink sites x 7 page states x 4 media  — which keyframe is
 *            running, at what timing function, and whether the decay filter is
 *            applied. This is the machinery with the most environment overrides
 *            and the least screenshot coverage.
 *   layers   the afterimage, the meter ghost and the scroll smear, in every
 *            media that suppresses them. All are mid-decay-only effects.
 *   corners  13 controls x 8 corner scopes x 3 interaction states — including
 *            :hover and :active, which no screenshot in this repo takes.
 *
 * PLATFORM-INDEPENDENT, unlike the visual suite. Nothing here depends on font
 * rasterisation, so unlike test/visual/ this one is safe to run in CI.
 */
import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const BASELINES = path.join(HERE, "baselines");
const update = process.argv.includes("--update");

const CSS = await readFile(path.join(ROOT, "dist/amber-console.css"), "utf8");

/* Inlined rather than linked: page.setContent gives the page an about:blank
   origin, which blocks file:// subresources — a linked stylesheet would
   silently never apply and every probe would read the UA default. */
const page$ = async (browser, media, body) => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.emulateMedia(media);
  await p.setContent(
    `<!doctype html><html><head><style>${CSS}</style></head><body>${body}</body></html>`
  );
  await p.waitForLoadState("load");
  return { p, ctx };
};

const MEDIA = [
  ["screen", { media: "screen", reducedMotion: "no-preference", forcedColors: "none" }],
  ["reduced-motion", { media: "screen", reducedMotion: "reduce", forcedColors: "none" }],
  ["forced-colors", { media: "screen", reducedMotion: "no-preference", forcedColors: "active" }],
  ["print", { media: "print", reducedMotion: "no-preference", forcedColors: "none" }],
];

/* ---------------------------------------------------------------- blink -- */

const BLINK_BODY = `
<div class="ac-screen" id="frame"><div class="ac-screen__body">
  <span class="ac-blink" id="s-blink">ALARM</span>
  <span class="ac-cursor" id="s-cursor">RDY</span>
  <div class="ac-field ac-field--invalid"><input class="ac-input" id="s-invalid-class" value="x"></div>
  <input class="ac-input" id="s-invalid-aria" aria-invalid="true" value="x">
  <div class="ac-meter ac-meter--alarm"><div class="ac-meter__track">
    <div class="ac-meter__bar" id="s-meter"></div></div></div>
</div></div>`;

const BLINK_SITES = [
  ["blink", "#s-blink", null],
  ["cursor", "#s-cursor", "::after"],
  ["invalid-class", "#s-invalid-class", null],
  ["invalid-aria", "#s-invalid-aria", null],
  ["meter-alarm", "#s-meter", null],
];

/* P7 and P39 select the long-decay keyframe, so both are worth a column. */
const BLINK_STATES = [
  ["default", {}, []],
  ["blink-off", { "data-ac-style-blink": "off" }, []],
  ["afterglow", {}, ["ac-afterglow"]],
  ["afterglow+blink-off", { "data-ac-style-blink": "off" }, ["ac-afterglow"]],
  ["afterglow+p39", { "data-ac-tech": "crt", "data-ac-emitter": "p39" }, ["ac-afterglow"]],
  ["afterglow+p7", { "data-ac-tech": "crt", "data-ac-emitter": "p7" }, ["ac-afterglow"]],
  ["afterglow+p39+blink-off",
    { "data-ac-tech": "crt", "data-ac-emitter": "p39", "data-ac-style-blink": "off" },
    ["ac-afterglow"]],
];

async function blink(browser, out) {
  for (const [mName, media] of MEDIA) {
    for (const [sName, attrs, frameCls] of BLINK_STATES) {
      const { p, ctx } = await page$(browser, media, BLINK_BODY);
      await p.evaluate(({ attrs, frameCls }) => {
        for (const [k, v] of Object.entries(attrs)) document.documentElement.setAttribute(k, v);
        for (const c of frameCls) document.getElementById("frame").classList.add(c);
      }, { attrs, frameCls });

      for (const [label, sel, pseudo] of BLINK_SITES) {
        out[`blink / ${mName} / ${sName} / ${label}`] = await p.evaluate(
          ({ sel, pseudo }) => {
            const el = document.querySelector(sel);
            if (!el) return "MISSING";
            const cs = getComputedStyle(el, pseudo || undefined);
            /* Only animation-NAME and filter render. Duration and timing are
               inert once the name is `none`, and reporting them would make an
               `animation: none` -> `animation-name: none` refactor look like a
               regression when nothing about the paint changed. */
            return cs.animationName === "none"
              ? `name=none filter=${cs.filter}`
              : `name=${cs.animationName} ease=${cs.animationTimingFunction} dur=${cs.animationDuration} filter=${cs.filter}`;
          },
          { sel, pseudo }
        );
      }
      await ctx.close();
    }
  }
}

/* --------------------------------------------------------------- layers -- */

const LAYER_BODY = `
<div class="ac-screen ac-afterglow" id="frame">
  <span class="ac-persist" id="persist"></span>
  <div class="ac-screen__body" id="child">
    <button class="ac-btn ac-btn--filled" id="a-btn">KEY</button>
    <button class="ac-tab ac-tab--active" id="a-tab">TAB</button>
    <a class="ac-nav__link" aria-current="page" id="a-nav">NAV</a>
    <span class="ac-badge ac-badge--filled" id="a-badge">B</span>
    <table class="ac-table"><tbody><tr class="ac-table__row--active">
      <td id="a-td">C</td></tr></tbody></table>
    <div class="ac-meter"><div class="ac-meter__track" id="a-track"></div></div>
  </div>
  <nav class="ac-nav ac-nav--sticky" id="sticky">S</nav>
</div>`;

const LAYER_SITES = [
  ["afterimage-btn", "#a-btn", "::after", "boxShadow"],
  ["afterimage-tab", "#a-tab", "::after", "boxShadow"],
  ["afterimage-nav", "#a-nav", "::after", "boxShadow"],
  ["afterimage-badge", "#a-badge", "::after", "boxShadow"],
  ["afterimage-td", "#a-td", "::after", "boxShadow"],
  ["afterimage-btn-display", "#a-btn", "::after", "display"],
  ["afterimage-td-display", "#a-td", "::after", "display"],
  ["meterghost-display", "#a-track", "::before", "display"],
  ["smear-child", "#child", null, "filter"],
  ["smear-persist", "#persist", null, "filter"],
  ["smear-sticky", "#sticky", null, "filter"],
  ["smearbloom-display", "#persist", "::after", "display"],
];

async function layers(browser, out) {
  for (const [mName, media] of MEDIA) {
    for (const scrolling of [false, true]) {
      const { p, ctx } = await page$(browser, media, LAYER_BODY);
      await p.evaluate((s) => {
        const f = document.getElementById("frame");
        /* --ac-smear is what the effects module drives, on the frame. */
        if (s) { f.setAttribute("data-ac-scrolling", ""); f.style.setProperty("--ac-smear", "1"); }
        document.getElementById("a-track").style.setProperty("--ac-meter-value", "40");
      }, scrolling);

      for (const [label, sel, pseudo, prop] of LAYER_SITES) {
        out[`layers / ${mName} / scroll=${scrolling} / ${label}`] = await p.evaluate(
          ({ sel, pseudo, prop }) => {
            const el = document.querySelector(sel);
            return el ? getComputedStyle(el, pseudo || undefined)[prop] : "MISSING";
          },
          { sel, pseudo, prop }
        );
      }
      await ctx.close();
    }
  }
}

/* -------------------------------------------------------------- corners -- */

const CORNER_BODY = `
<div class="ac-screen" id="frame"><div class="ac-screen__body">
  <button class="ac-btn" id="b-plain">A</button>
  <button class="ac-btn ac-btn--filled" id="b-filled">B</button>
  <button class="ac-btn" aria-pressed="true" id="b-pressed">C</button>
  <button class="ac-btn ac-btn--dim" id="b-dim">D</button>
  <button class="ac-btn" disabled id="b-disabled">E</button>
  <button class="ac-btn" aria-disabled="true" id="b-ariadis">F</button>
  <button class="ac-btn ac-btn--block" id="b-block">G</button>
  <button class="ac-btn ac-btn--pad" id="b-pad">H</button>
  <button class="ac-btn ac-keypad__key" id="b-keypad">7</button>
  <button class="ac-toggle" id="t-btn"><span class="ac-toggle__track" id="t-track">
    <span class="ac-toggle__thumb"></span></span></button>
  <button class="ac-toggle" disabled id="t-btn-dis"><span class="ac-toggle__track" id="t-track-dis">
    <span class="ac-toggle__thumb"></span></span></button>
  <!-- The CSS-only toggle, in both states. It is a separate code path from the
       button form above — a <label> wrapping a real checkbox — and the two are
       documented as equivalent, so both have to be measured or they drift. They
       had: the disabled button form dimmed its housing while this one blanked
       it, and nothing in the suite could see the difference. -->
  <label class="ac-toggle ac-toggle--input" id="t-inp"><input type="checkbox" checked>
    <span class="ac-toggle__track" id="t-track-inp"><span class="ac-toggle__thumb"></span></span>
    <span class="ac-toggle__state"></span></label>
  <label class="ac-toggle ac-toggle--input" id="t-inp-dis"><input type="checkbox" disabled>
    <span class="ac-toggle__track" id="t-track-inp-dis"><span class="ac-toggle__thumb"></span></span>
    <span class="ac-toggle__state"></span></label>
  <div class="ac-panel" id="p-panel">P</div>
  <input class="ac-input" id="i-input">
</div></div>`;

const CORNER_TARGETS = [
  "#b-plain", "#b-filled", "#b-pressed", "#b-dim", "#b-disabled", "#b-ariadis",
  "#b-block", "#b-pad", "#b-keypad", "#t-track", "#t-track-dis",
  "#t-track-inp", "#t-track-inp-dis", "#p-panel", "#i-input",
];

/* `bare` is the CSS-only consumer — no attribute, no class, no JavaScript. It is
   the most important column here and the one that was wrong until 2.0. */
const CORNER_SCOPES = [
  ["bare", {}, [], null],
  ["flag-on", { "data-ac-style-classic": "on" }, [], null],
  ["flag-off", { "data-ac-style-classic": "off" }, [], null],
  ["frame-classic", {}, ["ac-classic"], null],
  ["frame-rounded", {}, ["ac-rounded"], null],
  ["flag-on+frame-rounded", { "data-ac-style-classic": "on" }, ["ac-rounded"], null],
  ["self-classic", {}, [], "ac-classic"],
  ["flag-on+self-rounded", { "data-ac-style-classic": "on" }, [], "ac-rounded"],
];

const CORNER_PROPS = ["boxShadow", "borderRadius", "alignItems", "justifyContent", "textAlign", "display"];

async function corners(browser, out) {
  const { p, ctx } = await page$(browser, MEDIA[0][1], CORNER_BODY);
  for (const [label, attrs, frameCls, selfCls] of CORNER_SCOPES) {
    for (const state of ["rest", "hover", "active"]) {
      await p.setContent(
        `<!doctype html><html><head><style>${CSS}</style></head><body>${CORNER_BODY}</body></html>`
      );
      await p.evaluate(({ attrs, frameCls, selfCls, targets }) => {
        for (const [k, v] of Object.entries(attrs)) document.documentElement.setAttribute(k, v);
        for (const c of frameCls) document.getElementById("frame").classList.add(c);
        if (selfCls) for (const t of targets) document.querySelector(t)?.classList.add(selfCls);
      }, { attrs, frameCls, selfCls, targets: CORNER_TARGETS });

      for (const sel of CORNER_TARGETS) {
        if (state !== "rest") {
          const box = await p.locator(sel).boundingBox().catch(() => null);
          if (!box) { out[`corners / ${label} / ${state} / ${sel}`] = "NOBOX"; continue; }
          await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          if (state === "active") await p.mouse.down();
        }
        out[`corners / ${label} / ${state} / ${sel}`] = await p.evaluate(
          ({ sel, props }) => {
            const el = document.querySelector(sel);
            if (!el) return "MISSING";
            const cs = getComputedStyle(el);
            return props.map((k) => `${k}=${cs[k]}`).join(" ; ");
          },
          { sel, props: CORNER_PROPS }
        );
        if (state === "active") await p.mouse.up();
      }
    }
  }
  await ctx.close();
}

/* ----------------------------------------------------------------- main -- */

const browser = await chromium.launch();
const out = {};
await blink(browser, out);
await layers(browser, out);
await corners(browser, out);
await browser.close();

await mkdir(BASELINES, { recursive: true });
const file = path.join(BASELINES, "computed.json");
const next = JSON.stringify(out, null, 2) + "\n";

if (update) {
  await writeFile(file, next);
  console.log(`\n  ${Object.keys(out).length} probes, baselines updated\n`);
  process.exit(0);
}

let prev;
try {
  prev = JSON.parse(await readFile(file, "utf8"));
} catch {
  console.error(
    `\n  no baseline at ${path.relative(ROOT, file)} — run:\n` +
      `    npm run test:computed -- --update\n`
  );
  process.exit(1);
}

const keys = [...new Set([...Object.keys(prev), ...Object.keys(out)])].sort();
const diffs = keys.filter((k) => prev[k] !== out[k]);

for (const k of diffs) {
  console.error(`  CHANGED  ${k}\n    before  ${prev[k] ?? "(absent)"}\n    after   ${out[k] ?? "(absent)"}`);
}
console.log(
  `\n  ${Object.keys(out).length} probes, ${diffs.length} change(s)` +
    (diffs.length ? " — review, then re-run with --update if intended\n" : "\n")
);
process.exit(diffs.length ? 1 : 0);

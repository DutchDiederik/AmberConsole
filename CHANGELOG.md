# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added — three plasma gases

- **`plasma/helium`, `plasma/argon`, `plasma/krypton`**, computed rather than picked. Helium is a
  pale pink (x=0.394 y=0.299), argon a pale violet-lavender (x=0.216 y=0.105), krypton a pale
  violet-white (x=0.315 y=0.255). All three clear every required contrast pair, because the stops are
  *solved to* their ratios rather than chosen and checked.
- **`scripts/derive-gas.mjs` + `scripts/data/emitters.json`** — NIST line table → CIE 1931 2°
  integral → sRGB gamut map → five stops solved against that palette's own panel black. Zero
  dependencies. `npm test` re-derives and fails on drift, including the hex printed as text under
  every swatch in the guide, which is documentation that could otherwise disagree with the token it
  documents and look fine doing it.
- **A known-answer gate.** Neon is in the line table but is *not* generated (`emit: false`). It is
  there to prove the pipeline: it derives to x=0.6405 y=0.3591 against the x=0.631 y=0.369 this
  project established independently, agreeing to 0.0137, and the build fails if that ever stops being
  true. Finding out the colour maths broke against an answer we know beats staring at three palettes
  whose answers nobody knows.

### Added — per-gas glow

- **`--gas-scatter` and `--gas-spread`.** Until now every palette bloomed with identical geometry and
  only the colour changed. Rayleigh scattering goes as λ⁻⁴, so a violet gas throws far more of itself
  sideways into the glass than a red one: helium 1.26, krypton 1.31, argon 1.49 against neon's 1.00.
  `--gas-spread` is the square root, since multiple scattering widens the halo as it brightens it, so
  both numbers come off one mechanism and cannot disagree. Derived per palette; both fall back to 1,
  so neon and P3 render byte-identically and the visual baselines still pass.
- The **innermost 2px layer is deliberately not scaled** — that is the glyph's own lit edge, where the
  photons started, not scattered light. Only the wide layers are the halo.
- Weighted by `I(λ)·V(λ)`, and it is the mean of λ⁻⁴ rather than λ⁻⁴ of the mean wavelength. Those
  differ for a spread spectrum, and the second is wrong: luminance-weighting a mean wavelength drags
  every gas toward 555 nm by construction and under-reports the difference.
- **Not modelled, on purpose:** the eye's longitudinal chromatic aberration. It really does make
  violet look fuzzier and ratios out at 2.67× for argon, but the absolute difference is 0.126 D —
  about half an arcminute, under a pixel — so using it would inflate a sub-pixel effect into 150 px
  of fog. The ratio is real; using it here would not be.
- P3 holds neon's 1.00 as a placeholder rather than a derived result: it is a broad band, not a line
  spectrum, so the integral has nothing to run over until `derive-gas.mjs` grows a band model in the
  CRT pass — where P7's two layers make one unavoidable anyway.

### Changed — the saturation rule

- **`colors.css` no longer claims saturation is held at 100%.** That was true of the two emitters it
  described and false in general — a special case wearing a rule's clothes. Helium, argon and krypton
  are multi-line emitters whose light genuinely *is* pale, and forcing them to 100% would mean
  inventing a saturation the gas does not have. Replaced by the rule it was a special case of:
  **chromaticity is derived from the emitter's spectrum and never adjusted; saturation is an output,
  not a setting.** Neon still solves to 100% under it, and the old `--amber-100` exception ("a hotter
  cell can only get there by whitening") stops being an exception and becomes an instance.
- Stated explicitly alongside it: **hue comes from the spectrum, luminance from the drive level.**
  Argon really does emit very little visible light — that is a fact about radiant efficiency, not
  about what colour the cell is. Drive it harder and it is still argon.
- **Law 1 is now written as per-palette**, which it always was — `crt/p3` established that at 38°.
  Its prose narrated neon specifically and would have read as false beside a lavender panel.

### Changed — token names

- **The ramp is `--emit-100` … `--emit-30`.** `--amber-*` named a hue rather than a ramp and was
  already only historically true; with a lavender and a pink in the file it stopped being defensible.
  `--amber-*` survives as a deprecated alias, removed in 3.0, and resolves per palette for free since
  it points at `--emit-*`.
- `button.css` and `tabs.css` read `var(--amber-100)` where they meant `--ink-bright`; repointed. No
  component reaches past the semantic aliases now.
- **Krypton's emission peak corrected to 587.1 nm.** NIST gives 587.09 at intensity 3000 as the
  strongest visible Kr I line, against 557.03 at 2000.

### Added

- **`.ac-setup`** — the permanently-open control board under the menu bar. It does not open, close,
  scroll or stick, and that is the design: a machine with a settings page does not hide it behind a
  key, and a board you have to reveal is a board whose state you cannot read at a glance. Four
  quarters, degrading to two-by-two and then one column — three columns is deliberately not one of
  the stops, because four regions across three tracks wraps the fourth under the first and leaves a
  region-sized hole beside it.
- **`[data-ac-display-info]`** — shows one node and hides the rest, so the board can carry a note
  describing whatever hardware is currently in the panel. Keyed by technology, or by an exact
  tech/emitter pair where one emitter does not behave like the rest of its family. Prose is markup,
  like the catalog.
- **Display presets** — `[data-ac-display]` on a radio, carrying `data-ac-tech`, `data-ac-emitter`
  and `data-ac-sims`. Selecting one sets the palette, mounts the simulations that technology implies
  and switches every other one off, in a single click. A preset is a starting point, not a lock:
  deviate afterwards and the readout says `*MOD`, and `[data-ac-display-reset]` puts it back.
  The catalog is **markup, not a table inside the JavaScript**, so a consumer with their own
  palettes writes their own rows and the module needs no edit.
- **`[data-ac-display-out]`** — readout hooks for `label`, `tech`, `emitter`, `peak` and `mode`.
- **`data-ac-peak`** on a catalog row, surfaced as EMISSION in the demo's STATE region. Carried by
  all eleven rows including the nine not fitted yet, so enabling a palette stays a markup-only edit.
  It is deliberately **not the same kind of number on both sides of the catalog**, which is the
  clearest single argument for why the two catalogs are not one list: a gas emits a line spectrum and
  the number is its strongest *visible* line, which is not the perceived hue — argon reads violet
  while its strongest visible line is deep red at 696.5 nm, and most of what argon emits is not
  visible at all. A phosphor emits a broad band and the number is the band peak, which does
  correspond to the hue. P4 and P7 carry two numbers each because they are two emitters — a blend and
  a two-layer stack respectively — not because the figure is being hedged.
- **`data-ac-style-*`, a third axis** — `blink` and `smear` to start. Deliberately separate from both
  the palette and the simulations, on their own attributes, in their own region of the drawer: a
  style is a preference and makes no claim about what the panel is. "Turn the blink off" is not a
  statement about plasma and must never read as one.

### Changed

- **A palette now takes two attributes: `data-ac-tech` + `data-ac-emitter`.** The same color word
  means different physics on different glass, so "which color" is not answerable on its own — a gas
  and a phosphor can be the same color and are not the same thing. Every palette block is selected
  by both, so a mismatched pair selects nothing rather than quietly rendering the wrong hardware, and
  it is structurally impossible to offer a phosphor as a gas.
- `scripts/contrast.mjs` identifies palettes by the tech/emitter pair rather than by gas name,
  because an emitter alone is not unique across technologies and never will be — two technologies can
  both ship a "white". The deprecated aliases ride on the same blocks and are deliberately not
  enumerated, so a legacy name cannot double-count a palette already being checked.
- The demo pages' three inline nav toggles moved onto the board. The bar keeps a `DISPLAY:` readout
  that names the technology before the emitter — the board scrolls away and the sticky bar does not,
  so that readout is the one thing always on screen, and nobody has to remember whether P39 was a gas.
- **PLASMA and CRT are now mutually exclusive.** They are two display technologies, not two layers of
  glass: a frame carrying both had gas gaps and a scanning beam in the same enclosure, and wore a cell
  mesh and raster blanking gaps at once — the two textures section 04 of the guide spends a paragraph
  separating. Switching either one on switches the other off, and both toggles move to prove it.
  Enforced in `applySim`, so the click path, the DISPLAY presets and the restore-from-storage path all
  obey it rather than one of the three. Both *off* is still reachable: that is a flat lit surface, no
  particular hardware, and an honest thing to want to look at.
- **A `data-ac-style-*` flag is only restored from storage while the page still ships a switch for
  it.** Take the control out of the markup and the flag falls back to the author's own attribute, or
  to its default, and nothing is written back — the stored value still belongs to whatever page does
  have the switch. A preference with no control left on the page is not a preference, it is a setting
  the visitor can no longer reach, and one earlier click would otherwise have turned blink off on that
  page permanently.
- **The demo board no longer offers a BLINK switch.** Blink is law-2 emphasis and half of what the
  alarm specimens are demonstrating, so the demos keep it on. The flag is unchanged and still in the
  framework — put `data-ac-style="blink"` on a toggle to expose it, or write
  `data-ac-style-blink="off"` on the root; `prefers-reduced-motion` stops it either way.
- **The read-only regions on `.ac-setup` are framed in `--stroke` like every other region.**
  `.ac-panel--dim` still dims its frame on its own, but four regions sit edge to edge on the board and
  one frame drawn a step darker than the three beside it does not read as "this recedes", it reads as
  a panel that failed to light. The recede moves to the title and the contents, which is what an
  operator is actually reading.

### Deprecated

- **`data-ac-gas="neon"` / `data-ac-gas="amber"`**, and the `data-ac-gas-toggle` button hook. Both
  still work and both go in 3.0. The name was the bug: `amber` was never a gas, it is the P3 CRT
  phosphor, and a control that calls a phosphor a gas is the confusion this release exists to remove.
  Migrate `neon` to `plasma`/`neon` and `amber` to `crt`/`p3`.

### Fixed

- Blink now switches off under the CRT simulation as well as on a bare panel. Every blink site has an
  `.ac-afterglow`-scoped decay variant, which is a descendant selector and outranks a bare
  `.ac-blink { animation: none }` — the fourth time this specificity trap has been hit in this file,
  and the first time the override has been written to outrank both forms regardless of source order.
- **Afterglow ghosts no longer keep the `data-ac-*` hooks they were cloned from.** `sanitize()`
  stripped `id` and stopped there, so a ghost was still matched by every document-wide
  `querySelectorAll` in the module: a ghosted readout got rewritten by the next paint — with the
  *live* value, the one thing a ghost must never show — and a ghosted toggle had its thumb moved by
  the next `applySim`. Worse, `.ac-persist` is prepended to the frame, so a stale ghost came first in
  document order and was what a plain `querySelector` found instead of the real element. A ghost is a
  photograph; nothing may keep writing on it.

## [1.0.0] — 2026-07-26

First release. Packages the Amber Console design system as a standalone, dependency-free CSS
framework with a two-page demo site.

### Added

- **Tokens** — `colors`, `typography`, `spacing`, `effects`. Every numeric value is taken from the
  source design system; none was re-derived, rounded, or snapped to a grid. See *Deviations from the
  source* below for the complete list of exceptions.
- **Base** — `reset.css` (global) and `reset-scoped.css` (under `.ac-root`, for embedding);
  `layout.css` with `.ac-screen`, `.ac-stack`, `.ac-row`, `.ac-grid`/`--console`, `.ac-col-*`,
  `.ac-spacer`, `.ac-grow`, `.ac-push`, `.ac-sr-only`; `a11y.css` (`forced-colors`) and `print.css`.
- **Components, ported** — `.ac-btn`, `.ac-tabs`/`.ac-tab`, `.ac-nav`, `.ac-panel`, `.ac-field`/
  `.ac-input`, `.ac-select`, `.ac-check`, `.ac-radio`, `.ac-toggle`, `.ac-statusbar`, `.ac-readout`,
  `.ac-badge`, `.ac-banner`, `.ac-table`, `.ac-hr`.
- **Components, new** — `.ac-list` (keyed log with leader dots), `.ac-dialog` (native `<dialog>`),
  `.ac-meter` (stepped bargraph), `.ac-keypad` (3-column numeric entry), `.ac-spinner`
  (`| / — \` on a `steps(4)` clock).
- **Attribute-driven state** — `[aria-pressed]`, `[aria-selected]`, `[aria-current]`, `[aria-invalid]`,
  `:checked`, `:disabled` as primary styling hooks, with the `--filled`/`--active` classes as
  equivalent aliases, so any framework drives the CSS identically.
- **Two gases** — `data-ac-gas="neon"` (24°, the default) and `data-ac-gas="amber"` (38°, the P3
  phosphor the source design system was drawn against). Not a light/dark pair: two different pieces
  of hardware. Each palette declares only the five discharge stops, the three surfaces, `--on-fill`
  and the four `--gas-N` glow triples; everything else in the system is an alias or is built from
  those, so a third gas is one block and nothing else. `scripts/contrast.mjs` runs the full pair
  table against **both** independently — a ratio that passes under one and fails under the other is
  a build failure.
- **Self-hosted fonts** — VT323 and Silkscreen woff2 with correct `unicode-range` per subset and both
  OFL licenses. `tokens/fonts-cdn.css` remains as a one-line swap.
- **Build** — `scripts/build.mjs`, zero dependencies, emits `amber-console.css` (+ sourcemap),
  `.min.css`, `.layer.css`, `.layer.min.css`, and both JS builds. Minified on both axes, because
  the layer build is the one recommended for embedding and embedding is a production context.
- **Generated brand assets** — `scripts/make-assets.mjs` renders the favicon, the touch icon and the
  1200×630 social card *through `dist/amber-console.css` itself*, so the mark is the letter A set in
  VT323 under the real `--glow-text` and cannot drift from the palette. PNG rather than the usual
  inline SVG because `npm run check` bans `<svg>` in HTML and law 6 has no exception for browser
  chrome.
- **Optional JS** — `src/amber-console.js`, no dependencies: tablist keyboard model, toggle flip,
  screen simulations with `localStorage`, gas toggle, `<dialog>` open/close, and the afterglow ghosts.
- **Gates** — `scripts/check-prohibitions.mjs` (six mechanical rules), `scripts/contrast.mjs`
  (computed WCAG table, both palettes), `test/visual/capture.mjs` (14 Playwright captures), stylelint
  config enforcing the `ac-` BEM pattern and banning `transition` in components.
- **Docs site** — `docs/index.html` (the ORION-70 console) and `docs/guide.html` (sections 01–08),
  both static and openable from `file://`.

### Added — the screen simulations

Three classes on the outermost frame, driven from two operator switches. `.ac-afterglow` rides with
`.ac-crt`, because persistence is a property of the same glass the scanlines are on; each still works
alone if wired by hand. **The demos default to PLASMA on and CRT off** — plasma is what the panel
*is*, while CRT simulates a different display technology whose horizontal blanking gaps are the one
thing a plasma panel conspicuously does not have. Defaults are per-simulation (`defaultOn` in the
`SIMS` map), and the demo markup ships the default state rather than the everything-on state:
anything off by default must be absent from static HTML, or it paints for one frame on every load
before `initSims` removes it.

- **`.ac-bloom` — the panel.** Amplified glow tokens for every descendant, a soft bleed layer
  breathing on a 9s mains cycle, and the cell mesh.
  - *the screen door* — two crossed `repeating-linear-gradient`s on a `--ac-mesh-pitch` (3px) grid,
    so a lit pixel reads as a neon dot trapped at a wire intersection rather than part of a solid
    stroke. Crossings land at roughly twice the attenuation of a single wire, which is what makes an
    intersection read as one. The ribs are pure black rather than tinted, so the grid appears **only
    where the panel is lit** — over the unlit screen a black veil has nothing to take away, measured
    at a worst-case 5/765 shift. Horizontal blanking gaps stay where they belong, on `.ac-crt`.
  - *the shimmer* — the sustain voltage is AC, so the gas is struck and re-struck rather than held.
    A sub-pixel jitter (`ac-mesh-buzz`, 0.29s, hard-stepped so it is a buzz and not a wobble) plus a
    micro-flicker (`ac-mesh-hum`, 0.37s). The two durations are coprime and non-harmonic with the
    9s / 11s / 13s / 5.5s cycles already on the frame, so nothing ever finds a beat. Amplitude is
    capped roughly three orders below the WCAG 2.3.1 general flash threshold.
  - *`--ac-mesh-wire` is a budget, not a taste setting* — `0.075` per axis is the value that holds
    the mean transmittance loss at `0.050`, matching the CRT scanlines it sits beside.
    `scripts/contrast.mjs` reads `colors.css` and cannot see an overlay, so raising it fails
    nothing and costs real legibility.
  - Mounted as an `.ac-mesh` child rather than `.ac-bloom::after`, and the reason is worth recording:
    `.ac-bloom` and `.ac-crt` are both classes on the same frame, an element has exactly one
    `::after`, and `.ac-crt::after` — equal specificity, later in the file — already owns it for the
    scanlines. Declared there, the mesh is silently replaced whenever both simulations are on, which
    is the default. Same one-span contract as `.ac-retrace` and `.ac-persist`.
  - Under `prefers-reduced-motion` the shimmer stops and **the mesh keeps rendering** — it is the
    shape of the hardware, not an effect playing over it. That reset is restated at
    `.ac-bloom > .ac-mesh` weight, because a media query adds no specificity and the bare
    `.ac-mesh` form loses to the rule that declares the animation. Hidden outright under
    `forced-colors` and in print, and excluded from the scroll-smear filter with the other overlay
    nodes: the glass does not go out of focus when the picture moves.

- **`.ac-crt` — the tube.** Scanline texture, edge vignette, one-cell line drift per 11s, ±2% mains
  flicker, and a retrace band sweeping down every 13s.

- **`.ac-afterglow` — plasma persistence.** A cell that stops being driven relaxes rather than
  switching off. Six phenomena, only four of them reachable from CSS alone:
  - *decay-out* — anything that goes `[hidden]`, or a `<dialog>` that closes, drains on an
    exponential curve instead of switching off. Pure CSS: the transition is declared on the hidden
    state only, so hiding decays and showing snaps back instantly. Nothing ever fades **in**.
  - *ghosting* — text rewritten in place leaves its previous value behind for a beat. A
    `MutationObserver` in `amber-console.js` handles both the `characterData` and the
    `childList` form of a text swap and parks an `aria-hidden`, `inert` copy at the rect it occupied.
  - *residual patches* — four overlapping pools of charge at 3% over the amber, drifting on a 47s
    cycle, so the panel is never perfectly uniform.
  - *the blink off-edge* — `.ac-blink` is `steps(1)` and snaps both ways, which would leave the most
    frequently repeating light-off event on the panel with no persistence at all. With the
    simulation on, only the ON edge stays hard. One rule swaps `animation-name` rather than the
    shorthand, so `.ac-blink`, `.ac-cursor`, an invalid `.ac-input` and an over-range
    `.ac-meter--alarm` bar all keep their own cycle length and pick up the same curve. Restated at
    matching specificity in `print.css` and the reduced-motion block, and reverted to hard
    `steps(1)` under `forced-colors` — a descendant selector would otherwise silently reinstate
    every blink those resets switch off.
  - *de-energizing* — a lit cell going unlit: a pressed button releasing, a tab deselecting, an
    interlock unchecking, the pointer leaving a control. The commonest light-off event on a control
    panel, and none of it hides, so decay-out never sees it. Declared on the unlit state so going
    out drains and coming on is instant. Lives in `tokens/effects.css`, not in the component files,
    so components stay free of `transition`.
  - *scroll smear* — scrolling hands every cell a new value at once. `amber-console.js` drives
    `--ac-smear` from the real per-frame scroll delta; the content blurs in proportion and a
    viewport-fixed additive copy of the backdrop blooms over it. Costs one screen rather than one
    document, and measured at 120.4ms vs 118.8ms median frame time on the 15,000px guide page.
    Skipped entirely under `prefers-reduced-motion`, which is where it would do real harm.
  - Tuned near the floor of what registers as a decay at all — `--ac-decay` 105ms,
    `--ac-decay-fast` 60ms, the blink window ~88ms, the scroll-smear release ~117ms (7 frames).
    Much under ~80ms and the eye reads a switch rather than a relaxation.
  - **`AmberConsole.afterglow(el)`** — ghost an element *before* removing it. A detached node has no
    rect, so the observer cannot serve that case. A no-op when the simulation is off.
  - Blanket `transition: none` resets under `prefers-reduced-motion`, `print` and `forced-colors`,
    scoped to `.ac-afterglow`. Every decay is a descendant rule and so outranks a plain reset;
    restating them one selector at a time is how the blink override slipped past twice.

### Added — decisions the source did not settle

- **The frame is the whole screen, menu bar included.** `.ac-nav--sticky` carries `z-index: 20`, so
  it would otherwise paint above the simulations and get the glow tokens but none of the overlays.
  The overlays paint from 40 up, the z-index scale is documented in one place in
  `tokens/effects.css`, and both demo pages put the nav inside the frame.
- **`.ac-screen` clips with `overflow: clip`, not `hidden`.** `hidden` makes the frame a scroll
  container, `position: sticky` resolves against that container, and the frame never scrolls — so a
  sticky bar inside an `overflow: hidden` frame does not stick at all. `clip` clips without becoming
  a scrollport.
- **On a full-screen frame the glass is anchored to the viewport, not the document.** The bleed, the
  scanline mask, the vignette and the retrace are properties of the glass, and glass does not
  scroll: a document-anchored vignette darkens the top and bottom of the *page* rather than the
  edges of the *screen*. It is also the only version that renders — Chrome rasterises a
  `backdrop-filter` stretched over a 15,105px document in tiles, and the seams showed as static
  horizontal and vertical bars, with the huge mask and vignette gradients quantising into visible
  steps for the same reason. Scoped to `.ac-screen`, so the small `.ac-bloom` / `.ac-crt` tiles the
  guide documents itself with stay local. `.ac-persist` stays document-absolute, because ghosts are
  pinned to a document coordinate.
- **`initSims` mounts overlay children in the order they are declared.** They are prepended, so
  walking the list as written puts them into the frame back-to-front: `.ac-retrace` and `.ac-persist`
  both sit at z-index 45, DOM order is the only thing breaking the tie, and a frame that mounted them
  from script would otherwise composite fractionally differently from one that shipped them in markup.

### Changed — deviations from the source design system

Every numeric value from the source design system is preserved. These are the only deviations, each
required by an accessibility criterion or by a bug found during verification:

- **`.ac-check` / `.ac-radio` labels gained `min-height: 44px`.** The drawn 20px squares are
  unchanged; the clickable label row now clears the hit-target floor. This makes stacked bit fields
  visibly taller than the source screenshots. Expanding the label was the option the source left
  open; overlapping invisible hit zones between adjacent rows was not acceptable.
- **`.ac-toggle` gained `min-height: 44px`** for the same reason. The 64×28 track is unchanged.
- **`.ac-tabs` gained `flex-wrap: wrap`.** Three title-size soft keys need ~455px and were being
  clipped by the frame at 390px.
- **`.ac-banner` steps down to `--type-title` below 480px.** Its min-content width at display size is
  near 400px, which does not fit a 390px viewport.
- **`.ac-btn` gained `display: inline-block` and `text-decoration: none`**, so the class works on
  `<a>` as well as `<button>`. No effect on `<button>`.
- **`.ac-statusbar` gained `flex-wrap: wrap`** so `KEY:VALUE` groups reflow instead of overflowing.
- **`.ac-readout__value` and `.ac-list__value` gained `font-variant-numeric: tabular-nums`** to stop
  a live counter jittering in the fallback font. No effect in VT323, which is monospaced.
- **`.ac-panel__title` background is now `var(--ac-panel-title-bg, var(--screen))`**, so the legend
  chip can mask a border over a non-`--screen` background. Default is unchanged.
- **`@media print` resets the glow on `.ac-bloom`, not only on `:root`.** `.ac-bloom` redefines
  `--glow-text` on the frame, which outranks a `:root` override for every descendant, so the page
  printed with an amber halo around the text.
- **Simulation-toggle logic lives once**, in `src/amber-console.js`. The source duplicated it between
  `console.js` and an inline script in the guide page.

### Notes on the source

The framework was ported from an internal design bundle that is not published with this repository.
Where its written specification and its actual token files disagreed, the token files won — recorded
here so the numbers in `src/tokens/` can be justified without it:

- The written spec gave `--screen` as `#0d0800`; the token file said `#0d0700`.
- It listed `.ac-table` as a component still to be designed; it already existed, complete.
- It stated the guide page carried zero JavaScript; it carried a 20-line inline script.
- It specified `a:hover` → `--ink-bright`; the source stylesheet used `--fill-bright`.
- It omitted `line-height: 1.2` on `.ac-readout__label`, which the source stylesheet sets.

And one correction of fact, carried through the guide, the README and the source comments:

- **Law 1 called the panel's single hue a phosphor.** A monochrome plasma display has none: the gaps
  hold a neon–argon mixture and the amber is neon emitting directly at ~590nm when a gap strikes.
  Phosphors belong to color plasma, where xenon UV excites RGB stripes. Law 1 ships as ONE GAS,
  MANY INTENSITIES. No class, token or keyframe name was affected — `.ac-afterglow`, `.ac-persist`
  and `--ac-decay` were already neutral. "Afterglow" was always correct: it is the standard term for
  the decaying emission of a gas discharge after the current stops.

[Unreleased]: https://github.com/DutchDiederik/amber-console/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/DutchDiederik/amber-console/releases/tag/v1.0.0

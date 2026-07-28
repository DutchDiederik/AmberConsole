# Amber Console

A project by <a href="https://diederik.blog" target="_blank" rel="noopener noreferrer">Diederik</a>, also on <a href="https://x.com/DutchDiederik" target="_blank" rel="noopener noreferrer">X</a>.

[![License: BSD-3-Clause](https://img.shields.io/badge/license-BSD--3--Clause-blue.svg)](LICENSE)
[![CSS only](https://img.shields.io/badge/runtime%20deps-0-brightgreen.svg)](#install)
[![Size](https://img.shields.io/badge/minified-35kb%20%C2%B7%206.6kb%20gzipped-lightgrey.svg)](#install)
[![CI](https://github.com/DutchDiederik/AmberConsole/actions/workflows/ci.yml/badge.svg)](https://github.com/DutchDiederik/AmberConsole/actions/workflows/ci.yml)

A monochrome amber-terminal CSS framework — the look of a late-1980s industrial control panel, the
kind of amber plasma display that drove heavy machinery. One stylesheet, no dependencies, no build
step, no JavaScript required for any component's appearance.

**[Live demo — ORION-70 console](https://dutchdiederik.github.io/amber-console/) · [System guide](https://dutchdiederik.github.io/amber-console/docs/guide.html)**

![The ORION-70 console demo](docs/screenshot.png)

Every rule in this framework descends from a hardware limitation rather than a taste preference. The
panel could only light amber pixels, so hierarchy comes from brightness, inverse video and blink —
never hue. Text sat on a character grid, so spacing is measured in 4px half-cells. Regions were drawn
with strokes, so borders do the layout work and elevation does not exist. That constraint set is the
whole design; see [the six laws](#the-six-laws).

---

## Install

**A `<link>` tag is the entire install.**

```html
<link rel="stylesheet" href="amber-console.css">
```

Download [`dist/amber-console.css`](dist/amber-console.css) and the [`fonts/`](fonts/) directory,
keeping them as siblings — the `@font-face` rules use `../fonts/`. Or:

```bash
npm install amber-console
```

```js
import "amber-console";          // dist/amber-console.css
import "amber-console/layer";    // wrapped in @layer amber-console
```

### Which build

| File | Use it when |
| --- | --- |
| `dist/amber-console.css` | Default. Readable, sourcemapped, custom properties intact. |
| `dist/amber-console.min.css` | Production. 35kb, 6.6kb gzipped, same behavior. |
| `dist/amber-console.layer.css` | Dropping into an existing app — `@layer` makes the framework lose specificity fights against your own rules. Use *instead of*, never alongside. |
| `dist/amber-console.layer.min.css` | The same, minified. Production embedding. |
| `dist/amber-console.js` | Optional behavior, ES module. For bundlers. |
| `dist/amber-console.global.js` | Optional behavior, classic script. Needed for `file://` pages, where `type="module"` is blocked. |

Custom properties survive into `dist/` unresolved — they are the public API, so you can override any
of them at runtime without rebuilding.

## Quickstart

```html
<link rel="stylesheet" href="dist/amber-console.css">

<div class="ac-screen ac-bloom ac-crt ac-afterglow">
  <span class="ac-mesh"></span>
  <span class="ac-retrace"></span>
  <span class="ac-persist"></span>
  <nav class="ac-nav ac-nav--sticky">…</nav>   <!-- inside the frame, so the sims reach it -->
  <div class="ac-screen__body">
    <div class="ac-panel">
      <span class="ac-panel__title">Show Information</span>
      <div class="ac-statusbar" role="status"><span>STATUS:AUTO MODE</span></div>
      <button class="ac-btn ac-btn--filled">Run</button>
    </div>
  </div>
</div>
```

That renders a framed, glowing, scanlined control panel. No build step, no server — save it as a
`.html` file and double-click it.

## Class reference

### Layout

| Class | What it is | Modifiers |
| --- | --- | --- |
| `.ac-screen` | Full-height frame that hosts the simulations | — |
| `.ac-screen__body` | Padded content area inside it | override `--ac-screen-pad` |
| `.ac-stack` | Flex column, `gap` from `--gap` | — |
| `.ac-row` | Flex row, `gap` from `--gap` | `--wrap` `--center` `--baseline` `--between` `--end` |
| `.ac-grid` | Grid, columns from `--cols` | `--console` (operate left / instrument right) |
| `.ac-col-2/3/4/6` | Column span | — |
| `.ac-spacer` `.ac-grow` `.ac-push` | Fill, absorb, push-to-end | — |
| `.ac-sr-only` | Available to assistive tech, invisible | — |

### Controls

| Class | What it is | Modifiers | Required markup |
| --- | --- | --- | --- |
| `.ac-btn` | Soft key | `--filled` `--dim` `--lg` `--sm` `--pad` `--block` | `<button>`, `<a>` or `<input type="submit">` |
| `.ac-tabs` / `.ac-tab` | Soft-key tabs, Title Case | `.ac-tab--active` | `role="tablist"` > `role="tab"` + `aria-selected` |
| `.ac-nav` | Screen menu bar | `--sticky` | `__mark` `__links` `__link` (`--active`) `__meta`; `aria-current="page"` |
| `.ac-setup` | Permanently-open control board under the bar. Never opens, closes, scrolls or sticks | — | `__grid` (quarters) + `__foot`; regions are `.ac-panel` |
| `.ac-check` | Status bit — fills solid, no ✓ glyph | `--disabled` | `<label>` > `<input type="checkbox">` + `<span>` |
| `.ac-radio` | Exclusive mode | `--disabled` | `<label>` > `<input type="radio">` + `<span>` |
| `.ac-toggle` | Two-position switch with mandatory ON/OFF text | `--on` `--input` (CSS-only) | `__track` > `__thumb`, plus `__state` |
| `.ac-field` / `.ac-input` | Labeled recessed well | `--block` `--invalid` | `<label>` > `__label` + `<input>` |
| `.ac-select` | `.ac-input` plus a typeset ▼ | `--block` | `<span class="ac-select">` > `<select class="ac-input">` |
| `.ac-keypad` | 3-column numeric entry grid | `__key` `__key--fn` `__key--wide` `--dense` | keys are `.ac-btn` |

### Display

| Class | What it is | Modifiers | Required markup |
| --- | --- | --- | --- |
| `.ac-panel` | Framed region | `--dim` `--bar` | `__title` (legend chip) or `__barTitle` (inverse strip) |
| `.ac-statusbar` | The machine's voice, inverse video | `--line` | `role="status"` |
| `.ac-readout` | Instrument value | `--lg` `--inline` | `__label` (`--plain`) + `__value` + `__unit` |
| `.ac-badge` | Micro tag, Silkscreen at 8px | `--filled` `--dim` | — |
| `.ac-banner` | Loudest element. One per screen | `--filled` `--dim` | `role="alert"`; ✳✳ auto-injected |
| `.ac-table` | Data grid | `--zebra` `--dense`, `__num`, `__row--active` | wrap in `.ac-table-scroll` |
| `.ac-list` | Keyed log with leader dots | `--bright` `--dim` `--dense` | `<dl>` > `__item` > `__key` + `__fill` + `__value` |
| `.ac-meter` | Stepped bargraph | `--lg` `--dim` `--alarm` | `__track` (set `--ac-meter-value`) > `__bar`; `__scale` |
| `.ac-dialog` | Modal | `--wide` | native `<dialog>`; `__title` `__body` `__actions` |
| `.ac-spinner` | Character spinner \| / — \\ | `--lg` `--dim` | `role="status"` |
| `.ac-hr` | 2px divider | `--bright` | `<hr>` |

### Effects

| Class | What it is |
| --- | --- |
| `.ac-blink` | Hard `steps(1)` on/off, 1.1s. Never a fade — `.ac-afterglow` softens the OFF edge only. |
| `.ac-cursor` | Trailing block cursor |
| `.ac-bloom` | PLASMA: amplified glow tokens, a soft bleed layer breathing on a 9s mains cycle, and the cell mesh — a crossed wire grid on a 3px pitch, so a lit pixel is a neon dot at a wire intersection rather than part of a solid stroke. Buzzes sub-pixel on two detuned cycles. Needs an `.ac-mesh` child. |
| `.ac-crt` | CRT: scanlines, vignette, one-cell drift per 11s, ±2% flicker. Needs a `.ac-retrace` child. |
| `.ac-afterglow` | PLASMA PERSISTENCE: things that disappear decay instead of switching off, rewritten text ghosts its old value, and the glass holds faint uneven patches. Needs an `.ac-persist` child. |
| `.ac-scanlines` | Static, motion-free line texture, for print and thumbnails |

Put any of `.ac-bloom`, `.ac-crt` and `.ac-afterglow` on the outermost frame, once per screen, never
nested. All three should be operator-toggleable in a real product — the demos show how, putting
`.ac-afterglow` on the CRT switch rather than a third one, since persistence belongs to the same
glass the scanlines are on.

**The demos default to PLASMA on and CRT off**, and the markup they ship matches that state rather
than the everything-on state above. Plasma is what the panel *is* — a matrix of gas gaps — so it is
on. CRT simulates a different display technology, and its horizontal blanking gaps are the one thing
a plasma panel conspicuously does not have; shipping both meant the first impression was a plasma
screen wearing a tube's scanlines. It stays one click away, and the choice persists to
`localStorage` under `ac.sim.plasma` / `ac.sim.crt`. Defaults live per-simulation in the `SIMS` map
in `amber-console.js`. Note that `.ac-afterglow` rides the CRT switch, so it is off by default too.

Anything off by default must be **absent from your static markup**, or it paints for one frame on
every load before the script removes it. The overlay children are mounted and removed with their
switch.

On a full-screen frame (`.ac-screen`) the bleed, scanline mask, vignette and retrace anchor to the
**viewport**, not the document. They are properties of the glass, and glass does not scroll — a
document-anchored vignette darkens the top and bottom of the page instead of the edges of the
screen, and a `backdrop-filter` stretched over a 15,000px document bands into visible tile seams.
Small tiles carrying `.ac-bloom` or `.ac-crt` are unaffected and stay local.

**The frame is the whole screen, menu bar included.** Put `.ac-nav` *inside* it. The overlays paint
from z-index 40 up, above `.ac-nav--sticky` at 20, so a sticky bar is part of the panel rather than
a flat strip floating over it. `.ac-screen` clips with `overflow: clip` rather than `hidden`
specifically so that works: `hidden` makes the frame a scroll container, and `position: sticky`
inside a scroll container that never scrolls does not stick.

### Plasma afterglow

A cell that stops being driven relaxes rather than switching off. Three parts, tunable:

| Token | Default | What it times |
| --- | --- | --- |
| `--ac-decay` | `105ms` | Elements that disappear, and explicit ghosts |
| `--ac-decay-fast` | `60ms` | Rewritten text, and de-energizing controls — where a full tail would smear |
| `--ac-decay-ease` | `cubic-bezier(0.1, 0.72, 0.22, 1)` | The relaxation curve: fast knee, long tail |

It also covers the two light-off events you actually hit most:

- **De-energizing** — a lamp going out. A pressed button releasing, a tab deselecting, an interlock
  unchecking, the pointer leaving a control. These never hide, so decay-out never sees them.
- **The blink OFF edge** — `.ac-blink`, `.ac-cursor`, an invalid `.ac-input`, an over-range
  `.ac-meter--alarm` bar. One rule swaps `animation-name`, so each keeps its own cycle length.
- **Scroll smear** — scrolling hands every cell a new value at once, so the image trails. Scaled by
  real scroll speed, drained when you stop, and skipped entirely under `prefers-reduced-motion`.

In every case the ON edge stays instant: a cell lights on the next refresh, and it is only the
switching off that hardware cannot do sharply. Nothing here fades *in*.

Everything except ghosting is pure CSS. Ghosting needs the value a readout held one frame
ago, which only JS has, so `amber-console.js` watches the frame for text changes and parks a copy at
the rect it occupied. A node that is *removed* has no rect left to pin a ghost to, so ghost it first:

```js
AmberConsole.afterglow(row);   // no-op when the simulation is off
row.remove();
```

This is the one place the framework uses a `transition`. It is hardware, not UI: nothing fades *in*,
and components stay instant redraws — `scripts/check-prohibitions.mjs` still enforces that.

## Driving state

State hooks are ARIA attributes first, with class aliases as equivalents. A framework that binds
`:aria-selected` needs no class juggling:

```html
<button class="ac-btn" aria-pressed="true">Run</button>     <!-- same as .ac-btn--filled -->
<button class="ac-tab" aria-selected="true">Functions</button>
<a class="ac-nav__link" aria-current="page">Console</a>
<input class="ac-input" aria-invalid="true">
```

`:checked` and `:disabled` do the rest. React, Vue, Svelte, Astro, HTMX, Rails, Django, PHP or a
plain `.html` file all drive this identically.

## The optional JavaScript

`amber-console.js` has no dependencies and is **strictly optional** — every component looks and
reads correctly without it. It covers only what CSS genuinely cannot do:

1. the `role="tablist"` keyboard model (←/→/Home/End, roving tabindex)
2. flipping an `aria-pressed` toggle — the `.ac-toggle--input` variant needs no JS at all
3. the PLASMA and CRT simulations, persisted to `localStorage` — CRT carries the afterglow — and
   the afterglow ghosts
4. opening and closing a `<dialog>`
5. the [display presets](#three-axes-and-they-are-not-the-same-axis), likewise persisted — the
   palettes themselves are pure CSS and switch on `data-ac-tech` + `data-ac-emitter`, which you can
   write into your own markup
6. the style flags, same deal on `data-ac-style-*`

```html
<script src="dist/amber-console.global.js"></script>   <!-- classic; works from file:// -->
<script type="module">import "./dist/amber-console.js";</script>   <!-- ES module -->
```

Auto-initializes from `[data-ac]`. Call `AmberConsole.init(scope)` again after rendering new markup,
and `AmberConsole.afterglow(el)` to ghost an element you are about to remove.

## Display: technology, then emitter

A palette here is not a theme and not a light/dark pair — it is a specific piece of hardware, and it
takes **two attributes** on the root element to name one, because the same color word means
different physics on different glass:

```html
<html data-ac-tech="plasma" data-ac-emitter="neon">   <!-- default; omit and you get this -->
<html data-ac-tech="crt"    data-ac-emitter="p3">
```

`data-ac-tech` is the **technology** — what is making light at all. `data-ac-emitter` is **which gas,
or which phosphor**, inside it. An emitter is only meaningful within its technology: `neon` is a gas
and exists only under plasma, `p3` is a phosphor and exists only under CRT. Every palette block is
selected by *both*, so a mismatched pair selects nothing rather than quietly rendering the wrong
hardware.

| tech | emitter | hue | what it is |
| --- | --- | --- | --- |
| **`plasma`** *(default)* | **`neon`** | 24° | A monochrome AC plasma panel. The light is neon emitting directly from the gas — no phosphor anywhere in the stack. This is what the six laws describe and what `.ac-bloom` simulates. |
| **`crt`** | **`p3`** | 38° | The classic amber CRT phosphor: a broad ~590 nm band with real green content. A *different* display technology — a beam exciting a phosphor, which emits and then persists — but it is what most people mean by "amber terminal", it is the ramp the source design system was drawn against, and it pairs with `.ac-crt`. |

> **Deprecated:** `data-ac-gas="neon"` and `data-ac-gas="amber"` still work and will be removed in
> 3.0. The name was the bug — `amber` was never a gas, it is a CRT phosphor, and calling it one is
> exactly the confusion the pair above exists to prevent. `data-ac-gas-toggle` likewise still works
> but can only ever reach those two palettes; migrate to `[data-ac-display]` radios.

The neon hue is derived rather than picked. Weighting the Ne I visible lines by the CIE 1931
observer puts the discharge at x=0.631 y=0.369 — just outside sRGB, gamut-mapping to 19°. That is a
*DC* neon tube; this panel's sustain is a short high-field pulse, which enriches the 585.2 nm line
against the 640 nm red group and walks the hue up. 19–31° is the defensible band; 24° is its middle.

Every stop is solved to a **contrast ratio**, never re-tinted — rotating hue at constant lightness
drops `--amber-50` to 2.79:1 and silently fails the 3:1 non-text gate. `npm run contrast` runs the
[full pair table](#accessibility) against **every** palette independently; a ratio that passes under
one and fails under another is a build failure.

Adding an emitter — or a whole technology — means adding one block to `src/tokens/colors.css` and
nothing else: the five discharge stops, three surfaces, `--on-fill`, and the four `--gas-N` glow
triples. Everything else in the system is an alias or is built from those.

### Three axes, and they are not the same axis

The demo pages carry a **setup board** (`.ac-setup`) that separates the three things it is easy to
conflate. It never opens, closes or scrolls — every switch the panel has is on the glass at once,
which is affordable only because the emitter catalog is split by technology across two of the four
quarters rather than stacked into one tall list:

| axis | question it answers | where it lives | how many |
| --- | --- | --- | --- |
| **Display** | which hardware is in the panel | `data-ac-tech` + `data-ac-emitter` on the root | exactly one |
| **Simulation** | what the glass does about it — bloom, scanlines, persistence | classes on the frame, via `data-ac-sim` | any combination |
| **Style** | everything that is *not* the hardware — comfort, typography | `data-ac-style-*` on the root | any combination |

Display sets color and simulation never does. A **preset** is a display row that also names the
simulations its technology implies:

```html
<input type="radio" name="ac-display" data-ac-display
       data-ac-tech="crt" data-ac-emitter="p3" data-ac-sims="crt">
```

Selecting it switches the palette to the P3 phosphor, mounts `.ac-crt`, and switches every *other*
known simulation off — one click, and the `.ac-toggle` for each moves to prove it. `data-ac-sims` is
a space-separated list; simulations this build does not have are ignored rather than throwing.

A preset is a starting point, not a lock. Flip a simulation or a style afterwards and the readout
says `*MOD`; nothing is prevented. `[data-ac-display-reset]` puts the preset's simulations back, and
`[data-ac-display-out="label|tech|emitter|mode"]` gives you somewhere to show the state.

`[data-ac-display-info]` shows one node and hides the rest, so the board can carry a note describing
whatever is currently in the panel. A key is a technology (`crt`) or an exact palette (`crt/p3`);
exact wins where one exists, so a phosphor that does not behave like the rest of its family can say
so without every other phosphor needing its own paragraph. The prose is markup, like the catalog.

**The catalog is markup, not a table inside the JavaScript** — write your own `[data-ac-display]`
rows for your own palettes and the module needs no edit. All of it is optional: the palettes are pure
CSS, so you can set `data-ac-tech` and `data-ac-emitter` in your own markup and never load the
module.

## Tokens

Override any of these; see [what you may safely change](#theming).

```
                       neon (default)        amber
--screen               #100600               #0d0700
--screen-raised        #1b0c02               #170e02
--screen-well          #060200               #060200

--amber-100            #ffa86d               #ffd052   hot highlight, focus
--amber-90             #ff6b08               #ffae1e   primary discharge
--amber-70             #dd5800               #cd8817   secondary
--amber-50             #ab4500               #8d5b10   dim, disabled
--amber-30             #5b2500               #4a2f08   trace, ghost
--on-fill              #1e0c00               #1a0e00

--gas-1 … --gas-4      bare "r, g, b" triples the glow is built from

--ink --ink-bright --ink-dim --ink-faint --ink-trace
--fill --fill-bright
--stroke --stroke-dim

--font-terminal "VT323", "Courier New", ui-monospace, monospace
--font-micro    "Silkscreen", "VT323", ui-monospace, monospace
--type-display 44px  --type-title 30px  --type-body 22px  --type-small 18px  --type-micro 8px
--tracking-display .1em  --tracking-body .04em  --tracking-micro .08em  --leading 1.15

--space-1 4px … --space-12 48px      --border-w 2px
--radius 8px   --radius-sm 4px       (0–2px on strips and badges)

--glow-text  --glow-box

--ac-mesh-pitch 3px   --ac-mesh-wire 0.075   (the cell matrix; see the note below)
```

`--ac-mesh-wire` is a **budget, not a taste setting.** Two crossed 1px wires lose a mean
`1 - (1 - a/3)²` of everything under them, and `0.075` is the value that lands that at `0.050` —
exactly the mean loss of the CRT scanlines it sits beside. `scripts/contrast.mjs` computes from
`colors.css` and cannot see an overlay, so nothing will fail if you raise it. Redo the arithmetic
first.

The `--amber-*` prefix names **the ramp, not the hue** — it is historical, and under
`data-ac-tech="plasma"` those tokens are not amber. Renaming is a public API break and has not been
made; treat the numbers as intensity stops.

Component-level hooks: `--gap`, `--cols`, `--ac-screen-pad`, `--ac-panel-title-bg`,
`--ac-meter-value`, `--ac-backdrop`.

**`--ink-faint` and `--ink-dim` never glow.** Glow is the signal of energization; a disabled control
that glows is a lie about the hardware.

## The six laws

1. **One gas, many intensities.** There is no phosphor in a monochrome plasma panel — the amber is
   neon emitting directly from the gas. Hierarchy is brightness, inverse video and blink — never hue.
   There is no red, no green, no "success" color.
2. **Inverse video is importance.** A solid amber block with dark text is the machine speaking.
   Ration it: two or three per screen.
3. **Everything is a box.** 2px rules draw the regions. No elevation, no shadows-as-depth.
4. **The character grid rules.** Labels are `KEY:VALUE`, leading is 1.15, space is 4px half-cells.
5. **Casing is semantic.** System text is ALL CAPS; operator soft keys are Title Case. That split
   carries information.
6. **Ornament is typographic.** Emphasis is repeated glyphs: `✳✳ REMOTE MODE ✳✳`. Never an SVG icon
   set, emoji, illustration, or imagery of any kind. The icon system is
   `✳ █ ▮ ▯ ▲ ▼ ◄ ►` and box-drawing characters, typeset in the terminal font.

There is no logo and no icon set, and this is intentional — the genre predates GUI icon systems.
Render product names in plain letter-spaced type.

`npm run check` enforces the mechanical parts of this: no second hue, no `<svg>`, no emoji, no
`border-radius` above 8px, no `transition` in components, no third font.

## Fonts

Two bitmap faces, both SIL Open Font License 1.1, vendored in `fonts/`:

- **VT323** — everything at 18px and up (`--font-terminal`)
- **Silkscreen** — 8–10px micro labels only (`--font-micro`)

**Regular weight only.** There is no bold in this system — hierarchy is size, intensity and inverse
video, never weight — so no bold face is fetched or shipped. Five `@font-face` rules, 54kb of woff2
total, and a `<strong>` inside a component gets the same synthetic bold it would get from VT323,
which has no 700 either.

**VT323 must never render below 18px.** It is a bitmap face and turns to mud. There is no 12px or
14px in this system; below 18px, use Silkscreen at 8–10px.

These are **era-correct substitutes, not the original face.** The source hardware used a mask-ROM
bitmap font with no digital release; VT323 is a digitization of the DEC VT320 terminal ROM. If you
have a licensed face closer to the hardware, it is a one-line swap — replace `--font-terminal` and
nothing else.

Prefer not to vendor the binaries? Swap `tokens/fonts.css` for `tokens/fonts-cdn.css` in
`src/amber-console.css` and rebuild. Note the trade-off: offline and `file://` pages then fall back
to Courier New, which loses the bitmap grid the whole effect depends on.

The ornament glyphs (`✳ █ ▼` …) fall outside the subsetted webfonts' `unicode-range` and render from
the system font. This matches the upstream Google Fonts behavior and is what the design was drawn
against.

## Accessibility

Ratios below are **computed** from the tokens by `npm run contrast`, not estimated — and the
gate runs against **every palette**, so none of them ships untested.

#### `data-ac-tech="plasma" data-ac-emitter="neon"`

| Foreground | Background | Ratio | Needs | Verdict | Use |
| --- | --- | --- | --- | --- | --- |
| `--ink` | `--screen` | 7.02:1 | 4.5:1 | **AA** | Body text on the panel |
| `--ink-bright` | `--screen` | 10.57:1 | 4.5:1 | **AA** | Live values, hover, input text |
| `--ink-dim` | `--screen` | 5.22:1 | 4.5:1 | **AA** | Field labels, legends, secondary text |
| `--ink-faint` | `--screen` | 3.42:1 | 4.5:1 | fails — exempt | Disabled text — decorative only |
| `--ink-trace` | `--screen` | 1.63:1 | 4.5:1 | fails — exempt | Row separators, leader dots — non-text |
| `--on-fill` | `--fill` | 6.64:1 | 4.5:1 | **AA** | Inverse video: dark text on amber |
| `--on-fill` | `--fill-bright` | 10.00:1 | 4.5:1 | **AA** | Inverse video, hover state |
| `--ink-bright` | `--screen-well` | 10.89:1 | 4.5:1 | **AA** | Input text in a recessed well |
| `--ink-faint` | `--screen-well` | 3.52:1 | 4.5:1 | fails — exempt | Placeholder text |
| `--ink` | `--screen-raised` | 6.69:1 | 4.5:1 | **AA** | Body text on a zebra table row |
| `--stroke` | `--screen` | 7.02:1 | 3:1 | **AA (non-text)** | 2px borders — non-text, needs 3:1 |
| `--stroke-dim` | `--screen` | 3.42:1 | 3:1 | **AA (non-text)** | Dim borders — non-text, needs 3:1 |

#### `data-ac-tech="crt" data-ac-emitter="p3"`

| Foreground | Background | Ratio | Needs | Verdict | Use |
| --- | --- | --- | --- | --- | --- |
| `--ink` | `--screen` | 10.81:1 | 4.5:1 | **AA** | Body text on the panel |
| `--ink-bright` | `--screen` | 13.74:1 | 4.5:1 | **AA** | Live values, hover, input text |
| `--ink-dim` | `--screen` | 6.81:1 | 4.5:1 | **AA** | Field labels, legends, secondary text |
| `--ink-faint` | `--screen` | 3.47:1 | 4.5:1 | fails — exempt | Disabled text — decorative only |
| `--ink-trace` | `--screen` | 1.62:1 | 4.5:1 | fails — exempt | Row separators, leader dots — non-text |
| `--on-fill` | `--fill` | 10.23:1 | 4.5:1 | **AA** | Inverse video: dark text on amber |
| `--on-fill` | `--fill-bright` | 13.01:1 | 4.5:1 | **AA** | Inverse video, hover state |
| `--ink-bright` | `--screen-well` | 14.16:1 | 4.5:1 | **AA** | Input text in a recessed well |
| `--ink-faint` | `--screen-well` | 3.58:1 | 4.5:1 | fails — exempt | Placeholder text |
| `--ink` | `--screen-raised` | 10.29:1 | 4.5:1 | **AA** | Body text on a zebra table row |
| `--stroke` | `--screen` | 10.81:1 | 3:1 | **AA (non-text)** | 2px borders — non-text, needs 3:1 |
| `--stroke-dim` | `--screen` | 3.47:1 | 3:1 | **AA (non-text)** | Dim borders — non-text, needs 3:1 |

Every required pair passes. **`--ink-faint` is documented as disabled and decorative only — never
body text.** The palette was not lightened to hide this.

- **Focus:** a `2px dashed var(--ink-dim)` ring on every interactive class, visible on both `--screen`
  and inverse-video backgrounds.
- **Motion:** full `prefers-reduced-motion` support, including the blink. An alarm that only blinked
  would vanish under it — which is why blink is always paired with inverse video and ✳✳ glyphs. The
  one thing that keeps rendering is the cell mesh: its shimmer stops, but the grid itself is the
  shape of the hardware rather than an effect playing over it, so hiding it would change what the
  panel *is* in response to a motion preference.
- **Forced colors:** `forced-colors: active` drops every effect and restates borders in `CanvasText`
  and inverse video in `Highlight`/`HighlightText`, so "the machine is speaking" still reads.
- **Print:** black on white, 2px rules kept, all effects off. A console screenshot prints legibly.
- **Reflow:** survives 200% zoom and a 360px viewport with no horizontal scroll.

### Known constraints

- **`.ac-btn--sm` computes to roughly 30px tall, below the 44px hit-target floor.** The value is
  fixed by the source design system, so it is documented rather than changed. Reserve `--sm` for
  dense, mouse-driven tooling; never use it for a primary control on a touch panel.
- Checkbox, radio and toggle keep their drawn sizes (20px squares, a 64×28 track) but their **labels**
  carry `min-height: 44px` so the clickable area clears the floor. Bit-field rows are therefore taller
  than in the original design.
- `.ac-banner` steps down from 44px to 30px type below 480px. At display size a two-word banner has a
  min-content width near 400px and would otherwise be clipped on a phone.

## Theming

**You may override:** the five amber intensities (to retune the gas), the three surface blacks,
spacing, the two radii, glow strength, and any component-level custom property.

**You must not override:** the hue (one gas — a second hue breaks law 1), the type sizes (the
18px floor is a property of the bitmap face, not a preference), or the 2px stroke.

Embedding in an existing app? Use `dist/amber-console.layer.css` and swap `base/reset.css` for
`base/reset-scoped.css`, then wrap your markup in `.ac-root` so the framework never repaints the
host page's `body`.

## Not for you if…

This is a **genre** framework, not a neutral one. It will fight any product that wants a modern,
brand-flexible UI. If you need more than one hue, an icon set, a light mode, subtle transitions,
small type, or a design your marketing team can re-skin — use something else. Amber Console is for
dashboards, status boards, terminal tools, control surfaces, game UIs, and anything that should look
like it runs machinery.

## Browser support

Current Chromium, Firefox and Safari. Everything load-bearing is plain CSS — no nesting syntax, no
`@container`, and `:has()` only as a progressive-enhancement alias for an explicit class.

`backdrop-filter` (the plasma bleed layer) degrades gracefully: where it is unsupported the bloom
simply does less rather than breaking, because the amplified glow tokens do most of the work.

## Development

No install is needed for the main workflow — the build is pure Node.

```bash
npm test           # check + contrast + build — the whole zero-dependency gate
npm run build      # -> dist/, zero dependencies
npm run dev        # build + watch + serve docs/ at :4173 (--port to move it)
npm run check      # the prohibitions gate
npm run contrast   # recompute the contrast table (--md for the README format)
```

Two gates need the optional dev dependencies (`npm i`):

```bash
npm run lint         # stylelint: ac- BEM pattern, no transitions in components
npm run test:visual  # playwright: 14 captures across widths, a11y modes and print
```

`npm run fonts` re-downloads the webfonts and regenerates `src/tokens/fonts.css`.

`npm run assets` re-renders the favicon, the touch icon and the social card. They are not drawn —
they are the letter A and the console demo rendered through `dist/amber-console.css` itself, so
retuning the gas retunes the icon. The favicon is a PNG rather than the usual inline SVG on purpose:
`npm run check` bans `<svg>` in HTML, and law 6 does not make an exception for browser chrome.

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Provenance

**The design system is the project; the console is only its demo.** Amber Console is a set of tokens
and component classes for the industrial-control-panel genre. ORION-70 — the fictional projector
console in `docs/index.html` — exists to exercise every class in one screen, and nothing in the
framework depends on it.

The genre was studied from period projection-booth hardware, and the debt is
[acknowledged below](#acknowledgements). ORION-70 itself is invented: its name, its wordmark and its
copy are ours, and no manufacturer's branding, wordmark or logo appears anywhere in this repository
or in the published package. Where the demo echoes the layout conventions of real equipment, that is
the genre being reproduced rather than any one product — the same way a terminal emulator is not the
VT320.

The values in `src/tokens/` came from an internal design bundle that is not published with this
repository. The deviations from it, and the discrepancies resolved along the way, are recorded in
[CHANGELOG.md](CHANGELOG.md).

## License

BSD 3-Clause License — see [LICENSE](LICENSE). The bundled webfonts are SIL OFL 1.1; see `fonts/OFL-*.txt`.

### TL;DR
- Free to use, modify, and share this code freely in any way you want in private or commercial projects, as long as you keep my copyright notice and the license text.
- Don’t use my name to promote your project.
- The software comes with no guarantees, so use it at your own risk.
- If this has been proven useful or if this helped you make a bunch of money, feel free to <a href="https://buymeacoffee.com/dutchdiederik" target="_blank" rel="noopener noreferrer">buy me a coffee</a>. 

## Acknowledgements

Inspired by the 1970s user interface of an IMAX projector. Thanks to
<a href="https://x.com/RealJessePalmer" target="_blank" rel="noopener noreferrer">@RealJessePalmer</a> and
<a href="https://x.com/uncledoomer" target="_blank" rel="noopener noreferrer">@uncledoomer</a> for talking about it
on X — that sparked this idea.

# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed — the halo tokens are `--halo-*`; `--gas-*` is deprecated

- **`--gas-1…4`, `--gas-scatter`, `--gas-spread` and `--gas-flash` are now `--halo-*`.** The old name
  asserted a hardware that most palettes are not: seven of the eleven are phosphors on a tube, and
  there is no gas anywhere in them. This is the same bug as `--amber-*` naming a hue, and the same bug
  as the deprecated `data-ac-gas` attribute, one level down — the halo is the light scattered in the
  glass whatever produced it, so it is named for what it is rather than for what makes it on four of
  the eleven screens.
- **`--gas-*` survives as a read alias, removed in 3.0.** `--gas-1` resolves to `--halo-1` under
  whichever palette is active, so code that *reads* the old name off the computed style keeps getting
  an answer. Code that *overrides* it must migrate: the framework reads `--halo-*`, so setting
  `--gas-*` has no effect. (The same has always been true of `--amber-*`; the note in
  `tokens/colors.css` claimed otherwise and has been corrected.)
- **`--gas-flash` is deliberately not aliased.** Only P7 ever declared it, and an alias would be an
  invalid declaration on the other ten palettes.
- Renderer output is unchanged — this is a rename plus aliases, verified against 548 computed-style
  probes and the full visual-regression suite.

### Changed — one owner per law, and the two gate sets now match

- **The ban on `transition` lives only in `scripts/check-prohibitions.mjs` now.** `stylelint.config.mjs`
  carried a second, overlapping copy with its own exemption list in an `overrides` block; two gates for
  one law meant two lists to keep in agreement. The surviving gate is the stricter of the two: it
  covers all of `src/` rather than only `src/components/`, and it catches the longhands.
- **`npm test` runs `npm run lint`, and CI runs the palette-derivation check.** The two sets had
  drifted — CI linted but never re-derived the palettes, and `npm test` re-derived them but never
  linted, so a hand-edited palette could reach `main`. Both now run lint, prohibitions, derivations,
  contrast and build.

### Fixed — blink, the afterimage and the scroll smear are switched by tokens, not by selector lists

- **A blinking element no longer has to be named in five places.** Every blink site reads
  `--ac-blink-name` / `--ac-blink-ease`, and every environment that changes blink — the style flag,
  `prefers-reduced-motion`, print, forced colors — sets that pair once instead of restating which
  elements blink. `--ac-blink-force` is the root-only override that outranks the CRT simulation's own
  curve, which is what the doubled `[data-ac-style-blink="off"] .ac-afterglow …` selectors used to do
  by specificity. Adding a blink site is now one declaration pair on the site itself.
- **An `aria-invalid` input outside `.ac-field--invalid` kept its animation in print.** `print.css`
  listed the class form of the selector and not the attribute form — exactly the drift that mirrored
  lists cause. The token reaches every site uniformly.
- **The afterimage and scroll-smear lists collapse the same way**, onto `--ac-afterimage-display` and
  `--ac-smear-filter`. The smear switches its whole `filter` value rather than a scale inside it, so
  suppressing it yields a literal `none` — a `blur(0px)` is still a filter, and a filter creates a
  containing block for fixed descendants.

### Fixed — the PPI wake was on the wrong side of the beam, and the beam had no line

- **`.ac-sweep__beam` painted its falloff in FRONT of the sweep.** A `conic-gradient` runs clockwise
  and so does `rotate()`, so putting the flash at `0deg` lit `[A, A+arc]` — the bearings the beam is
  travelling toward, not the ones it has just written. The stops now count down from `360deg` and the
  rotation is untouched, because bearings on a PPI increase clockwise and the bearing scale, the EBL,
  the guard sector and every contact arm are built on that. The contacts were the tell all along: each
  one delays its strike to fire when the rotation equals its own bearing and then drains where the beam
  has already been, so the wedge and the plot had been running in opposite directions.
- **The wake is the palette's own decay law now, not a hand-picked ramp.** Alphas are read off the
  Becquerel curve `--ac-decay-ease` is sampled from, at `t₀ = 0.032 × --ac-persist-tail`, through a
  perceptual compression. The knee is sampled finely and the tail coarsely: a gradient interpolates
  straight, the curve is convex, and sparse stops filled the first forty degrees in as a flat slab with
  an edge on it.
- **The beam has a writing line.** A few degrees of gradient is a *wedge* — 1.8px at the rim of a 260px
  face and under half a pixel at quarter range, so it thinned out and aliased away exactly where the
  picture is densest. It is now a constant-width arm on the beam's leading edge, drawn the way every
  mark on a radar face is drawn, and it inherits its bearing from the rotation for free.
- **The origin saturates.** Every one of the 360 bearings crosses the center, so it takes the whole
  revolution's dose — the bright spot in the middle of every scope photograph ever taken. It is the one
  place on the face a radial falloff is earned, and it goes out with the beam on standby.
- **New public custom properties:** `--ac-sweep-arc` (how much of the face the wake covers, default
  `250deg`, which is what `--ac-persist-tail ÷ --ac-sweep-period × 360` evaluates to for every phosphor
  above the period floor, plus a taper) and `--ac-sweep-line` (the writing line's width, default `3px`).
  Both are fallbacks rather than declarations, so a page can reach them.

### Removed — the Scroll Smear switch, and the JS Effects switch now knows when it is idle

- **`data-ac-style-smear` is gone.** It was a STYLE flag that could only ever be on under CRT — every
  selector implementing it is scoped to `.ac-afterglow`, and a plasma cell is driven continuously and
  has nothing that trails — so it derived its default from the simulation and disabled itself under
  plasma. That is a switch which spends most of its life explaining why it cannot do anything, and a
  third axis of persisted state for a preference nobody was expressing. The smear is now simply part
  of what `amber-console.effects.js` does: on wherever the persistence simulation is running and the
  engine flag permits it, off everywhere else. `prefers-reduced-motion` still stops it, which was the
  only accessibility case the flag was carrying.
- **The JS Effects switch is forced OFF as well as unclickable wherever it would be a no-op.** Showing
  ON while nothing it governs is running is a small lie, and it is the same one the smear switch used
  to tell. The control now reflects what is *contributing* rather than what the flag permits, and the
  State readout agrees with it — `CSS ONLY`, not `CSS + JS`, beside a switch that reads OFF.
- **The flag itself is not written when that happens**, which is the important half. Forcing
  `data-ac-engine="css"` would clobber a preference the user did express, and picking P39 again would
  leave the effects off with nothing to explain why. The attribute stays as it was and the switch comes
  back by itself — same rule as the derived style defaults: a derived value fills a silence, it does
  not overwrite an answer. Verified by turning it off on P39, passing through neon, and returning to
  find it still off.
- **The module stops doing the work too, not just reporting it.** All three effects are timed by
  `--ac-persist`, so under P11 the observer was still cloning a ghost, measuring it, appending it,
  giving it a 0.035 ms animation and removing it inside the same frame — per text update, plus the
  forced layouts of the geometry probe. One `effectsActive()` now gates the observer, the smear loop
  and `transition()` on all three conditions, and the root watcher gained `data-ac-tech` and
  `data-ac-emitter` because P39 → P11 changes the tail without touching the simulation.
- **The JS Effects switch disables itself wherever it would be a no-op**, on two conditions that fail
  for different reasons. All three effects are scoped to `.ac-afterglow`, so under any plasma
  simulation the switch is wired to nothing at all — a *mechanical* no-op. And all three are timed by
  `--ac-persist`, so a phosphor whose tail is measured in microseconds gives them no time to be seen —
  a *perceptual* one. It is live under **P7, P39, P3 and P1**, and dead under **P4, P11 and P31**
  (0.06, 0.035 and 0.038 ms) and every plasma gas.
- **The gate reads the frame, not the preset**, which matters for a state the system explicitly
  allows: a plasma gas with the CRT simulation switched on by hand has a real afterglow layer, and the
  switch correctly goes live there. Gating on the emitter would have got that backwards.
- `ENGINE_FLOOR_MS` is 5 — a third of a frame at 60Hz, so anything under it cannot survive to be
  composited even once. Nothing in the catalog is near the boundary: the phosphors that clear it do so
  by 24ms or more and the ones that fail do so by three orders of magnitude, which is what makes a
  single threshold safe rather than a fudge.
- The `needs` mechanism in `STYLES` now has no shipped user, since `smear` was its only one. It stays,
  documented as the framework's answer for a consumer flag that depends on a simulation.

### Changed — the buttons are classic now: cut corners, an extruded edge, label top-left

Built from photographs of a real panel. The boxes have coarse cut corners rather than smooth arcs, the
corners are *not all the same size*, the keys stand on a hard offset edge, and the label sits in the
top-left with the body left empty. None of it was in the framework: the system drew exactly one corner,
an 8px arc, centered its labels, and had no bevel, gradient or 3D shading anywhere on purpose.

**This is now the default look, because it is what the hardware was.** The smooth corner is not
deprecated and not a mistake — it is the thing you now opt into, at either scope:
`data-ac-style-classic="off"` on the root, or `.ac-rounded` on a region. `.ac-classic` states the
default explicitly for a region inside a rounded one. All of it is `src/components/classic.css`.

- **The four corners are not cut the same, and that is the whole 3D reading rather than a
  decoration.** These keys were drawn as solid objects lit from the top left, so the far corner is
  barely cut and the near one is cut hardest — `2 / 4 / 8 / 4` px in TL TR BR BL order, using the
  system's own radius steps rather than new numbers, with `--radius-sm` running the same diagonal at
  half depth for wells and switch housings. The first version of this cut all four alike and the keys
  read as octagons; the gradient runs along the same diagonal the extrusion is offset on, because they
  are two halves of one claim about where the light is.
- **The extrusion is an edge, not a ghost, and two layers are what make it one.** An outer
  `box-shadow` is clipped to outside the border box, so a hard offset copy of the box paints a solid
  band down the bottom and right rather than a floating duplicate — which is exactly what the
  photographs show, a single stroke on the top and left against a heavy band on the bottom and right.
  Two offsets give that band depth: a bright 2px lip against the stroke, then 3px more at lower drive
  falling away from it. One uniform layer looked like a thick border and a blurred one looked like a
  modern card shadow, which is the whole thing this is not. The alphas are set against `.ac-bloom`
  rather than the bare screen — the band lands in the region `--glow-box` is already lighting, and
  under the amplified halo anything below about 0.6 on the lip washed out into it.
- **The label parks top-left**, which is the second half of what a classic key looks like and a
  separate rule from the corner because it is about the face rather than the outline. A soft key is a
  label plus room for a value; centering it says the key is a word rather than a field. This is
  `.ac-btn--pad`'s alignment without its 96px min-height, so it applies at whatever size a key is and
  composes with `--pad` unchanged. It deliberately sets no `display` — `inline-flex` would have
  outweighed `.ac-btn--block`'s `block`, and a corner style that silently unblocks a full-width key is
  worse than one that does nothing. **Keypad digits are exempt**, and `keypad.css` had already written
  down why: one character has no label/value split for the top-left rule to serve.
- **A pressed key is in, and the light is what moves.** `:active`, `--filled` and `aria-pressed="true"`
  flip the band to the top and left, because the near face of a sunken key is the upper one — which is
  how a bevel has always shown a press. All three, because this framework already documents `--filled`
  and `aria-pressed` as one state.
- **The press was a transform first, and that was a bug the suite caught.** `translate: 4px 4px` reads
  correctly and reflows nothing, but a transform *does* contribute to scrollable overflow — so every
  latched key sitting flush against its container pushed 4px past it, on two pages at every width: an
  `.ac-grow` pad in a row, and the `Ent` key in the keypad grid. A box-shadow is ink overflow and
  contributes nothing in either direction, so the key now stays exactly where it was laid out. Both the
  token and the rule carry a note, because `translate` is the obvious thing to reach for again.
- **The corner reaches every bordered surface; the extrusion and the label reach only the controls.**
  A beveled key inside a rounded panel reads as a screen assembled from two display generations, so
  buttons, tabs, panels, dialogs, inputs, nav links, toggle tracks and meter tracks are re-cut
  together. A drop shadow is a different claim — that the thing stands off the glass — and that is true
  of a soft key and a switch housing and of nothing else on the board. Giving `.ac-panel` an edge too
  was tried and reads as a floating card, a different design language from a control surface.
- **Most of the reach is free, because the tokens were already the API.** Every bordered surface
  resolves its corner from `--radius` or `--radius-sm`. `corner-shape` does not inherit, which is the
  only reason the eight-selector list in that file is written out by hand — and it was derived by grep,
  not chosen, which is stated at the list so the next component to take a `--radius` gets added to it.
- **Two corner paths, and the fallback is not a degradation.** Where `corner-shape` is supported the
  radius is spent on the cut. Where it is not, it quantizes to a hard 2px instead — the same statement
  about a corner the grid can hold, made in a property every engine has had for fifteen years. The
  extrusion and the label are identical on both paths, so what Firefox loses is the chamfer and
  nothing else. A default look that silently collapsed into the other option in Firefox would not have
  been a look.
- **`clip-path` and `mask-image` were rejected, and they were the obvious answer.** Either could cut a
  genuine stair-step. Both clip the element's *entire* painting, and the outer `box-shadow` is part of
  it — so a stepped corner would have been bought by deleting `--glow-box` off all four sides, which is
  law 1 traded away for a corner. `border-radius` and `corner-shape` reshape the shadow instead of
  removing it. That constraint, not taste, is why this is written in them.
- **`--edge-3d` is the one shadow in `effects.css` that is not a halo**, so it takes neither
  `--gas-spread` nor `--gas-scatter`: those describe light scattering through glass, and this is
  geometry. A panel that drew a drop shadow drew it in *cells*, and a cell is the same size on krypton
  as on neon — the extrusion holds still when the gas changes while its color follows `--gas-1`, so it
  cannot end up the only amber thing on a green screen. Print blanks it through the token, since a
  shadow is paid for in ink and a cut corner is not.
- **The scopes set nothing but custom properties, and that is what makes `.ac-rounded` four lines.**
  The first cut of this file spelled every rule out once per scope; making the default classic meant an
  opt-out was suddenly mandatory, and mirroring the whole rule set for it would have been a block to
  hand-sync forever. Custom properties inherit, so each rule is now written once, prefixed by all
  three scopes, reading its values out of the cascade. Nesting resolves by inheritance from the
  nearest scope rather than by a specificity coin toss, and a fourth scope would be a token block and
  nothing else.
- **The `:disabled` reset is still restated, and that is a cascade trap worth naming.** `button.css`
  already blanks the halo on a dead key, but `[data-ac-style-classic="on"] .ac-btn` weighs the same as
  `.ac-btn:disabled` and lands later, so the extrusion rule would have quietly handed the glow back.
  `check-prohibitions.mjs` cannot catch this one: it gates an ink level set without its halo, and the
  rule in question sets no color.
- **The STYLE axis's definition widened, deliberately.** It said "everything that is not the
  hardware", and a corner quantized by the raster is arguably a hardware artifact. It now says a style
  is a *look the viewer chose* — including a look that imitates a coarser raster — and the boundary it
  is really defending is stated instead: a bevel makes no claim about which gas is in the gap, which is
  what DISPLAY and SIMULATION are for. "Cut the corners" and "make it krypton" must never read as the
  same kind of switch.
- The *Classic Buttons* switch is on all five demo boards under *Style & engine*, shipping in its ON
  position so it does not repaint a frame on load. The guide gains a **paired** specimen — both corners
  at once, one row each, regardless of where the board is standing. A page-wide switch is the right
  control for a viewer and the wrong one for documentation; you cannot compare two corners by looking
  at one of them, and that specimen is what forced `.ac-rounded` to exist on the day it did.
- The visual suite gains one guide-only `1440-rounded` case, pointed at the non-default path since the
  seven existing cases now gate classic on all five pages. Guide-only on the economics `capture.mjs`
  already argues for itself; `styles`, `only` and a per-case `anchor` were added to support it.

### Fixed — a bargraph that falls now leaves something behind

Reported: on the server dashboard a load bar "disappears instantly and doesn't leave a ghost that
dims", and it reads worst on the long phosphors where everything around it is trailing.

**It was a whole phenomenon the persistence system did not model.** Every decay in the file covers a
node disappearing, text being rewritten, or a lamp changing color. A meter does none of those: the
element stays, its text is elsewhere, its color never moves — what changes is its **width**, so the
strip it vacates was lit a moment ago and is now simply not drawn. `.ac-meter__bar` appeared in
`effects.css` only in blink rules, and the ghost observer watched `childList` and `characterData`
while the bar is driven by `style.setProperty`, an *attribute* mutation. Nothing could see it.

- **CSS: a second bar that lags.** `.ac-meter__track::before` reads the same `--ac-meter-value` and
  transitions its width on `--ac-persist-tail`. The direction rule needs no rule of its own — on a
  fall the ghost is briefly *wider* than the live bar and the strip between them drains; on a rise it
  is *narrower*, so it sits underneath and nothing fades in. Instant up, curve down, out of paint
  order. A trailing mask keeps it reading as light rather than as a wipe.
- `.ac-meter__bar` also joined the de-energizing list, which it was missing from entirely — an alarm
  clearing used to snap. Its *width* is deliberately still instant; that is the live edge.
- **JS: the uniform case, generically.** The observer now watches `style` with `attributeOldValue`,
  and recovers the old geometry by putting the old attribute back on the live element, measuring, and
  restoring — two synchronous forced layouts with no paint between them. Cloning cannot do this: a
  meter's width is a percentage of its track, and a clone in `.ac-persist` has no track to be a
  percentage of. Only shrinking counts.
- **The styled element is usually not the one that shrinks**, which the first version got wrong. The
  demo writes `--ac-meter-value` onto the *track*, a fixed-width box that never changes size; the
  *bar* inside it is what moves. Measuring only the mutated element found nothing and ghosted nothing.
  The element and its immediate children are measured now.
- **And the probe fed itself into an infinite loop.** Putting the old `style` back is *itself* a style
  mutation on an element being watched for style mutations, so every batch queued another batch for
  ever and the page hung — the visual suite timed out taking a screenshot. It is the same self-feeding
  trap the `.ac-persist` filter already guards against, arriving by a different route.
  `observer.takeRecords()` drains the probe's own writes; they are synchronous inside the callback, so
  nothing an application did can be interleaved with them.
- Because the JS path asks "did any lit area shrink" rather than naming a component, the radar's
  A-scope bars and echo blips are covered without the framework knowing they exist.
- Suppressed in `prefers-reduced-motion`, print and forced colors alongside every other overlay. Under
  reduced motion the lagging bar would already be invisible — the blanket stops its width from
  transitioning, so it sits exactly under the live bar — but it is hidden rather than left to paint.

### Fixed — the halo now matches its own ink, and everything lit now glows

Two reports, both correct: *"the glow for P7, P11 has a yellowish tint different from the main
color"*, and *"not everything glows like it should"*.

- **P11's halo sat 0.1025 away from its own ink in CIE xy; argon's 0.0916.** `--gas-1` was solved at
  a fixed luminance of 0.62, which a deep blue cannot reach inside sRGB — so gamut mapping walked it
  toward D65, adding red and green, and the halo read visibly warmer than the text it was supposed to
  be scattered from. Both offenders were the two most out-of-gamut emitters, which is the signature.
  It also quietly contradicted this file's own rule that *chromaticity is never adjusted*.
  Each glow stop is now solved at the brightest luminance whose gamut walk stays within the INK's,
  so P11 lands at 0.0284 and argon at 0.0268. P11's `--gas-1` goes `175, 209, 255` → `87, 174, 255`.
  Nine palettes were already inside tolerance and re-derive byte-identically.
- **The first attempt at that fix was wrong and is worth recording**: holding each stop within an xy
  tolerance of the EMITTER is unachievable at any luminance, because a chromaticity outside the sRGB
  triangle has a negative channel however dim it gets. It drove Y to zero and blacked out eight of
  eleven halos. Only the *overflow* half of the walk is luminance-dependent, and matching the ink's
  is the criterion that is both achievable and the one somebody actually sees.
- **P7 is untouched at 0.3524 and must stay there.** Its halo is a different coating, not a gamut
  artifact — blue `ZnS:Ag` flash over a yellow-green `(Zn,Cd)S:Cu` afterglow. The budget is measured
  against the afterglow spectrum, so the cascade survives the fix that removed the others.
- **`--ink-dim` was being treated as inert when it is a drive level.** `derive-gas.mjs` labels
  `--emit-70` *secondary* — a cell at 70% drive, which scatters 70% as much — yet every rule setting
  it also set `text-shadow: none`. That is what left the State box's labels and dim panel titles flat
  beside values that glowed. Glow now follows the drive level: **1.00 / 0.70 / 0.41**, falling
  straight out of the 7.0 / 5.2 / 3.4 : 1 contrast targets each stop was already solved to.
  `--emit-30` computes to 0.11 and stays flat, which is what makes the decorative rules decorative.
- **No border in the framework had a halo.** `--glow-box` was opt-in and used at fourteen sites, all
  of them filled or focused states — so an unchecked radio ring drawn in `--stroke` had no glow while
  the identical value glowed as text next to it. Strokes now carry `--glow-box`, or `--glow-box-dim`
  for `--stroke-dim`, across fifteen components. Unlike the text pass this had to be stated per
  component: **`box-shadow` does not inherit.**
- **A second variable was needed because ink and stroke are not always driven together** — an
  `.ac-input` is `--ink-bright` text inside a `--stroke-dim` box.
- **The tidy version of this does not work, and fails silently.** A single `--ac-drive` multiplier
  that every alpha references is resolved *where the custom property is declared* — at `:root`, where
  it bakes in as 1 — so descendants inherit a finished shadow list and setting the drive further down
  changes nothing. Every tier rendered at full strength and looked correct. It is the same trap this
  file already documents for `--glow-text` itself; the tiers are now separate fully-resolved tokens.
- **`npm run check` now enforces the DIRECTION of the pairing, not just its presence.** Stating any
  `text-shadow` used to be enough to pass, so the tiers could have been wired backwards unnoticed. A
  lit ink with the halo off now fails unless the selector is genuinely inert — `:disabled`,
  `aria-disabled`, `[hidden]`, `--off`, `[data-stopped]` — and that list is written down because no
  amount of CSS analysis can infer which application states mean "not lit". It immediately found two
  stranded inline specimens in the guide.
- Disabled controls remain completely flat under every palette. That is law 1's actual claim, and it
  is the half the drive tiers must never absorb.

### Added — `data-ac-engine`, so the CSS/JS split is visible instead of described

Almost everything in this system is CSS, and there was no way to see that from a demo page with every
effect switched on. `data-ac-engine="css"` on the root turns off exactly the three effects that need
`amber-console.effects.js` — ghosting, scroll smear, framebuffer decay — and leaves the bloom, cell
mesh, scanlines, blink decay, lingering halo and residual patches running.

- A `<button data-ac-engine>` drives it, persisted to `localStorage` under the same
  only-restore-while-a-control-exists rule as the style flags. Default `css+js`.
- The effects module reads the attribute off the root itself, as it already does for
  `.ac-afterglow` and `data-ac-style-smear` — no new handshake between the two files.
- Deliberately a fourth axis rather than another style flag: it makes no claim about the hardware and
  is not a comfort preference, so flipping it does not put the readout into `*MOD`.
- All four demo boards gain an `ENGINE` row in the State readout and a `JS` badge on the controls
  that depend on the module.
- **The board's three switch regions became one.** SIMULATION, STYLE and ENGINE as separate panels
  ran 606px in a quarter of a board that is explicitly not allowed to scroll — against 221px and
  342px for the two emitter catalogs beside it. They are now a single **SWITCHES** region carrying
  all four toggles at **364px**, which is 22px off its tallest neighbor instead of 264px.
  The saving is mostly prose: two six-line explanations became one-liners.
- The axis boundary the three panel borders were drawing is now drawn by two micro-type group
  labels inside the one region, because it still has to be drawn — these are three different kinds
  of statement, and a flat list of four switches would claim PLASMA and JS EFFECTS are the same
  sort of thing. Rows are full-width with the label pushed left, so the tracks share a column
  without a fixed label width that the narrowest quarter could not afford.

### Changed — Scroll Smear now follows the simulation

The smear is a property of `.ac-afterglow`, which ships only with CRT, so under a plasma simulation
the switch had no selectors to match and no loop to run — and still read `ON`. It now takes its
default from the simulation: on under CRT, off under plasma, and **disabled with a stated reason**
where it cannot do anything, rather than offering a click that produces nothing.

- The derived default only fills a silence. Click the switch and the choice is stored, and from then
  on it is yours and stops following the simulation; `[data-ac-display-reset]` clears the key and
  puts it back to following.
- A derived value is never persisted — writing it would claim the preference on the first page view
  and the derivation would never run again.
- `STYLES` entries may now declare `defaultOn` as a function and `needs` as a required frame class.

### Fixed — the scroll smear was running at under half strength

- **Recalibrated, and this was the actual reason it was hard to see.** `SMEAR_FULL` was 55 px per
  frame, but a browser spreads one wheel notch over several frames and delivers roughly 15–25 — so
  ordinary scrolling reached about a third of the curve, which at a 0.9 px blur ceiling is invisible.
  Now 28 px, with the ceiling at 1.8 px and the additive copy's opacity at 0.45. Measured over a
  sustained 24 px/frame scroll, mean `--ac-smear` went from 0.44 to 0.85.
- **The sticky nav no longer goes soft.** `.ac-nav--sticky` is pinned to the viewport, so while the
  page scrolls it is the one element on screen whose pixels are *not* being handed a new value —
  nothing about it moved, so nothing about it should smear. Added to the `:not()` exclusion list in
  all four places that mirror it.
- **`connect()` is now idempotent.** `sync()` called it unconditionally, and each call reseeded the
  scroll reference — a reseed landing between a scroll and the next frame throws that displacement
  away and drops the smear mid-scroll. Rare in practice (measured: once over a four-second scroll on
  the busiest demo, none on the others), but `connect()` has no business not being idempotent.

### Fixed — the long phosphors now actually persist

The CRT pass derived persistence correctly and then almost nothing consumed it. P7 and P39 — the two
emitters whose entire reason for existing is a multi-second tail — held light for a fraction of a
second, because three separate things capped it away before the CSS ever saw it.

- **The tail was capped at its most common source, and this was the worst of the three.** The
  mutation observer spawned every ghost with the FAST duration unconditionally, which
  `tokens/effects.css` clamps to 400 ms, so P7's 3000 ms and P39's 2000 ms never appeared on a text
  rewrite — the path that fires most. The reasoning behind the cap was sound for a 105 ms gas panel
  ("a continuously-updating field would smear into its own next value") and exactly backwards for a
  long phosphor, where smearing into the next value **is the effect**. Replaced with the physical
  rule: a cell rewritten far faster than it can relax genuinely cannot accumulate its own history, so
  the fast path now applies only above four overlapping generations. A clock ticking once a second
  under P39 shows two generations, which is the thing radar operators were looking at.
- **De-energizing ignored persistence entirely** — every lit control released on `--ac-decay-fast`,
  so a P39 lamp went out in 60 ms. Now split by what each property describes, which is also the
  physical split: **structure** (background, border, color) still releases on the fast token so the
  control reads as off immediately, and the **halo** decays on the uncapped `--ac-persist-tail`,
  because the halo is precisely the scattered light that persists.
- Driven by a registered `@property --ac-lit`, not by transitioning `box-shadow` directly — a number
  interpolates reliably and lets each component keep its own shadows and focus ring instead of having
  them overwritten here. It is registered `inherits: true` **because a pseudo-element does not read
  its originating element's non-inherited properties**; at the tidier `inherits: false` the halo
  resolved to alpha 0 at every drive level, which looks exactly like the effect being off.
- **Hover is deliberately excluded** from the afterimage. A pointer crossing a dense panel
  de-energizes every control it touches, and at a two-second tail that is a wake of glowing boxes
  behind the cursor — which reads as lag, not as phosphor.
- **A long phosphor no longer blinks, it throbs.** The blink off-edge was a fixed 54%→62% window
  tuned for ~105 ms. Long-class emitters now select a second keyframe in which the next ON edge lands
  before the previous has drained, so the alarm never reaches the dark half — floor lifted from 0.1
  to 0.34. Selected by the palette through `--ac-blink-anim`, the same indirection `--ac-ghost-anim`
  already used, so `effects.css` still names no palette.
- **Scroll smear release scales with the emitter.** The drain factor is now the fixed 0.55 raised to
  the ratio of the reference decay to this palette's, so neon releases in ~130 ms as before and P39
  keeps trailing after the scroll stops.
- **A `mix-blend-mode` costs subpixel text antialiasing for the whole page, and both new layers were
  spending it.** One blended element promotes its containing stacking context, and the browser drops
  LCD text rendering inside it — so the afterimage moved ~1.1% of pixels on a capture where the
  effect was switched *off*, and the radar beam turned every glyph on the printed guide grayscale
  because it was the one blended element still rendering in print and forced colors. The afterimage
  no longer blends at all (over a near-black panel `screen` and ordinary alpha compositing of a
  bright halo are indistinguishable — the same argument the cell mesh already makes for drawing its
  ribs in pure black), and the beam is hidden in print and forced colors alongside every other
  overlay. The ghosts keep their blend, because they land on lit text where it genuinely differs.

### Added — persistence that CSS could not reach, and a second optional module

- **`@view-transition` page persistence, in pure CSS.** The only place a real framebuffer snapshot is
  available without JavaScript: navigating between pages leaves the old screen genuinely draining
  behind the new one, per pixel, on the emitter's own sampled curve. The direction rule survives —
  the OLD snapshot decays and the NEW page gets `animation: none`, so it is simply there on the first
  frame. A default view transition cross-fades both halves, which is a slideshow.
  **The at-rule is not shipped**: it is a document-level switch that cannot be scoped to a selector,
  and linking a stylesheet must not rewrite how a site navigates. One line opts in; `docs/docs.css`
  has it. Duration is capped separately from `--ac-persist-tail`, because the overlay sits above the
  document and three seconds of unclickable page is not a simulation.
- **`AmberConsoleEffects.transition(fn)`** for same-document changes — a true per-pixel decay of the
  whole screen. Wired to tab switches and dialogs. **Discrete changes only**, for a mechanical reason
  rather than a taste one: a view transition cancels whichever is already running, so wrapping every
  text tick would mean a long snapshot discarded sixty times a second and never completing once.
- **`.ac-sweep` — a PPI radar face, pure CSS.** The obvious way to draw a decaying wake is to stamp a
  mark per frame and fade each one, which is a framebuffer problem needing a canvas. But a PPI trail
  is not a history of marks — it is one continuous falloff behind a rotating line, and a
  `conic-gradient` already is that falloff. The angular stops are the decay curve read in degrees
  instead of milliseconds, which is a substitution rather than a pun: the beam turns at a constant
  rate, so angle behind it *is* time since that bearing was painted. Under P7 the leading edge is
  `--gas-flash` and the wake is `--gas-1` — the two coatings doing exactly what they did on the tube,
  and the clearest demonstration of P7 in the system. Period scales off the tail, with a floor,
  because neon would scale to 0.16 s and that is a strobe rather than a radar.
- **`src/amber-console.effects.js`**, and the framework is now explicitly two tiers. The CSS is
  complete alone; `amber-console.js` is behavior (tabs, dialogs, presets); the new module is
  persistence. **Neither imports the other and either works alone** — the effects module watches the
  DOM for `.ac-afterglow` and `data-ac-style-smear` rather than being told, because both facts are
  already in the DOM and a contract between two independently optional modules is a thing to keep in
  sync. README carries a capability matrix stating exactly what each tier does, so "CSS only" is not
  true by omission.
- `AmberConsole.afterglow()` still works and forwards to the effects module. Deprecated, removed in
  3.0.

### Added — six CRT phosphors, and persistence as a property of the emitter

The catalog has carried disabled rows for P1, P4, P7, P11, P31 and P39 since the display/emitter
split landed. They are fitted now, and the interesting part is not that there are six more colors —
it is that a phosphor has a *decay*, and the system had nowhere to put one.

- **A band model, which closes a debt this file opened.** A gas emits lines and NIST publishes them;
  a phosphor emits a broad band. `scripts/lib/cie.mjs` gained `sampleBands()`, and it samples the
  band as a **Gaussian in photon energy, not in wavelength** — a luminescence band is symmetric in
  the quantity being emitted, which renders as an asymmetric band with a longer red tail in
  wavelength, which is what real phosphor spectra look like. That is not a stylistic claim: fitting
  five published phosphor chromaticities with a symmetric-in-λ Gaussian leaves every one of them
  0.04–0.10 too saturated in xy, and in energy the same five land within 0.003. The asymmetry is the
  missing physics and it costs no new parameter.
- **Bands and lines converge on one shape**, `[[nm, intensity], …]`, so the chromaticity integral,
  the λ⁻⁴ scatter, the gamut fit and every contrast-solved stop are literally the same code for a
  phosphor as for a gas. The technology changes what the spectrum *is* and nothing about what is done
  with it.
- **P3's `--gas-scatter` is derived at last, and the placeholder was wrong by 23%.** It had been
  carrying neon's 1.00 with a note predicting a phosphor that close to neon's mean wavelength "would
  land near 1.00 regardless". The integral now runs and it lands at **1.23**. The prediction was the
  reasonable guess and it was still a guess. P3's *ramp* is unchanged and stays hand-built.
- **`--ac-persist` and `--ac-flicker` are one number read in two directions.** A screen redraws every
  frame; what is still lit when the next one arrives is the persistence, and what is missing is the
  flicker. So a phosphor cannot be steady and smear-free at once, and both tokens come off one decay
  constant in `derive-gas.mjs` — the same way `--gas-spread` is the square root of `--gas-scatter`
  and cannot disagree with it. P11 lands at 1.000 (fully dark between frames, maximum flicker, and
  the honest reason it was a phosphor for screens meant to be *photographed*); P39 and P7 at 0.091
  (no flicker at any refresh rate, paid for in smear, which is why they went on radar).
- **The caps are a usability decision made against the physics, and are documented as one.**
  `--ac-decay` is `min(--ac-persist, 250ms)` and `--ac-decay-fast` is `min(--ac-persist, 60ms)`,
  while `--ac-persist-tail` — ghosts and residual patches, where nothing waits on the result — runs
  uncapped. P7's real 3000 ms tail is correct and would be an unusable dialog close. `min()` also
  gets the short phosphors right in the other direction for free: P11 declares `0.035ms` and its UI
  snaps.
- **Decay curves are sampled, not approximated.** Long-persistence phosphors follow a Becquerel power
  law — a fast knee over a very long tail — which no single `cubic-bezier` expresses, and
  approximating one is why long-persistence CSS imitations read as fades rather than as phosphor.
  Those palettes ship a `linear()` generated from the decay model on a **log-spaced** grid, so the
  resolution sits where the curvature is rather than nine samples describing the crawl. Older engines
  fall back to the existing bezier.
- **P7 is two emitters and law 1 now says so.** The beam writes in blue ZnS:Ag; that layer's own
  photons pump a yellow-green (Zn,Cd)S:Cu layer behind it. `--emit-*` is the flash and `--gas-*` is
  the afterglow, so the halo does **not** track the ink — which inverts the rule stated at the top of
  `tokens/effects.css` and is the reason P7 exists as a part number. It also predicts the look
  correctly: static text is re-struck sixty times a second, so it reads as blue ink in a green halo,
  and text that stops being written leaves only the glow. Law 1 is restated rather than excepted —
  *one emitter per palette, and where the hardware is literally two, the second appears only in the
  decay, is never semantic, and is never `--ink`.*
- **`effects.css` still names no palette.** P7 declares `--ac-ghost-anim` and `--gas-flash`, and the
  effects layer falls back to the single-hue keyframe for everything else, so a consumer's own
  two-layer phosphor works with no edit to the framework.
- **The four gases declare none of this and render byte-identically.** No decay figure for these
  panels is cited yet, and inventing one to fill the column is exactly the kind of number this system
  refuses. They fall back to the same 105 ms and 60 ms they always had.
- **Honest about the evidence, which is weaker here than for the gases.** The phosphor blocks run
  *published color → band* rather than *spectrum → color*, so their bands are back-solved and their
  `validate` gate is a consistency check rather than the independent known-answer gate neon provides.
  Four things about the result are nonetheless non-circular, and the `$phosphors` block in
  `emitters.json` lists them — the best being that **P1 and P39 were fitted from different published
  coordinates and converged on the same band**, because P39 *is* P1's chemistry with arsenic added to
  lengthen the decay and not to change the color. The fit reproduced a fact about the compounds that
  was never given to it. Persistence figures are marked **provisional** pending per-phosphor
  data-sheet citations; the persistence *class* is solid and is all the design depends on.
- **Not attempted, deliberately:** the actual 60 Hz flicker of a tube. That is being watched on a
  60 Hz display, and sampling a signal at its own frequency is Nyquist rather than a browser
  limitation. What is rendered is the perceptual signature — fixed slow frequency, amplitude scaled
  by `--ac-flicker` — under a hard WCAG 2.3.1 budget stated at the keyframe that spends it.

### Added — a market terminal, and the argument is density

`docs/terminal.html` — **TELEMARK 400**, a page-based market data terminal of the mid-1980s dealing
room, with `docs/terminal.js` and a `doc-` block in `docs/docs.css`. The other three demos each argue
something about the hardware. This one argues the claim a system with one hue and one type scale most
has to earn: that four hundred numbers can share a screen and every one of them stay readable.

- **Five pages behind a four-character code**, which is what these machines were — FXSP spot foreign
  exchange with contributor codes, an eight-by-eight XRAT cross-rate matrix, DEPO eurocurrency
  deposits, GOVT bonds, INDX indices, plus the desk's own book marked against the spot page. Both the
  entry line and the soft keys route through one place so a page change drains per pixel either way.
- **The quoting conventions are load-bearing, as Decca-not-GPS is on the radar page.** There is no
  euro; deposits deal in **sixteenths** and treasuries and gilts in **thirty-seconds** while bunds
  and OATs are decimal, because that is how each of them dealt. Decimalizing any of it would date the
  screen to the wrong decade more loudly than a font could.
- **The matrix is derived from the spot legs, not transcribed**, so the two pages cannot disagree;
  it is a computed snapshot stamped with the time it was computed, which is what a cross-rate page
  was.
- **This is the ghost engine's own showcase.** The radar shows a phosphor decaying on a graphic; this
  shows it on numbers, which is what the mechanism was built for. Under P39 the value a quote
  replaced is still legible behind it, and the field it changed inverts for a second and a half —
  law 1's answer to flagging a change with no color to flag it in.
- **THE GHOST BUDGET SHAPED THE PAGE, and it turned out to be the period behavior.** `GHOST_LIMIT`
  is 24 and a page repricing forty cells at once would blow it in a frame. A contributed page never
  did: one bank revised one pair. So the tick writes three or four cells, the book and the session
  counters ride a slow cycle, only the local clock carries seconds, and the matrix is not live at
  all — measured, a live matrix alone held twenty of the twenty-four and was evicting the quote
  trails the page exists to show. Steady state now runs 5–9 concurrent.
- **The market is driven by an animation, not a timer**, which is a determinism decision. The other
  demos hold their first tick behind a fixed delay chosen to clear the visual suite's shutter; that
  works until the suite grows, and it went red twice here at 2.5s and again at 6s. `capture.mjs`
  disables every animation before it shoots, so an animation-driven tick *cannot* fire during a
  capture — frame zero by construction at any machine speed. `docs/radar.js` already ran on this
  principle; the metronome generalises it to a page with no moving part to borrow.
- `capture.mjs`: `click` now takes a list, so all five pages are probed rather than one, and
  `.doc-ticker` joins the overflow probe's skip list — a marquee is content wider than its box by
  definition, like `.ac-spinner` before it.

### Added — a radar, because P7 was built for one

`docs/radar.html` — **SEASCAN RM-12**, an early-1980s marine radar, with `docs/radar.js` and a
`doc-` block in `docs/docs.css`. `.ac-sweep` gave the system a PPI; this is the set around it, and it
exists for one emitter. P7 is two coatings and the reason it was fitted to radar is that the flash
gives position and the trail gives history — so a page that is nothing but a rotating beam and the
light it leaves is the only honest way to show what that phosphor is *for*.

- **Every mark on the face is a rotated zero-width arm** pinned at the center with
  `height: calc(var(--rng) * 50%)`. Polar coordinates land where they belong at any dial size, with
  no arithmetic in JavaScript and nothing to recompute on resize, and no SVG anywhere near it.
- **Contacts decay on the phosphor's own curve.** Each one animates on the sweep's period, delayed by
  its bearing's share of a revolution, crossing from `--gas-flash` to the afterglow ramp exactly as
  `ac-ghost-cascade` does and draining under the palette's sampled `--ac-decay-ease`. Nothing about
  the decay is chosen on this page; all of it is read off the emitter.
- **The sweep is the clock.** There is no `setInterval` for the radar — the page advances the world on
  `animationiteration` from the beam. A timer would drift against a CSS animation within a minute,
  and the subject of the page is that the beam and the light are the same event. Switch to P39 and
  the antenna slows to match the phosphor, because both come off `--ac-persist-tail`.
- **The controls do something.** A/C SEA suppresses the clutter bands and, turned far enough, the
  buoy inside them; A/C RAIN differentiates the video so land keeps its leading edge and loses its
  body; TUNE costs echo strength; range change re-projects the whole picture inside
  `AmberConsoleEffects.transition()`, so the old face drains per pixel while the new one fills in
  behind the beam. Standby does the same thing, which is what blanking a long phosphor looks like.
- **TRAILS is a persistence control that is deliberately not `.ac-afterglow`.** That class belongs to
  the CRT simulation, and the split is also the historically correct one: the tube's persistence is
  the phosphor, and target trails were a separate synthetic afterglow the set added on top. The soft
  key sets the floor the contacts decay to and leaves the emitter alone.
- **The page fits its own tube.** The display store is shared across the demos, and a radar in neon
  has no flash layer, so `radar.js` seeds CRT · P7 on a first visit — at parse time, before the
  framework reads the store, so there is no frame of the wrong palette — and never again after that.
  The visual harness seeds the same flag, which leaves each case in charge of its own simulation.
- **Forced colors keeps the picture.** Author backgrounds are mapped away in that mode, which would
  leave an empty circle, so every mark that carries information is redrawn in system colors.
- `test/visual/capture.mjs` skips `.doc-ppi` in the overflow probe: a zero-width box reports its
  centered mark as overflow, and scroll overflow is measured on axis-aligned bounds, so a rotated arm
  reports a box far wider than the thing at the end of it. Neither is reachable or lost, and the dial
  cannot overflow its parent regardless.

### Added — a second demo, and it is not a period piece

`docs/server.html` — **D-STAR**, a self-hosted server dashboard, joined by `docs/server.js` and a
`doc-` block in `docs/docs.css`. ORION-70 argues that the system reproduces 1988 hardware; this one
argues the half that was never tested, which is whether the same tokens dress an application people
would actually ship.

- **Built out of the parts an app needs and a projector does not**: three tab panels rather than two,
  a table of containers with a working switch in every row (stopped → `.ac-spinner` while starting →
  active), a scrub that runs a live `.ac-meter` to completion, a destructive host restart behind
  `.ac-dialog`, and an event log every action on every view writes into.
- **Status without a second hue.** A dashboard normally says healthy in green and down in red. Law 1
  allows neither, so state is carried by inverse video, ink level and blink — the three signals the
  genre already had, and the ones that survive a colorblind operator and a black-and-white printout.
- **A sparkline made of boxes.** Law 6 bans the SVG element, so the 30-day availability strip is a
  flex row of lit cells with an inline `--h` — which is what a character grid would have drawn anyway.
- **The demo's simulation is deterministic.** Values drift from a seeded Lehmer generator rather than
  `Math.random()`, the markup is frame zero, and the first tick is held to 2.5s so it lands well
  clear of the visual suite's shutter. Host CPU is the sum of what the containers use; package
  temperature and wall draw are functions of it, so stopping a service visibly cools the machine.
- **`test/visual/capture.mjs` gained `click`.** A `display: none` tab panel reports a `scrollWidth` of
  zero, so the overflow probe could not see the widest markup on the page — a seven-column table that
  overflowed a 390px frame by 214px the first time it was written. The page is now probed as it loads,
  the tab is opened, probed again, and the worse of the two is reported.

### Fixed — the bloom now reaches everything that is lit

- **Glow was opt-in, and most of the panel never opted in.** Twenty selectors in the whole framework
  said `text-shadow: var(--glow-text)`; everything else rendered flat however brightly it was lit,
  because `.ac-bloom` only overrides the *value* of the token — an element still had to ask. Measured
  on the demo pages: 34 elements at `--ink` or `--ink-bright` with no halo at all, including every
  table cell, every toggle label, all 82 inline `<code>` spans in the guide, and a blinking alarm
  banner. None of that was decided; it was never added.
- **The halo is now applied once and inherits** — at `body`/`.ac-root` and at `.ac-screen` — so the
  failure inverts: a new component glows because it is lit, instead of not glowing because nobody
  remembered.
- **Pairing is now the rule, in both directions.** Inheritance alone is not sufficient and that was
  the surprise: an element that brightens its own color inside dim prose inherits the dim's
  suppression and stays flat, which is exactly how those 82 `<code>` spans sat at `--ink-bright` with
  no halo. So every rule that sets an ink level restates the halo that belongs to it — lit glows,
  dim/faint/inverse do not.
- **`text-shadow: inherit` added to the form-control reset.** `button`, `input`, `select` and
  `textarea` inherited font and color but not the shadow, so a toggle's own label sat flat on a panel
  where every word around it glowed.
- **`.ac-panel--dim .ac-panel__title` no longer glows.** It overrode the color to `--ink-dim` and
  kept the halo it inherited from the base rule — a glowing title above non-glowing contents.
- **New `unpaired-glow` gate** in `check-prohibitions.mjs`, covering CSS rules *and* inline `style`
  attributes, since the guide builds its specimens out of the latter and seven of them were stranded.
- Cost, accepted: worst-case scroll frame went 82ms to 149ms on the guide, since a 4-layer shadow with
  a 56px outer blur now paints on every text node. Median is unchanged. If it ever bites, the fix is
  `em`-relative radii so the halo tracks the size of the lit area — which is also more physically
  right than a 56px halo on an 8px label.
- Print and forced-colors captures are **byte-identical** after the change: `print.css` already blanks
  `--glow-text` at both `:root` and `.ac-bloom`, and forced colors strips shadows at the UA level.

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
  true. Finding out the color math broke against an answer we know beats staring at three palettes
  whose answers nobody knows.

### Added — per-gas glow

- **`--gas-scatter` and `--gas-spread`.** Until now every palette bloomed with identical geometry and
  only the color changed. Rayleigh scattering goes as λ⁻⁴, so a violet gas throws far more of itself
  sideways into the glass than a red one: helium 1.26, krypton 1.31, argon 1.49 against neon's 1.00.
  `--gas-spread` is the square root, since multiple scattering widens the halo as it brightens it, so
  both numbers come off one mechanism and cannot disagree. Derived per palette; both fall back to 1,
  so neon and P3 render byte-identically and the visual baselines still pass.
- The **innermost 2px layer is deliberately not scaled** — that is the glyph's own lit edge, where the
  photons started, not scattered light. Only the wide layers are the halo.
- Weighted by `I(λ)·V(λ)`, and it is the mean of λ⁻⁴ rather than λ⁻⁴ of the mean wavelength. Those
  differ for a spread spectrum, and the second is wrong: luminance-weighting a mean wavelength drags
  every gas toward 555 nm by construction and under-reports the difference.
- **Not modeled, on purpose:** the eye's longitudinal chromatic aberration. It really does make
  violet look fuzzier and ratios out at 2.67× for argon, but the absolute difference is 0.126 D —
  about half an arcminute, under a pixel — so using it would inflate a sub-pixel effect into 150 px
  of fog. The ratio is real; using it here would not be.
- P3 held neon's 1.00 as a placeholder rather than a derived result, because it is a broad band and
  not a line spectrum, so the integral had nothing to run over. **Superseded later in this same
  release** — the CRT pass grew the band model (P7's two layers made one unavoidable anyway), the
  integral ran, and P3 lands at 1.23 rather than the 1.00 the placeholder note predicted it would be
  near. See *Added — six CRT phosphors* above.

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
  about what color the cell is. Drive it harder and it is still argon.
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
  edges of the *screen*. It is also the only version that renders — Chrome rasterizes a
  `backdrop-filter` stretched over a 15,105px document in tiles, and the seams showed as static
  horizontal and vertical bars, with the huge mask and vignette gradients quantizing into visible
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

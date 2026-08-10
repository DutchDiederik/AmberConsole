# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing yet.

## [2.0.0] — 2026-08-10

A breaking release: every custom property this framework owns is now `--ac-*` prefixed, and the
pre-prefix names are gone rather than aliased. If you never overrode a token, upgrading is a
drop-in. If you did, prefix what you set with `ac-` and you are done.

Entries run newest first. The last work before release was an audit of the whole tree against its
own documentation — the first eleven groups below. Nothing there changed the API or removed
anything; it closed contracts the code was not keeping and corrected documents that described a
framework slightly different from this one.

### Fixed — the committed `dist/` JavaScript was one release behind its own source

The 2.0.0 entry below records that `scripts/build.mjs` now stamps a version into all four JS
banners. It does — but the four **committed artifacts** were never regenerated afterwards, so
`dist/amber-console.js` and `dist/amber-console.effects.js` still shipped an unstamped banner and
the two `.global.js` builds still carried the duplicated source banner the same change removed. The
fix was real; the output was stale.

This is exactly what the `Verify dist/ is up to date` step in CI exists to catch, and it would have
caught it: `npm run build && git diff --exit-code -- dist/` exits 1 on the previous tree. It had not
run because the step post-dates the commit that went stale.

### Fixed — three components disagreed about what "disabled" looks like

`components/button.css` states the law: *inert, so no halo at all — not a dimmer one.* `.ac-btn`,
`.ac-check` and `.ac-radio` kept it. `.ac-tab` and `.ac-input` did not — both carried
`--ac-glow-box-dim` while disabled, so a dead tab and a dead well still scattered light. `.ac-tab`
was the worse of the two: its comment said *"Inert keeps no edge, the same as a disabled key"* while
the declaration under it did the opposite.

Both now go to `box-shadow: none`. The toggle **housing** keeps its dim halo and that is now written
down as the one stated exception — it is a box that is still drawn rather than a cell that is no
longer lit, which is the argument `components/toggle.css` already made where it makes it. The thumb
inside it, which is the lamp, still goes dark.

- **Neither state was measurable before.** The computed suite's fixture had a disabled *button* and a
  disabled *toggle*, but an enabled input and no tab at all, and neither appears on any page the
  screenshot suite baselines — so the whole 824-probe run came back clean across the change.
  `test/computed/capture.mjs` now carries both, which is the 48 new probes.

### Fixed — an over-range meter said so only while it was blinking

`.ac-meter--alarm` promised *"inverse-video the whole track and blink it — there is no red"* and
delivered a slightly brighter border plus a blinking bar. Blink is switched off by
`prefers-reduced-motion`, by the blink style flag, by print and by forced colors — four environments
in which an alarmed meter was indistinguishable from a healthy one.

The track now fills with `--ac-fill` and the bar is cut out of it in `--ac-on-fill`. That way round
is forced: the bar is already `--ac-fill`, so filling the track with the same token would make the
reading vanish into it. Added to the inverse-video lists in `base/a11y.css` (Highlight /
HighlightText) and to the `print-color-adjust: exact` list in `base/print.css`, without which the
lit track simply does not print.

- **Neither meter state was measurable either, and the alarm is now the better-covered of the two.**
  The blink group already rendered an alarmed meter but recorded animation properties only, so the
  whole inverse-video change was invisible to it; and the only alarmed meter on a baselined page sits
  inside `server.html`'s `#view-storage`, which ships `hidden` while the visual harness clicks
  `#tab-services`. Two suites, one fixture between them, no coverage. `test/computed/capture.mjs`
  grew a `meters` group probing the plain, dim and alarmed track and bar — ink, halo and the
  afterglow ghost — across all four media and with the persistence layer on and off.
  Under forced colors it records the system colour by **name** rather than by value: the emulated
  palette belongs to the browser build, not to this stylesheet, and the computed suite is the half of
  the testing that runs on a Linux CI runner. Every other probe in the file already measured
  something platform-neutral; baking `rgb(55, 0, 110)` into the baseline would have made the first CI
  run red for a reason that is not a regression. All matching keywords are joined rather than the
  first taken, because Canvas and HighlightText are both white and first-match-wins mislabelled the
  plain track.
- **The lagging ghost bar inverted with it.** `sim/afterglow.css` paints the shrink-ghost in
  `--ac-fill`, which on an alarmed track is now the colour of the track behind it — so the one
  bargraph where a falling reading matters most was the one that stopped trailing. It is drawn in
  `--ac-on-fill` under `.ac-meter--alarm`.
- **`.ac-meter--dim` no longer reads as full drive in forced colors.** The bar was matched
  unconditionally and came back as `Highlight`; it takes `GrayText` now, the same word that mode
  already uses for the disabled thumb. Print needed no equivalent — `--ac-ink-faint` re-points to a
  mid grey there, so a dim bar already prints grey against a black one.

### Fixed — a scoped embed resolved half a palette

The semantic aliases (`--ac-ink`, `--ac-fill`, `--ac-stroke`, …) were declared on `:root` alone. They
are indirections, and a `var()` is substituted **at the element that declares it**, then inherits as
a resolved colour. So a consumer following the `base/reset-scoped.css` guidance — who puts
`data-ac-tech` / `data-ac-emitter` on `.ac-root` rather than on `<html>`, which is the natural thing
to do when you do not own `<html>` — moved the five `--ac-emit-*` stops on that subtree and nothing
else. The surfaces changed and the text stayed neon.

`tokens/colors.css` now declares the aliases on `:root, .ac-root`. Deliberately **not** on
`[data-ac-tech][data-ac-emitter]`, which would cover more elements and weigh (0,2,0) — enough to beat
a consumer's own `:root { --ac-ink: … }` and silently break the one override the REFERENCE chapter
tells people they may write. `.ac-root` weighs the same as `:root` and wins for its subtree by
proximity instead. `base/print.css` carries `.ac-root` in its re-point list for the same reason;
without it that closer declaration would win and a scoped embed would print in amber.

### Fixed — demo controls that were not wired

- **The radar's Interference Rejection switch did nothing.** It carried no `data-ac="toggle"`, so
  `amber-console.js` never bound it, and `radar.js` had no handler either. It flips now, and reveals
  a run of asynchronous-interference spokes when the rejection is OFF — the thing the control
  removes, which has to be visible for the control to mean anything. The state is followed with a
  `MutationObserver` on `aria-pressed` rather than a second `click` listener: a plain `<script>` binds
  before `amber-console.js` does its DOMContentLoaded pass, so a click handler read the attribute one
  flip behind and ran backwards.
- **The radar's fourth track never finished acquiring.** `revolution()` carried a generic
  `if (state === "Acquiring" && tcpa === null) state = "Tracked"` inside its loop *and* a
  T4-specific block after it that set both the state and the track's first TCPA. The generic test
  ran first, so by the time the specific block looked, T4 was already `Tracked` and its condition
  was false — dead code. T4 was promoted but never received a TCPA, and its column in the target
  plot read `—` for the life of the page instead of counting down from 15:00. Acquiring and being
  solved are one event; splitting them across two tests is what let them disagree. The generic line
  is gone and T4 now reads 14:56, 14:51, 14:47 … one tick per revolution.
- **`doc-echo--tracked` and `doc-echo--clutter` were on the radar markup with no rule behind them.**
  A tracked contact looked exactly like a stray return. Tracked contacts now hold full amplitude
  longer before draining — said with dwell rather than with brightness, which the selected-track ring
  has already spent, and not with a raised trail floor, which would have been declared nearer than the
  `.doc-scope` the TRAILS softkeys write and stopped those four buttons working.
- **`initGas()` dragged a saved palette back to neon.** The deprecated two-position toggle runs last
  and unconditionally applied one of its two gases, so a page still shipping that button reset a
  visitor's P39 or krypton on every load, using a control that cannot reach those palettes. It now
  restores only what it can express and leaves the rest alone.
- **"Reset to Preset" left a stale readout** when no catalog row was selected.

### Fixed — a crashed `make-assets` run left a file the next build treated as a page

`scripts/make-assets.mjs` renders through `docs/.make-assets.tmp.html` and unlinked it only after the
last successful capture — so any throw, including the deliberate one when the stylesheet has not
applied, left both the scratch page and a live chromium process behind. Cleanup moved into a
`finally`.

The scratch page was the worse half. `scripts/build.mjs` collects `*.html` from `docs/` and excluded
only `_`-prefixed partials, so a leftover dotfile was a fourteenth demo page as far as the build was
concerned — expanded into, counted, and served. It skips `.`-prefixed files now as well. Both ends
are fixed rather than one, because only the build is in this repo's control if the script is copied
out of it.

- **`make-assets.mjs` still described the palette as something `data-ac-gas` changes** — the
  deprecated single attribute, rather than `data-ac-tech` / `data-ac-emitter`.

### Fixed — the guide stated things the code contradicts

Each was checkable against the thing it described.

- **Three contrast ratios in REFERENCE were each one stop out**, every row carrying the next row's
  number: `--ac-ink` was listed at 5.2:1 (it is 7.0), `--ac-ink-bright` at 7.0 (10.5), `--ac-ink-dim`
  at 3.4 (5.2). `--ac-ink-faint` and `--ac-ink-trace` now carry theirs too.
- **The corner radius was documented as the opt-out value in three places** — REFERENCE, the README
  cheat-sheet and a TYPE caption all said `8px` / `4px`. Since 2.0 made the cut corner the default
  those are `.ac-rounded`'s values; the defaults are `2px 4px 8px 4px` and `1px 2px 4px 2px`. The
  README contradicted itself, describing the `2 / 4 / 8 / 4` diagonal correctly 400 lines earlier.
- **Law 1 on the guide's front page read "There is no phosphor in here"** directly above a catalog
  offering seven of them, and titled itself ONE GAS while four of eleven emitters are gases. The
  README had already been corrected to "One **emitter**"; the guide never got the edit. Its neon
  figure was also P3's — 590nm against neon's 585.2nm.
- **`--ac-halo-spread` / `-scatter` / `-flash` were described as "the three radii".** One is a radius,
  one is an alpha multiplier and one is an `r, g, b` triple.
- **`--ac-lit` was described as "read rather than animated"**, which is backwards — it is a registered
  `@property` precisely so it can be transitioned, and it is.
- **`--ac-persist-fast` was described three different ways and is read by nothing.** It is kept and
  relabelled as what it is: documentation of where the hardcoded 4% crossover in `ac-ghost-cascade`
  comes from, since keyframe offsets cannot read a custom property.
- **One sentence contradicted itself** — "the last five … the only two tokens that could not be
  aliased".
- **`RATIONALE.md` still described the pre-token blink maintenance model**, warning that a new blink
  site means editing four files. It has been one declaration pair on the site itself since 2.0.
- **`CONTRIBUTING.md` advertised the wrong test sizes** — "44 Playwright screenshots" and "824
  computed-style probes", both of which this pass itself invalidated by removing an orphan baseline
  and adding the inert-state probes. It says 99 captures over 14 pages, 43 baselined, and 872 probes.
- **The README called the hue "one gas"** where law 1 now reads *one emitter*, which is the whole
  point of the rename: four of the eleven are gases.
- **Stale source comments**: two pointed at "the top of this file" for things in other files, one
  instructed future editors to keep a selector list in step with copies in `print.css` and
  `a11y.css` that a refactor had already deleted, two gave `sim/afterglow.css` a line count it
  outgrew, and `.ac-btn` was documented at 44px where it measures 46.

### Fixed — the COLOR chapter gave a migration instruction that is not true

It said `--amber-*` *"survives as a deprecated alias and goes in 3.0"*. It does not survive: it was
**removed in 2.0**, which both `DEPRECATIONS.md` and the DEPRECATED chapter state correctly, and
`grep -r -- "--amber-" src/` returns nothing. A custom property that no longer exists resolves to
nothing rather than erroring, so a reader trusting that sentence would keep writing `--amber-90` and
watch it silently do nothing — the exact failure mode the deprecations chapter opens by warning
about.

### Fixed — five chapters printed their own intro twice

`.doc-lede` is a condensed copy of the first body paragraph, and on COLOR, CONTROLS and DISPLAY the
two were **word for word identical**; EFFECTS and PERSISTENCE repeated their opening sentence before
going on. It had been survivable while the lede was narrower than the prose under it. Widening it to
the full measure — see below — put two identical full-width paragraphs directly on top of each
other, which is why it is fixed here rather than left. The duplicates are gone and the overlapping
openings start at their own material; SCREEN's shorter echo went with them.

- **`P31` was missing from the flicker list.** EFFECTS said *"P11 and P4 are fully dark between
  frames"* two paragraphs above a sentence correctly naming *"P11, P31 and P4"*. All three declare
  `--ac-flicker: 1.000`.
- **`.ac-root` was described as if it worked from the shipped bundle.** TYPE & GEOMETRY said putting
  it on a wrapper scopes the reset — true only after swapping `base/reset.css` for
  `base/reset-scoped.css` and rebuilding, which it did not mention. On the default build the class
  styles nothing on its own.

### Added — what the guide was missing

- **Five public tokens absent from a table headed EVERY TOKEN**: `--ac-backdrop` and the four
  `--ac-sweep-*` knobs, two of which the radar demo itself overrides. Plus `--ac-smear`.
- **`AmberConsoleEffects.transition(fn)`** — a public export documented in the README and nowhere in
  the guide. REFERENCE now lists all three exported functions together.
- **A section on the four environments the stylesheet answers on its own.** `forced-colors`,
  `@media print` and `tokens/fonts-cdn.css` appeared in **no** guide chapter; searching all nine for
  those strings returned nothing.
- **Six documented features had no live example**: `.ac-keypad__key--wide`, `.ac-keypad--dense`,
  `.ac-btn--block`, `.ac-list--bright`, `.ac-table--dense`, and the dim meter's missing scale and
  progressbar ARIA.
- **PERSISTENCE reconciled its own count.** Item 7 was labelled CSS and *"no script at all"* while the
  board's engine panel advertises framebuffer decay as one of three JavaScript effects. Both are real
  and they are different mechanisms — cross-document by CSS, same-document by `transition()` — and
  only the first was described. The tally is now four pure CSS, two JavaScript, two by both routes.

### Changed — guide layout

- **Chapter intros run the full measure.** `.doc-lede` carried `max-width: 62ch` while every other
  paragraph runs to `.doc-wrap`'s 1180px, so the first paragraph a reader meets was the one that
  stopped halfway across the page.
- **The Overview is numbered `00`** in the chapter strip, so the sequence reads 00–09 rather than
  starting unnumbered.

### Removed — an orphaned visual baseline

- `test/visual/baselines/guide-1440-rounded.png` — orphaned. The `1440-rounded` case is
  `only: ["guide-controls"]`, so nothing has compared against it since that scoping landed. All 43
  other baselines are live and none was missing.

### Fixed — the stylesheet shipped two different licenses

**`dist/amber-console.css` contradicted itself in its own first ten lines.** The generated banner
said `BSD-3-Clause`; the source header inlined below it, seven lines down, still said `MIT licensed`.
The [1.0.1](#101--2026-07-27) and 2.0 passes had corrected `LICENSE`, the README and `package.json`
and missed the one header that gets copied into every build — so the entry below claiming the
banners were fixed was itself half true. Both `dist/` stylesheets now say BSD-3-Clause once.

- **The repo URL in that header was lowercase** `amber-console` where everything else says
  `AmberConsole`. GitHub redirects, so it worked; it should still not disagree with `package.json`.
- **The two ESM builds shipped with no version in their banner.** `src/` is not allowed to carry a
  version number — the header of `src/amber-console.css` says so — and the ESM flavors were a
  straight `copyFile`, so they inherited the unversioned source banner while the classic-script
  builds got a stamped one. `scripts/build.mjs` now stamps all four, and drops the duplicated source
  banner it used to nest inside each `.global.js`.

### Fixed — the docs described a framework slightly different from this one

Each of these was checkable against the thing it described, and each was wrong.

- **The README's contrast section printed 5 of the 11 palettes** while its own opening sentence said
  the gate "runs against **every palette**, so none of them ships untested". The five it did print
  were accurate; the section simply stopped being regenerated when the palette count grew. All
  eleven are there now, straight out of `node scripts/contrast.mjs --md`.
- **`npm test` was documented as zero-dependency in both the README and CONTRIBUTING.** It leads with
  `npm run lint`, so it has never run without `npm i` — and CONTRIBUTING contradicted itself two
  lines later by listing `lint` separately as needing an install. Both now say what the command does
  (lint, check, gas, contrast, build) and which four of those run bare.
- **Three counts had gone stale:** CONTRIBUTING said `docs/` had twelve pages (fourteen), that the
  computed suite ran 548 probes (644), and both files called the visual suite "14 captures" — 14 is
  the page count; it takes 44 screenshots and probes the rest.
- **`RATIONALE.md` was linked from nowhere and shipped nowhere.** Two dozen comments in `src/` point
  into it by section, and `src/` is in `files` while it was not, so every one of those pointers was
  dead for anyone reading the package out of `node_modules`. It is now packaged, and linked from the
  README and CONTRIBUTING.

### Fixed — the demo pages did not practice what the framework preaches

- **No page had a `<main>` landmark and none had a skip link.** All fourteen now do. On the four
  demos `.ac-screen__body` simply *is* the `<main>` — it is styled by class, so the element could
  change with no CSS behind it — and `starter.html` and the README quickstart teach the same shape.
- **The TABS specimen in CONTROLS was an incomplete ARIA widget**, and it is the markup people copy.
  Three `role="tab"` buttons controlled nothing, on a page with no `role="tabpanel"` anywhere, so a
  screen reader announced "tab 1 of 3" and had nowhere to send anyone — while the code sample
  directly beneath it showed the `aria-controls` the live specimen did not have. It is now a working
  three-panel tablist, and the sample shows both halves of the model.
- **Three `role="tablist"` elements had no accessible name** (`index.html`, `server.html`, and that
  specimen). `terminal.html` had been doing it right all along.
- **Two classes were missing from a page that promises "every class"**: `.ac-readout__label--plain`,
  which three demos use, and the `.ac-toggle` parts `__track` `__thumb` `__state`, where every
  neighbouring row lists its parts.

### Fixed — configuration that guarded a directory this repository does not have

`.gitignore` carried thirty lines about campaign material in `promo/`, and `check-prohibitions.mjs`
skipped the same directory. Neither `promo/` nor the `scripts/promo-capture.mjs` those comments
pointed at has ever existed here. Both are gone; the note explaining why the visual baselines are
committed stays, shorter.

### Fixed — half the palette never inverted for print, and the print tests had photographed it

**Every filled element in the library printed as a solid black box with near-black text on it.**
`base/print.css` re-points the palette to black-on-white from `:root` — specificity (0,1,0). The
palettes in `tokens/colors.css` are `[data-ac-tech="…"][data-ac-emitter="…"]` — (0,2,0) — and a
media query adds no specificity, so print lost every token the palettes declare and won every token
they leave at `:root`. `--ac-fill` went black; `--ac-on-fill` stayed `#1e0c00` on top of it. **1.05:1
on every status strip, panel title, filled key, active tab and invalid input on paper**, in all
eleven palettes. `--ac-screen` never inverted either, so the setup board printed as a full page of
solid ink above every demo.

The print block now matches the specificity the palettes use, which — with this file imported last,
the contract its header already runs on — is enough to win.

- **`test/computed/` gained a `palette /` suite: 180 probes** reading the tokens off a real root
  through the real cascade in all four media, plus a contrast assertion on the three inverse-video
  components. **Nothing in the repository could see this bug.** `scripts/contrast.mjs` reads values
  out of `colors.css` and never resolves a cascade, so it only ever knew about screen; and the five
  print screenshots passed throughout, because a baseline that captured the broken page is a
  baseline that reports it as correct forever. The new probes fail on the ratio, not the pixels.

### Fixed — the README hero was a picture of 1.0, and nothing could regenerate it

`docs/screenshot.png` still showed a REV 1.0 nav bar with two links and the gas switches inline in
it — a layout that has not existed since the setup board landed. `scripts/make-assets.mjs`
*consumed* that file to letterbox the social card and never produced it, so the og:image was stale
by inheritance and no command in the repository could fix either. `npm run assets` now captures the
console itself before building the card, so the hero, the card, the favicon and the touch icon all
come out of one command and one stylesheet.

### Added — the repository furniture an open-source project is expected to have

`SECURITY.md` (with the actual surface stated plainly: no server, no network, no `innerHTML`, and
one `localStorage` prefix), `FUNDING.yml`, two issue templates and a pull-request checklist built
from the gates CONTRIBUTING already documents.

### Added — the guide has an onramp, and it is `starter.html`

The docs site described the system in nine chapters and demonstrated it in four whole products, and
had nowhere to send somebody whose question was *what do I type*. **`starter.html` has existed at the
repository root since 1.0 and the guide never mentioned it**, so the file the README calls the place
to start was reachable only from the README.

- **A `START HERE` section on the guide overview**, between the six laws and the chapter index —
  what is on the file, the whole setup as four lines of markup, why it carries no JavaScript, why it
  ships one display technology rather than both, and the three things its own footer ends on, each
  pointed at the chapter that argues it.
- **`SCREEN & BOARD` links it from SCREEN ANATOMY** as the smallest frame that still works, beside
  the assembled console it already pointed at.

### Fixed — the starter's panels did not space their own children

`.ac-panel` draws a border and pads its inside; it does not lay its contents out, because nothing in
this system puts margins between siblings. **The starter never wrapped a panel's rows in a layout
box, so the status strip, the button row, the toggle, the meter and the alarm sat flush against each
other at 0px** — the first page a new user opens was demonstrating the one spacing mistake the half-
cell grid exists to prevent. Each panel now holds one `.ac-stack`, and the comment beside it says
what happens if you delete it.

- **The meter's value moved onto `.ac-meter__track`**, where `src/components/meter.css` has always
  documented it, and the bar gained the `role="progressbar"` and `aria-value*` set that goes with it
  plus an `.ac-meter__scale`. It worked on the bar — the property inherits — but it taught the wrong
  shape.
- **Every row is `.ac-row--wrap`**, so a narrow phone reflows instead of clipping.

### Added — the starter is a small console rather than a swatch sheet

It showed six components, which was enough to prove the stylesheet loads and not enough to show what
a screen made of it looks like. It now opens on the `.ac-grid--console` split — what the operator
does on the left, what the panel reports on the right, folding to one column below 900px on its own.

- **Operating panel:** an `.ac-field` with an `.ac-input` well, an `.ac-select`, and `.ac-check`
  status bits in a fieldset, beside the buttons, toggle, meter and alarm that were already there.
- **Instrument panel,** on `.ac-panel--dim`: two `.ac-readout`s with units, an `.ac-hr`, an
  `.ac-list` with leader dots, and three `.ac-badge`s.
- Verified at 1440 and 390, and under forced colors, reduced motion and print: no horizontal
  overflow and no console errors in any of them.

### Fixed — four things the framework shipped and the guide never named

Found by diffing every class, token, attribute and export defined in `src/` against all ten guide
pages. **The reference chapter claims to be the complete index, so a gap in it is a wrong claim
rather than a thin one.** Tokens came back clean — the numbered families are listed compressed
(`--ac-space-1 -2 -3 …`), which is coverage, not an omission.

- **`.ac-keypad__key--wide`** was in no page of the docs. The keypad row listed `__key` and
  `__key--fn` and stopped.
- **`.ac-nav__link--active`** was undocumented because every page in this repository writes
  `aria-current="page"` instead. Both are in the same selector; only one was findable.
- **`.ac-panel__barTitle`** appeared exactly once, inside a specimen's markup, and in no table or
  code block — so `.ac-panel--bar` was documented without the child that draws its title. It is also
  the one camel-cased name in the framework, which is how it slipped past a class sweep. The DISPLAY
  chapter's code block now shows the child.
- **`data-ac-dialog-close`** was missing from the hooks table while `data-ac-dialog-open` was in it.
- **`init(scope)` is documented at all now.** Both modules bind themselves on `DOMContentLoaded`, so
  nothing said what to do about markup inserted afterwards — or that the dialog pair is delegated and
  the persistence module observes the tree, so neither needs the call.

### Fixed — "Reset to Preset" reset two of the four axes

The button cleared the stored value of a style flag only when that flag's default was *derived* from
the simulation, and it never touched the engine key at all. `classic` has a fixed default, so it was
in neither category: **a visitor who once switched Classic Buttons off could not get them back from
this button, on any preset, ever**, and JS Effects was in the same position. Both survived a reload
too, which is what made it read as a broken control rather than a stubborn preference.

- **Every `ac.sim.style.*` key and `ac.sim.engine` are now cleared by the reset**, and the defaults
  re-applied without being written back. Cleared is not the same as set-to-the-default: an absent key
  means *the user has never said*, which is the only state a derived default is allowed to fill in.
  Writing the default would claim the preference on their behalf and a derived flag would stop
  following the simulation forever after.
- **Classic Buttons is on by default under every emitter**, which it always was in the code — what
  was missing was a way back to that default once a session had stored otherwise.
- `styleDefault(name)` is split out of `styleOn(name)`, because the reset needs a flag's default while
  the root is still carrying the value it is about to discard.

### Changed — switching JS Effects off now reads `MOD`

It deliberately did not, on the argument that a preset is a statement about hardware and how much of
the library is running is not part of that claim. The reset above is what makes that argument stop
holding: **once a control is something Reset puts back, it is part of what the preset describes.** A
board that resets a switch it never admitted was moved is the readout and the button disagreeing
about the same fact. Only reachable on P39 and P7, which are the only two panels where the switch is
enabled at all.

### Added — the retrace band is optional

`data-ac-style-retrace="on|off"` on the root, exposed as a **Retrace Band** switch on the demo board.

- **It is a style and not a simulation.** The band is real hardware — a short phosphor genuinely only
  held the strip the beam had just written — but it is also the only part of the tube that *travels*:
  26% of the frame, across all of it, every 13s, over text somebody is reading. "That motion bothers
  me" is a comfort preference in exactly the way blink is, and turning it off is not a claim that the
  tube had no retrace. The scanlines, vignette and hum stay unswitchable because they sit still.
- **The author's opt-out costs a node rather than a rule.** The band is a `<span class="ac-retrace">`
  you put in the frame yourself, so leaving it out removes it. The attribute exists because
  `amber-console.js` mounts that child with the CRT simulation, so a page driving the simulation from
  a toggle cannot say "CRT, but not the band" by omission alone. The flag hides rather than unmounts,
  so flipping it is a style recalculation, not a remount of the simulation.
- **The switch disables itself under a gas** — every rule drawing the band is scoped to `.ac-crt`.
  Unlike JS Effects it does not care how long the phosphor holds or whether the effects module is
  loaded, so P11 gets a working band switch and a dead engine switch at once. This revives the
  `needs` mechanism that `data-ac-style-smear` left behind; the `engineOn()` half of its liveness
  test is now opt-in via `needsEngine`, since welding it on would have disabled a pure-CSS switch for
  every consumer running without the JavaScript.
- `prefers-reduced-motion` hides the band either way, as it always did.

### Changed — the retrace band is half as strong

A 4.2% trough under a 5.3% edge at full flicker, down from 8.5% and 10.6%. At the old amplitude it
was the first thing anybody saw and the last thing they stopped seeing — a bar sliding over the page
rather than the panel's own unevenness, which is what a decayed region actually is. The shape, the
13s period and the `--ac-flicker` scaling are unchanged, so the emitter axis still renders the
difference it claims; P11 still gets several times what P39 gets. The brightest glyph in the system
now moves by about one part in 255 rather than two.

### Added — two guide chapters, and full coverage of the framework in the guide

- **08 REFERENCE** — the complete index: every class grouped as `src/` is, every root attribute and
  JS hook, every token *split by whether you set it or the framework does*, and every `ac.sim.*` key.
  A guide made of specimens answers "how do I do X" well and "does this thing even have Y" badly;
  both are real questions, and the second one was unanswerable without reading seven chapters
  end to end.
- **09 DEPRECATED** — the on-site copy of `DEPRECATIONS.md`: the `--ac-*` rename and why the old
  names were not aliased, `--amber-*`, `--gas-*`, `data-ac-style-smear`, and the three hooks that go
  in 3.0.
- **22 classes were documented nowhere in the guide**, the entire layout family among them. `TYPE &
  GEOMETRY` gains a LAYOUT section covering `.ac-grid` / `--ac-cols` / `.ac-col-*`, the four row
  alignments, `.ac-grow`, `.ac-spacer`, `.ac-push`, `.ac-root` and `.ac-sr-only`; `CONTROLS` gains
  `.ac-radio--disabled`, `.ac-keypad--dense`, `.ac-dialog--wide` and `.ac-tab--active`; `DISPLAY`
  gains `.ac-list--dim/--bright`, `.ac-meter--lg/--alarm`, `.ac-readout--inline`, `.ac-banner--dim`
  and `.ac-hr`; `PERSISTENCE` names `.ac-ghost` and `.ac-ghost--fast`. Every class in `src/` now
  appears in the guide.
- **`SCREEN & BOARD` said the engine floor was 5ms.** It has been 80ms since the perceptual floor
  replaced the compositing one, so the chapter was telling readers P1 and P3 cleared a bar they do
  not. Fixed, along with the board's control table, which now carries the Retrace Band row and a
  Reset row that describes all four axes.

### Fixed — the build's engine-off note rewrite was a silent no-op

`expandBoard()` keyed on `<p hidden class=… data-ac-engine-off>` while the partial writes `hidden`
*after* the hook attribute, so the pattern matched neither the partial nor its own output and the
replacement never ran. It happened to be harmless — the partial already ships that note hidden — but
it was one moved attribute away from not being. Both note rewrites now accept `hidden` in either
position and are wrapped in `must()`, so a pattern that stops matching fails the build instead of
quietly doing nothing.

### Fixed — the CRT flicker was pointing the wrong way and had nowhere to be seen

The catalog says P11 is "fully dark between frames" and that short persistence and heavy flicker are
the same fact. Nothing on the screen showed it. `--ac-flicker` spans 0.091 to 1.000 across the seven
phosphors and both ends looked identical, so the emitter axis was making a claim it never rendered.

- **`ac-crt-hum` moved from the overlay's `opacity` to that overlay's `background-color`.**
  `.ac-crt::after` is a DARKENING layer — a black vignette and black scanlines — so fading it out
  made the panel *brighter*, which is backwards for a mains sag, and what moved was 3.5% of a layer
  whose own mean darkening is 15%: half a percent of panel luminance, in the wrong direction. Filling
  the same layer with black removes light directly, so the same 3.5% constant is now 3.5% of the
  picture — sevenfold what you can see, for nothing extra spent against the flash budget. It costs no
  additional work either: `ac-crt-drift` already animates `background-position` on that element, so
  the layer is repainted every frame regardless.
- **`.ac-retrace` is the other half, and it is the half that matters.** The refresh itself is
  unwatchable for the Nyquist reason the file has always given, but a short phosphor never showed the
  whole screen blinking: at any instant only the band the beam had just written was at full
  brightness and everything behind it had decayed. That is spatial, so it has no frequency to alias.
  The band now sweeps with a bright freshly-written leading edge and a decayed trough trailing it,
  both scaled by `--ac-flicker` — the radar wake in `components/sweep.css` on a straight line instead
  of a circle. P7 and P39 keep the almost-invisible sweep this was; P11, P31 and P4 get a band that
  reads.
- **It blends normally now instead of `screen`, and the trough is what forces it.** `screen` only
  ever adds light, so the dark half would be a no-op — and a black child inside a screen-blended
  element is a no-op too, so the trough could not hide in a pseudo-element either. The cost is that
  the bright edge alpha-blends rather than adding: at full strength it moves the brightest glyph in
  the system by two parts in 255, toward the halo colour it is already glowing in. The gain is one
  fewer `mix-blend-mode` on the page, which `a11y.css` and `print.css` both keep notes about.
- **The band's height does not scale with `--ac-flicker`** even though the decayed region physically
  would. `ac-retrace` translates by percentages of the element's own box, so a taller band travels
  further in the same 13s and starts spending most of the cycle off-screen — the timing would become
  a property of the emitter, and the detune in RATIONALE.md has four other periods depending on this
  one staying put. Amplitude carries it instead.
- **Behaviour change for the gases.** They declare no `--ac-flicker` and inherit the `:root` default
  of 1, so switching the CRT simulation on over a gas now gives it the pronounced band rather than
  the old faint sweep. Deliberate — the simulation is the tube, and asking for the tube over a gas is
  asking for what `--ac-flicker: 1` describes — but it is a change, and RATIONALE.md § The three
  flash budgets now scopes its "renders identically" note to the hum alone.
- RATIONALE.md § The two flash budgets is § **The three** flash budgets, with the arithmetic redone
  for both changed effects, as the note in `sim/crt.css` demands of anyone who touches them.

### Fixed — the release audit

A sweep of the whole repository before tagging. Most of these are metadata rather than rendering:
nothing in the cascade moved, and the computed suite is unchanged at 644 probes.

- **The package declared the wrong license.** `package.json` said `MIT` while `LICENSE` and the README
  said BSD 3-Clause, and every banner the build stamped into `dist/` said MIT too — so npm would have
  advertised one license over a repository shipping another. It is **BSD-3-Clause everywhere** now.
  Two files that carried no notice at all also gained one: the `@layer` builds, and the ES-module
  copies of the two optional scripts.
- **The JS effects now actually stop on P1 and P3.** `ENGINE_FLOOR_MS` was raised to 80ms in
  `amber-console.js`, but the mirrored `PERSIST_FLOOR_MS` in `amber-console.effects.js` stayed at 5 —
  so on those two phosphors the switch was disabled and painted OFF, the readout said `CSS ONLY`, and
  the module went on ghosting and smearing behind both of them. Both are 80 now, and the two files
  carry a note saying they are a pair. See the engine notes below.
- **Every GitHub Pages URL used the wrong repository casing** — 27 of them, across the README, the
  root redirect and all twelve docs pages, pointing at `/amber-console/` when the repository is
  `AmberConsole`. Social cards and the README's demo links resolved to nothing.
- **`.ac-bloom` and `.ac-crt` are documented as mutually exclusive**, which until now only a source
  comment said. `amber-console.js` has always enforced it; the CSS cannot, so a hand-authored frame
  could carry both. `starter.html` shipped exactly that combination — the first file a new user opens
  was demonstrating the one arrangement the framework calls incoherent — and now ships plasma alone,
  with the CRT alternative written out beside it.
- **The revision string is stamped from `package.json`** instead of being hand-carried in
  twenty-two places, all of which still read `REV 1.0`.
- Corrected in the docs: the minified size (35kb → **53kb**, 6.6 → **9.4kb gzipped**), "both demos"
  where there are four, the guide's social description offering "two gas palettes" against a catalog
  of eleven emitters, and the `og:image:alt` on three pages describing an image other than the one
  actually served. Three guide chapters jumped from `h1` to `h3` and now carry the section head the
  others already had.

### Fixed — the classic look is the default in CSS, with no JavaScript

- **A page that links the stylesheet and authors nothing now gets the classic corner.** It used to
  depend on `amber-console.js`: `classic: { defaultOn: true }` lives in the JS `STYLES` table, and it
  is `applyStyle()` that writes `data-ac-style-classic="on"` to `<html>`. Without that file
  `--ac-radius` fell through to the rounded value in `tokens/spacing.css`, so every CSS-only consumer
  silently got the look `classic.css` calls a departure from the panel — while the file's own header
  said "THIS IS THE DEFAULT LOOK". The stylesheet and the documentation agree now.
- **The cascade reads:** `:root` classic → `.ac-rounded` / `[data-ac-style-classic="off"]` opt out →
  `.ac-classic` / `[data-ac-style-classic="on"]` opt back in. `.ac-rounded` still works at any scope
  and still nests in either direction.
- **`tokens/spacing.css` now carries the 2px grid-quantized corner** rather than the 8px arc, so
  dropping `components/classic.css` degrades to a plain square-ish corner instead of leaving
  `--ac-radius` undefined and squaring off every control.
- Pages that load the optional JS render identically — it writes the same attribute it always did, and
  the full visual suite passes unchanged. Only the no-JS path moved.

### Changed — every token is `--ac-*` prefixed (BREAKING for overrides)

- **60 of the 76 tokens were bare** — `--ink`, `--fill`, `--screen`, `--radius`, `--leading`, `--gap`,
  `--cols` — and all of them are now `--ac-*`. This was not tidiness. `dist/amber-console.layer.css`
  exists so the framework can be embedded in an app that owns the page, and **cascade layers do not
  protect custom properties**: an unlayered `:root { --radius: 12px }` in the host beats a layered one,
  so a host that happened to use any of these names silently re-cornered every button, panel, dialog,
  input, toggle and meter. `--gap` and `--cols` were near-certain collisions in any real codebase.
- **The old names are REMOVED, not aliased.** They were briefly kept as read aliases, and that was
  worse than useless: nothing in the framework read them, so setting `--ink: red` did nothing and said
  nothing — a silent no-op is the hardest kind of bug for a user to diagnose. A major version is the
  right place to take the names away cleanly. `--amber-*` and `--gas-*`, deprecated in 1.x, go with
  them.
- **To upgrade: prefix every amber-console token you set with `ac-`.** `--ink` becomes `--ac-ink`,
  `--gap` becomes `--ac-gap`. Values, cascade and per-palette resolution are all unchanged.
- **`--ac-gap` and `--ac-cols` have no alias at all**, because they are consumer-set rather than
  framework-set — `.ac-row`, `.ac-stack` and `.ac-grid` read them off your element, so there is no
  `:root` value to bridge. Rename them at the call site.
- **stylelint now requires the prefix** (`custom-property-pattern`), so the next token cannot quietly
  go bare.
- Rendering is unchanged: 548 computed-style probes identical and the full visual suite passing with
  no baseline update.

### Fixed — a dim key glowed at full drive, and a latched key leaked an off-palette halo into forced colors

- **`.ac-btn--dim` rendered the FULL halo under the default corner style.** `classic.css` appended the
  extruded edge from a scope-prefixed rule at (0,2,0), which outranked `.ac-btn--dim` at (0,1,0) and
  replaced `--ac-glow-box-dim` with `--ac-glow-box` — so every dim key glowed as hard as a lit one,
  contradicting the drive-tier law the framework gates everywhere else. `.ac-rounded` had it too.
- **The same rule defeated `a11y.css` in forced-colors mode.** `.ac-btn--filled` and
  `[aria-pressed="true"]` are opted out of forced colors so inverse video survives, and a11y.css
  restates `box-shadow: none` on them for exactly the reason its header gives — an opt-out hands the
  element its shadow back. classic.css's press rule out-specified that restatement, so a latched key
  carried a full `rgba(255,120,30,…)` discharge halo into the one mode that exists to have no
  off-palette colour. It is `none` now.
- **The fix is architectural, not a patch:** `button.css` and `toggle.css` now write
  `var(--ac-glow-box), var(--ac-edge, 0 0 0 transparent)` on each state themselves, so every state
  carries its own drive tier *and* its own edge and the two cannot disagree. Four scope-prefixed rules
  in `classic.css` — the resting edge, the pressed edge, a blank for disabled, and the toggle housing —
  are deleted outright, which is also what the scopes-set-only-tokens design at the top of that file
  always promised.

### Changed — `tokens/effects.css` is seven files, and the simulations are droppable

- **The 1,004-line file was four things wearing one name:** the glow token system, blink, two hardware
  simulations and a persistence engine. It is now `tokens/effects.css` (glow tokens and where the halo
  is applied), `base/blink.css`, and `sim/{screen,plasma,crt,afterglow,frame}.css`.
- **`sim/plasma.css`, `sim/crt.css` and `sim/afterglow.css` can each simply be deleted.** That was the
  point: `afterglow` alone is 476 lines, a viewport-sized `backdrop-filter` and a registered
  `@property`, and dropping it takes the bundle from 51.1kb to 45.0kb minified. The entry file has
  always advertised "you can drop any single component you do not need"; the largest and most
  expensive part of the framework was the one part you could not.
- **`sim/screen.css` and `sim/frame.css` are ordering-critical and not droppable.** The first declares
  the z-index budget the other files spend; the second holds what must run *after* all three — the
  stacking normalisation, the viewport anchoring, and the `prefers-reduced-motion` block that switches
  them all off. Selectors either one leaves behind for a simulation you removed match nothing.
- **Blink is `base/` rather than `sim/`**, because `components/input.css` and `components/meter.css`
  are blink sites and must keep their alarm when the simulations are dropped.
- **The split made two prohibition exemptions narrower rather than wider.** The `transition` exemption
  used to cover the whole file — tokens, both simulations and the persistence engine — to license the
  handful of decays in one of them; it now names `sim/afterglow.css` and `sim/frame.css` only, so a
  `transition` added to the glow tokens or to either hardware simulation fails the build the way it
  always should have. The hex exemption dropped the token file entirely.
- Bundle output is byte-identical: the cuts are contiguous and nothing was reordered, so cascade order
  is provably unchanged.

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
  a *perceptual* one. It is live under **P7 and P39** (3000 and 2000 ms), and dead under **P1 and P3**
  (24 and 25 ms) and under **P4, P11 and P31** (0.06, 0.035 and 0.038 ms), and under every plasma gas.
- **The gate reads the frame, not the preset**, which matters for a state the system explicitly
  allows: a plasma gas with the CRT simulation switched on by hand has a real afterglow layer, and the
  switch correctly goes live there. Gating on the emitter would have got that backwards.
- **`ENGINE_FLOOR_MS` is 80 — a perceptual floor, not a compositing one.** It was briefly 5ms, which
  asks only whether a frame can be drawn at all: P1 and P3 cleared that, so the module did real work
  on them — cloning, measuring and mounting a ghost, animating it and removing it — to produce
  something that survived about one frame. That is a flicker, not persistence, and it was happening on
  the two phosphors most people pick. 80ms is the figure `tokens/effects.css` has always reasoned
  from: much under it and the eye stops reading a relaxation and starts reading a switch. Nothing in
  the catalog is near the boundary — the nearest values are 25ms below and 105ms above — which is what
  makes a single threshold safe rather than a fudge.
- **The floor is enforced in three places and they must agree.** `ENGINE_FLOOR_MS` in
  `amber-console.js` paints the switch, `PERSIST_FLOOR_MS` in `amber-console.effects.js` is what
  actually stops the work, and `scripts/build.mjs` uses the same figure to decide whether a docs board
  ships the switch enabled. They drifted apart once — the switch at 80 and the effects module still at
  5 — and P1 and P3 spent that window with a disabled switch reading OFF, a `CSS ONLY` readout, and a
  module still ghosting and smearing behind both of them. Change one, change all three.
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
  `--amber-*` was kept as a deprecated alias while this release was in development, and is **removed
  in 2.0** with the rest of the pre-prefix names — see the token-prefix entry above for why an alias
  nothing reads is worse than an absence. Use `--ac-emit-100` … `--ac-emit-30`.
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

## [1.0.1] — 2026-07-27

### Fixed — the README still named the old license

`LICENSE` had already been rewritten to BSD 3-Clause; the README's License section had not, and
still read MIT. Documentation only — no code, no tokens and no packaged file changed.

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

<!-- Tags in this repository are unprefixed — `1.0.0`, not `v1.0.0`. -->
[Unreleased]: https://github.com/DutchDiederik/AmberConsole/compare/2.0.0...HEAD
[2.0.0]: https://github.com/DutchDiederik/AmberConsole/compare/1.0.1...2.0.0
[1.0.1]: https://github.com/DutchDiederik/AmberConsole/compare/1.0.0...1.0.1
[1.0.0]: https://github.com/DutchDiederik/AmberConsole/releases/tag/1.0.0

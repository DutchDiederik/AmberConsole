# Rationale

Why the numbers in `src/` are the numbers they are.

This file is the long form. The CSS keeps the contracts, the warnings and the
instructions you need in order to edit it safely; everything here is the
*derivation* behind those — needed once by a maintainer, never by a reader of
the stylesheet. Nothing here is load-bearing at runtime.

Sections are named for the token or rule they explain, so a pointer in the CSS
(`see RATIONALE.md § Hue`) lands you in the right place.

---

## tokens/colors.css

### Technology, then emitter

A palette in this system is not a theme and not a light/dark pair. It is a
specific piece of hardware, and it takes **two** attributes on the root element
to name one, because the same colour word means different physics on different
glass:

- `data-ac-tech` — the display technology. What is making light at all.
  - `plasma` — a gas gap struck by a sustain pulse, emitting **directly**. No
    phosphor anywhere in the stack.
  - `crt` — an electron beam exciting a phosphor, which emits and then
    **persists**. The colour is the phosphor's.
- `data-ac-emitter` — which gas, or which phosphor, inside that technology.
  Only meaningful within its tech: `neon` is a gas and exists only under plasma;
  `p3` is a phosphor and exists only under crt.

Every palette block is selected by **both** attributes, so a mismatched pair
selects nothing rather than silently rendering the wrong hardware.

### Two phosphors sharing a ramp is not a mistake

P1 and P39 are both Zn₂SiO₄:Mn and differ only in decay; P7's flash and P11 are
both ZnS:Ag and differ only in what is behind them. Where the compound is the
same the colour is the same, and the palettes are told apart by their
persistence rather than their hue. Deduplicating them would be deduplicating two
pieces of hardware that really did look alike.

### Saturation is an output, not a setting

This file used to say saturation was held at 100% for every stop, because a
near-monochromatic emitter has no way to be pale. That was true of the only two
emitters it then described, and it is false in general — a special case wearing a
rule's clothes. Helium, argon and krypton are multi-line emitters: their light
*is* pale, and forcing them to 100% would mean inventing a saturation the gas
does not have. The rule it was a special case of:

> Chromaticity is derived from the emitter's spectrum and never adjusted. A
> near-monochromatic emitter integrates to a saturated colour; a multi-line
> emitter integrates to a pale one. Neither is a preference.

Neon still solves to 100% under that, so nothing about it changes, and the old
`--amber-100` special case ("a hotter cell can only get there by whitening")
stops being an exception and becomes an instance.

### Hue from the spectrum, luminance from the drive level

The corollary, and the one that has to be said out loud before somebody reads
these numbers as a fudge. Argon genuinely emits very little visible light — most
of its output is past 700nm, where the eye scores under 0.01 — but that is a fact
about radiant efficiency, not about what colour the cell is. Drive it harder and
it is still argon. So every stop is the emitter's own chromaticity at whatever
luminance the contrast gate demands, and the two decisions never mix.

### Hue — why neon is 24deg

Weight the Ne I visible lines by the CIE 1931 observer and the discharge lands at
x=0.631 y=0.369 — just outside sRGB, gamut-mapping to hue 19°. That is a DC neon
tube. This panel is not one: the sustain is a short high-field pulse, which
enriches the 585.2nm line (the highest-energy of the 2p→1s group, and already the
strongest) against the 640nm red group, and the hue walks up with it. At the ~2×
enrichment a pulsed cell plausibly sees, 24°. The band 19–31° is the defensible
range; 24 sits in the middle of it.

`scripts/derive-gas.mjs` reproduces that integral independently — it lands
x=0.6405 y=0.3591 against the x=0.631 y=0.369 above, agreeing to 0.0137 in xy —
and neon is kept in its line table for exactly that reason: it is the known
answer the pipeline is checked against before the three gases whose answers
nobody knows are trusted. That check is a build gate.

The neon ramp is nonetheless **hand-built** and stays that way. It was solved
hue-first at maximum saturation, which is not what the script does, and neither
of the script's gamut strategies reproduces it: holding the chromaticity gives
`#ff6954` and clipping gives `#ff3d00`, against the shipped `#ff6b08`.
Regenerating neon would repaint every screen in the system to settle a question
that is already settled.

Luminance is not free-floating either. Each stop is solved to a contrast ratio
against `--screen` (10.5 / 7.0 / 5.2 / 3.4), because rotating hue at constant
lightness drops `--emit-50` to 2.79:1 and silently fails the 3:1 non-text gate.
Re-solve, never re-tint.

### Why the ramp is `--emit-*` and not `--amber-*`

`--amber-*` named a hue rather than a ramp, and was already only historically
true — under the default palette the colour is neon, not amber. With a lavender,
a pink and a violet in the file it stopped being defensible at all. The aliases
survive, deprecated, removed in 3.0.

`data-ac-gas="neon"` and `data-ac-gas="amber"` are kept on the same terms. The
name was the bug — "amber" was never a gas, it is a CRT phosphor, and calling it
one is exactly the confusion the two attributes exist to prevent.

### Scattering — why `--gas-scatter` differs per palette

Rayleigh scattering goes as λ⁻⁴, so a violet gas throws far more of itself
sideways into the glass than neon's orange-red does. Neon is 1.00 by definition —
every other palette's figure is stated against it — and `--gas-spread` is its
square root, because multiple scattering widens the halo as it brightens it.

P3's figure was a placeholder held at neon's 1.00, with a note predicting that a
phosphor this close to neon's mean wavelength "would land near 1.00 regardless".
`scripts/lib/cie.mjs` grew the band model in the CRT pass, the integral ran, and
it lands at **1.23** — the prediction was the reasonable guess and it was still a
guess. Only the halo width was ever a placeholder, and only the halo width
changed; the ramp stays hand-built.

### The phosphors carry a weaker claim than the gases

It is not hedging to say so. A gas emits lines and NIST publishes them, so those
palettes run spectrum → colour from measured data. No comparable public table of
phosphor band *shapes* exists; what is published is the resulting chromaticity.
So the phosphor blocks run backwards — published colour → band — and their bands
are back-solved rather than measured. The `$phosphors` block in
`scripts/data/emitters.json` states that plainly, along with the four things that
are nonetheless non-circular about the result. Read it before quoting a number
from `colors.css` as though it came off an instrument.

### A palette may carry time

Where an emitter has a documented decay, its block declares `--ac-persist`,
`--ac-flicker`, `--ac-decay-ease` and (on a two-layer phosphor) `--ac-persist-fast`.

Those are not four independent settings. `--ac-persist` and `--ac-flicker` are
one physical quantity read in two directions — what is left of a frame when the
next one arrives *is* the persistence, and what is missing *is* the flicker — so a
phosphor cannot have much of one without little of the other.
`scripts/derive-gas.mjs` computes both from one decay constant for exactly that
reason, the same way `--gas-spread` is the square root of `--gas-scatter`.

**The four gases deliberately declare none of them.** Gas afterglow is real, but
no decay figure for these panels is cited, and inventing one to fill the column
would be exactly the kind of number this system exists to refuse. `effects.css`
keeps its own `:root` defaults, every gas falls back to them, and the plasma
palettes render byte-identically to what they did before the phosphors arrived.
Adding a *cited* decay to a gas is what would opt it in.

### P7 — the one palette whose halo is not its ink

P7 is a blue ZnS:Ag layer facing the beam over a yellow-green (Zn,Cd)S:Cu layer
behind it. The beam writes in blue, the blue layer's own photons pump the layer
underneath, and what the **screen holds** is yellow-green. So `--emit-*` is the
flash (x=0.1384 y=0.1502) and `--gas-*` is the afterglow (x=0.3553 y=0.5373).

Blue text inside a green halo is not a mismatch — it is the only thing that
palette can honestly look like, and it is the reason P7 exists as a part number.

---

## tokens/effects.css

### The drive tiers are arithmetic, not taste

Each stop's luminance is already fixed by the contrast ratio it was solved to —
Y = ratio × (Y_screen + 0.05) − 0.05, with the panel at Y=0.00278 — so the ratios
between them fall out:

| token | stop | ratio | Y | drive |
|---|---|---|---|---|
| `--ink`, `--stroke` | emit-90 | 7.00:1 | 0.3195 | 1.00 |
| `--ink-dim` | emit-70 | 5.20:1 | 0.2245 | 0.70 |
| `--ink-faint`, `--stroke-dim` | emit-50 | 3.40:1 | 0.1295 | 0.41 |
| `--ink-trace` | emit-30 | 1.63:1 | 0.0360 | 0.11 → none |

`--emit-30` landing at eleven percent is why the decorative rules stay flat: that
is not a halo, it is a rounding error.

Note the token families **do not line up**, and the names actively mislead:
`--ink-dim` is emit-70 but `--stroke-dim` is emit-50. The tier is chosen by drive
level, never by whether the token has "dim" in its name.

**Radius does not scale — only alpha.** How far light spreads through the glass is
a property of the glass and the wavelength (`--gas-spread`), not of how hard the
cell behind it is driven. Scaling radius too would say a dim cell's light travels
less far, which is not a thing that happens. The 2px layer is not scaled at all:
it is the glyph's own lit edge, not scattered light.

### Why the tiers are three tokens and not one multiplier

The tidy version is a single `--ac-drive` that every alpha multiplies by, so a
dim element sets the number and re-states `text-shadow: var(--glow-text)`. **It
does not work, and it fails silently.**

A custom property's `var()` references are substituted when that property's own
value is computed — at `:root`, where these are declared. So `--ac-drive` is
resolved to 1 there and baked in, and what descendants inherit is a finished
shadow list with no variable left in it. Setting `--ac-drive` further down changes
nothing at all: every tier renders at full strength and looks like the feature is
working.

So each tier is its own fully-resolved token. The multiplier stays visible in the
`calc()` rather than being folded into a literal, which keeps the derivation
checkable without making the value depend on where it is read.

A separate box tier exists because the stroke is not always driven as hard as the
ink: an `.ac-input` carries `--ink-bright` text inside a `--stroke-dim` box, and
`.ac-statusbar--line` is full-drive text between two dim rules — one element, two
drive levels, which a single scale could not have expressed either.

### The halo is inherited, not requested

Glow is light scattered in the glass, and the glass has no idea which component a
lit cell belongs to. So it is applied once at the frame and inherits, rather than
being opted into per component.

That direction matters more than it looks. Glow used to be opt-in, and after
twenty-odd components each remembering to ask for it, **thirty-four elements were
still rendering flat**: every table cell, every toggle label, all eighty-eight
inline `<code>` spans in the guide, and an alarm banner that blinked without a
halo. None of that was decided; it was just never added. Inheriting inverts the
failure: a new component glows because it is lit, instead of not glowing because
nobody remembered.

Two things must then suppress it, and both are enumerable:

- `--ink-dim` / `--ink-faint` — glow is the signal of energization, so a disabled
  control that glows is a lie about the hardware.
- inverse video — dark text on a lit block is the **unlit** part of the block.
  Unlit cells do not scatter.

`scripts/check-prohibitions.mjs` enforces the first, because that is the half that
drifts.

`text-shadow` and custom properties interact in a way worth knowing:
`var(--glow-text)` is resolved at the frame, and the resulting shadow list is what
inherits. A descendant that sets its own `--glow-text` does not change what it
inherited; only `text-shadow: none` does. That is why suppression is written as
`text-shadow: none` everywhere and never as a token override.

### The extruded key edge

The one shadow in the file that is **not** a halo, so it takes neither
`--gas-spread` nor `--gas-scatter`: those describe light scattering through glass,
and this is geometry. A panel that drew a drop shadow drew it in **cells**, and a
cell is the same size on krypton as on neon — the extrusion must stay put when the
gas changes, while its colour follows `--gas-1` so it cannot end up the only amber
thing on a green screen.

**It is an edge, not a ghost**, which is what the two layers are for. An outer
box-shadow is clipped to outside the border box, so a single hard offset copy of
the box paints a solid band down the bottom and right — not a floating duplicate.
Two of them at different offsets make that band read as depth: a bright 2px lip
against the stroke, then 3px more at lower drive falling away from it. One uniform
layer looked like a thick border; a blurred one looked like a modern card shadow,
which is the whole thing this is not.

The alphas are set against the bloom rather than the screen. The band lands in
exactly the region `--glow-box` is already lighting, and `.ac-bloom` amplifies that
halo — anything under about 0.6 on the lip washed out into it and read as the
stroke being slightly heavy.

**The pressed variant is a second shadow, not a transform.** `translate: 4px 4px`
looks right and moves nothing around it, but it *does* contribute to scrollable
overflow — so every latched key sitting flush against its container pushed 4px past
it, which the visual suite caught on two pages at every width (an `.ac-grow` pad in
a row, and the Ent key in the keypad grid). A box-shadow is ink overflow and
contributes nothing, in either direction.

### The persistence caps

P7's tail is 3000ms and P39's is 2000ms. Those are correct, and a dialog that
stays painted for two seconds after it closes is not a simulation, it is a bug
that can cite a source. So:

| token | drives | cap |
|---|---|---|
| `--ac-decay` | things that must actually leave — `[hidden]`, a closing dialog | 250ms |
| `--ac-decay-fast` | de-energizing controls, hover release | 60ms |
| `--ac-persist-tail` | ghosts, residual patches | **uncapped** |

`--ac-decay-fast` is capped hard because it fires on every control the pointer
crosses; at the full decay a sweep across a dense panel leaves a wake behind the
cursor.

`--ac-persist-tail` is where the long phosphors are actually allowed to be long,
which is also where the effect lives. Nothing waits on a ghost.

`min()` also gets the short phosphors right in the other direction and for free:
P11 declares 0.035ms, so its UI snaps rather than decaying — exactly what a
photographic-recording phosphor did, and exactly why nobody enjoyed looking at one.

The defaults for palettes that declare nothing (all four gases) are deliberately
near the floor of what registers as a decay at all: much under ~80ms and the eye
stops reading a relaxation and starts reading a switch. The effect should be felt
rather than seen.

### The cell matrix alpha is a budget

Two crossed 1px wires on a pitch p lose a mean 1 − (1 − a/3)² of everything under
them, and `--ac-mesh-wire: 0.075` is the value that lands that at 0.050 — exactly
the mean loss of the CRT scanlines it sits beside, so turning plasma on costs the
same legibility the tube already does. Crossings land at 0.144, near enough to
double, which is what makes an intersection read as an intersection.

`scripts/contrast.mjs` computes from `colors.css` and cannot see an overlay, so
nothing will fail if this is raised. Redo the arithmetic first.

### The screen door

A cell lights at the intersection of a row wire and a column wire, boxed in on
four sides by barrier ribs that carry no discharge and emit nothing. So a lit
pixel is a neon dot trapped in a square aperture, and a **crossed mesh** — not a
stack of horizontal lines — is what you see with your eye close to the glass. The
dark horizontal blanking gaps between raster lines belong to `.ac-crt` and the tube
it simulates; there is no scan here, so there is nothing to blank.

The ribs are pure black rather than tinted, and that is the whole trick: over the
unlit panel (`--screen` is a near-black under every palette) black alpha has
nothing to take away and the mesh is simply not there, while over lit cells it
occludes. The grid appears only where the panel is lit, which is exactly the
behaviour of a real screen door and costs nothing to get.

`z-index: 48` puts it **above** the bleed, which is upside down physically — the
ribs sit behind the front glass, so the bleed ought to soften them. It is worth
the inaccuracy: `.ac-bloom::before` is a viewport-sized `backdrop-filter`, this
layer jitters ~24 times a second, and anything inside that filter's backdrop drags
a full-screen re-blur along on every one of those frames. Above the bleed the mesh
is compositor-only, costs nothing, and stays sharp.

It is a **child node**, not `.ac-bloom::after`. An element has exactly one
`::after`, and `.ac-crt::after` — equal specificity, later in the file — already
owns it for the scanlines. A mesh declared there is silently replaced the moment
both simulations are on, which is the default.

### The plasma shimmer, and why the periods are coprime

The sustain voltage is AC, so the gas is never held — it is struck, and struck
again, tens of thousands of times a second. None of that is visible directly; what
is visible is the residue, a microscopic buzz that reads as the panel being
energized rather than merely bright.

Two animations because it is two phenomena, and **detuned** because that is the
only thing standing between a buzz and a pulse. 0.29 and 0.37 are coprime, so the
pair does not repeat for 10.7s, and neither divides into `ac-crt-hum` (5.5s),
`ac-bloom-breathe` (9s), `ac-crt-drift` (11s) or `ac-retrace` (13s). Retune them
and all four of those relationships have to survive, or the whole panel finds a
beat and starts throbbing.

`steps(1, end)` on the buzz so each position is held and then jumped, never
interpolated: a wire that eases between two places is a wobble, and a wobble is a
much bigger, much worse effect. The 0.35px ceiling is what keeps the wires reading
as sharp — past about half a pixel the resampling turns the mesh grey and the
screen door is gone.

### CRT flicker — what cannot be rendered, and what can

**The actual flicker of a CRT cannot be rendered here, ever.** A tube refreshing at
60Hz is being watched on a display refreshing at 60Hz; there is no headroom to show
a 60Hz modulation, and asking for one is asking to sample a signal at its own
frequency. That is Nyquist, not a browser limitation. The same refusal is
documented in `scripts/derive-gas.mjs` for the eye's chromatic aberration: the
effect is real, and using it here would not be.

What *is* renderable is the perceptual signature — the slow beat, the sense of an
image being re-struck rather than held. So the frequency is fixed and slow, and
only the **amplitude** answers to the hardware, via `--ac-flicker`:

| phosphor | `--ac-flicker` | reading |
|---|---|---|
| P11, P31, P4 | 1.000 | fully dark between frames; maximum unsteadiness |
| P1, P3 | ~0.79 | medium persistence, visibly less settled |
| P7, P39 | 0.091 | rock steady at any refresh rate, paid for in smear |

Both halves of that trade come from one number.

### The two flash budgets

Both are WCAG 2.3.1 arithmetic, not taste. The rule prohibits more than 3
flashes/sec above 10% relative luminance over more than 25% of the field, and the
3–8Hz band is the most seizure-provocative there is.

- **`ac-crt-hum`** runs at 0.18Hz — a 5.5s cycle, more than an order of magnitude
  below the threshold frequency — and its deepest dip is 3.5% of the opacity of an
  overlay whose own mean darkening is about 15%, so worst-case panel luminance
  moves by well under 1%.
- **`ac-mesh-hum`** is a 1.8% swing on a layer whose own mean darkening is 5%,
  moving panel luminance by about 0.09% — three orders below the threshold.

Both margins are large on purpose. Raising either constant spends them; redo the
arithmetic first.

At `--ac-flicker: 1` the two hum stops resolve to 0.965 and 0.985, which is what
the keyframe was before it took a variable — so a gas palette, which declares no
flicker, renders identically.

### Persistence is three phenomena

Only one of them is expressible without JavaScript:

1. **Decay-out.** Anything that disappears relaxes instead of switching off. Pure
   CSS. This is the one that carries the effect on its own.
2. **Ghosting.** Text that is rewritten leaves the previous value behind for a
   beat. Needs the old value, which only JS has. Degrades to (1) and (3) without it.
3. **Residual patches.** The glass never sits perfectly uniform; charge relaxes
   unevenly and slowly. Pure CSS.

**Note the direction: this decays out and never in.** Nothing fades a thing into
existence. A cell lights on the next refresh — instantly — and it is only the
switching off that hardware cannot do sharply. That asymmetry is the whole reason
this file may hold a `transition` at all while `src/components/` may not.

The mechanism throughout: transition properties are read from the *after-change*
style, so declaring them only on the hidden/unlit half means hiding decays and
showing snaps back instantly.

### Residual patches drift by background-position, not transform

A box larger than its parent adds scrollable overflow, and the frame is exactly
where a stray 288px of it would go unnoticed. A background cannot overflow
anything.

### The blink off-edge

A blinking alarm is the most visible thing on the panel that stops being driven,
over and over, once a second — so it is the last place the decay should be missing.

Keyframe stops cannot read a custom property, so the window is a percentage of
whatever cycle it lands in rather than a duration: 54%→62% is ~88ms at 1.1s and
~80ms on the cursor's 1s. Retuning `--ac-decay` does not move it.

The stops are spread wider than a literal decay curve would be. A true exponential
loses most of its light in the first ~80ms, which is close enough to the
flicker-fusion threshold that the eye files it as a hard switch — the decay
measures correctly and still looks instant. Swapping animation-**name** rather than
the shorthand is what lets one rule cover every blink site while each keeps its own
duration.

**The long-phosphor variant bottoms out at 0.34, not 0.1.** That *is* the effect:
the floor of a long phosphor's blink is lifted because the cell never fully relaxes
between strikes, and the alarm reads as a throb rather than a chop. It is selected
by the palette via `--ac-blink-anim`, not by `effects.css`.

### The afterimage — why a registered number and not a box-shadow transition

Interpolating `box-shadow` directly works — a `none` is padded with transparent
shadows, so it does animate — but the halo would have to be declared on every one
of those selectors, which means overwriting whatever `box-shadow` the component
itself uses for its border glow and its focus ring. `--ac-lit` is a number; the
components keep their own shadows, and `effects.css` adds a layer that reads it.
One variable drives the afterimage's alpha and its halo radius together, so the two
cannot disagree about how lit the thing is.

It is registered with `inherits: true`, and that is stated rather than left at the
tidier default: a pseudo-element does not read its originating element's
non-inherited properties, so with `inherits: false` the halo resolved to alpha 0 at
every drive level — which looks exactly like the effect being off.

**Hover is deliberately not in the lit list.** A pointer crossing a dense panel
de-energizes every control it touches, and at a 2s tail that leaves a wake of
glowing boxes behind the cursor — which reads as lag, not as phosphor. The
afterimage answers only to real state: filled, pressed, selected, current, checked.

**No `mix-blend-mode` on the afterimage**, though the ghosts and patches both use
it. `screen` is the physically right blend for emitted light and it was the first
thing tried, but a blended element forces its own compositing group, and that
regressed text antialiasing on every button and tab on the page — ~1.1% of pixels
moved on a capture where the effect was switched off entirely. Pure cost, no
effect, and it would have shipped invisible. It is also unnecessary: the panel
behind these controls is a near-black, over which `screen` and ordinary alpha
compositing of a bright halo differ by almost nothing. The ghosts keep their blend
because they land on top of lit text, where the difference is real.

**No background on it either**, and that is not an omission. A filled control is
inverse video — dark text on a lit block — and `--ac-lit` sits at 1 for as long as
it is lit, so any fill declared there would paint over that text permanently, not
just during the decay. A transparent box with an outer box-shadow paints only
outside the border box.

The layer is a short list for a mechanical reason: an element has exactly one
`::after`, and four components have already spent theirs (`.ac-toggle` thumb,
`.ac-banner` ornaments, `.ac-select` chevron, `.ac-spinner`). `.ac-check` and
`.ac-radio` light the `<input>` itself, and a replaced element renders no
pseudo-element at all.

### The lagging bar

A meter changes none of the things the other decays handle: the element stays, its
text is elsewhere, its colour never moves. What changes is its **width** — so the
region it vacates was lit a moment ago and is now simply not drawn, with nothing
timing the difference.

The ghost is a second bar that lags, and the asymmetry falls out of paint order
rather than needing a rule of its own. Both bars read the same
`--ac-meter-value`; the live one snaps to it and the ghost takes
`--ac-persist-tail` to get there. On a **decrease** the ghost is wider than the bar
for a moment, and the strip between them is the vacated region, draining. On an
**increase** the ghost is narrower, so it sits entirely underneath the live bar and
is invisible. Instant up, curve down, for free.

A bar falling *gradually* stops driving each cell at a slightly different moment,
so the honest result is a taper behind a receding edge — which is exactly this. A
bar that drops *suddenly* stops every vacated cell at once and should fade
uniformly instead. CSS cannot hold the old width, so it cannot tell those apart;
`amber-console.effects.js` recovers the old geometry for that case. This is the
half that works with no JavaScript at all.

The bar's **width** is deliberately not in the de-energizing transition list — that
is the live edge and must stay instant; only its colour and halo relax.

### Scroll smear

Scrolling is the largest light-off event there is: every cell on the panel is
handed a new value at once.

Two details are load-bearing. It is `fixed`, so the cost is one viewport rather
than one document (the guide page is 15,000px tall). And the visible half filters
the **content**, not the backdrop — an additive copy of the backdrop cannot do it,
no matter how hard it is blurred, because `screen` leaves the live text perfectly
sharp underneath and you get a halo instead of a smear. Displacing that copy does
not rescue it either: a filtered backdrop is sampled in the element's own
transformed space, so translating the layer slides the window over the backdrop
rather than moving the image.

Only the frame's real children are filtered, never the overlay nodes. The scanline
mask, the vignette and the cell mesh are the glass, not the image — the glass does
not go out of focus when the picture moves. `.ac-nav--sticky` is excluded from the
other direction: it is pinned to the viewport, so while the page scrolls it is the
one element whose pixels are *not* being handed a new value. Nothing about it
moved, so nothing about it smears.

The blur is isotropic, and a real smear is not — it runs along the axis of travel.
`filter: blur()` has no directional form; the honest one is an inline SVG
`feGaussianBlur` with `stdDeviation="0 N"` referenced through `filter: url()`, and
that costs every page an SVG node in its markup. Every other effect here is one
class and at most one span, and that contract is worth more than the axis.

### Ghosts

Invisible until the animation drives them. A ghost is only ever legible mid-decay,
so if animations are off — a screenshot harness, a print, a browser that never ran
the keyframes — the right thing to show is nothing at all, not an opaque duplicate
of live text sitting on top of it.

`.ac-ghost--fast` is capped at 400ms even under a long phosphor, and the cap is
arithmetic rather than taste: a field rewriting once a second under P7's 3000ms
tail would stack three generations of ghost on top of each other, and the third one
is not persistence, it is a pile.

**The P7 cascade.** What a ghost shows on a two-coating phosphor is not one colour
fading but two in sequence: the flash, gone within a frame, and then the afterglow
for as long as it lasts. 4% is the crossover, hardcoded because keyframe offsets
cannot read a custom property. At P7's 3000ms tail that is 120ms — a shade longer
than the real flash, which is nearer one frame, because a literal single-frame step
reads as a glitch rather than as a flash. The colour is *animated* rather than set,
so it beats the inline `color` that `amber-console.js` copies onto the clone.

### The page itself decays

Everything else decays an **element**: something the cascade can name and time. A
phosphor does not work that way — it decays whatever was drawn, including the
middle of a glyph and the part of the screen nothing owns. The View Transition API
is the one browser primitive that hands us that: the old page as an image, which is
exactly what a coating full of excited electrons is.

The direction rule survives intact and is the whole reason it reads as phosphor
rather than as a crossfade: the old snapshot decays on the emitter's own sampled
curve, and the new page gets `animation: none` so it is simply *there* on the first
frame. A default view transition cross-fades both halves, which is a slideshow.

**The at-rule is not shipped, deliberately — the one opt-in in the framework.**
`@view-transition { navigation: auto; }` cannot be scoped to a selector; it is a
document-level switch, so shipping it would change how navigation behaves for every
consumer who links the stylesheet, including ones who never asked for a screen
simulation. Linking a stylesheet must not rewrite how a site navigates.

Capped at 900ms separately from `--ac-persist-tail`, and for a harder reason than
taste: the transition overlay sits above the document while it runs, so a 3000ms P7
tail would mean three seconds of a page that cannot be clicked.

### The glass is the viewport, not the document

Every overlay is positioned against the frame, and on a full-screen frame the frame
is the whole document — 15,105px on the system guide. That is wrong twice over.

*Physically:* the bleed, the scanline mask, the vignette and the retrace are all
properties of the glass. Glass does not scroll. A vignette anchored to the document
darkens the top and bottom of the **page** instead of the edges of the **screen**,
which is not an effect any hardware has.

*Practically:* it banded. A `backdrop-filter` stretched over a document-height layer
is rasterised in tiles, and the tile seams show up as static horizontal and vertical
steps across the background. The enormous mask and vignette gradients quantise into
visible steps for the same reason, 8-bit alpha spread over thousands of pixels.

Anchoring to the viewport fixes the look, the physics and the cost. Scoped to
`.ac-screen` on purpose: `.ac-bloom` and `.ac-crt` also go on small tiles (the guide
documents itself with them), and those must stay local to the tile. `.ac-persist`
stays document-absolute — ghosts are pinned to the rect their source occupied, which
is a document coordinate.

### The z-index stack

Every overlay is absolutely positioned to the frame, so the order they paint in is
the whole design. It has to be stated in one place, because a sticky bar carrying
its own z-index will otherwise punch straight through the simulations — which is
exactly what `.ac-nav--sticky` (z-index 20) used to do.

| z | layer |
|---|---|
| 1 | frame content |
| 20 | sticky chrome — `.ac-nav--sticky` |
| 40 | `.ac-bloom::before` — plasma bleed |
| 45 | `.ac-retrace` — CRT retrace band |
| 45 | `.ac-persist` — afterglow ghosts and residual patches |
| 48 | `.ac-mesh` — plasma cell mesh |
| 50 | `.ac-crt::after` — scanlines and vignette |

Everything from 40 up is above the sticky bar on purpose: a screen simulation that
stops at the edge of the menu bar is not simulating a screen.

### Why blink is a style flag, not a simulation

Blink is law-2 emphasis and it is also the single most tiring thing on the panel,
so it is switchable independently of which hardware is being simulated — every
display technology blinks, and turning it off says nothing about any of them.

Off settles **lit**, not dark: the keyframe's dark half is 0.1 opacity, and a blink
stopped there is an element that has silently vanished. This is the same resting
state `prefers-reduced-motion` lands on, deliberately. Once blink is off, the
inverse fill and the ✳✳ glyphs are what carry an alarm.

### The specificity restatement problem

Every blink site has an `.ac-afterglow`-scoped decay variant, which is a descendant
selector and therefore outranks a bare `.ac-blink { animation: none }` on
specificity alone. Matching only the plain form switches blink off on a bare panel
and leaves it running the moment the CRT simulation is on — which is precisely the
panel a user reaching for that switch is looking at.

The same trap catches `prefers-reduced-motion` (a media query adds no specificity,
so `.ac-mesh` at 0,1,0 loses to `.ac-bloom > .ac-mesh` at 0,2,0), forced colors, and
print. It is why the same selector lists are restated in four files.

A blanket cannot serve for `animation` the way it does for `transition`:
`animation: none` on `*` would take the bloom, the retrace and the mesh buzz with
it, and none of those is a blink.

> **Known cost.** Adding a blink site means editing `effects.css` twice, `print.css`
> and `a11y.css`. This is tracked as a real maintenance defect, not a design
> feature — see the review notes on routing blink through a token indirection the
> way `--ac-blink-anim` and `--ac-ghost-anim` already are.

`.ac-mesh` is the one overlay that keeps rendering under reduced motion, and it is
in the animation rule rather than the display rule beside `.ac-retrace`: the screen
door is not an effect playing over the panel, it is the shape of the panel, and
hiding it would change what the hardware *is* in response to a motion preference.
Only the buzz is motion.

---

## components/classic.css

### Why the shape and not a clip

`clip-path` and `mask-image` can cut any corner at all, including a genuine
stair-step, and both were rejected for the same disqualifying reason: **they clip
the element's entire painting, and the outer box-shadow is part of it.** Every
control carries `--glow-box`, which is the discharge halo — glow is the signal of
energization — so a clipped corner buys a stepped edge by deleting the glow off all
four sides. `border-radius` and `corner-shape` change the shadow's shape instead of
removing it. That constraint, not taste, is why the file is written in them.

### Why the two corner paths are different radii

`corner-shape` is Chromium-only at the time of writing, and a look that silently
collapses into the other option in Firefox is not a look. So the fallback is not a
failed bevel: it quantizes the radius to 2px, which is the same statement — a corner
the cell grid can hold — made in a property every engine has had for fifteen years.
The extrusion and the label are identical on both paths, so what Firefox loses is
the chamfer and nothing else.

### The four corners are not the same size

These keys were drawn as solid objects lit from the top left: the top-left corner is
the far one and is barely cut at all, the bottom-right is the near one and is cut
hardest, and the two side corners sit between them. Cut all four the same and the
key goes flat — it reads as an octagon. The gradient runs along the same diagonal the
extrusion is offset on, because they are two halves of one claim about where the
light is.

2 / 4 / 8 / 4 in TL TR BR BL order, and those are the system's own radius steps
rather than new numbers. `--radius-sm` runs the same diagonal at half depth, so a
well or a switch housing is cut like a key and reads as smaller.

### A key is extruded; a panel is a hole in the bezel

The corner belongs to the raster and reaches everything, but a drop shadow claims the
thing stands off the glass, and that is true of a soft key and a switch housing and
of nothing else on the board. Giving `.ac-panel` an edge too was tried and reads as a
floating card, which is a different design language from a control surface.

### The face: label top-left

A soft key on these panels is a label plus room for a value, so the label is parked
in the corner and the body left empty; centring it says the key is a word rather than
a field.

**No `display` in that rule, deliberately.** Setting `inline-flex` would outweigh
`.ac-btn--block`'s `display: block` and `.ac-btn--pad`'s `flex`, and a corner style
that silently unblocks a full-width key is worse than one that does nothing. The three
properties it does set are inert on a non-flex box.

The keypad is exempt: a digit is one character with no label/value split for the
top-left rule to serve, and those keys are centred on purpose.

`text-align` is restated rather than token-driven because a CSS-wide keyword arriving
through `var()` substitution is the one part of this mechanism not worth betting the
alignment on.

### Inert keeps nothing, and it has to be said twice

`button.css` already blanks the halo on a disabled key. But
`[data-ac-style-classic="on"] .ac-btn` weighs the same as `.ac-btn:disabled` and lands
later in the cascade, so the extrusion rule would quietly hand the halo back.
`scripts/check-prohibitions.mjs` cannot catch this one: it gates an ink level set
without its halo, and the extrusion rule sets no colour.

---

## Known inconsistency: the default corner style

`classic.css` describes classic as the default look and the smooth corner as the
opt-out. That is true **only when `amber-console.js` is loaded** — `classic:
{ defaultOn: true }` lives in the JS `STYLES` table, and the
`data-ac-style-classic="on"` attribute it selects on is written to `<html>` by
`applyStyle()` at init.

A CSS-only consumer never gets that attribute, so `--radius` resolves to the `8px`
in `tokens/spacing.css` and they get **rounded** corners — the look the documentation
calls a departure from the panel.

Making the CSS carry its own default (classic at `:root`, rounded under
`.ac-rounded` and `[data-ac-style-classic="off"]`) would close the gap, but it
changes the rendered default for every existing CSS-only consumer, so it is a
release decision rather than a cleanup.

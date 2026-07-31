#!/usr/bin/env node
/**
 * derive-gas.mjs — turn an emission line table into a palette block.
 *
 *   node scripts/derive-gas.mjs            every emitter, as CSS, to stdout
 *   node scripts/derive-gas.mjs neon       one emitter
 *   node scripts/derive-gas.mjs --check    re-derive and diff against colors.css
 *   node scripts/derive-gas.mjs --swatch f write an HTML preview of every ramp
 *
 * The color of a gas is COMPUTED here, never picked, for the same reason
 * scripts/contrast.mjs computes its ratios: a number somebody typed is a number
 * nobody can check. What the emitter radiates decides the hue; what the panel
 * has to stay legible at decides the luminance; and the two are separate
 * decisions that this file keeps separate.
 *
 * HUE FROM THE SPECTRUM, LUMINANCE FROM THE DRIVE LEVEL. That split is the
 * whole method and it is not a compromise, it is how a panel works. Argon really
 * does emit very little visible light — most of its output sits past 700nm where
 * the eye scores under 0.01 — but "argon is dim" is a statement about radiant
 * efficiency, not about what color the cell is. Drive the cell harder and it is
 * still argon. So every stop below is the emitter's own chromaticity, held
 * exactly, at whatever luminance the contrast gate demands.
 *
 * See scripts/data/emitters.json for the line tables, their source, and the
 * per-gas selection rule with its justification.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  linesToXYZ, sampleBands, xyOf, fitToGamut, hexOf, linearOfHex, luminance, contrast, cmf,
} from "./lib/cie.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * A GAS EMITS LINES, A PHOSPHOR EMITS A BAND, AND NOTHING BELOW THIS FUNCTION
 * KNOWS WHICH.
 *
 * Both come back as the same [[nm, intensity], ...] list, so the chromaticity
 * integral, the lambda^-4 scatter, the gamut fit and every contrast-solved stop
 * are literally the same code for a phosphor as for a gas. That is the whole
 * design of the CRT pass: the technology changes what the spectrum IS and
 * changes nothing about what is done with it.
 *
 * `select` applies only to line tables — a band has no lines to exclude, and the
 * argument for excluding argon's 2p->1s array is an argument about radiation
 * trapping in a low-pressure glow, which is not a thing that happens in a powder.
 */
function spectrumOf(spec) {
  if (spec.bands) return sampleBands(spec.bands);
  const sel = spec.select ?? {};
  return spec.lines.filter(
    ([nm]) => nm >= (sel.minNm ?? 0) && nm <= (sel.maxNm ?? Infinity)
  );
}

/**
 * PERSISTENCE AND FLICKER ARE ONE NUMBER READ IN TWO DIRECTIONS.
 *
 * This is the single physical fact the CRT pass is built on, and it is worth
 * stating before the four lines that implement it, because it is the reason the
 * phosphors are not a set of taste knobs.
 *
 * A phosphor has a decay constant. A tube redraws every frame. What is left of
 * the previous frame when the next one arrives is:
 *
 *     residual = exp(-t_frame / tau)
 *
 * and that ONE quantity is both effects at once. What remains is persistence —
 * the smear. What is missing is modulation depth — the flicker. A phosphor
 * cannot have a lot of one without having little of the other, and every
 * historical fitting decision follows from the trade:
 *
 *   P11  tau ~ 15us   residual ~0     no persistence at all, flicker at maximum.
 *                                     Fitted to tubes meant to be PHOTOGRAPHED.
 *   P39  tau ~ 174ms  residual 0.91   no visible flicker at any refresh rate,
 *                                     paid for in smear. Fitted to radar.
 *
 * So both tokens come off `to10` and cannot disagree, exactly as --ac-halo-spread is
 * the square root of --ac-halo-scatter and cannot disagree with it.
 *
 * `to10` is time to 10% of peak, which is what data sheets quote. For a simple
 * exponential that is tau*ln(10); for the long-persistence power-law phosphors
 * it is not, but the exponential tau is still the right thing to compare against
 * a frame interval — the deviation is all in the tail, and the tail is by
 * definition the part that is still there next frame either way.
 */
const FRAME_MS = 1000 / 60;

function persistence(decay) {
  const tau = decay.to10 / Math.LN10;
  const residual = Math.exp(-FRAME_MS / tau);
  return {
    tau,
    residual,
    /* 0 = perfectly steady, 1 = fully dark between frames. A RAW PHYSICAL
       FIGURE, deliberately not pre-scaled: tokens/effects.css owns the amplitude
       budget that keeps this under the WCAG 2.3.1 flash threshold, and it owns
       it in ONE place. A number clamped here as well would be clamped twice and
       auditable in neither. */
    modulation: 1 - residual,
  };
}

/**
 * The decay curve, sampled into a CSS linear() easing.
 *
 * A long-persistence phosphor does not decay exponentially — it follows a
 * Becquerel power law, I = I0/(1 + t/t0)^n, which is a fast knee over a very
 * long tail. No single cubic-bezier expresses that shape, and approximating it
 * with one is why long-persistence CSS imitations look like fades rather than
 * like phosphor. linear() takes an arbitrary sampled curve, so the honest move
 * is to sample the actual model.
 *
 * Emitted as PROGRESS, not as intensity: a timing function drives a transition
 * from lit to unlit, so progress = 1 - I(t), normalized to reach exactly 1 at
 * the end of the run or the property never finishes arriving.
 */
function decayEasing(decay, durationMs, stops = 10) {
  const intensity =
    decay.model === "becquerel"
      ? (() => {
          const n = decay.n ?? 1.5;
          const t0 = decay.to10 / (10 ** (1 / n) - 1);
          return (t) => 1 / (1 + t / t0) ** n;
        })()
      : (() => {
          const tau = decay.to10 / Math.LN10;
          return (t) => Math.exp(-t / tau);
        })();

  const end = intensity(durationMs);
  const norm = 1 - end;
  const out = ["0"];

  /* SAMPLED ON A LOG GRID, NOT A UNIFORM ONE, and for a long-persistence
     phosphor that is the difference between a curve and a straight line with a
     corner on it. A power-law decay puts essentially all of its shape in the
     first few percent of its run — P7 is 87% faded 300ms into a 3000ms tail —
     so uniform stops spend nine samples describing the crawl and one describing
     the knee, which is the only part anybody sees. Geometric spacing from half a
     percent puts the resolution where the curvature is. */
  const first = 0.005;
  for (let i = 0; i < stops; i++) {
    const pct = first * (1 / first) ** (i / (stops - 1));
    const progress = (1 - intensity(pct * durationMs)) / norm;
    /* The loop's last step lands exactly on 1.0 by construction, so the curve
       already terminates at 100% and no closing stop is appended — an extra
       trailing `1` would be a second stop at the same position. */
    out.push(`${progress.toFixed(3)} ${(pct * 100).toFixed(pct < 0.1 ? 1 : 0)}%`);
  }

  return `linear(${out.join(", ")})`;
}

/**
 * The five discharge stops, as contrast ratios against that palette's --ac-screen.
 *
 * These are the ratios the shipped neon palette was solved to, and they are the
 * contract: --ac-ink at 7:1 and --ac-ink-dim at 5.2:1 clear WCAG 1.4.3's 4.5:1 for
 * text, --ac-ink-faint at 3.4:1 clears 1.4.11's 3:1 for the borders that use it,
 * and --*-30 is decorative. Solve to the ratio, never re-tint to taste —
 * rotating hue at constant lightness is what silently drops a stop under the
 * gate, and it is why this file exists.
 */
const STOPS = [
  ["100", 10.5, "hot highlight / focus"],
  ["90", 7.0, "primary discharge"],
  ["70", 5.2, "secondary"],
  ["50", 3.4, "dim / disabled"],
  ["30", 1.63, "trace / ghost, decorative"],
];

/**
 * The unlit panel, as luminances rather than colors.
 *
 * Taken from the shipped neon surfaces (#100600 / #1b0c02 / #060200) so every
 * palette sits at the same depth, and tinted to its own gas: dark glass in front
 * of an argon cell does not glow warm. The tint is deliberately weak — a lit
 * cell is the emitter, an unlit one is mostly just glass.
 */
const SURFACES = [
  ["screen", 0.00278, 0.55],
  ["screen-raised", 0.00713, 0.55],
  ["screen-well", 0.00126, 0.55],
];

/** Four points on the discharge hue, for the glow layers in effects.css. */
const GLOWS = [
  ["gas-1", 0.62, 0.10], ["gas-2", 0.55, 0.04],
  ["gas-3", 0.48, 0.00], ["gas-4", 0.74, 0.24],
];

/**
 * HOW FAR A GLOW STOP MAY DRIFT FROM THE HUE IT IS SUPPOSED TO BE, in CIE xy.
 *
 * The luminances above are ambitious on purpose — a halo should be bright — but
 * a deeply saturated emitter cannot BE bright inside sRGB, and fitToGamut's job
 * when that happens is to walk the color toward D65 until it fits. For most
 * emitters that walk is a few thousandths and invisible. For the two most
 * out-of-gamut ones it was not:
 *
 *   p11    halo landed 0.1025 from its own ink
 *   argon  halo landed 0.0916 from its own ink
 *
 * Both are deep blues, and walking a deep blue toward D65 adds red and green —
 * so the halo read visibly WARMER than the text it was supposed to be scattered
 * from. That is the bug this constant fixes, and it was reported as "the glow
 * has a yellowish tint different from the main color", which is exactly right.
 *
 * It was also a quiet contradiction of the rule at the top of colors.css —
 * "chromaticity is derived from the emitter's spectrum and never adjusted" —
 * since these triples were being adjusted by up to 0.10 without saying so.
 *
 * So luminance now yields to hue rather than the other way round: solveGlow
 * below keeps the stated Y where it fits and dims it where it does not. A halo
 * is composited at low alpha over a near-black panel, so a darker but correctly
 * hued triple reads as MORE of the emitter's color, not less.
 *
 * NOT A CAP ON P7. P7's halo sits 0.35 from its ink and must keep doing so: that
 * divergence is two different coatings, measured from two different spectra, and
 * has nothing to do with gamut mapping. The tolerance below is applied between a
 * stop and ITS OWN target chromaticity, which for P7 is the afterglow layer.
 */
const GLOW_SLACK = 0.05;

/**
 * The brightest luminance at which the halo desaturates no more than the ink.
 *
 * THE CRITERION IS THE INK, NOT THE SPECTRUM, and getting that wrong is worth
 * recording because the obvious version does not work. Holding a glow stop
 * within some xy distance of the EMITTER's chromaticity is unachievable at any
 * luminance for most of this catalog: a chromaticity outside the sRGB triangle
 * has a negative channel at every luminance, so gamut mapping has to walk it
 * toward D65 no matter how dim it gets. Solving for that tolerance drives Y to
 * zero and blacks out the halo — which is what it did on the first attempt, for
 * eight of eleven palettes.
 *
 * What IS luminance-dependent is the SECOND half of the walk: the part that
 * fixes a channel overflowing 1. That is why --ac-halo-1 at Y=0.62 came out visibly
 * paler than --ac-emit-90 at Y=0.32 even though both start from the same
 * chromaticity — and that difference, not the absolute saturation, is the defect
 * somebody actually sees. A halo is scattered light from the stroke; it must
 * read as the same color as the stroke. Whether that shared color is as
 * saturated as the gas really is, is a separate question this file already
 * answers elsewhere and answers honestly.
 *
 * So the target is the ink's own mix fraction, plus a little slack, and it is
 * always satisfiable: the glow sits at a lower luminance than the stop it is
 * being compared to whenever it needs to.
 */
function solveGlow(x, y, targetY, maxMix) {
  const at = (Y) => fitToGamut(x, y, Y);

  const full = at(targetY);
  if (full.mixed <= maxMix) return { fit: full, Y: targetY, dimmed: 0 };

  /* Largest Y whose mix stays within budget. Mix falls monotonically with Y
     once the overflow half of the walk is gone, so a bisection is safe. */
  let lo = 0;
  let hi = targetY;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid).mixed <= maxMix) lo = mid;
    else hi = mid;
  }

  return { fit: at(lo), Y: lo, dimmed: 1 - lo / targetY };
}

/**
 * HOW MUCH OF THIS GAS'S LIGHT ENDS UP IN THE HALO RATHER THAN THE STROKE.
 *
 * Rayleigh scattering goes as lambda^-4, so a violet gas throws far more of
 * itself sideways into the glass than a red one does. Neon is the reference at
 * 1.00; argon comes out near 1.5, which is a real difference and a visible one.
 *
 * Weighted by I(lambda)*V(lambda) — what the EYE receives — not by raw radiant
 * intensity, because a halo nobody can see is not a halo. And it is the mean of
 * lambda^-4 rather than lambda^-4 of the mean wavelength: those are not the same
 * number for a spread spectrum, and the second one is wrong. Luminance-weighting
 * a mean wavelength drags every gas toward 555nm by construction and reports a
 * difference of 1.4x where the honest figure is larger.
 *
 * NOT MODELED, DELIBERATELY: the eye's own longitudinal chromatic aberration,
 * which really does make violet sources look fuzzier and which ratios out at
 * 2.67x for argon. The absolute difference behind that ratio is 0.126 diopters —
 * about half an arcminute at a 4mm pupil, under one pixel at any normal viewing
 * distance. Scaling a bloom radius by it would inflate a sub-pixel effect into
 * a hundred and fifty pixels of fog. The ratio is real; using it here would not
 * be. Radius instead follows sqrt(scatter), because multiple scattering widens
 * the halo as it brightens it, which keeps both numbers tied to one mechanism.
 */
function scatter(lines) {
  let Y = 0;
  let s = 0;
  for (const [nm, i] of lines) {
    const w = i * cmf(nm)[1];
    Y += w;
    s += w * (555 / nm) ** 4;
  }
  return Y === 0 ? 1 : s / Y;
}

/** Solve the luminance that gives `ratio` against a background luminance. */
const yForRatio = (ratio, bgY) => ratio * (bgY + 0.05) - 0.05;

/** Mix a chromaticity toward D65 by `t`, for the surface and glow tints. */
const toward = ([x, y], t, [wx, wy] = [0.3127, 0.329]) => [x + (wx - x) * t, y + (wy - y) * t];

function derive(name, emitter) {
  const lines = spectrumOf(emitter);
  const [x, y] = xyOf(linesToXYZ(lines));

  /* THE HALO IS NOT ALWAYS THE SAME LIGHT AS THE STROKE.
     tokens/effects.css opens by stating that it is — "the halo is the same
     photons the cell emits, so it tracks the discharge hue exactly" — and that
     is true of every emitter in this file except one. P7 is two coatings: the
     beam writes in ZnS:Ag blue and the screen HOLDS in (Zn,Cd)S:Cu yellow-green,
     so its --ac-emit-* ramp and its --ac-halo-* halo are two different spectra and
     that is the entire point of the part number.
     Everything else falls through with haloLines === lines and is unaffected. */
  const haloLines = emitter.afterglow ? spectrumOf(emitter.afterglow) : lines;
  const [hx, hy] = emitter.afterglow ? xyOf(linesToXYZ(haloLines)) : [x, y];

  const out = {
    name,
    x,
    y,
    hx,
    hy,
    tech: emitter.tech ?? "plasma",
    cascade: Boolean(emitter.afterglow),
    kept: emitter.lines ? lines.length : null,
    total: emitter.lines ? emitter.lines.length : null,
    bands: emitter.bands ?? null,
    tokens: {},
  };
  /* Scatter governs how wide the HALO throws, so it is measured on whatever
     spectrum is actually in the halo — the afterglow layer where there is one. */
  out.rawScatter = scatter(haloLines);

  /* Surfaces first — every ratio below is measured against --ac-screen. */
  for (const [token, Y, tint] of SURFACES) {
    const [sx, sy] = toward([x, y], tint);
    out.tokens[token] = hexOf(fitToGamut(sx, sy, Y).rgb);
  }
  const screenY = luminance(linearOfHex(out.tokens["screen"]));

  for (const [stop, ratio] of STOPS) {
    const fit = fitToGamut(x, y, yForRatio(ratio, screenY));
    out.tokens[`emit-${stop}`] = hexOf(fit.rgb);
    if (stop === "90") out.desat = fit.mixed;
  }

  /* --ac-on-fill is the dark text inside an inverse-video block, so it is solved
     against --ac-fill (which is emit-90), not against the panel. 4.5:1 is the
     floor; we take the darkest tint of the gas that clears it comfortably. */
  const fillY = luminance(linearOfHex(out.tokens["emit-90"]));
  for (let t = 0; t <= 1; t += 0.002) {
    const cand = fitToGamut(...toward([x, y], 0.35), yForRatio(6.0, 0) * t);
    const hex = hexOf(cand.rgb);
    if (contrast(luminance(linearOfHex(hex)), fillY) <= 6.4) {
      out.tokens["on-fill"] = hex;
      break;
    }
  }
  out.onFillRatio = contrast(luminance(linearOfHex(out.tokens["on-fill"])), fillY);

  /* The budget the halo is held to: whatever gamut mapping already did to the
     ink at its own luminance. For a cascade phosphor this is measured on the
     AFTERGLOW spectrum, since that is what the halo is made of — P7's halo has
     to match its yellow-green coating, not its blue flash. */
  const inkY = luminance(linearOfHex(out.tokens["emit-90"]));
  const haloBudget = fitToGamut(hx, hy, inkY).mixed + GLOW_SLACK;

  out.glowDimmed = 0;
  for (const [token, Y, tint] of GLOWS) {
    /* The tint toward D65 is DELIBERATE — a hot core whitens — so it is applied
       first and then defended. Drift is measured against this post-tint target,
       never against the raw emitter, or the intended whitening would look like
       the accidental kind and get solved away. */
    const [gx, gy] = toward([hx, hy], tint);
    /* The budget covers the INVOLUNTARY walk only. The tint is already applied
       above and is exempt — charging it would make --ac-halo-4 dim itself to
       compensate for a whitening it was asked for, which is the opposite of the
       intent. So the residual mix from the tinted point is what is compared. */
    const solved = solveGlow(gx, gy, Y, haloBudget);
    out.glowDimmed = Math.max(out.glowDimmed, solved.dimmed);
    out.tokens[token] = solved.fit.rgb
      .map((u) => Math.round(Math.min(1, Math.max(0, u <= 0.0031308 ? 12.92 * u : 1.055 * u ** (1 / 2.4) - 0.055)) * 255))
      .join(", ");
  }

  /* THE TEMPORAL TOKENS, and they are emitted ONLY where the emitter declares a
     decay. The four gases do not, so their blocks come out byte-identical to
     what they were before the CRT pass existed and the visual baselines still
     pass — tokens/effects.css keeps its own :root defaults as the fallback.
     Adding a `decay` to a gas later is what would opt it in, deliberately. */
  if (emitter.decay) {
    /* WHICH LAYER PERSISTS IS THE ONE THAT PERSISTS. For P7 that is the
       afterglow coating, not the flash: the yellow-green is what is still lit
       when the next frame arrives, so it is what sets both the smear and the
       absence of flicker. The flash gets its own fast token instead. */
    const held = emitter.afterglow?.decay ?? emitter.decay;
    const p = persistence(held);

    /* `tail` where a phosphor has a visible one past the 10% point — the long
       persistence phosphors are still legible well below it, which is what they
       were bought for. Otherwise to10 is the whole visible life. */
    const visible = held.tail ?? held.to10;

    out.persist = { ...p, visible, held };
    out.tokens["ac-persist"] = `${visible}ms`;
    out.tokens["ac-flicker"] = p.modulation.toFixed(3);

    if (emitter.afterglow) out.tokens["ac-persist-fast"] = `${emitter.decay.to10}ms`;

    /* A long phosphor does not blink, it throbs — the next ON edge lands while
       the previous one is still draining, so the alarm never reaches the dark
       half. Keyframe offsets cannot read a custom property, so the shape is a
       second keyframe in tokens/effects.css and the palette points at it. */
    if (held.class === "long") out.tokens["ac-blink-anim"] = "ac-blink-decay-long";

    /* Below a millisecond the decay is three orders under a frame and no easing
       curve is observable — the screen simply snaps, which for P11 and P31 is
       the correct and historically miserable answer. Emitting a linear() there
       would be precision theater. */
    if (visible >= 1) out.tokens["ac-decay-ease"] = decayEasing(held, visible);
  }

  /* A CASCADE PALETTE HAS TO TELL THE EFFECTS LAYER THAT IT IS ONE.
     tokens/effects.css names no palette anywhere — that is the rule that lets a
     consumer ship their own hardware without editing the framework — so P7
     cannot be reached from there by selector. Instead the palette declares the
     decay animation it needs and the flash color that animation starts from,
     and effects.css falls back to the single-hue keyframe for everything else.
     Any future two-layer phosphor works with no edit to the CSS.

     --ac-halo-flash is the FLASH chromaticity at --ac-halo-1's luminance and tint, so
     the ghost's opening frame sits on exactly the same point of the ramp its
     closing frames do and only the hue moves between them. */
  if (emitter.afterglow) {
    out.tokens["ac-ghost-anim"] = "ac-ghost-cascade";
    const [, glowY, glowTint] = GLOWS[0];
    const [fx, fy] = toward([x, y], glowTint);
    out.tokens["gas-flash"] = fitToGamut(fx, fy, glowY).rgb
      .map((u) => Math.round(Math.min(1, Math.max(0, u <= 0.0031308 ? 12.92 * u : 1.055 * u ** (1 / 2.4) - 0.055)) * 255))
      .join(", ");
  }

  return out;
}

function toCSS(d, emitter) {
  const t = d.tokens;
  const isCRT = d.tech === "crt";
  const noun = isCRT ? "phosphor" : "gas";

  const spectrum = d.bands
    ? `${d.bands.length === 1 ? "Band" : `${d.bands.length} bands`} ${d.bands
        .map((b) => `${b.nm}nm FWHM ${b.fwhm}nm${b.weight && b.weight !== 1 ? ` x${b.weight}` : ""}`)
        .join(" + ")}`
    : `CIE 1931 2-deg integral over ${
        d.kept === d.total ? `all ${d.total}` : `${d.kept} of ${d.total}`
      } listed lines`;

  /* The halo note only appears where the halo is a different spectrum from the
     stroke, which is P7 and nothing else. Stated in the generated block rather
     than only in emitters.json, because this is the file somebody reads when
     they wonder why the blue text has a green glow. */
  const cascade = d.cascade
    ? `\n\n     TWO EMITTERS, IN SEQUENCE. --ac-emit-* is the ZnS:Ag FLASH (x=${d.x.toFixed(4)} y=${d.y.toFixed(4)}),
     which is what the beam writes. --ac-halo-* is the (Zn,Cd)S:Cu AFTERGLOW
     (x=${d.hx.toFixed(4)} y=${d.hy.toFixed(4)}), which is what the screen holds after it. The halo
     therefore does NOT track the ink here, which inverts the rule stated at the
     top of tokens/effects.css and is the reason P7 exists as a part number.`
    : "";

  const flash = t["gas-flash"]
    ? `\n\n  /* THE FLASH, as a halo triple. --ac-halo-* above is the AFTERGLOW, which is what
     this screen holds; this is the layer the beam actually writes, and the ghost
     keyframe starts here before crossing to the afterglow within one frame.
     --ac-ghost-anim is how this palette tells tokens/effects.css it decays
     through two hues rather than one, without effects.css naming it. */
  --ac-halo-flash: ${t["gas-flash"]};
  --ac-ghost-anim: ${t["ac-ghost-anim"]};`
    : "";

  const persist = d.persist
    ? `\n\n  /* Persistence: ${d.persist.held.to10}ms to 10%${
        d.persist.held.tail ? `, visible tail to ${d.persist.held.tail}ms` : ""
      } (${d.persist.held.class}).
     ${d.persist.modulation >= 0.999
       ? `Fully dark between frames — flicker at maximum, no persistence to see.`
       : `${(d.persist.residual * 100).toFixed(0)}% still lit when the next frame arrives.`}
     --ac-flicker is the inter-frame modulation depth these two share; the
     amplitude budget that keeps it under the WCAG flash threshold is in
     tokens/effects.css, in one place, on purpose. */
  --ac-persist: ${t["ac-persist"]};
  --ac-flicker: ${t["ac-flicker"]};${
    t["ac-persist-fast"] ? `\n  --ac-persist-fast: ${t["ac-persist-fast"]};` : ""
  }${
    t["ac-blink-anim"]
      ? `\n\n  /* Long enough that the next ON edge lands before this one has\n     drained: the alarm throbs rather than chops. */\n  --ac-blink-anim: ${t["ac-blink-anim"]};`
      : ""
  }${
    t["ac-decay-ease"]
      ? `\n\n  /* The decay curve itself, sampled from the ${
          d.persist.held.model === "becquerel"
            ? `Becquerel power law I0/(1+t/t0)^${d.persist.held.n}`
            : "exponential"
        }.
     A shape no single cubic-bezier expresses, which is why it is a linear(). */\n  --ac-decay-ease: ${t["ac-decay-ease"]};`
      : ""
  }`
    : "";

  /* Short form on purpose. The full justification for each emitter's spectrum
     lives in scripts/data/emitters.json next to the data it justifies;
     duplicating it here would give it two places to be edited and one to go
     stale. Note the phosphors carry a WEAKER claim than the gases — their bands
     are back-solved from published chromaticity rather than measured. The
     $phosphors block in emitters.json is where that is spelled out. */
  return `/* --- ${d.tech.toUpperCase()} / ${d.name.toUpperCase()} — ${emitter.appearance}.

     GENERATED by scripts/derive-gas.mjs. Do not edit these values by hand;
     \`npm test\` re-derives and fails on drift. The ${d.bands ? "band" : "line"} data, its source
     and the reason this ${noun} uses the ${d.bands ? "band shape" : "line selection"} it does are in
     scripts/data/emitters.json.

     ${spectrum}: x=${d.x.toFixed(4)} y=${d.y.toFixed(4)}.
     ${d.desat > 0.005
       ? `Outside sRGB at the luminance --ac-emit-90 needs, so it is\n     desaturated ${(d.desat * 100).toFixed(0)}% toward D65 — the ${noun} is paler here than it is in the tube.`
       : `Inside sRGB as measured; no gamut mapping needed.`}
     Stops solved to 10.5 / 7.0 / 5.2 / 3.4 / 1.63 : 1 against this palette's
     own --ac-screen; --ac-on-fill lands at ${d.onFillRatio.toFixed(2)}:1 on --ac-emit-90.${cascade} --- */
[data-ac-tech="${d.tech}"][data-ac-emitter="${d.name}"] {
  --ac-screen: ${t["screen"]};
  --ac-screen-raised: ${t["screen-raised"]};
  --ac-screen-well: ${t["screen-well"]};

  --ac-emit-100: ${t["emit-100"]};
  --ac-emit-90:  ${t["emit-90"]};
  --ac-emit-70:  ${t["emit-70"]};
  --ac-emit-50:  ${t["emit-50"]};
  --ac-emit-30:  ${t["emit-30"]};
  --ac-on-fill:  ${t["on-fill"]};

  --ac-halo-1: ${t["gas-1"]};
  --ac-halo-2: ${t["gas-2"]};
  --ac-halo-3: ${t["gas-3"]};
  --ac-halo-4: ${t["gas-4"]};

  /* Rayleigh: this ${noun} throws ${d.scatter >= 1 ? `${((d.scatter - 1) * 100).toFixed(0)}% more` : `${((1 - d.scatter) * 100).toFixed(0)}% less`} light into the halo than neon. */
  --ac-halo-scatter: ${t["gas-scatter"]};
  --ac-halo-spread: ${t["gas-spread"]};${flash}${persist}
}`;
}

/* -------------------------------------------------------------------- main -- */

const raw = JSON.parse(await readFile(path.join(ROOT, "scripts/data/emitters.json"), "utf8"));
const args = process.argv.slice(2);
const only = args.find((a) => !a.startsWith("--"));
const names = Object.keys(raw.emitters).filter((n) => !only || n === only);

const all = names.map((n) => ({ d: derive(n, raw.emitters[n]), e: raw.emitters[n] }));

/* Scatter is stated RELATIVE TO NEON, because the absolute figure is a ratio
   against an arbitrary 555nm reference and means nothing on its own — whereas
   "argon throws half again as much light into the halo as neon does" is a
   sentence somebody can check. Neon is therefore always derived, even when the
   command line asked for one other gas. */
const neonScatter =
  all.find(({ d }) => d.name === "neon")?.d.rawScatter ??
  derive("neon", raw.emitters.neon).rawScatter;

for (const { d } of all) {
  d.scatter = d.rawScatter / neonScatter;
  d.tokens["gas-scatter"] = d.scatter.toFixed(2);
  /* Radius, not intensity: multiple scattering broadens the halo as it
     brightens it, so both come off the same number and cannot disagree. */
  d.tokens["gas-spread"] = Math.sqrt(d.scatter).toFixed(2);
}

/* KNOWN-ANSWER GATE, and it runs first.
   Any emitter carrying `validate` is one whose color was established
   independently of this script. If the pipeline cannot reproduce it, the
   pipeline is wrong, and finding that out here — against neon, whose answer we
   know — is worth more than any amount of staring at the three palettes whose
   answers we do not. */
function checkValidate(label, dx, dy, spec) {
  const { x, y, tol } = spec;
  const off = Math.hypot(dx - x, dy - y);
  const ok = off <= tol;
  console.error(
    `  validate ${label}: derived x=${dx.toFixed(4)} y=${dy.toFixed(4)} vs ` +
    `known x=${x} y=${y} — off by ${off.toFixed(4)} (tol ${tol}) ${ok ? "OK" : "FAIL"}`
  );
  if (!ok) {
    console.error(
      `\n  The color pipeline no longer reproduces a known answer. Fix that before\n` +
      `  trusting anything else this script emits.`
    );
    process.exit(1);
  }
}

for (const { d, e } of all) {
  if (e.validate) checkValidate(d.name, d.x, d.y, e.validate);
  /* A cascade phosphor has two spectra and therefore two answers to check. P7's
     afterglow is the layer that carries the halo and every ghost on the screen;
     leaving it unchecked would gate the color nobody looks at and skip the one
     the effect is made of. */
  if (e.afterglow?.validate) {
    checkValidate(`${d.name} afterglow`, d.hx, d.hy, e.afterglow.validate);
  }
}

/* `emit: false` means reference-only — used to check the pipeline, never
   written into colors.css. Neon is the only one, and the reason is in its
   `why` block in emitters.json. */
const derived = all.filter(({ e }) => e.emit !== false);

if (args.includes("--swatch")) {
  const file = args[args.indexOf("--swatch") + 1] ?? "gas-swatches.html";
  const row = ({ d, e }) => `<div class="r"><div class="n">${d.name}<em>${e.appearance}</em>
    <b>x=${d.x.toFixed(4)} y=${d.y.toFixed(4)}</b></div><div class="s">${
    STOPS.map(([s]) => `<i style="background:${d.tokens[`emit-${s}`]}">${d.tokens[`emit-${s}`]}</i>`).join("")
  }</div><div class="p" style="background:${d.tokens["screen"]}">
    <span style="color:${d.tokens["emit-90"]}">PANEL TEXT</span>
    <span style="background:${d.tokens["emit-90"]};color:${d.tokens["on-fill"]}">INVERSE</span></div></div>`;
  await writeFile(file, `<style>body{background:#08080a;color:#ccc;font:13px ui-monospace,monospace;padding:26px}
h1{font-size:14px;font-weight:400;color:#777;margin:0 0 20px}
.r{display:flex;align-items:center;gap:16px;margin-bottom:14px}
.n{width:210px}.n em{display:block;color:#777;font-style:normal;font-size:11px}
.n b{display:block;color:#555;font-weight:400;font-size:10px}
.s{display:flex}.s i{width:82px;height:56px;font-style:normal;font-size:9px;color:#0007;display:flex;align-items:flex-end;justify-content:center;padding-bottom:3px}
.p{margin-left:8px;padding:11px 14px;display:flex;gap:12px;align-items:center;min-width:230px}
.p span{padding:2px 7px;font-size:14px;letter-spacing:.05em}</style>
<h1>Derived plasma palettes — stops solved to 10.5 / 7.0 / 5.2 / 3.4 / 1.63 : 1 against each palette's own panel black</h1>
${derived.map(row).join("\n")}`);
  console.log(`  swatches -> ${file}`);
}

if (args.includes("--check")) {
  const css = await readFile(path.join(ROOT, "src/tokens/colors.css"), "utf8");
  const bad = [];
  for (const { d } of derived) {
    const block = css.match(
      new RegExp(`\\[data-ac-emitter="${d.name}"\\][^{]*\\{([^}]*)\\}`)
    );
    if (!block) { bad.push(`${d.name}: no block in colors.css`); continue; }
    for (const [token, want] of Object.entries(d.tokens)) {
      const got = block[1].match(new RegExp(`--${token}\\s*:\\s*([^;]+);`))?.[1].trim();
      if (got && got.toLowerCase() !== want.toLowerCase()) {
        bad.push(`${d.name} --${token}: colors.css has ${got}, derivation says ${want}`);
      }
    }
  }
  /* The guide prints every hex as TEXT under its chip, which is documentation
     that can disagree with the thing it documents and look completely fine doing
     it. Twenty-five of those labels now. Check them against colors.css. */
  const guide = await readFile(path.join(ROOT, "docs/guide.html"), "utf8");
  for (const m of guide.matchAll(
    /--([A-Z-]+\d*)\s*·\s*(#[0-9A-Fa-f]{3,8})<\/span>/g
  )) {
    const token = m[1].toLowerCase();
    const shown = m[2].toLowerCase();
    /* Which palette a label belongs to is the nearest .doc-demo above it. */
    const before = guide.slice(0, m.index);
    const demo = [...before.matchAll(/data-ac-emitter="([\w-]+)"/g)].pop()?.[1];
    if (!demo) continue;
    const block = css.match(new RegExp(`\\[data-ac-emitter="${demo}"\\][^{]*\\{([^}]*)\\}`));
    const real = block?.[1].match(new RegExp(`--${token}\\s*:\\s*([^;]+);`))?.[1].trim().toLowerCase();
    if (real && real !== shown) {
      bad.push(`docs/guide.html --${token} under ${demo}: label says ${shown}, colors.css has ${real}`);
    }
  }

  if (bad.length) {
    console.error(`\n  ${bad.length} value(s) drifted from the derivation:\n` +
      bad.map((b) => `    ${b}`).join("\n"));
    process.exit(1);
  }
  console.log(`  ${derived.length} palettes match their derivation; guide labels match colors.css`);
} else if (!args.includes("--swatch")) {
  for (const { d, e } of derived) console.log(toCSS(d, e) + "\n");

  /* The summary reports EVERY emitter, including the reference-only ones, and
     that is not just for completeness. P3's palette is hand-built and not
     emitted, but its --ac-halo-scatter is derived here and has to be readable
     somewhere in order to be copied into the hand-built block — otherwise the
     one number this pass fixes for P3 is computed and then thrown away. */
  console.error(all.map(({ d, e }) =>
    `  ${d.name.padEnd(9)}${e.emit === false ? "ref " : "    "}` +
    `x=${d.x.toFixed(4)} y=${d.y.toFixed(4)}  ` +
    `${(d.bands
      ? d.bands.map((b) => `${b.nm}/${b.fwhm}nm`).join("+")
      : `${d.kept}/${d.total} lines`).padEnd(20)}` +
    `desat ${(d.desat * 100).toFixed(0)}%`.padEnd(10) +
    `on-fill ${d.onFillRatio.toFixed(2)}:1  scatter x${d.scatter.toFixed(2)}` +
    (d.glowDimmed > 0.005 ? `  halo -${(d.glowDimmed * 100).toFixed(0)}% to hold hue` : "") +
    (d.persist
      ? `  persist ${d.persist.visible}ms  flicker ${d.persist.modulation.toFixed(3)}`
      : "")).join("\n"));
}

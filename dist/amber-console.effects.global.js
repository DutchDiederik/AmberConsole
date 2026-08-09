/*! Amber Console 2.0.0 | BSD-3-Clause | classic-script build
 *  Generated from src/amber-console.effects.js by scripts/build.mjs.
 *  Use this with a plain <script src> — including from file:// URLs, where
 *  type="module" is blocked. Exposes window.AmberConsoleEffects.
 */
(function () {
"use strict";

/*! Amber Console | BSD-3-Clause | https://github.com/DutchDiederik/AmberConsole */
/**
 * Amber Console — optional PERSISTENCE module.
 *
 * STRICTLY OPTIONAL, AND SEPARATELY OPTIONAL FROM amber-console.js. That split
 * is the point of this file existing:
 *
 *   amber-console.css          every component, and every decay CSS can express
 *                              on its own — de-energizing afterimages, the blink
 *                              off-edge, residual patches, decay-out, and
 *                              cross-document page persistence. Complete alone.
 *   amber-console.js           BEHAVIOR. The tablist keyboard model, dialogs,
 *                              toggles, the DISPLAY presets. No effects.
 *   amber-console.effects.js   THIS FILE. The three persistence phenomena that
 *                              are not reachable from CSS at all.
 *
 * Someone who wants accessible tabs and no eye-candy loads the second. Someone
 * who wants the full phosphor simulation over their own tab implementation loads
 * the third. Neither imports the other, and either works alone.
 *
 * WHAT IS HERE, AND WHY CSS CANNOT DO IT:
 *
 *   1. GHOSTING       text rewritten in place leaves its previous value behind.
 *                     Nothing in the cascade remembers the old string.
 *   2. SCROLL SMEAR   scaled by scroll VELOCITY. CSS scroll-driven animations
 *                     expose scroll POSITION only; velocity is not derivable
 *                     from a timeline, so this cannot move into the stylesheet.
 *   3. FRAMEBUFFER    a real snapshot of the old screen, decaying per pixel.
 *      DECAY          `document.startViewTransition` is the only API that hands
 *                     us one for a same-document change.
 *
 * HOW IT FINDS ITS WORK WITHOUT BEING TOLD. There is no registration call and no
 * event contract with amber-console.js. This file watches the DOM for the two
 * facts it needs — whether `.ac-afterglow` is on the frame, and whether
 * `data-ac-engine` permits it — because both are already in the DOM and
 * observable. A contract between the two modules would be a thing to keep in
 * sync; an observer is not.
 */

const REDUCED_MOTION =
  typeof matchMedia === "function"
    ? matchMedia("(prefers-reduced-motion: reduce)")
    : { matches: false };

/* ------------------------------------------------------------------ frame -- */

/** The frame the simulation paints on. Re-resolved, since it can be replaced. */
function screenFrame() {
  return (
    document.querySelector("[data-ac-screen]") ??
    document.querySelector(".ac-screen") ??
    null
  );
}

const afterglowOn = () => Boolean(screenFrame()?.classList.contains("ac-afterglow"));

/* THE SMEAR HAS NO SWITCH OF ITS OWN ANY MORE, and losing it removed a whole
   class of confusion rather than a feature. It was a STYLE flag that could only
   ever be on under CRT and had to disable itself under plasma, which meant a
   control that spent most of its life explaining why it could not do anything.
   Every other thing this module does is governed by one question — is the
   persistence simulation running and is this module allowed to contribute — and
   the smear is now governed by the same one. */

/**
 * THE ENGINE FLAG — whether this file is allowed to run at all.
 *
 * `data-ac-engine="css"` on the root means the page wants the simulation the
 * stylesheet can do on its own, and nothing else. It is not a preference about
 * comfort and not a claim about the hardware, which is why it is neither a style
 * flag nor a simulation: it is a statement about which of the two files is
 * permitted to contribute. Everything in here is gated on it — ghosting, the
 * scroll smear, and the framebuffer decay in transition() — so one attribute
 * answers "which of these effects need JavaScript" by turning exactly those off.
 *
 * Defaults to on when absent, and the default is duplicated from ENGINE in
 * amber-console.js rather than shared with it. That is a real cost, and the
 * alternative is worse: a module that cannot run without the other one present
 * is not optional.
 */
const engineOn = () => document.documentElement.getAttribute("data-ac-engine") !== "css";

/**
 * THE SHORTEST TAIL THESE EFFECTS CAN BE SEEN AT, in milliseconds.
 *
 * Mirrored from ENGINE_FLOOR_MS in amber-console.js, duplicated for the same
 * reason engineOn's default is: a module that cannot run without the other one
 * present is not optional. If the two ever disagree, the switch and the work it
 * governs disagree — so they are commented as a pair.
 *
 * THEY DID DISAGREE, and it is worth writing down what that looked like. This
 * number was 5ms — a COMPOSITING floor, asking only "can a frame be drawn at
 * all" — while amber-console.js had already moved to the 80ms PERCEPTUAL one.
 * P1 at 24ms and P3 at 25ms fall between the two, so on those phosphors the JS
 * Effects switch was disabled and painted OFF, the State readout said CSS ONLY,
 * and this file went on cloning ghosts and driving the smear behind both of
 * them. A control that reads OFF while the thing it governs is running is the
 * exact lie the gating in syncEngineControls exists to prevent, told from the
 * other side of the split.
 *
 * SO THE FLOOR IS 80ms IN BOTH FILES, and the long note above ENGINE_FLOOR_MS in
 * amber-console.js is where the reasoning for the number itself lives — briefly:
 * tokens/effects.css has always held that much under ~80ms the eye stops reading
 * a relaxation and starts reading a switch, and the catalog has nothing between
 * 25ms and 105ms, so the threshold is not near anything.
 *
 * WHAT IT COSTS: on P1 and P3, ghosting, the scroll smear and the framebuffer
 * decay all stop — and all three were single-frame flickers there, produced by
 * real work. A ghost was cloned, measured, mounted, given a 25ms animation and
 * removed about one frame later. Not doing that is the point, not the price.
 */
const PERSIST_FLOOR_MS = 80;

/**
 * Whether this module should be contributing anything at all.
 *
 * THREE CONDITIONS THAT FAIL FOR THREE DIFFERENT REASONS, which is why they are
 * gathered here instead of restated at each call site:
 *
 *   the engine flag   the page asked for the stylesheet's simulation only
 *   .ac-afterglow     there is no persistence layer to decay onto — every
 *                     selector in the CSS half is scoped to it, and a plasma cell
 *                     is driven continuously and has nothing that trails
 *   the tail          the phosphor relaxes faster than the eye reads a decay, so
 *                     nothing these effects draw could be seen as persistence
 *
 * amber-console.js disables the JS Effects switch on the last two and paints it
 * OFF, so the control agrees with this function rather than claiming to be on
 * while nothing runs.
 */
function effectsActive() {
  return engineOn() && afterglowOn() && tailMs() >= PERSIST_FLOOR_MS;
}

/**
 * Read a time token off the root, in milliseconds.
 *
 * `--ac-persist-tail` is the UNCAPPED decay — the one the long phosphors are
 * allowed to be long on. Values arrive as "2000ms" or occasionally "0.035ms".
 */
function tailMs() {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--ac-persist-tail")
    .trim();
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return 105;
  return raw.endsWith("s") && !raw.endsWith("ms") ? n * 1000 : n;
}

/** .ac-persist hosts every ghost. Either module may be the one to mount it. */
function persistLayer(frame) {
  let layer = frame.querySelector(":scope > .ac-persist");
  if (!layer) {
    layer = document.createElement("span");
    layer.className = "ac-persist";
    frame.prepend(layer);
  }
  return layer;
}

/* ----------------------------------------------------------------- ghosts -- */

/** Enough of the source's paint to make a detached clone look identical. */
const GHOST_STYLES = [
  "font", "letterSpacing", "lineHeight", "textAlign", "textTransform",
  "whiteSpace", "color", "textShadow", "padding", "borderRadius",
];

/**
 * More than this many draining ghosts means something is rewriting text far
 * faster than the decay, and every extra one is invisible under the pile.
 */
const GHOST_LIMIT = 24;

/**
 * HOW MANY GENERATIONS OF THE SAME VALUE MAY BE ON SCREEN AT ONCE.
 *
 * This constant is the fix for the single worst bug in the persistence system,
 * and it is worth writing down what the bug was. Every text rewrite used to
 * spawn its ghost with the FAST duration unconditionally — capped at 400ms — on
 * the reasoning that a continuously-updating field would otherwise smear into
 * its own next value. That reasoning is correct for a 105ms gas panel and
 * exactly backwards for a long phosphor: smearing into the next value is what
 * P39 and P7 DO. It is the entire reason those phosphors were fitted to radar.
 * The result was that the two emitters with the most dramatic persistence in the
 * catalog showed the least, because the code capped it away before the CSS ever
 * saw it.
 *
 * So the rule is now the physical one. A cell rewritten far faster than it can
 * relax genuinely cannot accumulate its own history — the light never gets out
 * of the way — and a cell rewritten slower than that leaves a legible trail of
 * previous values. Four generations is where a trail stops reading as history
 * and starts reading as mush; below that threshold the full tail runs.
 *
 * A clock ticking once a second on a 2000ms P39 tail therefore shows two
 * generations, which is precisely the effect. The same clock on a 105ms neon
 * panel takes the fast path, exactly as before.
 */
const MAX_GENERATIONS = 4;

/** When each element last ghosted, so the rate above can be measured. */
const lastGhostAt = new WeakMap();

/**
 * Ghosts are decoration made of duplicated content — hide them completely, and
 * cut every wire the original had. `id` is the obvious one; the `data-ac-*`
 * hooks matter more, because every initializer in amber-console.js finds its
 * elements with a document-wide querySelectorAll and a clone that kept its hooks
 * is still a match. A ghost is a photograph; nothing may keep writing on it.
 */
function sanitize(node) {
  const cut = (el) => {
    el.removeAttribute?.("id");
    for (const attr of [...(el.attributes ?? [])]) {
      if (attr.name.startsWith("data-ac-")) el.removeAttribute(attr.name);
    }
  };

  cut(node);
  for (const el of node.querySelectorAll?.("*") ?? []) cut(el);

  node.setAttribute("aria-hidden", "true");
  node.inert = true;
  node.tabIndex = -1;
}

/**
 * Park a decaying copy of `source` on the persistence layer.
 *
 * @param {Element} source  must still be in the document — its rect is what the
 *                          ghost is pinned to
 * @param {string} [text]   value to show instead of the source's current one
 * @param {boolean} [fast]  use the capped duration, for text updating faster
 *                          than MAX_GENERATIONS of its own decay
 * @param {DOMRect} [at]    pin the ghost HERE instead of at the source's current
 *                          rect. For a lit area that SHRANK, the interesting
 *                          geometry is the one the element no longer has, and by
 *                          the time a mutation is observed the element is already
 *                          the new size — so the caller measures the old rect and
 *                          hands it in.
 */
function spawnGhost(source, text, fast, at) {
  /* A background tab does not advance the animation clock, so a ghost spawned
     into one never reaches animationend and never cleans itself up. Nothing is
     being looked at either way. Same failure under prefers-reduced-motion: the
     CSS hides .ac-ghost outright, a display:none element never runs its
     animation, and animationend never fires. */
  if (document.hidden || REDUCED_MOTION.matches) return;

  /* The exported afterglow() reaches this directly, without going through
     sync(), so the full gate is checked here too rather than only at the
     observer. A page that calls it by hand where these effects cannot be seen
     gets the same nothing as one that never called it. */
  if (!effectsActive()) return;

  const frame = source.closest(".ac-afterglow");
  if (!frame) return;
  const layer = persistLayer(frame);

  const rect = at ?? source.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const box = frame.getBoundingClientRect();
  const ghost = source.cloneNode(true);
  sanitize(ghost);
  if (text !== undefined) ghost.textContent = text;

  /* The clone leaves its ancestors behind, so every inherited and
     descendant-selected style leaves with them. Copy the paint back on. */
  const from = getComputedStyle(source);
  for (const prop of GHOST_STYLES) ghost.style[prop] = from[prop];

  ghost.classList.add("ac-ghost");
  if (fast) ghost.classList.add("ac-ghost--fast");
  ghost.style.left = `${rect.left - box.left}px`;
  ghost.style.top = `${rect.top - box.top}px`;
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;

  layer.append(ghost);
  while (layer.querySelectorAll(".ac-ghost").length > GHOST_LIMIT) {
    layer.querySelector(".ac-ghost").remove();
  }
  ghost.addEventListener("animationend", () => ghost.remove(), { once: true });
}

/**
 * Ghost every text rewrite inside the frame.
 *
 * Both mutation kinds matter and they carry the old string differently:
 * `el.textContent = x` REPLACES the text node, which is a childList record with
 * the old node in removedNodes; editing a text node in place is a characterData
 * record with oldValue. Miss either one and half the updates on a page ghost.
 */
function makeGhostObserver(frame) {
  /* Named so the callback can drain its own probe writes — see takeRecords at
     the bottom of this function, which is load-bearing rather than tidy. */
  let observer;

  observer = new MutationObserver((records) => {
    /* One ghost per element per batch — a single textContent assignment can
       produce a remove and an insert, and two stacked copies read as a smear. */
    const seen = new Map();
    /* Elements whose lit AREA shrank, with the rect they no longer occupy. */
    const shrank = new Map();
    /* Nodes already put through geometryLoss this batch — it costs two forced
       layouts, so once each is the budget. */
    const measured = new Set();

    for (const m of records) {
      const host = m.type === "characterData" ? m.target.parentElement : m.target;
      if (!(host instanceof Element)) continue;
      /* Our own ghosts are DOM changes too. Watching them would feed itself. */
      if (host.closest(".ac-persist")) continue;

      if (m.type === "attributes") {
        /* Measured once per mutated element per batch — geometryLoss forces two
           layouts, and a demo that writes several properties onto the same node
           in one tick must not pay for each of them. */
        if (!measured.has(host)) {
          measured.add(host);
          for (const [el, rect] of geometryLoss(host, m.oldValue)) {
            if (!seen.has(el)) shrank.set(el, rect);
          }
        }
        continue;
      }

      let old;
      if (m.type === "characterData") {
        old = m.oldValue;
      } else {
        for (const node of m.removedNodes) {
          if (node.nodeType === Node.TEXT_NODE) old = node.nodeValue;
        }
      }

      /* A rewrite to the same string is not a change the panel ever saw —
         the console demo reassigns its date field every second unchanged. */
      if (!old?.trim() || old === host.textContent) continue;
      if (!seen.has(host)) seen.set(host, old);
      shrank.delete(host);
    }

    /* THE PROBE'S OWN WRITES MUST NOT COME BACK, and this line is why the page
       does not hang. geometryLoss measures the old geometry by putting the old
       `style` attribute back on the live element and then restoring the new one —
       which is two more style mutations, on an element this observer is watching
       for style mutations. Each batch would therefore queue another batch, for
       ever. It is the same self-feeding trap the .ac-persist filter above exists
       to prevent, arriving by a different route.

       Our writes are synchronous inside this callback, so nothing an application
       did can be interleaved with them — draining here discards exactly the
       records the probe created and nothing else. */
    if (measured.size) observer.takeRecords();

    if (!seen.size && !shrank.size) return;

    /* Measured once per batch rather than per ghost: it is a read of computed
       style on the root, and the answer cannot change inside one batch. */
    const tail = tailMs();
    const now = performance.now();

    const rate = (host) => {
      const prev = lastGhostAt.get(host);
      const fast = prev !== undefined && now - prev < tail / MAX_GENERATIONS;
      lastGhostAt.set(host, now);
      return fast;
    };

    for (const [host, old] of seen) spawnGhost(host, old, rate(host));
    for (const [host, old] of shrank) spawnGhost(host, undefined, rate(host), old);
  });

  return observer;
}

/**
 * Every element in or under `el` that occupied MORE space before this style
 * change than it does now, with the rect it has given up.
 *
 * A LIT AREA GETTING SMALLER IS ITS OWN PHENOMENON, and until now nothing
 * modeled it. Every other decay here covers a node disappearing, text being
 * rewritten, or a lamp changing color — but a bargraph does none of those. The
 * element stays, its text is elsewhere, its color never moves; what changes is
 * its WIDTH, so the strip it vacates was lit a moment ago and is now simply not
 * drawn. On a two-second phosphor that was the most visible wrong thing on the
 * panel: everything around the bar trailed and the bar itself snapped.
 *
 * HOW THE OLD GEOMETRY IS RECOVERED, because the obvious way does not work. By
 * the time a mutation is observed the element is already the new size, and
 * cloning it to measure the old one fails for the case that matters: a meter's
 * width is a PERCENTAGE of its track, and a clone parked in .ac-persist has no
 * track to be a percentage of. So the old inline style goes back onto the LIVE
 * element, which still has its real parent, and the rect is read there before the
 * new style is restored. Two forced layouts, synchronous, with no paint between
 * them — nothing flickers, because the browser never gets a frame in the middle.
 *
 * Only SHRINKING counts. Growth is instant, which is the direction rule every
 * other decay in this module follows.
 *
 * THE STYLED ELEMENT IS OFTEN NOT THE ONE THAT SHRINKS, which is the whole reason
 * this returns a list. A meter is driven by writing --ac-meter-value onto the
 * TRACK, and the track is a fixed-width box that never changes size at all — the
 * thing that moves is the BAR inside it, whose width is a percentage of that
 * custom property. Measuring only the mutated element finds nothing and ghosts
 * nothing, which is exactly the bug this function existed to fix.
 *
 * So the element and its immediate children are measured. One level, not the
 * whole subtree: it covers the shape this pattern actually takes — a driven
 * container with the lit region as a child — and keeps the cost a bounded couple
 * of rect reads instead of a walk of everything under a mutated node.
 */
function geometryLoss(el, oldStyle) {
  const targets = [el, ...el.children].filter((n) => n instanceof Element);
  const current = el.getAttribute("style");

  const after = targets.map((n) => n.getBoundingClientRect());

  if (oldStyle === null) el.removeAttribute("style");
  else el.setAttribute("style", oldStyle);

  const before = targets.map((n) => n.getBoundingClientRect());

  if (current === null) el.removeAttribute("style");
  else el.setAttribute("style", current);

  const lost = [];
  for (let i = 0; i < targets.length; i++) {
    /* A whole pixel of slack, so sub-pixel reflow noise is not a light-off
       event — and an area test rather than either dimension alone, so a box that
       trades width for height has not "shrunk". */
    const wasBigger =
      before[i].width > after[i].width + 1 || before[i].height > after[i].height + 1;
    if (wasBigger) lost.push([targets[i], before[i]]);
  }
  return lost;
}

/* ----------------------------------------------------------- scroll smear -- */

/**
 * Per-frame scroll distance, in px, that saturates the smear.
 *
 * TUNED AGAINST WHAT A WHEEL ACTUALLY DELIVERS, not against what a flick can.
 * A browser spreads one wheel notch over several frames, so ordinary scrolling
 * arrives at roughly 15-25px per frame. At the old 55 that reached barely a
 * third of the curve and the effect was, in practice, invisible to anyone who
 * was not dragging the scrollbar — the simulation was running correctly and
 * could not be seen doing it.
 */
const SMEAR_FULL = 28;

/**
 * Geometric drain per frame once the scroll stops, for a 105ms panel.
 *
 * SCALED BY THE PHOSPHOR, because a fixed release is the same mistake the ghost
 * duration used to make. At neon's 105ms this stays 0.55 and the tail is ~130ms;
 * at P39's 2000ms it rises toward 1, and the image keeps trailing after the
 * scroll stops, which is what a long phosphor does to a moving picture. The
 * exponent is the ratio of the two decays, so one number governs both.
 */
const SMEAR_DRAIN = 0.55;
const SMEAR_REFERENCE_MS = 105;

/**
 * Quantum for the value written to `--ac-smear`.
 *
 * 0.02 of a 1.8px blur is 0.036px. It exists to make consecutive frames write
 * the SAME string, so the write can be skipped and the filtered subtree does not
 * re-rasterize — see the note in step().
 */
const SMEAR_STEP = 0.02;

/** Drain factor for this palette: 0.55 at 105ms, approaching 1 as the tail grows. */
function smearDrain() {
  const tail = Math.max(tailMs(), 1);
  return Math.min(0.97, SMEAR_DRAIN ** (SMEAR_REFERENCE_MS / tail));
}

/**
 * Drive `--ac-smear` on the frame from actual scroll speed.
 *
 * Speed comes from the delta between animation frames rather than from the
 * scroll events themselves: scroll fires at wildly different rates depending on
 * input device, and a wheel notch and a trackpad flick that move the same
 * distance in the same time should smear identically.
 */
function makeScrollSmear(frame) {
  let last = 0;
  let smear = 0;
  let raf = 0;
  /* Whether the listener is actually attached — see connect(). */
  let listening = false;
  /* The last value actually written to the frame — see SMEAR_STEP below. */
  let written = "";

  const clear = () => {
    smear = 0;
    written = "";
    frame.removeAttribute("data-ac-scrolling");
    frame.style.removeProperty("--ac-smear");
  };

  const step = () => {
    raf = 0;
    const y = window.scrollY;
    const target = Math.min(Math.abs(y - last) / SMEAR_FULL, 1);
    last = y;

    /* Rise immediately, drain gradually — the same asymmetry as everything else
       here. The panel keeps up with getting brighter; it lags going dark. */
    smear = target > smear ? target : smear * smearDrain();

    if (smear < 0.01) {
      clear();
      return;
    }
    frame.setAttribute("data-ac-scrolling", "");

    /* QUANTIZED, AND THE POINT IS THE WRITE THAT DOESN'T HAPPEN. --ac-smear
       drives `filter: blur()` on the frame's content, and a blur radius that
       changes invalidates the raster of everything under it. At three decimals
       essentially every frame of a scroll was a new radius, so the subtree was
       re-rastered on every one of them — while the whole span of the effect is
       1.8px, and a step of 0.02 is 0.036px of blur. Nobody has ever seen 0.036px
       of blur. Rounding to the step and skipping the write when it has not moved
       costs nothing visible and drops most of the invalidations. */
    const next = (Math.round(smear / SMEAR_STEP) * SMEAR_STEP).toFixed(2);
    if (next !== written) {
      written = next;
      frame.style.setProperty("--ac-smear", next);
    }
    raf = requestAnimationFrame(step);
  };

  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(step);
  };

  return {
    connect() {
      /* Smearing the viewport in response to scrolling is the most motion-sick-
         making thing in the simulation; the CSS hides it too, but there is no
         reason to run the loop at all. */
      if (REDUCED_MOTION.matches) return;

      /* AN ALREADY-CONNECTED SMEAR MUST BE LEFT ALONE, and the flag is here for
         the line below it rather than for the listener — adding the same
         function with the same options twice was always a no-op. Reseeding
         `last` was not: sync() calls connect() unconditionally every time it
         runs, and it runs on any class change anywhere in the document. A
         reseed that lands between a scroll and the next frame throws away the
         distance covered in that window, and the smear drops to a drain while
         the page is still moving.

         MEASURED BEFORE BELIEVING IT, because the obvious story — live pages
         change classes constantly, so this must be firing all the time — is not
         what the numbers say. Over a four-second scroll the watcher fires once
         on the server demo and not at all on the console or the radar: the
         filter is `class` on a subtree that mostly rewrites TEXT, and text is
         the ghost observer's business, not this one's. So this is a rare
         glitch, not the reason the smear was hard to see. That was the
         calibration — see SMEAR_FULL above. Guarded anyway: connect() has no
         business not being idempotent. */
      if (listening) return;
      listening = true;
      last = window.scrollY;
      window.addEventListener("scroll", onScroll, { passive: true });
    },
    disconnect() {
      listening = false;
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      clear();
    },
  };
}

/* ------------------------------------------------------ framebuffer decay -- */

/**
 * Run `fn`, and let the screen it replaces decay per pixel.
 *
 * THIS IS THE ONLY TRUE PERSISTENCE IN THE SYSTEM. Everything else decays an
 * ELEMENT — something the cascade can name. A phosphor decays whatever was
 * drawn, including the parts of the screen no element owns.
 * `document.startViewTransition` snapshots the old frame as an image, and
 * sim/afterglow.css drains that image on the emitter’s own sampled curve while
 * the new frame appears instantly underneath it. Instant up, curve down, applied
 * to the whole screen at once.
 *
 * DISCRETE CHANGES ONLY, and the reason is mechanical rather than aesthetic: a
 * new view transition CANCELS the one already running. Wrapping every text tick
 * would mean a 3000ms P7 snapshot being thrown away 60 times a second and never
 * completing once — strictly worse than not doing it. Tab switches, dialogs and
 * panel swaps are far enough apart to finish. Frequent text keeps the ghost
 * mechanism above, which composes rather than canceling.
 *
 * Declines, and simply runs `fn`, when: the API is absent, motion is reduced,
 * the document is hidden (the API throws InvalidStateError there rather than
 * degrading), the persistence simulation is off, or the page has asked for the
 * CSS-only engine. It is always safe to call.
 */
function transition(fn) {
  if (
    typeof document.startViewTransition !== "function" ||
    REDUCED_MOTION.matches ||
    document.hidden ||
    !effectsActive()
  ) {
    fn();
    return null;
  }

  try {
    return document.startViewTransition(fn);
  } catch {
    /* A transition already mid-flight in an unusual state, or a UA that exposes
       the method and refuses the call. The DOM change must still happen. */
    fn();
    return null;
  }
}

/* ------------------------------------------------------------------- wire -- */

let ghostObserver = null;
let scrollSmear = null;
let boundFrame = null;
let connected = false;

/**
 * Bring the effects into line with whatever the DOM currently says.
 *
 * Idempotent and cheap, so it can be called from any observer without
 * bookkeeping about what actually changed.
 */
function sync() {
  const frame = screenFrame();

  /* The frame itself can be replaced — the observers are rebuilt against the
     new one rather than left pointing at a detached node. */
  if (frame !== boundFrame) {
    ghostObserver?.disconnect();
    scrollSmear?.disconnect();
    ghostObserver = null;
    scrollSmear = null;
    boundFrame = frame;
    connected = false;
  }
  if (!frame) return;

  /* All of it has to be true — see effectsActive. The observer, the smear loop
     and the framebuffer decay are the same three effects behind the same three
     conditions, so there is one answer rather than one per call site. */
  const want = effectsActive();

  if (want && !connected) {
    persistLayer(frame);
    ghostObserver ??= makeGhostObserver(frame);
    scrollSmear ??= makeScrollSmear(frame);
    ghostObserver.observe(frame, {
      subtree: true,
      childList: true,
      characterData: true,
      characterDataOldValue: true,
      /* `style` only, and with the old value, so a lit area that shrinks can be
         ghosted at the geometry it no longer has — see geometryLoss. Filtered to the
         one attribute that can change geometry from script without replacing the
         element, rather than watching all of them: `class` churns constantly on
         these demos and none of that churn is a light-off event. */
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ["style"],
    });
    connected = true;
  } else if (!want && connected) {
    ghostObserver?.disconnect();
    scrollSmear?.disconnect();
    connected = false;
  }

  /* The smear rides the same answer as everything else here now — see the note
     where its flag used to be. Settled on every sync rather than only on the
     transitions above, because the engine flag can move without the simulation
     moving with it. */
  if (connected) scrollSmear?.connect();
  else scrollSmear?.disconnect();
}

/**
 * Leave a decaying copy of `el` behind. Call it BEFORE you remove or empty the
 * element — a detached node has no rect, so there is nowhere to pin the ghost.
 *
 *   AmberConsoleEffects.afterglow(row);
 *   row.remove();
 *
 * Text rewrites inside the frame already ghost themselves; this is for the case
 * the observer cannot serve, which is a node that is about to stop existing.
 * A no-op when the simulation is off, so it is always safe to call.
 */
function afterglow(el) {
  if (el instanceof Element) spawnGhost(el);
}

/** Start watching. Safe to call more than once. */
function init() {
  sync();

  /* .ac-afterglow arriving or leaving the frame is the whole signal, and it is
     already in the DOM — so it is read from there rather than through a
     handshake with amber-console.js, which may not be loaded at all. */
  const frameWatcher = new MutationObserver(sync);
  const root = document.documentElement;
  frameWatcher.observe(root, {
    subtree: true,
    attributes: true,
    attributeFilter: [
      "class",
      "data-ac-screen",
      "data-ac-engine",
      /* THE PALETTE IS PART OF THE GATE NOW, because --ac-persist-tail comes
         from the emitter and effectsActive() reads it. P39 to P11 is still CRT,
         still afterglow, still engine-on — and goes from a two-second tail to
         thirty-five microseconds, which is the difference between these effects
         being the point and being invisible work. Without these two the observer
         would stay connected across that change. */
      "data-ac-tech",
      "data-ac-emitter",
    ],
  });

  /* A palette change swaps --ac-persist-tail underneath everything. Nothing
     needs recomputing — every duration is read at the moment it is used — but
     the smear loop's drain factor is read per frame, so it follows for free. */
}

/**
 * THE ONE GLOBAL, AND IT IS THE INTEROP POINT BETWEEN THE TWO MODULES.
 *
 * amber-console.js wraps tab switches and dialogs in `transition()` when this
 * module is present, and it finds it by runtime lookup rather than by import —
 * an import would make two independently optional modules depend on each other.
 * The classic-script build gets `window.AmberConsoleEffects` from the IIFE
 * wrapper; the ES-module build would not, and the two builds must behave the
 * same, so it is published here as well.
 *
 * `??=` rather than `=`: whichever build loaded first keeps the surface, and
 * loading both by accident does not leave half a module installed.
 */
if (typeof globalThis !== "undefined") {
  globalThis.AmberConsoleEffects ??= { init, afterglow, transition };
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init());
  } else {
    init();
  }
}

window.AmberConsoleEffects = { init: init, afterglow: afterglow, transition: transition };
})();

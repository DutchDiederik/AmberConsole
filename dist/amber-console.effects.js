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
 *   amber-console.js           BEHAVIOUR. The tablist keyboard model, dialogs,
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
 * `data-ac-style-smear` is off on the root — because both are already in the DOM
 * and observable. A contract between the two modules would be a thing to keep in
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

/**
 * The style flag, read straight off the root.
 *
 * Defaults to ON when the attribute is absent, matching the STYLES table in
 * amber-console.js — which this file deliberately does not import. The default
 * is duplicated rather than shared, and that is a real cost, but the alternative
 * is a module that cannot run without the other one present.
 */
const smearOn = () =>
  document.documentElement.getAttribute("data-ac-style-smear") !== "off";

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
 * amber-console.js for the same reason smearOn's is: a module that cannot run
 * without the other one present is not optional.
 */
const engineOn = () => document.documentElement.getAttribute("data-ac-engine") !== "css";

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
 */
function spawnGhost(source, text, fast) {
  /* A background tab does not advance the animation clock, so a ghost spawned
     into one never reaches animationend and never cleans itself up. Nothing is
     being looked at either way. Same failure under prefers-reduced-motion: the
     CSS hides .ac-ghost outright, a display:none element never runs its
     animation, and animationend never fires. */
  if (document.hidden || REDUCED_MOTION.matches) return;

  /* The exported afterglow() reaches this directly, without going through
     sync(), so the engine flag is checked here too rather than only at the
     observer. A page that calls it by hand under the CSS-only engine gets the
     same nothing as one that never called it. */
  if (!engineOn()) return;

  const frame = source.closest(".ac-afterglow");
  if (!frame) return;
  const layer = persistLayer(frame);

  const rect = source.getBoundingClientRect();
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
  return new MutationObserver((records) => {
    /* One ghost per element per batch — a single textContent assignment can
       produce a remove and an insert, and two stacked copies read as a smear. */
    const seen = new Map();

    for (const m of records) {
      const host = m.type === "characterData" ? m.target.parentElement : m.target;
      if (!(host instanceof Element)) continue;
      /* Our own ghosts are DOM changes too. Watching them would feed itself. */
      if (host.closest(".ac-persist")) continue;

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
    }

    if (!seen.size) return;

    /* Measured once per batch rather than per ghost: it is a read of computed
       style on the root, and the answer cannot change inside one batch. */
    const tail = tailMs();
    const now = performance.now();

    for (const [host, old] of seen) {
      const prev = lastGhostAt.get(host);
      const fast = prev !== undefined && now - prev < tail / MAX_GENERATIONS;
      lastGhostAt.set(host, now);
      spawnGhost(host, old, fast);
    }
  });
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

  const clear = () => {
    smear = 0;
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
    frame.style.setProperty("--ac-smear", smear.toFixed(3));
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
 * tokens/effects.css drains that image on the emitter's own sampled curve while
 * the new frame appears instantly underneath it. Instant up, curve down, applied
 * to the whole screen at once.
 *
 * DISCRETE CHANGES ONLY, and the reason is mechanical rather than aesthetic: a
 * new view transition CANCELS the one already running. Wrapping every text tick
 * would mean a 3000ms P7 snapshot being thrown away 60 times a second and never
 * completing once — strictly worse than not doing it. Tab switches, dialogs and
 * panel swaps are far enough apart to finish. Frequent text keeps the ghost
 * mechanism above, which composes rather than cancelling.
 *
 * Declines, and simply runs `fn`, when: the API is absent, motion is reduced,
 * the document is hidden (the API throws InvalidStateError there rather than
 * degrading), the persistence simulation is off, or the page has asked for the
 * CSS-only engine. It is always safe to call.
 */
export function transition(fn) {
  if (
    typeof document.startViewTransition !== "function" ||
    REDUCED_MOTION.matches ||
    document.hidden ||
    !afterglowOn() ||
    !engineOn()
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

  /* Both halves have to be true: the simulation has to be asking for
     persistence, and the page has to be allowing this file to provide it. */
  const want = afterglowOn() && engineOn();

  if (want && !connected) {
    persistLayer(frame);
    ghostObserver ??= makeGhostObserver(frame);
    scrollSmear ??= makeScrollSmear(frame);
    ghostObserver.observe(frame, {
      subtree: true,
      childList: true,
      characterData: true,
      characterDataOldValue: true,
    });
    connected = true;
  } else if (!want && connected) {
    ghostObserver?.disconnect();
    scrollSmear?.disconnect();
    connected = false;
  }

  /* The smear flag moves independently of the simulation, so it is settled on
     every sync rather than only on the transitions above. */
  if (connected && smearOn()) scrollSmear?.connect();
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
export function afterglow(el) {
  if (el instanceof Element) spawnGhost(el);
}

/** Start watching. Safe to call more than once. */
export function init() {
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
      "data-ac-style-smear",
      "data-ac-engine",
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

export default { init, afterglow, transition };

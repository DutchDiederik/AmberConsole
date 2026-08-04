/*! Amber Console 2.0.0 | MIT | classic-script build
 *  Generated from src/amber-console.js by scripts/build.mjs.
 *  Use this with a plain <script src> — including from file:// URLs, where
 *  type="module" is blocked. Exposes window.AmberConsole.
 */
(function () {
"use strict";

/**
 * Amber Console — optional behavior module.
 *
 * STRICTLY OPTIONAL. Every component looks and reads correctly with this file
 * absent; nothing here affects appearance. It exists only for the six things
 * CSS genuinely cannot express:
 *
 *   1. the role="tablist" keyboard model
 *   2. flipping an aria-pressed toggle (the CSS-only .ac-toggle--input variant
 *      needs no JS at all — prefer it when you do not need a <button>)
 *   3. the PLASMA and CRT screen simulations, which persist across reloads, and
 *      the afterglow that rides with CRT — whose ghosts need the value a readout
 *      held one frame ago, the one thing on that list CSS cannot see
 *   4. opening and closing a native <dialog>
 *   5. the DISPLAY presets, which likewise persist — the palettes themselves are
 *      pure CSS and switch on `data-ac-tech` + `data-ac-emitter`, which you can
 *      just as well write into your own markup
 *   6. the STYLE flags, same deal on `data-ac-style-*`
 *
 * THREE AXES, DELIBERATELY SEPARATE, AND NOT INTERCHANGEABLE:
 *
 *   DISPLAY     which hardware is in the panel — a technology plus the gas or
 *               phosphor inside it. Root attributes. Color comes from here.
 *   SIMULATION  what the glass does about it — bloom, scanlines, persistence.
 *               Classes on the frame. Never a color.
 *   STYLE       everything that is not the hardware — comfort and typography
 *               preferences that make no claim about what the panel is.
 *
 * A DISPLAY preset sets the first two at once and then gets out of the way. It
 * is a starting point, not a lock.
 *
 * No dependencies, no build step, no framework. Auto-initializes on DOM ready
 * when loaded with <script type="module" src="amber-console.js"></script>.
 * Using React/Vue/Svelte? Skip it — drive the same ARIA attributes yourself and
 * the CSS follows.
 */

const STORE_PREFIX = "ac.sim.";

/**
 * Wrap a DOM change so the screen it replaces decays per pixel.
 *
 * The one place this file reaches for amber-console.effects.js, and it reaches
 * by runtime lookup rather than by import — deliberately, because the two
 * modules are independently optional and an import would make one require the
 * other. Without the effects module this is a plain call, and every tab and
 * dialog behaves exactly as it did before persistence existed.
 *
 * Only DISCRETE changes are wrapped. A view transition cancels any transition
 * already running, so wrapping frequent updates would mean a long P7 snapshot
 * being discarded before it ever finished. See the note in the effects module.
 */
const withDecay = (fn) => {
  const vt = globalThis.AmberConsoleEffects?.transition;
  if (typeof vt === "function") vt(fn);
  else fn();
};

/** localStorage can throw in private mode and in sandboxed file:// frames. */
function readStored(key) {
  try {
    return localStorage.getItem(STORE_PREFIX + key);
  } catch {
    return null;
  }
}
function writeStored(key, value) {
  try {
    localStorage.setItem(STORE_PREFIX + key, value);
  } catch {
    /* Not persisting is survivable; the toggle still works this session. */
  }
}
/**
 * Forget a stored preference — which is a different act from storing its
 * default. An absent key means "the user has never said", and that is the only
 * state a derived default is allowed to fill in. See syncDerivedStyles.
 */
function clearStored(key) {
  try {
    localStorage.removeItem(STORE_PREFIX + key);
  } catch {
    /* Same as above: the session is still correct, only the next one is not. */
  }
}

/* ---------------------------------------------------------------- tablist -- */

/**
 * Arrow-key model for a [data-ac="tabs"] container:
 * left/right move, Home/End jump, and only the selected tab is tabbable.
 * Each tab controls the element named by aria-controls.
 */
function initTabs(root) {
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  if (!tabs.length) return;

  const select = (tab) => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      t.classList.toggle("ac-tab--active", on);

      const panel = t.getAttribute("aria-controls");
      if (panel) {
        const el = document.getElementById(panel);
        if (el) el.hidden = !on;
      }
    }
  };

  root.addEventListener("click", (e) => {
    const tab = e.target.closest('[role="tab"]');
    if (tab && tabs.includes(tab)) withDecay(() => select(tab));
  });

  root.addEventListener("keydown", (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i === -1) return;

    const moves = {
      ArrowLeft: i - 1,
      ArrowRight: i + 1,
      Home: 0,
      End: tabs.length - 1,
    };
    if (!(e.key in moves)) return;

    e.preventDefault();
    const next = tabs[(moves[e.key] + tabs.length) % tabs.length];
    next.focus();
    withDecay(() => select(next));
  });

  select(tabs.find((t) => t.getAttribute("aria-selected") === "true") ?? tabs[0]);
}

/* ----------------------------------------------------------------- toggle -- */

/**
 * Click-to-flip for <button class="ac-toggle" data-ac="toggle" aria-pressed>.
 * Keeps aria-pressed, .ac-toggle--on and the mandatory ON/OFF text in sync.
 */
function initToggle(btn) {
  const paint = (on) => {
    btn.setAttribute("aria-pressed", String(on));
    btn.classList.toggle("ac-toggle--on", on);
    const state = btn.querySelector(".ac-toggle__state");
    if (state) state.textContent = on ? "ON" : "OFF";
  };

  paint(btn.getAttribute("aria-pressed") === "true");
  btn.addEventListener("click", () => {
    paint(btn.getAttribute("aria-pressed") !== "true");
  });
}

/* ------------------------------------------------------- screen sims -- */

/**
 * Classes and companion elements for each `data-ac-sim` name. Companions are
 * mounted and removed with the simulation rather than left in the DOM, where
 * with the effect off they would be stray absolutely-positioned spans.
 *
 * CRT carries the afterglow. They are separate classes and either still works
 * alone if you wire it yourself — but persistence is a property of the same
 * glass the scanlines are on, so a screen with one and not the other is not a
 * screen anybody has seen. Two switches, three classes.
 */
const SIMS = {
  plasma: { classes: ["ac-bloom"], children: ["ac-mesh"], defaultOn: true },
  crt: {
    classes: ["ac-crt", "ac-afterglow"],
    children: ["ac-retrace", "ac-persist"],
    defaultOn: false,
  },
};

/**
 * Simulations that make the same kind of claim and therefore cannot both be on.
 *
 * PLASMA and CRT are not two layers of glass, they are two display
 * technologies, and no panel is both: a frame carrying .ac-bloom and .ac-crt at
 * once has gas gaps and a scanning beam in the same enclosure, wearing a cell
 * mesh and raster blanking gaps at the same time. Those are the two textures
 * section 04 of the guide spends a paragraph telling apart — a screen door is
 * not a scanline, and there is no scan in a plasma panel to blank. Switching
 * either one ON switches the other OFF, in the same click, and both toggles
 * move to prove it.
 *
 * Both OFF stays allowed. That is a flat lit surface — no particular hardware,
 * and an honest thing to want to look at. This is exclusion, not a radio group.
 *
 * A DISPLAY preset must therefore name at most one of them in `data-ac-sims`;
 * listing both leaves whichever is applied last, which is not a useful thing to
 * have asked for.
 */
const EXCLUSIVE_SIMS = ["plasma", "crt"];

/** The frame every simulation paints on. Resolved once, on first use. */
function screenFrame() {
  return (screenFrame.cached ??=
    document.querySelector("[data-ac-screen]") ??
    document.querySelector(".ac-screen") ??
    null);
}

/**
 * Mount or unmount one simulation, and repaint every toggle that names it.
 *
 * Module scope rather than a closure inside initSims, because the DISPLAY
 * presets drive the same switches: picking CRT/P3 has to be able to put the
 * PLASMA toggle in the OFF position and mean it. Two code paths writing the
 * frame independently is how you end up with a lit .ac-bloom and a toggle
 * insisting plasma is off.
 */
function applySim(name, on) {
  const sim = SIMS[name];
  const frame = screenFrame();
  if (!sim || !frame) return;

  /* Exclusion runs here rather than in the click handler, because the DISPLAY
     presets and the restore path both write simulations through this function
     and a rule enforced in one of the three is not a rule. Only the ON branch
     recurses, and it recurses with `false`, so this is exactly one level deep
     and cannot loop. */
  if (on && EXCLUSIVE_SIMS.includes(name)) {
    for (const other of EXCLUSIVE_SIMS) {
      if (other !== name) applySim(other, false);
    }
  }

  for (const klass of sim.classes) frame.classList.toggle(klass, on);

  /* Reversed, because each one is PREPENDED: walking the list as written puts
     the children into the frame back-to-front. That is not cosmetic —
     .ac-retrace and .ac-persist both sit at z-index 45, so DOM order is the
     only thing breaking the tie between them, and a frame that mounted them
     from script composited fractionally differently from one that shipped them
     in markup. The list is declared in paint order; keep it that way. */
  for (const child of [...sim.children].reverse()) {
    const existing = frame.querySelector(`:scope > .${child}`);
    if (on && !existing) {
      const span = document.createElement("span");
      span.className = child;
      frame.prepend(span);
    } else if (!on && existing) {
      existing.remove();
    }
  }

  /* NOTHING HERE STARTS THE PERSISTENCE EFFECTS, and that is the split.
     Ghosting, the scroll smear and the framebuffer decay live in
     amber-console.effects.js, which may not be loaded — and when it is, it
     watches the frame's class list for `.ac-afterglow` itself rather than being
     told. Toggling the simulation is a DOM change; a module that can see the DOM
     needs no handshake, and a handshake would be one more thing to keep in sync
     across two files that are meant to be independently optional. */

  for (const btn of document.querySelectorAll(`[data-ac-sim="${name}"]`)) {
    btn.setAttribute("aria-pressed", String(on));
    btn.classList.toggle("ac-toggle--on", on);
    const state = btn.querySelector(".ac-toggle__state");
    if (state) state.textContent = on ? "ON" : "OFF";
  }

  /* Some styles have no default of their own — they take one from whatever the
     glass is now doing. The frame's classes are settled by this point, so this
     is the moment they can be read. */
  syncDerivedStyles();

  writeStored(name, on ? "1" : "0");
}

/**
 * PLASMA / CRT toggles. `data-ac-sim="plasma|crt"` on an .ac-toggle button,
 * `data-ac-screen` on the frame they apply to (defaults to the first .ac-screen).
 *
 * These switch the SIMULATION — what the glass does. They do not touch the
 * palette; which gas or which phosphor is lighting up is initDisplay's business
 * and lives on different attributes entirely. A user is free to run the CRT
 * simulation with a plasma gas in it, and the DISPLAY presets will tell them
 * they have (see MOD below), but nothing here stops them.
 *
 * The two simulations do exclude EACH OTHER — see EXCLUSIVE_SIMS. That is a
 * different statement from the one above: a gas behind a tube's glass is a
 * mismatch a user can want to look at, two enclosures at once is not a panel.
 */
function initSims() {
  const buttons = [...document.querySelectorAll("[data-ac-sim]")];
  if (!buttons.length || !screenFrame()) return;

  for (const name of Object.keys(SIMS)) {
    if (!buttons.some((b) => b.dataset.acSim === name)) continue;

    /* Defaults are per-simulation, not one flag for all of them.
       PLASMA is the design and not an enhancement, so it is on: the panel IS a
       matrix of gas gaps, and turning that off leaves a flat lit surface that is
       no particular hardware. CRT is the opposite — it simulates a DIFFERENT
       display technology, and its scanlines are the one thing a plasma panel
       conspicuously does not have. Shipping both on by default meant the first
       impression of the system was a plasma screen wearing a tube's blanking
       gaps. It stays one click away.

       A session stored before these two became exclusive can have BOTH keys
       reading "1". Declaration order settles it without extra bookkeeping:
       PLASMA is restored first, switches CRT off through applySim and writes
       that through, so CRT's own key already says "0" by the time it is read.
       Plasma winning is the right way round — it is the system's own hardware,
       and the one a returning visitor is least surprised to find still lit. */
    const stored = readStored(name);
    applySim(name, stored === null ? SIMS[name].defaultOn : stored === "1");

    for (const btn of buttons.filter((b) => b.dataset.acSim === name)) {
      if (wired.has(btn)) continue;
      wired.add(btn);
      btn.addEventListener("click", () => {
        applySim(name, btn.getAttribute("aria-pressed") !== "true");
        /* Deviating from the preset is allowed and is the point of the toggles
           still being there. It is just no longer the preset. */
        markModified();
      });
    }
  }
}

/* ---------------------------------------------------------------- display -- */

/**
 * DISPLAY — which hardware is in the panel. Two attributes on the ROOT element:
 *
 *   data-ac-tech      the technology: "plasma" (gas emitting directly) or "crt"
 *                     (a beam on a phosphor). What is making light at all.
 *   data-ac-emitter   which gas, or which phosphor, inside that technology.
 *
 * Root, not the frame, because the palette is not a property of the screen the
 * way .ac-bloom is. Tokens cascade, and a page can put .ac-badge or a code
 * sample outside .ac-screen — scoping the switch to the frame would leave those
 * on whichever palette :root happened to declare, which is the kind of split
 * nobody notices until a screenshot has two hues in it.
 *
 * TWO attributes and not one, because "which color" is not answerable on its
 * own: a gas and a phosphor can be the same color and are not the same thing.
 * Keeping the technology in the selector is what makes it impossible to offer
 * P39 as a gas or krypton as a phosphor — see the header of tokens/colors.css.
 *
 * THE CATALOG IS MARKUP, NOT A TABLE IN HERE. Each preset is a radio:
 *
 *   <input type="radio" name="ac-display" data-ac-display
 *          data-ac-tech="crt" data-ac-emitter="p3" data-ac-sims="crt">
 *
 * so a consumer who ships their own palettes writes their own rows and this file
 * needs no edit. `data-ac-sims` is the space-separated list of simulations that
 * technology implies; every other known simulation is switched OFF. That is the
 * whole preset behavior — pick CRT P3 and the CRT glass comes on and the plasma
 * bloom goes off, in one click, and both toggles move to prove it.
 *
 * A preset is a STARTING POINT, not a lock. Flip a simulation or a style
 * afterwards and the readout says MOD; nothing is prevented.
 */
function initDisplay() {
  const radios = [...document.querySelectorAll("[data-ac-display]")];
  const root = document.documentElement;

  /** Write the palette. Attributes only — no simulation is touched. */
  const paint = (tech, emitter) => {
    root.setAttribute("data-ac-tech", tech);
    root.setAttribute("data-ac-emitter", emitter);
    /* Deprecated, removed in 3.0. Kept in sync so a page still selecting on
       [data-ac-gas] does not silently fall back to :root mid-session. */
    if (tech === "plasma" && emitter === "neon") root.setAttribute("data-ac-gas", "neon");
    else if (tech === "crt" && emitter === "p3") root.setAttribute("data-ac-gas", "amber");
    else root.removeAttribute("data-ac-gas");

    for (const r of radios) {
      r.checked = r.dataset.acTech === tech && r.dataset.acEmitter === emitter;
    }

    writeStored("tech", tech);
    writeStored("emitter", emitter);
    paintReadout();
  };

  /* Restore. The palette is restored WITHOUT applying the preset's simulations,
     because initSims has already restored those from their own keys and they may
     legitimately disagree — that disagreement is exactly what MOD records. Only
     an actual click applies a whole preset. */
  const storedTech = readStored("tech");
  const storedEmitter = readStored("emitter");
  const known = radios.some(
    (r) => r.dataset.acTech === storedTech && r.dataset.acEmitter === storedEmitter
  );
  /* An unrecognized stored pair falls back rather than being written through — a
     stale key from a palette that has since been removed must not leave the
     panel unstyled. */
  if (known) paint(storedTech, storedEmitter);
  else if (radios.length) {
    const first = radios.find((r) => r.checked) ?? radios[0];
    paint(first.dataset.acTech, first.dataset.acEmitter);
  }
  modified = readStored("mod") === "1";
  paintReadout();

  for (const radio of radios) {
    if (wired.has(radio)) continue;
    wired.add(radio);
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      paint(radio.dataset.acTech, radio.dataset.acEmitter);

      /* The preset half of a preset: every simulation this technology implies
         goes on, every other one goes off. Listed sims that are not installed
         are ignored rather than throwing, so markup can name a simulation this
         build does not have yet. */
      const wanted = new Set((radio.dataset.acSims ?? "").split(/\s+/).filter(Boolean));
      for (const name of Object.keys(SIMS)) applySim(name, wanted.has(name));

      modified = false;
      writeStored("mod", "0");
      paintReadout();
    });
  }

  /* [data-ac-display-reset] puts the selected preset's simulations back. */
  for (const btn of document.querySelectorAll("[data-ac-display-reset]")) {
    if (wired.has(btn)) continue;
    wired.add(btn);
    btn.addEventListener("click", () => {
      /* FORGET THE DERIVED STYLES FIRST, and first is the load-bearing word:
         the change below runs applySim, which re-derives them — but only for
         flags with nothing stored. Clearing after would leave the user's old
         choice in place for one more preset, which is not what a reset is. */
      for (const [name, spec] of Object.entries(STYLES)) {
        if (typeof spec.defaultOn === "function") clearStored(`style.${name}`);
      }

      const current = radios.find((r) => r.checked);
      if (current) current.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
}

/**
 * Fill every [data-ac-display-out] with the current state.
 *
 * `label` is the one that matters: it rides in the menu bar, it is always
 * visible, and it always names the TECHNOLOGY first. Somebody scanning the board
 * should never have to remember whether P39 was a gas.
 *
 * `peak` comes off the catalog row rather than a table in here, for the same
 * reason the catalog itself does: a page shipping its own palettes states its own
 * wavelengths. The row is found by matching tech and emitter rather than by
 * reading `:checked`, so the legacy gas toggle — which sets the attributes
 * without touching a radio — still gets a number, and so a value that arrived
 * from localStorage cannot be interpolated into a selector.
 */
function paintReadout() {
  const root = document.documentElement;
  const tech = root.getAttribute("data-ac-tech") ?? "";
  const emitter = root.getAttribute("data-ac-emitter") ?? "";
  const mode = modified ? "MOD" : "PRESET";

  const row = [...document.querySelectorAll("[data-ac-display]")].find(
    (r) => r.dataset.acTech === tech && r.dataset.acEmitter === emitter
  );

  const values = {
    tech: tech.toUpperCase(),
    emitter: emitter.toUpperCase(),
    mode,
    /* An em dash, not an empty string: a readout that renders as nothing reads
       as a broken panel rather than as a palette that never declared a peak. */
    peak: row?.dataset.acPeak || "—",
    label: `${tech.toUpperCase()} · ${emitter.toUpperCase()}${modified ? " *MOD" : ""}`,
    /* Not part of the preset — see initEngine — but it belongs on the board,
       because "three of these effects are dark right now" is exactly the kind
       of thing a State panel exists to stop being a surprise. */
    /* What is actually rendering this panel, not what the flag permits. Under a
       plasma simulation or a microsecond phosphor the effects module contributes
       nothing, so "CSS + JS" beside a switch that reads OFF would be the readout
       disagreeing with the control right next to it. */
    engine: engineOn() && engineUseful() ? "CSS + JS" : "CSS ONLY",
  };

  for (const el of document.querySelectorAll("[data-ac-display-out]")) {
    const key = el.dataset.acDisplayOut;
    if (key in values) el.textContent = values[key];
  }

  paintInfo();

  /* AND THE PALETTE IS THE OTHER HALF OF THE ENGINE GATE. Every display change
     comes through here — presets, the legacy gas toggle, the restore path — and a
     change of emitter can move --ac-persist across the floor without the
     simulation moving at all. P39 to P11 is exactly that: still CRT, still
     afterglow, and the effects go from a two-second tail to 35 microseconds. */
  syncEngineControls();
}

/**
 * Show the note that describes the hardware currently in the panel.
 *
 * The prose is MARKUP, like the catalog is — one `[data-ac-display-info]` node
 * per key, all but the matching one `hidden`. Keeping the copy out of here is
 * what lets a page describe its own palettes, and what keeps the same string
 * from having to be escaped through JavaScript to reach a paragraph.
 *
 * A key is either a technology ("crt") or an exact palette ("crt/p3"). Exact
 * wins where one exists, so a phosphor whose behavior is not typical of its
 * technology — P7, whose whole point is a second, much slower layer — can say so
 * without every other phosphor needing its own paragraph.
 */
function paintInfo() {
  const root = document.documentElement;
  const tech = root.getAttribute("data-ac-tech");
  const exact = `${tech}/${root.getAttribute("data-ac-emitter")}`;

  const nodes = [...document.querySelectorAll("[data-ac-display-info]")];
  const specific = nodes.some((el) => el.dataset.acDisplayInfo === exact);

  for (const el of nodes) {
    const key = el.dataset.acDisplayInfo;
    el.hidden = specific ? key !== exact : key !== tech;
  }
}

/** Any deviation from the selected preset, by simulation or by style. */
function markModified() {
  modified = true;
  writeStored("mod", "1");
  paintReadout();
}

/* ------------------------------------------------------- gas (deprecated) -- */

/**
 * DEPRECATED, removed in 3.0. The old two-position GAS toggle, kept working for
 * pages that still ship `data-ac-gas-toggle` on a button.
 *
 * It was never a gas toggle. One of its two positions was a CRT phosphor, and a
 * control that calls a phosphor a gas is the confusion this release exists to
 * remove — see initDisplay. It now cycles the same two palettes through the new
 * attributes, so a page using it stays correct while it migrates, but it cannot
 * reach the rest of the catalog and will not grow to.
 *
 * Migrate to a [data-ac-display] radio per palette.
 */
const LEGACY_GASES = [
  { gas: "neon", tech: "plasma", emitter: "neon" },
  { gas: "amber", tech: "crt", emitter: "p3" },
];

function initGas() {
  const buttons = [...document.querySelectorAll("[data-ac-gas-toggle]")];
  if (!buttons.length) return;

  const root = document.documentElement;
  const apply = (entry) => {
    root.setAttribute("data-ac-tech", entry.tech);
    root.setAttribute("data-ac-emitter", entry.emitter);
    root.setAttribute("data-ac-gas", entry.gas);

    for (const btn of buttons) {
      btn.classList.toggle("ac-toggle--on", entry.gas !== LEGACY_GASES[0].gas);
      const state = btn.querySelector(".ac-toggle__state");
      if (state) state.textContent = entry.gas.toUpperCase();
    }

    writeStored("tech", entry.tech);
    writeStored("emitter", entry.emitter);
    paintReadout();
  };

  const stored = readStored("emitter");
  apply(LEGACY_GASES.find((e) => e.emitter === stored) ?? LEGACY_GASES[0]);

  for (const btn of buttons) {
    if (wired.has(btn)) continue;
    wired.add(btn);
    btn.addEventListener("click", () => {
      const now = root.getAttribute("data-ac-emitter");
      const i = LEGACY_GASES.findIndex((e) => e.emitter === now);
      apply(LEGACY_GASES[(i + 1) % LEGACY_GASES.length]);
    });
  }
}

/* ----------------------------------------------------------------- engine -- */

/**
 * ENGINE — which of the two files is allowed to contribute.
 *
 *   <button class="ac-toggle" data-ac-engine aria-pressed="true">
 *
 * writes data-ac-engine="css" or "css+js" on the ROOT element.
 *
 * A THIRD AXIS, and it has to be, because it is not the same kind of statement
 * as either of the other two. SIMULATION says what the glass is. STYLE says what
 * the viewer prefers. ENGINE says how much of the machinery is running — and the
 * answer changes which effects exist at all, without changing either what the
 * panel claims to be or what the viewer asked for. Filing it under STYLES would
 * have made "does this page run JavaScript" a comfort preference, which it is
 * not.
 *
 * It exists because the split is the library's actual shape and was, until now,
 * only ever described in source comments. Almost everything here is CSS: the
 * bloom, the cell mesh, the scanlines and the vignette, the blink decay, the
 * lingering halo, the residual patches, the radar sweep. Three effects are not,
 * and all three live in amber-console.effects.js — the ghosting of rewritten
 * text, the scroll smear, and the framebuffer decay on discrete swaps. Turning
 * this off leaves exactly those three dark and everything else running, which is
 * a far better answer to "what does the JavaScript buy me" than a paragraph.
 *
 * That file reads this attribute off the root itself; nothing here calls it.
 */
const ENGINE_DEFAULT_JS = true;

/** True when the JS effects are permitted. Mirrors engineOn() in the effects module. */
function engineOn() {
  const set = document.documentElement.getAttribute("data-ac-engine");
  return set === null ? ENGINE_DEFAULT_JS : set !== "css";
}

/**
 * THE SHORTEST TAIL WORTH OFFERING A SWITCH FOR, in milliseconds.
 *
 * All three JS effects are timed by --ac-persist. Measured against a 60Hz frame,
 * what each phosphor actually buys is:
 *
 *   P11  0.035ms   0.00 frames    nothing is composited at all
 *   P31  0.038ms   0.00 frames
 *   P4   0.06ms    0.00 frames
 *   P1   24ms      1.44 frames    one frame of ghost, then gone
 *   P3   25ms      1.50 frames
 *   gas  105ms     6.3 frames     the :root fallback
 *   P39  2000ms    120 frames
 *   P7   3000ms    180 frames
 *
 * THIS USED TO BE 5ms, WHICH IS A COMPOSITING FLOOR RATHER THAN A PERCEPTUAL
 * ONE. It asked "can a frame be drawn at all", so P1 and P3 cleared it and the
 * module spent real work on them — cloning nodes, mounting them into the
 * persistence layer, animating and removing them — to produce a ghost that
 * survives about one frame. That is not persistence, it is a single-frame
 * flicker, and on the two phosphors most people actually pick.
 *
 * 80ms is the perceptual floor, and it is not a new number: tokens/effects.css
 * has always said that "much under ~80ms and the eye stops reading a relaxation
 * and starts reading a switch". Using the figure the stylesheet already reasons
 * from makes the two agree instead of drawing different lines.
 *
 * The catalog is nowhere near the boundary in either direction — the nearest
 * values are 25ms below and 105ms above — so a single threshold stays safe
 * rather than becoming a fudge.
 *
 * WHAT THIS COSTS ON P1 AND P3: ghosting and the framebuffer decay, both of
 * which were invisible there. It also costs the scroll smear, and that one is
 * deliberate rather than collateral — the smear IS persistence, seen while the
 * image moves. A phosphor that does not hold between frames has nothing to trail
 * with, so a 25ms tube should not smear any more than it should ghost.
 */
const ENGINE_FLOOR_MS = 80;

/** The active palette's uncapped tail, in ms. Falls back to the :root default. */
function persistTailMs() {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--ac-persist-tail")
    .trim();
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return 105;
  return raw.endsWith("ms") ? n : n * 1000;
}

/**
 * Whether the ENGINE switch has anything on the other end of it.
 *
 * TWO CONDITIONS, AND THEY FAIL FOR DIFFERENT REASONS. Every effect in the
 * module is scoped to .ac-afterglow, which ships with the CRT simulation — so
 * under any plasma preset the switch is wired to nothing at all. And even with
 * the simulation on, a phosphor whose tail is measured in microseconds gives
 * those effects no time to be seen. The first is a mechanical no-op, the second
 * a perceptual one, and a control that cannot change what you are looking at
 * should say so either way rather than inviting a click that does nothing.
 */
function engineUseful() {
  return (
    Boolean(screenFrame()?.classList.contains("ac-afterglow")) &&
    persistTailMs() >= ENGINE_FLOOR_MS
  );
}

/**
 * Disable the ENGINE switch wherever it would be a no-op, and reveal the note
 * that says why. Runs from every path that can change either condition: the
 * simulation (applySim -> syncDerivedStyles), the palette (paintReadout) and the
 * flag itself (applyEngine).
 */
function syncEngineControls() {
  const live = engineUseful();
  /* FORCED OFF, NOT MERELY UNCLICKABLE. A switch reading ON while nothing it
     governs is running is a small lie, and it is the one the smear switch used to
     tell before it was removed. So the control shows what is actually
     contributing — engineOn() AND useful — rather than what the flag permits.

     THE FLAG ITSELF IS NOT WRITTEN, and that is the important half. Forcing
     data-ac-engine to "css" here would clobber a preference the user did express,
     and picking P39 again would leave the effects off with no way to know why.
     The attribute stays what it was, the module gates on the same three
     conditions in effectsActive(), and the switch comes back ON by itself when
     the panel is one where it means something. Same rule as the derived style
     defaults: a derived value fills a silence, it does not overwrite an answer. */
  const showing = live && engineOn();

  for (const btn of document.querySelectorAll("button[data-ac-engine]")) {
    btn.disabled = !live;
    btn.setAttribute("aria-pressed", String(showing));
    btn.classList.toggle("ac-toggle--on", showing);
    const state = btn.querySelector(".ac-toggle__state");
    if (state) state.textContent = showing ? "ON" : "OFF";
  }
  for (const note of document.querySelectorAll("[data-ac-engine-note]")) {
    note.hidden = live;
  }
}

function applyEngine(on, persist = true) {
  document.documentElement.setAttribute("data-ac-engine", on ? "css+js" : "css");

  if (persist) writeStored("engine", on ? "1" : "0");

  /* THE PAINTING IS ALL DOWN THERE, deliberately. This used to set aria-pressed
     and the ON/OFF text from `on` directly, which is the flag — but the control
     shows what is CONTRIBUTING, and those differ wherever the effects cannot be
     seen. Two code paths painting the same switch from two different truths is
     how it would end up reading ON under neon again. */
  syncEngineControls();
}

function initEngine() {
  /* The attribute goes on <html>, and the buttons are found there too — so the
     root itself would match [data-ac-engine] once applyEngine has written it.
     Buttons only. */
  const buttons = [...document.querySelectorAll("button[data-ac-engine]")];

  /* Same rule as the style flags: a stored preference is only restored while the
     page still ships a way to change it back. */
  const stored = buttons.length ? readStored("engine") : null;
  applyEngine(stored === null ? engineOn() : stored === "1", buttons.length > 0);

  for (const btn of buttons) {
    if (wired.has(btn)) continue;
    wired.add(btn);
    btn.addEventListener("click", () => {
      applyEngine(btn.getAttribute("aria-pressed") !== "true");

      /* Controls for effects that just stopped existing have to say so. */
      syncDerivedStyles();

      /* Deliberately NOT markModified(). MOD means the panel has been moved off
         the DISPLAY preset it was set from, and a preset is a statement about
         hardware — which gas, which phosphor, which simulation. How much of the
         library is running is not part of that claim and must not read as a
         change to it. */
      paintReadout();
    });
  }
}

/* ------------------------------------------------------------------ style -- */

/**
 * STYLE — everything that is NOT the hardware.
 *
 * Deliberately a separate axis from both DISPLAY and SIMULATION, on its own
 * attributes, in its own region of the drawer. A style is a LOOK the viewer
 * chose: comfort, density, typography — and, since `classic`, a look that
 * imitates a coarser raster. It makes no claim about WHAT THE PANEL IS. That is
 * the boundary, and it is worth stating precisely now that one of these flags
 * cuts the corners off every control: a bevel is not an assertion about which
 * gas is in the gap or which phosphor is on the glass, which is exactly what
 * DISPLAY and SIMULATION are for. "Turn the blink off" and "cut the corners" are
 * both preferences; "make it krypton" is not, and a user must never read one as
 * the other.
 *
 *   <button class="ac-toggle" data-ac-style="blink" aria-pressed="true">
 *
 * writes data-ac-style-blink="on|off" on the ROOT element. Always explicit, both
 * ways: CSS selecting on the absence of an attribute cannot express "the author
 * has not chosen" separately from "the author chose off", and the defaults below
 * are the only place that distinction is allowed to live.
 *
 * A `defaultOn` may be a FUNCTION, and then the default is derived from the
 * panel's current state rather than fixed. `needs` names the frame class the
 * style has no effect without, which is what lets a control that cannot do
 * anything say so instead of lying. See syncDerivedStyles.
 */
const STYLES = {
  blink: { defaultOn: true },
  /* NO `smear` ENTRY ANY MORE, and it is worth saying why rather than leaving a
     gap where a reader expects one.

     The smear was a STYLE flag that could only ever be on under CRT: every
     selector implementing it is scoped to .ac-afterglow, and a plasma cell is
     driven continuously and has nothing that trails. So it derived its default
     from the simulation and disabled itself under plasma — which is a switch
     that spends most of its life explaining why it cannot do anything, and a
     third axis of state for a preference nobody was expressing.

     It is now simply part of what amber-console.effects.js does: on wherever the
     persistence simulation is running and the engine flag permits it, off
     everywhere else, with no separate control and nothing to keep in sync.
     prefers-reduced-motion still stops it, which was the only accessibility case
     the flag was actually carrying. */
  /* CLASSIC BUTTONS — the cut corner, the extruded key edge and the top-left
     label. components/classic.css.

     No `needs`, and that is the interesting half. It is pure CSS on tokens and the
     corner shape, so it works under plasma, under CRT and with the effects bundle
     absent entirely; there is no frame class it could be a no-op without, so
     unlike `smear` this switch never has cause to disable itself.

     ON, because it is what the hardware looked like. Turning it off is a
     preference for a smoother corner than the panel could draw, which is a real
     thing to want and the reason the switch exists — but it is the departure from
     the panel, not the default reading of it. .ac-rounded is the same opt-out
     scoped to a region instead of the page. */
  classic: { defaultOn: true },
};

/** Current value of a style flag, defaults included. Safe before init. */
function styleOn(name) {
  const set = document.documentElement.getAttribute(`data-ac-style-${name}`);
  if (set !== null) return set === "on";
  const fallback = STYLES[name]?.defaultOn ?? true;
  return typeof fallback === "function" ? Boolean(fallback()) : Boolean(fallback);
}

/**
 * Write one style flag and repaint every control that names it.
 *
 * Module scope rather than a closure inside initStyle, for exactly the reason
 * applySim is: more than one code path writes these now — the click handler, the
 * restore, and applySim itself through syncDerivedStyles — and a rule enforced
 * in one of three places is not a rule.
 *
 * `persist` is the whole distinction between a preference and a derived default.
 * A value the USER chose is written to storage and owned by them from then on; a
 * value DERIVED from the simulation must not be, or the first switch of the
 * simulation would silently claim the preference and the derivation would never
 * run again.
 */
function applyStyle(name, on, persist = true) {
  document.documentElement.setAttribute(`data-ac-style-${name}`, on ? "on" : "off");

  for (const btn of document.querySelectorAll(`[data-ac-style="${name}"]`)) {
    btn.setAttribute("aria-pressed", String(on));
    btn.classList.toggle("ac-toggle--on", on);
    const state = btn.querySelector(".ac-toggle__state");
    if (state) state.textContent = on ? "ON" : "OFF";
  }

  if (persist) writeStored(`style.${name}`, on ? "1" : "0");
}

/**
 * Re-derive every style whose default is a function, and settle whether its
 * control can do anything at all.
 *
 * Called from applySim, because the thing these derive FROM is the simulation.
 *
 * A DERIVED DEFAULT ONLY FILLS IN A SILENCE. The moment the user clicks the
 * switch themselves the value is written to storage, and a stored value is never
 * overwritten here — from then on it is theirs and it stops following the
 * simulation. "Reset to Preset" clears the key, which is what puts it back to
 * following. That is the entire mechanism; there is no separate "has the user
 * touched this" flag, because localStorage already answers that question and a
 * second source of truth for it would be a thing to keep in sync.
 */
function syncDerivedStyles() {
  for (const [name, spec] of Object.entries(STYLES)) {
    if (typeof spec.defaultOn === "function" && readStored(`style.${name}`) === null) {
      applyStyle(name, Boolean(spec.defaultOn()), false);
    }

    /* A SWITCH THAT CANNOT DO ANYTHING SAYS SO. No shipped style needs this any
       more — the smear was the one that did, and it is no longer a style at all —
       but the mechanism stays because it is the framework's answer for a consumer
       flag that depends on a simulation, and because the ENGINE switch is gated
       the same way a few functions down. A control that can be clicked ON and
       produce nothing reads as a broken effect rather than as an effect this
       hardware does not have. */
    if (!spec.needs) continue;
    const live =
      Boolean(screenFrame()?.classList.contains(spec.needs)) && engineOn();
    for (const btn of document.querySelectorAll(`[data-ac-style="${name}"]`)) {
      btn.disabled = !live;
    }
    for (const note of document.querySelectorAll(`[data-ac-style-note="${name}"]`)) {
      note.hidden = live;
    }
  }

  /* The ENGINE switch depends on the simulation too — every effect it governs is
     scoped to .ac-afterglow — so it is settled on the same signal rather than
     given its own hook into applySim. */
  syncEngineControls();
}

function initStyle() {
  const buttons = [...document.querySelectorAll("[data-ac-style]")];
  const apply = applyStyle;

  for (const name of Object.keys(STYLES)) {
    /* A STORED PREFERENCE IS ONLY RESTORED WHILE THE PAGE STILL OFFERS A WAY TO
       CHANGE IT BACK. Take the switch out of the markup and the flag falls back
       to the author's own attribute, or to its default — because a preference
       with no control left on the page is not a preference, it is a setting the
       visitor can no longer reach, and one earlier click would have turned
       blink off on this page forever.

       Nothing is written back in that case either: the stored value still
       belongs to whatever page does ship the switch, and a page that only
       consumes the flag has no business overwriting it. */
    const control = buttons.some((b) => b.dataset.acStyle === name);
    const stored = control ? readStored(`style.${name}`) : null;

    /* AND A DERIVED DEFAULT IS NOT WRITTEN BACK ON LOAD EITHER, which is the
       same rule one level down: persisting it here would claim the preference
       on the first page view, before the user had touched anything, and a
       derived flag would stop following the simulation forever after. Only a value
       that was already stored — i.e. one the user chose — is re-stored. */
    const derived = typeof STYLES[name].defaultOn === "function";
    apply(
      name,
      stored === null ? styleOn(name) : stored === "1",
      control && !(derived && stored === null)
    );
  }

  for (const btn of buttons) {
    if (wired.has(btn)) continue;
    const name = btn.dataset.acStyle;
    if (!(name in STYLES)) continue;
    wired.add(btn);
    btn.addEventListener("click", () => {
      /* Clicking it is what makes it a preference: apply() persists, and from
         here on syncDerivedStyles leaves this flag alone. */
      apply(name, btn.getAttribute("aria-pressed") !== "true");
      markModified();
    });
  }

  /* Settle the disabled state for pages that ship no simulation switches at
     all — applySim is the usual caller and never runs on those. */
  syncDerivedStyles();
}

/* ----------------------------------------------------------------- dialog -- */

/** [data-ac-dialog-open="id"] calls showModal(); [data-ac-dialog-close] closes. */
function initDialogs() {
  document.addEventListener("click", (e) => {
    const opener = e.target.closest("[data-ac-dialog-open]");
    if (opener) {
      const dialog = document.getElementById(opener.dataset.acDialogOpen);
      if (dialog?.showModal) withDecay(() => dialog.showModal());
      return;
    }

    const closer = e.target.closest("[data-ac-dialog-close]");
    const dialog = closer?.closest("dialog");
    if (dialog) withDecay(() => dialog.close());
  });
}

/* ------------------------------------------------------------------- init -- */

/** Elements already wired, so a second init() cannot double-bind a listener. */
const wired = new WeakSet();
let globalsWired = false;
/** True once the panel differs from the DISPLAY preset it was set from. */
let modified = false;

/** Wire every [data-ac] element on the page. Safe to call more than once. */
function init(scope = document) {
  for (const el of scope.querySelectorAll('[data-ac="tabs"]')) {
    if (wired.has(el)) continue;
    wired.add(el);
    initTabs(el);
  }

  for (const el of scope.querySelectorAll('[data-ac="toggle"]')) {
    /* Sim and style toggles are driven by their own initializers; wiring both
       would flip twice and land back where it started. */
    if (
      wired.has(el) ||
      el.hasAttribute("data-ac-sim") ||
      el.hasAttribute("data-ac-style") ||
      el.hasAttribute("data-ac-engine")
    ) {
      continue;
    }
    wired.add(el);
    initToggle(el);
  }

  if (!globalsWired) {
    globalsWired = true;
    initDialogs();
  }
  /* Order matters exactly once: initSims restores the simulations from their own
     keys, and initDisplay then reads that settled state to decide whether the
     panel is on its preset or has been played with.

     initEngine goes first of all, because applySim derives style defaults and
     one of them asks whether the JS effects are running. Settling that after
     would mean the first pass computing it from the default rather than from
     the restored value. */
  initEngine();
  initSims();
  initStyle();
  initDisplay();
  initGas(); /* deprecated; no-op unless a page still ships the old button */
}

/**
 * MOVED — this is a forwarding shim, kept so existing calls keep working.
 *
 * Ghosting now lives in amber-console.effects.js, because it is an effect and
 * this file is behavior. Call `AmberConsoleEffects.afterglow(row)` directly;
 * this delegates when that module is present and does nothing when it is not,
 * which is the same no-op it always was with the simulation switched off.
 *
 *   AmberConsole.afterglow(row);   // still works
 *   row.remove();
 *
 * Removed in 3.0, with the rest of the deprecations.
 */
function afterglow(el) {
  globalThis.AmberConsoleEffects?.afterglow?.(el);
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init());
  } else {
    init();
  }
}

window.AmberConsole = { init: init, afterglow: afterglow };
})();

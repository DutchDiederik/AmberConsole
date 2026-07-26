/*! Amber Console 1.0.0 | MIT | classic-script build
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
 * absent; nothing here affects appearance. It exists only for the five things
 * CSS genuinely cannot express:
 *
 *   1. the role="tablist" keyboard model
 *   2. flipping an aria-pressed toggle (the CSS-only .ac-toggle--input variant
 *      needs no JS at all — prefer it when you do not need a <button>)
 *   3. the PLASMA and CRT screen simulations, which persist across reloads, and
 *      the afterglow that rides with CRT — whose ghosts need the value a readout
 *      held one frame ago, the one thing on that list CSS cannot see
 *   4. opening and closing a native <dialog>
 *   5. the NEON/AMBER gas toggle, which likewise persists — the palettes
 *      themselves are pure CSS and switch on a `data-ac-gas` attribute you can
 *      just as well write into your own markup
 *
 * No dependencies, no build step, no framework. Auto-initialises on DOM ready
 * when loaded with <script type="module" src="amber-console.js"></script>.
 * Using React/Vue/Svelte? Skip it — drive the same ARIA attributes yourself and
 * the CSS follows.
 */

const STORE_PREFIX = "ac.sim.";

/**
 * Live, so a preference changed mid-session is honoured without a reload — and
 * guarded, so importing this module in a Node/SSR pass does not throw before it
 * reaches the DOM check at the bottom of the file.
 */
const REDUCED_MOTION =
  typeof matchMedia === "function"
    ? matchMedia("(prefers-reduced-motion: reduce)")
    : { matches: false };

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
    if (tab && tabs.includes(tab)) select(tab);
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
    select(next);
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

/* ---------------------------------------------------- plasma afterglow -- */

/**
 * A cell that stops being driven relaxes rather than switching off, so the
 * value a readout held one frame ago is still faintly on the glass. CSS handles
 * that for anything that merely *hides* — see the decay-out block in
 * tokens/effects.css — but it cannot reach the case that sells the effect: text
 * being rewritten in place. Nothing in the cascade remembers the old string.
 *
 * So: watch the frame, and when text changes, park a copy of the OLD text at
 * the rect it occupied and let tokens/effects.css drain it.
 */

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

/** Ghosts are decoration made of duplicated content — hide them completely. */
function sanitize(node) {
  node.removeAttribute?.("id");
  for (const el of node.querySelectorAll?.("[id]") ?? []) el.removeAttribute("id");
  node.setAttribute("aria-hidden", "true");
  node.inert = true;
  node.tabIndex = -1;
}

/**
 * Park a decaying copy of `source` on the persistence layer.
 *
 * @param {Element} source  the element to ghost — must still be in the document,
 *                          because its rect is what the ghost is pinned to
 * @param {string} [text]   value to show instead of the source's current one;
 *                          this is how a rewritten readout ghosts its old value
 * @param {boolean} [fast]  use --ac-decay-fast, for continuously updating text
 */
function spawnGhost(source, text, fast) {
  /* A background tab does not advance the animation clock, so a ghost spawned
     into one never reaches animationend and never cleans itself up. Nothing is
     being looked at either way — decline, rather than bank stale nodes for
     whenever the tab comes back.

     Same failure, different cause, under prefers-reduced-motion: the CSS hides
     .ac-ghost outright, and a display:none element never runs its animation, so
     animationend never fires and the self-removal below never happens. GHOST_LIMIT
     caps the pile at 24 rather than letting it grow without bound, but the right
     answer is not to clone, measure and park a node nobody will ever see — for
     exactly the users who asked for less of this. */
  if (document.hidden || REDUCED_MOTION.matches) return;

  const frame = source.closest(".ac-afterglow");
  const layer = frame?.querySelector(":scope > .ac-persist");
  if (!layer) return;

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
      let host = m.type === "characterData" ? m.target.parentElement : m.target;
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

    for (const [host, old] of seen) spawnGhost(host, old, true);
  });
}

/* ---------------------------------------------------- scroll smear -- */

/** Per-frame scroll distance, in px, that saturates the smear. */
const SMEAR_FULL = 55;
/**
 * Geometric drain per frame once the scroll stops. At 60fps the loop stops
 * itself ~130ms in, when it crosses the floor. The tail wants to be short: a
 * smear that outlives the scroll by much stops reading as persistence and starts
 * reading as lag. While you are actually scrolling the smear is held up by
 * velocity, so this governs the release and nothing else.
 */
const SMEAR_DRAIN = 0.55;

/**
 * Drive `--ac-smear` on the frame from actual scroll speed.
 *
 * Scrolling hands every cell on the panel a new value at once, which is the
 * largest light-off event there is, so it is also where the gas visibly fails
 * to keep up. The CSS in tokens/effects.css turns this number into a blurred
 * additive copy of the backdrop.
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
    smear = target > smear ? target : smear * SMEAR_DRAIN;

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
      last = window.scrollY;
      window.addEventListener("scroll", onScroll, { passive: true });
    },
    disconnect() {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      clear();
    },
  };
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
 * PLASMA / CRT / AFTERGLOW toggles. `data-ac-sim="plasma|crt|afterglow"` on an
 * .ac-toggle button, `data-ac-screen` on the frame they apply to (defaults to
 * the first .ac-screen).
 */
function initSims() {
  const buttons = [...document.querySelectorAll("[data-ac-sim]")];
  if (!buttons.length) return;

  const frame =
    document.querySelector("[data-ac-screen]") ?? document.querySelector(".ac-screen");
  if (!frame) return;

  const apply = (name, on) => {
    const sim = SIMS[name];
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

    if (sim.classes.includes("ac-afterglow")) {
      ghostObserver ??= makeGhostObserver(frame);
      scrollSmear ??= makeScrollSmear(frame);
      if (on) {
        ghostObserver.observe(frame, {
          subtree: true,
          childList: true,
          characterData: true,
          characterDataOldValue: true,
        });
        scrollSmear.connect();
      } else {
        ghostObserver.disconnect();
        scrollSmear.disconnect();
      }
    }

    for (const btn of buttons.filter((b) => b.dataset.acSim === name)) {
      btn.setAttribute("aria-pressed", String(on));
      btn.classList.toggle("ac-toggle--on", on);
      const state = btn.querySelector(".ac-toggle__state");
      if (state) state.textContent = on ? "ON" : "OFF";
    }

    writeStored(name, on ? "1" : "0");
  };

  for (const name of Object.keys(SIMS)) {
    if (!buttons.some((b) => b.dataset.acSim === name)) continue;

    /* Defaults are per-simulation, not one flag for all of them.
       PLASMA is the design and not an enhancement, so it is on: the panel IS a
       matrix of gas gaps, and turning that off leaves a flat lit surface that is
       no particular hardware. CRT is the opposite — it simulates a DIFFERENT
       display technology, and its scanlines are the one thing a plasma panel
       conspicuously does not have. Shipping both on by default meant the first
       impression of the system was a plasma screen wearing a tube's blanking
       gaps. It stays one click away. */
    const stored = readStored(name);
    apply(name, stored === null ? SIMS[name].defaultOn : stored === "1");

    for (const btn of buttons.filter((b) => b.dataset.acSim === name)) {
      if (wired.has(btn)) continue;
      wired.add(btn);
      btn.addEventListener("click", () => {
        apply(name, btn.getAttribute("aria-pressed") !== "true");
      });
    }
  }
}

/* -------------------------------------------------------------------- gas -- */

/** Palette names, in toggle order. See the header of tokens/colors.css. */
const GASES = ["neon", "amber"];

/**
 * GAS toggle. `data-ac-gas-toggle` on an .ac-toggle button; the attribute this
 * writes is `data-ac-gas` on the ROOT element, not on the frame.
 *
 * Root, because the palette is not a property of the screen the way .ac-bloom
 * is. Tokens cascade, and a page can put .ac-badge or a code sample outside
 * .ac-screen — scoping the switch to the frame would leave those on whichever
 * gas :root happened to declare, which is the kind of split nobody notices until
 * a screenshot has two hues in it.
 *
 * Unlike the sims this is NOT on/off, so aria-pressed would be a lie: neither
 * state is "not pressed". The button carries the palette name instead, and
 * .ac-toggle--on tracks the non-default gas purely so the track renders as
 * thrown. CSS-only consumers can set data-ac-gas in their own markup and never
 * load this file.
 */
function initGas() {
  const buttons = [...document.querySelectorAll("[data-ac-gas-toggle]")];
  if (!buttons.length) return;

  const apply = (gas) => {
    document.documentElement.setAttribute("data-ac-gas", gas);

    for (const btn of buttons) {
      btn.classList.toggle("ac-toggle--on", gas !== GASES[0]);
      const state = btn.querySelector(".ac-toggle__state");
      if (state) state.textContent = gas.toUpperCase();
    }

    writeStored("gas", gas);
  };

  /* NEON is the default because it is the one derived from the hardware this
     system claims to be; AMBER is the phosphor look kept as an option. An
     unrecognised stored value falls back rather than being written through — a
     stale key from a future palette must not leave the panel unstyled. */
  const stored = readStored("gas");
  apply(GASES.includes(stored) ? stored : GASES[0]);

  for (const btn of buttons) {
    if (wired.has(btn)) continue;
    wired.add(btn);
    btn.addEventListener("click", () => {
      const now = document.documentElement.getAttribute("data-ac-gas");
      apply(GASES[(GASES.indexOf(now) + 1) % GASES.length]);
    });
  }
}

/* ----------------------------------------------------------------- dialog -- */

/** [data-ac-dialog-open="id"] calls showModal(); [data-ac-dialog-close] closes. */
function initDialogs() {
  document.addEventListener("click", (e) => {
    const opener = e.target.closest("[data-ac-dialog-open]");
    if (opener) {
      const dialog = document.getElementById(opener.dataset.acDialogOpen);
      if (dialog?.showModal) dialog.showModal();
      return;
    }

    const closer = e.target.closest("[data-ac-dialog-close]");
    if (closer) closer.closest("dialog")?.close();
  });
}

/* ------------------------------------------------------------------- init -- */

/** Elements already wired, so a second init() cannot double-bind a listener. */
const wired = new WeakSet();
let globalsWired = false;
/** One observer for the page, connected and disconnected by the toggle. */
let ghostObserver = null;
/** One scroll-smear driver, likewise. */
let scrollSmear = null;

/** Wire every [data-ac] element on the page. Safe to call more than once. */
function init(scope = document) {
  for (const el of scope.querySelectorAll('[data-ac="tabs"]')) {
    if (wired.has(el)) continue;
    wired.add(el);
    initTabs(el);
  }

  for (const el of scope.querySelectorAll('[data-ac="toggle"]')) {
    /* Sim toggles are driven by initSims; wiring both would flip twice. */
    if (wired.has(el) || el.hasAttribute("data-ac-sim")) continue;
    wired.add(el);
    initToggle(el);
  }

  if (!globalsWired) {
    globalsWired = true;
    initDialogs();
  }
  initSims();
  initGas();
}

/**
 * Leave a decaying copy of `el` behind. Call it BEFORE you remove or empty the
 * element — a detached node has no rect, so there is nowhere to pin the ghost.
 *
 * Text rewrites inside the frame already ghost themselves; this is for the case
 * the observer cannot serve, which is a node that is about to stop existing.
 *
 *   AmberConsole.afterglow(row);
 *   row.remove();
 *
 * A no-op when the afterglow simulation is off, so it is always safe to call.
 */
function afterglow(el) {
  if (el instanceof Element) spawnGhost(el);
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

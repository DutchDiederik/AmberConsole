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
 * Live, so a preference changed mid-session is honored without a reload — and
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

/**
 * Ghosts are decoration made of duplicated content — hide them completely, and
 * cut every wire the original had.
 *
 * `id` is the obvious one. The `data-ac-*` hooks are the subtle one and they
 * matter more: every initializer here finds its elements with a document-wide
 * querySelectorAll, so a clone that kept its hooks is still a match. A ghosted
 * readout gets rewritten by the next paint — with the LIVE value, which is the
 * one thing a ghost must never show, since the whole point of it is the value
 * the panel held a moment ago. A ghosted toggle gets its thumb moved by the next
 * applySim. The ghost is a photograph; nothing may keep writing on it.
 *
 * .ac-persist is PREPENDED to the frame, so ghosts also come first in document
 * order — a stale ghost does not merely paint wrong, it is what a plain
 * querySelector finds instead of the real element.
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
      if (styleOn("smear")) scrollSmear.connect();
    } else {
      ghostObserver.disconnect();
      scrollSmear.disconnect();
    }
  }

  for (const btn of document.querySelectorAll(`[data-ac-sim="${name}"]`)) {
    btn.setAttribute("aria-pressed", String(on));
    btn.classList.toggle("ac-toggle--on", on);
    const state = btn.querySelector(".ac-toggle__state");
    if (state) state.textContent = on ? "ON" : "OFF";
  }

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
       gaps. It stays one click away. */
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
  };

  for (const el of document.querySelectorAll("[data-ac-display-out]")) {
    const key = el.dataset.acDisplayOut;
    if (key in values) el.textContent = values[key];
  }

  paintInfo();
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

/* ------------------------------------------------------------------ style -- */

/**
 * STYLE — everything that is NOT the hardware.
 *
 * Deliberately a separate axis from both DISPLAY and SIMULATION, on its own
 * attributes, in its own region of the drawer. A style is a preference: comfort,
 * density, typography. It makes no claim about what the panel is. That boundary
 * is the whole reason this is not simply more simulation toggles — "turn the
 * blink off" is not a statement about plasma, and a user must never read it as
 * one.
 *
 *   <button class="ac-toggle" data-ac-style="blink" aria-pressed="true">
 *
 * writes data-ac-style-blink="on|off" on the ROOT element. Always explicit, both
 * ways: CSS selecting on the absence of an attribute cannot express "the author
 * has not chosen" separately from "the author chose off", and the defaults below
 * are the only place that distinction is allowed to live.
 */
const STYLES = {
  blink: { defaultOn: true },
  smear: { defaultOn: true },
};

/** Current value of a style flag, defaults included. Safe before init. */
function styleOn(name) {
  const set = document.documentElement.getAttribute(`data-ac-style-${name}`);
  return set === null ? (STYLES[name]?.defaultOn ?? true) : set === "on";
}

function initStyle() {
  const buttons = [...document.querySelectorAll("[data-ac-style]")];

  const apply = (name, on) => {
    document.documentElement.setAttribute(`data-ac-style-${name}`, on ? "on" : "off");

    /* Smear is the one style with a running cost rather than a CSS rule — the
       rAF loop has to actually stop. It only exists while the afterglow does. */
    if (name === "smear" && scrollSmear) {
      if (on && screenFrame()?.classList.contains("ac-afterglow")) scrollSmear.connect();
      else scrollSmear.disconnect();
    }

    for (const btn of document.querySelectorAll(`[data-ac-style="${name}"]`)) {
      btn.setAttribute("aria-pressed", String(on));
      btn.classList.toggle("ac-toggle--on", on);
      const state = btn.querySelector(".ac-toggle__state");
      if (state) state.textContent = on ? "ON" : "OFF";
    }

    writeStored(`style.${name}`, on ? "1" : "0");
  };

  for (const name of Object.keys(STYLES)) {
    const stored = readStored(`style.${name}`);
    apply(name, stored === null ? STYLES[name].defaultOn : stored === "1");
  }

  for (const btn of buttons) {
    if (wired.has(btn)) continue;
    const name = btn.dataset.acStyle;
    if (!(name in STYLES)) continue;
    wired.add(btn);
    btn.addEventListener("click", () => {
      apply(name, btn.getAttribute("aria-pressed") !== "true");
      markModified();
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
/** True once the panel differs from the DISPLAY preset it was set from. */
let modified = false;

/** Wire every [data-ac] element on the page. Safe to call more than once. */
export function init(scope = document) {
  for (const el of scope.querySelectorAll('[data-ac="tabs"]')) {
    if (wired.has(el)) continue;
    wired.add(el);
    initTabs(el);
  }

  for (const el of scope.querySelectorAll('[data-ac="toggle"]')) {
    /* Sim and style toggles are driven by their own initializers; wiring both
       would flip twice and land back where it started. */
    if (wired.has(el) || el.hasAttribute("data-ac-sim") || el.hasAttribute("data-ac-style")) {
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
     panel is on its preset or has been played with. */
  initSims();
  initStyle();
  initDisplay();
  initGas(); /* deprecated; no-op unless a page still ships the old button */
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
export function afterglow(el) {
  if (el instanceof Element) spawnGhost(el);
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init());
  } else {
    init();
  }
}

export default { init, afterglow };

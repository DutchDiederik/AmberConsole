/* TELEMARK 400 market terminal demo behavior. Vanilla, no dependencies.
 *
 * Demo logic only. The tab keyboard model, the display board and the toggles are
 * the framework's (../dist/amber-console.js); the ghosting is the effects
 * module's (../dist/amber-console.effects.js). What is left here is the fiction
 * of a line that is delivering prices.
 *
 * THE GHOST BUDGET IS WHAT SHAPES THIS FILE, and it is worth writing down
 * because the constraint and the period behavior turn out to be the same thing.
 *
 * amber-console.effects.js caps concurrent ghosts at GHOST_LIMIT = 24, and
 * MAX_GENERATIONS = 4 decides whether a rewrite gets the emitter's full tail or
 * the capped fast path. A page that repriced forty cells at once would blow both
 * in a single tick and the screen would turn to mush.
 *
 * It never happened on the real thing either. A contributed page did not update
 * wholesale — one bank revised one pair, and that cell was the only thing on the
 * screen that moved. So this file reprices ONE INSTRUMENT PER TICK and writes
 * three or four cells doing it. On P39 (--ac-persist: 2000ms) the fast-path
 * threshold is tail/4 = 500ms, so the 1400ms cadence below runs the FULL tail:
 * two legible generations of the same quote, which is exactly the effect the
 * constant was written for. Concurrent ghosts settle around six.
 *
 * Determinism, as on the server and radar pages: THE MARKUP IS FRAME ZERO. Every
 * number in terminal.html is what this file would compute before the first tick;
 * nothing is randomized on load; drift comes from a seeded Lehmer generator
 * rather than Math.random; and the first tick is held to 2.5s so it lands well
 * clear of the visual suite's shutter, measured at 800-1300ms. Only the three
 * clocks are painted at load, and they read a Date the harness freezes.
 */

/* ------------------------------------------------------------ P39 first -- *
 * FIT THE RIGHT TUBE BEFORE THE FRAMEWORK LOOKS.
 *
 * Same mechanism, and the same reasoning, as the note at the top of radar.js:
 * the chosen display is stored under one key namespace shared by every page in
 * this repo, so a visitor arriving from the console demo brings PLASMA · NEON
 * with them. Neon is a 105ms panel. On it a reprice is simply gone by the next
 * frame, and the argument this page exists to make — that you can read the value
 * a quote replaced — has nothing to stand on.
 *
 * P39 is willemite with arsenic: the same green as P1 with the decay lengthened
 * by orders of magnitude. On a first visit this seeds it and records that it has
 * done so, at parse time, before the framework's DOMContentLoaded init reads any
 * of it — so there is no frame of the wrong palette. On every later visit the
 * flag is set and whatever you chose here is what you get.
 * ------------------------------------------------------------------------- */
(function () {
  try {
    if (localStorage.getItem("ac.term.fitted")) return;
    localStorage.setItem("ac.sim.tech", "crt");
    localStorage.setItem("ac.sim.emitter", "p39");
    localStorage.setItem("ac.sim.crt", "1");
    localStorage.setItem("ac.sim.plasma", "0");
    localStorage.setItem("ac.sim.mod", "0");
    localStorage.setItem("ac.term.fitted", "1");
  } catch {
    /* Private mode and sandboxed file:// frames throw. The markup has P39
       checked, so a store that cannot be written still opens on the right tube;
       only the CRT simulation is lost, and the board can turn it on. */
  }
})();

(function () {
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return [].slice.call(document.querySelectorAll(s)); };
  var pad = function (n, w) { n = String(n); while (n.length < w) n = "0" + n; return n; };

  function setText(el, s) {
    if (el && el.textContent !== s) el.textContent = s;
  }

  /* MINSTD, as on the other two demo pages: 16807 * 2147483646 is exact in a
     double, so the sequence is reproducible run to run. */
  var seed = 15031988;
  function rnd() {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  }
  var pick = function (arr) { return arr[Math.floor(rnd() * arr.length)]; };

  /* Wrap a discrete change so the screen it replaces drains per pixel. Declines
     safely when persistence is off or the API is missing. */
  function withDecay(fn) {
    var vt = window.AmberConsoleEffects && window.AmberConsoleEffects.transition;
    if (typeof vt === "function") vt(fn);
    else fn();
  }

  /* ------------------------------------------------------------- quotes -- */

  /* Read the page rather than carry a second copy of it. The markup is the
     source of truth for frame zero, so parsing it back is what guarantees the
     first tick continues from exactly what is on the glass. */
  var QUOTES = $$("#fxsp tr").map(function (tr) {
    var cell = function (q) { return tr.querySelector('[data-q="' + q + '"]'); };
    var dp = (cell("bid").textContent.split(".")[1] || "").length;
    return {
      tr: tr,
      pair: tr.getAttribute("data-pair"),
      dp: dp,
      pip: Math.pow(10, -dp),
      bid: parseFloat(cell("bid").textContent),
      ask: parseFloat(cell("ask").textContent),
      high: parseFloat(cell("high").textContent),
      low: parseFloat(cell("low").textContent),
      net: parseInt(cell("net").textContent, 10),
      cell: cell
    };
  });

  var BY_PAIR = {};
  QUOTES.forEach(function (q) { BY_PAIR[q.pair] = q; });

  /* A field that has just changed inverts for a moment. That is how these
     screens flagged an update before a color tube was affordable, and it is the
     law-1 answer to the same question today. The ghost of the old value is the
     effects module's doing and is a separate mechanism — together they read as
     one event, which is the point. */
  var TICK_MS = 1500;
  function flash(el) {
    if (!el) return;
    el.classList.add("doc-tick");
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove("doc-tick"); }, TICK_MS);
  }

  function quoteTime() {
    var d = new Date();
    return pad(d.getUTCHours(), 2) + ":" + pad(d.getUTCMinutes(), 2);
  }

  var updates = 0;
  var tickets = 218;

  /* ONE INSTRUMENT, THREE OR FOUR CELLS. See the note at the top of the file:
     this budget is the whole reason the page reads as a market rather than as a
     screensaver. */
  function reprice() {
    var q = pick(QUOTES);

    /* A move of one to six pips, occasionally a jump. Spreads widen when it
       moves hard, which is the first thing that happens on a real screen and the
       last thing a demo usually bothers with. */
    var jump = rnd() < 0.08;
    var pips = Math.ceil(rnd() * (jump ? 14 : 6));
    var dir = rnd() < 0.5 ? -1 : 1;
    var spread = Math.round((q.ask - q.bid) / q.pip);
    if (jump) spread = Math.min(spread + Math.ceil(rnd() * 4), spread * 3);

    q.bid = +(q.bid + dir * pips * q.pip).toFixed(q.dp);
    q.ask = +(q.bid + spread * q.pip).toFixed(q.dp);
    q.net += dir * pips;

    setText(q.cell("bid"), q.bid.toFixed(q.dp));
    setText(q.cell("ask"), q.ask.toFixed(q.dp));
    setText(q.cell("net"), (q.net >= 0 ? "+" : "") + q.net);
    setText(q.cell("time"), quoteTime());
    flash(q.cell("bid"));
    flash(q.cell("ask"));

    /* The extremes only move when they are actually taken out, which is most
       ticks writing nothing here at all. */
    if (q.bid > q.high) {
      q.high = q.bid;
      setText(q.cell("high"), q.high.toFixed(q.dp));
      flash(q.cell("high"));
    } else if (q.bid < q.low) {
      q.low = q.bid;
      setText(q.cell("low"), q.low.toFixed(q.dp));
      flash(q.cell("low"));
    }

    updates += 1;
    if (rnd() < 0.35) tickets += 1;
    return q;
  }

  /* --------------------------------------------------------------- book -- */

  /* The desk is marked every fourth tick rather than every one. A book being
     revalued on every quote in the market is not how it worked, and it is three
     more cell rewrites per tick against a budget this page is deliberately
     spending carefully. */
  var BOOK = {
    DEM: { pos: 12500000, avg: 1.7802, pair: "USD/DEM", inverse: true },
    JPY: { pos: -850000000, avg: 128.92, pair: "USD/JPY", inverse: true },
    GBP: { pos: 3000000, avg: 1.7688, pair: "GBP/USD", inverse: false },
    CHF: { pos: 0, avg: null, pair: "USD/CHF", inverse: true }
  };

  var group = function (n) {
    return (n < 0 ? "-" : "+") + Math.abs(Math.round(n)).toLocaleString("en-US");
  };

  function markBook() {
    var net = 0;
    for (var ccy in BOOK) {
      var b = BOOK[ccy];
      var q = BY_PAIR[b.pair];
      if (!q) continue;
      var mid = (q.bid + q.ask) / 2;
      var row = $('#book tr[data-book="' + ccy + '"]');

      /* USD/XXX is quoted the other way up from the position it creates, so the
         P&L is in dollars either way — which is the column heading. */
      var pnl = b.avg === null ? 0
        : b.inverse ? b.pos * (1 / mid - 1 / b.avg)
          : b.pos * (mid - b.avg);

      setText(row.querySelector("[data-mark]"), mid.toFixed(q.dp));
      setText(row.querySelector("[data-pnl]"), b.pos === 0 ? "0" : group(pnl));
      net += pnl;
    }
    setText($("#pnl-net"), group(net));
  }

  /* --------------------------------------------------------------- page -- */

  var PAGES = ["FXSP", "XRAT", "DEPO", "GOVT", "INDX"];
  var TITLES = {
    FXSP: "SPOT FOREIGN EXCHANGE",
    XRAT: "CROSS RATES",
    DEPO: "EUROCURRENCY DEPOSITS",
    GOVT: "GOVERNMENT BONDS",
    INDX: "INDEX SUMMARY"
  };

  var MID_UNIT = { USD: 1, DEM: 1, JPY: 100, GBP: 1, CHF: 1, FRF: 100, NLG: 100, ITL: 1000 };
  var MID_CCY = ["USD", "DEM", "JPY", "GBP", "CHF", "FRF", "NLG", "ITL"];

  /* THE MATRIX IS RECOMPUTED WHEN THE PAGE IS ASKED FOR, not as the spot page
     moves. Two reasons, and they agree: a page terminal computed a page when you
     called it up, and repricing 56 cells behind a tab nobody is looking at would
     be the one thing on this page capable of emptying the ghost budget in a
     single frame. Deriving it from the live quotes is also what stops the two
     pages ever contradicting each other. */
  function paintCrossRates() {
    var mid = { USD: 1 };
    var legs = {
      DEM: "USD/DEM", JPY: "USD/JPY", CHF: "USD/CHF",
      FRF: "USD/FRF", NLG: "USD/NLG", ITL: "USD/ITL"
    };
    for (var c in legs) {
      var q = BY_PAIR[legs[c]];
      mid[c] = (q.bid + q.ask) / 2;
    }
    var g = BY_PAIR["GBP/USD"];
    mid.GBP = 1 / ((g.bid + g.ask) / 2);

    var sig = function (v) {
      if (v >= 10000) return Math.round(v).toLocaleString("en-US");
      if (v >= 1000) return v.toFixed(1);
      if (v >= 100) return v.toFixed(2);
      if (v >= 10) return v.toFixed(3);
      return v.toFixed(4);
    };

    var rows = $$("#xrat tr");
    for (var r = 0; r < MID_CCY.length; r++) {
      var row = MID_CCY[r];
      var cells = rows[r].querySelectorAll("td");
      var i = 0;
      for (var k = 0; k < MID_CCY.length; k++) {
        var col = MID_CCY[k];
        if (col === row) { i++; continue; }
        setText(cells[i], sig((mid[col] / mid[row]) * MID_UNIT[row]));
        i++;
      }
    }
    /* Stamped, because it is a snapshot and saying so is the difference between
       a derived page and a page that is quietly stale. */
    setText($("#xrat-at"), quoteTime());
  }

  var current = "FXSP";
  var TABS = $$("[data-code]");

  /* Exactly what initTabs' own select() does in amber-console.js, done here
     instead. THE POINT IS TO OWN THE MOMENT IT HAPPENS: the panel swap has to
     occur INSIDE the view transition's callback or the framebuffer decay has
     nothing to compare against, and a listener on the container cannot promise
     that. The soft key stops the event before it reaches the framework's
     delegated handler and calls this instead, so both doors — the key and the
     entry line — go through one place and the screen drains either way.
     The framework keeps the roving tabindex and the arrow keys, which is the
     half of a tablist worth having and the half that is tedious to get right. */
  function select(code) {
    for (var i = 0; i < TABS.length; i++) {
      var tab = TABS[i];
      var on = tab.getAttribute("data-code") === code;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      tab.classList.toggle("ac-tab--active", on);
      var panel = document.getElementById(tab.getAttribute("aria-controls"));
      if (panel) panel.hidden = !on;
    }
    current = code;
    setText($("#headline"), code + " · " + TITLES[code]);
    setText($("#st-page"), "PAGE " + code);
    setText($("#st-msg"), "PAGE " + code + " RETRIEVED");
    $("#page-entry").value = code;
    $("#page-entry").removeAttribute("aria-invalid");
  }

  function showPage(code) {
    code = String(code || "").trim().toUpperCase();
    if (PAGES.indexOf(code) === -1) {
      $("#page-entry").setAttribute("aria-invalid", "true");
      setText($("#st-msg"), "PAGE " + (code || "?") + " NOT FOUND");
      return false;
    }
    if (code === current) {
      $("#page-entry").removeAttribute("aria-invalid");
      return true;
    }

    /* Changing page on a long phosphor is not a cut. The old screen is still
       draining while the new one fills in underneath it — the same call the
       radar page uses for a range change. The matrix is recomputed inside the
       callback so it is already right in the frame being transitioned to. */
    withDecay(function () {
      if (code === "XRAT") paintCrossRates();
      select(code);
    });
    return true;
  }

  TABS.forEach(function (tab) {
    tab.addEventListener("click", function (e) {
      /* Keep it away from the framework's delegated handler on the container —
         it would swap the panels a second time, outside the transition. */
      e.stopPropagation();
      showPage(tab.getAttribute("data-code"));
    });
  });

  $("#page-entry").addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    showPage(this.value);
  });
  $("#page-entry").addEventListener("input", function () {
    this.removeAttribute("aria-invalid");
  });

  /* --------------------------------------------------------------- hold -- */

  var held = false;
  $("#hold").addEventListener("click", function () {
    held = this.getAttribute("aria-pressed") !== "true";
    this.setAttribute("aria-pressed", String(held));
    this.classList.toggle("ac-toggle--on", held);
    setText(this.querySelector(".ac-toggle__state"), held ? "ON" : "OFF");
    setText($("#st-hold"), held ? "HELD" : "RUNNING");
    setText($("#st-msg"), held ? "PAGE HELD" : "READY");
  });

  /* -------------------------------------------------------------- clocks -- */

  /* One wall clock, three offsets. March 1988: London is on GMT until the 27th,
     New York five hours behind it, Tokyo nine ahead.

     ONLY THE LOCAL CLOCK CARRIES SECONDS, and that is a ghost-budget decision as
     much as a period one. Three fields rewriting every second is six concurrent
     ghosts on a two-second tail before the market has quoted anything — a fixed
     charge against a budget of twenty-four, levied on the least interesting text
     on the screen. Seconds on the clock you are working to and hours and minutes
     on the two you are working AGAINST is also what a dealing room's wall looked
     like. */
  var ZONES = [["#clk-lon", 0, true], ["#clk-nyc", -5, false], ["#clk-tok", 9, false]];

  function paintClocks() {
    var d = new Date();
    var base = d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds();
    for (var i = 0; i < ZONES.length; i++) {
      var t = ((base + ZONES[i][1] * 3600) % 86400 + 86400) % 86400;
      var hhmm = pad(Math.floor(t / 3600), 2) + ":" + pad(Math.floor(t / 60) % 60, 2);
      setText($(ZONES[i][0]), ZONES[i][2] ? hhmm + ":" + pad(t % 60, 2) : hhmm);
    }
  }

  /* ---------------------------------------------------------------- run -- */

  var ticks = 0;

  function tick() {
    if (held) return;
    reprice();
    ticks += 1;

    /* The book and the session counters share the slow cycle. Every one of these
       is a text rewrite and therefore a ghost, and a running total refreshed on
       every quote in the market would spend a third of the budget on two numbers
       nobody is watching tick. A desk statistic updating every few seconds is
       also what these panels actually did. */
    if (ticks % 4 === 0) {
      markBook();
      setText($("#updates"), String(updates));
      setText($("#tickets"), String(tickets));

      /* THE MATRIX IS NOT REFRESHED HERE, and that is deliberate — it is a
         SNAPSHOT, computed when the page is called up and stamped with the time
         it was computed. Which is what a cross rate page was: a derived page,
         not a feed.

         It is also the only shape that fits the budget. One leg moving changes
         that currency's whole row and its whole column, so a live repaint is
         fourteen visible cells at once — measured, that alone held twenty of the
         twenty-four ghosts the engine allows, and the quote trails this page
         exists to show were being evicted to make room for it. Wrapping it in a
         framebuffer decay does not help either, which is worth writing down:
         transition() snapshots the screen, but the mutations inside the callback
         still reach the observer and still ghost. There is no way to spend less
         than fourteen except not to spend it. */
    }
  }

  /* THE MARKET IS DRIVEN BY AN ANIMATION, NOT A TIMER, and that is a
     determinism decision before it is anything else.

     The other two demos hold their first tick back by a fixed delay chosen to
     clear the visual suite's shutter. That works until the suite grows: every
     page added makes every run slower, and this page made it slower than most —
     capture.mjs probes the whole DOM six times here, once per page it opens, and
     this is the largest DOM in the repo. A 2.5s delay went red. So did six.

     A delay is the wrong instrument for the job. capture.mjs kills every
     animation on the page before it shoots, so an animation-driven tick cannot
     fire during a capture AT ALL — not unlikely-to, cannot — and the baseline is
     frame zero by construction at any machine speed. docs/radar.js already runs
     on this principle, where the sweep's own rotation is the clock; the metronome
     below is the same idea for a page that has no rotating part to borrow.

     It follows that a reader who has asked for reduced motion gets a static
     page. That is the right answer rather than a side effect: the ghosting, the
     inverse-video flash and the tape are the motion, and a market that reprices
     under someone who asked things to stop moving is not honouring the request.
     Every number stays on the glass and stays legible. */
  paintClocks();
  setInterval(paintClocks, 1000);
  $("#metronome").addEventListener("animationiteration", tick);
})();

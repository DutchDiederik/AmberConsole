/* SEASCAN RM-12 radar demo behavior. Vanilla, no dependencies.
 *
 * Demo logic only. The display board, the toggles and the persistence tier are
 * the framework's (../dist/amber-console.js and .effects.js); the radar face,
 * its wake and every contact's decay are pure CSS in sweep.css and docs.css.
 * What is left for this file is the fiction of a set that is running.
 *
 * THE SWEEP IS THE CLOCK, and that is the one structural decision here.
 *
 * Everything on the face happens when the beam crosses it, so this file does not
 * own a timer for the radar at all — it listens for `animationiteration` on the
 * beam and advances the world once per revolution. A setInterval would drift
 * against the CSS animation within a minute, and the whole subject of this page
 * is that the beam and the light it leaves behind are the same event. It also
 * means the period is never hard-coded: switch to P39 and the antenna slows to
 * match the phosphor, because both come off --ac-persist-tail.
 *
 * Determinism, as on the server page: THE MARKUP IS FRAME ZERO. Nothing is
 * randomized on load, drift comes from a seeded Lehmer generator rather than
 * Math.random, and no revolution has happened when the visual suite takes its
 * screenshot — capture.mjs disables every animation, so `animationiteration`
 * never fires there at all. Only the UTC clock is painted at load, and it reads
 * a Date the harness has frozen.
 */

/* ------------------------------------------------------------- P7 first -- *
 * FIT THE RIGHT TUBE BEFORE THE FRAMEWORK LOOKS.
 *
 * The chosen display is stored under one key namespace shared by every page in
 * this repo, which is what makes it stick while you read the guide. Arriving
 * here it is a problem: a visitor coming from the console demo brings PLASMA ·
 * NEON with them, and a radar in neon is a red strobe with no flash layer —
 * the sweep's leading edge falls back to the trail color and the one thing
 * this page exists to show is simply absent.
 *
 * So on a FIRST visit this seeds the store with the set's own tube and records
 * that it has done so. It runs at parse time, before the framework's
 * DOMContentLoaded init reads any of it, so there is no frame of the wrong
 * palette and nothing to repaint. On every later visit the flag is set and
 * whatever you chose here is what you get — deliberately picking P39 to watch a
 * green screen survives, which is the whole point of the board being on the
 * page.
 * ------------------------------------------------------------------------- */
(function () {
  try {
    if (localStorage.getItem("ac.radar.fitted")) return;
    localStorage.setItem("ac.sim.tech", "crt");
    localStorage.setItem("ac.sim.emitter", "p7");
    localStorage.setItem("ac.sim.crt", "1");
    localStorage.setItem("ac.sim.plasma", "0");
    localStorage.setItem("ac.sim.mod", "0");
    localStorage.setItem("ac.radar.fitted", "1");
  } catch {
    /* Private mode and sandboxed file:// frames throw. The markup has P7
       checked, so a store that cannot be written still opens on the right tube;
       only the CRT simulation is lost, and the board can turn it on. */
  }
})();

(function () {
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return [].slice.call(document.querySelectorAll(s)); };
  var pad = function (n, w) { n = String(n); while (n.length < w) n = "0" + n; return n; };
  var clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  var deg = function (d) { d %= 360; return d < 0 ? d + 360 : d; };

  /* Bearings are always three digits and one decimal — 073.5°, never 73.5° —
     because that is how they are spoken and how a helm order is read back. */
  function brgStr(v) {
    var s = deg(v).toFixed(1);
    while (s.indexOf(".") < 3) s = "0" + s;
    return s + "°";
  }

  function setText(el, s) {
    if (el && el.textContent !== s) el.textContent = s;
  }

  /* MINSTD, as on the server page: 16807 * 2147483646 is exact in a double, so
     the sequence is reproducible. */
  var seed = 19831104;
  function rnd() {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  }

  /* Wrap a discrete change so the screen it replaces drains per pixel instead of
     cutting. The effects module declines safely when persistence is off or the
     API is missing, so this is always callable. */
  function withDecay(fn) {
    var vt = window.AmberConsoleEffects && window.AmberConsoleEffects.transition;
    if (typeof vt === "function") vt(fn);
    else fn();
  }

  var beam = $("#beam");
  var ppi = $("#ppi");
  var panel = $("#scope-panel");

  /* --- the picture ------------------------------------------------------ */

  var range = 3;          /* nautical miles to the edge of the face */
  var eblBrg = 73.5;      /* electronic bearing line, degrees relative */
  var vrmRng = 1.62;      /* variable range marker, NM */
  var guard = { from: 40, to: 80, inner: 0.55 };

  /* Receiver controls. These are the markup's values; nothing recomputes from
     them until one is actually moved, so frame zero stays frame zero. */
  var knobs = { gain: 62, sea: 30, rain: 12, tune: 84 };

  /* Sea clutter is banded rather than continuous: each ring of wave tops needs
     more suppression than the one outside it, which is exactly what a swept
     gain control did. */
  var CLUTTER_THRESHOLD = { 1: 40, 2: 60, 3: 80 };

  /* The four tracked contacts. Bearing and range are what the set has measured;
     the rates are per HOUR, so a revolution advances them by the real amount and
     the plot moves at the speed the vessels are actually doing. A ferry at 17.5
     knots closing head-on covers a third of a mile a minute, which is thirteen
     revolutions — visible without anything being exaggerated. */
  var TRACKS = {
    1: { brg: 41, rng: 1.86, dBrg: -2.1, dRng: -3.2, cpa: 0.4, tcpa: 430, state: "Tracked" },
    2: { brg: 105, rng: 1.32, dBrg: 4.8, dRng: 1.9, cpa: 1.1, tcpa: 760, state: "Tracked" },
    3: { brg: 168, rng: 2.25, dBrg: -0.7, dRng: -18.4, cpa: 0.9, tcpa: 355, state: "Tracked" },
    4: { brg: 214, rng: 0.9, dBrg: 1.2, dRng: 0.4, cpa: 0.9, tcpa: null, state: "Acquiring" }
  };

  /* Every contact on the face remembers the range it was drawn at, so a change
     of range scale is a re-projection rather than a redraw from a table. */
  var echoes = $$(".doc-echo").map(function (el) {
    return {
      el: el,
      nm: parseFloat(el.style.getPropertyValue("--rng")) * 3,
      brg: parseFloat(el.style.getPropertyValue("--brg")),
      sz: parseFloat(el.style.getPropertyValue("--sz")),
      clutter: Number(el.getAttribute("data-clutter") || 0),
      land: el.classList.contains("doc-echo--land"),
      trk: (el.id.match(/^echo-(\d)$/) || [])[1]
    };
  });

  function placeEcho(e) {
    var frac = e.nm / range;
    var suppressed = e.clutter && knobs.sea >= CLUTTER_THRESHOLD[e.clutter];
    e.el.hidden = frac > 1 || Boolean(suppressed);
    if (frac <= 1) e.el.style.setProperty("--rng", frac.toFixed(4));
  }

  /* --- range scale ------------------------------------------------------ */

  function setRange(nm, rings) {
    if (nm === range) return;
    /* The one change on this page big enough to be worth a framebuffer decay:
       the entire picture is re-projected at once, and on a long phosphor the old
       one is still draining while the new one fills in behind the beam. That is
       what changing range looked like. */
    withDecay(function () {
      range = nm;
      for (var i = 0; i < echoes.length; i++) placeEcho(echoes[i]);
      paintMarkers();
      paintHeadline();
      /* The guard zone is a fraction of the range scale, so changing the scale
         moves the zone rather than the traffic — a track that was inside it at
         3 NM is a fifth of the way out at 12. Re-evaluating here rather than
         waiting for the next scan is the one place this page does not let the
         beam be the clock, because an alarm that outlives its cause is worse
         than one that arrives a scan early. */
      paintTracks();
      setText($("#ascope-max"), nm + " NM");
      log(nm + " NM · RINGS " + rings);
    });
  }

  $$("[data-range]").forEach(function (input) {
    input.addEventListener("change", function () {
      if (input.checked) setRange(Number(input.dataset.range), input.dataset.rings);
    });
  });

  /* --- markers ---------------------------------------------------------- */

  function paintMarkers() {
    $("#ebl").style.setProperty("--brg", deg(eblBrg).toFixed(1));
    setText($("#ebl-out"), brgStr(eblBrg));
    $("#vrm").style.setProperty("--rng", (vrmRng / range).toFixed(4));
    setText($("#vrm-out"), vrmRng.toFixed(2) + " NM");
    setText($("#ascope-brg"), "Bearing " + brgStr(eblBrg));
  }

  $$("[data-ebl]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      eblBrg = deg(eblBrg + Number(btn.dataset.ebl));
      paintMarkers();
    });
  });

  $$("[data-vrm]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      vrmRng = clamp(vrmRng + Number(btn.dataset.vrm), 0.04, range);
      paintMarkers();
    });
  });

  /* --- receiver controls ------------------------------------------------ */

  function setKnob(name, value) {
    knobs[name] = clamp(value, 0, 100);
    var meter = document.getElementById("k-" + name);
    var track = meter.querySelector(".ac-meter__track");
    track.style.setProperty("--ac-meter-value", String(knobs[name]));
    track.setAttribute("aria-valuenow", String(knobs[name]));
    setText(meter.querySelector("[data-pct]"), knobs[name] + "%");
    applyReceiver();
  }

  /* What the controls actually DO to the picture, which is the half a panel of
     dead knobs would be missing. */
  function applyReceiver() {
    for (var i = 0; i < echoes.length; i++) {
      var e = echoes[i];

      /* Anti-clutter sea: wave tops go band by band. Turn it far enough up and
         the buoy inside the clutter goes with them, which is the mistake the
         control has always invited. */
      if (e.clutter) {
        e.el.hidden = knobs.sea >= CLUTTER_THRESHOLD[e.clutter] || e.nm / range > 1;
        continue;
      }

      /* Anti-clutter rain differentiates the video, so an extended return keeps
         its leading edge and loses its body. Land is what that is visible on. */
      if (e.land) {
        e.el.style.setProperty("--sz", (e.sz * (1 - knobs.rain / 260)).toFixed(1));
      }
    }

    /* Off-tune costs echo strength before it costs anything else. */
    var q = 0.35 + 0.65 * (1 - Math.min(1, Math.abs(knobs.tune - 84) / 45));
    ppi.style.filter = q >= 0.999 ? "" : "brightness(" + q.toFixed(2) + ")";
    $("#ascope").style.filter = ppi.style.filter;
  }

  $$("[data-knob]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setKnob(btn.dataset.knob, knobs[btn.dataset.knob] + Number(btn.dataset.step));
    });
  });

  /* --- soft keys -------------------------------------------------------- */

  function exclusive(attr, btn) {
    $$("[" + attr + "]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b === btn));
    });
  }

  $$("[data-trails]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      exclusive("data-trails", btn);
      /* The floor the contacts decay to, NOT .ac-afterglow — that class belongs
         to the CRT simulation on the board. See the note in radar.html. */
      panel.style.setProperty("--doc-trail-floor", btn.dataset.trails);
      setText($("#st-trails"), "TRAILS " + btn.textContent.toUpperCase());
    });
  });

  $$("[data-pulse]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      exclusive("data-pulse", btn);
      setText($("#tx-note"), "Pulse " + btn.dataset.pulse);
    });
  });

  $$("[data-pres]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      exclusive("data-pres", btn);
      setText($("#st-pres"), btn.dataset.pres);
      paintHeadline();
    });
  });

  /* --- transmitter ------------------------------------------------------ */

  var tx = "TRANSMIT";
  var warmLeft = 0;
  var warmTimer = null;

  function paintTx() {
    setText($("#tx-value"), tx);
    setText($("#tx-toggle"), tx === "TRANSMIT" ? "Standby" : "Transmit");
    $("#scope-panel").toggleAttribute("data-standby", tx !== "TRANSMIT");
    $("#warmup").hidden = tx !== "WARM-UP";
  }

  $("#tx-toggle").addEventListener("click", function () {
    if (tx === "WARM-UP") return;

    if (tx === "TRANSMIT") {
      /* Going to standby blanks the screen, and on a long phosphor blanking is
         not an instant — it is the picture draining. Same mechanism as a range
         change, for the same reason. */
      withDecay(function () {
        tx = "STANDBY";
        paintTx();
      });
      log("STANDBY");
      return;
    }

    /* NINETY SECONDS, AND IT IS NOT SPED UP. That is what a magnetron of this
       size needed to reach cathode temperature, and a bridge waited it out
       before every departure. The set ships transmitting so that nobody has to
       wait to see the page; this is here because leaving it out would be the
       one place the panel lied about the hardware. */
    tx = "WARM-UP";
    warmLeft = 90;
    paintTx();
    paintWarm();
    log("WARM-UP 90 S");

    warmTimer = setInterval(function () {
      warmLeft -= 1;
      if (warmLeft <= 0) {
        clearInterval(warmTimer);
        warmTimer = null;
        withDecay(function () {
          tx = "TRANSMIT";
          paintTx();
        });
        log("TRANSMIT");
        return;
      }
      paintWarm();
    }, 1000);
  });

  function paintWarm() {
    var pct = Math.round((90 - warmLeft) / 90 * 100);
    var track = $("#warmup .ac-meter__track");
    track.style.setProperty("--ac-meter-value", String(pct));
    track.setAttribute("aria-valuenow", String(pct));
    setText($("#warmup-left"), warmLeft + " S");
  }

  /* --- the plot --------------------------------------------------------- */

  function paintHeadline() {
    var pres = $$("[data-pres]").filter(function (b) {
      return b.getAttribute("aria-pressed") === "true";
    })[0];
    setText($("#headline"),
      "RM-12 · " + range + " NM · " + (pres ? pres.dataset.pres : "HEAD-UP"));
  }

  function inGuard(t) {
    var b = deg(t.brg);
    var within = guard.from <= guard.to
      ? b >= guard.from && b <= guard.to
      : b >= guard.from || b <= guard.to;
    return within && t.rng / range >= guard.inner && t.rng <= range;
  }

  function paintTracks() {
    var breached = [];

    for (var id in TRACKS) {
      var t = TRACKS[id];
      var row = $('#targets tr[data-trk="' + id + '"]');
      /* Whole degrees in the plot, tenths on the bearing line: the plot is what
         the set has computed about a moving vessel and a tenth of a degree is
         noise in it; the EBL is a cursor the operator placed by hand. */
      setText(row.querySelector("[data-brg]"), pad(Math.round(deg(t.brg)), 3) + "°");
      setText(row.querySelector("[data-rng]"), t.rng.toFixed(2));
      setText(row.querySelector("[data-cpa]"), t.cpa.toFixed(1));
      setText(row.querySelector("[data-tcpa]"),
        t.tcpa === null ? "—" : pad(Math.floor(t.tcpa / 60), 2) + ":" + pad(Math.round(t.tcpa) % 60, 2));
      setText(row.querySelector("[data-state]"), t.state);

      var echo = document.getElementById("echo-" + id);
      if (echo) {
        echo.style.setProperty("--brg", deg(t.brg).toFixed(1));
        echo.style.setProperty("--rng", (t.rng / range).toFixed(4));
        echo.hidden = t.rng / range > 1;
      }
      if (inGuard(t)) breached.push(id);
    }

    paintAlarm(breached);
  }

  function paintAlarm(breached) {
    var slot = $("#alarm-slot");
    var banner = slot.firstElementChild;

    if (breached.length && !banner) {
      banner = document.createElement("div");
      banner.className = "ac-banner ac-blink";
      banner.setAttribute("role", "alert");
      slot.appendChild(banner);
      slot.hidden = false;
    } else if (!breached.length && banner) {
      if (window.AmberConsoleEffects) window.AmberConsoleEffects.afterglow(banner);
      slot.removeChild(banner);
      slot.hidden = true;
      return;
    }
    if (banner) {
      setText(banner, "Guard Zone · Track T" + breached.join(" T"));
    }
  }

  /* Selecting a track rings it on the face. One hue, so "this one" is a marker
     and a brightness — never a color. */
  $$("#targets tr").forEach(function (row) {
    row.addEventListener("click", function () {
      $$("#targets tr").forEach(function (r) {
        r.classList.toggle("ac-table__row--active", r === row);
      });
      $$(".doc-echo").forEach(function (e) {
        e.classList.toggle("doc-echo--sel", e.id === "echo-" + row.dataset.trk);
      });
    });
  });

  /* --- the A-scope ------------------------------------------------------ */

  var ASCOPE = $$(".doc-ascope__bar");

  /* Amplitude against range along the bearing line, which is where a set of this
     vintage put it — the operator swung the EBL onto something and read its
     echo shape. Derived from the same contacts the face is drawing, so the two
     displays cannot disagree. */
  /* Half a beamwidth, in degrees. A real antenna of this size is nearer 1.5°,
     which would leave the strip empty almost all the time — so this is the one
     number on the page tuned for legibility rather than for the hardware, and it
     is only how much of the picture the strip is looking at. */
  var ASCOPE_ARC = 16;

  function paintAscope() {
    var cells = ASCOPE.length;
    var noise = 6 + knobs.gain / 8;

    for (var i = 0; i < cells; i++) {
      var cellNm = (i + 0.5) / cells * range;
      var h = noise * (0.4 + rnd());

      /* Sea clutter fills the first few cells and is what A/C SEA is fighting.
         Turn the control up and the strip's left end flattens out. */
      if (cellNm < range * 0.16) {
        h += (48 - knobs.sea * 0.42) * (1 - cellNm / (range * 0.16));
      }

      for (var e = 0; e < echoes.length; e++) {
        var ec = echoes[e];
        if (ec.el.hidden) continue;
        var off = Math.abs(deg(ec.brg - eblBrg + 180) - 180);
        if (off > ASCOPE_ARC) continue;
        var spread = Math.abs(ec.nm - cellNm) / (range / cells);
        if (spread > 1.8) continue;
        h += (ec.sz * 6) * (1 - off / ASCOPE_ARC) * (1 - spread / 1.8);
      }

      ASCOPE[i].style.setProperty("--h", String(clamp(Math.round(h), 2, 100)));
    }
  }

  /* --- log -------------------------------------------------------------- */

  /* This set has no event log panel — the status line is its whole voice — so
     "log" here just puts the machine's last word where the machine speaks. */
  function log(message) {
    setText($("#st-ant"), message);
    clearTimeout(log.t);
    log.t = setTimeout(function () { setText($("#st-ant"), "ANT 24 RPM"); }, 4000);
  }

  /* --- one revolution --------------------------------------------------- */

  function revolution() {
    /* Re-read every time rather than caching: switching emitter on the board
       retunes --ac-persist-tail, the antenna slows or speeds up to match, and
       the world has to advance by the new amount. */
    var period = parseFloat(getComputedStyle(beam).animationDuration) || 4.5;
    var hours = period / 3600;

    for (var id in TRACKS) {
      var t = TRACKS[id];
      t.brg = deg(t.brg + t.dBrg * hours);
      t.rng = clamp(t.rng + t.dRng * hours, 0.05, 24);
      if (t.tcpa !== null) t.tcpa = Math.max(0, t.tcpa - period);
      if (t.state === "Acquiring" && t.tcpa === null) t.state = "Tracked";
    }
    /* T4 was still being acquired at frame zero; one full scan is what that
       takes. */
    if (TRACKS[4].state === "Acquiring") {
      TRACKS[4].state = "Tracked";
      TRACKS[4].tcpa = 900;
    }

    paintTracks();
    paintAscope();
  }

  beam.addEventListener("animationiteration", revolution);

  /* --- clock ------------------------------------------------------------ */

  function paintClock() {
    var d = new Date();
    setText($("#clock"),
      "UTC " + pad(d.getUTCHours(), 2) + ":" + pad(d.getUTCMinutes(), 2) + ":" + pad(d.getUTCSeconds(), 2));
  }

  /* The only timer on the page, and the only thing painted before the first
     revolution: a clock reading 00:00:00 for four and a half seconds is a stale
     panel, and Date is frozen in the visual suite so this is deterministic. */
  paintClock();
  setInterval(paintClock, 1000);
})();

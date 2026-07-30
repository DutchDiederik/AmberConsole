/* D-STAR server dashboard demo behavior. Vanilla, no dependencies.
 *
 * This file is DEMO logic only — the fiction of a machine that is running. The
 * tab keyboard model, the PLASMA/CRT toggles, the display board and the dialog
 * are handled by the framework's optional module (../dist/amber-console.js), so
 * nothing generic lives here.
 *
 * TWO RULES SHAPE ALL OF IT, and both come from test/visual/capture.mjs.
 *
 * 1. THE MARKUP IS FRAME ZERO. Every number in server.html is what this file
 *    computes before the first tick, so the page a screenshot catches at 250ms
 *    is the page in the HTML. Nothing is randomized on load, and setInterval has
 *    no leading tick() — the first one lands at t=1s, well after the shutter.
 *    The single exception is the wall clock, which is painted immediately and is
 *    deterministic anyway because the harness freezes Date.
 *
 * 2. DRIFT IS SEEDED, NEVER Math.random(). A Lehmer generator with a fixed seed
 *    means two runs of the visual suite produce the same numbers even if the
 *    timing ever slips, so a baseline that differs is a real regression rather
 *    than the dice. The wall clock reads new Date(), which the harness freezes.
 *
 * The numbers are also INTERNALLY CONSISTENT rather than four independent
 * wobbles: host CPU is the sum of what the containers are using, memory is what
 * they have allocated plus the ARC, and both the package temperature and the
 * wall draw are functions of the CPU. Stop Jellyfin and the machine gets cooler
 * and cheaper, which is the whole reason a dashboard is worth looking at.
 */
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return [].slice.call(document.querySelectorAll(s)); };
  var pad = function (n, w) { n = String(n); while (n.length < w) n = "0" + n; return n; };
  var clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };

  /* Write only when the string actually changed.
     This is not a micro-optimization. The afterglow simulation watches the frame
     for text mutations and leaves a decaying ghost behind every one it sees, so
     re-writing "ACTIVE" into eight rows every second would spray the panel with
     ghosts of text that never changed and burn the ghost budget the mutations
     that matter need. */
  function setText(el, s) {
    if (el && el.textContent !== s) el.textContent = s;
  }

  /* A value plus its unit, which is two nodes because .ac-readout__unit is a
     smaller face — the digits have to keep the eye. */
  function setValue(el, value, unitText) {
    if (el.firstChild && el.firstChild.nodeType === 3 && el.childNodes.length === 2) {
      setText(el.firstChild, value);
      return;
    }
    el.textContent = value;
    var span = document.createElement("span");
    span.className = "ac-readout__unit";
    span.textContent = unitText;
    el.appendChild(span);
  }

  /* MINSTD. The multiplier is 16807 rather than a fatter one because
     16807 * 2147483646 is under 2^53 and therefore exact in a double — a bigger
     constant silently loses the low bits and stops being reproducible, which is
     the one property this generator exists for. */
  var seed = 20260728;
  function rnd() {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  }
  /* Symmetric noise: +/- `spread`, biased by nothing. */
  function noise(spread) {
    return (rnd() * 2 - 1) * spread;
  }

  /* --- the machine ------------------------------------------------------ */

  var MEM_TOTAL = 32768;   /* MB of RAM fitted */
  var ARC = 14694;         /* MB the filesystem cache holds regardless of load */
  var hostSec = 3651067;   /* 42d 06:11:07, the host's own uptime */

  /* cpu is a percentage of one machine, mem is MB, up is that container's own
     uptime in seconds — which resets to zero when it is started by hand. */
  var SERVICES = {
    caddy:     { name: "Caddy",     cpu: 0.4,  mem: 62,   up: 3564660, on: true },
    postgres:  { name: "Postgres",  cpu: 2.1,  mem: 884,  up: 3564660, on: true },
    immich:    { name: "Immich",    cpu: 7.8,  mem: 2400, up: 1118400, on: true },
    jellyfin:  { name: "Jellyfin",  cpu: 19.4, mem: 1100, up: 1118400, on: true },
    paperless: { name: "Paperless", cpu: 0.9,  mem: 410,  up: 1118400, on: true },
    grafana:   { name: "Grafana",   cpu: 1.6,  mem: 236,  up: 705300,  on: true },
    wireguard: { name: "Wireguard", cpu: 0.2,  mem: 28,   up: 3564660, on: true },
    syncthing: { name: "Syncthing", cpu: 3.3,  mem: 174,  up: 705300,  on: true }
  };

  /* Remember what each container idles at. A drift with no pull back toward a
     baseline is a random walk, and a random walk always leaves: left running an
     hour, every meter on the page ends up pinned at 100% and the dashboard has
     quietly become a lie. */
  for (var svcId in SERVICES) SERVICES[svcId].base = SERVICES[svcId].cpu;

  var scrub = { running: false, pct: 0 };
  var backupBusy = false;

  /* --- log -------------------------------------------------------------- */

  var LOG_MAX = 12;

  function stamp() {
    var d = new Date();
    return pad(d.getHours(), 2) + ":" + pad(d.getMinutes(), 2) + ":" + pad(d.getSeconds(), 2);
  }

  /* Newest first. Built with createElement rather than innerHTML: the strings
     are ours, but a log is the one place a demo should not teach the other
     habit. */
  function log(message) {
    var list = $("#log");
    var item = document.createElement("div");
    item.className = "ac-list__item";

    var key = document.createElement("dt");
    key.className = "ac-list__key";
    key.textContent = stamp();

    var fill = document.createElement("span");
    fill.className = "ac-list__fill";

    var value = document.createElement("dd");
    value.className = "ac-list__value";
    value.textContent = message;

    item.appendChild(key);
    item.appendChild(fill);
    item.appendChild(value);
    list.insertBefore(item, list.firstChild);

    while (list.children.length > LOG_MAX) {
      var last = list.lastElementChild;
      /* Leave a decaying copy behind rather than have the row blink out of
         existence. A no-op unless the afterglow is running. */
      if (window.AmberConsoleEffects) window.AmberConsoleEffects.afterglow(last);
      list.removeChild(last);
    }
  }

  /* --- services --------------------------------------------------------- */

  function row(id) { return $('#services tr[data-svc="' + id + '"]'); }

  function running() {
    var n = 0;
    for (var id in SERVICES) if (SERVICES[id].on) n++;
    return n;
  }

  /* The headline, the status bar and the banner all say the same thing at three
     volumes: a title you read once, a machine voice you glance at, and — only
     when something is actually down — the loudest element the system has. */
  function paintFleet() {
    var n = running();
    var down = 8 - n;

    setText($("#headline"), "NODE 01 · " + n + " OF 8 SERVICES UP");
    setText($("#running"), n + " OF 8 RUNNING");
    setText($("#status"), "STATUS:" + (down ? "DEGRADED" : "NOMINAL"));

    var slot = $("#alarm-slot");
    var banner = slot.firstElementChild;

    if (down && !banner) {
      banner = document.createElement("div");
      banner.className = "ac-banner ac-blink";
      banner.setAttribute("role", "alert");
      slot.appendChild(banner);
      slot.hidden = false;
    } else if (!down && banner) {
      if (window.AmberConsoleEffects) window.AmberConsoleEffects.afterglow(banner);
      slot.removeChild(banner);
      slot.hidden = true;
      return;
    }
    if (banner) {
      setText(banner, down + (down === 1 ? " Service Down" : " Services Down"));
    }
  }

  function paintService(id) {
    var svc = SERVICES[id];
    var tr = row(id);
    var starting = tr.hasAttribute("data-starting");

    setText(tr.querySelector("[data-cpu]"), svc.on ? svc.cpu.toFixed(1) + "%" : "—");
    setText(tr.querySelector("[data-mem]"), svc.on
      ? (svc.mem >= 1024 ? (svc.mem / 1024).toFixed(1) + " GB" : Math.round(svc.mem) + " MB")
      : "—");
    setText(tr.querySelector("[data-up]"), svc.on
      ? pad(Math.floor(svc.up / 86400), 2) + "d " +
        pad(Math.floor(svc.up / 3600) % 24, 2) + ":" +
        pad(Math.floor(svc.up / 60) % 60, 2)
      : "—");

    var state = tr.querySelector("[data-state]");
    if (starting) {
      /* A spinner and not a meter, and the distinction is the component's own
         rule: a machine that can measure progress shows a bar, one that cannot
         admits it. Nothing here knows how long a container takes to come up. */
      state.textContent = "";
      var spin = document.createElement("span");
      spin.className = "ac-spinner";
      spin.setAttribute("role", "status");
      spin.setAttribute("aria-label", "Starting");
      state.appendChild(spin);
      state.appendChild(document.createTextNode(" Starting"));
    } else {
      setText(state, svc.on ? "Active" : "Stopped");
    }

    /* Faint for anything not currently reporting, which includes a container on
       its way up. With one hue available, "off" is said with brightness. */
    if (svc.on && !starting) tr.removeAttribute("data-stopped");
    else tr.setAttribute("data-stopped", "");

    var btn = tr.querySelector("[data-svc-toggle]");
    var lit = svc.on || starting;
    btn.setAttribute("aria-pressed", String(lit));
    btn.classList.toggle("ac-toggle--on", lit);
    setText(btn.querySelector(".ac-toggle__state"), lit ? "ON" : "OFF");
  }

  /* The switch is wired here rather than with data-ac="toggle" on purpose: the
     framework's own handler would flip it, and this needs the flip and its
     consequences to happen in one place and in a known order. */
  function setService(id, on) {
    var svc = SERVICES[id];
    var tr = row(id);

    if (on) {
      if (svc.on || tr.hasAttribute("data-starting")) return;
      tr.setAttribute("data-starting", "");
      paintService(id);
      paintFleet();

      setTimeout(function () {
        tr.removeAttribute("data-starting");
        svc.on = true;
        svc.up = 0;
        svc.cpu = svc.base;
        paintService(id);
        paintFleet();
        paintHost();
        log(svc.name.toUpperCase() + " ACTIVE");
      }, 1600);
      return;
    }

    if (!svc.on && !tr.hasAttribute("data-starting")) return;
    svc.on = false;
    tr.removeAttribute("data-starting");
    paintService(id);
    paintFleet();
    paintHost();
    log(svc.name.toUpperCase() + " STOPPED");
  }

  $$("[data-svc-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.parentNode.parentNode.getAttribute("data-svc");
      setService(id, btn.getAttribute("aria-pressed") !== "true");
    });
  });

  $("#svc-all-on").addEventListener("click", function () {
    for (var id in SERVICES) if (!SERVICES[id].on) setService(id, true);
  });

  /* --- host load -------------------------------------------------------- */

  function setMeter(id, pct, label) {
    var meter = document.getElementById(id);
    var track = meter.querySelector(".ac-meter__track");
    var shown = Math.round(pct);

    track.style.setProperty("--ac-meter-value", String(shown));
    track.setAttribute("aria-valuenow", String(shown));
    setText(meter.querySelector("[data-pct]"), shown + "%");

    var gb = meter.querySelector("[data-gb]");
    if (gb && label) setText(gb, label);

    /* Over-range inverse-videos the track and blinks it. There is no red. */
    if (id === "m-cpu") meter.classList.toggle("ac-meter--alarm", shown > 90);
  }

  function paintHost() {
    var cpu = 3.6;
    var mem = ARC;
    for (var id in SERVICES) {
      if (!SERVICES[id].on) continue;
      cpu += SERVICES[id].cpu * 0.85;
      mem += SERVICES[id].mem;
    }
    /* A scrub is the machine reading every block it owns. It costs a core and
       it pins the disks, which is the point of showing both meters at once. */
    if (scrub.running) cpu += 11;
    cpu = clamp(cpu, 1, 100);

    setMeter("m-cpu", cpu);
    setMeter("m-mem", (mem / MEM_TOTAL) * 100,
      "Memory · " + (mem / 1024).toFixed(1) + " / 32 GB");
    setMeter("m-io", scrub.running ? 92 : clamp(18 + noise(9), 0, 100));

    /* Both of these are consequences, not readings: silicon that works harder
       runs hotter and pulls more from the wall. */
    setValue($("#v-temp"), String(Math.round(47.4 + cpu * 0.4)), "°C");
    setValue($("#v-watts"), String(Math.round(52 + cpu * 0.65)), "W");
    setText($("#v-load"), (cpu / 100 * 1.24).toFixed(2));
  }

  /* --- backup ----------------------------------------------------------- */

  $("#backup").addEventListener("click", function () {
    if (backupBusy) return;
    backupBusy = true;

    var btn = this;
    btn.disabled = true;
    btn.textContent = "Backup Running";
    setText($("#b-when"), "In Progress");
    log("BACKUP STARTED");

    setTimeout(function () {
      var size = (40 + rnd() * 4).toFixed(1);
      setValue($("#b-size"), size, "GB");
      setText($("#b-when"), "Completed " + stamp().slice(0, 5));
      btn.disabled = false;
      btn.textContent = "Run Backup Now";
      backupBusy = false;
      log("BACKUP OK " + size + " GB");
    }, 3200);
  });

  /* --- scrub ------------------------------------------------------------ */

  $("#scrub").addEventListener("click", function () {
    if (scrub.running) return;
    scrub.running = true;
    scrub.pct = 0;
    this.disabled = true;
    this.textContent = "Scrub Running";
    setText($("#s-state"), "Reading Tank · 10.9 TB");
    log("SCRUB STARTED");
  });

  function paintScrub() {
    var pct = Math.round(scrub.pct);
    var track = $("#s-meter .ac-meter__track");
    track.style.setProperty("--ac-meter-value", String(pct));
    track.setAttribute("aria-valuenow", String(pct));
    setValue($("#s-pct"), String(pct), "%");
  }

  /* --- clock and counters ----------------------------------------------- */

  /* The clock and the uptime counter, and the ONE thing painted before the first
     tick. Both are pure functions of the wall clock and of a fixed starting
     count, so painting them on load is deterministic — and leaving them unpainted
     is not free: the markup has to carry SOME time, and whatever it carries would
     sit on the glass for a full second before the first tick corrected it. */
  function paintClock() {
    var d = new Date();
    setText($("#clock"),
      "TIME " + pad(d.getHours(), 2) + ":" + pad(d.getMinutes(), 2) + ":" + pad(d.getSeconds(), 2));

    setText($("#uptime"),
      "UP " + Math.floor(hostSec / 86400) + "D " +
      pad(Math.floor(hostSec / 3600) % 24, 2) + ":" +
      pad(Math.floor(hostSec / 60) % 60, 2) + ":" +
      pad(hostSec % 60, 2));
    setValue($("#v-uptime"), String(Math.floor(hostSec / 86400)), "d");
  }

  function tick() {
    hostSec += 1;
    paintClock();

    /* Container load wanders around its own baseline rather than a shared one,
       so a busy transcoder stays busy and a reverse proxy stays idle. */
    for (var id in SERVICES) {
      var svc = SERVICES[id];
      if (!svc.on) continue;
      svc.up += 1;
      svc.cpu = clamp(
        svc.cpu + (svc.base - svc.cpu) * 0.25 + noise(svc.base * 0.35 + 0.3), 0.1, 96);

      /* A transcode. Roughly once a minute the media server takes most of the
         machine for a few seconds, and the mean reversion above walks it back
         down over the following ten. This exists to drive the CPU meter over
         its range and into .ac-meter--alarm, which is the only way to see that
         treatment on a page whose numbers are otherwise well behaved. */
      if (id === "jellyfin" && rnd() < 0.02) svc.cpu = 85 + rnd() * 11;
      paintService(id);
    }

    if (scrub.running) {
      scrub.pct += 4.5 + noise(1.5);
      if (scrub.pct >= 100) {
        scrub.pct = 100;
        scrub.running = false;
        $("#scrub").disabled = false;
        $("#scrub").textContent = "Start Scrub";
        setText($("#s-state"), "Complete · 0 Errors");
        log("SCRUB COMPLETE 0 ERR");
      }
      paintScrub();
    }

    setValue($("#n-down"), String(Math.round(clamp(118 + noise(46), 0, 940))), "Mb/s");
    setValue($("#n-up"), String(Math.round(clamp(27 + noise(14), 0, 220))), "Mb/s");

    paintHost();
  }

  /* No leading tick(). See rule 1 at the top of this file: the markup already IS
     the first frame, and a tick here would redraw every number on the page
     before the visual suite's shutter opens. Only the clock is painted, and only
     because a stale one would be visible to a human for a whole second.

     THE FIRST TICK IS HELD BACK TO SIX SECONDS, and that number is not taste.
     capture.mjs waits for networkidle (500ms of quiet), injects a stylesheet,
     waits 250ms, walks the whole DOM for the overflow probe, and opens whatever
     tabs the page ships closed — then the shutter. A first tick inside that
     window makes the same page screenshot as frame zero or frame one depending
     on how busy the machine was, and the suite goes red at random.

     THIS WAS 2.5 SECONDS AND IT WENT RED, which is why the margin is now this
     wide. The window is not a property of this page: it grows every time a demo
     is added to the suite, because a slower run delays every capture in it. 2.5
     was comfortable at two pages and marginal at four. Six is clear of the whole
     sequence, and nobody watching the page can tell the difference. */
  paintClock();
  setTimeout(function () {
    tick();
    setInterval(tick, 1000);
  }, 6000);
})();

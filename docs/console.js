/* ORION-70 console demo behavior. Vanilla, no dependencies.
 *
 * This file is DEMO logic only — motion state, counters and the wall clock.
 * The tab keyboard model, the PLASMA/CRT toggles and the dialog are handled by
 * the framework's optional module (../dist/amber-console.js), so nothing
 * generic lives here.
 */
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var pad = function (n, w) { n = String(n); while (n.length < w) n = "0" + n; return n; };

  var motion = "STOP";
  var frames = 255315;
  var secs = 0;

  /* --- motion state: RUN / JOG / STOP --- */
  function setMotion(next) {
    motion = next;
    if (next === "STOP") secs = 0;

    document.querySelectorAll("[data-motion]").forEach(function (b) {
      var on = b.dataset.motion === next;
      b.classList.toggle("ac-btn--filled", on);
      b.setAttribute("aria-pressed", String(on));
    });

    $("#title").textContent = "SHOW LOCAL - " + (next === "RUN" ? "AUTO MODE" : "STANDBY");
    $("#status").textContent =
      "STATUS:" + (next === "RUN" ? "AUTO MODE" : next === "JOG" ? "JOG" : "IDLE");

    var banner = $("#banner");
    banner.textContent = next === "RUN" ? "Show Running" : "Remote Mode";
    banner.classList.toggle("ac-blink", next === "RUN");

    render();
  }

  document.querySelectorAll("[data-motion]").forEach(function (b) {
    b.addEventListener("click", function () { setMotion(b.dataset.motion); });
  });

  $("#reset").addEventListener("click", function () { frames = 0; render(); });

  /* --- alarm acknowledge --- */
  $("#ack").addEventListener("click", function () {
    var row = $("#alarm-active");
    row.classList.remove("ac-blink", "ac-table__row--active");
    row.querySelector("[data-state]").textContent = "ACKNOWLEDGED";
    this.disabled = true;
  });

  /* --- clock + counters. 24fps, because it is a film projector. --- */
  function render() {
    $("#frames").textContent = String(frames);
    $("#showtime").textContent =
      "SHOW TIME " + pad(Math.floor(secs / 60), 4) + ":" + pad(secs % 60, 2) + " (MM:SS)";
  }

  function tick() {
    var d = new Date();
    $("#date").textContent =
      "DATE " + pad(d.getMonth() + 1, 2) + "/" + pad(d.getDate(), 2) + "/" + pad(d.getFullYear() % 100, 2);
    $("#time").textContent =
      "TIME " + pad(d.getHours(), 2) + ":" + pad(d.getMinutes(), 2) + ":" + pad(d.getSeconds(), 2);

    if (motion === "RUN") { frames += 24; secs += 1; }
    if (motion === "JOG") { frames += 2; }
    render();
  }

  setMotion("STOP");
  tick();
  setInterval(tick, 1000);
})();

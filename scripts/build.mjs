#!/usr/bin/env node
/**
 * build.mjs — bundle src/ into dist/. Zero dependencies: Node built-ins only.
 *
 *   node scripts/build.mjs                 build once
 *   node scripts/build.mjs --watch         rebuild on change
 *   node scripts/build.mjs --watch --serve serve docs/ at :4173 too
 *   node scripts/build.mjs --serve --port 8080
 *
 * Emits:
 *   dist/amber-console.css        every @import inlined, comments preserved,
 *                                 custom properties left UNRESOLVED (they are
 *                                 the public API — consumers override them)
 *   dist/amber-console.css.map    line-level map back to src/
 *   dist/amber-console.min.css    minified, string-literal aware
 *   dist/amber-console.layer.css  the bundle wrapped in @layer amber-console
 *   dist/amber-console.js         copy of the optional behavior module
 */
import { readFile, writeFile, mkdir, copyFile, readdir } from "node:fs/promises";
import { watch } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import http from "node:http";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const DIST = path.join(ROOT, "dist");
const ENTRY = path.join(SRC, "amber-console.css");

const VERSION = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8")).version;

/* ------------------------------------------------------------------ bundle -- */

/** Matches `@import "x.css";` and `@import url("x.css");` — but not http(s). */
const IMPORT_RE = /^\s*@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?\s*;\s*$/;

/**
 * Depth-first inline of the @import graph.
 *
 * Font URLs are written relative to src/tokens/ (`../../fonts/`). The bundle
 * lands one level below the repo root, so it needs `../fonts/`. Rewriting here
 * is what lets a consumer link dist/amber-console.css from any directory and
 * still resolve the woff2 files.
 */
async function bundle(entry, seen = new Set(), sources = [], lines = []) {
  const rel = path.relative(ROOT, entry).replaceAll("\\", "/");
  if (seen.has(entry)) return { lines, sources };
  seen.add(entry);

  const text = await readFile(entry, "utf8");
  const srcIndex = sources.push(rel) - 1;
  const dir = path.dirname(entry);

  const fileLines = text.split(/\r?\n/);
  for (let i = 0; i < fileLines.length; i++) {
    const hit = IMPORT_RE.exec(fileLines[i]);

    if (hit && !/^https?:/.test(hit[1])) {
      lines.push({ text: `/* >>> ${rel} -> ${hit[1]} */`, srcIndex, srcLine: i });
      await bundle(path.resolve(dir, hit[1]), seen, sources, lines);
      continue;
    }

    lines.push({
      text: fileLines[i].replace(/\.\.\/\.\.\/fonts\//g, "../fonts/"),
      srcIndex,
      srcLine: i,
    });
  }

  return { lines, sources };
}

/* -------------------------------------------------------------- source map -- */

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function vlq(n) {
  let v = n < 0 ? (-n << 1) | 1 : n << 1;
  let out = "";
  do {
    let digit = v & 31;
    v >>>= 5;
    if (v > 0) digit |= 32;
    out += B64[digit];
  } while (v > 0);
  return out;
}

/** One segment per output line: generated col 0 -> (source, source line, col 0). */
function buildMap(lines, sources, offset) {
  let prevSrc = 0;
  let prevLine = 0;
  const mappings = [];

  for (let i = 0; i < offset; i++) mappings.push("");

  for (const l of lines) {
    mappings.push(vlq(0) + vlq(l.srcIndex - prevSrc) + vlq(l.srcLine - prevLine) + vlq(0));
    prevSrc = l.srcIndex;
    prevLine = l.srcLine;
  }

  return {
    version: 3,
    file: "amber-console.css",
    sourceRoot: "..",
    sources,
    names: [],
    mappings: mappings.join(";"),
  };
}

/* --------------------------------------------------------------- minifier -- */

/**
 * Conservative, string- and comment-aware minifier.
 *
 * It deliberately does NOT touch whitespace around `> + ~ * - /`, because
 * `calc(1 - 2)` is valid and `calc(1-2)` is not, and it does NOT remove the
 * space BEFORE a colon, because `.ac-root ::selection` and `.ac-root::selection`
 * are different selectors. Quoted content is copied through untouched so the
 * typeset glyphs (▼ ✳✳ █ and the spinner's escaped newlines) survive.
 */
function minify(css) {
  let out = "";
  let i = 0;

  while (i < css.length) {
    const c = css[i];

    /* Comments: drop, but keep the leading banner. */
    if (c === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      i = end === -1 ? css.length : end + 2;
      continue;
    }

    /* Strings: copy verbatim, escapes included. */
    if (c === '"' || c === "'") {
      const quote = c;
      out += c;
      i++;
      while (i < css.length) {
        out += css[i];
        if (css[i] === "\\") {
          out += css[i + 1] ?? "";
          i += 2;
          continue;
        }
        if (css[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    if (/\s/.test(c)) {
      let j = i;
      while (j < css.length && /\s/.test(css[j])) j++;
      const before = out[out.length - 1];
      const after = css[j];

      /* Collapse the run, then drop it entirely next to safe punctuation. */
      if ("{};,".includes(before) || "{};,".includes(after) || before === ":") {
        i = j;
        continue;
      }
      out += " ";
      i = j;
      continue;
    }

    out += c;
    i++;
  }

  return out.replace(/;\}/g, "}").trim();
}

/* ------------------------------------------------------------------ layer -- */

/** Indenting inside @layer would churn the diff; a bare wrap is enough. */
function wrapLayer(css) {
  const banner =
    `/*! Amber Console ${VERSION} | BSD-3-Clause | @layer build.\n` +
    ` * Identical to amber-console.css, wrapped in @layer amber-console so the\n` +
    ` * framework loses specificity fights against your own unlayered rules.\n` +
    ` * Link this INSTEAD OF amber-console.css, never alongside it.\n` +
    ` */\n`;
  return `${banner}@layer amber-console {\n${css}\n}\n`;
}

/* ---------------------------------------------------------- global build -- */

/**
 * Rewrite the ES module as a classic script exposing window.AmberConsole.
 *
 * Browsers refuse to load `<script type="module">` from a file:// URL — it is
 * subject to CORS and a local file has a null origin. Since "open the demo by
 * double-clicking it" is a hard requirement, the pages load this build instead.
 * The module build stays the canonical one for bundlers and npm consumers.
 */
/**
 * The optional modules, as [source file, global name, exported functions].
 *
 * amber-console.js is BEHAVIOR — tablist, dialogs, toggles, DISPLAY presets.
 * amber-console.effects.js is PERSISTENCE — ghosting, scroll smear, framebuffer
 * decay. Separately optional on purpose: accessible tabs without the eye-candy,
 * or the full phosphor simulation over somebody else's tab implementation.
 */
const MODULES = [
  ["amber-console.js", "AmberConsole", ["init", "afterglow"]],
  ["amber-console.effects.js", "AmberConsoleEffects", ["init", "afterglow", "transition"]],
];

function toGlobal(source, file, globalName, exports) {
  const body = source
    .replace(/^export default [\s\S]*?;\s*$/m, "")
    .replace(/^export /gm, "")
    .trim();

  const surface = exports.map((n) => `${n}: ${n}`).join(", ");

  return (
    `/*! Amber Console ${VERSION} | BSD-3-Clause | classic-script build\n` +
    ` *  Generated from src/${file} by scripts/build.mjs.\n` +
    ` *  Use this with a plain <script src> — including from file:// URLs, where\n` +
    ` *  type="module" is blocked. Exposes window.${globalName}.\n` +
    ` */\n` +
    `(function () {\n"use strict";\n\n${body}\n\n` +
    `window.${globalName} = { ${surface} };\n})();\n`
  );
}

/* -------------------------------------------------------------- partials -- */

/**
 * DOCS PARTIALS, EXPANDED IN PLACE.
 *
 * The setup board is 242 lines and it is on every page in docs/. At five pages
 * that was already a maintenance bill nobody was paying attention to — one stale
 * comment in it had to be fixed in three files separately, and it was found by
 * grep rather than by reading. At twelve pages it stops being tenable.
 *
 * IN PLACE, BETWEEN MARKERS, rather than a src/ -> out/ pipeline. Two things are
 * worth more here than the tidiness of generated output living somewhere else:
 * docs/ stays directly openable over file:// with no build having been run, and
 * a diff still shows what actually changed on the page. The expansion is
 * idempotent — running the build twice produces the same bytes — so the marker
 * and its body can both live in git the way dist/ already does.
 *
 *   <!-- @include _board.html emitter="p7" -->
 *   …generated, do not edit…
 *   <!-- @end -->
 *
 * EDIT THE PARTIAL, NEVER THE EXPANSION. The next build overwrites it.
 */
const DOCS = path.join(ROOT, "docs");

const INCLUDE_RE =
  /([ \t]*)<!--\s*@include\s+(\S+\.html)([^>]*?)-->\r?\n[\s\S]*?<!--\s*@end\s*-->/g;

/** `emitter="p7"` -> { emitter: "p7" } */
function includeArgs(text) {
  return Object.fromEntries([...text.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
}

/** Fail loudly: a partial whose anchor moved must not expand to silence. */
function must(hit, what, file) {
  if (!hit) throw new Error(`build: ${file} — could not find ${what}`);
  return hit;
}

/**
 * How long each CRT phosphor holds, read from the palettes rather than restated.
 *
 * The board ships in the state the page actually loads in, and two of its
 * controls depend on the emitter: the JS Effects switch is inert unless the
 * effects module can contribute something, which needs a CRT phosphor whose tail
 * clears ENGINE_FLOOR_MS. Deriving that here rather than taking it as a second
 * include argument means the two can never disagree — there is only one fact.
 */
function persistByEmitter(colorsCss) {
  const out = {};
  const re = /\[data-ac-tech="(\w+)"\]\[data-ac-emitter="(\w+)"\][^{]*\{([\s\S]*?)\n\}/g;
  for (const m of colorsCss.matchAll(re)) {
    const ms = /--ac-persist:\s*([\d.]+)ms/.exec(m[3]);
    if (ms) out[`${m[1]}/${m[2]}`] = Number(ms[1]);
  }
  return out;
}

/** Mirrors ENGINE_FLOOR_MS in src/amber-console.js — see the long note there for
    why it is the ~80ms perceptual floor rather than a compositing one. */
const ENGINE_FLOOR_MS = 80;

/**
 * Put the board in the state this page loads in.
 *
 * Everything here is a one-frame-of-flash problem rather than a correctness one
 * — amber-console.js settles all of it on load. That is exactly why it drifted:
 * the radar and terminal pages shipped the PLASMA technology note visible under
 * a phosphor default, and nothing ever looked wrong for long enough to notice.
 */
function expandBoard(html, args, persist, file) {
  const emitter = must(args.emitter, "an emitter= argument", file);

  /* The catalog row is the only place tech and emitter are stated together, so
     it is where the technology for this emitter comes from too. */
  let tech = "";
  let seen = false;
  html = html.replace(/<input type="radio" name="ac-display"( checked)?([\s\S]*?)>/g, (all, _c, attrs) => {
    const mine = new RegExp(`data-ac-emitter="${emitter}"`).test(attrs);
    if (mine) {
      seen = true;
      tech = /data-ac-tech="(\w+)"/.exec(attrs)?.[1] ?? "";
    }
    return `<input type="radio" name="ac-display"${mine ? " checked" : ""}${attrs}>`;
  });
  if (!seen) throw new Error(`build: ${file} — emitter="${emitter}" is not in the catalog`);

  /* Live at load only where the module has something to do. */
  const live = tech === "crt" && (persist[`crt/${emitter}`] ?? 0) >= ENGINE_FLOOR_MS;

  const engine = must(
    /<button type="button" class="ac-toggle ac-toggle--on" data-ac-engine aria-pressed="true"( disabled)?>/.exec(html),
    "the JS Effects switch",
    file
  );
  html = html.replace(
    engine[0],
    `<button type="button" class="ac-toggle ac-toggle--on" data-ac-engine aria-pressed="true"${live ? "" : " disabled"}>`
  );

  /* THE SIMULATION SWITCHES, WHICH THIS FUNCTION USED TO LEAVE ALONE.
     The partial hardcodes PLASMA on and CRT off, so every page with a phosphor
     preset shipped its board contradicting its own catalog — radar and terminal
     have flashed a plasma-on board under a CRT phosphor for as long as they have
     had one. It self-corrected within a frame, which is exactly why nobody
     caught it, and it stopped being invisible the moment a page shipped a CRT
     preset whose panel was already amber on arrival.

     The catalog row is the source of truth here too: `tech` came out of the
     checked radio a few lines up, so the switches cannot disagree with it. */
  for (const sim of ["plasma", "crt"]) {
    const on = tech === sim;
    const re = new RegExp(
      `<button type="button" class="ac-toggle(?: ac-toggle--on)?" data-ac-sim="${sim}" aria-pressed="(?:true|false)">` +
        `([\\s\\S]*?)<span class="ac-toggle__state">(?:ON|OFF)</span>`
    );
    must(re.exec(html), `the ${sim.toUpperCase()} switch`, file);
    html = html.replace(
      re,
      `<button type="button" class="ac-toggle${on ? " ac-toggle--on" : ""}" data-ac-sim="${sim}" ` +
        `aria-pressed="${on}">$1<span class="ac-toggle__state">${on ? "ON" : "OFF"}</span>`
    );
  }

  must(/<p( hidden)? class="doc-displays__note" data-ac-engine-note>/.exec(html), "the engine note", file);
  html = html.replace(
    /<p( hidden)? class="doc-displays__note" data-ac-engine-note>/,
    `<p${live ? " hidden" : ""} class="doc-displays__note" data-ac-engine-note>`
  );

  /* The two notes that describe a LIVE engine. Same one-frame reasoning: the
     board should arrive saying what it is about to be doing. `live` is the only
     input because the engine flag itself defaults on and is restored from
     storage after this, which markup cannot know. */
  html = html.replace(
    /<p( hidden)? class="doc-displays__note" data-ac-engine-off>/,
    `<p hidden class="doc-displays__note" data-ac-engine-off>`
  );
  html = html.replace(
    /<div class="doc-engine" data-ac-engine-on( hidden)?>/,
    `<div class="doc-engine" data-ac-engine-on${live ? "" : " hidden"}>`
  );

  /* The technology note, and the exact-pair note where one exists. */
  html = html.replace(/<p class="doc-info" data-ac-display-info="([\w/]+)"( hidden)?>/g, (all, key) => {
    const shown = key === tech || key === `${tech}/${emitter}`;
    return `<p class="doc-info" data-ac-display-info="${key}"${shown ? "" : " hidden"}>`;
  });

  return html;
}

/** Mark the link that points at the page it is on. */
function expandNav(html, file) {
  const page = path.basename(file);
  /* Every chapter of the guide is still "System Guide" up in the top bar. */
  const self = /^guide-/.test(page) ? "guide.html" : page;
  return html.replace(/<a class="ac-nav__link" href="([^"]+)"( aria-current="page")?>/g, (all, href) =>
    `<a class="ac-nav__link" href="${href}"${href === self ? ' aria-current="page"' : ""}>`
  );
}

/** Same job for the guide's own chapter strip, where the match is exact. */
function expandChapters(html, file) {
  const page = path.basename(file);
  return html.replace(/<a class="doc-chapter"( aria-current="page")?( href="[^"]+")>/g, (all, _c, href) =>
    `<a class="doc-chapter"${href === ` href="${page}"` ? ' aria-current="page"' : ""}${href}>`
  );
}

async function expandDocs() {
  const all = await readdir(DOCS);
  const pages = all.filter((f) => f.endsWith(".html") && !f.startsWith("_"));
  const persist = persistByEmitter(await readFile(path.join(SRC, "tokens", "colors.css"), "utf8"));

  /* Underscore-prefixed files in docs/ are partials and are never served. */
  const cache = new Map();
  for (const f of all.filter((f) => f.startsWith("_") && f.endsWith(".html"))) {
    cache.set(f, await readFile(path.join(DOCS, f), "utf8"));
  }
  let touched = 0;

  for (const page of pages) {
    const file = path.join(DOCS, page);
    const before = await readFile(file, "utf8");
    const parts = [];

    let after = before.replace(INCLUDE_RE, (all, indent, name, argText) => {
      const args = includeArgs(argText);
      let body = cache.get(name);
      if (body === undefined) throw new Error(`build: ${page} — no such partial ${name}`);

      if (name === "_board.html") body = expandBoard(body, args, persist, page);
      if (name === "_nav.html") body = expandNav(body, page);
      if (name === "_chapters.html") body = expandChapters(body, page);

      parts.push(name);
      const argsOut = argText.trim() ? ` ${argText.trim()}` : "";
      return (
        `${indent}<!-- @include ${name}${argsOut} -->\n` +
        `${indent}<!-- GENERATED from docs/${name} by scripts/build.mjs — edit the partial, not this. -->\n` +
        body.replace(/\r?\n$/, "") +
        `\n${indent}<!-- @end -->`
      );
    });

    if (after !== before) {
      await writeFile(file, after);
      touched++;
    }
  }
  return { pages: pages.length, touched };
}

/* ------------------------------------------------------------------- main -- */

async function build() {
  const started = Date.now();
  await mkdir(DIST, { recursive: true });

  const { lines, sources } = await bundle(ENTRY);

  const header =
    `/*! Amber Console ${VERSION} | BSD-3-Clause | https://github.com/DutchDiederik/AmberConsole\n` +
    ` *  Generated by scripts/build.mjs — edit files in src/, not this one.\n` +
    ` *  Fonts in ../fonts/ are SIL OFL 1.1; see fonts/OFL-*.txt.\n` +
    ` */\n`;
  const headerLines = header.split("\n").length - 1;

  const body = lines.map((l) => l.text).join("\n");
  const css = `${header}${body}\n/*# sourceMappingURL=amber-console.css.map */\n`;

  await writeFile(path.join(DIST, "amber-console.css"), css);
  await writeFile(
    path.join(DIST, "amber-console.css.map"),
    JSON.stringify(buildMap(lines, sources, headerLines), null, 2)
  );

  const min = minify(body);
  await writeFile(
    path.join(DIST, "amber-console.min.css"),
    `/*! Amber Console ${VERSION} | BSD-3-Clause */\n${min}\n`
  );

  /* Both layer builds. The layer variant is the one README recommends for
     dropping into an existing app, which is a production context — shipping it
     only unminified handed the most production-shaped consumer the largest
     file. minify() runs on the body, then the wrap adds the banner. */
  await writeFile(path.join(DIST, "amber-console.layer.css"), wrapLayer(body));
  const layerMin = wrapLayer(min);
  await writeFile(path.join(DIST, "amber-console.layer.min.css"), layerMin);

  /* Two independently optional modules, each shipped in both flavors. They are
     built the same way and must never import each other — the classic-script
     builds have no module system to do it with, and the split only means
     anything if either can be loaded alone. */
  for (const [file, globalName, exports] of MODULES) {
    const source = await readFile(path.join(SRC, file), "utf8");
    await copyFile(path.join(SRC, file), path.join(DIST, file));
    await writeFile(
      path.join(DIST, file.replace(/\.js$/, ".global.js")),
      toGlobal(source, file, globalName, exports)
    );
  }

  const docs = await expandDocs();

  const kb = (n) => `${(n / 1024).toFixed(1)}kb`;
  console.log(
    `  amber-console.css            ${kb(css.length)}\n` +
      `  amber-console.min.css        ${kb(min.length)}\n` +
      `  amber-console.layer.css      ${kb(body.length + 400)}\n` +
      `  amber-console.layer.min.css  ${kb(layerMin.length)}\n` +
      `  ${sources.length} sources, ${lines.length} lines, ${Date.now() - started}ms\n` +
      `  docs: ${docs.pages} pages, ${docs.touched} rewritten`
  );
}

/* ------------------------------------------------------------------ serve -- */

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
};

function serve(port = 4173) {
  const server = http
    .createServer(async (req, res) => {
      let rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (rel === "/") rel = "/docs/index.html";

      /* Confine to the repo — no traversal above ROOT. */
      const file = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ""));
      if (!file.startsWith(ROOT)) {
        res.writeHead(403).end("forbidden");
        return;
      }

      try {
        const body = await readFile(file);
        res.writeHead(200, {
          "content-type": MIME[path.extname(file)] ?? "application/octet-stream",
          "cache-control": "no-store",
        });
        res.end(body);
      } catch {
        res.writeHead(404).end("not found");
      }
    })
    .listen(port, () => console.log(`\n  serving http://localhost:${port}/  (docs/)`));

  /* An unhandled 'error' event on a Server is a fatal throw with a stack trace,
     which is a poor way to say "something else is on 4173". */
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `\n  port ${port} is already in use — close the other server, or run\n` +
          `  \`node scripts/build.mjs --watch --serve --port <n>\` on another one.\n`
      );
    } else {
      console.error(`\n  server error: ${err.message}\n`);
    }
    process.exitCode = 1;
    server.close();
  });
}

const args = process.argv.slice(2);
await build();

if (args.includes("--serve")) {
  const at = args.indexOf("--port");
  serve(at === -1 ? 4173 : Number(args[at + 1]) || 4173);
}

if (args.includes("--watch")) {
  let pending;
  const rebuild = () => {
    clearTimeout(pending);
    pending = setTimeout(() => build().catch((e) => console.error(e.message)), 60);
  };

  /* Recursive fs.watch was macOS/Windows-only for years; Linux support landed
     during Node 20, and on Node 18 there it THROWS rather than degrading.
     package.json says engines >=18 and that is a promise to consumers, who get
     CSS and never run this file — so the floor stays where it is and the dev
     script copes instead. Watching src/ non-recursively still catches edits to
     the entry point; the subdirectories are the part that needs the newer Node. */
  try {
    watch(SRC, { recursive: true }, rebuild);
    console.log("  watching src/ …");
  } catch (err) {
    if (err.code !== "ERR_FEATURE_UNAVAILABLE_ON_PLATFORM") throw err;
    for (const dir of ["", "tokens", "base", "components", "sim"]) {
      watch(path.join(SRC, dir), rebuild);
    }
    console.log("  watching src/ … (flat: recursive watch needs Node 20+ on Linux)");
  }
}

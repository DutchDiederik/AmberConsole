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
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
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
    `/* Amber Console ${VERSION} — @layer build.\n` +
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
function toGlobal(source) {
  const body = source
    .replace(/^export default [\s\S]*?;\s*$/m, "")
    .replace(/^export /gm, "")
    .trim();

  return (
    `/*! Amber Console ${VERSION} | MIT | classic-script build\n` +
    ` *  Generated from src/amber-console.js by scripts/build.mjs.\n` +
    ` *  Use this with a plain <script src> — including from file:// URLs, where\n` +
    ` *  type="module" is blocked. Exposes window.AmberConsole.\n` +
    ` */\n` +
    `(function () {\n"use strict";\n\n${body}\n\n` +
    `window.AmberConsole = { init: init, afterglow: afterglow };\n})();\n`
  );
}

/* ------------------------------------------------------------------- main -- */

async function build() {
  const started = Date.now();
  await mkdir(DIST, { recursive: true });

  const { lines, sources } = await bundle(ENTRY);

  const header =
    `/*! Amber Console ${VERSION} | MIT | https://github.com/DutchDiederik/amber-console\n` +
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
    `/*! Amber Console ${VERSION} | MIT */\n${min}\n`
  );

  /* Both layer builds. The layer variant is the one README recommends for
     dropping into an existing app, which is a production context — shipping it
     only unminified handed the most production-shaped consumer the largest
     file. minify() runs on the body, then the wrap adds the banner. */
  await writeFile(path.join(DIST, "amber-console.layer.css"), wrapLayer(body));
  const layerMin = wrapLayer(min);
  await writeFile(path.join(DIST, "amber-console.layer.min.css"), layerMin);

  await copyFile(path.join(SRC, "amber-console.js"), path.join(DIST, "amber-console.js"));
  await writeFile(path.join(DIST, "amber-console.global.js"), toGlobal(await readFile(path.join(SRC, "amber-console.js"), "utf8")));

  const kb = (n) => `${(n / 1024).toFixed(1)}kb`;
  console.log(
    `  amber-console.css            ${kb(css.length)}\n` +
      `  amber-console.min.css        ${kb(min.length)}\n` +
      `  amber-console.layer.css      ${kb(body.length + 400)}\n` +
      `  amber-console.layer.min.css  ${kb(layerMin.length)}\n` +
      `  ${sources.length} sources, ${lines.length} lines, ${Date.now() - started}ms`
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
    for (const dir of ["", "tokens", "base", "components"]) {
      watch(path.join(SRC, dir), rebuild);
    }
    console.log("  watching src/ … (flat: recursive watch needs Node 20+ on Linux)");
  }
}

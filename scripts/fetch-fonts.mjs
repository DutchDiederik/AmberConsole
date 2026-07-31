#!/usr/bin/env node
/**
 * fetch-fonts.mjs — download the two OFL webfaces and generate src/tokens/fonts.css.
 *
 * Zero dependencies: Node's built-in fetch and fs only. Run once; the woff2 files
 * and the generated CSS are committed, so nobody else ever needs a network.
 *
 *   node scripts/fetch-fonts.mjs
 *
 * Asking the Google Fonts CSS2 API with a modern browser User-Agent returns woff2
 * @font-face blocks with one block per unicode subset. We keep the real
 * unicode-range values and rewrite only the src URLs to local relative paths.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FONT_DIR = path.join(ROOT, "fonts");

/* A UA new enough that the API serves woff2 rather than ttf. */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/**
 * REGULAR ONLY, BOTH FAMILIES, and that is a design rule rather than an
 * oversight: "there is no bold in the terminal face — weight carries no meaning
 * here" (see base/reset.css). VT323 has no bold to fetch; Silkscreen does, and
 * fetching it shipped 10.5kb of woff2 to every consumer for a weight nothing in
 * the system ever requests. Adding `:wght@400;700` back would also make the two
 * faces inconsistent — micro labels able to go bold while body text cannot.
 */
const FAMILIES = [
  {
    api: "VT323",
    /** file basename -> the local name we save it under, per weight */
    faces: [{ weight: "400", file: "VT323-Regular.woff2" }],
  },
  {
    api: "Silkscreen",
    faces: [{ weight: "400", file: "Silkscreen-Regular.woff2" }],
  },
];

/* OFL text lives in the upstream repo; both fonts are SIL OFL 1.1. */
const LICENSES = [
  {
    out: "OFL-VT323.txt",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/vt323/OFL.txt",
  },
  {
    out: "OFL-Silkscreen.txt",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/silkscreen/OFL.txt",
  },
];

async function get(url, asBuffer = false) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return asBuffer ? Buffer.from(await res.arrayBuffer()) : res.text();
}

/** Split a Google Fonts CSS response into structured @font-face records. */
function parseFontFaces(css) {
  const out = [];
  const blockRe = /\/\*\s*([\w[\]-]+)\s*\*\/\s*@font-face\s*\{([^}]+)\}/g;
  let m;
  while ((m = blockRe.exec(css)) !== null) {
    const [, subset, body] = m;
    const pick = (prop) => {
      const hit = new RegExp(`${prop}\\s*:\\s*([^;]+);`).exec(body);
      return hit ? hit[1].trim() : null;
    };
    const srcRaw = pick("src") || "";
    const url = /url\(([^)]+)\)/.exec(srcRaw);
    out.push({
      subset,
      family: (pick("font-family") || "").replace(/['"]/g, ""),
      style: pick("font-style") || "normal",
      weight: pick("font-weight") || "400",
      unicodeRange: pick("unicode-range"),
      url: url ? url[1].replace(/['"]/g, "") : null,
    });
  }
  return out;
}

async function main() {
  await mkdir(FONT_DIR, { recursive: true });

  const rendered = [];
  /** Remote woff2 URL -> local filename. One download per distinct URL. */
  const downloads = new Map();

  for (const family of FAMILIES) {
    const api = `https://fonts.googleapis.com/css2?family=${family.api}&display=swap`;
    console.log(`  fetching CSS  ${family.api}`);
    const faces = parseFontFaces(await get(api));
    if (!faces.length) throw new Error(`no @font-face blocks parsed for ${family.api}`);

    for (const face of faces) {
      const target = family.faces.find((f) => f.weight === String(face.weight));
      if (!target || !face.url) continue;

      /* Distinct subsets of the same weight need distinct filenames. */
      const suffix = face.subset === "latin" ? "" : `-${face.subset}`;
      const file = target.file.replace(/\.woff2$/, `${suffix}.woff2`);
      downloads.set(face.url, file);
      rendered.push({ ...face, file });
    }
  }

  for (const [url, file] of downloads) {
    console.log(`  downloading   ${file}`);
    await writeFile(path.join(FONT_DIR, file), await get(url, true));
  }

  for (const lic of LICENSES) {
    console.log(`  downloading   ${lic.out}`);
    await writeFile(path.join(FONT_DIR, lic.out), await get(lic.url));
  }

  const css = `/* ===========================================================================
   Amber Console — self-hosted webfonts

   Two bitmap faces, both SIL Open Font License 1.1 (see fonts/OFL-*.txt):

     VT323       everything at 18px and up  -> --ac-font-terminal
     Silkscreen  8-10px micro labels ONLY   -> --ac-font-micro

   These are era-correct SUBSTITUTES, not the original face. The source hardware
   used a mask-ROM bitmap font with no digital release; VT323 is a digitization of
   the DEC VT320 terminal ROM. To swap in a licensed face closer to the hardware,
   replace --ac-font-terminal in tokens/typography.css and nothing else.

   GENERATED by scripts/fetch-fonts.mjs — do not edit by hand.

   Paths are relative and resolve without a server (file:// works):
     from src/tokens/fonts.css  ->  ../../fonts/
     from dist/amber-console.css ->  ../fonts/     (rewritten by scripts/build.mjs)

   Prefer not to vendor the binaries? Swap this import for tokens/fonts-cdn.css
   in amber-console.css.
   =========================================================================== */

${rendered
  .map(
    (f) => `/* ${f.family} ${f.weight} — ${f.subset} */
@font-face {
  font-family: "${f.family}";
  font-style: ${f.style};
  font-weight: ${f.weight};
  font-display: swap;
  src: url("../../fonts/${f.file}") format("woff2");${
    f.unicodeRange ? `\n  unicode-range: ${f.unicodeRange};` : ""
  }
}`
  )
  .join("\n\n")}
`;

  await writeFile(path.join(ROOT, "src", "tokens", "fonts.css"), css);
  console.log(`\n  wrote src/tokens/fonts.css — ${rendered.length} @font-face rules`);
}

main().catch((err) => {
  console.error("\nfetch-fonts failed:", err.message);
  console.error(
    "Fonts could not be downloaded. src/tokens/fonts-cdn.css still works as a\n" +
      "network-dependent fallback — point amber-console.css at it instead."
  );
  process.exit(1);
});

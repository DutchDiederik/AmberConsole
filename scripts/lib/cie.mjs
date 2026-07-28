/**
 * cie.mjs — CIE 1931 2-degree standard observer, and the transforms from a line
 * spectrum to an sRGB hex. Zero dependencies, like everything else in scripts/.
 *
 * This file contains no opinions about display hardware. It answers exactly one
 * question — "what color is this list of wavelengths and intensities" — and
 * scripts/derive-gas.mjs decides what to do with the answer.
 */

/* CIE 1931 2-degree colour matching functions, 5nm, 380-780nm.
   [x-bar, y-bar, z-bar] per row. y-bar is also the photopic luminosity
   function V(lambda), which is why a 750nm line at ten thousand counts is
   worth less to the eye than a 555nm line at one. */
const CMF_START = 380;
const CMF_STEP = 5;
const CMF = [
  [0.001368, 0.000039, 0.006450], [0.002236, 0.000064, 0.010550],
  [0.004243, 0.000120, 0.020050], [0.007650, 0.000217, 0.036210],
  [0.014310, 0.000396, 0.067850], [0.023190, 0.000640, 0.110200],
  [0.043510, 0.001210, 0.207400], [0.077630, 0.002180, 0.371300],
  [0.134380, 0.004000, 0.645600], [0.214770, 0.007300, 1.039050],
  [0.283900, 0.011600, 1.385600], [0.328500, 0.016840, 1.622960],
  [0.348280, 0.023000, 1.747060], [0.348060, 0.029800, 1.782600],
  [0.336200, 0.038000, 1.772110], [0.318700, 0.048000, 1.744100],
  [0.290800, 0.060000, 1.669200], [0.251100, 0.073900, 1.528100],
  [0.195360, 0.090980, 1.287640], [0.142100, 0.112600, 1.041900],
  [0.095640, 0.139020, 0.812950], [0.057950, 0.169300, 0.616200],
  [0.032010, 0.208020, 0.465180], [0.014700, 0.258600, 0.353300],
  [0.004900, 0.323000, 0.272000], [0.002400, 0.407300, 0.212300],
  [0.009300, 0.503000, 0.158200], [0.029100, 0.608200, 0.111700],
  [0.063270, 0.710000, 0.078250], [0.109600, 0.793200, 0.057250],
  [0.165500, 0.862000, 0.042160], [0.225750, 0.914850, 0.029840],
  [0.290400, 0.954000, 0.020300], [0.359700, 0.980300, 0.013400],
  [0.433450, 0.994950, 0.008750], [0.512050, 1.000000, 0.005750],
  [0.594500, 0.995000, 0.003900], [0.678400, 0.978600, 0.002750],
  [0.762100, 0.952000, 0.002100], [0.842500, 0.915400, 0.001800],
  [0.916300, 0.870000, 0.001650], [0.978600, 0.816300, 0.001400],
  [1.026300, 0.757000, 0.001100], [1.056700, 0.694900, 0.001000],
  [1.062200, 0.631000, 0.000800], [1.045600, 0.566800, 0.000600],
  [1.002600, 0.503000, 0.000340], [0.938400, 0.441200, 0.000240],
  [0.854450, 0.381000, 0.000190], [0.751400, 0.321000, 0.000100],
  [0.642400, 0.265000, 0.000050], [0.541900, 0.217000, 0.000030],
  [0.447900, 0.175000, 0.000020], [0.360800, 0.138200, 0.000010],
  [0.283500, 0.107000, 0.000000], [0.218700, 0.081600, 0.000000],
  [0.164900, 0.061000, 0.000000], [0.121200, 0.044580, 0.000000],
  [0.087400, 0.032000, 0.000000], [0.063600, 0.023200, 0.000000],
  [0.046770, 0.017000, 0.000000], [0.032900, 0.011920, 0.000000],
  [0.022700, 0.008210, 0.000000], [0.015840, 0.005723, 0.000000],
  [0.011359, 0.004102, 0.000000], [0.008111, 0.002929, 0.000000],
  [0.005790, 0.002091, 0.000000], [0.004109, 0.001484, 0.000000],
  [0.002899, 0.001047, 0.000000], [0.002049, 0.000740, 0.000000],
  [0.001440, 0.000520, 0.000000], [0.001000, 0.000361, 0.000000],
  [0.000690, 0.000249, 0.000000], [0.000476, 0.000172, 0.000000],
  [0.000332, 0.000120, 0.000000], [0.000235, 0.000085, 0.000000],
  [0.000166, 0.000060, 0.000000], [0.000117, 0.000042, 0.000000],
  [0.000083, 0.000030, 0.000000], [0.000059, 0.000021, 0.000000],
  [0.000042, 0.000015, 0.000000],
];

/** Linear interpolation into the CMF table. Outside 380-780 the eye is blind. */
export function cmf(nm) {
  if (nm < CMF_START || nm > CMF_START + CMF_STEP * (CMF.length - 1)) return [0, 0, 0];
  const t = (nm - CMF_START) / CMF_STEP;
  const i = Math.floor(t);
  const f = t - i;
  if (i >= CMF.length - 1) return CMF[CMF.length - 1];
  return CMF[i].map((v, k) => v + f * (CMF[i + 1][k] - v));
}

/** Sum a line list, [[nm, intensity], ...], into CIE XYZ. */
export function linesToXYZ(lines) {
  let X = 0, Y = 0, Z = 0;
  for (const [nm, intensity] of lines) {
    const [xb, yb, zb] = cmf(nm);
    X += intensity * xb;
    Y += intensity * yb;
    Z += intensity * zb;
  }
  return [X, Y, Z];
}

/** XYZ -> CIE xy chromaticity. */
export function xyOf([X, Y, Z]) {
  const s = X + Y + Z;
  return s === 0 ? [0, 0] : [X / s, Y / s];
}

/* sRGB, D65. Rows of the standard XYZ->linear-RGB matrix. */
const M = [
  [3.2406, -1.5372, -0.4986],
  [-0.9689, 1.8758, 0.0415],
  [0.0557, -0.2040, 1.0570],
];

/** Chromaticity xy at a given luminance Y, as LINEAR rgb (may be out of gamut). */
export function xyYToLinearRGB(x, y, Y) {
  if (y === 0) return [0, 0, 0];
  const X = (x / y) * Y;
  const Z = ((1 - x - y) / y) * Y;
  return M.map(([a, b, c]) => a * X + b * Y + c * Z);
}

/** sRGB transfer function, linear -> encoded, both 0..1. */
const encode = (u) => (u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(u, 1 / 2.4) - 0.055);
const decode = (u) => (u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4));

export const hexOf = (linear) =>
  "#" + linear.map((u) => {
    const v = Math.round(Math.min(1, Math.max(0, encode(u))) * 255);
    return v.toString(16).padStart(2, "0");
  }).join("");

export function linearOfHex(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => decode(parseInt(full.slice(i, i + 2), 16) / 255));
}

/** WCAG relative luminance of a linear rgb triple. */
export const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export const contrast = (l1, l2) => {
  const [hi, lo] = [l1, l2].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
};

/* D65 white, the point we desaturate toward when a chromaticity will not fit. */
export const D65 = [0.3127, 0.3290];

/**
 * Pull a chromaticity toward D65 until it fits inside sRGB at luminance Y.
 *
 * A real emitter is under no obligation to sit inside a 1996 television gamut,
 * and three of the four gases here do not: their blue channel solves above 1.
 * Clipping would shift the hue by whichever channel happened to overflow, so
 * instead we walk along the line to the white point, which desaturates without
 * rotating hue — the same move the neon derivation already documents.
 *
 * Returns { rgb, x, y, mixed } where `mixed` is how far it had to travel, 0
 * meaning the emitter fit as measured.
 */
export function fitToGamut(x, y, Y, mode = "mix") {
  const EPS = 1e-4;
  const fits = (rgb) => rgb.every((u) => u >= -EPS && u <= 1 + EPS);

  const raw = xyYToLinearRGB(x, y, Y);
  if (fits(raw)) return { rgb: raw, x, y, mixed: 0 };

  /* CLIP. Hold the two channels that fit and let the overflowing one saturate at
     1. The emitter keeps its vividness and pays for it in chromaticity — this is
     what the shipped neon ramp does, and it is why --amber-90 is #ff6b08 with
     the blue channel still at 8/255 rather than a pale salmon. */
  if (mode === "clip") {
    const rgb = raw.map((u) => Math.min(1, Math.max(0, u)));
    return { rgb, x, y, mixed: 0, clipped: true };
  }

  /* MIX. Walk along the line to D65 until the whole triple fits. Chromaticity
     stays on a defensible path — this is what an overdriven cell genuinely does,
     it whitens — but it lifts every channel, so vividness goes first. */
  let lo = 0;
  let hi = 1;
  const at = (t) => {
    const px = x + (D65[0] - x) * t;
    const py = y + (D65[1] - y) * t;
    return { rgb: xyYToLinearRGB(px, py, Y), x: px, y: py };
  };
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (fits(at(mid).rgb)) hi = mid;
    else lo = mid;
  }
  const out = at(hi);
  return { ...out, rgb: out.rgb.map((u) => Math.min(1, Math.max(0, u))), mixed: hi };
}

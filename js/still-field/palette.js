/**
 * Theme colours, pre-quantised so the render loop never parses one.
 *
 * `getComputedStyle` forces a style recalculation for the whole document, so it
 * is called **once per theme change and never per frame**. Everything the
 * renderer needs is derived here and looked up by index afterwards:
 *
 * - two 16-step ramps, from the theme's node/edge colour through the bright
 *   accent to the spark, selected by quantised energy;
 * - the instrumentation ink, which is a separate set of tokens from the field
 *   ramp because text has a contrast requirement the field does not — the ramp
 *   is allowed to sink into the background, a readout is not.
 *
 * Restyling the Still Field is therefore a CSS edit: change the custom
 * properties in `css/styles.css` and this file picks them up on the next theme
 * change.
 */

/** Quantisation of the base→spark colour ramp. 16 steps is past the eye. */
export const COLOR_STEPS = 16;

/** Ramps, written in place so no caller ever holds a stale array. */
export const nodePalette = new Array(COLOR_STEPS).fill('rgb(190,195,210)');
export const edgePalette = new Array(COLOR_STEPS).fill('rgb(160,165,180)');
/** X, Y, Z — the transform callout colours its rows with these, in order. */
export const axisColors = ['rgb(226,102,106)', 'rgb(139,208,90)', 'rgb(96,150,232)'];

/** Single-value colours and the field's baseline opacities. */
export const paint = {
  /**
   * The node and edge tokens' own alpha is the field's baseline opacity; the
   * ramps themselves are opaque and alpha is applied per element.
   */
  nodeAlpha: 0.55,
  edgeAlpha: 0.22,
  glow: 'rgba(124, 58, 237, 0.55)',
  /** Primary instrumentation text. */
  ink: 'rgb(212,212,220)',
  /** Keys, gutters, rules. */
  inkMuted: 'rgb(140,140,158)',
  /** Heads, active line, leader lines. */
  accent: 'rgb(167,139,250)',
  /** Backing plate behind callouts. */
  plate: 'rgba(12,12,18,0.72)',
  hairline: 'rgba(167,139,250,0.30)',
};

/**
 * Parse the `rgb()`, `rgba()` and `#rgb`/`#rrggbb` forms our theme tokens use.
 * Returns null for anything else so callers can fall back rather than paint
 * `NaN` into the canvas.
 * @param {string} value
 * @returns {{r: number, g: number, b: number, a: number}|null}
 */
function parseColor(value) {
  if (!value) return null;
  const str = value.trim();

  const fn = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/i.exec(str);
  if (fn) {
    return {
      r: Number(fn[1]),
      g: Number(fn[2]),
      b: Number(fn[3]),
      a: fn[4] === undefined ? 1 : Number(fn[4]),
    };
  }

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(str);
  if (hex) {
    const h = hex[1];
    const full = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
      a: 1,
    };
  }

  return null;
}

function rgbString(c) {
  return `rgb(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)})`;
}

function rgbaString(c, alpha) {
  return `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${alpha})`;
}

/**
 * Build a quantised colour ramp from `base` to `spark` through `mid`.
 *
 * The midpoint matters: a straight lerp from a cool violet-grey to cyan passes
 * through a desaturated blue that reads as dirty rather than electric. Bending
 * the ramp through the bright purple accent keeps luminance and saturation up
 * across the whole range, so rising energy looks like it is charging rather
 * than washing out.
 *
 * @param {string[]} out array of COLOR_STEPS strings, written in place
 */
function buildPalette(out, base, mid, spark) {
  for (let k = 0; k < COLOR_STEPS; k++) {
    const t = k / (COLOR_STEPS - 1);
    let r, g, b;
    if (t < 0.5) {
      const u = t * 2;
      r = base.r + (mid.r - base.r) * u;
      g = base.g + (mid.g - base.g) * u;
      b = base.b + (mid.b - base.b) * u;
    } else {
      const u = (t - 0.5) * 2;
      r = mid.r + (spark.r - mid.r) * u;
      g = mid.g + (spark.g - mid.g) * u;
      b = mid.b + (spark.b - mid.b) * u;
    }
    out[k] = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
  }
}

/**
 * Re-read theme colours from CSS custom properties. Call after a theme change;
 * doing this per frame would force a style recalculation every frame.
 */
export function refreshThemeColors() {
  const style = getComputedStyle(document.documentElement);
  const read = name => style.getPropertyValue(name).trim();

  const node = parseColor(read('--still-field-node')) || { r: 176, g: 170, b: 212, a: 0.58 };
  const edge = parseColor(read('--still-field-edge')) || { r: 148, g: 142, b: 192, a: 0.24 };
  const mid = parseColor(read('--still-field-mid')) || { r: 167, g: 139, b: 250, a: 1 };
  const spark = parseColor(read('--still-field-spark')) || { r: 34, g: 211, b: 238, a: 1 };
  const glowSource = parseColor(read('--still-field-glow')) || { r: 124, g: 58, b: 237, a: 0.6 };

  paint.nodeAlpha = node.a;
  paint.edgeAlpha = edge.a;

  buildPalette(nodePalette, node, mid, spark);
  buildPalette(edgePalette, edge, mid, spark);

  paint.glow = rgbaString(glowSource, 0.85);

  const ink = parseColor(read('--still-ink')) || { r: 212, g: 212, b: 220, a: 1 };
  const inkMuted = parseColor(read('--still-ink-muted')) || { r: 140, g: 140, b: 158, a: 1 };
  const accent = parseColor(read('--still-ink-accent')) || mid;
  const plate = parseColor(read('--still-plate')) || { r: 12, g: 12, b: 18, a: 0.72 };
  paint.ink = rgbString(ink);
  paint.inkMuted = rgbString(inkMuted);
  paint.accent = rgbString(accent);
  paint.plate = rgbaString(plate, plate.a);
  paint.hairline = rgbaString(accent, 0.34);

  const axisX = parseColor(read('--still-axis-x'));
  const axisY = parseColor(read('--still-axis-y'));
  const axisZ = parseColor(read('--still-axis-z'));
  if (axisX) axisColors[0] = rgbString(axisX);
  if (axisY) axisColors[1] = rgbString(axisY);
  if (axisZ) axisColors[2] = rgbString(axisZ);
}

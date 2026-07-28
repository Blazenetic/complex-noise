/**
 * The display environment: the two canvases, the viewport, and the device.
 *
 * Two surfaces, and the separation is load-bearing:
 *
 * - `surfaces.fieldCtx` keeps a trail. Each frame subtracts alpha from the last
 *   with `destination-out`, which is what gives the drift its comet tail.
 * - `surfaces.infoCtx` is cleared outright every frame. Text cannot share a
 *   surface with a trail and stay crisp: a moving label leaves half a second of
 *   decaying copies of itself smeared along its path, which is exactly the soft
 *   halo that made the callouts look blurred.
 *
 * Everything that paints text therefore goes on the info canvas, never sets
 * `shadowBlur`, and snaps glyph origins to whole device pixels with `snap()`.
 */

/**
 * Viewport classes, in CSS px.
 *
 * How much instrumentation a screen can carry is a property of the screen, not
 * of any one overlay, so both the callout cap and the edge-dimension cap are
 * decided from the same two thresholds. A phone keeps the quiet original
 * counts; a wide display has room for more without turning into a wall of text.
 */
export const WIDE_VIEWPORT = 1180;
export const MEDIUM_VIEWPORT = 720;

/** The canvases and their contexts. Assigned once, by `initStillField()`. */
export const surfaces = {
  /** @type {HTMLCanvasElement|null} */ field: null,
  /** @type {CanvasRenderingContext2D|null} */ fieldCtx: null,
  /** @type {HTMLCanvasElement|null} */ info: null,
  /** @type {CanvasRenderingContext2D|null} */ infoCtx: null,
  /** Feature test once, at init: `roundRect` is recent enough to still miss. */
  hasRoundRect: false,
  /** True while the info canvas is known to be empty, so we clear it once. */
  infoCleared: true,
};

/**
 * The viewport, in CSS pixels, and what the device will honour.
 *
 * `dpr` is capped at 2: beyond that the pixel count grows quadratically for a
 * difference nobody can see on a hairline, and this canvas runs all night.
 */
export const view = {
  w: 0,
  h: 0,
  dpr: 1,
  /**
   * Users who ask for reduced motion still get the field if they turned it on,
   * but slowed right down and without the pulsing glow.
   */
  reducedMotion: false,
};

const reducedMotionQuery = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : null;
view.reducedMotion = reducedMotionQuery ? reducedMotionQuery.matches : false;

/** Follow the OS preference for as long as the page is open. */
export function watchReducedMotion() {
  if (reducedMotionQuery && reducedMotionQuery.addEventListener) {
    reducedMotionQuery.addEventListener('change', e => { view.reducedMotion = e.matches; });
  }
}

/**
 * Snap a CSS-pixel coordinate to the device pixel grid.
 *
 * A label that moves with its node is only crisp if its baseline lands on a
 * whole device pixel; a half-pixel origin is resolved by anti-aliasing, which
 * on 10px monospace reads as blur.
 * @param {number} v
 */
export function snap(v) {
  return Math.round(v * view.dpr) / view.dpr;
}

/** Re-read the viewport and resize both backing stores to match. */
export function measureViewport() {
  view.dpr = Math.min(window.devicePixelRatio || 1, 2);
  view.w = window.innerWidth;
  view.h = window.innerHeight;
  sizeCanvas(surfaces.field, surfaces.fieldCtx);
  sizeCanvas(surfaces.info, surfaces.infoCtx);
}

function sizeCanvas(canvas, ctx) {
  if (!canvas || !ctx) return;
  canvas.width = Math.floor(view.w * view.dpr);
  canvas.height = Math.floor(view.h * view.dpr);
  canvas.style.width = view.w + 'px';
  canvas.style.height = view.h + 'px';
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
}

/** Hide or show both canvases together. The field switch governs both. */
export function applyCanvasVisibility(enabled) {
  if (surfaces.field) surfaces.field.classList.toggle('still-field-off', !enabled);
  if (surfaces.info) surfaces.info.classList.toggle('still-field-off', !enabled);
}

/** Wipe the field canvas outright. Used when the loop stops, not per frame. */
export function clearFieldCanvas() {
  if (surfaces.fieldCtx) surfaces.fieldCtx.clearRect(0, 0, view.w, view.h);
}

/**
 * Empty the info canvas, at most once per state change.
 *
 * Turning the layer off has to *clear* the surface, not merely stop drawing to
 * it, or the last frame of instrumentation sits frozen over a live field.
 * @param {boolean} [force] clear even if we believe it is already empty
 */
export function clearInfoCanvas(force = false) {
  if (force) surfaces.infoCleared = false;
  if (!surfaces.infoCtx || surfaces.infoCleared) return;
  surfaces.infoCtx.clearRect(0, 0, view.w, view.h);
  surfaces.infoCleared = true;
}

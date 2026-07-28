/**
 * Still Field — a slow, three-dimensional field of nodes and connections.
 *
 * Nodes drift through a shallow perspective volume, gently coming toward the
 * viewer and receding again. They are born, live, and fade out; when one fades,
 * the lines attached to it retract into their surviving partners rather than
 * blinking off. Colour and glow ride a layered energy signal — part procedural,
 * part frequency-band data from the audio engine — so the field breathes with
 * the noise without ever becoming busy.
 *
 * ## Contract
 *
 * This module owns exactly two DOM elements: the field canvas and the info
 * canvas handed to `initStillField()`. It never queries the document for
 * anything else. UI controls are rendered by app.js from the snapshot published
 * via `subscribe()`.
 *
 * ## Why there are two canvases
 *
 * The field canvas keeps a trail: each frame subtracts alpha from the previous
 * one with `destination-out`. That is what gives the drift its comet tail — and
 * it is also what made every callout look like it had a soft glow behind it,
 * because a moving label leaves half a second of decaying copies of itself
 * smeared along its path. Text cannot share a surface with a trail and stay
 * crisp.
 *
 * So the instrumentation lives on its own canvas, cleared outright every frame.
 * No trail, no `shadowBlur`, glyph origins snapped to whole device pixels: the
 * text is as sharp as the display can draw it, however fast it is moving. The
 * second surface costs one `clearRect` per frame and only while the layer is on.
 *
 * ## Performance notes
 *
 * The field is on by default, and the visualisation is toggleable, so the
 * budget is "excellent on a desktop, still honest on a phone". The rules that
 * keep it cheap:
 *
 * - **Frame rate is capped, and the cap is a setting** (30 / 45 / 60). Motion is
 *   integrated from real elapsed time, so the field drifts at exactly the same
 *   rate whichever cap is chosen — including the trail, whose decay is a rate
 *   per second rather than a per-frame alpha.
 * - **The loop stops when the page is hidden.** Requesting frames that the
 *   browser will only throttle still wakes the compositor; not asking is free.
 * - **No allocation in the render loop.** Colours are pre-quantised into small
 *   palettes at theme-change time and selected by index. Link state, the
 *   spatial grid, callout geometry and edge-annotation slots all live in
 *   pre-sized typed arrays.
 * - **Linking is a uniform grid, not an O(n²) scan.** Each node only tests the
 *   nodes in its own cell and four neighbours, which is what makes a
 *   user-raisable node population affordable at all. Both the real and the
 *   would-be brute-force pair counts are reported in the HUD.
 * - **Consecutive same-style edge segments share a path.** Alpha varies almost
 *   continuously with depth and strength, so this collapses runs rather than
 *   the whole frame — a real saving when the field is calm and a no-op when it
 *   is not. The path count is reported next to the edge count so the ratio is
 *   visible rather than claimed.
 * - **`getComputedStyle` is called once per theme change, never per frame**, and
 *   `--still-energy` is only written when it moves perceptibly, because both
 *   force a style recalculation for the whole document.
 * - **Glow is rationed.** `shadowBlur` is the single most expensive thing on
 *   this canvas, so only the few highest-energy nodes get it, with a hard cap —
 *   and it never touches text.
 */

import {
  STORAGE_KEYS, DEFAULTS,
  STILL_SPEED_MIN, STILL_SPEED_MAX,
  STILL_DENSITY_MIN, STILL_DENSITY_MAX,
  STILL_REACH_MIN, STILL_REACH_MAX,
  STILL_TRAIL_MIN, STILL_TRAIL_MAX,
  STILL_DEPTH_MIN, STILL_DEPTH_MAX,
  STILL_DWELL_MIN, STILL_DWELL_MAX,
  STILL_FPS_OPTIONS,
} from './constants.js';
import { write, readNumber, readBool, clamp } from './storage.js';
import { getAnalyser, getIsPlaying } from './audio.js';

// ----------------------------------------------------------
// Tuning constants — all the numbers that shape the look
// ----------------------------------------------------------

/**
 * Perspective depth. `z` runs 0 (nearest) to 1 (furthest) and projects through
 * a pinhole camera of focal length 1:
 *
 *     scale(z) = 1 / (1 + z * depth)
 *
 * so the near plane draws at 1.0 and the far plane at 1/(1 + depth). At the
 * default 0.75 that is a 1.75× size ratio across the volume — enough to read as
 * depth, not enough to look like a flying-through-space screensaver. The Field
 * Lab exposes it, which is why it is a variable rather than a constant.
 */
let depth = clamp(readNumber(STORAGE_KEYS.stillFieldDepth, DEFAULTS.stillFieldDepth),
  STILL_DEPTH_MIN, STILL_DEPTH_MAX);
let minScale = 1 / (1 + depth);

/** Longest timestep we will integrate in one go, after a stall or a hidden tab. */
const MAX_STEP_S = 0.1;

/**
 * Node count bounds, measured against the *world* plane rather than the
 * viewport: perspective pulls distant nodes toward the centre, so a count
 * derived from screen area leaves the field looking thin. The ceiling is high
 * because the grid made it affordable — brute-force pair testing is what used
 * to cap this at 44.
 */
const BASE_MIN_NODES = 26;
const BASE_MAX_NODES = 44;
const MIN_NODES = 14;
const MAX_NODES = 150;
const AREA_PER_NODE = 30000;

/** Node lifetime range in seconds, before the speed multiplier. */
const LIFE_MIN_S = 70;
const LIFE_MAX_S = 150;
/** Fractions of a lifetime spent fading in and out. */
const FADE_IN = 0.1;
const FADE_OUT = 0.16;

/** Link envelope rates (per second) — links arrive briskly and leave slowly. */
const LINK_ATTACK = 3.2;
const LINK_RELEASE = 1.1;
/** How much of a new link's brightness comes from the arrival transient. */
const LINK_PULSE_GAIN = 0.9;
/** Below this, a link is invisible and not worth stroking. */
const LINK_EPSILON = 0.004;

/** Energy smoothing rate (per second) for the value mirrored to CSS. */
const ENERGY_SMOOTH = 2.4;
/** Energy must move by at least this much before we touch CSS again. */
const ENERGY_EPSILON = 0.002;

/** Travelling-wave parameters. See computeNodeEnergy(). */
const WAVE_RATE = 0.55;      // rad/s
const WAVE_KX = 0.0042;      // rad per world unit
const WAVE_KY = 0.0042 * 1.6180339887;
/** Only the highest-energy nodes glow, and never more than this many. */
const GLOW_THRESHOLD = 0.52;
const MAX_GLOW_NODES = 10;
/** Nodes pass 0 deferred to the glow pass, so pass 1 never rescans the field. */
const glowQueue = new Int16Array(MAX_GLOW_NODES);
let glowQueueLength = 0;

/** Quantisation of the purple→spark colour ramp. 16 steps is past the eye. */
const COLOR_STEPS = 16;

/**
 * Edge batching quantisation. Alpha to 1/64 and width to 1/8 px are both well
 * under the threshold where a change is visible on a hairline, so rounding to
 * them costs nothing and lets neighbouring edges share a path.
 */
const BATCH_ALPHA_STEPS = 64;
const BATCH_WIDTH_STEPS = 8;

/**
 * Strides of the R2 low-discrepancy sequence (Roberts, 2018), generated from
 * the plastic number g ≈ 1.3247. Successive points fill a rectangle far more
 * evenly than `Math.random()`, which clumps — spawning a replacement node at
 * `frac(a * i)` keeps the field's coverage balanced without any repulsion pass.
 * The third stride carries depth.
 */
const R2_A1 = 0.7548776662466927; // 1/g
const R2_A2 = 0.5698402909980532; // 1/g²
const R2_A3 = 0.4301597090052419; // 1/g³

const PHI = 1.6180339887498949;
const TAU = Math.PI * 2;
const RAD_TO_DEG = 180 / Math.PI;

/** Debounce window for resize — mobile browsers fire it on every URL-bar nudge. */
const RESIZE_DEBOUNCE_MS = 150;

// --- Persisted settings ---
let stillFieldEnabled = readBool(STORAGE_KEYS.stillFieldEnabled, DEFAULTS.stillFieldEnabled);
let stillFieldIntensity = clamp(
  readNumber(STORAGE_KEYS.stillFieldIntensity, DEFAULTS.stillFieldIntensity),
  0,
  1,
);
let stillFieldSpeed = clamp(
  readNumber(STORAGE_KEYS.stillFieldSpeed, DEFAULTS.stillFieldSpeed),
  STILL_SPEED_MIN,
  STILL_SPEED_MAX,
);
let stillFieldNerd = readBool(STORAGE_KEYS.stillFieldNerd, DEFAULTS.stillFieldNerd);
let stillFieldTexture = readBool(STORAGE_KEYS.stillFieldTexture, DEFAULTS.stillFieldTexture);
let stillFieldDensity = clamp(
  readNumber(STORAGE_KEYS.stillFieldDensity, DEFAULTS.stillFieldDensity),
  STILL_DENSITY_MIN,
  STILL_DENSITY_MAX,
);
let stillFieldReach = clamp(
  readNumber(STORAGE_KEYS.stillFieldReach, DEFAULTS.stillFieldReach),
  STILL_REACH_MIN,
  STILL_REACH_MAX,
);
let stillFieldTrail = clamp(
  readNumber(STORAGE_KEYS.stillFieldTrail, DEFAULTS.stillFieldTrail),
  STILL_TRAIL_MIN,
  STILL_TRAIL_MAX,
);
let stillFieldDwell = clamp(
  readNumber(STORAGE_KEYS.stillFieldDwell, DEFAULTS.stillFieldDwell),
  STILL_DWELL_MIN,
  STILL_DWELL_MAX,
);
let stillFieldFps = STILL_FPS_OPTIONS.includes(
  readNumber(STORAGE_KEYS.stillFieldFps, DEFAULTS.stillFieldFps),
) ? readNumber(STORAGE_KEYS.stillFieldFps, DEFAULTS.stillFieldFps) : DEFAULTS.stillFieldFps;
let stillFieldCode = readBool(STORAGE_KEYS.stillFieldCode, DEFAULTS.stillFieldCode);
let stillFieldCallouts = readBool(STORAGE_KEYS.stillFieldCallouts, DEFAULTS.stillFieldCallouts);
let stillFieldEdges = readBool(STORAGE_KEYS.stillFieldEdges, DEFAULTS.stillFieldEdges);

// Session-only fold for the HUD panel (does not persist). Default folded on
// narrow viewports so the main interface is not blocked on first open.
let nerdFolded = typeof window !== 'undefined' && window.innerWidth <= 520;
// Session-only fold for the on-canvas source listing. Folding leaves the header
// bar, which is both the affordance and the reminder that the listing is there.
let codeFolded = false;

// --- Runtime ---
let stillFieldNodes = [];
let linkState = new Float32Array(0); // [i * n + j] link strength, i < j
let spawnIndex = 0;                  // drives the R2 sequence
let clockS = 0;                      // speed-scaled animation clock, in seconds
let infoClockS = 0;                  // real accepted time; diagnostics ignore drift speed
let stillFieldRaf = null;
let lastFrameMs = 0;
let lastDrawMs = 0;
let stillEnergy = 0;          // 0–1 smoothed energy, mirrored to CSS --still-energy
let lastPublishedEnergy = -1; // last value actually written to the CSS variable

let stillFieldCanvas = null;
let stillFieldCtx = null;
let infoCanvas = null;
let infoCtx = null;
let infoCleared = true;
let stillFieldW = 0;   // viewport, CSS px
let stillFieldH = 0;
let worldW = 0;        // world plane, sized so far nodes still reach the edges
let worldH = 0;
let linkRadius = 0;    // world units
let zWorld = 0;        // world units a full depth traverse is worth when linking
let stillFieldDpr = 1;
let resizeDebounceId = null;
let nodeSerial = 0;
let nerdView = 'live';
let hasRoundRect = false;

// Theme-derived colours, refreshed by refreshThemeColors()
const nodePalette = new Array(COLOR_STEPS).fill('rgb(190,195,210)');
const edgePalette = new Array(COLOR_STEPS).fill('rgb(160,165,180)');
let glowColor = 'rgba(124, 58, 237, 0.55)';
let baseNodeAlpha = 0.55;
let baseEdgeAlpha = 0.22;
let inkColor = 'rgb(212,212,220)';       // primary instrumentation text
let inkMutedColor = 'rgb(140,140,158)';  // keys, gutters, rules
let accentColor = 'rgb(167,139,250)';    // heads, active line, leader lines
let plateColor = 'rgba(12,12,18,0.72)';  // backing plate behind callouts
let hairlineColor = 'rgba(167,139,250,0.30)';
const axisColors = ['rgb(226,102,106)', 'rgb(139,208,90)', 'rgb(96,150,232)'];

/**
 * Users who ask for reduced motion still get the field if they turned it on,
 * but slowed right down and without the pulsing glow.
 */
const reducedMotionQuery = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : null;
let reducedMotion = reducedMotionQuery ? reducedMotionQuery.matches : false;

// ----------------------------------------------------------
// Info layer — geometry, typography and timing
// ----------------------------------------------------------

/**
 * Callout cap by viewport. Wider screens have room for more without the field
 * turning into a wall of text; a phone keeps the quiet original count.
 */
const MAX_LABELS = 8;
const LABEL_CAP_WIDE = 8;
const LABEL_CAP_MEDIUM = 6;
const LABEL_CAP_PHONE = 4;
const LABEL_WIDE_VIEWPORT = 1180;
const LABEL_MEDIUM_VIEWPORT = 720;

/**
 * Detail modes a node callout can be showing.
 *
 * The rotation is global — the field walks these on a quasi-periodic schedule —
 * but the mode a *given* node displays is that base index offset by the node's
 * own stable `modeOffset` (derived from its lifetime ID in `respawnNode`, so it
 * survives as long as the node does). Eight nodes on screen therefore read
 * eight different quantities at once, and each of them still cycles through the
 * whole set over a few dwells. One global mode meant every callout on screen was
 * a copy of its neighbour, which is a lot of pixels spent saying one thing.
 */
const LABEL_MODE_NAMES = [
  'energy', 'transform', 'velocity', 'projection',
  'wave', 'links', 'lifecycle', 'seed',
];
const LABEL_MODE_COUNT = LABEL_MODE_NAMES.length;

/**
 * Per-mode handle glyph, drawn on the node the callout belongs to. A square for
 * a transform, a circle for a scalar, a diamond for a phase, a crosshair for a
 * vector: the shape says which family of quantity is being read before the text
 * is legible at all. Values index HANDLE_* below.
 */
const HANDLE_SQUARE = 0, HANDLE_CIRCLE = 1, HANDLE_DIAMOND = 2, HANDLE_CROSS = 3;
const MODE_HANDLE = Int8Array.from([
  HANDLE_CIRCLE,   // energy
  HANDLE_SQUARE,   // transform
  HANDLE_CROSS,    // velocity
  HANDLE_SQUARE,   // projection
  HANDLE_DIAMOND,  // wave
  HANDLE_CROSS,    // links
  HANDLE_CIRCLE,   // lifecycle
  HANDLE_DIAMOND,  // seed
]);

/**
 * Per-mode dwell weights, from the golden ratio.
 *
 * A fixed rotation period is the one piece of this visualisation that felt like
 * a `setInterval` rather than a simulation: five modes, eight seconds each,
 * forever. Weighting each mode by `frac((k + 1)φ)` makes the cycle
 * quasi-periodic instead — every mode gets a different, irrationally-related
 * slice of the cycle, so the rotation never lines up with the travelling wave
 * or with the node lifetimes, and the whole schedule falls out of the same
 * mathematics as the field itself. The weights average 1, so the user's dwell
 * setting is still the mean seconds per mode.
 */
const MODE_WEIGHTS = new Float32Array(LABEL_MODE_COUNT);
let modeWeightSum = 0;
for (let k = 0; k < LABEL_MODE_COUNT; k++) {
  MODE_WEIGHTS[k] = 0.72 + 0.56 * (((k + 1) * PHI) % 1);
  modeWeightSum += MODE_WEIGHTS[k];
}

/** Dynamic label strings are refreshed at human speed, not canvas speed. */
const LABEL_VALUE_SECONDS = 1;

/**
 * Energy a node must exceed before it earns a callout.
 *
 * This has to sit below the *silent* ceiling, and that ceiling is not 1. With
 * nothing playing `getStillAudioMetrics()` reports zeros, so `audioBoost` is 0
 * and `computeNodeEnergy` tops out at `0.3 + 0.24 = 0.54` — the procedural
 * layers alone. A gate at 0.55 was therefore unreachable whenever the audio was
 * paused, and the whole layer silently drew nothing however long you watched
 * it. The field is deliberately alive while paused (see computeNodeEnergy), so
 * the labels have to be too. Keep this comfortably under 0.54.
 */
const LABEL_ENERGY_GATE = 0.42;
/**
 * Hysteresis. A node that already holds a callout keeps it until its energy
 * falls this far below the acquisition gate. Without the gap, a node sitting on
 * the threshold flickers its label on and off — the last thing you want on a
 * screen you are falling asleep to.
 */
const LABEL_ENERGY_RELEASE = 0.10;
/**
 * Callout opacity envelope rates, per second. Slow out is deliberate.
 *
 * Both are deliberately slower than a UI transition would be. A readout that
 * fades in over a fifth of a second and out over half of one reads as twitchy:
 * the eye is still parsing a four-row number when the block starts leaving. At
 * these rates a card takes about half a second to arrive and nearly two to go,
 * which is long enough to finish reading and short enough not to feel stuck.
 *
 * They are rates, not per-frame factors — `update()` runs them through
 * `1 - Math.exp(-rate * dt)`, so the envelope is identical at 30, 45 and 60 fps.
 */
const LABEL_ATTACK = 1.9;
const LABEL_RELEASE = 0.52;
/** A callout, once acquired, is guaranteed this long regardless of energy. */
const LABEL_MIN_HOLD_FRACTION = 0.72;

const HEAD_FONT = '600 10px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
const MONO_FONT = '11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const DIM_FONT = '10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const CODE_FONT = '10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/** Most key/value rows any one detail mode prints. */
const CALLOUT_MAX_ROWS = 4;

/** Callout block geometry, CSS px. Fixed so nothing has to call measureText. */
const CALLOUT_W = 132;
const CALLOUT_PAD_X = 8;
const CALLOUT_PAD_Y = 6;
const CALLOUT_HEAD_H = 13;
const CALLOUT_ROW_H = 13;
const CALLOUT_GAUGE_H = 6;
/** Leader line: a diagonal run out of the node, then a short horizontal shelf. */
const LEADER_RUN = 16;
const LEADER_SHELF = 10;
/** Half-size of the open square drawn on a node that owns a callout. */
const NODE_HANDLE = 4.5;

/** Edge annotation geometry. Text rides the line, blueprint-dimension style. */
const MAX_EDGE_LABELS = 6;
const EDGE_LABEL_MIN_STRENGTH = 0.13;
const EDGE_LABEL_HALF_W = 46;

/**
 * Caption layout, relative to the line the dimension is rotated onto.
 *
 * The lead value sits above the line; the two secondary values used to share a
 * single baseline just below it, one nudged left and one right. At the widths
 * these tables produce — `θ -180°` against `r 1000 u` — that put two runs of
 * mono glyphs into the same ten pixels, and the pair read as one smudge. They
 * get their own lines now, which is also how a real dimension stacks a tolerance
 * under a nominal.
 */
const DIM_FONT_PX = 10;
const EDGE_LABEL_LEAD_BASELINE = -6;
const EDGE_LABEL_ROW_TOP = 4;
const EDGE_LABEL_LINE_H = 9;
/**
 * Half-height of the caption's *unrotated* box, used by the keep-out and
 * slot-proximity tests. Derived rather than picked so it genuinely covers the
 * stack: the lead's ascender above the line, and the lower secondary row's
 * descender below it. Guessing it is how a caption ends up half under a card.
 */
const EDGE_LABEL_HALF_H = Math.ceil(Math.max(
  DIM_FONT_PX - EDGE_LABEL_LEAD_BASELINE,
  EDGE_LABEL_ROW_TOP + EDGE_LABEL_LINE_H + DIM_FONT_PX,
));
/** Shortest projected edge that can carry a caption legibly, in CSS px. */
const EDGE_LABEL_MIN_SPAN = 52;

/**
 * What a given edge dimension measures.
 *
 * Every dimension used to read `d u / θ / Δz`, once per slot, which makes every
 * one after the first worth nothing. The kind is derived from the *pair's* identity
 * (`frac((idA + idB·φ))`), so it is stable for as long as the pair exists — a
 * dimension never mutates into a different quantity while you are reading it —
 * and neighbouring edges reliably disagree, because consecutive integers land in
 * different buckets under the golden ratio.
 */
const EDGE_KIND_SPAN = 0;      // d u          θ …°     Δz …
const EDGE_KIND_COUPLING = 1;  // κ 0.62       t …      Δz …
const EDGE_KIND_REACH = 2;     // d/r 0.48     r … u    θ …°
const EDGE_KIND_ENERGY = 3;    // E 0.55       ΔE …     deg …
const EDGE_KIND_COUNT = 4;
/**
 * Attack/release for an annotation's opacity, per second.
 *
 * Matched to the node callouts' envelopes and for the same reason. A dimension
 * leaves for two reasons that have nothing to do with the reader — the pair
 * softens below the strength gate, or its midpoint slides under the listing —
 * and at the old release rate either one snatched the number away mid-read.
 */
const EDGE_LABEL_ATTACK = 1.9;
const EDGE_LABEL_RELEASE = 0.62;

/**
 * Keep-out band for callout placement. The world plane is sized so the *far*
 * plane fills the viewport, which means near nodes legitimately project past
 * the edges — and those are exactly the nodes a nearest-first pick favours. An
 * off-screen callout costs a `fillText` and shows nothing, so they never become
 * candidates.
 */
const LABEL_EDGE_X = 30;
const LABEL_EDGE_Y = 20;

/**
 * Screen rectangles the labels must stay out of, in CSS px. Empty means none.
 *
 * The canvas is painted *behind* the controls, so a label that lands under a
 * card is a `fillText` that renders into a surface nobody can see — and on a
 * phone, where the control column spans the viewport, that was every single
 * one of them. app.js measures the chrome and pushes it here on resize, on
 * scroll and whenever the interface is minimised or restored; measuring it in
 * this module would mean a `getBoundingClientRect` per frame, which forces
 * layout exactly like the `getComputedStyle` call the header warns about.
 *
 * Kept as separate rectangles rather than one union: the header, the control
 * column and the stats readout sit in different corners, and a bounding box
 * around all three would swallow the whole viewport.
 */
let labelKeepOuts = [];

// Pre-sized callout selection and geometry (no allocation in the render loop)
const labelCandidates = new Int16Array(MAX_LABELS);
const labelScores = new Float32Array(MAX_LABELS);
const calloutNode = new Int16Array(MAX_LABELS);
const calloutLeft = new Float32Array(MAX_LABELS);
const calloutTop = new Float32Array(MAX_LABELS);
const calloutHeight = new Float32Array(MAX_LABELS);
const calloutSide = new Int8Array(MAX_LABELS);   // +1 block to the right, −1 left
const calloutAlpha = new Float32Array(MAX_LABELS);

/**
 * Edge annotation slots.
 *
 * The old sample re-picked its edges from a hash every single frame, so an
 * annotation existed for as long as its pair happened to satisfy the hash —
 * often a fraction of a second. These are slots instead: one is claimed by a
 * pair, tracks that pair while it stays linked and on screen, holds for a
 * procedurally-derived dwell, then fades out and frees itself. The pair is
 * identified by both endpoints' lifetime IDs, because array indices are reused
 * by respawning nodes and a slot must never silently start describing a
 * different edge.
 */
const edgeSlotIdA = new Int32Array(MAX_EDGE_LABELS);
const edgeSlotIdB = new Int32Array(MAX_EDGE_LABELS);
const edgeSlotHold = new Float32Array(MAX_EDGE_LABELS);
const edgeSlotAlpha = new Float32Array(MAX_EDGE_LABELS);
const edgeSlotSeen = new Uint8Array(MAX_EDGE_LABELS);
const edgeSlotX = new Float32Array(MAX_EDGE_LABELS);
const edgeSlotY = new Float32Array(MAX_EDGE_LABELS);
const edgeSlotAngle = new Float32Array(MAX_EDGE_LABELS);
const edgeSlotLength = new Float32Array(MAX_EDGE_LABELS);
const edgeSlotDistance = new Uint16Array(MAX_EDGE_LABELS);
const edgeSlotDegrees = new Int16Array(MAX_EDGE_LABELS);
const edgeSlotDz = new Uint8Array(MAX_EDGE_LABELS);
const edgeSlotStrength = new Float32Array(MAX_EDGE_LABELS);
const edgeSlotKind = new Uint8Array(MAX_EDGE_LABELS);
const edgeSlotTarget = new Uint8Array(MAX_EDGE_LABELS);   // 0–100
const edgeSlotReach = new Uint8Array(MAX_EDGE_LABELS);    // d/r, 0–100
const edgeSlotEnergy = new Uint8Array(MAX_EDGE_LABELS);   // mean E, 0–100
const edgeSlotDeltaE = new Uint8Array(MAX_EDGE_LABELS);   // |ΔE|, 0–100
const edgeSlotDegrees2 = new Uint8Array(MAX_EDGE_LABELS); // summed endpoint degree

// Quantised once at module load. Edge annotations can then paint changing
// measurements without allocating strings in the render loop — and there are
// four kinds of dimension now, so there are four families of table.
const DISTANCE_TEXT = new Array(2001);
for (let i = 0; i < DISTANCE_TEXT.length; i++) DISTANCE_TEXT[i] = `${i} u`;
const RADIUS_TEXT = new Array(2001);
for (let i = 0; i < RADIUS_TEXT.length; i++) RADIUS_TEXT[i] = `r ${i} u`;
const ANGLE_TEXT = new Array(361);
for (let i = 0; i < ANGLE_TEXT.length; i++) ANGLE_TEXT[i] = `θ ${i - 180}°`;

/** `prefix` + a 0.00–1.00 value, for every hundredth. */
function unitTable(prefix) {
  const out = new Array(101);
  for (let i = 0; i < 101; i++) out[i] = `${prefix}${(i / 100).toFixed(2)}`;
  return out;
}
const DZ_TEXT = unitTable('Δz ');
const STRENGTH_TEXT = unitTable('κ ');
const TARGET_TEXT = unitTable('t ');
const REACH_TEXT = unitTable('d/r ');
const ENERGY_TEXT = unitTable('E ');
const DELTA_E_TEXT = unitTable('ΔE ');
const DEGREE_TEXT = new Array(65);
for (let i = 0; i < DEGREE_TEXT.length; i++) DEGREE_TEXT[i] = `deg ${i}`;

// ----------------------------------------------------------
// The code ticker — the renderer's own source, on the canvas
// ----------------------------------------------------------

/**
 * Real statements from this file, grouped by pipeline stage.
 *
 * These are transcribed from the code immediately below them and are checked by
 * eye against it — if you change `update()` or `drawLinks()`, change these too.
 * `slot` indexes a live value refreshed once a second and printed against the
 * line, so the column is not a decorative snippet: it is the loop that is
 * running, with the numbers it is currently running on.
 *
 * Stages: 0 update, 1 links, 2 nodes, 3 info.
 */
const CODE_STAGE = 0, CODE_INDENT = 1, CODE_TEXT = 2, CODE_SLOT = 3;
const CODE_LINES = [
  [0, 0, 'dt = min((now - last) / 1000, 0.1);', 0],
  [0, 0, 'clock += dt * speed;', 1],
  [0, 0, 'for (const node of nodes) {', 2],
  [0, 1, 'node.vx += (rand() - .5) * J * dt;', 3],
  [0, 1, 'node.vx *= exp(-0.55 * dt);', -1],
  [0, 1, 'node.z = zBase + sin(zPhase) * zAmp;', 4],
  [0, 1, 'node.scale = 1 / (1 + node.z * δ);', 5],
  [0, 1, 'node.E = .30b + .24w + .46a;', 12],
  [0, 1, 'if (node.life >= 1) respawn(node);', 16],
  [0, 0, '}', -1],
  [1, 0, 'grid.rebuild(nodes);', 6],
  [1, 0, 'for (const [a, b] of grid.pairs()) {', 7],
  [1, 1, 'd = hypot(dx, dy, dz * zWorld);', 8],
  [1, 1, 't = pow(1 - d / radius, 0.65);', 9],
  [1, 1, 's += (t - s) * (1 - exp(-λ * dt));', 10],
  [1, 1, 'a.deg++; b.deg++; a.κ += s;', 17],
  [1, 1, 'batch.stroke(a, b, shade(s));', 11],
  [1, 0, '}', -1],
  [2, 0, 'shade = pow(node.energy, 1.35);', 18],
  [2, 0, 'ctx.arc(sx, sy, radius, 0, TAU);', 13],
  [3, 0, 'info.clearRect(0, 0, w, h);', 14],
  [3, 0, 'mode = (base + node.slot) % 8;', 20],
  [3, 0, 'label.α += (target - label.α) * k;', 15],
  [3, 0, 'dimension(a, b, kind(idA + idB·φ));', 19],
];
const CODE_VALUE_COUNT = 22;
const CODE_SUMMARY_SLOT = 21;
const codeValueText = new Array(CODE_VALUE_COUNT).fill('');
/** Lines per stage, so the cursor can spread a stage's real cost across them. */
const CODE_STAGE_LINES = new Int32Array(4);
for (const line of CODE_LINES) CODE_STAGE_LINES[line[CODE_STAGE]]++;
/**
 * First and last line index of each stage's contiguous run, so the gutter can
 * draw one rail per stage rather than one mark per line.
 */
const CODE_STAGE_FIRST = Int32Array.from([-1, -1, -1, -1]);
const CODE_STAGE_LAST = new Int32Array(4);
for (let i = 0; i < CODE_LINES.length; i++) {
  const stage = CODE_LINES[i][CODE_STAGE];
  if (CODE_STAGE_FIRST[stage] < 0) CODE_STAGE_FIRST[stage] = i;
  CODE_STAGE_LAST[stage] = i;
}
const CODE_LINE_H = 13;
const CODE_BLOCK_W = 356;
const CODE_GUTTER = 22;
const CODE_MIN_VIEWPORT = 1000;
const CODE_HEAD_H = 20;
const CODE_FOOT_H = 20;
/**
 * Seconds for the program counter to complete one sweep of the listing.
 *
 * Deliberately slow. The counter used to paint a full-width purple bar behind
 * one line and jump it every 70 ms, which on a screen you are falling asleep to
 * is a strobe with a monospace font on it. It is now a heat value per line that
 * rises as the counter passes and decays exponentially, so what you see is a
 * soft comet moving down the listing rather than a row flashing on and off.
 */
const CODE_SWEEP_S = 2.8;
/** Per-second decay of a line's heat. Sets the length of the comet's tail. */
const CODE_HEAT_DECAY = 3.2;
/** Below this a line is at rest and skips its highlight work entirely. */
const CODE_HEAT_EPSILON = 0.02;
const codeLineHeat = new Float32Array(CODE_LINES.length);
/** Descending opacity for the footer's four stacked stage segments. */
const CODE_STAGE_ALPHA = Float32Array.from([0.75, 0.55, 0.4, 0.28]);
const stageShareScratch = new Float32Array(4);
let codeCursor = 0;
let codeValueNextUpdate = 0;
let codeActiveLine = 0;
/** Where the listing landed this frame, so callouts can stay off it. */
let codeVisible = false;
let codeLeft = 0;
let codeTop = 0;
let codeHeight = 0;

// ----------------------------------------------------------
// Live statistics for the info layer's HUD
// ----------------------------------------------------------

/** Smoothing rate (per second) for the displayed frame rate. */
const FPS_SMOOTH = 3;
let measuredFps = 0;
let measuredFrameMs = 0;
/** Shared between update() and the callout pass; see the note in update(). */
let labelAttackCoefficient = 0;
let stageUpdateMs = 0;
let stageLinksMs = 0;
let stageNodesMs = 0;
let stageInfoMs = 0;
let lastEdgeCount = 0;
let lastLabelCount = 0;
let lastEdgeLabelCount = 0;
let lastPairTests = 0;
let lastBatches = 0;
let lastGridCells = 0;
let lastDt = 0;
let lastJitter = 0;
/** Nodes that actually reached the glow pass, against its hard cap. */
let lastGlowNodes = 0;
/** Highest degree any single node reached, and how many modes are on screen. */
let lastMaxDegree = 0;
let lastModesOnScreen = 0;
/** Edge-dimension slots currently holding a pair. */
let lastEdgeSlotsUsed = 0;
/**
 * Lifetime count of *visible* callout blocks that changed side.
 *
 * The left/right bounce was the info layer's worst habit and the hardest thing
 * to argue about from a screenshot, because it only exists in motion. Counting
 * it makes it a number a test can watch instead of a claim in a changelog.
 * Only blocks already faded in are counted: a side chosen at zero opacity is
 * not something anybody saw move.
 */
let calloutSideFlips = 0;
/** Lifetime respawn count, for the observed turnover rate in the readout. */
let respawnCount = 0;

/** The node the Math view is currently evaluating its equations against. */
let probeId = 0;
let probeZ = 0;
let probeScale = 0;
let probeEnergy = 0;
let probeBreath = 0;
let probeWave = 0;
let probeAudio = 0;
/** The link the Math view is currently evaluating its equations against. */
let sampleDistance = 0;
let sampleTarget = 0;
let sampleStrength = 0;

/**
 * Reused snapshot object. `getStillFieldStats()` is polled a few times a second
 * by the HUD, and handing back a fresh object each time would allocate for no
 * reason — the same argument as the pre-quantised palettes.
 */
const statsSnapshot = {
  fps: 0, fpsCap: 30, frameMs: 0, dt: 0,
  msUpdate: 0, msLinks: 0, msNodes: 0, msInfo: 0, stage: 'update',
  nodes: 0, edges: 0, pairTests: 0, bruteTests: 0, gridCells: 0, batches: 0,
  turnover: 0, meanLifeS: 0,
  meanDegree: 0, maxDegree: 0, density: 0,
  labels: 0, edgeLabels: 0, labelCapacity: 0, edgeSlots: 0,
  labelMode: LABEL_MODE_NAMES[0], modeRemaining: 0, dwell: 0,
  modeCount: LABEL_MODE_COUNT, modesOnScreen: 0, calloutFlips: 0,
  glowNodes: 0, glowCap: MAX_GLOW_NODES,
  energy: 0, wavePhase: 0,
  waveAngle: Math.atan2(WAVE_KY, WAVE_KX) * RAD_TO_DEG,
  waveLength: 0,
  speed: 0, intensity: 0, reducedMotion: false,
  densityScale: 1, reach: 1, trail: 8.2, depth: 0.75,
  codeOverlay: true, calloutsOn: true, edgesOn: true, codeFolded: false,
  linkRadius: 0, zWorld: 0, worldW: 0, worldH: 0, minScale: 0,
  gridCell: 0, occupancy: 0, viewportW: 0, viewportH: 0, dpr: 1,
  linkBytes: 0, clock: 0, realClock: 0, keepOuts: 0,
  probeId: 0, probeZ: 0, probeScale: 0, probeEnergy: 0,
  probeBreath: 0, probeWave: 0, probeAudio: 0,
  sampleDistance: 0, sampleTarget: 0, sampleStrength: 0, attackK: 0,
};

// ----------------------------------------------------------
// Subscriptions (mirrors the pattern in audio.js)
// ----------------------------------------------------------
const listeners = new Set();

/**
 * @returns {{enabled: boolean, intensity: number, speed: number, nerd: boolean,
 *   texture: boolean, nerdView: string, nerdFolded: boolean, density: number,
 *   reach: number, trail: number, depth: number, dwell: number, fps: number,
 *   code: boolean, codeFolded: boolean, callouts: boolean, edges: boolean}}
 */
export function getState() {
  return {
    enabled: stillFieldEnabled,
    intensity: stillFieldIntensity,
    speed: stillFieldSpeed,
    nerd: stillFieldNerd,
    texture: stillFieldTexture,
    nerdView,
    nerdFolded,
    density: stillFieldDensity,
    reach: stillFieldReach,
    trail: stillFieldTrail,
    depth,
    dwell: stillFieldDwell,
    fps: stillFieldFps,
    code: stillFieldCode,
    codeFolded,
    callouts: stillFieldCallouts,
    edges: stillFieldEdges,
  };
}

/**
 * Subscribe to Still Field setting changes. Fires immediately with current state.
 * @param {(state: ReturnType<typeof getState>) => void} fn
 * @returns {() => void} unsubscribe
 */
export function subscribe(fn) {
  listeners.add(fn);
  fn(getState());
  return () => listeners.delete(fn);
}

function emit() {
  const snapshot = getState();
  listeners.forEach(fn => fn(snapshot));
}

export function getStillFieldEnabled() {
  return stillFieldEnabled;
}

export function getStillFieldIntensity() {
  return stillFieldIntensity;
}

export function getStillFieldSpeed() {
  return stillFieldSpeed;
}

export function getStillFieldNerd() {
  return stillFieldNerd;
}

export function getStillFieldTexture() {
  return stillFieldTexture;
}

export function getStillFieldCode() {
  return stillFieldCode;
}

/** Are node callouts being painted on the canvas? */
export function getStillFieldCallouts() {
  return stillFieldCallouts;
}

/** Are edge dimensions being painted on the canvas? */
export function getStillFieldEdges() {
  return stillFieldEdges;
}

export function getNerdFolded() {
  return nerdFolded;
}

/** Mean seconds a callout mode holds before the field rotates it. */
export function getStillFieldDwell() {
  return stillFieldDwell;
}

/** Cap in frames per second the render loop is currently honouring. */
export function getStillFieldFps() {
  return stillFieldFps;
}

/** Current label cap for this viewport width. */
function labelCapacity() {
  if (stillFieldW >= LABEL_WIDE_VIEWPORT) return LABEL_CAP_WIDE;
  if (stillFieldW >= LABEL_MEDIUM_VIEWPORT) return LABEL_CAP_MEDIUM;
  return LABEL_CAP_PHONE;
}

/**
 * Which detail mode is showing, and how long it has left.
 *
 * The schedule is quasi-periodic (see MODE_WEIGHTS), so it cannot be a modulo —
 * it walks the five weighted slices of one cycle. Five iterations, no
 * allocation, and the remaining time falls out of the same walk.
 *
 * @param {number} t seconds on the diagnostics clock
 * @returns {number} mode index; `modeRemainingS` carries the countdown
 */
let modeRemainingS = 0;
function modeAt(t) {
  const cycle = stillFieldDwell * modeWeightSum;
  let u = t % cycle;
  for (let k = 0; k < LABEL_MODE_COUNT; k++) {
    const slice = stillFieldDwell * MODE_WEIGHTS[k];
    if (u < slice) {
      modeRemainingS = slice - u;
      return k;
    }
    u -= slice;
  }
  modeRemainingS = 0;
  return LABEL_MODE_COUNT - 1;
}

/**
 * Live field statistics for the info layer's readout.
 *
 * Returns a shared object that is overwritten on each call — read what you need
 * immediately rather than holding on to it.
 *
 * @returns {typeof statsSnapshot}
 */
export function getStillFieldStats() {
  const n = stillFieldNodes.length;
  statsSnapshot.fps = measuredFps;
  statsSnapshot.fpsCap = stillFieldFps;
  statsSnapshot.frameMs = measuredFrameMs;
  statsSnapshot.dt = lastDt;
  statsSnapshot.msUpdate = stageUpdateMs;
  statsSnapshot.msLinks = stageLinksMs;
  statsSnapshot.msNodes = stageNodesMs;
  statsSnapshot.msInfo = stageInfoMs;
  statsSnapshot.stage = dominantStageName();
  statsSnapshot.nodes = n;
  statsSnapshot.edges = lastEdgeCount;
  statsSnapshot.pairTests = lastPairTests;
  statsSnapshot.bruteTests = n * (n - 1) / 2;
  statsSnapshot.gridCells = lastGridCells;
  statsSnapshot.batches = lastBatches;
  // Observed, not assumed: births per minute counted from real respawns, which
  // is the lifecycle rate the speed multiplier actually produced.
  statsSnapshot.turnover = infoClockS > 1 ? respawnCount / infoClockS * 60 : 0;
  statsSnapshot.meanLifeS = statsSnapshot.turnover > 0 ? n / statsSnapshot.turnover * 60 : 0;
  statsSnapshot.meanDegree = n ? lastEdgeCount * 2 / n : 0;
  statsSnapshot.maxDegree = lastMaxDegree;
  statsSnapshot.density = statsSnapshot.bruteTests ? lastEdgeCount / statsSnapshot.bruteTests : 0;
  statsSnapshot.labels = lastLabelCount;
  statsSnapshot.edgeLabels = lastEdgeLabelCount;
  statsSnapshot.labelCapacity = labelCapacity();
  statsSnapshot.edgeSlots = lastEdgeSlotsUsed;
  statsSnapshot.labelMode = LABEL_MODE_NAMES[modeAt(infoClockS)];
  statsSnapshot.modeRemaining = modeRemainingS;
  statsSnapshot.modesOnScreen = lastModesOnScreen;
  statsSnapshot.calloutFlips = calloutSideFlips;
  statsSnapshot.glowNodes = lastGlowNodes;
  statsSnapshot.dwell = stillFieldDwell;
  statsSnapshot.energy = stillEnergy;
  statsSnapshot.wavePhase = ((clockS * WAVE_RATE) % TAU) * RAD_TO_DEG;
  statsSnapshot.waveLength = TAU / Math.hypot(WAVE_KX, WAVE_KY);
  statsSnapshot.speed = stillFieldSpeed;
  statsSnapshot.intensity = stillFieldIntensity;
  statsSnapshot.reducedMotion = reducedMotion;
  statsSnapshot.densityScale = stillFieldDensity;
  statsSnapshot.reach = stillFieldReach;
  statsSnapshot.trail = stillFieldTrail;
  statsSnapshot.depth = depth;
  statsSnapshot.codeOverlay = stillFieldCode;
  statsSnapshot.calloutsOn = stillFieldCallouts;
  statsSnapshot.edgesOn = stillFieldEdges;
  statsSnapshot.codeFolded = codeFolded;
  statsSnapshot.linkRadius = linkRadius;
  statsSnapshot.zWorld = zWorld;
  statsSnapshot.worldW = worldW;
  statsSnapshot.worldH = worldH;
  statsSnapshot.minScale = minScale;
  statsSnapshot.gridCell = gridCell;
  statsSnapshot.occupancy = lastGridCells ? n / lastGridCells : 0;
  statsSnapshot.viewportW = stillFieldW;
  statsSnapshot.viewportH = stillFieldH;
  statsSnapshot.dpr = stillFieldDpr;
  statsSnapshot.linkBytes = linkState.byteLength;
  statsSnapshot.clock = clockS;
  statsSnapshot.realClock = infoClockS;
  statsSnapshot.keepOuts = labelKeepOuts.length;
  statsSnapshot.probeId = probeId;
  statsSnapshot.probeZ = probeZ;
  statsSnapshot.probeScale = probeScale;
  statsSnapshot.probeEnergy = probeEnergy;
  statsSnapshot.probeBreath = probeBreath;
  statsSnapshot.probeWave = probeWave;
  statsSnapshot.probeAudio = probeAudio;
  statsSnapshot.sampleDistance = sampleDistance;
  statsSnapshot.sampleTarget = sampleTarget;
  statsSnapshot.sampleStrength = sampleStrength;
  statsSnapshot.attackK = 1 - Math.exp(-LINK_ATTACK * (lastDt || 1 / stillFieldFps));
  return statsSnapshot;
}

function dominantStageName() {
  let best = stageUpdateMs;
  let name = 'update';
  if (stageLinksMs > best) { best = stageLinksMs; name = 'links'; }
  if (stageNodesMs > best) { best = stageNodesMs; name = 'nodes'; }
  if (stageInfoMs > best) name = 'info';
  return name;
}

/**
 * Declare the screen rectangles that info labels must avoid, in CSS px. Pass an
 * empty array (or nothing) to clear them. Called by app.js — this module never
 * measures the document itself (see the note on `labelKeepOuts`).
 *
 * Copied into plain objects rather than retained: the caller hands over live
 * `DOMRect`s, which keep their element alive and go stale the moment anything
 * reflows.
 *
 * @param {Array<{left: number, top: number, right: number, bottom: number}>} [rects]
 */
export function setLabelKeepOuts(rects) {
  if (!rects || rects.length === 0) {
    labelKeepOuts = [];
    return;
  }
  labelKeepOuts = rects.map(r => ({
    left: r.left,
    top: r.top,
    right: r.right,
    bottom: r.bottom,
  }));
}

export function getStillEnergy() {
  return stillEnergy;
}

// ----------------------------------------------------------
// Colour handling
// ----------------------------------------------------------

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

  // The token's own alpha is the field's baseline opacity; the ramp itself is
  // opaque and alpha is applied per element via globalAlpha.
  baseNodeAlpha = node.a;
  baseEdgeAlpha = edge.a;

  buildPalette(nodePalette, node, mid, spark);
  buildPalette(edgePalette, edge, mid, spark);

  glowColor = `rgba(${Math.round(glowSource.r)},${Math.round(glowSource.g)},${Math.round(glowSource.b)},0.85)`;

  // Instrumentation ink. These are separate tokens from the field ramp because
  // text has a contrast requirement the field does not: the ramp is allowed to
  // sink into the background, a readout is not.
  const ink = parseColor(read('--still-ink')) || { r: 212, g: 212, b: 220, a: 1 };
  const inkMuted = parseColor(read('--still-ink-muted')) || { r: 140, g: 140, b: 158, a: 1 };
  const accent = parseColor(read('--still-ink-accent')) || mid;
  const plate = parseColor(read('--still-plate')) || { r: 12, g: 12, b: 18, a: 0.72 };
  inkColor = rgbString(ink);
  inkMutedColor = rgbString(inkMuted);
  accentColor = rgbString(accent);
  plateColor = rgbaString(plate, plate.a);
  hairlineColor = rgbaString(accent, 0.34);

  const axisX = parseColor(read('--still-axis-x'));
  const axisY = parseColor(read('--still-axis-y'));
  const axisZ = parseColor(read('--still-axis-z'));
  if (axisX) axisColors[0] = rgbString(axisX);
  if (axisY) axisColors[1] = rgbString(axisY);
  if (axisZ) axisColors[2] = rgbString(axisZ);
}

// ----------------------------------------------------------
// Setup
// ----------------------------------------------------------

/**
 * Call once after the DOM is ready.
 * @param {HTMLCanvasElement} canvas the full-viewport field canvas
 * @param {HTMLCanvasElement} [overlay] the full-viewport info canvas. Text is
 *   drawn here, never on the field canvas — see the header note on why.
 */
export function initStillField(canvas, overlay) {
  stillFieldCanvas = canvas;
  stillFieldCtx = canvas.getContext('2d', { alpha: true });
  if (overlay) {
    infoCanvas = overlay;
    infoCtx = overlay.getContext('2d', { alpha: true });
    hasRoundRect = typeof infoCtx.roundRect === 'function';
  }
  refreshThemeColors();
  resizeStillField();
  initStillFieldNodes();
  applyCanvasVisibility();

  document.addEventListener('visibilitychange', handleVisibilityChange);
  if (reducedMotionQuery && reducedMotionQuery.addEventListener) {
    reducedMotionQuery.addEventListener('change', e => { reducedMotion = e.matches; });
  }

  if (stillFieldEnabled) startStillFieldLoop();
}

function applyCanvasVisibility() {
  if (stillFieldCanvas) stillFieldCanvas.classList.toggle('still-field-off', !stillFieldEnabled);
  if (infoCanvas) infoCanvas.classList.toggle('still-field-off', !stillFieldEnabled);
}

/**
 * Recompute the world plane and everything derived from it.
 *
 * The world is larger than the viewport by exactly the far plane's shrink
 * factor, so that a node sitting at maximum depth still projects to the screen
 * edge instead of leaving a bare border.
 */
function measureWorld() {
  worldW = stillFieldW / minScale;
  worldH = stillFieldH / minScale;

  // Derive the link radius from the mean spacing between nodes rather than
  // fixing it in pixels: the expected number of neighbours inside radius r is
  // π·(r/spacing)² − 1, so tying r to spacing keeps a phone and a desktop at the
  // same ≈3 connections per node instead of a dense mesh on one and dust on the
  // other. The Field Lab's reach multiplier rides on top of that invariant, so
  // raising the node count does not thicken the mesh on its own.
  const count = Math.max(1, stillFieldNodes.length || targetNodeCount());
  const spacing = Math.sqrt((worldW * worldH) / count);
  linkRadius = spacing * (0.8 + stillFieldIntensity * 0.5) * stillFieldReach;
  zWorld = spacing * 1.1;

  allocateGrid();
}

function targetNodeCount() {
  const area = (stillFieldW * stillFieldH) / (minScale * minScale);
  // The viewport-derived count is clamped to the original 26–44 window *first*,
  // and the density multiplier applies to that. Applying density to the raw
  // area figure instead would have made a 1440×900 display open on 132 nodes at
  // the default setting — a different-looking field for everybody who never
  // touches the Lab. Density is an opt-in, not a silent redesign.
  const base = Math.min(BASE_MAX_NODES, Math.max(BASE_MIN_NODES, Math.floor(area / AREA_PER_NODE)));
  return Math.min(MAX_NODES, Math.max(MIN_NODES, Math.round(base * stillFieldDensity)));
}

function resizeStillField() {
  if (!stillFieldCanvas) return;
  const prevW = worldW;
  const prevH = worldH;

  stillFieldDpr = Math.min(window.devicePixelRatio || 1, 2);
  stillFieldW = window.innerWidth;
  stillFieldH = window.innerHeight;
  sizeCanvas(stillFieldCanvas, stillFieldCtx);
  sizeCanvas(infoCanvas, infoCtx);

  measureWorld();

  if (stillFieldNodes.length === 0) {
    initStillFieldNodes();
  } else if (prevW > 0 && prevH > 0) {
    // Rescale rather than re-seed: on phones the address bar shows and hides
    // constantly, and re-seeding would teleport every node mid-session.
    const sx = worldW / prevW;
    const sy = worldH / prevH;
    for (const n of stillFieldNodes) {
      n.x *= sx;
      n.y *= sy;
    }
  }

  // A viewport change can move the node target (the world plane is derived from
  // it), so honour the new count rather than waiting for a settings change.
  applyNodeCount();
}

function sizeCanvas(canvas, ctx) {
  if (!canvas || !ctx) return;
  canvas.width = Math.floor(stillFieldW * stillFieldDpr);
  canvas.height = Math.floor(stillFieldH * stillFieldDpr);
  canvas.style.width = stillFieldW + 'px';
  canvas.style.height = stillFieldH + 'px';
  ctx.setTransform(stillFieldDpr, 0, 0, stillFieldDpr, 0, 0);
}

/**
 * Place a node at the next point of the R2 sequence and reset its life.
 * @param {object} n
 * @param {boolean} [seeded=false] true while seeding the initial field, where
 *   lives are staggered so the first generation does not all expire together
 */
function respawnNode(n, seeded = false) {
  const i = spawnIndex++;
  n.id = ++nodeSerial;
  if (!seeded) respawnCount++;

  // World coordinates are centred on the origin; the camera sits on the axis.
  n.seed = i;
  n.u = (0.5 + R2_A1 * i) % 1;
  n.v = (0.5 + R2_A2 * i) % 1;
  n.x = (n.u - 0.5) * worldW;
  n.y = (n.v - 0.5) * worldH;

  // Which detail mode this node is offset to. Derived from the lifetime ID
  // through the golden ratio, so consecutive IDs land far apart and the eight
  // callouts on a wide screen are reliably reading eight different quantities.
  n.modeOffset = Math.min(
    LABEL_MODE_COUNT - 1,
    ((n.id * PHI) % 1) * LABEL_MODE_COUNT | 0,
  );

  // Depth is the *centre* of this node's excursion, kept off both planes so it
  // always has room to move toward and away from the viewer.
  n.zBase = 0.16 + ((0.5 + R2_A3 * i) % 1) * 0.68;
  n.zAmp = 0.06 + ((i * PHI) % 1) * 0.1;
  n.zRate = 0.05 + ((i * R2_A2) % 1) * 0.07;   // rad/s — a full breath is 50–120 s
  n.zPhase = ((i * R2_A1) % 1) * TAU;
  n.z = n.zBase;

  n.vx = (Math.random() - 0.5) * 6;            // world units/s
  n.vy = (Math.random() - 0.5) * 6;

  n.phase = ((i * PHI) % 1) * TAU;
  n.phaseRate = 0.22 + ((i * R2_A1 * PHI) % 1) * 0.3;

  n.life = seeded ? Math.random() : 0;
  n.lifeRate = 1 / (LIFE_MIN_S + Math.random() * (LIFE_MAX_S - LIFE_MIN_S));
  n.energy = 0;
  n.degree = 0;
  n.coupling = 0;
  n.nearest = 0;
  resetNodeCallout(n);
}

function resetNodeCallout(n) {
  n.labelMode = -1;
  n.labelNextUpdate = 0;
  n.labelAlpha = 0;
  n.labelHeld = false;
  n.labelHoldUntil = 0;
  n.calloutHead = '';
  n.calloutRows = 0;
  n.calloutAxis = false;
  n.calloutGauge = -1;
  n.calloutHandle = HANDLE_SQUARE;
  // A respawned node is a new node, and it respawns somewhere else entirely, so
  // the side its predecessor settled on says nothing useful about this one.
  n.preferSide = 1;
}

/** Forget every link touching node `index` — a respawned node is a new node. */
function clearLinksFor(index) {
  const n = stillFieldNodes.length;
  const base = index * n;
  for (let j = 0; j < n; j++) {
    if (j === index) continue;
    linkState[base + j] = 0;
    linkState[j * n + index] = 0;
  }
}

function makeNode() {
  return {
    id: 0, seed: 0, u: 0, v: 0, modeOffset: 0,
    x: 0, y: 0, z: 0, zBase: 0, zAmp: 0, zRate: 0, zPhase: 0,
    vx: 0, vy: 0, phase: 0, phaseRate: 0,
    life: 0, lifeRate: 0, energy: 0,
    // Graph telemetry, gathered inside the existing link pass — never by a
    // second scan. Reset at the top of update(), accumulated in drawLinks().
    degree: 0, coupling: 0, nearest: 0,
    // Callout state. Rows are key/value pairs so the block can right-align its
    // numbers the way a transform panel does, rather than printing one string.
    labelMode: -1, labelNextUpdate: 0, labelAlpha: 0,
    labelHeld: false, labelHoldUntil: 0,
    calloutHead: '', calloutRows: 0, calloutAxis: false, calloutGauge: -1,
    calloutHandle: HANDLE_SQUARE,
    // Which side of the node this one's block prefers to sit on, +1 right and
    // −1 left. Remembered across frames so placement is hysteretic — see
    // drawCallouts().
    preferSide: 1,
    rowKey0: '', rowKey1: '', rowKey2: '', rowKey3: '',
    rowVal0: '', rowVal1: '', rowVal2: '', rowVal3: '',
    // Scratch fields, written during update and read during draw. Keeping
    // them on the node is what lets the draw pass allocate nothing.
    sx: 0, sy: 0, scale: 0, fade: 0,
  };
}

/**
 * (Re)seed nodes. `force = true` discards existing positions.
 * @param {boolean} [force=false]
 */
export function initStillFieldNodes(force = false) {
  if (stillFieldNodes.length && !force) return;

  const count = targetNodeCount();
  stillFieldNodes = new Array(count);
  spawnIndex = 0;

  for (let i = 0; i < count; i++) {
    const n = makeNode();
    respawnNode(n, true);
    stillFieldNodes[i] = n;
  }

  linkState = new Float32Array(count * count);
  resetEdgeSlots();
  measureWorld();
}

/**
 * Grow or shrink the population toward the current target without re-seeding.
 *
 * Density is a live control, so this has to keep the nodes that are already on
 * screen exactly where they are — a slider that teleports the whole field on
 * every step is unusable. Link state is dropped rather than remapped: the index
 * space changes shape, and a brief re-attack of the envelopes is both correct
 * and invisible next to the alternative of carrying stale strengths into the
 * wrong pairs.
 */
function applyNodeCount() {
  const target = targetNodeCount();
  const current = stillFieldNodes.length;
  if (target === current || current === 0) return;

  if (target > current) {
    for (let i = current; i < target; i++) {
      const n = makeNode();
      respawnNode(n);
      stillFieldNodes.push(n);
    }
  } else {
    stillFieldNodes.length = target;
  }

  linkState = new Float32Array(target * target);
  resetEdgeSlots();
  measureWorld();
}

function resetEdgeSlots() {
  for (let s = 0; s < MAX_EDGE_LABELS; s++) {
    edgeSlotIdA[s] = 0;
    edgeSlotIdB[s] = 0;
    edgeSlotAlpha[s] = 0;
    edgeSlotHold[s] = 0;
    edgeSlotSeen[s] = 0;
  }
  lastEdgeSlotsUsed = 0;
}

// ----------------------------------------------------------
// Uniform spatial grid
//
// A node can only link to a node within `linkRadius`, so the cells are exactly
// one radius across and each node need only look at its own cell and the four
// neighbours that have not already looked at it. That reduces the pair count
// from n(n−1)/2 to roughly n·(density of a 5-cell neighbourhood), which is what
// makes a user-raisable node population affordable.
//
// Everything here is a pre-sized typed array, rebuilt with a counting sort each
// frame: no maps, no arrays of arrays, no allocation.
// ----------------------------------------------------------

/** Cell offsets covering the half-neighbourhood: self, E, SW, S, SE. */
const NEIGHBOUR_DX = Int8Array.from([0, 1, -1, 0, 1]);
const NEIGHBOUR_DY = Int8Array.from([0, 0, 1, 1, 1]);
/** Ceiling on cell count, so a small reach on a huge world cannot run away. */
const MAX_GRID_CELLS = 8192;
/** World margin nodes are allowed to wander into before wrapping. */
const WORLD_MARGIN = 40;

let gridCols = 1;
let gridRows = 1;
let gridCell = 1;
let gridCounts = new Int32Array(0);
let gridStart = new Int32Array(0);
let gridCursor = new Int32Array(0);
let gridItems = new Int16Array(0);
let gridCellOf = new Int16Array(0);

function allocateGrid() {
  const spanX = worldW + WORLD_MARGIN * 2;
  const spanY = worldH + WORLD_MARGIN * 2;
  let cell = Math.max(1, linkRadius);
  gridCols = Math.max(1, Math.ceil(spanX / cell));
  gridRows = Math.max(1, Math.ceil(spanY / cell));

  // A very small reach on a very large world would ask for millions of cells,
  // which costs more to clear than the pair tests it saves. Coarsen instead;
  // the neighbourhood stays conservative either way.
  while (gridCols * gridRows > MAX_GRID_CELLS) {
    cell *= 1.5;
    gridCols = Math.max(1, Math.ceil(spanX / cell));
    gridRows = Math.max(1, Math.ceil(spanY / cell));
  }
  gridCell = cell;

  const cells = gridCols * gridRows;
  if (gridCounts.length !== cells) {
    gridCounts = new Int32Array(cells);
    gridStart = new Int32Array(cells);
    gridCursor = new Int32Array(cells);
  }
  const n = stillFieldNodes.length;
  if (gridItems.length !== n) {
    gridItems = new Int16Array(n);
    gridCellOf = new Int16Array(n);
  }
  lastGridCells = cells;
}

/** Counting-sort every node into its cell. O(n + cells), allocation-free. */
function buildGrid(nodes, n) {
  const cells = gridCols * gridRows;
  gridCounts.fill(0);

  const originX = worldW / 2 + WORLD_MARGIN;
  const originY = worldH / 2 + WORLD_MARGIN;

  for (let i = 0; i < n; i++) {
    const node = nodes[i];
    let cx = ((node.x + originX) / gridCell) | 0;
    let cy = ((node.y + originY) / gridCell) | 0;
    if (cx < 0) cx = 0; else if (cx >= gridCols) cx = gridCols - 1;
    if (cy < 0) cy = 0; else if (cy >= gridRows) cy = gridRows - 1;
    const c = cy * gridCols + cx;
    gridCellOf[i] = c;
    gridCounts[c]++;
  }

  let running = 0;
  for (let c = 0; c < cells; c++) {
    gridStart[c] = running;
    gridCursor[c] = running;
    running += gridCounts[c];
  }
  for (let i = 0; i < n; i++) {
    gridItems[gridCursor[gridCellOf[i]]++] = i;
  }
}

// ----------------------------------------------------------
// Audio-reactive metrics
// ----------------------------------------------------------

// Reused across frames so the render loop allocates nothing.
let metricsBuffer = null;
const metrics = { low: 0, mid: 0, high: 0, overall: 0 };

/**
 * Frequency-band energy from the audio engine's analyser.
 *
 * Returns a live object that is rewritten in place each call — copy the fields
 * you need rather than holding the reference across frames.
 *
 * @returns {{low: number, mid: number, high: number, overall: number}} all 0–1
 */
export function getStillAudioMetrics() {
  const analyser = getAnalyser();
  if (!analyser || !getIsPlaying()) {
    metrics.low = metrics.mid = metrics.high = metrics.overall = 0;
    return metrics;
  }
  const bins = analyser.frequencyBinCount;
  if (!metricsBuffer || metricsBuffer.length !== bins) {
    metricsBuffer = new Uint8Array(bins);
  }
  analyser.getByteFrequencyData(metricsBuffer);

  let lowSum = 0, midSum = 0, highSum = 0, total = 0;
  const lowEnd = Math.floor(bins * 0.12);
  const midEnd = Math.floor(bins * 0.45);
  for (let i = 0; i < bins; i++) {
    const v = metricsBuffer[i] / 255;
    total += v;
    if (i < lowEnd) lowSum += v;
    else if (i < midEnd) midSum += v;
    else highSum += v;
  }
  metrics.low = lowSum / Math.max(1, lowEnd);
  metrics.mid = midSum / Math.max(1, midEnd - lowEnd);
  metrics.high = highSum / Math.max(1, bins - midEnd);
  metrics.overall = total / bins;
  return metrics;
}

/** Write --still-energy only when it has moved perceptibly. */
function publishEnergy(value) {
  if (Math.abs(value - lastPublishedEnergy) < ENERGY_EPSILON) return;
  lastPublishedEnergy = value;
  document.documentElement.style.setProperty('--still-energy', value.toFixed(4));
}

/**
 * Per-node energy, 0–1. Three layers that never line up with each other:
 *
 * 1. a personal breath — each node's own slow sinusoid;
 * 2. a plane wave travelling across the field at an irrational angle, so the
 *    crest never settles into the lattice and never visibly repeats;
 * 3. the audio signal, weighted toward the mid and high bands because those are
 *    where brown, pink and white noise actually differ from one another.
 *
 * Silence leaves layers 1 and 2, which is why the field still lives when the
 * app is paused — just more quietly.
 */
function computeNodeEnergy(n, audioBoost) {
  const breath = 0.5 + 0.5 * Math.sin(n.phase);
  const wave = 0.5 + 0.5 * Math.sin(clockS * WAVE_RATE - (n.x * WAVE_KX + n.y * WAVE_KY));
  return clamp(0.3 * breath + 0.24 * wave + 0.46 * audioBoost, 0, 1);
}

/** Local travelling-wave phase at a node, in radians, wrapped to [0, 2π). */
function nodeWavePhase(n) {
  const raw = clockS * WAVE_RATE - (n.x * WAVE_KX + n.y * WAVE_KY);
  return ((raw % TAU) + TAU) % TAU;
}

/** Smooth 0→1 ramp; gentler at both ends than a straight line. */
function smoothstep(t) {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  return u * u * (3 - 2 * u);
}

// ----------------------------------------------------------
// Render loop
// ----------------------------------------------------------

function frame(nowMs) {
  stillFieldRaf = requestAnimationFrame(frame);

  if (!stillFieldEnabled || stillFieldIntensity <= 0.01) {
    stopLoop();
    applyCanvasVisibility();
    stillEnergy = 0;
    publishEnergy(0);
    // Without this the last painted frame would sit frozen on screen, because
    // the residual clear that normally erases it only runs while the loop does.
    stillFieldCtx.clearRect(0, 0, stillFieldW, stillFieldH);
    clearInfoCanvas();
    return;
  }

  // Frame cap. The `-1` absorbs the sub-millisecond jitter that would otherwise
  // make every second frame miss its slot and halve the effective rate.
  const frameInterval = 1000 / stillFieldFps;
  if (nowMs - lastDrawMs < frameInterval - 1) return;

  const dt = Math.min((nowMs - lastFrameMs) / 1000, MAX_STEP_S);
  lastFrameMs = nowMs;
  lastDrawMs = nowMs;
  if (dt <= 0) return;
  lastDt = dt;

  // Measured from real elapsed time, not the speed-scaled clock, so the readout
  // reports the frame rate rather than the drift rate.
  const fpsK = 1 - Math.exp(-FPS_SMOOTH * dt);
  measuredFps += (1 / dt - measuredFps) * fpsK;

  const speed = reducedMotion ? stillFieldSpeed * 0.35 : stillFieldSpeed;
  const adt = dt * speed;   // the animation clock advances at the user's speed
  clockS += adt;
  infoClockS += dt;

  const instrumented = stillFieldNerd;
  const workStart = instrumented ? performance.now() : 0;
  update(adt, dt);
  const afterUpdate = instrumented ? performance.now() : 0;
  draw(adt, dt, instrumented, afterUpdate);

  if (instrumented) {
    const workK = 1 - Math.exp(-FPS_SMOOTH * dt);
    measuredFrameMs += (performance.now() - workStart - measuredFrameMs) * workK;
    stageUpdateMs += (afterUpdate - workStart - stageUpdateMs) * workK;
  }
}

function update(adt, dt) {
  const m = getStillAudioMetrics();
  // Weight overall a little higher so brown/pink still feed the cyan spark
  // ramp; white remains the liveliest, but the gap is smaller.
  const audioBoost = Math.min(1, (0.5 * m.overall + 0.3 * m.mid + 0.2 * m.high) * 1.75);
  probeAudio = audioBoost;

  // Smoothed, intensity-scaled energy for the CSS variable the UI reacts to.
  const targetEnergy = m.overall * stillFieldIntensity * (getIsPlaying() ? 1 : 0.06);
  stillEnergy += (targetEnergy - stillEnergy) * (1 - Math.exp(-ENERGY_SMOOTH * adt));
  publishEnergy(stillEnergy);

  const nodes = stillFieldNodes;
  const n = nodes.length;
  const halfW = worldW / 2;
  const halfH = worldH / 2;
  const cx = stillFieldW / 2;
  const cy = stillFieldH / 2;

  // Damping as a continuous rate rather than a per-frame factor, so the drift
  // settles identically at any frame rate.
  const damp = Math.exp(-0.55 * adt);
  const jitter = 14 * (0.35 + m.overall * 1.1);
  lastJitter = jitter;

  // Callout envelopes run on the real clock, not the drift clock: how long a
  // readout stays legible is a property of the reader, not of the simulation's
  // speed setting.
  const labelAttackK = 1 - Math.exp(-LABEL_ATTACK * dt);
  const labelReleaseK = 1 - Math.exp(-LABEL_RELEASE * dt);
  const holdSeconds = stillFieldDwell * LABEL_MIN_HOLD_FRACTION;

  let bestEnergy = -1;

  // Graph telemetry is only accumulated when something is going to read it, and
  // it is always accumulated inside the link pass. Zeroing it here is the whole
  // cost outside that pass.
  const collectGraph = stillFieldNerd;

  for (let i = 0; i < n; i++) {
    const node = nodes[i];

    if (collectGraph) {
      node.degree = 0;
      node.coupling = 0;
      node.nearest = 0;
    }

    node.life += node.lifeRate * adt;
    if (node.life >= 1) {
      respawnNode(node);
      clearLinksFor(i);
    }

    // Lifecycle envelope: ease in, hold, ease out.
    node.fade = smoothstep(node.life / FADE_IN) * smoothstep((1 - node.life) / FADE_OUT);

    // Gentle random walk, integrated in world units per second.
    node.vx += (Math.random() - 0.5) * jitter * adt;
    node.vy += (Math.random() - 0.5) * jitter * adt;
    node.vx *= damp;
    node.vy *= damp;
    node.x += node.vx * adt;
    node.y += node.vy * adt;

    // Wrap in world space so the lattice stays continuous. A wrap teleports the
    // node to the far side, so its links have to go with it: the grid only
    // visits near pairs now, and a pair that stops being visited would freeze
    // its envelope at whatever strength it happened to hold.
    let wrapped = false;
    if (node.x < -halfW - WORLD_MARGIN) { node.x = halfW + WORLD_MARGIN; wrapped = true; }
    else if (node.x > halfW + WORLD_MARGIN) { node.x = -halfW - WORLD_MARGIN; wrapped = true; }
    if (node.y < -halfH - WORLD_MARGIN) { node.y = halfH + WORLD_MARGIN; wrapped = true; }
    else if (node.y > halfH + WORLD_MARGIN) { node.y = -halfH - WORLD_MARGIN; wrapped = true; }
    if (wrapped) clearLinksFor(i);

    // Depth is a bounded sinusoid rather than an integrated velocity: nodes
    // drift toward the viewer and back without any chance of escaping the
    // volume over an eight-hour night.
    node.zPhase += node.zRate * adt;
    node.z = clamp(node.zBase + Math.sin(node.zPhase) * node.zAmp, 0, 1);

    node.phase += node.phaseRate * adt;
    node.energy = computeNodeEnergy(node, audioBoost);

    // Project once, here, and reuse in the edge, node and callout passes.
    node.scale = 1 / (1 + node.z * depth);
    node.sx = cx + node.x * node.scale;
    node.sy = cy + node.y * node.scale;

    // Callout hold and opacity. Acquisition and release use different gates, so
    // a node hovering on the threshold cannot flicker, and a callout that has
    // been acquired is guaranteed a readable dwell before it can be dropped.
    if (stillFieldNerd && stillFieldCallouts) {
      const keepGate = node.labelHeld ? LABEL_ENERGY_GATE - LABEL_ENERGY_RELEASE : LABEL_ENERGY_GATE;
      const qualifies = node.fade > 0 && node.energy > keepGate;
      if (qualifies && !node.labelHeld) {
        node.labelHeld = true;
        node.labelHoldUntil = infoClockS + holdSeconds;
      } else if (!qualifies && node.labelHeld && infoClockS >= node.labelHoldUntil) {
        node.labelHeld = false;
      }
    } else if (node.labelHeld) {
      node.labelHeld = false;
    }
    // `labelAlpha` is driven toward 0 here and lifted back up by the callout
    // pass for the nodes it actually draws, so a node that qualifies but loses
    // the placement contest fades out instead of vanishing.
    node.labelAlpha += (0 - node.labelAlpha) * labelReleaseK;

    if (node.fade > 0 && node.energy > bestEnergy) {
      bestEnergy = node.energy;
      probeId = node.id;
      probeZ = node.z;
      probeScale = node.scale;
      probeEnergy = node.energy;
      probeBreath = 0.5 + 0.5 * Math.sin(node.phase);
      probeWave = 0.5 + 0.5 * Math.sin(nodeWavePhase(node));
    }
  }

  // Stash the attack coefficient the callout pass needs; computing it per node
  // would be the same exponential 150 times.
  labelAttackCoefficient = labelAttackK;

  buildGrid(nodes, n);
}

function draw(adt, dt, instrumented, tAfterUpdate) {
  const ctx = stillFieldCtx;
  const nodes = stillFieldNodes;
  const n = nodes.length;
  const intensity = stillFieldIntensity;

  // Soft residual clear — leaves a calm trail instead of a hard wipe.
  //
  // `destination-out` subtracts alpha rather than painting the page background
  // over the previous frame. Painting it would work, but only if the fill
  // exactly matched `--bg`, and after a few hundred frames the canvas would be
  // fully opaque — burying the background gradient and the Still Texture
  // underneath it. Subtracting alpha keeps the canvas genuinely transparent, so
  // both still show through, and the theme no longer has to hand this function
  // a matching colour.
  //
  // The decay is a rate per second, not a per-frame constant: the frame cap is
  // a user setting now, and a fixed per-frame alpha would quietly halve every
  // trail the moment somebody moved it from 30 to 60.
  ctx.globalCompositeOperation = 'destination-out';
  ctx.globalAlpha = 1;
  ctx.fillStyle = `rgba(0,0,0,${(1 - Math.exp(-stillFieldTrail * dt)).toFixed(4)})`;
  ctx.fillRect(0, 0, stillFieldW, stillFieldH);
  ctx.globalCompositeOperation = 'source-over';

  drawLinks(ctx, nodes, n, intensity, adt);
  const tAfterLinks = instrumented ? performance.now() : 0;

  drawNodes(ctx, nodes, n, intensity);
  const tAfterNodes = instrumented ? performance.now() : 0;

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  if (stillFieldNerd) {
    drawInfoLayer(nodes, n, dt);
    infoCleared = false;
  } else {
    lastLabelCount = 0;
    lastEdgeLabelCount = 0;
    lastEdgeSlotsUsed = 0;
    clearInfoCanvas();
  }

  if (instrumented) {
    const workK = 1 - Math.exp(-FPS_SMOOTH * dt);
    stageLinksMs += (tAfterLinks - tAfterUpdate - stageLinksMs) * workK;
    stageNodesMs += (tAfterNodes - tAfterLinks - stageNodesMs) * workK;
    stageInfoMs += (performance.now() - tAfterNodes - stageInfoMs) * workK;
  }
}

function clearInfoCanvas() {
  if (!infoCtx || infoCleared) return;
  infoCtx.clearRect(0, 0, stillFieldW, stillFieldH);
  infoCleared = true;
}

// ----------------------------------------------------------
// Link pass
// ----------------------------------------------------------

function drawLinks(ctx, nodes, n, intensity, adt) {
  const r2 = linkRadius * linkRadius;
  const invR = 1 / linkRadius;

  // Envelope coefficients depend only on the timestep, so they are computed
  // once per frame rather than once per pair.
  const attackK = 1 - Math.exp(-LINK_ATTACK * adt);
  const releaseK = 1 - Math.exp(-LINK_RELEASE * adt);
  const edgeAlphaScale = baseEdgeAlpha * (0.5 + intensity * 0.9);

  let drawn = 0;
  let tests = 0;
  let batches = 0;
  let batchKey = -1;
  let pathOpen = false;

  const collectEdges = stillFieldNerd;
  if (collectEdges) {
    for (let s = 0; s < MAX_EDGE_LABELS; s++) edgeSlotSeen[s] = 0;
  }
  const trackDimensions = collectEdges && stillFieldEdges;
  const edgeCap = Math.min(MAX_EDGE_LABELS, stillFieldW >= LABEL_MEDIUM_VIEWPORT ? MAX_EDGE_LABELS : 2);
  let sampleTaken = false;
  let maxDegree = 0;

  const cells = gridCols * gridRows;
  for (let c = 0; c < cells; c++) {
    const startA = gridStart[c];
    const endA = startA + gridCounts[c];
    if (startA === endA) continue;
    const cellX = c % gridCols;
    const cellY = (c / gridCols) | 0;

    for (let nb = 0; nb < 5; nb++) {
      const nx = cellX + NEIGHBOUR_DX[nb];
      const ny = cellY + NEIGHBOUR_DY[nb];
      if (nx < 0 || nx >= gridCols || ny < 0 || ny >= gridRows) continue;
      const c2 = ny * gridCols + nx;
      const startB = gridStart[c2];
      const endB = startB + gridCounts[c2];
      if (startB === endB) continue;

      for (let p = startA; p < endA; p++) {
        const i = gridItems[p];
        const a = nodes[i];
        if (a.fade <= 0) continue;

        // Within one cell each unordered pair must be visited once, so the
        // partner scan starts after the current item. Across cells the whole
        // partner cell is fair game, because the neighbour offsets only ever
        // point at cells that have not yet been the source.
        const from = nb === 0 ? p + 1 : startB;
        for (let q = from; q < endB; q++) {
          const j = gridItems[q];
          const b = nodes[j];
          if (b.fade <= 0) continue;

          tests++;

          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dz = (b.z - a.z) * zWorld;
          const distSq = dx * dx + dy * dy + dz * dz; // squared — no sqrt unless linked

          // A linear falloff leaves most links faint, because most pairs sit
          // near the outer edge of the radius where a linear ramp is already
          // close to zero. The 0.65 exponent lifts the mid-range so the lattice
          // reads as structure rather than as a few bright pairs in a haze.
          let target = 0;
          let distance = 0;
          if (distSq < r2) {
            distance = Math.sqrt(distSq);
            target = Math.pow(1 - distance * invR, 0.65);
          }

          const k = i < j ? i * n + j : j * n + i;
          const prev = linkState[k];
          // The arrival transient falls straight out of the envelope: the gap
          // between where a link wants to be and where it is peaks the instant
          // two nodes come into range, and closes as the envelope catches up.
          // That gap *is* the pulse — no extra state, no extra pass.
          const pulse = target > prev ? target - prev : 0;
          const strength = prev + (target - prev) * (target > prev ? attackK : releaseK);
          linkState[k] = strength < LINK_EPSILON ? 0 : strength;

          if (strength < LINK_EPSILON) continue;

          const depthFade = (a.scale + b.scale) * 0.5;
          const alpha = clamp(
            (strength + pulse * LINK_PULSE_GAIN) * a.fade * b.fade * edgeAlphaScale * depthFade,
            0,
            1,
          );
          if (alpha < 0.004) continue;

          // A dying node's links retract into the survivor rather than blinking
          // off — the endpoint slides along the segment as the node fades.
          // Capped short of 1 so the line never collapses to a point before it
          // is gone.
          const ra = (1 - a.fade) * 0.92;
          const rb = (1 - b.fade) * 0.92;
          const ax = a.sx + (b.sx - a.sx) * ra;
          const ay = a.sy + (b.sy - a.sy) * ra;
          const bx = b.sx + (a.sx - b.sx) * rb;
          const by = b.sy + (a.sy - b.sy) * rb;

          const energy = (a.energy + b.energy) * 0.5 + pulse * 0.5;
          // Soft power keeps the field mostly cool-violet but lets mid energy
          // reach cyan more often (the white-noise character we want on brown).
          const shade = clamp(Math.pow(energy, 1.35), 0, 1);
          const colorIndex = Math.min(COLOR_STEPS - 1, (shade * COLOR_STEPS) | 0);

          // Batching. Quantising alpha and width to steps well below the visual
          // threshold means neighbouring edges — which the grid hands us in
          // spatial order, so they share depth and energy — routinely land on
          // the same key and accumulate into one path. No sorting and no
          // per-frame arrays: the run is flushed the moment the key changes.
          const alphaStep = Math.max(1, Math.round(alpha * BATCH_ALPHA_STEPS));
          const widthStep = Math.max(
            1,
            Math.round((0.7 + energy * 0.8) * depthFade * BATCH_WIDTH_STEPS),
          );
          const key2 = (colorIndex * (BATCH_ALPHA_STEPS + 1) + alphaStep) * 64 + Math.min(63, widthStep);
          if (key2 !== batchKey) {
            if (pathOpen) ctx.stroke();
            ctx.globalAlpha = alphaStep / BATCH_ALPHA_STEPS;
            ctx.strokeStyle = edgePalette[colorIndex];
            ctx.lineWidth = widthStep / BATCH_WIDTH_STEPS;
            ctx.beginPath();
            batchKey = key2;
            batches++;
            pathOpen = true;
          }
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          drawn++;

          if (!collectEdges || distance <= 0) continue;

          // Per-node graph telemetry. Four increments and two comparisons on
          // values the renderer has already computed — this is what feeds the
          // `links` callout mode, and it is why that mode does not need its own
          // pass over the graph.
          a.degree++;
          b.degree++;
          a.coupling += strength;
          b.coupling += strength;
          if (a.nearest === 0 || distance < a.nearest) a.nearest = distance;
          if (b.nearest === 0 || distance < b.nearest) b.nearest = distance;
          if (a.degree > maxDegree) maxDegree = a.degree;
          if (b.degree > maxDegree) maxDegree = b.degree;

          // One live pair feeds the Math view's worked example. Taking the
          // first strong edge of the frame keeps it stable enough to read.
          if (!sampleTaken && strength >= EDGE_LABEL_MIN_STRENGTH) {
            sampleDistance = distance;
            sampleTarget = target;
            sampleStrength = strength;
            sampleTaken = true;
          }

          if (trackDimensions) {
            trackEdgeAnnotation(a, b, ax, ay, bx, by, distance, target, strength, edgeCap);
          }
        }
      }
    }
  }

  if (pathOpen) ctx.stroke();

  lastEdgeCount = drawn;
  lastPairTests = tests;
  lastBatches = batches;
  lastMaxDegree = maxDegree;
}

/**
 * Keep the annotation slots pointed at edges that are worth reading.
 *
 * Called from inside the link pass, with values the renderer has already
 * computed — this never opens a second graph scan, sorts links, or builds an
 * edge list. A slot follows one pair (identified by both lifetime IDs, because
 * array indices are recycled) until the pair breaks or its dwell expires.
 */
function trackEdgeAnnotation(a, b, ax, ay, bx, by, distance, target, strength, cap) {
  const idA = a.id < b.id ? a.id : b.id;
  const idB = a.id < b.id ? b.id : a.id;

  let free = -1;
  for (let s = 0; s < cap; s++) {
    if (edgeSlotIdA[s] === idA && edgeSlotIdB[s] === idB) {
      writeEdgeSlot(s, a, b, ax, ay, bx, by, distance, target, strength);
      edgeSlotSeen[s] = 1;
      return;
    }
    if (free < 0 && edgeSlotAlpha[s] <= 0.01 && edgeSlotIdA[s] === 0) free = s;
  }
  if (free < 0 || strength < EDGE_LABEL_MIN_STRENGTH) return;

  // A candidate has to be readable where it lands: long enough to carry the
  // caption, on screen, clear of the interface and the listing, and not on top
  // of an annotation that already exists.
  //
  // The span test used to live only in the draw pass, which meant a short edge
  // could claim a slot, hold it for a full dwell and never draw a thing — every
  // slot held, one dimension on screen. Rejecting it here keeps the slots for
  // pairs that can actually be read.
  const sx = bx - ax;
  const sy = by - ay;
  if (sx * sx + sy * sy < EDGE_LABEL_MIN_SPAN * EDGE_LABEL_MIN_SPAN) return;

  const mx = (ax + bx) * 0.5;
  const my = (ay + by) * 0.5;
  // The caption is rotated onto the line, so its footprint is a rotated box of
  // unknown orientation. Bound it by the disc that contains every rotation —
  // an axis-aligned test using the text's own height would let a near-vertical
  // dimension run straight off the side of the screen.
  if (mx < EDGE_LABEL_HALF_W || mx > stillFieldW - EDGE_LABEL_HALF_W) return;
  if (my < EDGE_LABEL_HALF_W || my > stillFieldH - EDGE_LABEL_HALF_W) return;
  if (hitsKeepOut(mx - EDGE_LABEL_HALF_W, my - EDGE_LABEL_HALF_H,
    mx + EDGE_LABEL_HALF_W, my + EDGE_LABEL_HALF_H)) return;
  if (hitsCodeBlock(mx - EDGE_LABEL_HALF_W, my - EDGE_LABEL_HALF_W,
    mx + EDGE_LABEL_HALF_W, my + EDGE_LABEL_HALF_W)) return;
  for (let s = 0; s < cap; s++) {
    if (edgeSlotAlpha[s] <= 0.01) continue;
    if (Math.abs(mx - edgeSlotX[s]) < EDGE_LABEL_HALF_W * 2
      && Math.abs(my - edgeSlotY[s]) < EDGE_LABEL_HALF_H * 2) return;
  }

  edgeSlotIdA[free] = idA;
  edgeSlotIdB[free] = idB;
  // What this dimension measures is a property of the *pair*, not of the slot,
  // so it survives the pair being re-picked into a different slot and never
  // changes under the reader mid-dwell.
  edgeSlotKind[free] = Math.min(
    EDGE_KIND_COUNT - 1,
    (((idA + idB * PHI) % 1) * EDGE_KIND_COUNT) | 0,
  );
  // Dwell rides the same quasi-periodic schedule as the node modes, offset by
  // the slot index so several annotations never expire on the same frame.
  edgeSlotHold[free] = infoClockS + stillFieldDwell * MODE_WEIGHTS[free % LABEL_MODE_COUNT];
  edgeSlotSeen[free] = 1;
  writeEdgeSlot(free, a, b, ax, ay, bx, by, distance, target, strength);
}

/**
 * Refresh one slot's measurements. Everything here is either already computed by
 * the link pass or a quantisation of it into a table index — no strings are
 * built, because this runs for every tracked pair on every frame.
 */
function writeEdgeSlot(s, a, b, ax, ay, bx, by, distance, target, strength) {
  const dx = bx - ax;
  const dy = by - ay;
  const angle = Math.atan2(dy, dx);
  edgeSlotX[s] = (ax + bx) * 0.5;
  edgeSlotY[s] = (ay + by) * 0.5;
  edgeSlotAngle[s] = angle;
  edgeSlotLength[s] = Math.sqrt(dx * dx + dy * dy);
  edgeSlotDistance[s] = clamp(Math.round(distance), 0, DISTANCE_TEXT.length - 1);
  edgeSlotDegrees[s] = clamp(Math.round(angle * RAD_TO_DEG), -180, 180);
  edgeSlotDz[s] = clamp(Math.round(Math.abs(a.z - b.z) * 100), 0, 100);
  edgeSlotStrength[s] = strength;
  edgeSlotTarget[s] = clamp(Math.round(target * 100), 0, 100);
  edgeSlotReach[s] = clamp(Math.round(distance / Math.max(1, linkRadius) * 100), 0, 100);
  edgeSlotEnergy[s] = clamp(Math.round((a.energy + b.energy) * 50), 0, 100);
  edgeSlotDeltaE[s] = clamp(Math.round(Math.abs(a.energy - b.energy) * 100), 0, 100);
  edgeSlotDegrees2[s] = clamp(a.degree + b.degree, 0, DEGREE_TEXT.length - 1);
}

// ----------------------------------------------------------
// Node pass
// ----------------------------------------------------------

function drawNodes(ctx, nodes, n, intensity) {
  const alphaScale = baseNodeAlpha * (0.55 + intensity * 0.45);
  const radiusScale = 0.85 + intensity * 0.25;
  let glowed = 0;

  ctx.shadowBlur = 0;

  // Two passes: everything flat first, then the few brightest nodes again with
  // a shadow. Setting shadowBlur is a pipeline change on most canvas backends,
  // so doing it 8 times beats doing it 32.
  //
  // Pass 0 records which nodes it deferred, so pass 1 walks a list of at most
  // MAX_GLOW_NODES entries instead of the whole population a second time. At the
  // Lab's top density that is 10 iterations rather than 150.
  for (let pass = 0; pass < 2; pass++) {
    if (pass === 1) {
      if (reducedMotion || glowQueueLength === 0) break;
      ctx.shadowColor = glowColor;
    }

    // Bright nodes are handed to the glow pass — but only the ones that pass
    // will actually reach. It stops at MAX_GLOW_NODES and never runs at all
    // under reduced motion, so deferring every bright node unconditionally
    // deletes the highest-energy nodes from the field outright. Queueing them
    // here is what tells us which ones still have to be drawn flat.
    if (pass === 0) glowQueueLength = 0;
    const count = pass === 0 ? n : glowQueueLength;

    for (let k = 0; k < count; k++) {
      const i = pass === 0 ? k : glowQueue[k];
      const node = nodes[i];
      // `fade` is the lifecycle envelope, and it is the only honest test for
      // "is this node worth drawing". Testing `life` instead cannot work:
      // update() respawns a node the moment its life reaches 1, so by the time
      // draw runs every node is always mid-life, and a birth or a death would
      // pop on and off at full shell opacity instead of easing.
      if (node.fade <= 0) continue;

      if (pass === 0) {
        if (node.energy > GLOW_THRESHOLD && !reducedMotion && glowQueueLength < MAX_GLOW_NODES) {
          glowQueue[glowQueueLength++] = i;
          continue;                            // drawn in the glow pass instead
        }
      } else {
        glowed++;
        ctx.shadowBlur = Math.min(12, 4 + node.energy * 8);
      }

      // Nearness is the depth cue: closer nodes are larger and more opaque.
      const nearness = (node.scale - minScale) / (1 - minScale);
      const radius = (2.1 + node.energy * 1.9) * node.scale * radiusScale;
      const alpha = clamp(
        node.fade * (0.42 + nearness * 0.5) * (0.7 + node.energy * 0.45) * alphaScale,
        0,
        1,
      );

      const shade = clamp(Math.pow(node.energy, 1.35), 0, 1);
      const color = nodePalette[Math.min(COLOR_STEPS - 1, (shade * COLOR_STEPS) | 0)];

      // Stroke-circle shell: a residual outline so a node stays legible when
      // its *energy* is low, which is what would otherwise make the far half of
      // the field disappear into the background. Scaled by `fade` so it still
      // obeys the birth and death envelope — the floor is against dimness, not
      // against the lifecycle.
      const shellAlpha = clamp(0.14 * nearness * alphaScale, 0.05, 0.28) * node.fade;

      // One path, used by both the outline and the fill. Rebuilding the arc for
      // each would double per-node path construction every frame.
      ctx.beginPath();
      ctx.arc(node.sx, node.sy, radius, 0, TAU);

      // The glow pass already carries shadowBlur, the single most expensive
      // thing on this canvas. Bright nodes are well above the shell floor
      // anyway, so stroking them would buy nothing and pay for the blur twice.
      if (pass === 0 && shellAlpha > alpha) {
        ctx.globalAlpha = shellAlpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(0.7, node.scale);
        ctx.stroke();
      }

      if (alpha > 0.004) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.fill();
      }
    }
  }

  ctx.shadowBlur = 0;
  lastGlowNodes = glowed;
}

// ----------------------------------------------------------
// Info layer
//
// Everything below paints on the *info* canvas, which is cleared outright each
// frame. Nothing here may set shadowBlur, and every glyph origin is snapped to
// a whole device pixel: a label that moves with its node is only crisp if its
// baseline lands on the pixel grid.
// ----------------------------------------------------------

/** Snap a CSS-pixel coordinate to the device pixel grid. */
function snap(v) {
  return Math.round(v * stillFieldDpr) / stillFieldDpr;
}

function drawInfoLayer(nodes, n, dt) {
  const ctx = infoCtx;
  if (!ctx) return;

  ctx.clearRect(0, 0, stillFieldW, stillFieldH);
  ctx.shadowBlur = 0;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';

  // The listing claims its corner before anything else is placed, so callouts
  // and dimensions can treat it as one more region to stay out of. It is drawn
  // last so it sits on top of the field's own lines.
  layoutCodeTicker();
  // `drawEdgeAnnotations` is the only thing that recounts held slots, so every
  // path that skips it has to say so. Leaving the last count standing is how
  // the HUD ends up reporting "0 shown · 6 slots held" over a field that is
  // holding nothing at all.
  if (!stillFieldEdges) lastEdgeSlotsUsed = 0;
  lastEdgeLabelCount = stillFieldEdges ? drawEdgeAnnotations(ctx, dt) : 0;
  lastLabelCount = stillFieldCallouts ? drawCallouts(ctx, nodes, n) : 0;
  if (!stillFieldCallouts) lastModesOnScreen = 0;
  if (codeVisible) drawCodeTicker(ctx, dt);

  ctx.globalAlpha = 1;
  ctx.setTransform(stillFieldDpr, 0, 0, stillFieldDpr, 0, 0);
}

/**
 * Edge annotations, drawn as engineering dimensions: the text rides the line it
 * measures, flipped so it is never upside-down, with witness ticks at the ends
 * of the measured span. Reading a length off a diagram works because the number
 * is parallel to the thing it describes; a horizontal caption floating near a
 * diagonal line makes the reader do the association themselves.
 */
function drawEdgeAnnotations(ctx, dt) {
  const attackK = 1 - Math.exp(-EDGE_LABEL_ATTACK * dt);
  const releaseK = 1 - Math.exp(-EDGE_LABEL_RELEASE * dt);
  let shown = 0;
  let held = 0;

  for (let s = 0; s < MAX_EDGE_LABELS; s++) {
    if (edgeSlotIdA[s] !== 0) held++;
    if (edgeSlotIdA[s] === 0 && edgeSlotAlpha[s] <= 0.01) continue;

    const expired = infoClockS >= edgeSlotHold[s];

    // A slot that cannot be drawn where it currently sits is doing no work and
    // is holding a place another pair could use. That is not hypothetical: the listing
    // changes corner when the interface is minimised, and every dimension that
    // was happily in the top right became permanently unpaintable — every slot
    // held, nothing on screen, for as long as the pairs stayed linked. Treating
    // undrawable as dead lets the slot fade out and free itself for a pair that
    // can actually be read.
    //
    // Same disc bound as the screen test: the caption's rotation is unknown
    // here, and the listing is drawn last, so an overlap is not a near miss —
    // it is a caption painted over.
    const span = Math.min(edgeSlotLength[s] * 0.5, EDGE_LABEL_HALF_W);
    const blocked = span < 22
      || hitsCodeBlock(edgeSlotX[s] - EDGE_LABEL_HALF_W, edgeSlotY[s] - EDGE_LABEL_HALF_W,
        edgeSlotX[s] + EDGE_LABEL_HALF_W, edgeSlotY[s] + EDGE_LABEL_HALF_W);

    const alive = edgeSlotSeen[s] === 1 && !expired && !blocked;
    edgeSlotAlpha[s] += ((alive ? 1 : 0) - edgeSlotAlpha[s]) * (alive ? attackK : releaseK);

    if (!alive && edgeSlotAlpha[s] <= 0.02) {
      // Fully faded and no longer tracked: free the slot for a new pair.
      edgeSlotAlpha[s] = 0;
      edgeSlotIdA[s] = 0;
      edgeSlotIdB[s] = 0;
      continue;
    }

    // Still fading is still worth drawing — but not while it is over the
    // listing, which is exactly what made it undrawable in the first place.
    if (blocked) continue;

    const alpha = edgeSlotAlpha[s] * clamp(0.35 + edgeSlotStrength[s] * 0.9, 0, 0.95);
    if (alpha < 0.02) continue;

    let angle = edgeSlotAngle[s];
    if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI;

    ctx.save();
    ctx.translate(snap(edgeSlotX[s]), snap(edgeSlotY[s]));
    ctx.rotate(angle);

    ctx.globalAlpha = alpha * 0.7;
    ctx.strokeStyle = hairlineColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Witness ticks: short perpendicular marks bounding the annotated span,
    // exactly as a dimension line is drawn on a technical drawing.
    ctx.moveTo(-span, -4.5); ctx.lineTo(-span, 4.5);
    ctx.moveTo(span, -4.5); ctx.lineTo(span, 4.5);
    ctx.stroke();

    // What the dimension reads depends on the pair, not the slot. All three
    // strings come out of tables indexed by the quantised measurement, so a
    // dimension that changes every frame still allocates nothing.
    const kind = edgeSlotKind[s];
    let lead, left, right;
    if (kind === EDGE_KIND_SPAN) {
      lead = DISTANCE_TEXT[edgeSlotDistance[s]];
      left = ANGLE_TEXT[edgeSlotDegrees[s] + 180];
      right = DZ_TEXT[edgeSlotDz[s]];
    } else if (kind === EDGE_KIND_COUPLING) {
      lead = STRENGTH_TEXT[clamp(Math.round(edgeSlotStrength[s] * 100), 0, 100)];
      left = TARGET_TEXT[edgeSlotTarget[s]];
      right = DZ_TEXT[edgeSlotDz[s]];
    } else if (kind === EDGE_KIND_REACH) {
      lead = REACH_TEXT[edgeSlotReach[s]];
      left = RADIUS_TEXT[clamp(Math.round(linkRadius), 0, RADIUS_TEXT.length - 1)];
      right = ANGLE_TEXT[edgeSlotDegrees[s] + 180];
    } else {
      lead = ENERGY_TEXT[edgeSlotEnergy[s]];
      left = DELTA_E_TEXT[edgeSlotDeltaE[s]];
      right = DEGREE_TEXT[edgeSlotDegrees2[s]];
    }

    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.font = DIM_FONT;
    ctx.textBaseline = 'bottom';
    // The energy dimension is the one that is not a geometric measurement, so
    // it carries the accent ink — the same signal the callouts use for a head.
    ctx.fillStyle = kind === EDGE_KIND_ENERGY ? accentColor : inkColor;
    ctx.fillText(lead, 0, EDGE_LABEL_LEAD_BASELINE);
    // Two secondary values, two baselines. Sharing one line meant the wider
    // pairs overprinted each other; the horizontal nudge is kept so the stack
    // still reads as a dimension's two columns rather than a paragraph.
    ctx.textBaseline = 'top';
    ctx.globalAlpha = alpha * 0.8;
    ctx.fillStyle = inkMutedColor;
    ctx.fillText(left, -18, EDGE_LABEL_ROW_TOP);
    ctx.fillText(right, 18, EDGE_LABEL_ROW_TOP + EDGE_LABEL_LINE_H);
    ctx.restore();

    shown++;
  }

  lastEdgeSlotsUsed = held;
  return shown;
}

/**
 * Would a rectangle overlap any keep-out? Takes the text's own box, not the
 * node's — a callout is drawn beside its node, so those are not the same place.
 */
function hitsKeepOut(left, top, right, bottom) {
  for (let i = 0; i < labelKeepOuts.length; i++) {
    const r = labelKeepOuts[i];
    if (right > r.left && left < r.right && bottom > r.top && top < r.bottom) return true;
  }
  return false;
}

/**
 * Refresh a node's callout rows at one-second cadence. The renderer reuses the
 * cached strings between refreshes, so a 60 fps canvas builds 60× fewer strings
 * than it draws frames.
 *
 * Rows are key/value pairs rather than one packed line. That is what lets the
 * position mode read like a transform panel — axis letter in its axis colour on
 * the left, value right-aligned in a monospaced column on the right — instead
 * of `xyz 124, -33, 0.42`, which asks the reader to count commas.
 */
function refreshNodeCallout(node, mode) {
  if (node.labelMode === mode && infoClockS < node.labelNextUpdate) return;

  const id = `n${String(node.id).padStart(3, '0')}`;
  node.calloutAxis = false;
  node.calloutGauge = -1;
  node.calloutHandle = MODE_HANDLE[mode];

  if (mode === 0) {
    // Energy is three layers that never line up; showing the sum without its
    // terms is the one thing that would make the callout look like a mood ring.
    node.calloutHead = `${id}  ENERGY`;
    node.rowKey0 = 'E'; node.rowVal0 = node.energy.toFixed(3);
    node.rowKey1 = 'b'; node.rowVal1 = (0.5 + 0.5 * Math.sin(node.phase)).toFixed(3);
    node.rowKey2 = 'w'; node.rowVal2 = (0.5 + 0.5 * Math.sin(nodeWavePhase(node))).toFixed(3);
    node.rowKey3 = 'a'; node.rowVal3 = probeAudio.toFixed(3);
    node.calloutRows = 4;
    node.calloutGauge = node.energy;
  } else if (mode === 1) {
    node.calloutHead = `${id}  TRANSFORM`;
    node.rowKey0 = 'X'; node.rowVal0 = formatAxis(node.x);
    node.rowKey1 = 'Y'; node.rowVal1 = formatAxis(node.y);
    node.rowKey2 = 'Z'; node.rowVal2 = node.z.toFixed(3);
    node.calloutRows = 3;
    node.calloutAxis = true;
    node.calloutGauge = 1 - node.z;
  } else if (mode === 2) {
    node.calloutHead = `${id}  VELOCITY`;
    node.rowKey0 = '|v|'; node.rowVal0 = `${Math.hypot(node.vx, node.vy).toFixed(2)} u/s`;
    node.rowKey1 = 'θ'; node.rowVal1 = `${Math.round(Math.atan2(node.vy, node.vx) * RAD_TO_DEG)}°`;
    node.rowKey2 = 'ω'; node.rowVal2 = `${node.phaseRate.toFixed(3)} r/s`;
    node.calloutRows = 3;
  } else if (mode === 3) {
    node.calloutHead = `${id}  PROJECTION`;
    node.rowKey0 = 'scale'; node.rowVal0 = node.scale.toFixed(3);
    node.rowKey1 = 'depth'; node.rowVal1 = node.z.toFixed(3);
    node.rowKey2 = 'near'; node.rowVal2 = `${Math.round((node.scale - minScale) / (1 - minScale) * 100)}%`;
    node.rowKey3 = 'px'; node.rowVal3 = `${Math.round(node.sx)}, ${Math.round(node.sy)}`;
    node.calloutRows = 4;
    node.calloutGauge = (node.scale - minScale) / (1 - minScale);
  } else if (mode === 4) {
    const phase = nodeWavePhase(node);
    node.calloutHead = `${id}  WAVE`;
    node.rowKey0 = 'ψ'; node.rowVal0 = `${Math.round(phase * RAD_TO_DEG)}°`;
    node.rowKey1 = 'k·p'; node.rowVal1 = (node.x * WAVE_KX + node.y * WAVE_KY).toFixed(2);
    node.rowKey2 = 'sin ψ'; node.rowVal2 = Math.sin(phase).toFixed(3);
    node.calloutRows = 3;
    node.calloutGauge = 0.5 + 0.5 * Math.sin(phase);
  } else if (mode === 5) {
    // Everything here was accumulated inside drawLinks() on values the renderer
    // had already computed — see the note there.
    node.calloutHead = `${id}  LINKS`;
    node.rowKey0 = 'deg'; node.rowVal0 = String(node.degree);
    node.rowKey1 = 'κ'; node.rowVal1 = node.coupling.toFixed(2);
    node.rowKey2 = 'near'; node.rowVal2 = node.nearest > 0 ? `${Math.round(node.nearest)} u` : '—';
    node.rowKey3 = 'r'; node.rowVal3 = `${Math.round(linkRadius)} u`;
    node.calloutRows = 4;
    node.calloutGauge = Math.min(1, node.degree / 8);
  } else if (mode === 6) {
    const remaining = node.lifeRate > 0 ? (1 - node.life) / node.lifeRate : 0;
    node.calloutHead = `${id}  LIFECYCLE`;
    node.rowKey0 = 'life'; node.rowVal0 = `${Math.round(node.life * 100)}%`;
    node.rowKey1 = 'fade'; node.rowVal1 = node.fade.toFixed(3);
    node.rowKey2 = 'τ'; node.rowVal2 = `${remaining.toFixed(0)} s`;
    node.rowKey3 = 'T'; node.rowVal3 = `${(1 / node.lifeRate).toFixed(0)} s`;
    node.calloutRows = 4;
    node.calloutGauge = node.fade;
  } else {
    // The spawn point itself: which term of the R2 low-discrepancy sequence
    // placed this node, and the depth excursion it was given.
    node.calloutHead = `${id}  SEED`;
    node.rowKey0 = 'i'; node.rowVal0 = String(node.seed);
    node.rowKey1 = 'u'; node.rowVal1 = node.u.toFixed(4);
    node.rowKey2 = 'v'; node.rowVal2 = node.v.toFixed(4);
    node.rowKey3 = 'z₀±'; node.rowVal3 = `${node.zBase.toFixed(2)}±${node.zAmp.toFixed(2)}`;
    node.calloutRows = 4;
  }

  node.labelMode = mode;
  node.labelNextUpdate = infoClockS + LABEL_VALUE_SECONDS;
}

/** Blender prints world coordinates with a unit and a sign column. So do we. */
function formatAxis(v) {
  return `${v >= 0 ? ' ' : ''}${v.toFixed(1)} u`;
}

function calloutBlockHeight(node) {
  const rows = node.calloutRows < CALLOUT_MAX_ROWS ? node.calloutRows : CALLOUT_MAX_ROWS;
  return CALLOUT_PAD_Y * 2 + CALLOUT_HEAD_H + rows * CALLOUT_ROW_H
    + (node.calloutGauge >= 0 ? CALLOUT_GAUGE_H + 3 : 0);
}

/**
 * Sparse, energy-gated callouts on the nodes nearest the viewer.
 *
 * Selection is sticky: a node that already holds a callout gets a bonus in the
 * nearest-first contest, so a readout does not hop between neighbours every
 * time two nodes swap depth by a hair. Everything a placement decision needs is
 * in pre-sized arrays.
 *
 * @returns {number} how many callouts were drawn, for the stats readout
 */
function drawCallouts(ctx, nodes, n) {
  const maxLabels = labelCapacity();
  const baseMode = modeAt(infoClockS);

  let count = 0;
  for (let i = 0; i < n; i++) {
    const node = nodes[i];
    if (!node.labelHeld || node.fade <= 0) continue;
    if (node.sx < LABEL_EDGE_X || node.sx > stillFieldW - LABEL_EDGE_X) continue;
    if (node.sy < LABEL_EDGE_Y || node.sy > stillFieldH - LABEL_EDGE_Y) continue;

    // Nearest first, with a hold bonus. Insertion sort over at most eight
    // entries beats keeping a sorted structure alive between frames.
    //
    // The bonus is what makes the *selection* sticky, and it has to be large
    // enough to survive the depth noise it is there to reject: two nodes
    // separated by a hair of `scale` swap places constantly, and at a 1.4×
    // bonus a card still lost its slot to a neighbour that had drifted a
    // thousandth nearer. The gate is above the release envelope's tail too, so
    // a block on its way out stops defending a slot it is no longer using.
    const score = node.scale * (node.labelAlpha > 0.15 ? 1.55 : 1);
    if (count === maxLabels && score <= labelScores[count - 1]) continue;

    let b = count < maxLabels ? count++ : count - 1;
    while (b > 0 && labelScores[b - 1] < score) {
      labelCandidates[b] = labelCandidates[b - 1];
      labelScores[b] = labelScores[b - 1];
      b--;
    }
    labelCandidates[b] = i;
    labelScores[b] = score;
  }

  if (count === 0) {
    lastModesOnScreen = 0;
    return 0;
  }

  // --- Placement -------------------------------------------------------
  let placed = 0;
  let modeMask = 0;
  for (let k = 0; k < count; k++) {
    const node = nodes[labelCandidates[k]];
    // The rotation is global; the mode a given node lands on is that index
    // offset by the node's own. Two callouts side by side therefore read two
    // different quantities, and each one still walks the whole set over time.
    const mode = (baseMode + node.modeOffset) % LABEL_MODE_COUNT;
    refreshNodeCallout(node, mode);

    const height = calloutBlockHeight(node);
    const top = node.sy - LEADER_RUN - height;
    if (top < 4) continue;

    // Which side the block sits on is hysteretic: try the side this node used
    // last, and only mirror when that side is genuinely unusable — off the
    // screen margin, under the interface, or over the source listing.
    //
    // Recomputing the side from scratch each frame is what produced the bounce.
    // The old rule was "right unless the right edge is close", so a node
    // drifting around `stillFieldW - CALLOUT_W - 26` crossed that threshold
    // every few frames and threw a 132px block back and forth across its own
    // leader line, several times a second, on the screen you are falling asleep
    // to. With a remembered side there is no threshold to oscillate about: once
    // a node has flipped left, left keeps working, so it stays there until it
    // stops working. Note the collision tests below deliberately do *not* flip
    // it — block-on-block overlaps are transient, and flipping on them would
    // reintroduce exactly the bounce this removes.
    let side = 0;
    let left = 0;
    for (let attempt = 0; attempt < 2; attempt++) {
      const trySide = attempt === 0 ? node.preferSide : -node.preferSide;
      const tryLeft = trySide > 0
        ? node.sx + LEADER_RUN + LEADER_SHELF
        : node.sx - LEADER_RUN - LEADER_SHELF - CALLOUT_W;
      if (tryLeft < 8 || tryLeft + CALLOUT_W > stillFieldW - 8) continue;
      if (hitsKeepOut(tryLeft, top, tryLeft + CALLOUT_W, top + height)) continue;
      if (hitsCodeBlock(tryLeft, top, tryLeft + CALLOUT_W, top + height)) continue;
      side = trySide;
      left = tryLeft;
      break;
    }
    if (side === 0) continue;

    let collides = false;
    for (let d = 0; d < placed; d++) {
      if (left < calloutLeft[d] + CALLOUT_W && left + CALLOUT_W > calloutLeft[d]
        && top < calloutTop[d] + calloutHeight[d] && top + height > calloutTop[d]) {
        collides = true;
        break;
      }
    }
    if (!collides) {
      for (let e = 0; e < MAX_EDGE_LABELS; e++) {
        if (edgeSlotAlpha[e] <= 0.05) continue;
        if (left < edgeSlotX[e] + EDGE_LABEL_HALF_W && left + CALLOUT_W > edgeSlotX[e] - EDGE_LABEL_HALF_W
          && top < edgeSlotY[e] + EDGE_LABEL_HALF_H && top + height > edgeSlotY[e] - EDGE_LABEL_HALF_H) {
          collides = true;
          break;
        }
      }
    }
    if (collides) continue;

    // Winning the contest is what lifts the opacity envelope; update() pulls
    // every node's envelope down, so losing it fades out rather than cutting.
    node.labelAlpha += (1 - node.labelAlpha) * labelAttackCoefficient;
    const nearness = (node.scale - minScale) / (1 - minScale);
    const alpha = clamp(0.55 + nearness * 0.4, 0, 0.96) * node.labelAlpha * node.fade;
    if (alpha < 0.02) continue;

    // Only a placement that actually drew commits the side. Recording it at the
    // point of choice instead would let a block that then lost a collision test
    // move the node's preference on the strength of a frame nobody saw.
    if (side !== node.preferSide && node.labelAlpha > 0.15) calloutSideFlips++;
    node.preferSide = side;

    calloutNode[placed] = labelCandidates[k];
    calloutLeft[placed] = left;
    calloutTop[placed] = top;
    calloutHeight[placed] = height;
    calloutSide[placed] = side;
    calloutAlpha[placed] = alpha;
    modeMask |= 1 << mode;
    placed++;
  }

  // Popcount of the mask: how many distinct quantities the field is currently
  // reading out. It is the honest measure of whether the variety is working.
  let distinct = 0;
  for (let m = modeMask; m; m >>= 1) distinct += m & 1;
  lastModesOnScreen = distinct;

  if (placed === 0) return 0;

  // --- Paint -----------------------------------------------------------
  // Three passes over the placed blocks, grouped by the context state each one
  // needs. Assigning `ctx.font` reparses the shorthand, so the two fonts are
  // each set once per frame instead of once per block.
  drawCalloutFurniture(ctx, nodes, placed);

  ctx.font = HEAD_FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (let k = 0; k < placed; k++) {
    const node = nodes[calloutNode[k]];
    ctx.globalAlpha = calloutAlpha[k];
    ctx.fillStyle = accentColor;
    ctx.fillText(node.calloutHead, snap(calloutLeft[k] + CALLOUT_PAD_X), snap(calloutTop[k] + CALLOUT_PAD_Y));
  }

  ctx.font = MONO_FONT;
  for (let k = 0; k < placed; k++) {
    const node = nodes[calloutNode[k]];
    const left = calloutLeft[k];
    const alpha = calloutAlpha[k];
    let y = calloutTop[k] + CALLOUT_PAD_Y + CALLOUT_HEAD_H;

    for (let row = 0; row < node.calloutRows; row++) {
      const key = row === 0 ? node.rowKey0 : row === 1 ? node.rowKey1
        : row === 2 ? node.rowKey2 : node.rowKey3;
      const value = row === 0 ? node.rowVal0 : row === 1 ? node.rowVal1
        : row === 2 ? node.rowVal2 : node.rowVal3;

      ctx.globalAlpha = alpha * 0.9;
      // Axis colouring only ever covers the first three rows: X, Y, Z is the
      // convention, and a fourth axis colour would be inventing one.
      ctx.fillStyle = node.calloutAxis && row < 3 ? axisColors[row] : inkMutedColor;
      ctx.textAlign = 'left';
      ctx.fillText(key, snap(left + CALLOUT_PAD_X), snap(y));

      ctx.globalAlpha = alpha;
      ctx.fillStyle = inkColor;
      ctx.textAlign = 'right';
      ctx.fillText(value, snap(left + CALLOUT_W - CALLOUT_PAD_X), snap(y));

      y += CALLOUT_ROW_H;
    }
  }

  ctx.textAlign = 'left';
  return placed;
}

/** Plates, rules, gauges, leader lines and node handles — everything but text. */
function drawCalloutFurniture(ctx, nodes, placed) {
  for (let k = 0; k < placed; k++) {
    const node = nodes[calloutNode[k]];
    const left = calloutLeft[k];
    const top = calloutTop[k];
    const height = calloutHeight[k];
    const alpha = calloutAlpha[k];
    const side = calloutSide[k];

    // Backing plate. This is what replaced the glow: a label is legible over a
    // busy field either because it is blurred into a halo, or because it has
    // something behind it. The plate keeps the glyph edges perfectly sharp.
    ctx.globalAlpha = alpha * 0.82;
    ctx.fillStyle = plateColor;
    ctx.beginPath();
    if (hasRoundRect) ctx.roundRect(snap(left), snap(top), CALLOUT_W, height, 5);
    else ctx.rect(snap(left), snap(top), CALLOUT_W, height);
    ctx.fill();

    ctx.globalAlpha = alpha * 0.55;
    ctx.strokeStyle = hairlineColor;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Accent spine on the leading edge, and a rule under the head. "Leading"
    // means the edge the leader line arrives at, which is the right-hand edge
    // on a mirrored block — pinning it to `left` regardless put the spine on
    // the far side of the plate from its own leader, so a left-side callout
    // read as if it belonged to whatever was further left again.
    ctx.globalAlpha = alpha * 0.9;
    ctx.fillStyle = accentColor;
    ctx.fillRect(snap(side > 0 ? left : left + CALLOUT_W - 2), snap(top + 4), 2, height - 8);
    ctx.globalAlpha = alpha * 0.28;
    ctx.fillRect(snap(left + CALLOUT_PAD_X), snap(top + CALLOUT_PAD_Y + CALLOUT_HEAD_H - 3), CALLOUT_W - CALLOUT_PAD_X * 2, 1);

    // Gauge, when the mode has a naturally bounded quantity to show.
    if (node.calloutGauge >= 0) {
      const gy = top + height - CALLOUT_PAD_Y - CALLOUT_GAUGE_H + 1;
      const gw = CALLOUT_W - CALLOUT_PAD_X * 2;
      ctx.globalAlpha = alpha * 0.22;
      ctx.fillStyle = inkMutedColor;
      ctx.fillRect(snap(left + CALLOUT_PAD_X), snap(gy), gw, 2);
      ctx.globalAlpha = alpha * 0.85;
      ctx.fillStyle = accentColor;
      ctx.fillRect(snap(left + CALLOUT_PAD_X), snap(gy), Math.max(1, gw * clamp(node.calloutGauge, 0, 1)), 2);
    }

    // Leader line: diagonal out of the node, then a horizontal shelf into the
    // block. Two straight runs read as a drawing annotation; a curve reads as a
    // speech bubble.
    const anchorX = side > 0 ? left : left + CALLOUT_W;
    const anchorY = top + height;
    const elbowX = anchorX - side * LEADER_SHELF;
    const startX = node.sx + side * NODE_HANDLE;
    const startY = node.sy - NODE_HANDLE;

    ctx.globalAlpha = alpha * 0.75;
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(snap(startX) + 0.5, snap(startY) + 0.5);
    ctx.lineTo(snap(elbowX) + 0.5, snap(anchorY) + 0.5);
    ctx.lineTo(snap(anchorX) + 0.5, snap(anchorY) + 0.5);
    ctx.stroke();

    // Open handle on the node itself, so it is obvious which of a dozen nodes
    // the block belongs to — and, because the glyph follows the detail mode,
    // which family of quantity is being read before the text is legible.
    ctx.globalAlpha = alpha * 0.9;
    drawNodeHandle(ctx, node.calloutHandle, snap(node.sx) + 0.5, snap(node.sy) + 0.5);
  }
}

/** One stroked glyph, centred on `(x, y)`. See MODE_HANDLE. */
function drawNodeHandle(ctx, handle, x, y) {
  const h = NODE_HANDLE;
  ctx.beginPath();
  if (handle === HANDLE_CIRCLE) {
    ctx.arc(x, y, h, 0, TAU);
  } else if (handle === HANDLE_DIAMOND) {
    const d = h * 1.3;
    ctx.moveTo(x, y - d);
    ctx.lineTo(x + d, y);
    ctx.lineTo(x, y + d);
    ctx.lineTo(x - d, y);
    ctx.closePath();
  } else if (handle === HANDLE_CROSS) {
    // Open crosshair: four ticks with a gap at the centre, so the node itself
    // stays visible inside its own marker.
    const g = h * 0.45;
    ctx.moveTo(x - h - 2, y); ctx.lineTo(x - g, y);
    ctx.moveTo(x + g, y); ctx.lineTo(x + h + 2, y);
    ctx.moveTo(x, y - h - 2); ctx.lineTo(x, y - g);
    ctx.moveTo(x, y + g); ctx.lineTo(x, y + h + 2);
  } else {
    ctx.rect(x - h, y - h, h * 2, h * 2);
  }
  ctx.stroke();
}

// ----------------------------------------------------------
// The code ticker
// ----------------------------------------------------------

/**
 * Refresh the live values printed against the source lines. Once a second, on
 * the same cadence as the callouts, for the same reason.
 */
function refreshCodeValues() {
  if (infoClockS < codeValueNextUpdate) return;
  codeValueNextUpdate = infoClockS + LABEL_VALUE_SECONDS;

  const n = stillFieldNodes.length;
  codeValueText[0] = lastDt.toFixed(4);
  codeValueText[1] = `${(clockS % 1000).toFixed(1)} s`;
  codeValueText[2] = `n = ${n}`;
  codeValueText[3] = `J = ${lastJitter.toFixed(1)}`;
  codeValueText[4] = `z = ${probeZ.toFixed(3)}`;
  codeValueText[5] = `s = ${probeScale.toFixed(3)}`;
  codeValueText[6] = `${lastGridCells} cells`;
  codeValueText[7] = `${lastPairTests} of ${(n * (n - 1) / 2) | 0}`;
  codeValueText[8] = `d = ${sampleDistance.toFixed(0)}`;
  codeValueText[9] = `t = ${sampleTarget.toFixed(3)}`;
  codeValueText[10] = `s = ${sampleStrength.toFixed(3)}`;
  codeValueText[11] = `${lastBatches} batches`;
  codeValueText[12] = `E = ${probeEnergy.toFixed(3)}`;
  codeValueText[13] = `${lastEdgeCount} edges`;
  codeValueText[14] = `${measuredFps.toFixed(0)} fps`;
  codeValueText[15] = `${lastLabelCount} shown`;
  codeValueText[16] = infoClockS > 1
    ? `${(respawnCount / infoClockS * 60).toFixed(1)}/min`
    : 'settling';
  codeValueText[17] = `x̄ ${(n ? lastEdgeCount * 2 / n : 0).toFixed(2)} · ↑${lastMaxDegree}`;
  codeValueText[18] = `${lastGlowNodes}/${MAX_GLOW_NODES} glow`;
  codeValueText[19] = `${lastEdgeLabelCount} dims`;
  codeValueText[20] = `${LABEL_MODE_NAMES[modeAt(infoClockS)]} +${lastModesOnScreen}`;
  codeValueText[CODE_SUMMARY_SLOT] = `u ${stageUpdateMs.toFixed(2)} · l ${stageLinksMs.toFixed(2)} · n ${stageNodesMs.toFixed(2)} · i ${stageInfoMs.toFixed(2)} ms`;
}

/**
 * Choose a corner for the listing, or decide there is nowhere for it to go.
 *
 * Four candidates, tried in order of preference. The bottom-right is the
 * natural home, but in immersion mode the floating play cluster lives there, so
 * a single fixed position would mean the listing silently never appeared for
 * exactly the users most likely to want it.
 */
const CODE_CORNERS_X = Int8Array.from([1, 1, -1, -1]);   // +1 right, −1 left
const CODE_CORNERS_Y = Int8Array.from([1, -1, 1, -1]);   // +1 bottom, −1 top

function layoutCodeTicker() {
  codeVisible = false;
  if (!stillFieldCode) return;
  if (stillFieldW < CODE_MIN_VIEWPORT) return;

  // Folded, the listing is just its header bar — small enough that it always
  // fits, which is the point: the corner is freed without the overlay
  // disappearing and leaving no way back to it.
  const height = codeFolded
    ? CODE_HEAD_H
    : CODE_HEAD_H + CODE_LINES.length * CODE_LINE_H + CODE_FOOT_H;
  if (height + 48 > stillFieldH) return;

  for (let c = 0; c < 4; c++) {
    const left = CODE_CORNERS_X[c] > 0 ? stillFieldW - CODE_BLOCK_W - 20 : 20;
    const top = CODE_CORNERS_Y[c] > 0 ? stillFieldH - height - 24 : 24;
    if (top < 12) continue;
    if (hitsKeepOut(left, top, left + CODE_BLOCK_W, top + height)) continue;
    codeLeft = left;
    codeTop = top;
    codeHeight = height;
    codeVisible = true;
    return;
  }
}

/**
 * Route a pointer press at viewport coordinates to the source overlay.
 *
 * The overlay is canvas, so it cannot be a button — but a listing you can only
 * dismiss from a panel two scrolls away is a listing people leave switched off.
 * app.js calls this for presses that landed on the page background, and only
 * the header bar is live. The Field Lab switch remains the keyboard-reachable,
 * persisted control; this is the direct affordance on top of it.
 *
 * @param {number} x viewport CSS px
 * @param {number} y viewport CSS px
 * @returns {boolean} true if the overlay consumed the press
 */
export function handleOverlayPointer(x, y) {
  if (!codeVisible || !stillFieldEnabled || !stillFieldNerd) return false;
  // The plate extends a little past the text column on every side; matching it
  // keeps the target at the size it looks.
  if (x < codeLeft - 10 || x > codeLeft + CODE_BLOCK_W + 10) return false;
  if (y < codeTop - 8 || y > codeTop + CODE_HEAD_H) return false;
  setCodeFolded(!codeFolded);
  return true;
}

/** Does a box overlap the listing? Used by callouts and dimensions. */
function hitsCodeBlock(left, top, right, bottom) {
  if (!codeVisible) return false;
  return right > codeLeft && left < codeLeft + CODE_BLOCK_W
    && bottom > codeTop && top < codeTop + codeHeight;
}

/**
 * A column of this renderer's own source, with a program counter sweeping it.
 *
 * The cursor is not decorative timing: each stage's share of the sweep is its
 * measured share of the frame's work, so the marker genuinely lingers where the
 * time goes. Watch it for a few seconds with the node density up and you can
 * see the link pass take over the frame.
 */
function drawCodeTicker(ctx, dt) {
  const lines = CODE_LINES.length;
  const left = codeLeft;
  const top = codeTop;

  refreshCodeValues();

  // Stage weights from the measured profile. A stage with no measurable cost
  // still gets a floor, so the cursor keeps moving rather than stalling on the
  // first frame before any timing exists.
  const total = stageUpdateMs + stageLinksMs + stageNodesMs + stageInfoMs;
  const share0 = total > 0 ? Math.max(0.06, stageUpdateMs / total) : 0.25;
  const share1 = total > 0 ? Math.max(0.06, stageLinksMs / total) : 0.25;
  const share2 = total > 0 ? Math.max(0.06, stageNodesMs / total) : 0.25;
  const share3 = total > 0 ? Math.max(0.06, stageInfoMs / total) : 0.25;
  const shareSum = share0 + share1 + share2 + share3;

  ctx.textBaseline = 'top';
  ctx.font = CODE_FONT;

  // A very light plate. The listing sits over the field's own lines, and
  // without something behind it an edge crossing a line of code is read as part
  // of the code. Kept far more transparent than a callout plate — this is
  // ambient, not a readout you are meant to stop and study.
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = plateColor;
  ctx.beginPath();
  if (hasRoundRect) ctx.roundRect(snap(left - 10), snap(top - 8), CODE_BLOCK_W + 20, codeHeight + 4, 6);
  else ctx.rect(snap(left - 10), snap(top - 8), CODE_BLOCK_W + 20, codeHeight + 4);
  ctx.fill();

  drawCodeHeader(ctx, left, top, total);
  if (codeFolded) {
    ctx.textAlign = 'left';
    return;
  }

  codeCursor += dt / (reducedMotion ? CODE_SWEEP_S * 3 : CODE_SWEEP_S);
  if (codeCursor >= 1) codeCursor -= Math.floor(codeCursor);

  // Walk the weighted listing to find the line the counter is on.
  const target = codeCursor * shareSum;
  let running = 0;
  codeActiveLine = 0;
  for (let i = 0; i < lines; i++) {
    const stage = CODE_LINES[i][CODE_STAGE];
    const share = stage === 0 ? share0 : stage === 1 ? share1 : stage === 2 ? share2 : share3;
    running += share / CODE_STAGE_LINES[stage];
    if (running >= target) { codeActiveLine = i; break; }
    codeActiveLine = i;
  }

  // Heat, not a highlight. The counter deposits warmth on the line it reaches
  // and every line cools exponentially, so the marker reads as a soft comet
  // passing down the listing rather than a row switching on and off. The decay
  // is a rate per second like every other decay here, so the tail is the same
  // length at 30, 45 and 60 fps.
  const cool = Math.exp(-CODE_HEAT_DECAY * dt);
  for (let i = 0; i < lines; i++) codeLineHeat[i] *= cool;
  codeLineHeat[codeActiveLine] = 1;

  const bodyTop = top + CODE_HEAD_H;
  drawCodeGutter(ctx, left, bodyTop, share0, share1, share2, share3);

  for (let i = 0; i < lines; i++) {
    const line = CODE_LINES[i];
    const y = bodyTop + i * CODE_LINE_H;
    const heat = codeLineHeat[i];
    const warm = heat > CODE_HEAT_EPSILON;

    if (warm) {
      // A wash this faint is under the threshold at which a moving band is
      // distracting, which is the entire brief for this overlay.
      ctx.globalAlpha = heat * 0.085;
      ctx.fillStyle = accentColor;
      ctx.fillRect(snap(left - 4), snap(y - 1), CODE_BLOCK_W + 8, CODE_LINE_H);
      ctx.globalAlpha = heat * 0.5;
      ctx.fillRect(snap(left - 8), snap(y - 1), 2, CODE_LINE_H);
    }

    ctx.textAlign = 'right';
    ctx.globalAlpha = 0.26 + heat * 0.24;
    ctx.fillStyle = inkMutedColor;
    ctx.fillText(String(i + 1).padStart(2, '0'), snap(left + CODE_GUTTER - 6), snap(y));

    const textX = snap(left + CODE_GUTTER + line[CODE_INDENT] * 12);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 0.40 + heat * 0.22;
    ctx.fillStyle = inkColor;
    ctx.fillText(line[CODE_TEXT], textX, snap(y));
    // Warmth tints rather than replaces: over-printing in the accent at the
    // heat's own alpha crossfades the colour instead of stepping it.
    if (warm) {
      ctx.globalAlpha = heat * 0.42;
      ctx.fillStyle = accentColor;
      ctx.fillText(line[CODE_TEXT], textX, snap(y));
    }

    const slot = line[CODE_SLOT];
    if (slot >= 0) {
      ctx.textAlign = 'right';
      ctx.globalAlpha = 0.32 + heat * 0.34;
      ctx.fillStyle = inkMutedColor;
      ctx.fillText(codeValueText[slot], snap(left + CODE_BLOCK_W), snap(y));
    }
  }

  drawCodeFooter(ctx, left, bodyTop + lines * CODE_LINE_H, share0, share1, share2, share3);
  ctx.textAlign = 'left';
}

/** Title bar: the file, the frame cost, and the fold chevron that toggles it. */
function drawCodeHeader(ctx, left, top, totalMs) {
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = inkMutedColor;
  ctx.textAlign = 'left';
  ctx.fillText('js/still-field.js — render loop', snap(left + CODE_GUTTER), snap(top));

  ctx.textAlign = 'right';
  ctx.globalAlpha = 0.42;
  ctx.fillText(
    codeFolded ? `${CODE_LINES.length} lines` : `${totalMs.toFixed(2)} ms/frame`,
    snap(left + CODE_BLOCK_W - 14),
    snap(top),
  );

  // Chevron: down when expanded (it will collapse), right when folded.
  const cx = left + CODE_BLOCK_W - 5;
  const cy = top + 5;
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  if (codeFolded) {
    ctx.moveTo(snap(cx - 3) + 0.5, snap(cy - 4) + 0.5);
    ctx.lineTo(snap(cx + 1) + 0.5, snap(cy) + 0.5);
    ctx.lineTo(snap(cx - 3) + 0.5, snap(cy + 4) + 0.5);
  } else {
    ctx.moveTo(snap(cx - 5) + 0.5, snap(cy - 2) + 0.5);
    ctx.lineTo(snap(cx - 1) + 0.5, snap(cy + 2) + 0.5);
    ctx.lineTo(snap(cx + 3) + 0.5, snap(cy - 2) + 0.5);
  }
  ctx.stroke();

  ctx.globalAlpha = 0.28;
  ctx.fillStyle = inkMutedColor;
  ctx.fillRect(snap(left - 4), snap(top + 14), CODE_BLOCK_W + 8, 1);
}

/**
 * Stage rails down the left margin. One bar per contiguous run of lines, its
 * opacity the stage's measured share — so the shape of the frame is legible
 * from the gutter alone, without reading a single number.
 */
function drawCodeGutter(ctx, left, bodyTop, share0, share1, share2, share3) {
  const x = snap(left - 8);
  for (let stage = 0; stage < 4; stage++) {
    const first = CODE_STAGE_FIRST[stage];
    if (first < 0) continue;
    const share = stage === 0 ? share0 : stage === 1 ? share1 : stage === 2 ? share2 : share3;
    const y = snap(bodyTop + first * CODE_LINE_H);
    const h = (CODE_STAGE_LAST[stage] - first + 1) * CODE_LINE_H - 3;
    ctx.globalAlpha = 0.10 + share * 0.42;
    ctx.fillStyle = accentColor;
    ctx.fillRect(x, y, 2, h);
  }
}

/** A stacked bar of where the frame's time actually went, plus the raw figures. */
function drawCodeFooter(ctx, left, y, share0, share1, share2, share3) {
  const sum = share0 + share1 + share2 + share3;
  const barY = snap(y + 4);
  let x = left;
  // Written into a pre-allocated array rather than a literal: this runs every
  // frame, and an array literal here is an allocation in the render loop.
  stageShareScratch[0] = share0;
  stageShareScratch[1] = share1;
  stageShareScratch[2] = share2;
  stageShareScratch[3] = share3;
  ctx.fillStyle = accentColor;
  for (let stage = 0; stage < 4; stage++) {
    const w = (stageShareScratch[stage] / sum) * CODE_BLOCK_W;
    ctx.globalAlpha = CODE_STAGE_ALPHA[stage];
    ctx.fillRect(snap(x), barY, Math.max(1, w - 1), 2);
    x += w;
  }

  ctx.globalAlpha = 0.34;
  ctx.fillStyle = inkMutedColor;
  ctx.textAlign = 'left';
  ctx.fillText(codeValueText[CODE_SUMMARY_SLOT], snap(left), snap(y + 8));
}

// ----------------------------------------------------------
// Loop control
// ----------------------------------------------------------

function stopLoop() {
  if (stillFieldRaf) {
    cancelAnimationFrame(stillFieldRaf);
    stillFieldRaf = null;
  }
  // Nothing is being drawn any more, so the readout should say so rather than
  // freeze on the last rate it happened to see.
  measuredFps = 0;
  measuredFrameMs = 0;
  stageUpdateMs = stageLinksMs = stageNodesMs = stageInfoMs = 0;
  lastEdgeCount = 0;
  lastLabelCount = 0;
  lastEdgeLabelCount = 0;
  lastEdgeSlotsUsed = 0;
  lastPairTests = 0;
  lastBatches = 0;
  lastGlowNodes = 0;
  lastMaxDegree = 0;
  lastModesOnScreen = 0;
}

export function startStillFieldLoop() {
  if (stillFieldRaf) return;
  if (!stillFieldEnabled) return;
  if (document.visibilityState === 'hidden') return;
  // Reset the clock so the first step after a pause is a normal one rather than
  // however long the app sat idle.
  lastFrameMs = performance.now();
  lastDrawMs = lastFrameMs - 1000 / stillFieldFps;
  stillFieldRaf = requestAnimationFrame(frame);
}

/**
 * Stop drawing entirely while the page is hidden. A backgrounded tab still runs
 * throttled animation frames, and on a phone that is a locked screen quietly
 * spending battery for eight hours.
 */
function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    stopLoop();
  } else if (stillFieldEnabled) {
    startStillFieldLoop();
  }
}

// ----------------------------------------------------------
// Settings
// ----------------------------------------------------------

/**
 * Turn the visualisation on or off. Persists the choice.
 * @param {boolean} on
 */
export function setStillFieldEnabled(on) {
  stillFieldEnabled = Boolean(on);
  write(STORAGE_KEYS.stillFieldEnabled, stillFieldEnabled);
  applyCanvasVisibility();

  if (stillFieldEnabled) {
    startStillFieldLoop();
  } else {
    stopLoop();
    stillEnergy = 0;
    publishEnergy(0);
    if (stillFieldCtx) stillFieldCtx.clearRect(0, 0, stillFieldW, stillFieldH);
    infoCleared = false;
    clearInfoCanvas();
  }
  emit();
}

/**
 * Set visual intensity. Persists the choice.
 * @param {number} v 0–1
 */
export function setStillFieldIntensity(v) {
  stillFieldIntensity = clamp(v, 0, 1);
  write(STORAGE_KEYS.stillFieldIntensity, stillFieldIntensity);
  measureWorld(); // intensity widens the link radius
  if (stillFieldIntensity > 0.01 && stillFieldEnabled) startStillFieldLoop();
  emit();
}

/**
 * Set drift speed. Persists the choice.
 * @param {number} v multiplier, STILL_SPEED_MIN–STILL_SPEED_MAX
 */
export function setStillFieldSpeed(v) {
  stillFieldSpeed = clamp(v, STILL_SPEED_MIN, STILL_SPEED_MAX);
  write(STORAGE_KEYS.stillFieldSpeed, stillFieldSpeed);
  emit();
}

/**
 * Toggle the nerd / info layer. Persists the choice.
 * @param {boolean} on
 */
export function setStillFieldNerd(on) {
  stillFieldNerd = Boolean(on);
  write(STORAGE_KEYS.stillFieldNerd, stillFieldNerd);
  if (!stillFieldNerd) {
    measuredFrameMs = 0;
    stageUpdateMs = stageLinksMs = stageNodesMs = stageInfoMs = 0;
    lastModesOnScreen = 0;
    lastGlowNodes = 0;
    resetEdgeSlots();
    infoCleared = false;
    clearInfoCanvas();
  }
  emit();
}

/**
 * Node population multiplier. Persists the choice.
 * @param {number} v STILL_DENSITY_MIN–STILL_DENSITY_MAX
 */
export function setStillFieldDensity(v) {
  stillFieldDensity = clamp(v, STILL_DENSITY_MIN, STILL_DENSITY_MAX);
  write(STORAGE_KEYS.stillFieldDensity, stillFieldDensity);
  applyNodeCount();
  emit();
}

/**
 * Link radius multiplier. Persists the choice.
 * @param {number} v STILL_REACH_MIN–STILL_REACH_MAX
 */
export function setStillFieldReach(v) {
  stillFieldReach = clamp(v, STILL_REACH_MIN, STILL_REACH_MAX);
  write(STORAGE_KEYS.stillFieldReach, stillFieldReach);
  measureWorld();
  emit();
}

/**
 * Trail decay rate, per second. Lower leaves a longer comet tail.
 * @param {number} v STILL_TRAIL_MIN–STILL_TRAIL_MAX
 */
export function setStillFieldTrail(v) {
  stillFieldTrail = clamp(v, STILL_TRAIL_MIN, STILL_TRAIL_MAX);
  write(STORAGE_KEYS.stillFieldTrail, stillFieldTrail);
  emit();
}

/**
 * Perspective strength. Persists the choice, and re-derives the world plane —
 * the world is sized so the far plane still fills the viewport, and the far
 * plane moves when depth does.
 * @param {number} v STILL_DEPTH_MIN–STILL_DEPTH_MAX
 */
export function setStillFieldDepth(v) {
  depth = clamp(v, STILL_DEPTH_MIN, STILL_DEPTH_MAX);
  minScale = 1 / (1 + depth);
  write(STORAGE_KEYS.stillFieldDepth, depth);
  measureWorld();
  applyNodeCount();
  emit();
}

/**
 * Mean seconds a callout detail mode holds. The actual per-mode dwell is this
 * scaled by that mode's golden-ratio weight — see MODE_WEIGHTS.
 * @param {number} v STILL_DWELL_MIN–STILL_DWELL_MAX
 */
export function setStillFieldDwell(v) {
  stillFieldDwell = clamp(v, STILL_DWELL_MIN, STILL_DWELL_MAX);
  write(STORAGE_KEYS.stillFieldDwell, stillFieldDwell);
  emit();
}

/**
 * Frame-rate cap. Motion is integrated from elapsed time, so this changes how
 * smooth the field looks and nothing about how fast it drifts.
 * @param {number} v one of STILL_FPS_OPTIONS
 */
export function setStillFieldFps(v) {
  const next = Number(v);
  if (!STILL_FPS_OPTIONS.includes(next)) return;
  stillFieldFps = next;
  write(STORAGE_KEYS.stillFieldFps, stillFieldFps);
  emit();
}

/**
 * Toggle the on-canvas source ticker. Persists the choice.
 * @param {boolean} on
 */
export function setStillFieldCode(on) {
  stillFieldCode = Boolean(on);
  write(STORAGE_KEYS.stillFieldCode, stillFieldCode);
  emit();
}

/**
 * Toggle the on-canvas node callouts. Persists the choice.
 *
 * Independent of the edge dimensions and the source listing: the three overlays
 * cost different amounts and suit different moods, and one switch for all three
 * meant wanting quiet edges cost you the callouts too.
 * @param {boolean} on
 */
export function setStillFieldCallouts(on) {
  stillFieldCallouts = Boolean(on);
  write(STORAGE_KEYS.stillFieldCallouts, stillFieldCallouts);
  if (!stillFieldCallouts) {
    // Drop every hold, or re-enabling would pop a screenful of callouts back in
    // at whatever opacity they froze at.
    for (const node of stillFieldNodes) resetNodeCallout(node);
    lastLabelCount = 0;
    lastModesOnScreen = 0;
  }
  emit();
}

/**
 * Toggle the on-canvas edge dimensions. Persists the choice.
 * @param {boolean} on
 */
export function setStillFieldEdges(on) {
  stillFieldEdges = Boolean(on);
  write(STORAGE_KEYS.stillFieldEdges, stillFieldEdges);
  if (!stillFieldEdges) {
    resetEdgeSlots();
    lastEdgeLabelCount = 0;
  }
  emit();
}

/**
 * Fold or expand the on-canvas source listing. Session-only, like the HUD's
 * fold: the persisted setting is whether the overlay exists at all.
 * @param {boolean} folded
 */
export function setCodeFolded(folded) {
  codeFolded = Boolean(folded);
  emit();
}

/**
 * Fold or expand the stats HUD. Session-only (does not persist).
 * @param {boolean} folded
 */
export function setNerdFolded(folded) {
  nerdFolded = Boolean(folded);
  emit();
}

/** Toggle the fold state of the stats HUD. */
export function toggleNerdFolded() {
  setNerdFolded(!nerdFolded);
}

/**
 * Select the integrated information view. This is intentionally session-only:
 * reloading returns to the useful live overview.
 * @param {'live'|'math'|'code'} view
 */
export function setNerdView(view) {
  if (view !== 'live' && view !== 'math' && view !== 'code') return;
  nerdView = view;
  emit();
}

/**
 * Toggle the secondary background texture. Persists the choice.
 * @param {boolean} on
 */
export function setStillFieldTexture(on) {
  stillFieldTexture = Boolean(on);
  write(STORAGE_KEYS.stillFieldTexture, stillFieldTexture);
  emit();
}

/**
 * Handle a viewport resize. Debounced — mobile browsers fire `resize` on every
 * address-bar show/hide, and re-laying-out the canvas is not free.
 */
export function handleResize() {
  if (resizeDebounceId) clearTimeout(resizeDebounceId);
  resizeDebounceId = setTimeout(() => {
    resizeDebounceId = null;
    resizeStillField();
  }, RESIZE_DEBOUNCE_MS);
}

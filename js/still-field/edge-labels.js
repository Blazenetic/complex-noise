/**
 * Edge dimensions — engineering-drawing callouts on the links themselves.
 *
 * The text rides the line it measures, flipped so it is never upside-down, with
 * witness ticks at the ends of the measured span. Reading a length off a
 * diagram works because the number is parallel to the thing it describes; a
 * horizontal caption floating near a diagonal line makes the reader do the
 * association themselves.
 *
 * ## Slots, not samples
 *
 * The first version re-picked its edges from a hash every frame, so an
 * annotation existed for as long as its pair happened to satisfy the hash —
 * often a fraction of a second. These are **slots**: one is claimed by a pair,
 * tracks that pair while it stays linked and on screen, holds for a
 * procedurally-derived dwell, then fades out and frees itself. The pair is
 * identified by both endpoints' *lifetime IDs*, because array indices are
 * reused by respawning nodes and a slot must never silently start describing a
 * different edge.
 *
 * ## The budget
 *
 * Everything here is called from inside the link pass, on values the renderer
 * has already computed. It never opens a second graph scan, sorts links, or
 * builds an edge list — that would turn an information feature into an
 * overnight battery regression. Every string comes from a quantised lookup
 * table, so a dimension whose value changes every frame still allocates nothing.
 */

import { clamp } from '../storage.js';
import { PHI, RAD_TO_DEG } from './math.js';
import { view, snap, MEDIUM_VIEWPORT } from './view.js';
import { world } from './world.js';
import { clock } from './clock.js';
import { settings } from './settings.js';
import { paint } from './palette.js';
import { hitsKeepOut } from './keep-outs.js';
import { hitsCodeBlock } from './code-ticker.js';
import { telemetry } from './telemetry.js';
import { MODE_WEIGHTS, LABEL_MODE_COUNT } from './modes.js';

/** Edge annotation geometry. Text rides the line, blueprint-dimension style. */
export const MAX_EDGE_LABELS = 6;
export const EDGE_LABEL_MIN_STRENGTH = 0.13;
const EDGE_LABEL_HALF_W = 46;

const DIM_FONT = '10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

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
 * one after the first worth nothing. The kind is derived from the *pair's*
 * identity (`frac(idA + idB·φ)`), so it is stable for as long as the pair exists
 * — a dimension never mutates into a different quantity while you are reading
 * it — and neighbouring edges reliably disagree, because consecutive integers
 * land in different buckets under the golden ratio.
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
 * and at a UI-transition release rate either one snatched the number away
 * mid-read.
 */
const EDGE_LABEL_ATTACK = 1.9;
const EDGE_LABEL_RELEASE = 0.62;

// --- Slot state. One entry per slot, all pre-sized. ---
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
// four kinds of dimension, so there are four families of table.
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

/** Free every slot. Used when the population or the setting changes shape. */
export function resetEdgeSlots() {
  for (let s = 0; s < MAX_EDGE_LABELS; s++) {
    edgeSlotIdA[s] = 0;
    edgeSlotIdB[s] = 0;
    edgeSlotAlpha[s] = 0;
    edgeSlotHold[s] = 0;
    edgeSlotSeen[s] = 0;
  }
  telemetry.edgeSlots = 0;
}

/** Mark every slot unseen. The link pass then re-marks the pairs it still finds. */
export function beginEdgeLabelFrame() {
  for (let s = 0; s < MAX_EDGE_LABELS; s++) edgeSlotSeen[s] = 0;
}

/** How many slots this viewport is willing to fill. */
export function edgeSlotCapacity() {
  return view.w >= MEDIUM_VIEWPORT ? MAX_EDGE_LABELS : 2;
}

/** Does a box overlap a visible dimension caption? Used by callout placement. */
export function hitsEdgeLabel(left, top, right, bottom) {
  for (let s = 0; s < MAX_EDGE_LABELS; s++) {
    if (edgeSlotAlpha[s] <= 0.05) continue;
    if (left < edgeSlotX[s] + EDGE_LABEL_HALF_W && right > edgeSlotX[s] - EDGE_LABEL_HALF_W
      && top < edgeSlotY[s] + EDGE_LABEL_HALF_H && bottom > edgeSlotY[s] - EDGE_LABEL_HALF_H) {
      return true;
    }
  }
  return false;
}

/**
 * Keep the annotation slots pointed at edges that are worth reading.
 *
 * Called from inside the link pass for every painted edge, with values the
 * renderer has already computed. A slot follows one pair until the pair breaks
 * or its dwell expires.
 */
export function trackEdgeAnnotation(a, b, ax, ay, bx, by, distance, target, strength, cap) {
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
  if (mx < EDGE_LABEL_HALF_W || mx > view.w - EDGE_LABEL_HALF_W) return;
  if (my < EDGE_LABEL_HALF_W || my > view.h - EDGE_LABEL_HALF_W) return;
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
  edgeSlotHold[free] = clock.real + settings.dwell * MODE_WEIGHTS[free % LABEL_MODE_COUNT];
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
  edgeSlotReach[s] = clamp(Math.round(distance / Math.max(1, world.linkRadius) * 100), 0, 100);
  edgeSlotEnergy[s] = clamp(Math.round((a.energy + b.energy) * 50), 0, 100);
  edgeSlotDeltaE[s] = clamp(Math.round(Math.abs(a.energy - b.energy) * 100), 0, 100);
  edgeSlotDegrees2[s] = clamp(a.degree + b.degree, 0, DEGREE_TEXT.length - 1);
}

/**
 * Paint every live slot.
 * @param {CanvasRenderingContext2D} ctx the info canvas
 * @param {number} dt seconds since the last frame
 * @returns {number} how many were drawn, for the stats readout
 */
export function drawEdgeAnnotations(ctx, dt) {
  const attackK = 1 - Math.exp(-EDGE_LABEL_ATTACK * dt);
  const releaseK = 1 - Math.exp(-EDGE_LABEL_RELEASE * dt);
  let shown = 0;
  let held = 0;

  for (let s = 0; s < MAX_EDGE_LABELS; s++) {
    if (edgeSlotIdA[s] !== 0) held++;
    if (edgeSlotIdA[s] === 0 && edgeSlotAlpha[s] <= 0.01) continue;

    const expired = clock.real >= edgeSlotHold[s];

    // A slot that cannot be drawn where it currently sits is doing no work and
    // is holding a place another pair could use. That is not hypothetical: the
    // listing changes corner when the interface is minimised, and every
    // dimension that was happily in the top right became permanently
    // unpaintable — every slot held, nothing on screen, for as long as the
    // pairs stayed linked. Treating undrawable as dead lets the slot fade out
    // and free itself for a pair that can actually be read.
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
    ctx.strokeStyle = paint.hairline;
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
      left = RADIUS_TEXT[clamp(Math.round(world.linkRadius), 0, RADIUS_TEXT.length - 1)];
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
    ctx.fillStyle = kind === EDGE_KIND_ENERGY ? paint.accent : paint.ink;
    ctx.fillText(lead, 0, EDGE_LABEL_LEAD_BASELINE);
    // Two secondary values, two baselines. Sharing one line meant the wider
    // pairs overprinted each other; the horizontal nudge is kept so the stack
    // still reads as a dimension's two columns rather than a paragraph.
    ctx.textBaseline = 'top';
    ctx.globalAlpha = alpha * 0.8;
    ctx.fillStyle = paint.inkMuted;
    ctx.fillText(left, -18, EDGE_LABEL_ROW_TOP);
    ctx.fillText(right, 18, EDGE_LABEL_ROW_TOP + EDGE_LABEL_LINE_H);
    ctx.restore();

    shown++;
  }

  telemetry.edgeSlots = held;
  return shown;
}

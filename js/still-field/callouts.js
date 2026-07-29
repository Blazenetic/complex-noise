/**
 * Node callouts — selection, placement and paint.
 *
 * A callout is a node handle, a leader line and a plate carrying up to four
 * key/value rows. Which quantity it reads is decided by the global mode
 * rotation in `modes.js`, offset by the node's own `modeOffset`, so several
 * different quantities are on screen at once.
 *
 * **What a callout says lives in `callout-content.js`.** This file decides which
 * nodes earn one, where the block goes, and draws it; that one fills in the
 * rows. Adding a detail mode is a change to the other file, which is the point
 * of the seam — the placement hysteresis below is the most delicate code in the
 * info layer and it should not be in the diff for a new mode.
 *
 * ## Three rules that were each a bug first
 *
 * - **Timing is procedural, not an interval.** Acquisition and release use
 *   different energy gates, a callout is guaranteed a minimum hold, and opacity
 *   runs through attack/release envelopes on the *real* clock. Replace any of
 *   that with a fixed timer and the flicker it was written to remove comes back.
 * - **The energy gate has a ceiling well below 1.** With nothing playing,
 *   per-node energy tops out at 0.54 (see `energy.js`), so a gate of 0.55 made
 *   the whole layer unreachable while paused — the toggle read "on" and drew
 *   nothing, indefinitely. Keep `LABEL_ENERGY_GATE` comfortably under 0.54.
 * - **Side is hysteretic, and the hysteresis is the point.** A node remembers
 *   its block's side in `preferSide`. Deriving the side from the node's position
 *   each frame — the obvious-looking simplification — puts a threshold back in,
 *   and a node drifting around it throws a 132px plate across its own leader
 *   line several times a second.
 *
 * Everything here paints on the info canvas: no `shadowBlur`, every glyph
 * origin snapped to a whole device pixel, legibility from a plate rather than
 * a glow.
 */

import { clamp } from '../storage.js';
import { TAU } from './math.js';
import { view, surfaces, snap, WIDE_VIEWPORT, MEDIUM_VIEWPORT } from './view.js';
import { world } from './world.js';
import { clock } from './clock.js';
import { settings } from './settings.js';
import { paint, axisColors } from './palette.js';
import { telemetry } from './telemetry.js';
import { hitsKeepOut } from './keep-outs.js';
import { hitsCodeBlock } from './code-ticker.js';
import { hitsEdgeLabel } from './edge-labels.js';
import { LABEL_MODE_COUNT, HANDLE_CIRCLE, HANDLE_DIAMOND, HANDLE_CROSS, modeAt } from './modes.js';
import {
  CALLOUT_MAX_ROWS, refreshNodeCallout, resetCalloutContent,
  calloutRowKey, calloutRowValue,
} from './callout-content.js';

/**
 * Callout cap by viewport. Wider screens have room for more without the field
 * turning into a wall of text; a phone keeps the quiet original count.
 */
const MAX_LABELS = 8;
const LABEL_CAP_WIDE = 8;
const LABEL_CAP_MEDIUM = 6;
const LABEL_CAP_PHONE = 4;

/**
 * Energy a node must exceed before it earns a callout, and how far it may fall
 * before losing it. Without the gap, a node sitting on the threshold flickers
 * its label on and off — the last thing you want on a screen you are falling
 * asleep to.
 */
const LABEL_ENERGY_GATE = 0.42;
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
 * They are rates, not per-frame factors — they are run through
 * `1 - exp(-rate · dt)`, so the envelope is identical at 30, 45 and 60 fps.
 */
const LABEL_ATTACK = 1.9;
const LABEL_RELEASE = 0.52;
/** A callout, once acquired, is guaranteed this long regardless of energy. */
const LABEL_MIN_HOLD_FRACTION = 0.72;

const HEAD_FONT = '600 10px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
const MONO_FONT = '11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

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
/** Half-size of the handle glyph drawn on a node that owns a callout. */
const NODE_HANDLE = 4.5;

/**
 * Keep-out band for callout placement. The world plane is sized so the *far*
 * plane fills the viewport, which means near nodes legitimately project past
 * the edges — and those are exactly the nodes a nearest-first pick favours. An
 * off-screen callout costs a `fillText` and shows nothing, so they never become
 * candidates.
 */
const LABEL_EDGE_X = 30;
const LABEL_EDGE_Y = 20;

// Pre-sized selection and geometry (no allocation in the render loop)
const labelCandidates = new Int16Array(MAX_LABELS);
const labelScores = new Float32Array(MAX_LABELS);
const calloutNode = new Int16Array(MAX_LABELS);
const calloutLeft = new Float32Array(MAX_LABELS);
const calloutTop = new Float32Array(MAX_LABELS);
const calloutHeight = new Float32Array(MAX_LABELS);
const calloutSide = new Int8Array(MAX_LABELS);   // +1 block to the right, −1 left
const calloutAlpha = new Float32Array(MAX_LABELS);

// Per-frame coefficients, computed once by beginCalloutFrame().
let labelAttackK = 0;
let labelReleaseK = 0;
let labelHoldSeconds = 0;
let calloutsActive = false;

/** Current label cap for this viewport width. */
export function labelCapacity() {
  if (view.w >= WIDE_VIEWPORT) return LABEL_CAP_WIDE;
  if (view.w >= MEDIUM_VIEWPORT) return LABEL_CAP_MEDIUM;
  return LABEL_CAP_PHONE;
}

/** Clear every callout field on a node. A respawned node is a new node. */
export function resetNodeCallout(n) {
  n.labelAlpha = 0;
  n.labelHeld = false;
  n.labelHoldUntil = 0;
  // A respawned node respawns somewhere else entirely, so the side its
  // predecessor settled on says nothing useful about this one.
  n.preferSide = 1;
  resetCalloutContent(n);
}

/**
 * Compute this frame's envelope coefficients once, rather than the same
 * exponential 150 times.
 *
 * The envelopes run on the real clock, not the drift clock: how long a readout
 * stays legible is a property of the reader, not of the simulation's speed.
 *
 * @param {number} dt seconds since the last frame
 */
export function beginCalloutFrame(dt) {
  labelAttackK = 1 - Math.exp(-LABEL_ATTACK * dt);
  labelReleaseK = 1 - Math.exp(-LABEL_RELEASE * dt);
  labelHoldSeconds = settings.dwell * LABEL_MIN_HOLD_FRACTION;
  calloutsActive = settings.nerd && settings.callouts;
}

/**
 * Advance one node's hold and opacity. Called from the simulation step, because
 * it is a per-node envelope like the lifecycle fade rather than a paint.
 *
 * `labelAlpha` is driven toward 0 here and lifted back up by `drawCallouts()`
 * for the nodes it actually draws, so a node that qualifies but loses the
 * placement contest fades out instead of vanishing.
 */
export function updateNodeCalloutHold(node) {
  if (calloutsActive) {
    const keepGate = node.labelHeld ? LABEL_ENERGY_GATE - LABEL_ENERGY_RELEASE : LABEL_ENERGY_GATE;
    const qualifies = node.fade > 0 && node.energy > keepGate;
    if (qualifies && !node.labelHeld) {
      node.labelHeld = true;
      node.labelHoldUntil = clock.real + labelHoldSeconds;
    } else if (!qualifies && node.labelHeld && clock.real >= node.labelHoldUntil) {
      node.labelHeld = false;
    }
  } else if (node.labelHeld) {
    node.labelHeld = false;
  }
  node.labelAlpha += (0 - node.labelAlpha) * labelReleaseK;
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
 * time two nodes swap depth by a hair.
 *
 * @returns {number} how many callouts were drawn, for the stats readout
 */
export function drawCallouts(ctx, nodes, n) {
  const maxLabels = labelCapacity();
  const baseMode = modeAt(clock.real);

  // --- Selection -------------------------------------------------------
  let count = 0;
  for (let i = 0; i < n; i++) {
    const node = nodes[i];
    if (!node.labelHeld || node.fade <= 0) continue;
    if (node.sx < LABEL_EDGE_X || node.sx > view.w - LABEL_EDGE_X) continue;
    if (node.sy < LABEL_EDGE_Y || node.sy > view.h - LABEL_EDGE_Y) continue;

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
    telemetry.modesOnScreen = 0;
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
    // drifting around `view.w - CALLOUT_W - 26` crossed that threshold every
    // few frames and threw a 132px block back and forth across its own leader
    // line, several times a second, on the screen you are falling asleep to.
    // With a remembered side there is no threshold to oscillate about: once a
    // node has flipped left, left keeps working, so it stays there until it
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
      if (tryLeft < 8 || tryLeft + CALLOUT_W > view.w - 8) continue;
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
    if (!collides && hitsEdgeLabel(left, top, left + CALLOUT_W, top + height)) collides = true;
    if (collides) continue;

    // Winning the contest is what lifts the opacity envelope; the simulation
    // step pulls every node's envelope down, so losing it fades out rather
    // than cutting.
    node.labelAlpha += (1 - node.labelAlpha) * labelAttackK;
    const nearness = (node.scale - world.minScale) / (1 - world.minScale);
    const alpha = clamp(0.55 + nearness * 0.4, 0, 0.96) * node.labelAlpha * node.fade;
    if (alpha < 0.02) continue;

    // Only a placement that actually drew commits the side. Recording it at the
    // point of choice instead would let a block that then lost a collision test
    // move the node's preference on the strength of a frame nobody saw.
    if (side !== node.preferSide && node.labelAlpha > 0.15) telemetry.calloutFlips++;
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
  telemetry.modesOnScreen = distinct;

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
    ctx.fillStyle = paint.accent;
    ctx.fillText(node.calloutHead, snap(calloutLeft[k] + CALLOUT_PAD_X), snap(calloutTop[k] + CALLOUT_PAD_Y));
  }

  ctx.font = MONO_FONT;
  for (let k = 0; k < placed; k++) {
    const node = nodes[calloutNode[k]];
    const left = calloutLeft[k];
    const alpha = calloutAlpha[k];
    let y = calloutTop[k] + CALLOUT_PAD_Y + CALLOUT_HEAD_H;

    for (let row = 0; row < node.calloutRows; row++) {
      const key = calloutRowKey(node, row);
      const value = calloutRowValue(node, row);

      ctx.globalAlpha = alpha * 0.9;
      // Axis colouring only ever covers the first three rows: X, Y, Z is the
      // convention, and a fourth axis colour would be inventing one.
      ctx.fillStyle = node.calloutAxis && row < 3 ? axisColors[row] : paint.inkMuted;
      ctx.textAlign = 'left';
      ctx.fillText(key, snap(left + CALLOUT_PAD_X), snap(y));

      ctx.globalAlpha = alpha;
      ctx.fillStyle = paint.ink;
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
    ctx.fillStyle = paint.plate;
    ctx.beginPath();
    if (surfaces.hasRoundRect) ctx.roundRect(snap(left), snap(top), CALLOUT_W, height, 5);
    else ctx.rect(snap(left), snap(top), CALLOUT_W, height);
    ctx.fill();

    ctx.globalAlpha = alpha * 0.55;
    ctx.strokeStyle = paint.hairline;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Accent spine on the leading edge, and a rule under the head. "Leading"
    // means the edge the leader line arrives at, which is the right-hand edge
    // on a mirrored block — pinning it to `left` regardless put the spine on
    // the far side of the plate from its own leader, so a left-side callout
    // read as if it belonged to whatever was further left again.
    ctx.globalAlpha = alpha * 0.9;
    ctx.fillStyle = paint.accent;
    ctx.fillRect(snap(side > 0 ? left : left + CALLOUT_W - 2), snap(top + 4), 2, height - 8);
    ctx.globalAlpha = alpha * 0.28;
    ctx.fillRect(snap(left + CALLOUT_PAD_X), snap(top + CALLOUT_PAD_Y + CALLOUT_HEAD_H - 3), CALLOUT_W - CALLOUT_PAD_X * 2, 1);

    // Gauge, when the mode has a naturally bounded quantity to show.
    if (node.calloutGauge >= 0) {
      const gy = top + height - CALLOUT_PAD_Y - CALLOUT_GAUGE_H + 1;
      const gw = CALLOUT_W - CALLOUT_PAD_X * 2;
      ctx.globalAlpha = alpha * 0.22;
      ctx.fillStyle = paint.inkMuted;
      ctx.fillRect(snap(left + CALLOUT_PAD_X), snap(gy), gw, 2);
      ctx.globalAlpha = alpha * 0.85;
      ctx.fillStyle = paint.accent;
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
    ctx.strokeStyle = paint.accent;
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

/** One stroked glyph, centred on `(x, y)`. See MODE_HANDLE in modes.js. */
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

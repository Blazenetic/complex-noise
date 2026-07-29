/**
 * What a node callout *says* — the eight detail modes and the row cache.
 *
 * This module knows nothing about where a callout is placed or how it is
 * painted. It is handed a node and a mode index and it fills the node's cached
 * row strings; `callouts.js` decides which nodes get one, where the block goes,
 * and draws it.
 *
 * That seam exists because the three jobs fail differently. Adding a detail mode
 * is a content change with no geometry in it, and it should not put the
 * placement hysteresis — the most delicate code in the info layer — into the
 * diff for review.
 *
 * ## The cadence is the budget
 *
 * Rows are refreshed at most once a second (`VALUE_REFRESH_S`) and cached on the
 * node, so a 60 fps canvas builds sixty times fewer strings than it draws
 * frames. Everything below therefore *may* build strings; nothing that runs per
 * frame may. Keep new modes inside `refreshNodeCallout` and the budget holds
 * itself.
 *
 * ## Rows, not a packed line
 *
 * Each mode emits key/value pairs rather than one string. That is what lets the
 * transform mode read like a transform panel — axis letter in its axis colour on
 * the left, value right-aligned in a monospaced column on the right — instead of
 * `xyz 124, -33, 0.42`, which asks the reader to count commas.
 *
 * **Adding a mode**: add the name and glyph in `modes.js`, then a branch here.
 * Up to four rows; only the first three can be axis-coloured.
 */

import { RAD_TO_DEG } from './math.js';
import { world } from './world.js';
import { clock, VALUE_REFRESH_S } from './clock.js';
import { telemetry } from './telemetry.js';
import { nodeWavePhase, WAVE_KX, WAVE_KY } from './energy.js';
import { MODE_HANDLE, HANDLE_SQUARE } from './modes.js';

/** Most key/value rows any one detail mode prints. */
export const CALLOUT_MAX_ROWS = 4;

/**
 * Clear the cached content on a node. A respawned node is a new node, and a
 * callout that survived into it would be describing the wrong thing.
 *
 * The placement fields (`preferSide`, the opacity envelope) are reset by
 * `callouts.js`, which owns them.
 */
export function resetCalloutContent(n) {
  n.labelMode = -1;
  n.labelNextUpdate = 0;
  n.calloutHead = '';
  n.calloutRows = 0;
  n.calloutAxis = false;
  n.calloutGauge = -1;
  n.calloutHandle = HANDLE_SQUARE;
}

/**
 * Refresh a node's callout rows, at most once per `VALUE_REFRESH_S`.
 *
 * A mode change refreshes immediately regardless of the cadence — the rotation
 * has just changed what the block claims to be showing, and a second of the
 * previous quantity under the new heading is worse than no cadence at all.
 *
 * @param {object} node
 * @param {number} mode index into LABEL_MODE_NAMES
 */
export function refreshNodeCallout(node, mode) {
  if (node.labelMode === mode && clock.real < node.labelNextUpdate) return;

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
    node.rowKey3 = 'a'; node.rowVal3 = telemetry.probeAudio.toFixed(3);
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
    node.rowKey2 = 'near'; node.rowVal2 = `${Math.round((node.scale - world.minScale) / (1 - world.minScale) * 100)}%`;
    node.rowKey3 = 'px'; node.rowVal3 = `${Math.round(node.sx)}, ${Math.round(node.sy)}`;
    node.calloutRows = 4;
    node.calloutGauge = (node.scale - world.minScale) / (1 - world.minScale);
  } else if (mode === 4) {
    const phase = nodeWavePhase(node);
    node.calloutHead = `${id}  WAVE`;
    node.rowKey0 = 'ψ'; node.rowVal0 = `${Math.round(phase * RAD_TO_DEG)}°`;
    node.rowKey1 = 'k·p'; node.rowVal1 = (node.x * WAVE_KX + node.y * WAVE_KY).toFixed(2);
    node.rowKey2 = 'sin ψ'; node.rowVal2 = Math.sin(phase).toFixed(3);
    node.calloutRows = 3;
    node.calloutGauge = 0.5 + 0.5 * Math.sin(phase);
  } else if (mode === 5) {
    // Everything here was accumulated inside the link pass on values the
    // renderer had already computed — see the note there.
    node.calloutHead = `${id}  LINKS`;
    node.rowKey0 = 'deg'; node.rowVal0 = String(node.degree);
    node.rowKey1 = 'κ'; node.rowVal1 = node.coupling.toFixed(2);
    node.rowKey2 = 'near'; node.rowVal2 = node.nearest > 0 ? `${Math.round(node.nearest)} u` : '—';
    node.rowKey3 = 'r'; node.rowVal3 = `${Math.round(world.linkRadius)} u`;
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
  node.labelNextUpdate = clock.real + VALUE_REFRESH_S;
}

/**
 * Read row `row` of a node's cached content.
 *
 * The cache is four flat pairs rather than an array, so that a node keeps one
 * hidden class and the draw pass allocates nothing. These two accessors are what
 * keeps that layout a detail of this file: the paint loop asks for a row, it does
 * not know the rows are called `rowKey0`…`rowKey3`. At most four rows on at most
 * eight blocks, once a frame, so the indirection is not on any hot path worth
 * naming.
 */
export function calloutRowKey(node, row) {
  return row === 0 ? node.rowKey0 : row === 1 ? node.rowKey1
    : row === 2 ? node.rowKey2 : node.rowKey3;
}

export function calloutRowValue(node, row) {
  return row === 0 ? node.rowVal0 : row === 1 ? node.rowVal1
    : row === 2 ? node.rowVal2 : node.rowVal3;
}

/** Blender prints world coordinates with a unit and a sign column. So do we. */
function formatAxis(v) {
  return `${v >= 0 ? ' ' : ''}${v.toFixed(1)} u`;
}

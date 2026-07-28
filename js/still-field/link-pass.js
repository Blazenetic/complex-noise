/**
 * The link pass — the lattice, and everything measured from it.
 *
 * This is the most expensive stage of the frame and the one that earns the
 * most. Four things happen in a single walk of the spatial grid, and they share
 * it deliberately:
 *
 * 1. **Pair finding.** Only the 5-cell half-neighbourhood is visited, so the
 *    pair count is roughly linear in the population rather than quadratic. Both
 *    the real and the would-be brute-force counts are reported to the HUD, so
 *    the claim is checked rather than asserted.
 * 2. **Envelopes.** A link's strength eases toward its distance-derived target;
 *    the *gap* between the two is the arrival transient, so the pulse falls out
 *    of the envelope with no extra state and no extra pass.
 * 3. **Batching.** Alpha and width are quantised to steps well below the visual
 *    threshold, so consecutive edges — which the grid hands over in spatial
 *    order, sharing depth and energy — routinely land on the same key and
 *    accumulate into one path.
 * 4. **Graph telemetry and edge dimensions**, both gathered from values already
 *    computed here. A second O(n²) scan, sorting by strength, or building an
 *    edge list would turn an information feature into an overnight battery
 *    regression.
 *
 * The sharp edge to remember: a pair that stops being visited freezes its
 * envelope at whatever strength it held. Anything that moves a node
 * discontinuously has to clear its links — see `nodes.js`.
 */

import { clamp } from '../storage.js';
import { world } from './world.js';
import { settings } from './settings.js';
import { edgePalette, paint, COLOR_STEPS } from './palette.js';
import { grid, NEIGHBOUR_DX, NEIGHBOUR_DY } from './grid.js';
import { population } from './nodes.js';
import { telemetry } from './telemetry.js';
import {
  trackEdgeAnnotation, beginEdgeLabelFrame, edgeSlotCapacity, EDGE_LABEL_MIN_STRENGTH,
} from './edge-labels.js';

/** Link envelope rates (per second) — links arrive briskly and leave slowly. */
const LINK_ATTACK = 3.2;
const LINK_RELEASE = 1.1;
/** How much of a new link's brightness comes from the arrival transient. */
const LINK_PULSE_GAIN = 0.9;
/** Below this, a link is invisible and not worth stroking. */
const LINK_EPSILON = 0.004;

/**
 * Edge batching quantisation. Alpha to 1/64 and width to 1/8 px are both well
 * under the threshold where a change is visible on a hairline, so rounding to
 * them costs nothing and lets neighbouring edges share a path.
 */
const BATCH_ALPHA_STEPS = 64;
const BATCH_WIDTH_STEPS = 8;

/** The link envelope's attack coefficient for the last frame, for the HUD. */
export const LINK_ATTACK_RATE = LINK_ATTACK;

/**
 * @param {CanvasRenderingContext2D} ctx the field canvas
 * @param {Array<object>} nodes
 * @param {number} n
 * @param {number} adt animation timestep, in seconds
 */
export function drawLinks(ctx, nodes, n, adt) {
  const linkState = population.links;
  const linkRadius = world.linkRadius;
  const zWorld = world.zWorld;
  const r2 = linkRadius * linkRadius;
  const invR = 1 / linkRadius;

  // Envelope coefficients depend only on the timestep, so they are computed
  // once per frame rather than once per pair.
  const attackK = 1 - Math.exp(-LINK_ATTACK * adt);
  const releaseK = 1 - Math.exp(-LINK_RELEASE * adt);
  const edgeAlphaScale = paint.edgeAlpha * (0.5 + settings.intensity * 0.9);

  let drawn = 0;
  let tests = 0;
  let batches = 0;
  let batchKey = -1;
  let pathOpen = false;

  const collectEdges = settings.nerd;
  if (collectEdges) beginEdgeLabelFrame();
  const trackDimensions = collectEdges && settings.edges;
  const edgeCap = edgeSlotCapacity();
  let sampleTaken = false;
  let maxDegree = 0;

  const { cols, rows, counts, start, items } = grid;
  const cells = cols * rows;
  for (let c = 0; c < cells; c++) {
    const startA = start[c];
    const endA = startA + counts[c];
    if (startA === endA) continue;
    const cellX = c % cols;
    const cellY = (c / cols) | 0;

    for (let nb = 0; nb < 5; nb++) {
      const nx = cellX + NEIGHBOUR_DX[nb];
      const ny = cellY + NEIGHBOUR_DY[nb];
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      const c2 = ny * cols + nx;
      const startB = start[c2];
      const endB = startB + counts[c2];
      if (startB === endB) continue;

      for (let p = startA; p < endA; p++) {
        const i = items[p];
        const a = nodes[i];
        if (a.fade <= 0) continue;

        // Within one cell each unordered pair must be visited once, so the
        // partner scan starts after the current item. Across cells the whole
        // partner cell is fair game, because the neighbour offsets only ever
        // point at cells that have not yet been the source.
        const from = nb === 0 ? p + 1 : startB;
        for (let q = from; q < endB; q++) {
          const j = items[q];
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
            telemetry.sampleDistance = distance;
            telemetry.sampleTarget = target;
            telemetry.sampleStrength = strength;
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

  telemetry.edges = drawn;
  telemetry.pairTests = tests;
  telemetry.batches = batches;
  telemetry.maxDegree = maxDegree;
}

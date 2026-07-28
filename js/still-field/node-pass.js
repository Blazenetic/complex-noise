/**
 * The node pass — every node drawn onto the field canvas.
 *
 * Two passes over the population, and the split is a performance decision:
 * `shadowBlur` is the single most expensive thing on this canvas, and setting
 * it is a pipeline change on most canvas backends. So everything is drawn flat
 * first, and only the few highest-energy nodes are drawn again with a glow.
 *
 * The subtlety that has already caused one bug: **the glow pass is not
 * guaranteed to run.** It stops at `MAX_GLOW_NODES` and is skipped entirely
 * under `prefers-reduced-motion`, so anything deferred to it unconditionally is
 * deferred into nothing and the brightest nodes vanish from the field. Pass 0
 * therefore records what it deferred, and defers only what pass 1 will really
 * reach.
 */

import { clamp } from '../storage.js';
import { TAU } from './math.js';
import { view } from './view.js';
import { world } from './world.js';
import { settings } from './settings.js';
import { paint, nodePalette, COLOR_STEPS } from './palette.js';
import { telemetry } from './telemetry.js';

/** Only the highest-energy nodes glow, and never more than this many. */
const GLOW_THRESHOLD = 0.52;
export const MAX_GLOW_NODES = 10;

/** Nodes pass 0 deferred to the glow pass, so pass 1 never rescans the field. */
const glowQueue = new Int16Array(MAX_GLOW_NODES);
let glowQueueLength = 0;

/**
 * @param {CanvasRenderingContext2D} ctx the field canvas
 * @param {Array<object>} nodes
 * @param {number} n
 */
export function drawNodes(ctx, nodes, n) {
  const intensity = settings.intensity;
  const minScale = world.minScale;
  const alphaScale = paint.nodeAlpha * (0.55 + intensity * 0.45);
  const radiusScale = 0.85 + intensity * 0.25;
  const reducedMotion = view.reducedMotion;
  let glowed = 0;

  ctx.shadowBlur = 0;

  for (let pass = 0; pass < 2; pass++) {
    if (pass === 1) {
      if (reducedMotion || glowQueueLength === 0) break;
      ctx.shadowColor = paint.glow;
    }

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
  telemetry.glowNodes = glowed;
}

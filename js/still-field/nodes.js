/**
 * The node population: the model, its lifecycle, and one simulation step.
 *
 * Nodes drift through a shallow perspective volume, gently coming toward the
 * viewer and receding again. They are born, live, and fade out; when one fades,
 * the lines attached to it retract into their surviving partners rather than
 * blinking off.
 *
 * ## Three things here have teeth
 *
 * - **Motion is integrated from elapsed time, never counted in frames.** The
 *   frame cap is a user setting (30/45/60), so anything expressed as "x per
 *   frame" silently changes meaning when the cap moves. Damping and smoothing
 *   are written as `1 - exp(-rate · dt)`.
 * - **A node that moves discontinuously must forget its links.** Linking is a
 *   spatial grid, so only pairs inside the 5-cell half-neighbourhood are
 *   visited; a pair that stops being visited freezes its envelope at whatever
 *   strength it held. That is why `clearLinksFor()` is called on respawn and on
 *   world wrap, and why a resize drops link state wholesale.
 * - **Every node is created by one object literal.** One shape means one hidden
 *   class, and a monomorphic property load in the four passes that read these
 *   150 objects thirty times a second. Adding a field means adding it to
 *   `makeNode()`, not to a node.
 */

import { PHI, TAU, smoothstep } from './math.js';
import { view, surfaces, measureViewport } from './view.js';
import { settings } from './settings.js';
import { world, targetNodeCount, measureWorld, WORLD_MARGIN } from './world.js';
import { buildGrid } from './grid.js';
import { telemetry } from './telemetry.js';
import { computeNodeEnergy, nodeWavePhase } from './energy.js';
import { LABEL_MODE_COUNT, HANDLE_SQUARE } from './modes.js';
import { resetNodeCallout, updateNodeCalloutHold } from './callouts.js';
import { resetEdgeSlots } from './edge-labels.js';

/**
 * Strides of the R2 low-discrepancy sequence (Roberts, 2018), generated from
 * the plastic number g ≈ 1.3247. Successive points fill a rectangle far more
 * evenly than `Math.random()`, which clumps — spawning a replacement node at
 * `frac(a · i)` keeps the field's coverage balanced without any repulsion pass.
 * The third stride carries depth.
 */
const R2_A1 = 0.7548776662466927; // 1/g
const R2_A2 = 0.5698402909980532; // 1/g²
const R2_A3 = 0.4301597090052419; // 1/g³

/** Node lifetime range in seconds, before the speed multiplier. */
const LIFE_MIN_S = 70;
const LIFE_MAX_S = 150;
/** Fractions of a lifetime spent fading in and out. */
const FADE_IN = 0.1;
const FADE_OUT = 0.16;

/**
 * Depth choreography.
 *
 * The first version gave each node a widely distributed depth centre but only
 * a 0.06–0.16 local excursion. The volume was mathematically three-dimensional,
 * yet an individual node changed scale so little that its motion often read as
 * flat. Keep the same bounded sinusoid and pinhole camera, but let every node
 * cross most of the volume. A narrow spread around the midpoint prevents the
 * paths feeling mechanically identical; the amplitude bounds guarantee no
 * path reaches either camera plane, so there is no clamp plateau at a turn.
 */
const DEPTH_BASE_MIN = 0.47;
const DEPTH_BASE_SPAN = 0.06;
const DEPTH_AMP_MIN = 0.34;
const DEPTH_AMP_SPAN = 0.08;
const DEPTH_RATE_MIN = 0.055;
const DEPTH_RATE_SPAN = 0.05;

/**
 * The population, and the link strengths between its members.
 *
 * `links` is `[i · n + j]` for `i < j`, a dense triangle stored as a square
 * because the index arithmetic is one multiply and the memory is 90 KB at the
 * maximum population — cheaper than any structure that would need allocating.
 */
export const population = {
  /** @type {Array<object>} */
  nodes: [],
  links: new Float32Array(0),
};

/** Granularity the link buffer grows in. See `ensureLinkCapacity`. */
const LINK_CAPACITY_STEP = 16;

/**
 * Size the link buffer for `count` nodes, and clear it.
 *
 * **The buffer only ever grows.** Every caller wants the strengths dropped
 * anyway — the index space changes shape when the population does, so carrying
 * old values into new pairs is worse than a brief re-attack nobody can see —
 * which means the choice is between a fresh array and a `fill(0)`, and only one
 * of those is garbage.
 *
 * That matters because the population is a live control. Sweeping the density
 * slider from end to end at 1440×900 walks 35 distinct node counts, and each one
 * used to allocate its own `Float32Array(n²)`: measured at **35 allocations
 * totalling about 550 KB, on every drag**, from `input` events that fire at
 * pointer-move rate. It is not in the render loop, so it was never a frame
 * cost — it is simply garbage produced by dragging a slider, which is the kind
 * of thing a phone pays for later.
 *
 * The buffer is therefore high-water-marked, and grows in **bands** rather than
 * to the exact figure. Growing exactly still allocates on every *rising* step —
 * the measured sweep only went from 35 allocations to 24, which is not much of a
 * fix — because each new count needs one more row than the last. Rounding up to
 * the next `LINK_CAPACITY_STEP` means any drag inside a band is free: the same
 * sweep now costs four allocations, and every later drag costs none.
 *
 * What that buys is bounded by the band. The waste is `banded² − count²` floats,
 * so it is largest just above a boundary — about 18 KB near the top of the
 * range, less everywhere below it.
 *
 * `population.links.byteLength` is what the HUD's Buffers row reports, so that
 * figure now means "held" rather than "in use". That is the more honest of the
 * two readings for a row about buffers, and it is the one that shows this trade
 * rather than hiding it.
 */
function ensureLinkCapacity(count) {
  const needed = count * count;
  if (population.links.length < needed) {
    const banded = Math.ceil(count / LINK_CAPACITY_STEP) * LINK_CAPACITY_STEP;
    population.links = new Float32Array(banded * banded);
  } else {
    population.links.fill(0);
  }
}

let spawnIndex = 0;   // drives the R2 sequence
let nodeSerial = 0;   // lifetime IDs, never reused

function makeNode() {
  return {
    id: 0, seed: 0, u: 0, v: 0, modeOffset: 0,
    x: 0, y: 0, z: 0, zBase: 0, zAmp: 0, zRate: 0, zPhase: 0,
    vx: 0, vy: 0, phase: 0, phaseRate: 0,
    life: 0, lifeRate: 0, energy: 0,
    // Graph telemetry, gathered inside the existing link pass — never by a
    // second scan. Reset at the top of the step, accumulated in the link pass.
    degree: 0, coupling: 0, nearest: 0,
    // Callout state. Rows are key/value pairs so the block can right-align its
    // numbers the way a transform panel does, rather than printing one string.
    // The meaning of these lives in callout-content.js; the shape lives here.
    labelMode: -1, labelNextUpdate: 0, labelAlpha: 0,
    labelHeld: false, labelHoldUntil: 0,
    calloutHead: '', calloutRows: 0, calloutAxis: false, calloutGauge: -1,
    calloutHandle: HANDLE_SQUARE,
    // Which side of the node this one's block prefers to sit on, +1 right and
    // −1 left. Remembered across frames so placement is hysteretic.
    preferSide: 1,
    rowKey0: '', rowKey1: '', rowKey2: '', rowKey3: '',
    rowVal0: '', rowVal1: '', rowVal2: '', rowVal3: '',
    // Scratch fields, written during the step and read during draw. Keeping
    // them on the node is what lets the draw passes allocate nothing.
    sx: 0, sy: 0, scale: 0, fade: 0,
  };
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
  if (!seeded) telemetry.respawns++;

  // World coordinates are centred on the origin; the camera sits on the axis.
  n.seed = i;
  n.u = (0.5 + R2_A1 * i) % 1;
  n.v = (0.5 + R2_A2 * i) % 1;
  n.x = (n.u - 0.5) * world.w;
  n.y = (n.v - 0.5) * world.h;

  // Which detail mode this node is offset to. Derived from the lifetime ID
  // through the golden ratio, so consecutive IDs land far apart and the eight
  // callouts on a wide screen are reliably reading eight different quantities.
  n.modeOffset = Math.min(
    LABEL_MODE_COUNT - 1,
    ((n.id * PHI) % 1) * LABEL_MODE_COUNT | 0,
  );

  // Every node now makes a long, calm traverse instead of breathing inside one
  // shallow depth band. The low-discrepancy centre, irrational amplitude and
  // independent phase keep the field distributed rather than synchronised.
  n.zBase = DEPTH_BASE_MIN + ((0.5 + R2_A3 * i) % 1) * DEPTH_BASE_SPAN;
  n.zAmp = DEPTH_AMP_MIN + ((i * PHI) % 1) * DEPTH_AMP_SPAN;
  n.zRate = DEPTH_RATE_MIN + ((i * R2_A2) % 1) * DEPTH_RATE_SPAN;
  n.zPhase = ((i * R2_A1) % 1) * TAU;
  n.z = n.zBase + Math.sin(n.zPhase) * n.zAmp;

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

/** Forget every link touching node `index` — a respawned node is a new node. */
export function clearLinksFor(index) {
  const n = population.nodes.length;
  const links = population.links;
  const base = index * n;
  for (let j = 0; j < n; j++) {
    if (j === index) continue;
    links[base + j] = 0;
    links[j * n + index] = 0;
  }
}

/**
 * (Re)seed the field. `force = true` discards existing positions.
 * @param {boolean} [force=false]
 */
export function initNodes(force = false) {
  if (population.nodes.length && !force) return;

  const count = targetNodeCount();
  const nodes = new Array(count);
  spawnIndex = 0;

  for (let i = 0; i < count; i++) {
    const n = makeNode();
    respawnNode(n, true);
    nodes[i] = n;
  }
  population.nodes = nodes;
  ensureLinkCapacity(count);

  resetEdgeSlots();
  measureWorld(count);
  telemetry.nodes = count;
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
export function applyNodeCount() {
  const target = targetNodeCount();
  const current = population.nodes.length;
  if (target === current || current === 0) return;

  if (target > current) {
    for (let i = current; i < target; i++) {
      const n = makeNode();
      respawnNode(n);
      population.nodes.push(n);
    }
  } else {
    population.nodes.length = target;
  }

  ensureLinkCapacity(target);
  resetEdgeSlots();
  measureWorld(target);
  telemetry.nodes = target;
}

/**
 * Handle a viewport change: resize the canvases, re-derive the world, and keep
 * the population coherent inside it.
 */
export function resizeField() {
  if (!surfaces.field) return;
  const prevW = world.w;
  const prevH = world.h;

  measureViewport();
  measureWorld(population.nodes.length);

  if (population.nodes.length === 0) {
    initNodes();
  } else if (prevW > 0 && prevH > 0) {
    // Rescale rather than re-seed: on phones the address bar shows and hides
    // constantly, and re-seeding would teleport every node mid-session.
    const sx = world.w / prevW;
    const sy = world.h / prevH;
    if (sx !== 1 || sy !== 1) {
      for (const n of population.nodes) {
        n.x *= sx;
        n.y *= sy;
      }
      // A rescale moves every node at once, and an aspect-ratio change moves
      // them relative to one another. That is precisely the discontinuity the
      // spatial grid cannot see: a pair that leaves the visited
      // half-neighbourhood is never tested again, so its envelope freezes at
      // whatever strength it last held — a line that stays lit between two
      // nodes that are no longer near each other. Dropping every strength
      // costs one re-attack nobody can see, on an event that is already
      // debounced to 150 ms.
      population.links.fill(0);
    }
  }

  // A viewport change can move the node target (the world plane is derived from
  // it), so honour the new count rather than waiting for a settings change.
  applyNodeCount();
}

/**
 * Advance every node by one timestep, then rebuild the spatial grid.
 *
 * @param {number} adt animation timestep — real seconds × the speed setting
 * @param {number} dt real seconds, for anything a reader experiences
 * @param {number} audioBoost 0–1 audio energy shared by every node
 * @param {number} audioOverall 0–1 broadband level, which drives the jitter
 * @param {boolean} collectGraph whether the link pass will gather telemetry
 */
export function stepNodes(adt, dt, audioBoost, audioOverall, collectGraph) {
  const nodes = population.nodes;
  const n = nodes.length;
  const halfW = world.w / 2;
  const halfH = world.h / 2;
  const cx = view.w / 2;
  const cy = view.h / 2;
  const depth = settings.depth;

  // Damping as a continuous rate rather than a per-frame factor, so the drift
  // settles identically at any frame rate.
  const damp = Math.exp(-0.55 * adt);
  const jitter = 14 * (0.35 + audioOverall * 1.1);
  telemetry.jitter = jitter;

  let bestEnergy = -1;

  for (let i = 0; i < n; i++) {
    const node = nodes[i];

    // Graph telemetry is only accumulated when something is going to read it,
    // and it is always accumulated inside the link pass. Zeroing it here is the
    // whole cost outside that pass.
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
    // node to the far side, so its links have to go with it.
    let wrapped = false;
    if (node.x < -halfW - WORLD_MARGIN) { node.x = halfW + WORLD_MARGIN; wrapped = true; }
    else if (node.x > halfW + WORLD_MARGIN) { node.x = -halfW - WORLD_MARGIN; wrapped = true; }
    if (node.y < -halfH - WORLD_MARGIN) { node.y = halfH + WORLD_MARGIN; wrapped = true; }
    else if (node.y > halfH + WORLD_MARGIN) { node.y = -halfH - WORLD_MARGIN; wrapped = true; }
    if (wrapped) clearLinksFor(i);

    // Depth is a bounded sinusoid rather than an integrated velocity: nodes
    // drift toward the viewer and back without any chance of escaping the
    // volume over an eight-hour night. The spawn-time bounds keep the entire
    // curve inside the planes, avoiding the stationary shelf a clamp would
    // create at either turn.
    node.zPhase += node.zRate * adt;
    node.z = node.zBase + Math.sin(node.zPhase) * node.zAmp;

    node.phase += node.phaseRate * adt;
    node.energy = computeNodeEnergy(node, audioBoost);

    // Project once, here, and reuse in the edge, node and callout passes.
    node.scale = 1 / (1 + node.z * depth);
    node.sx = cx + node.x * node.scale;
    node.sy = cy + node.y * node.scale;

    updateNodeCalloutHold(node);

    if (node.fade > 0 && node.energy > bestEnergy) {
      bestEnergy = node.energy;
      telemetry.probeId = node.id;
      telemetry.probeZ = node.z;
      telemetry.probeScale = node.scale;
      telemetry.probeEnergy = node.energy;
      telemetry.probeBreath = 0.5 + 0.5 * Math.sin(node.phase);
      telemetry.probeWave = 0.5 + 0.5 * Math.sin(nodeWavePhase(node));
    }
  }

  telemetry.nodes = n;
  buildGrid(nodes, n, halfW + WORLD_MARGIN, halfH + WORLD_MARGIN);
}

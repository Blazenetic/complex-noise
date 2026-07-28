/**
 * The world plane, and everything derived from it.
 *
 * Nodes live in world coordinates centred on the origin and are projected to
 * the screen through a pinhole camera of focal length 1:
 *
 *     scale(z) = 1 / (1 + z · depth)
 *
 * with `z` running 0 (nearest) to 1 (furthest), so the near plane draws at 1.0
 * and the far plane at `minScale = 1/(1 + depth)`. At the default depth of 0.75
 * that is a 1.75× size ratio across the volume — enough to read as depth, not
 * enough to look like a flying-through-space screensaver.
 *
 * The world is *larger* than the viewport by exactly that shrink factor, so a
 * node sitting at maximum depth still projects to the screen edge instead of
 * leaving a bare border.
 */

import { settings } from './settings.js';
import { view } from './view.js';
import { allocateGrid } from './grid.js';

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

/** How far past the world plane a node may wander before it wraps. */
export const WORLD_MARGIN = 40;

/** The world plane and the projection derived from the depth setting. */
export const world = {
  w: 0,
  h: 0,
  /** Scale of the far plane. Everything nearer draws between this and 1. */
  minScale: 1 / (1 + settings.depth),
  /** Link radius, in world units. */
  linkRadius: 0,
  /** World units a full depth traverse is worth when measuring link distance. */
  zWorld: 0,
};

/**
 * How many nodes this viewport should carry.
 *
 * The viewport-derived count is clamped to the original 26–44 window *first*,
 * and the density multiplier applies to that. Applying density to the raw area
 * figure instead would have made a 1440×900 display open on 132 nodes at the
 * default setting — a different-looking field for everybody who never touches
 * the Lab. Density is an opt-in, not a silent redesign.
 */
export function targetNodeCount() {
  const area = (view.w * view.h) / (world.minScale * world.minScale);
  const base = Math.min(BASE_MAX_NODES, Math.max(BASE_MIN_NODES, Math.floor(area / AREA_PER_NODE)));
  return Math.min(MAX_NODES, Math.max(MIN_NODES, Math.round(base * settings.density)));
}

/**
 * Recompute the world plane, the link radius and the spatial grid.
 *
 * Call after anything that moves them: a resize, a depth, reach, intensity or
 * density change, or a change in population.
 *
 * @param {number} populationCount live nodes, or 0 before the field is seeded
 */
export function measureWorld(populationCount) {
  world.minScale = 1 / (1 + settings.depth);
  world.w = view.w / world.minScale;
  world.h = view.h / world.minScale;

  // Derive the link radius from the mean spacing between nodes rather than
  // fixing it in pixels: the expected number of neighbours inside radius r is
  // π·(r/spacing)² − 1, so tying r to spacing keeps a phone and a desktop at the
  // same ≈3 connections per node instead of a dense mesh on one and dust on the
  // other. The Field Lab's reach multiplier rides on top of that invariant, so
  // raising the node count does not thicken the mesh on its own.
  const count = Math.max(1, populationCount || targetNodeCount());
  const spacing = Math.sqrt((world.w * world.h) / count);
  world.linkRadius = spacing * (0.8 + settings.intensity * 0.5) * settings.reach;
  world.zWorld = spacing * 1.1;

  allocateGrid(
    world.w + WORLD_MARGIN * 2,
    world.h + WORLD_MARGIN * 2,
    world.linkRadius,
    populationCount,
  );
}

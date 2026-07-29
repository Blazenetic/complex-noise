/**
 * The public statistics snapshot.
 *
 * This is the one module allowed to know about every other one: it reads the
 * settings, the world, the grid, the population, the clocks and the telemetry
 * counters and assembles them into the object the HUD and `tests/run.mjs` read.
 * Keeping the assembly here rather than in `telemetry.js` is what lets that
 * file stay a leaf — every stage of the pipeline writes to it, so if it also
 * read from them it would sit at the centre of a dependency cycle.
 *
 * The snapshot object is **reused**, not rebuilt. It is polled a few times a
 * second by the HUD, and handing back a fresh object each time would allocate
 * for no reason — the same argument as the pre-quantised palettes.
 */

import { settings } from './settings.js';
import { view } from './view.js';
import { world } from './world.js';
import { grid, gridBytes } from './grid.js';
import { clock } from './clock.js';
import { population } from './nodes.js';
import { telemetry, dominantStageName } from './telemetry.js';
import { energy, WAVE_KX, WAVE_KY, WAVE_RATE } from './energy.js';
import { RAD_TO_DEG, TAU } from './math.js';
import { LABEL_MODE_NAMES, LABEL_MODE_COUNT, modeAt, schedule } from './modes.js';
import { labelCapacity } from './callouts.js';
import { MAX_GLOW_NODES } from './node-pass.js';
import { LINK_ATTACK_RATE } from './link-pass.js';
import { keepOutCount } from './keep-outs.js';
import { codeRasterBytes } from './code-ticker.js';

const snapshot = {
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
  linkBytes: 0, gridBytes: 0, rasterBytes: 0,
  clock: 0, realClock: 0, keepOuts: 0,
  probeId: 0, probeZ: 0, probeScale: 0, probeEnergy: 0,
  probeBreath: 0, probeWave: 0, probeAudio: 0,
  sampleDistance: 0, sampleTarget: 0, sampleStrength: 0, attackK: 0,
};

/**
 * Live field statistics for the info layer's readout.
 *
 * Returns a shared object that is overwritten on each call — read what you need
 * immediately rather than holding on to it.
 *
 * @returns {typeof snapshot}
 */
export function getStillFieldStats() {
  const n = population.nodes.length;

  // --- Frame ---
  snapshot.fps = telemetry.fps;
  snapshot.fpsCap = settings.fps;
  snapshot.frameMs = telemetry.frameMs;
  snapshot.dt = telemetry.dt;
  snapshot.msUpdate = telemetry.msUpdate;
  snapshot.msLinks = telemetry.msLinks;
  snapshot.msNodes = telemetry.msNodes;
  snapshot.msInfo = telemetry.msInfo;
  snapshot.stage = dominantStageName();

  // --- Graph ---
  snapshot.nodes = n;
  snapshot.edges = telemetry.edges;
  snapshot.pairTests = telemetry.pairTests;
  snapshot.bruteTests = n * (n - 1) / 2;
  snapshot.gridCells = grid.cellCount;
  snapshot.batches = telemetry.batches;
  // Observed, not assumed: births per minute counted from real respawns, which
  // is the lifecycle rate the speed multiplier actually produced.
  snapshot.turnover = clock.real > 1 ? telemetry.respawns / clock.real * 60 : 0;
  snapshot.meanLifeS = snapshot.turnover > 0 ? n / snapshot.turnover * 60 : 0;
  snapshot.meanDegree = n ? telemetry.edges * 2 / n : 0;
  snapshot.maxDegree = telemetry.maxDegree;
  snapshot.density = snapshot.bruteTests ? telemetry.edges / snapshot.bruteTests : 0;

  // --- Info layer ---
  snapshot.labels = telemetry.labels;
  snapshot.edgeLabels = telemetry.edgeLabels;
  snapshot.labelCapacity = labelCapacity();
  snapshot.edgeSlots = telemetry.edgeSlots;
  snapshot.labelMode = LABEL_MODE_NAMES[modeAt(clock.real)];
  snapshot.modeRemaining = schedule.remainingS;
  snapshot.modesOnScreen = telemetry.modesOnScreen;
  snapshot.calloutFlips = telemetry.calloutFlips;
  snapshot.glowNodes = telemetry.glowNodes;
  snapshot.dwell = settings.dwell;

  // --- Field ---
  snapshot.energy = energy.level;
  snapshot.wavePhase = ((clock.drift * WAVE_RATE) % TAU) * RAD_TO_DEG;
  snapshot.waveLength = TAU / Math.hypot(WAVE_KX, WAVE_KY);
  snapshot.speed = settings.speed;
  snapshot.intensity = settings.intensity;
  snapshot.reducedMotion = view.reducedMotion;
  snapshot.densityScale = settings.density;
  snapshot.reach = settings.reach;
  snapshot.trail = settings.trail;
  snapshot.depth = settings.depth;
  snapshot.codeOverlay = settings.code;
  snapshot.calloutsOn = settings.callouts;
  snapshot.edgesOn = settings.edges;
  snapshot.codeFolded = settings.codeFolded;
  snapshot.linkRadius = world.linkRadius;
  snapshot.zWorld = world.zWorld;
  snapshot.worldW = world.w;
  snapshot.worldH = world.h;
  snapshot.minScale = world.minScale;
  snapshot.gridCell = grid.cell;
  snapshot.occupancy = grid.cellCount ? n / grid.cellCount : 0;
  snapshot.viewportW = view.w;
  snapshot.viewportH = view.h;
  snapshot.dpr = view.dpr;
  // Three figures rather than one. The renderer's scratch memory is not only
  // the link buffer: the grid's five arrays are high-water-marked beside it, and
  // the source listing can be holding a multi-megabyte raster. A "Buffers" row
  // that reported 36 KiB while the page held 1.7 MiB of transcript bitmap was
  // technically true and practically a lie.
  snapshot.linkBytes = population.links.byteLength;
  snapshot.gridBytes = gridBytes();
  snapshot.rasterBytes = codeRasterBytes();
  snapshot.clock = clock.drift;
  snapshot.realClock = clock.real;
  snapshot.keepOuts = keepOutCount();

  // --- Worked examples for the Math view ---
  snapshot.probeId = telemetry.probeId;
  snapshot.probeZ = telemetry.probeZ;
  snapshot.probeScale = telemetry.probeScale;
  snapshot.probeEnergy = telemetry.probeEnergy;
  snapshot.probeBreath = telemetry.probeBreath;
  snapshot.probeWave = telemetry.probeWave;
  snapshot.probeAudio = telemetry.probeAudio;
  snapshot.sampleDistance = telemetry.sampleDistance;
  snapshot.sampleTarget = telemetry.sampleTarget;
  snapshot.sampleStrength = telemetry.sampleStrength;
  snapshot.attackK = 1 - Math.exp(-LINK_ATTACK_RATE * (telemetry.dt || 1 / settings.fps));

  return snapshot;
}

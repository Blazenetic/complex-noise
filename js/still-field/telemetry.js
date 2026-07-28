/**
 * Live counters the renderer writes and the HUD reads.
 *
 * This module imports nothing on purpose. Every stage of the pipeline writes
 * here, so if it reached back into any of them it would be at the centre of a
 * dependency cycle; instead it is a leaf, and `stats.js` — which *is* allowed
 * to know about everything — is what assembles these into the public snapshot.
 *
 * The numbers are not decoration. "Pair tests against brute-force tests" is how
 * the spatial grid's claim is checked rather than asserted, and `calloutFlips`
 * exists because the left/right callout bounce was the info layer's worst habit
 * and the hardest thing to argue about from a screenshot — counting it made it
 * something `tests/run.mjs` can watch.
 */

/** Smoothing rate (per second) for the displayed frame rate and stage costs. */
export const FPS_SMOOTH = 3;

export const telemetry = {
  // --- Frame ---
  fps: 0,
  frameMs: 0,
  dt: 0,
  /** Random-walk jitter this frame, which rides the audio level. */
  jitter: 0,
  msUpdate: 0,
  msLinks: 0,
  msNodes: 0,
  msInfo: 0,

  // --- Graph ---
  /** Live population. Kept here so the overlays can read it without importing it. */
  nodes: 0,
  edges: 0,
  pairTests: 0,
  batches: 0,
  maxDegree: 0,
  /** Nodes that actually reached the glow pass, against its hard cap. */
  glowNodes: 0,

  // --- Info layer ---
  labels: 0,
  edgeLabels: 0,
  /** Edge-dimension slots currently holding a pair. */
  edgeSlots: 0,
  /** How many distinct detail modes are on screen at once. */
  modesOnScreen: 0,

  // --- Lifetime totals ---
  /**
   * Visible callout blocks that changed side. Only blocks already faded in are
   * counted: a side chosen at zero opacity is not something anybody saw move.
   */
  calloutFlips: 0,
  /** Respawns, for the observed turnover rate in the readout. */
  respawns: 0,

  // --- The node the Math view is evaluating its equations against ---
  probeId: 0,
  probeZ: 0,
  probeScale: 0,
  probeEnergy: 0,
  probeBreath: 0,
  probeWave: 0,
  probeAudio: 0,

  // --- The link the Math view is evaluating its equations against ---
  sampleDistance: 0,
  sampleTarget: 0,
  sampleStrength: 0,
};

/** Which stage cost the most this frame. */
export function dominantStageName() {
  let best = telemetry.msUpdate;
  let name = 'update';
  if (telemetry.msLinks > best) { best = telemetry.msLinks; name = 'links'; }
  if (telemetry.msNodes > best) { best = telemetry.msNodes; name = 'nodes'; }
  if (telemetry.msInfo > best) name = 'info';
  return name;
}

/**
 * Nothing is being drawn any more, so the readout should say so rather than
 * freeze on the last rate it happened to see. Lifetime totals survive.
 */
export function resetTelemetry() {
  telemetry.fps = 0;
  telemetry.frameMs = 0;
  telemetry.msUpdate = telemetry.msLinks = telemetry.msNodes = telemetry.msInfo = 0;
  telemetry.edges = 0;
  telemetry.labels = 0;
  telemetry.edgeLabels = 0;
  telemetry.edgeSlots = 0;
  telemetry.pairTests = 0;
  telemetry.batches = 0;
  telemetry.glowNodes = 0;
  telemetry.maxDegree = 0;
  telemetry.modesOnScreen = 0;
}

/** Stage timings only exist while the info layer is on. */
export function resetInstrumentation() {
  telemetry.frameMs = 0;
  telemetry.msUpdate = telemetry.msLinks = telemetry.msNodes = telemetry.msInfo = 0;
  telemetry.modesOnScreen = 0;
  telemetry.glowNodes = 0;
}

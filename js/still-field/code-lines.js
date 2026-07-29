/**
 * The transcript the source overlay prints — data, not code.
 *
 * These lines are transcribed by hand from the renderer they describe. They are
 * not generated, not evaluated and not imported from anywhere: they are a
 * *claim* about what `loop.js`, `nodes.js` and `link-pass.js` do, checked by eye
 * against those files. If you change one of those, change the matching line here
 * in the same commit — an overlay that prints last month's loop is worse than no
 * overlay, because it is confidently wrong.
 *
 * They live apart from `code-ticker.js` for the reason any table of contents
 * lives apart from the renderer that draws it: keeping the transcript current is
 * a different job from painting a comet down a column, and the diff for one
 * should not contain the other.
 *
 * Columns:
 *
 *   CODE_STAGE   0 update, 1 links, 2 nodes, 3 info — the pipeline stage this
 *                statement belongs to. The stages must stay contiguous: the
 *                gutter draws one rail per stage's run of lines, and the program
 *                counter spreads each stage's *measured* cost across its lines.
 *   CODE_INDENT  nesting depth, in twelve-pixel steps.
 *   CODE_TEXT    the statement itself.
 *   CODE_SLOT    which named live value is printed against it, or −1 for none.
 *
 * The renderer ultimately needs an integer here because this table is walked
 * while painting. `CODE_VALUE_SLOT` gives those integers names, and
 * `defineCodeValueMap()` makes the producer in `code-ticker.js` account for
 * every name exactly once. That keeps the per-frame lookup cheap without
 * leaving two unrelated lists of magic indices to agree by eye.
 */

export const CODE_STAGE = 0, CODE_INDENT = 1, CODE_TEXT = 2, CODE_SLOT = 3;

/**
 * Ordered names for every live value in the source listing.
 *
 * `summary` belongs to the footer rather than to a transcript line. Keeping it
 * in the same contract means the footer cannot quietly become one more
 * independently-numbered slot.
 */
export const CODE_VALUE_KEYS = Object.freeze([
  'dt', 'drift', 'nodeCount', 'jitter', 'probeZ', 'probeScale',
  'gridCells', 'pairTests', 'sampleDistance', 'sampleTarget', 'sampleStrength',
  'batches', 'probeEnergy', 'edges', 'fps', 'labels', 'respawnRate',
  'degree', 'glow', 'dimensions', 'mode', 'summary',
]);

/** Named integer slots retained by the allocation-sensitive paint path. */
export const CODE_VALUE_SLOT = Object.freeze(Object.fromEntries(
  CODE_VALUE_KEYS.map((key, index) => [key, index]),
));

/** How many live-value slots the listing addresses, and which one is the total. */
export const CODE_VALUE_COUNT = CODE_VALUE_KEYS.length;
export const CODE_SUMMARY_SLOT = CODE_VALUE_SLOT.summary;

/**
 * Validate and order one producer-side map of source-listing values.
 *
 * This runs once while modules load. Missing and retired values are programming
 * errors: either one would otherwise leave a plausible source statement beside
 * the wrong measurement.
 */
export function defineCodeValueMap(values) {
  const actual = Object.keys(values);
  const missing = CODE_VALUE_KEYS.filter(key => !Object.hasOwn(values, key));
  const extra = actual.filter(key => !Object.hasOwn(CODE_VALUE_SLOT, key));
  if (missing.length || extra.length) {
    const detail = [
      missing.length ? `missing ${missing.join(', ')}` : '',
      extra.length ? `extra ${extra.join(', ')}` : '',
    ].filter(Boolean).join('; ');
    throw new Error(`Source listing values do not match their slots: ${detail}`);
  }
  return CODE_VALUE_KEYS.map(key => values[key]);
}

export const CODE_LINES = [
  [0, 0, 'dt = min((now - last) / 1000, 0.1);', CODE_VALUE_SLOT.dt],
  [0, 0, 'clock += dt * speed;', CODE_VALUE_SLOT.drift],
  [0, 0, 'for (const node of nodes) {', CODE_VALUE_SLOT.nodeCount],
  [0, 1, 'node.vx += (rand() - .5) * J * dt;', CODE_VALUE_SLOT.jitter],
  [0, 1, 'node.vx *= exp(-0.55 * dt);', -1],
  [0, 1, 'node.z = zBase + sin(zPhase) * zAmp;', CODE_VALUE_SLOT.probeZ],
  [0, 1, 'node.scale = 1 / (1 + node.z * δ);', CODE_VALUE_SLOT.probeScale],
  [0, 1, 'node.E = .30b + .24w + .46a;', CODE_VALUE_SLOT.probeEnergy],
  [0, 1, 'if (node.life >= 1) respawn(node);', CODE_VALUE_SLOT.respawnRate],
  [0, 0, '}', -1],
  [1, 0, 'grid.rebuild(nodes);', CODE_VALUE_SLOT.gridCells],
  [1, 0, 'for (const [a, b] of grid.pairs()) {', CODE_VALUE_SLOT.pairTests],
  [1, 1, 'd = hypot(dx, dy, dz * zWorld);', CODE_VALUE_SLOT.sampleDistance],
  [1, 1, 't = pow(1 - d / radius, 0.65);', CODE_VALUE_SLOT.sampleTarget],
  [1, 1, 's += (t - s) * (1 - exp(-λ * dt));', CODE_VALUE_SLOT.sampleStrength],
  [1, 1, 'a.deg++; b.deg++; a.κ += s;', CODE_VALUE_SLOT.degree],
  [1, 1, 'batch.stroke(a, b, shade(s));', CODE_VALUE_SLOT.batches],
  [1, 0, '}', -1],
  [2, 0, 'shade = pow(node.energy, 1.35);', CODE_VALUE_SLOT.glow],
  [2, 0, 'ctx.arc(sx, sy, radius, 0, TAU);', CODE_VALUE_SLOT.edges],
  [3, 0, 'info.clearRect(0, 0, w, h);', CODE_VALUE_SLOT.fps],
  [3, 0, 'mode = (base + node.slot) % 8;', CODE_VALUE_SLOT.mode],
  [3, 0, 'label.α += (target - label.α) * k;', CODE_VALUE_SLOT.labels],
  [3, 0, 'dimension(a, b, kind(idA + idB·φ));', CODE_VALUE_SLOT.dimensions],
];

// A duplicate integer necessarily leaves another named line value unused. Catch
// both sides here, once, before the overlay can confidently print the wrong
// measurement for the rest of the session.
const codeSlotUses = new Uint8Array(CODE_VALUE_COUNT);
for (const line of CODE_LINES) {
  const slot = line[CODE_SLOT];
  if (slot === -1) continue;
  if (!Number.isInteger(slot) || slot >= CODE_SUMMARY_SLOT) {
    throw new Error(`Invalid source listing slot: ${slot}`);
  }
  codeSlotUses[slot]++;
}
for (let slot = 0; slot < CODE_SUMMARY_SLOT; slot++) {
  if (codeSlotUses[slot] !== 1) {
    throw new Error(
      `Source listing slot ${CODE_VALUE_KEYS[slot]} is used ${codeSlotUses[slot]} times`,
    );
  }
}

/** How many pipeline stages the transcript is grouped into. */
export const CODE_STAGE_COUNT = 4;

/** Lines per stage, so the cursor can spread a stage's real cost across them. */
export const CODE_STAGE_LINES = new Int32Array(CODE_STAGE_COUNT);
for (const line of CODE_LINES) CODE_STAGE_LINES[line[CODE_STAGE]]++;

/**
 * First and last line index of each stage's contiguous run, so the gutter can
 * draw one rail per stage rather than one mark per line.
 */
export const CODE_STAGE_FIRST = Int32Array.from([-1, -1, -1, -1]);
export const CODE_STAGE_LAST = new Int32Array(CODE_STAGE_COUNT);
for (let i = 0; i < CODE_LINES.length; i++) {
  const stage = CODE_LINES[i][CODE_STAGE];
  if (CODE_STAGE_FIRST[stage] < 0) CODE_STAGE_FIRST[stage] = i;
  CODE_STAGE_LAST[stage] = i;
}

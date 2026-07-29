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
 *   CODE_SLOT    which live value is printed against it, or −1 for none.
 *
 * A slot index has no meaning here — `refreshCodeValues()` in `code-ticker.js`
 * decides what each one holds. Adding a line with a new slot means raising
 * `CODE_VALUE_COUNT` and filling it there.
 */

export const CODE_STAGE = 0, CODE_INDENT = 1, CODE_TEXT = 2, CODE_SLOT = 3;

export const CODE_LINES = [
  [0, 0, 'dt = min((now - last) / 1000, 0.1);', 0],
  [0, 0, 'clock += dt * speed;', 1],
  [0, 0, 'for (const node of nodes) {', 2],
  [0, 1, 'node.vx += (rand() - .5) * J * dt;', 3],
  [0, 1, 'node.vx *= exp(-0.55 * dt);', -1],
  [0, 1, 'node.z = zBase + sin(zPhase) * zAmp;', 4],
  [0, 1, 'node.scale = 1 / (1 + node.z * δ);', 5],
  [0, 1, 'node.E = .30b + .24w + .46a;', 12],
  [0, 1, 'if (node.life >= 1) respawn(node);', 16],
  [0, 0, '}', -1],
  [1, 0, 'grid.rebuild(nodes);', 6],
  [1, 0, 'for (const [a, b] of grid.pairs()) {', 7],
  [1, 1, 'd = hypot(dx, dy, dz * zWorld);', 8],
  [1, 1, 't = pow(1 - d / radius, 0.65);', 9],
  [1, 1, 's += (t - s) * (1 - exp(-λ * dt));', 10],
  [1, 1, 'a.deg++; b.deg++; a.κ += s;', 17],
  [1, 1, 'batch.stroke(a, b, shade(s));', 11],
  [1, 0, '}', -1],
  [2, 0, 'shade = pow(node.energy, 1.35);', 18],
  [2, 0, 'ctx.arc(sx, sy, radius, 0, TAU);', 13],
  [3, 0, 'info.clearRect(0, 0, w, h);', 14],
  [3, 0, 'mode = (base + node.slot) % 8;', 20],
  [3, 0, 'label.α += (target - label.α) * k;', 15],
  [3, 0, 'dimension(a, b, kind(idA + idB·φ));', 19],
];

/** How many live-value slots the listing addresses, and which one is the total. */
export const CODE_VALUE_COUNT = 22;
export const CODE_SUMMARY_SLOT = 21;

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

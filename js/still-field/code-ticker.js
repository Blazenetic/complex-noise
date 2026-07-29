/**
 * The code ticker — the renderer's own source, on the canvas.
 *
 * A column of real statements from this renderer, with a program counter
 * sweeping down it. The cursor is not decorative timing: each stage's share of
 * the sweep is its *measured* share of the frame's work, so the marker
 * genuinely lingers where the time goes. Watch it for a few seconds with the
 * node density up and you can see the link pass take over the frame.
 *
 * The listing also claims a corner before anything else in the info layer is
 * placed, so callouts and edge dimensions can treat it as one more region to
 * stay out of — see `hitsCodeBlock()`.
 */

import { view, surfaces, snap } from './view.js';
import { settings } from './settings.js';
import { clock, VALUE_REFRESH_S } from './clock.js';
import { paint } from './palette.js';
import { hitsKeepOut } from './keep-outs.js';
import { telemetry } from './telemetry.js';
import { grid } from './grid.js';
import { LABEL_MODE_NAMES, modeAt } from './modes.js';
import { MAX_GLOW_NODES } from './node-pass.js';

const CODE_FONT = '10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/**
 * Real statements from this renderer, grouped by pipeline stage.
 *
 * These are transcribed from the code they describe and are checked by eye
 * against it — if you change `loop.js`'s `update()` or `link-pass.js`, change
 * these too. `slot` indexes a live value refreshed once a second and printed
 * against the line, so the column is not a decorative snippet: it is the loop
 * that is running, with the numbers it is currently running on.
 *
 * Stages: 0 update, 1 links, 2 nodes, 3 info.
 */
const CODE_STAGE = 0, CODE_INDENT = 1, CODE_TEXT = 2, CODE_SLOT = 3;
const CODE_LINES = [
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
const CODE_VALUE_COUNT = 22;
const CODE_SUMMARY_SLOT = 21;
const codeValueText = new Array(CODE_VALUE_COUNT).fill('');

/** Lines per stage, so the cursor can spread a stage's real cost across them. */
const CODE_STAGE_LINES = new Int32Array(4);
for (const line of CODE_LINES) CODE_STAGE_LINES[line[CODE_STAGE]]++;
/**
 * First and last line index of each stage's contiguous run, so the gutter can
 * draw one rail per stage rather than one mark per line.
 */
const CODE_STAGE_FIRST = Int32Array.from([-1, -1, -1, -1]);
const CODE_STAGE_LAST = new Int32Array(4);
for (let i = 0; i < CODE_LINES.length; i++) {
  const stage = CODE_LINES[i][CODE_STAGE];
  if (CODE_STAGE_FIRST[stage] < 0) CODE_STAGE_FIRST[stage] = i;
  CODE_STAGE_LAST[stage] = i;
}

const CODE_LINE_H = 13;
const CODE_BLOCK_W = 356;
const CODE_GUTTER = 22;
const CODE_MIN_VIEWPORT = 1000;
const CODE_HEAD_H = 20;
const CODE_FOOT_H = 20;
/**
 * Seconds for the program counter to complete one sweep of the listing.
 *
 * Deliberately slow. The counter used to paint a full-width purple bar behind
 * one line and jump it every 70 ms, which on a screen you are falling asleep to
 * is a strobe with a monospace font on it. It is now a heat value per line that
 * rises as the counter passes and decays exponentially, so what you see is a
 * soft comet moving down the listing rather than a row flashing on and off.
 */
const CODE_SWEEP_S = 2.8;
/** Per-second decay of a line's heat. Sets the length of the comet's tail. */
const CODE_HEAT_DECAY = 3.2;
/** Below this a line is at rest and skips its highlight work entirely. */
const CODE_HEAT_EPSILON = 0.02;
const codeLineHeat = new Float32Array(CODE_LINES.length);
/** Descending opacity for the footer's four stacked stage segments. */
const CODE_STAGE_ALPHA = Float32Array.from([0.75, 0.55, 0.4, 0.28]);
const stageShareScratch = new Float32Array(4);

let codeCursor = 0;
let codeValueNextUpdate = 0;
let codeActiveLine = 0;

/** Where the listing landed this frame, so callouts can stay off it. */
let codeVisible = false;
let codeLeft = 0;
let codeTop = 0;
let codeHeight = 0;

/** Is the listing on screen right now? */
export function isCodeVisible() {
  return codeVisible;
}

/**
 * Choose a corner for the listing, or decide there is nowhere for it to go.
 *
 * Four candidates, tried in order of preference. The bottom-right is the
 * natural home, but in immersion mode the floating play cluster lives there, so
 * a single fixed position would mean the listing silently never appeared for
 * exactly the users most likely to want it.
 */
const CODE_CORNERS_X = Int8Array.from([1, 1, -1, -1]);   // +1 right, −1 left
const CODE_CORNERS_Y = Int8Array.from([1, -1, 1, -1]);   // +1 bottom, −1 top

export function layoutCodeTicker() {
  codeVisible = false;
  if (!settings.code) return;
  if (view.w < CODE_MIN_VIEWPORT) return;

  // Folded, the listing is just its header bar — small enough that it always
  // fits, which is the point: the corner is freed without the overlay
  // disappearing and leaving no way back to it.
  const height = settings.codeFolded
    ? CODE_HEAD_H
    : CODE_HEAD_H + CODE_LINES.length * CODE_LINE_H + CODE_FOOT_H;
  if (height + 48 > view.h) return;

  for (let c = 0; c < 4; c++) {
    const left = CODE_CORNERS_X[c] > 0 ? view.w - CODE_BLOCK_W - 20 : 20;
    const top = CODE_CORNERS_Y[c] > 0 ? view.h - height - 24 : 24;
    if (top < 12) continue;
    if (hitsKeepOut(left, top, left + CODE_BLOCK_W, top + height)) continue;
    codeLeft = left;
    codeTop = top;
    codeHeight = height;
    codeVisible = true;
    return;
  }
}

/**
 * Did a pointer press land on the listing's title bar?
 *
 * The overlay is canvas, so it cannot be a button — but a listing you can only
 * dismiss from a panel two scrolls away is a listing people leave switched off.
 * The Field Lab switch remains the keyboard-reachable, persisted control; this
 * is the direct affordance on top of it.
 *
 * @param {number} x viewport CSS px
 * @param {number} y viewport CSS px
 */
export function hitsCodeHeader(x, y) {
  if (!codeVisible) return false;
  // The plate extends a little past the text column on every side; matching it
  // keeps the target at the size it looks.
  if (x < codeLeft - 10 || x > codeLeft + CODE_BLOCK_W + 10) return false;
  if (y < codeTop - 8 || y > codeTop + CODE_HEAD_H) return false;
  return true;
}

/** Does a box overlap the listing? Used by callouts and edge dimensions. */
export function hitsCodeBlock(left, top, right, bottom) {
  if (!codeVisible) return false;
  return right > codeLeft && left < codeLeft + CODE_BLOCK_W
    && bottom > codeTop && top < codeTop + codeHeight;
}

/**
 * Refresh the live values printed against the source lines. Once a second, on
 * the same cadence as the callouts, for the same reason.
 */
function refreshCodeValues() {
  if (clock.real < codeValueNextUpdate) return;
  codeValueNextUpdate = clock.real + VALUE_REFRESH_S;

  const n = telemetry.nodes;
  codeValueText[0] = telemetry.dt.toFixed(4);
  codeValueText[1] = `${(clock.drift % 1000).toFixed(1)} s`;
  codeValueText[2] = `n = ${n}`;
  codeValueText[3] = `J = ${telemetry.jitter.toFixed(1)}`;
  codeValueText[4] = `z = ${telemetry.probeZ.toFixed(3)}`;
  codeValueText[5] = `s = ${telemetry.probeScale.toFixed(3)}`;
  codeValueText[6] = `${grid.cellCount} cells`;
  codeValueText[7] = `${telemetry.pairTests} of ${(n * (n - 1) / 2) | 0}`;
  codeValueText[8] = `d = ${telemetry.sampleDistance.toFixed(0)}`;
  codeValueText[9] = `t = ${telemetry.sampleTarget.toFixed(3)}`;
  codeValueText[10] = `s = ${telemetry.sampleStrength.toFixed(3)}`;
  codeValueText[11] = `${telemetry.batches} batches`;
  codeValueText[12] = `E = ${telemetry.probeEnergy.toFixed(3)}`;
  codeValueText[13] = `${telemetry.edges} edges`;
  codeValueText[14] = `${telemetry.fps.toFixed(0)} fps`;
  codeValueText[15] = `${telemetry.labels} shown`;
  codeValueText[16] = clock.real > 1
    ? `${(telemetry.respawns / clock.real * 60).toFixed(1)}/min`
    : 'settling';
  codeValueText[17] = `x̄ ${(n ? telemetry.edges * 2 / n : 0).toFixed(2)} · ↑${telemetry.maxDegree}`;
  codeValueText[18] = `${telemetry.glowNodes}/${MAX_GLOW_NODES} glow`;
  codeValueText[19] = `${telemetry.edgeLabels} dims`;
  codeValueText[20] = `${LABEL_MODE_NAMES[modeAt(clock.real)]} +${telemetry.modesOnScreen}`;
  codeValueText[CODE_SUMMARY_SLOT] = `u ${telemetry.msUpdate.toFixed(2)} · l ${telemetry.msLinks.toFixed(2)}`
    + ` · n ${telemetry.msNodes.toFixed(2)} · i ${telemetry.msInfo.toFixed(2)} ms`;
}

/**
 * Paint the listing. Only called when `layoutCodeTicker()` found it a corner.
 * @param {CanvasRenderingContext2D} ctx the info canvas
 * @param {number} dt seconds since the last frame
 */
export function drawCodeTicker(ctx, dt) {
  const lines = CODE_LINES.length;
  const left = codeLeft;
  const top = codeTop;

  refreshCodeValues();

  // Stage weights from the measured profile. A stage with no measurable cost
  // still gets a floor, so the cursor keeps moving rather than stalling on the
  // first frame before any timing exists.
  const total = telemetry.msUpdate + telemetry.msLinks + telemetry.msNodes + telemetry.msInfo;
  const share0 = total > 0 ? Math.max(0.06, telemetry.msUpdate / total) : 0.25;
  const share1 = total > 0 ? Math.max(0.06, telemetry.msLinks / total) : 0.25;
  const share2 = total > 0 ? Math.max(0.06, telemetry.msNodes / total) : 0.25;
  const share3 = total > 0 ? Math.max(0.06, telemetry.msInfo / total) : 0.25;
  const shareSum = share0 + share1 + share2 + share3;

  ctx.textBaseline = 'top';
  ctx.font = CODE_FONT;

  // A very light plate. The listing sits over the field's own lines, and
  // without something behind it an edge crossing a line of code is read as part
  // of the code. Kept far more transparent than a callout plate — this is
  // ambient, not a readout you are meant to stop and study.
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = paint.plate;
  ctx.beginPath();
  if (surfaces.hasRoundRect) ctx.roundRect(snap(left - 10), snap(top - 8), CODE_BLOCK_W + 20, codeHeight + 4, 6);
  else ctx.rect(snap(left - 10), snap(top - 8), CODE_BLOCK_W + 20, codeHeight + 4);
  ctx.fill();

  drawCodeHeader(ctx, left, top, total);
  if (settings.codeFolded) {
    ctx.textAlign = 'left';
    return;
  }

  codeCursor += dt / (view.reducedMotion ? CODE_SWEEP_S * 3 : CODE_SWEEP_S);
  if (codeCursor >= 1) codeCursor -= Math.floor(codeCursor);

  // Walk the weighted listing to find the line the counter is on.
  const target = codeCursor * shareSum;
  let running = 0;
  codeActiveLine = 0;
  for (let i = 0; i < lines; i++) {
    const stage = CODE_LINES[i][CODE_STAGE];
    const share = stage === 0 ? share0 : stage === 1 ? share1 : stage === 2 ? share2 : share3;
    running += share / CODE_STAGE_LINES[stage];
    if (running >= target) { codeActiveLine = i; break; }
    codeActiveLine = i;
  }

  // Heat, not a highlight. The counter deposits warmth on the line it reaches
  // and every line cools exponentially, so the marker reads as a soft comet
  // passing down the listing rather than a row switching on and off. The decay
  // is a rate per second like every other decay here, so the tail is the same
  // length at 30, 45 and 60 fps.
  const cool = Math.exp(-CODE_HEAT_DECAY * dt);
  for (let i = 0; i < lines; i++) codeLineHeat[i] *= cool;
  codeLineHeat[codeActiveLine] = 1;

  const bodyTop = top + CODE_HEAD_H;
  drawCodeGutter(ctx, left, bodyTop, share0, share1, share2, share3);

  for (let i = 0; i < lines; i++) {
    const line = CODE_LINES[i];
    const y = bodyTop + i * CODE_LINE_H;
    const heat = codeLineHeat[i];
    const warm = heat > CODE_HEAT_EPSILON;

    if (warm) {
      // A wash this faint is under the threshold at which a moving band is
      // distracting, which is the entire brief for this overlay.
      ctx.globalAlpha = heat * 0.085;
      ctx.fillStyle = paint.accent;
      ctx.fillRect(snap(left - 4), snap(y - 1), CODE_BLOCK_W + 8, CODE_LINE_H);
      ctx.globalAlpha = heat * 0.5;
      ctx.fillRect(snap(left - 8), snap(y - 1), 2, CODE_LINE_H);
    }

    ctx.textAlign = 'right';
    ctx.globalAlpha = 0.26 + heat * 0.24;
    ctx.fillStyle = paint.inkMuted;
    ctx.fillText(String(i + 1).padStart(2, '0'), snap(left + CODE_GUTTER - 6), snap(y));

    const textX = snap(left + CODE_GUTTER + line[CODE_INDENT] * 12);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 0.40 + heat * 0.22;
    ctx.fillStyle = paint.ink;
    ctx.fillText(line[CODE_TEXT], textX, snap(y));
    // Warmth tints rather than replaces: over-printing in the accent at the
    // heat's own alpha crossfades the colour instead of stepping it.
    if (warm) {
      ctx.globalAlpha = heat * 0.42;
      ctx.fillStyle = paint.accent;
      ctx.fillText(line[CODE_TEXT], textX, snap(y));
    }

    const slot = line[CODE_SLOT];
    if (slot >= 0) {
      ctx.textAlign = 'right';
      ctx.globalAlpha = 0.32 + heat * 0.34;
      ctx.fillStyle = paint.inkMuted;
      ctx.fillText(codeValueText[slot], snap(left + CODE_BLOCK_W), snap(y));
    }
  }

  drawCodeFooter(ctx, left, bodyTop + lines * CODE_LINE_H, share0, share1, share2, share3);
  ctx.textAlign = 'left';
}

/** Title bar: the file, the frame cost, and the fold chevron that toggles it. */
function drawCodeHeader(ctx, left, top, totalMs) {
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = paint.inkMuted;
  ctx.textAlign = 'left';
  ctx.fillText('js/still-field/loop.js — render loop', snap(left + CODE_GUTTER), snap(top));

  ctx.textAlign = 'right';
  ctx.globalAlpha = 0.42;
  ctx.fillText(
    settings.codeFolded ? `${CODE_LINES.length} lines` : `${totalMs.toFixed(2)} ms/frame`,
    snap(left + CODE_BLOCK_W - 14),
    snap(top),
  );

  // Chevron: down when expanded (it will collapse), right when folded.
  const cx = left + CODE_BLOCK_W - 5;
  const cy = top + 5;
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = paint.accent;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  if (settings.codeFolded) {
    ctx.moveTo(snap(cx - 3) + 0.5, snap(cy - 4) + 0.5);
    ctx.lineTo(snap(cx + 1) + 0.5, snap(cy) + 0.5);
    ctx.lineTo(snap(cx - 3) + 0.5, snap(cy + 4) + 0.5);
  } else {
    ctx.moveTo(snap(cx - 5) + 0.5, snap(cy - 2) + 0.5);
    ctx.lineTo(snap(cx - 1) + 0.5, snap(cy + 2) + 0.5);
    ctx.lineTo(snap(cx + 3) + 0.5, snap(cy - 2) + 0.5);
  }
  ctx.stroke();

  ctx.globalAlpha = 0.28;
  ctx.fillStyle = paint.inkMuted;
  ctx.fillRect(snap(left - 4), snap(top + 14), CODE_BLOCK_W + 8, 1);
}

/**
 * Stage rails down the left margin. One bar per contiguous run of lines, its
 * opacity the stage's measured share — so the shape of the frame is legible
 * from the gutter alone, without reading a single number.
 */
function drawCodeGutter(ctx, left, bodyTop, share0, share1, share2, share3) {
  const x = snap(left - 8);
  for (let stage = 0; stage < 4; stage++) {
    const first = CODE_STAGE_FIRST[stage];
    if (first < 0) continue;
    const share = stage === 0 ? share0 : stage === 1 ? share1 : stage === 2 ? share2 : share3;
    const y = snap(bodyTop + first * CODE_LINE_H);
    const h = (CODE_STAGE_LAST[stage] - first + 1) * CODE_LINE_H - 3;
    ctx.globalAlpha = 0.10 + share * 0.42;
    ctx.fillStyle = paint.accent;
    ctx.fillRect(x, y, 2, h);
  }
}

/** A stacked bar of where the frame's time actually went, plus the raw figures. */
function drawCodeFooter(ctx, left, y, share0, share1, share2, share3) {
  const sum = share0 + share1 + share2 + share3;
  const barY = snap(y + 4);
  let x = left;
  // Written into a pre-allocated array rather than a literal: this runs every
  // frame, and an array literal here is an allocation in the render loop.
  stageShareScratch[0] = share0;
  stageShareScratch[1] = share1;
  stageShareScratch[2] = share2;
  stageShareScratch[3] = share3;
  ctx.fillStyle = paint.accent;
  for (let stage = 0; stage < 4; stage++) {
    const w = (stageShareScratch[stage] / sum) * CODE_BLOCK_W;
    ctx.globalAlpha = CODE_STAGE_ALPHA[stage];
    ctx.fillRect(snap(x), barY, Math.max(1, w - 1), 2);
    x += w;
  }

  ctx.globalAlpha = 0.34;
  ctx.fillStyle = paint.inkMuted;
  ctx.textAlign = 'left';
  ctx.fillText(codeValueText[CODE_SUMMARY_SLOT], snap(left), snap(y + 8));
}

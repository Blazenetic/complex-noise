/**
 * The render loop — the only place a frame is defined.
 *
 * One frame is: accept a timestep, advance the two clocks, step the
 * simulation, then paint four stages in a fixed order (trail, links, nodes,
 * info). Everything else in `js/still-field/` is called from here.
 *
 * ## The rules that keep it cheap
 *
 * This runs for eight hours on a phone, so every per-frame cost is an overnight
 * battery cost:
 *
 * - **Frame rate is capped, and the cap is a setting** (30 / 45 / 60). Motion is
 *   integrated from real elapsed time, so the field drifts at exactly the same
 *   rate whichever cap is chosen — including the trail, whose decay is a rate
 *   per second rather than a per-frame alpha.
 * - **The loop stops when the page is hidden.** Requesting frames the browser
 *   will only throttle still wakes the compositor; not asking is free.
 * - **Almost nothing allocates.** No object literals, no arrays, and every
 *   changing string comes from a table quantised at module load.
 * - **The timestep is capped** at `MAX_STEP_S`. After a stall or a hidden tab,
 *   integrating the true elapsed time in one go would teleport the field.
 * - **Instrumentation is opt-in.** `performance.now()` between stages, graph
 *   telemetry and the info layer all cost nothing when Stats is off.
 */

import { view, surfaces, applyCanvasVisibility, clearFieldCanvas, clearInfoCanvas } from './view.js';
import { settings } from './settings.js';
import { clock } from './clock.js';
import { telemetry, FPS_SMOOTH, resetTelemetry } from './telemetry.js';
import { population, stepNodes } from './nodes.js';
import { getStillAudioMetrics } from './audio-metrics.js';
import { energy, publishEnergy, ENERGY_SMOOTH } from './energy.js';
import { getIsPlaying } from '../audio.js';
import { drawLinks } from './link-pass.js';
import { drawNodes } from './node-pass.js';
import { beginCalloutFrame, drawCallouts } from './callouts.js';
import { drawEdgeAnnotations } from './edge-labels.js';
import { layoutCodeTicker, drawCodeTicker, isCodeVisible } from './code-ticker.js';

/** Longest timestep we will integrate in one go, after a stall or a hidden tab. */
const MAX_STEP_S = 0.1;

let rafId = null;
let lastFrameMs = 0;
let lastDrawMs = 0;

function frame(nowMs) {
  rafId = requestAnimationFrame(frame);

  if (!settings.enabled || settings.intensity <= 0.01) {
    stopLoop();
    applyCanvasVisibility(settings.enabled);
    energy.level = 0;
    publishEnergy(0);
    // Without this the last painted frame would sit frozen on screen, because
    // the residual clear that normally erases it only runs while the loop does.
    clearFieldCanvas();
    clearInfoCanvas();
    return;
  }

  // Frame cap. The `-1` absorbs the sub-millisecond jitter that would otherwise
  // make every second frame miss its slot and halve the effective rate.
  const frameInterval = 1000 / settings.fps;
  if (nowMs - lastDrawMs < frameInterval - 1) return;

  const dt = Math.min((nowMs - lastFrameMs) / 1000, MAX_STEP_S);
  lastFrameMs = nowMs;
  lastDrawMs = nowMs;
  if (dt <= 0) return;
  telemetry.dt = dt;

  // Measured from real elapsed time, not the speed-scaled clock, so the readout
  // reports the frame rate rather than the drift rate.
  const smoothK = 1 - Math.exp(-FPS_SMOOTH * dt);
  telemetry.fps += (1 / dt - telemetry.fps) * smoothK;

  const speed = view.reducedMotion ? settings.speed * 0.35 : settings.speed;
  const adt = dt * speed;   // the animation clock advances at the user's speed
  clock.drift += adt;
  clock.real += dt;

  const instrumented = settings.nerd;
  const workStart = instrumented ? performance.now() : 0;
  update(adt, dt);
  const afterUpdate = instrumented ? performance.now() : 0;
  draw(adt, dt, instrumented, afterUpdate, smoothK);

  if (instrumented) {
    telemetry.frameMs += (performance.now() - workStart - telemetry.frameMs) * smoothK;
    telemetry.msUpdate += (afterUpdate - workStart - telemetry.msUpdate) * smoothK;
  }
}

/** Advance the simulation: audio in, node state and the spatial grid out. */
function update(adt, dt) {
  const m = getStillAudioMetrics();
  // Weight overall a little higher so brown/pink still feed the cyan spark
  // ramp; white remains the liveliest, but the gap is smaller.
  const audioBoost = Math.min(1, (0.5 * m.overall + 0.3 * m.mid + 0.2 * m.high) * 1.75);
  telemetry.probeAudio = audioBoost;

  // Smoothed, intensity-scaled energy for the CSS variable the UI reacts to.
  const targetEnergy = m.overall * settings.intensity * (getIsPlaying() ? 1 : 0.06);
  energy.level += (targetEnergy - energy.level) * (1 - Math.exp(-ENERGY_SMOOTH * adt));
  publishEnergy(energy.level);

  // Callout envelopes are per-node but their coefficients are per-frame, so
  // they are computed once here and applied inside the node step.
  beginCalloutFrame(dt);
  stepNodes(adt, dt, audioBoost, m.overall, settings.nerd);
}

function draw(adt, dt, instrumented, tAfterUpdate, smoothK) {
  const ctx = surfaces.fieldCtx;
  const nodes = population.nodes;
  const n = nodes.length;

  // Soft residual clear — leaves a calm trail instead of a hard wipe.
  //
  // `destination-out` subtracts alpha rather than painting the page background
  // over the previous frame. Painting it would work, but only if the fill
  // exactly matched `--bg`, and after a few hundred frames the canvas would be
  // fully opaque — burying the background gradient and the Still Texture
  // underneath it. Subtracting alpha keeps the canvas genuinely transparent, so
  // both still show through, and the theme no longer has to hand this function
  // a matching colour.
  //
  // The decay is a rate per second, not a per-frame constant: the frame cap is
  // a user setting, and a fixed per-frame alpha would quietly halve every trail
  // the moment somebody moved it from 30 to 60.
  ctx.globalCompositeOperation = 'destination-out';
  ctx.globalAlpha = 1;
  ctx.fillStyle = `rgba(0,0,0,${(1 - Math.exp(-settings.trail * dt)).toFixed(4)})`;
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.globalCompositeOperation = 'source-over';

  drawLinks(ctx, nodes, n, adt);
  const tAfterLinks = instrumented ? performance.now() : 0;

  drawNodes(ctx, nodes, n);
  const tAfterNodes = instrumented ? performance.now() : 0;

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  if (settings.nerd) {
    drawInfoLayer(nodes, n, dt);
    surfaces.infoCleared = false;
  } else {
    telemetry.labels = 0;
    telemetry.edgeLabels = 0;
    telemetry.edgeSlots = 0;
    clearInfoCanvas();
  }

  if (instrumented) {
    telemetry.msLinks += (tAfterLinks - tAfterUpdate - telemetry.msLinks) * smoothK;
    telemetry.msNodes += (tAfterNodes - tAfterLinks - telemetry.msNodes) * smoothK;
    telemetry.msInfo += (performance.now() - tAfterNodes - telemetry.msInfo) * smoothK;
  }
}

/**
 * The info layer, on its own canvas, cleared outright every frame.
 *
 * Order matters. The listing claims its corner before anything else is placed,
 * so callouts and dimensions can treat it as one more region to stay out of —
 * and it is painted last so it sits on top of the field's own lines.
 */
function drawInfoLayer(nodes, n, dt) {
  const ctx = surfaces.infoCtx;
  if (!ctx) return;

  ctx.clearRect(0, 0, view.w, view.h);
  ctx.shadowBlur = 0;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';

  layoutCodeTicker();
  // `drawEdgeAnnotations` is the only thing that recounts held slots, so every
  // path that skips it has to say so. Leaving the last count standing is how
  // the HUD ends up reporting "0 shown · 6 slots held" over a field that is
  // holding nothing at all.
  if (!settings.edges) telemetry.edgeSlots = 0;
  telemetry.edgeLabels = settings.edges ? drawEdgeAnnotations(ctx, dt) : 0;
  telemetry.labels = settings.callouts ? drawCallouts(ctx, nodes, n) : 0;
  if (!settings.callouts) telemetry.modesOnScreen = 0;
  if (isCodeVisible()) drawCodeTicker(ctx, dt);

  ctx.globalAlpha = 1;
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
}

// ----------------------------------------------------------
// Loop control
// ----------------------------------------------------------

export function stopLoop() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  resetTelemetry();
}

export function startLoop() {
  if (rafId) return;
  if (!settings.enabled) return;
  if (document.visibilityState === 'hidden') return;
  // Reset the clock so the first step after a pause is a normal one rather than
  // however long the app sat idle.
  lastFrameMs = performance.now();
  lastDrawMs = lastFrameMs - 1000 / settings.fps;
  rafId = requestAnimationFrame(frame);
}

/**
 * Stop drawing entirely while the page is hidden. A backgrounded tab still runs
 * throttled animation frames, and on a phone that is a locked screen quietly
 * spending battery for eight hours.
 */
export function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    stopLoop();
  } else if (settings.enabled) {
    startLoop();
  }
}

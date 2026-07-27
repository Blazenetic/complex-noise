/**
 * Complex Noise — main application entry point.
 *
 * This is the only module that touches the app's DOM. Everything else owns
 * state and publishes it:
 *
 *   audio.js        → Web Audio engine + EQ + timer + wake lock
 *   still-field.js  → canvas visualisation (owns only its own canvas)
 *   theme.js        → Still Theme (dark / bone)
 *   noise.js        → procedural buffer generation (used by audio)
 *   storage.js      → safe, typed localStorage access
 *   constants.js    → shared numbers, defaults & storage keys
 *   ui-chrome.js    → immersion hide / show of the main controls
 *
 * ## The rule that keeps this app correct
 *
 * Event handlers only *call* into the state modules. They never update the UI
 * directly. Rendering happens exclusively in the `subscribe()` callbacks
 * below, because state changes for reasons that have no click behind them —
 * the sleep timer stopping playback overnight is the obvious one. Updating the
 * play button inside its own click handler is how that button ends up frozen
 * on "pause" after a timer fires.
 */

import { PLAY_ICON, PAUSE_ICON, DEFAULTS } from './constants.js';
import * as audio from './audio.js';
import * as stillField from './still-field.js';
import * as theme from './theme.js';
import * as uiChrome from './ui-chrome.js';

/** Compact play/pause icons for the minimised chrome (slightly smaller). */
const MINI_PLAY_ICON = '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const MINI_PAUSE_ICON = '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';

/** Icon + label for the floating restore control. */
const SHOW_CONTROLS_HTML = `
  <svg class="chrome-toggle-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4 7h16M4 12h16M4 17h16"/>
  </svg>
  <span class="chrome-toggle-text">Show controls</span>
`;

// ----------------------------------------------------------
// DOM references
// ----------------------------------------------------------
const els = {
  playBtn: document.getElementById('playBtn'),
  minimisedPlayBtn: document.getElementById('minimisedPlayBtn'),
  volume: document.getElementById('volume'),
  timer: document.getElementById('timer'),
  timerValue: document.getElementById('timerValue'),
  status: document.getElementById('status'),
  minimisedStatus: document.getElementById('minimisedStatus'),
  typeButtons: Array.from(document.querySelectorAll('.type-btn')),
  themeSegs: Array.from(document.querySelectorAll('.theme-seg')),
  eqLow: document.getElementById('stillEqLow'),
  eqMid: document.getElementById('stillEqMid'),
  eqHigh: document.getElementById('stillEqHigh'),
  fieldToggle: document.getElementById('stillFieldToggle'),
  fieldIntensity: document.getElementById('stillFieldIntensity'),
  fieldSpeed: document.getElementById('stillFieldSpeed'),
  glassToggle: document.getElementById('stillGlassToggle'),
  fieldCanvas: document.getElementById('stillField'),
  fieldInfoCanvas: document.getElementById('stillFieldInfo'),
  // Field Lab — renderer parameters exposed under the equaliser
  labPanel: document.getElementById('labPanel'),
  fieldDensity: document.getElementById('fieldDensity'),
  fieldDensityValue: document.getElementById('fieldDensityValue'),
  fieldReach: document.getElementById('fieldReach'),
  fieldReachValue: document.getElementById('fieldReachValue'),
  fieldTrail: document.getElementById('fieldTrail'),
  fieldTrailValue: document.getElementById('fieldTrailValue'),
  fieldDepth: document.getElementById('fieldDepth'),
  fieldDepthValue: document.getElementById('fieldDepthValue'),
  fieldDwell: document.getElementById('fieldDwell'),
  fieldDwellValue: document.getElementById('fieldDwellValue'),
  fpsSegs: Array.from(document.querySelectorAll('.fps-seg')),
  fieldCodeToggle: document.getElementById('fieldCodeToggle'),
  fieldLabReset: document.getElementById('fieldLabReset'),
  /** Floating restore button — only visible when chrome is hidden. */
  chromeToggle: document.getElementById('uiChromeToggle'),
  /** Dedicated minimise action button inside the Still Field card. */
  chromeMinimise: document.getElementById('uiChromeMinimise'),
  minimisedChrome: document.getElementById('minimisedChrome'),
  // Package D/E foundations — toggles already in index.html
  fieldNerdToggle: document.getElementById('stillFieldNerdToggle'),
  fieldTextureToggle: document.getElementById('stillFieldTextureToggle'),
  stillTextureEl: document.querySelector('.still-texture'),
  // Info layer readout + fold + mobile launcher
  nerdHud: document.getElementById('nerdHud'),
  nerdFoldBtn: document.getElementById('nerdFoldBtn'),
  nerdMobileToggle: document.getElementById('nerdMobileToggle'),
  nerdTabs: Array.from(document.querySelectorAll('[data-nerd-view]')),
  nerdViews: Array.from(document.querySelectorAll('.nerd-hud-view')),
  nerdHealth: document.getElementById('nerdHealth'),
  nerdFps: document.getElementById('nerdFps'),
  nerdWork: document.getElementById('nerdWork'),
  nerdNodes: document.getElementById('nerdNodes'),
  nerdLinks: document.getElementById('nerdLinks'),
  nerdPairs: document.getElementById('nerdPairs'),
  nerdGrid: document.getElementById('nerdGrid'),
  nerdTurnover: document.getElementById('nerdTurnover'),
  nerdDegree: document.getElementById('nerdDegree'),
  nerdDensity: document.getElementById('nerdDensity'),
  nerdLabels: document.getElementById('nerdLabels'),
  nerdMode: document.getElementById('nerdMode'),
  nerdWave: document.getElementById('nerdWave'),
  nerdEnergy: document.getElementById('nerdEnergy'),
  nerdLow: document.getElementById('nerdLow'),
  nerdMid: document.getElementById('nerdMid'),
  nerdHigh: document.getElementById('nerdHigh'),
  nerdMeters: {
    low: document.getElementById('nerdMeterLow'),
    mid: document.getElementById('nerdMeterMid'),
    high: document.getElementById('nerdMeterHigh'),
    energy: document.getElementById('nerdMeterEnergy'),
  },
  nerdSource: document.getElementById('nerdSource'),
  nerdDrift: document.getElementById('nerdDrift'),
  nerdUptime: document.getElementById('nerdUptime'),
  nerdSpark: document.getElementById('nerdSpark'),
  nerdSparkCaption: document.getElementById('nerdSparkCaption'),
  // Math view — the symbolic rows each carry a live evaluation
  nerdEval: {
    project: document.getElementById('nerdEvalProject'),
    energy: document.getElementById('nerdEvalEnergy'),
    distance: document.getElementById('nerdEvalDistance'),
    target: document.getElementById('nerdEvalTarget'),
    envelope: document.getElementById('nerdEvalEnvelope'),
    wave: document.getElementById('nerdEvalWave'),
    schedule: document.getElementById('nerdEvalSchedule'),
    grid: document.getElementById('nerdEvalGrid'),
  },
  // Code view — one block per pipeline stage
  nerdStage: {
    update: {
      root: document.getElementById('nerdStageUpdate'),
      ms: document.getElementById('nerdMsUpdate'),
      bar: document.getElementById('nerdBarUpdate'),
      live: document.getElementById('nerdLiveUpdate'),
    },
    links: {
      root: document.getElementById('nerdStageLinks'),
      ms: document.getElementById('nerdMsLinks'),
      bar: document.getElementById('nerdBarLinks'),
      live: document.getElementById('nerdLiveLinks'),
    },
    nodes: {
      root: document.getElementById('nerdStageNodes'),
      ms: document.getElementById('nerdMsNodes'),
      bar: document.getElementById('nerdBarNodes'),
      live: document.getElementById('nerdLiveNodes'),
    },
    info: {
      root: document.getElementById('nerdStageInfo'),
      ms: document.getElementById('nerdMsInfo'),
      bar: document.getElementById('nerdBarInfo'),
      live: document.getElementById('nerdLiveInfo'),
    },
  },
  header: document.querySelector('header'),
  main: document.querySelector('main'),
  footer: document.querySelector('footer'),
};

// ----------------------------------------------------------
// Helpers
// ----------------------------------------------------------

/** Format timer hours for display and aria-valuetext. */
function formatTimerHours(hours) {
  const h = Number(hours) || 0;
  if (h <= 0) return 'Off';
  if (h === 1) return '1 h';
  // Keep half-hours tidy: 1.5 → "1.5 h", 2 → "2 h"
  const label = Number.isInteger(h) ? String(h) : h.toFixed(1);
  return `${label} h`;
}

/** Sync the timer range value, live readout, and ARIA attributes. */
function updateTimerDisplay(hours) {
  const h = Math.max(0, Number(hours) || 0);
  if (els.timer) {
    els.timer.value = String(h);
    els.timer.setAttribute('aria-valuenow', String(h));
    els.timer.setAttribute('aria-valuetext', formatTimerHours(h));
  }
  if (els.timerValue) {
    els.timerValue.textContent = formatTimerHours(h);
  }
}

// ----------------------------------------------------------
// Info layer — stats readout and canvas label placement
// ----------------------------------------------------------

/**
 * Readout refresh interval. Fast enough that the frame rate and band levels
 * feel live, slow enough that it is nowhere near the render loop's budget —
 * writing text forces a style recalculation, so this deliberately does not run
 * per frame.
 */
const NERD_HUD_INTERVAL_MS = 250;

let nerdHudTimerId = null;
/** performance.now() when playback started, or 0 while stopped. */
let playingSinceMs = 0;

/** Write only when the value actually changed — every write costs a recalc. */
function setText(el, value) {
  if (el && el.textContent !== value) el.textContent = value;
}

function setMeter(el, value) {
  if (!el) return;
  const width = `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
  if (el.style.width !== width) el.style.width = width;
}

/**
 * Rolling frame-time trace.
 *
 * Sampled on the readout's own 250 ms tick rather than from the render loop —
 * the loop's contract is that it does no DOM work and no measuring it does not
 * need, and a history buffer it never reads is exactly that. At four samples a
 * second the buffer covers the last seventeen seconds of work.
 */
const SPARK_SAMPLES = 68;
const sparkHistory = new Float32Array(SPARK_SAMPLES);
let sparkWrite = 0;
let sparkFilled = 0;
let sparkCtx = null;
/** Trace colours, re-read on theme change for the same reason the canvas does. */
const sparkColors = { ink: '#8a8a9c', accent: '#a78bfa', warn: '#f59e0b', grid: '#3a3a48' };

function refreshSparkColors() {
  const style = getComputedStyle(document.documentElement);
  const read = (name, fallback) => style.getPropertyValue(name).trim() || fallback;
  sparkColors.ink = read('--text-muted', '#8a8a9c');
  sparkColors.accent = read('--purple-bright', '#a78bfa');
  sparkColors.grid = read('--titanium', '#3a3a48');
}

function pushSparkSample(ms) {
  sparkHistory[sparkWrite] = ms;
  sparkWrite = (sparkWrite + 1) % SPARK_SAMPLES;
  if (sparkFilled < SPARK_SAMPLES) sparkFilled++;
}

/**
 * Paint the trace. Bars are scaled against the current frame budget, so the
 * dashed rule across the middle is always "one frame's worth of time" whatever
 * cap the Field Lab is set to.
 */
function drawSpark(budgetMs) {
  const canvas = els.nerdSpark;
  if (!canvas) return;
  if (!sparkCtx) sparkCtx = canvas.getContext('2d');
  const ctx = sparkCtx;
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const barW = w / SPARK_SAMPLES;
  const scale = h / Math.max(budgetMs, 1);

  // Budget rule at 50% of the visible range, i.e. half a frame of work.
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = sparkColors.grid;
  ctx.fillRect(0, h - Math.min(h - 1, budgetMs * 0.5 * scale), w, 1);

  for (let i = 0; i < sparkFilled; i++) {
    // Oldest sample first, so the trace reads left to right in time.
    const idx = (sparkWrite - sparkFilled + i + SPARK_SAMPLES * 2) % SPARK_SAMPLES;
    const value = sparkHistory[idx];
    const barH = Math.max(1, Math.min(h, value * scale));
    ctx.globalAlpha = value > budgetMs * 0.5 ? 0.95 : 0.6;
    ctx.fillStyle = value > budgetMs * 0.5 ? sparkColors.warn : sparkColors.accent;
    ctx.fillRect(Math.round(i * barW), h - barH, Math.max(1, barW - 1), barH);
  }
  ctx.globalAlpha = 1;
}

/** mm:ss, or h:mm:ss once it runs past an hour. */
function formatUptime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Pull the current numbers and paint them into the readout. */
function updateNerdHud() {
  const stats = stillField.getStillFieldStats();
  const metrics = stillField.getStillAudioMetrics();
  const audioState = audio.getState();
  const ctx = audio.getAudioContext();
  const budgetMs = 1000 / stats.fpsCap;

  setText(els.nerdFps, stats.fps > 0
    ? `${stats.fps.toFixed(1)} / ${stats.fpsCap} fps${stats.reducedMotion ? ' · reduced' : ''}`
    : 'idle');
  setText(els.nerdWork, stats.frameMs > 0
    ? `${stats.frameMs.toFixed(2)} ms · ${Math.round(stats.frameMs / budgetMs * 100)}% budget`
    : 'idle');
  setText(els.nerdNodes, `${stats.nodes} · ${stats.densityScale.toFixed(2)}×`);
  setText(els.nerdLinks, String(stats.edges));
  // The interesting number is not how many pairs we tested but how many we did
  // not have to: the grid is the whole reason the node count is a control.
  setText(els.nerdPairs, stats.bruteTests > 0
    ? `${stats.pairTests} / ${stats.bruteTests} · ${(stats.bruteTests / Math.max(1, stats.pairTests)).toFixed(1)}× saved`
    : '—');
  setText(els.nerdGrid, `${stats.gridCells} cells · r ${Math.round(stats.linkRadius)} u`);
  setText(els.nerdTurnover, stats.turnover > 0
    ? `${stats.turnover.toFixed(1)}/min · life ${stats.meanLifeS.toFixed(0)} s`
    : 'settling');
  setText(els.nerdDegree, stats.meanDegree.toFixed(2));
  setText(els.nerdDensity, `${(stats.density * 100).toFixed(1)}%`);
  setText(els.nerdLabels, `${stats.labels}/${stats.labelCapacity} nodes · ${stats.edgeLabels} edges`);
  setText(els.nerdMode, `${stats.labelMode} · ${stats.modeRemaining.toFixed(1)} s left`);
  setText(els.nerdWave, `${stats.wavePhase.toFixed(0)}° · ∠${stats.waveAngle.toFixed(1)}° · λ ${Math.round(stats.waveLength)} u`);
  setText(els.nerdEnergy, stats.energy.toFixed(3));
  setText(els.nerdLow, metrics.low.toFixed(3));
  setText(els.nerdMid, metrics.mid.toFixed(3));
  setText(els.nerdHigh, metrics.high.toFixed(3));
  setMeter(els.nerdMeters.low, metrics.low);
  setMeter(els.nerdMeters.mid, metrics.mid);
  setMeter(els.nerdMeters.high, metrics.high);
  setMeter(els.nerdMeters.energy, stats.energy);

  const typeName = audioState.type.charAt(0).toUpperCase() + audioState.type.slice(1);
  setText(els.nerdSource, ctx
    ? `${typeName} · ${(ctx.sampleRate / 1000).toFixed(1)} kHz`
    : `${typeName} · idle`);

  setText(els.nerdDrift, `${stats.speed.toFixed(2)}× · ${Math.round(stats.intensity * 100)}%`);
  setText(els.nerdUptime, playingSinceMs > 0
    ? formatUptime(performance.now() - playingSinceMs)
    : '—');

  pushSparkSample(stats.frameMs);
  drawSpark(budgetMs);
  setText(els.nerdSparkCaption, `frame work · ${budgetMs.toFixed(1)} ms budget · ${stats.stage} heaviest`);

  updateMathView(stats);
  updateCodeView(stats);

  // Health is scaled to the chosen cap rather than to a fixed 30 fps, so
  // choosing 60 does not read as "strained" the moment it is selected.
  const health = stats.fps <= 0 ? 'sampling'
    : stats.fps >= stats.fpsCap * 0.9 && stats.frameMs < budgetMs * 0.35 ? 'nominal'
      : stats.fps >= stats.fpsCap * 0.72 && stats.frameMs < budgetMs * 0.7 ? 'loaded' : 'strained';
  if (els.nerdHud) els.nerdHud.dataset.health = health;
  setText(els.nerdHealth, health);
}

/**
 * The Math view's second line: the same equation, with the numbers the renderer
 * is putting through it right now. A formula nobody can check against live
 * values is decoration; a formula with its operands beside it is instrumentation.
 */
function updateMathView(stats) {
  const e = els.nerdEval;
  setText(e.project, `z ${stats.probeZ.toFixed(3)} · δ ${stats.depth.toFixed(2)} → s ${stats.probeScale.toFixed(3)}`);
  setText(e.energy, `b ${stats.probeBreath.toFixed(2)} · w ${stats.probeWave.toFixed(2)} · a ${stats.probeAudio.toFixed(2)} → ${stats.probeEnergy.toFixed(3)}`);
  setText(e.distance, `d ${stats.sampleDistance.toFixed(0)} u · z_w ${Math.round(stats.zWorld)} u`);
  setText(e.target, `r ${Math.round(stats.linkRadius)} u → t ${stats.sampleTarget.toFixed(3)}`);
  setText(e.envelope, `λ 3.2 · Δt ${stats.dt.toFixed(4)} → k ${stats.attackK.toFixed(3)} · s ${stats.sampleStrength.toFixed(3)}`);
  setText(e.wave, `ω 0.55 · ψ ${stats.wavePhase.toFixed(0)}° · λ ${Math.round(stats.waveLength)} u`);
  setText(e.schedule, `D ${stats.dwell} s · ${stats.labelMode} · ${stats.modeRemaining.toFixed(1)} s left`);
  setText(e.grid, `${stats.pairTests} of ${stats.bruteTests} pairs · ${stats.gridCells} cells`);
}

/**
 * The Code view: four pipeline stages, their measured share of the frame, and
 * the values their statements are producing. `data-hot` marks whichever stage
 * currently dominates, which is the same signal that paces the on-canvas ticker.
 */
function updateCodeView(stats) {
  const total = stats.msUpdate + stats.msLinks + stats.msNodes + stats.msInfo;
  const s = els.nerdStage;
  paintStage(s.update, stats.msUpdate, total, stats.stage === 'update',
    `n ${stats.nodes} · dt ${(stats.dt * 1000).toFixed(1)} ms`);
  paintStage(s.links, stats.msLinks, total, stats.stage === 'links',
    `${stats.pairTests} pairs · ${stats.edges} edges · ${stats.batches} paths`);
  paintStage(s.nodes, stats.msNodes, total, stats.stage === 'nodes',
    `${stats.nodes} arcs · E ${stats.probeEnergy.toFixed(2)}`);
  paintStage(s.info, stats.msInfo, total, stats.stage === 'info',
    `${stats.labels} callouts · ${stats.edgeLabels} dimensions`);
}

function paintStage(stage, ms, total, hot, live) {
  if (!stage || !stage.root) return;
  const share = total > 0 ? ms / total : 0;
  setText(stage.ms, total > 0 ? `${ms.toFixed(2)} ms · ${Math.round(share * 100)}%` : '—');
  setMeter(stage.bar, share);
  setText(stage.live, live);
  const flag = hot ? 'true' : 'false';
  if (stage.root.dataset.hot !== flag) stage.root.dataset.hot = flag;
}

/**
 * Show the readout only when the info layer is actually on, and stop polling
 * whenever it is not visible. A hidden page must not keep a timer alive: this
 * app is left running overnight on a locked phone.
 */
function syncNerdHud(state) {
  const on = Boolean(state.nerd && state.enabled);

  if (els.nerdHud) {
    els.nerdHud.hidden = !on;
    els.nerdHud.classList.toggle('nerd-hud--folded', Boolean(state.nerdFolded));
  }

  if (els.nerdFoldBtn) {
    els.nerdFoldBtn.setAttribute('aria-expanded', state.nerdFolded ? 'false' : 'true');
    els.nerdFoldBtn.setAttribute('aria-label', state.nerdFolded ? 'Expand stats panel' : 'Fold stats panel');
    els.nerdFoldBtn.title = state.nerdFolded ? 'Expand' : 'Fold';
  }

  if (els.nerdMobileToggle) {
    els.nerdMobileToggle.setAttribute('aria-pressed', state.nerd ? 'true' : 'false');
  }

  const shouldRun = on && document.visibilityState !== 'hidden';
  if (shouldRun && nerdHudTimerId === null) {
    updateNerdHud();
    nerdHudTimerId = setInterval(updateNerdHud, NERD_HUD_INTERVAL_MS);
  } else if (!shouldRun && nerdHudTimerId !== null) {
    clearInterval(nerdHudTimerId);
    nerdHudTimerId = null;
  }

  // The readout is itself something the canvas labels must dodge.
  scheduleKeepOutMeasure();
}

let keepOutFrameId = null;

/**
 * Measure the chrome and hand the rectangles to the Still Field, so canvas
 * labels are never drawn underneath a card they cannot be read through.
 *
 * Coalesced into one animation frame: resize and scroll both fire in bursts,
 * and `getBoundingClientRect` forces layout.
 */
function scheduleKeepOutMeasure() {
  if (keepOutFrameId !== null) return;
  keepOutFrameId = requestAnimationFrame(() => {
    keepOutFrameId = null;
    measureKeepOuts();
  });
}

function measureKeepOuts() {
  const rects = [];

  // The readout floats above everything, so it is in the way in both layouts.
  if (els.nerdHud && !els.nerdHud.hidden) rects.push(els.nerdHud.getBoundingClientRect());

  if (uiChrome.isHidden()) {
    // Immersion mode: the full interface is gone and the field is open. Only
    // the floating cluster is left to avoid.
    if (els.minimisedChrome) rects.push(els.minimisedChrome.getBoundingClientRect());
  } else {
    if (els.header) rects.push(els.header.getBoundingClientRect());
    if (els.main) rects.push(els.main.getBoundingClientRect());
    if (els.footer) rects.push(els.footer.getBoundingClientRect());
  }

  stillField.setLabelKeepOuts(rects);
}

// ----------------------------------------------------------
// Renderers — the only place the UI is written to
// ----------------------------------------------------------

/** @param {ReturnType<typeof audio.getState>} state */
function renderAudio(state) {
  const { playBtn, minimisedPlayBtn } = els;

  // Main play button
  playBtn.classList.toggle('playing', state.isPlaying);
  playBtn.setAttribute('aria-label', state.isPlaying ? 'Pause noise' : 'Play noise');
  playBtn.setAttribute('aria-pressed', state.isPlaying ? 'true' : 'false');

  const icon = state.isPlaying ? PAUSE_ICON : PLAY_ICON;
  if (playBtn.dataset.icon !== (state.isPlaying ? 'pause' : 'play')) {
    playBtn.innerHTML = icon;
    playBtn.dataset.icon = state.isPlaying ? 'pause' : 'play';
  }

  // Minimised play button (mirrors the same state)
  if (minimisedPlayBtn) {
    minimisedPlayBtn.classList.toggle('playing', state.isPlaying);
    minimisedPlayBtn.setAttribute('aria-label', state.isPlaying ? 'Pause noise' : 'Play noise');
    minimisedPlayBtn.setAttribute('aria-pressed', state.isPlaying ? 'true' : 'false');
    const miniIcon = state.isPlaying ? MINI_PAUSE_ICON : MINI_PLAY_ICON;
    if (minimisedPlayBtn.dataset.icon !== (state.isPlaying ? 'pause' : 'play')) {
      minimisedPlayBtn.innerHTML = miniIcon;
      minimisedPlayBtn.dataset.icon = state.isPlaying ? 'pause' : 'play';
    }
  }

  els.typeButtons.forEach(btn => {
    const active = btn.dataset.type === state.type;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  // Status appears in both the main card and the minimised cluster
  if (els.status) els.status.textContent = state.status;
  if (els.minimisedStatus) els.minimisedStatus.textContent = state.status;

  els.volume.setAttribute('aria-valuenow', String(state.volume));
  els.volume.setAttribute('aria-valuetext', `${Math.round(state.volume * 100)} percent`);

  // Keep the timer readout in sync when the engine changes the value
  updateTimerDisplay(state.timerHours);

  // Uptime is a display concern, so it is derived here rather than kept in the
  // engine. Only restart the clock on an actual stopped → playing transition;
  // renderAudio also fires for volume and timer changes mid-session.
  if (state.isPlaying && playingSinceMs === 0) {
    playingSinceMs = performance.now();
  } else if (!state.isPlaying) {
    playingSinceMs = 0;
  }
}

/** @param {ReturnType<typeof stillField.getState>} state */
function renderStillField(state) {
  els.fieldToggle.setAttribute('aria-checked', state.enabled ? 'true' : 'false');
  els.fieldIntensity.disabled = !state.enabled;
  els.fieldSpeed.disabled = !state.enabled;
  els.fieldIntensity.setAttribute('aria-valuetext', `${Math.round(state.intensity * 100)} percent`);
  els.fieldSpeed.setAttribute('aria-valuetext', `${state.speed.toFixed(2)} times`);

  // Stats card button (distinctive control, not a still-switch)
  if (els.fieldNerdToggle) {
    els.fieldNerdToggle.setAttribute('aria-pressed', state.nerd ? 'true' : 'false');
    // Labels are painted on the canvas, so the control is dead while the field
    // is off — disable it alongside the sliders rather than leaving it live.
    els.fieldNerdToggle.disabled = !state.enabled;
  }
  // The texture is a separate CSS overlay, not part of the canvas, so it stays
  // available even with the field switched off.
  if (els.fieldTextureToggle) {
    els.fieldTextureToggle.setAttribute('aria-checked', state.texture ? 'true' : 'false');
  }
  // Clearing the inline value hands opacity back to the per-theme CSS variable.
  if (els.stillTextureEl) {
    els.stillTextureEl.style.opacity = state.texture ? '' : '0';
  }

  renderFieldLab(state);

  els.nerdTabs.forEach(tab => {
    const active = tab.dataset.nerdView === state.nerdView;
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
    tab.tabIndex = active ? 0 : -1;
  });
  els.nerdViews.forEach(view => {
    view.hidden = view.id !== `nerdView${state.nerdView[0].toUpperCase()}${state.nerdView.slice(1)}`;
  });

  // The stats readout is the other half of the info layer, so it follows the
  // same toggle as the on-canvas labels. Also applies fold class.
  syncNerdHud(state);
}

/**
 * Field Lab renderer.
 *
 * Slider positions are written here too, not only in `restoreControlValues()`:
 * the reset button changes the settings rather than the inputs, and this is the
 * one path that puts the inputs back where the state says they belong.
 *
 * @param {ReturnType<typeof stillField.getState>} state
 */
function renderFieldLab(state) {
  // Everything in the Lab shapes the canvas, so it is all dead while the field
  // is off — same reasoning as the intensity and speed sliders.
  const off = !state.enabled;

  setRange(els.fieldDensity, state.density, `${state.density.toFixed(2)} times`, off);
  setText(els.fieldDensityValue, `${state.density.toFixed(2)}×`);

  setRange(els.fieldReach, state.reach, `${state.reach.toFixed(2)} times`, off);
  setText(els.fieldReachValue, `${state.reach.toFixed(2)}×`);

  // The slider carries the tail's time constant; the renderer holds its rate.
  // Rounded to the slider's own step, or the input would snap the value it is
  // handed and disagree with this renderer on every subsequent pass.
  const tau = Math.round(100 / state.trail) / 100;
  setRange(els.fieldTrail, tau, `${tau.toFixed(2)} seconds`, off);
  setText(els.fieldTrailValue, `${tau.toFixed(2)} s`);

  setRange(els.fieldDepth, state.depth, `${state.depth.toFixed(2)} depth`, off);
  setText(els.fieldDepthValue, state.depth.toFixed(2));

  setRange(els.fieldDwell, state.dwell, `${state.dwell} seconds`, off);
  setText(els.fieldDwellValue, `${state.dwell} s`);

  els.fpsSegs.forEach(btn => {
    const active = Number(btn.dataset.fps) === state.fps;
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    btn.disabled = off;
  });

  if (els.fieldCodeToggle) {
    els.fieldCodeToggle.setAttribute('aria-checked', state.code ? 'true' : 'false');
    // The overlay is drawn by the info layer, so it needs both switches on.
    els.fieldCodeToggle.disabled = off || !state.nerd;
  }
  if (els.fieldLabReset) els.fieldLabReset.disabled = off;
}

/** Set a range's position, its spoken value and its disabled state in one go. */
function setRange(el, value, valueText, disabled) {
  if (!el) return;
  const next = String(value);
  if (el.value !== next) el.value = next;
  el.setAttribute('aria-valuetext', valueText);
  el.disabled = disabled;
}

/** @param {ReturnType<typeof theme.getState>} state */
function renderTheme(state) {
  // Segmented control — mark the active side
  els.themeSegs.forEach(btn => {
    const active = btn.dataset.theme === state.theme;
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  els.glassToggle.setAttribute('aria-checked', state.glass === 'ultra' ? 'true' : 'false');

  // Canvas colours come from CSS custom properties, so they must be re-read
  // whenever the token set changes. The frame-time trace is a canvas too.
  stillField.refreshThemeColors();
  refreshSparkColors();
}

/** @param {ReturnType<typeof uiChrome.getState>} state */
function renderChrome(state) {
  const hidden = state.hidden;
  document.documentElement.setAttribute('data-ui-chrome', hidden ? 'hidden' : 'visible');

  // Floating restore is the only way back; keep it correctly labelled and
  // out of the tab order while chrome is visible.
  if (els.chromeToggle) {
    const label = 'Show controls';
    els.chromeToggle.setAttribute('aria-label', label);
    els.chromeToggle.setAttribute('aria-pressed', hidden ? 'true' : 'false');
    els.chromeToggle.title = label;
    // Always keep the text + icon markup (it is static once written).
    if (!els.chromeToggle.querySelector('.chrome-toggle-text')) {
      els.chromeToggle.innerHTML = SHOW_CONTROLS_HTML;
    }
    els.chromeToggle.tabIndex = hidden ? 0 : -1;
    els.chromeToggle.setAttribute('aria-hidden', hidden ? 'false' : 'true');
  }

  if (els.minimisedChrome) {
    els.minimisedChrome.setAttribute('aria-hidden', hidden ? 'false' : 'true');
  }

  // Minimising frees most of the screen; restoring takes it back. Either way
  // the label keep-out has just changed shape.
  scheduleKeepOutMeasure();

  // After restore, move focus to the minimise button so keyboard users
  // are not stranded on the now-inert floating control (or the body).
  if (!hidden && els.chromeMinimise) {
    const active = document.activeElement;
    if (active === document.body || active === els.chromeToggle || active === els.minimisedPlayBtn) {
      els.chromeMinimise.focus({ preventScroll: true });
    }
  }
}

// ----------------------------------------------------------
// Restore control positions from persisted state
// ----------------------------------------------------------
function restoreControlValues() {
  els.volume.value = audio.getCurrentVolume();

  updateTimerDisplay(audio.getTimerHours());

  const eq = audio.getStillEqValues();
  els.eqLow.value = eq.low;
  els.eqMid.value = eq.mid;
  els.eqHigh.value = eq.high;

  els.fieldIntensity.value = stillField.getStillFieldIntensity();
  els.fieldSpeed.value = stillField.getStillFieldSpeed();
}

/**
 * Wire a `role="switch"` button. `<button>` gives Enter for free, but Space
 * needs the keydown guard or the page scrolls instead of toggling.
 * @param {HTMLElement} el
 * @param {() => void} toggle
 */
function bindSwitch(el, toggle) {
  if (!el) return;
  el.addEventListener('click', toggle);
  el.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      toggle();
    }
  });
}

/** Shared play / pause action used by both the main and minimised buttons. */
function togglePlayback() {
  if (audio.getIsPlaying()) {
    audio.stop(true);
  } else {
    audio.play()
      .then(() => stillField.startStillFieldLoop())
      .catch(err => console.error('[complex-noise] playback failed', err));
  }
}

// ----------------------------------------------------------
// Event listeners — these only call into state modules
// ----------------------------------------------------------
function bindEvents() {
  els.playBtn.addEventListener('click', togglePlayback);
  if (els.minimisedPlayBtn) {
    els.minimisedPlayBtn.addEventListener('click', togglePlayback);
  }

  els.typeButtons.forEach(btn => {
    btn.addEventListener('click', () => audio.setType(btn.dataset.type));
  });

  els.volume.addEventListener('input', e => audio.setVolume(parseFloat(e.target.value)));

  // Sleep timer is now a continuous range (0–10 h, 0.5 steps)
  els.timer.addEventListener('input', e => {
    const hours = parseFloat(e.target.value) || 0;
    updateTimerDisplay(hours);
    audio.setTimerHours(hours);
  });

  els.eqLow.addEventListener('input', e => audio.setStillEqLow(parseFloat(e.target.value)));
  els.eqMid.addEventListener('input', e => audio.setStillEqMid(parseFloat(e.target.value)));
  els.eqHigh.addEventListener('input', e => audio.setStillEqHigh(parseFloat(e.target.value)));

  bindSwitch(els.fieldToggle, () => {
    stillField.setStillFieldEnabled(!stillField.getStillFieldEnabled());
  });

  bindSwitch(els.glassToggle, () => theme.toggleGlassMode());

  // Stats card button (distinctive control)
  if (els.fieldNerdToggle) {
    els.fieldNerdToggle.addEventListener('click', () => {
      stillField.setStillFieldNerd(!stillField.getStillFieldNerd());
    });
  }
  bindSwitch(els.fieldTextureToggle, () => {
    stillField.setStillFieldTexture(!stillField.getStillFieldTexture());
  });

  // Fold control on the HUD itself
  if (els.nerdFoldBtn) {
    els.nerdFoldBtn.addEventListener('click', () => stillField.toggleNerdFolded());
  }

  // Mobile top-left Stats launcher
  if (els.nerdMobileToggle) {
    els.nerdMobileToggle.addEventListener('click', () => {
      stillField.setStillFieldNerd(!stillField.getStillFieldNerd());
    });
  }

  els.nerdTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => stillField.setNerdView(tab.dataset.nerdView));
    tab.addEventListener('keydown', event => {
      const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!direction) return;
      event.preventDefault();
      const next = els.nerdTabs[(index + direction + els.nerdTabs.length) % els.nerdTabs.length];
      stillField.setNerdView(next.dataset.nerdView);
      next.focus();
    });
  });

  els.fieldIntensity.addEventListener('input', e => {
    stillField.setStillFieldIntensity(parseFloat(e.target.value));
  });

  els.fieldSpeed.addEventListener('input', e => {
    stillField.setStillFieldSpeed(parseFloat(e.target.value));
  });

  // --- Field Lab ---
  if (els.fieldDensity) {
    els.fieldDensity.addEventListener('input', e => {
      stillField.setStillFieldDensity(parseFloat(e.target.value));
    });
  }
  if (els.fieldReach) {
    els.fieldReach.addEventListener('input', e => {
      stillField.setStillFieldReach(parseFloat(e.target.value));
    });
  }
  if (els.fieldTrail) {
    // Slider is the tail's time constant in seconds; the renderer wants a rate.
    els.fieldTrail.addEventListener('input', e => {
      const tau = parseFloat(e.target.value);
      if (tau > 0) stillField.setStillFieldTrail(1 / tau);
    });
  }
  if (els.fieldDepth) {
    els.fieldDepth.addEventListener('input', e => {
      stillField.setStillFieldDepth(parseFloat(e.target.value));
    });
  }
  if (els.fieldDwell) {
    els.fieldDwell.addEventListener('input', e => {
      stillField.setStillFieldDwell(parseFloat(e.target.value));
    });
  }
  els.fpsSegs.forEach(btn => {
    btn.addEventListener('click', () => stillField.setStillFieldFps(Number(btn.dataset.fps)));
  });
  bindSwitch(els.fieldCodeToggle, () => {
    stillField.setStillFieldCode(!stillField.getStillFieldCode());
  });
  if (els.fieldLabReset) {
    els.fieldLabReset.addEventListener('click', () => {
      stillField.setStillFieldDensity(DEFAULTS.stillFieldDensity);
      stillField.setStillFieldReach(DEFAULTS.stillFieldReach);
      stillField.setStillFieldTrail(DEFAULTS.stillFieldTrail);
      stillField.setStillFieldDepth(DEFAULTS.stillFieldDepth);
      stillField.setStillFieldDwell(DEFAULTS.stillFieldDwell);
      stillField.setStillFieldFps(DEFAULTS.stillFieldFps);
      stillField.setStillFieldCode(DEFAULTS.stillFieldCode);
    });
  }

  // Theme segmented control — each side sets the theme directly
  els.themeSegs.forEach(btn => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.theme;
      if (next) theme.applyStillTheme(next);
    });
  });

  // Dedicated minimise button — always hides chrome (restore via floating control or Escape)
  if (els.chromeMinimise) {
    els.chromeMinimise.addEventListener('click', () => uiChrome.setHidden(true));
  }

  // Floating restore button (only present / interactive when hidden).
  if (els.chromeToggle) {
    els.chromeToggle.addEventListener('click', () => uiChrome.setHidden(false));
  }

  // Escape always restores chrome when hidden — desktop / keyboard safety net.
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && uiChrome.isHidden()) {
      e.preventDefault();
      uiChrome.setHidden(false);
    }
  });

  // Prevent accidental pinch-zoom on some Android browsers
  document.addEventListener('gesturestart', e => e.preventDefault());

  window.addEventListener('resize', stillField.handleResize);
  window.addEventListener('orientationchange', stillField.handleResize);

  // The chrome moves under the canvas as the page scrolls or reflows, so the
  // label keep-out has to follow it.
  window.addEventListener('resize', scheduleKeepOutMeasure);
  window.addEventListener('orientationchange', scheduleKeepOutMeasure);
  window.addEventListener('scroll', scheduleKeepOutMeasure, { passive: true });

  // Opening or closing either disclosure panel resizes the control column.
  const stillPanel = document.getElementById('stillPanel');
  if (stillPanel) stillPanel.addEventListener('toggle', scheduleKeepOutMeasure);
  if (els.labPanel) els.labPanel.addEventListener('toggle', scheduleKeepOutMeasure);

  // Never leave the readout's timer running against a locked screen.
  document.addEventListener('visibilitychange', () => syncNerdHud(stillField.getState()));
}

// ----------------------------------------------------------
// Boot
// ----------------------------------------------------------
function boot() {
  // Apply the persisted theme before anything measures colours.
  theme.applyStillTheme(theme.getStillTheme());

  restoreControlValues();
  bindEvents();

  refreshSparkColors();
  stillField.initStillField(els.fieldCanvas, els.fieldInfoCanvas);

  // subscribe() fires immediately, so this is also the initial render.
  audio.subscribe(renderAudio);
  stillField.subscribe(renderStillField);
  theme.subscribe(renderTheme);
  uiChrome.subscribe(renderChrome);

  // Measure synchronously rather than on the next animation frame: the render
  // loop starts inside initStillField(), and its first frame would otherwise
  // run against an empty keep-out and paint labels under the controls.
  measureKeepOuts();

  // Debug surface for future agents and for the browser smoke tests.
  // Keep this in sync with tests/run.mjs.
  window.complexNoiseStill = {
    getTheme: theme.getStillTheme,
    getGlassMode: theme.getGlassMode,
    getEnergy: stillField.getStillEnergy,
    getMetrics: stillField.getStillAudioMetrics,
    getAudioState: audio.getState,
    getFieldState: stillField.getState,
    getFieldStats: stillField.getStillFieldStats,
    getChromeState: uiChrome.getState,
    getIsPlaying: audio.getIsPlaying,
    getCurrentType: audio.getCurrentType,
    getAudioContext: audio.getAudioContext,
  };
}

// Module scripts are deferred, so the DOM is already parsed here.
boot();

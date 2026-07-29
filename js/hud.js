/**
 * The stats panel's content — every string it shows, and none of its DOM.
 *
 * `#nerdHud` is the other half of the info layer: the same measurements the
 * canvas draws on itself, in a panel you can actually read. It used to live
 * inside `app.js`, which made that file the largest in the project and mixed a
 * page's worth of formatting decisions in with the event wiring.
 *
 * ## Why this module has no DOM in it
 *
 * The one architectural rule is that `app.js` is the only module that touches
 * the app's DOM. A `hud.js` that wrote into `#nerdHud` would be a second one,
 * and the exception would then be available to the next module that wanted it.
 *
 * So the split is along a different line: **this file turns numbers into
 * strings, `app.js` puts strings into elements.** Every function here is pure —
 * same stats in, same strings out, no globals read, nothing touched. That is
 * what makes the formatting testable without a browser at all, which is the
 * whole reason the arithmetic was worth moving.
 *
 * ## Fresh objects, deliberately
 *
 * These builders return new objects. `getStillFieldStats()` deliberately does
 * the opposite — it reuses one snapshot, because the renderer's contract is to
 * allocate nothing — but that argument does not reach here. These run on the
 * panel's 250 ms tick, four times a second, only while the panel is open and the
 * page is visible; that is roughly one object per second per view against a
 * render loop doing thirty frames in the same time. Purity is worth more than
 * four objects a second, and a builder that mutated a shared row object could
 * not be tested by comparing two calls.
 *
 * The keys are the contract: `app.js` maps each one to an element, so a key
 * added here without an element is silently dropped rather than throwing, and a
 * key removed leaves the element showing its last value. `tests/run.mjs` checks
 * the mapping covers the keys.
 */

/**
 * How hard the renderer is working, as one word.
 *
 * Scaled to the chosen frame cap rather than a fixed 30 fps, so choosing 60 does
 * not read as "strained" the moment it is picked.
 *
 * Renderer work leads and the delivered frame rate only moderates it. A cap is
 * honoured by *waiting*, so the rate wobbles a frame either side of it on any
 * machine — reading that wobble as strain while the renderer is using 1% of its
 * budget is the readout lying about its own measurements. Hence both terms: the
 * work has to be low *and* the rate has to be close to the cap.
 *
 * @param {object} stats snapshot from `getStillFieldStats()`
 * @param {number} budgetMs milliseconds in one frame at the current cap
 * @returns {'sampling'|'nominal'|'loaded'|'strained'}
 */
export function healthLevel(stats, budgetMs) {
  if (stats.fps <= 0) return 'sampling';
  const load = stats.frameMs / budgetMs;
  const rate = stats.fps / stats.fpsCap;
  if (load < 0.4 && rate >= 0.8) return 'nominal';
  if (load < 0.75 && rate >= 0.6) return 'loaded';
  return 'strained';
}

/** "callouts · dimensions · source", or "none". */
export function describeOverlays(stats) {
  const on = [];
  if (stats.calloutsOn) on.push('callouts');
  if (stats.edgesOn) on.push('dimensions');
  if (stats.codeOverlay) on.push(stats.codeFolded ? 'source (folded)' : 'source');
  return on.length ? on.join(' · ') : 'none';
}

/**
 * Neighbours a node should expect inside the link radius, from the mean spacing
 * the world plane implies: `π(r / spacing)² − 1`.
 *
 * This is the expression the link radius is *derived* from (see `world.js`), so
 * printing it beside the measured mean degree is a check on the derivation
 * rather than trivia — if the two drift apart, one of them is wrong.
 */
export function expectedDegree(stats) {
  if (!stats.nodes || !stats.worldW || !stats.worldH) return 0;
  const spacing = Math.sqrt((stats.worldW * stats.worldH) / stats.nodes);
  return Math.max(0, Math.PI * (stats.linkRadius / spacing) ** 2 - 1);
}

/**
 * Bytes as KiB, or MiB once the figure would need four digits.
 *
 * The renderer's buffers span three orders of magnitude — a 7 KiB link buffer
 * next to a 1.7 MiB transcript raster — and "1740.8 KiB" is a number nobody
 * reads as "most of two megabytes".
 */
export function formatBytes(bytes) {
  const kib = bytes / 1024;
  return kib >= 1024 ? `${(kib / 1024).toFixed(2)} MiB` : `${kib.toFixed(1)} KiB`;
}

/** mm:ss, or h:mm:ss once it runs past an hour. Negative reads as "not yet". */
export function formatUptime(ms) {
  if (!(ms >= 0)) return '—';
  const total = Math.floor(ms / 1000);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * The Live view: one string per row, keyed by row name.
 *
 * @param {object} stats snapshot from `getStillFieldStats()`
 * @param {{low: number, mid: number, high: number}} metrics band energies
 * @param {{type: string, sampleRate: number}} source the audio engine's colour,
 *   and its context sample rate — 0 while no context exists yet
 * @param {number} budgetMs milliseconds in one frame at the current cap
 * @param {number} uptimeMs milliseconds of continuous playback, or −1 if stopped
 */
export function liveRows(stats, metrics, source, budgetMs, uptimeMs) {
  const typeName = source.type ? source.type.charAt(0).toUpperCase() + source.type.slice(1) : '—';
  return {
    fps: stats.fps > 0
      ? `${stats.fps.toFixed(1)} / ${stats.fpsCap} fps${stats.reducedMotion ? ' · reduced' : ''}`
      : 'idle',
    work: stats.frameMs > 0
      ? `${stats.frameMs.toFixed(2)} ms · ${Math.round(stats.frameMs / budgetMs * 100)}% budget`
      : 'idle',
    budget: stats.frameMs > 0
      ? `${budgetMs.toFixed(1)} ms · ${Math.max(0, Math.round((1 - stats.frameMs / budgetMs) * 100))}% headroom`
      : `${budgetMs.toFixed(1)} ms`,

    nodes: `${stats.nodes} · ${stats.densityScale.toFixed(2)}×`,
    // Painted edges *and* how many paths carried them: the batching ratio is the
    // difference between a claim about efficiency and a measurement of it.
    links: stats.batches > 0
      ? `${stats.edges} · ${stats.batches} paths · ${(stats.edges / stats.batches).toFixed(1)}×`
      : String(stats.edges),
    // The interesting number is not how many pairs we tested but how many we did
    // not have to: the grid is the whole reason the node count is a control.
    pairs: stats.bruteTests > 0
      ? `${stats.pairTests} / ${stats.bruteTests} · ${(stats.bruteTests / Math.max(1, stats.pairTests)).toFixed(1)}× saved`
      : '—',
    grid: `${stats.gridCells} cells · r ${Math.round(stats.linkRadius)} u`,
    occupancy: `${stats.occupancy.toFixed(2)} /cell · ${Math.round(stats.gridCell)} u`,
    degree: `x̄ ${stats.meanDegree.toFixed(2)} · max ${stats.maxDegree}`,
    density: `${(stats.density * 100).toFixed(1)}%`,
    turnover: stats.turnover > 0
      ? `${stats.turnover.toFixed(1)}/min · life ${stats.meanLifeS.toFixed(0)} s`
      : 'settling',

    // The side count is cumulative on purpose. A rate would read as noise; a
    // total that sits still for minutes is the honest way to show that the
    // placement has settled, and the one that moves if the hysteresis breaks.
    labels: stats.calloutsOn
      ? `${stats.labels} of ${stats.labelCapacity} placed · ${stats.calloutFlips} side`
      : 'off',
    mode: stats.calloutsOn
      ? `${stats.labelMode} · ${stats.modesOnScreen}/${stats.modeCount} · ${stats.modeRemaining.toFixed(1)} s`
      : `${stats.labelMode} · ${stats.modeRemaining.toFixed(1)} s`,
    dims: stats.edgesOn
      ? `${stats.edgeLabels} shown · ${stats.edgeSlots} slots held`
      : 'off',
    overlays: describeOverlays(stats),

    wave: `${stats.wavePhase.toFixed(0)}° · ∠${stats.waveAngle.toFixed(1)}° · λ ${Math.round(stats.waveLength)} u`,
    world: `${Math.round(stats.worldW)} × ${Math.round(stats.worldH)} u · s ${stats.minScale.toFixed(2)}`,
    viewport: `${stats.viewportW} × ${stats.viewportH} · dpr ${stats.dpr}`,
    trail: `τ ${(1 / stats.trail).toFixed(2)} s · ${stats.trail.toFixed(1)}/s`,
    glow: `${stats.glowNodes} of ${stats.glowCap}${stats.reducedMotion ? ' · suppressed' : ''}`,
    clock: `drift ${Math.round(stats.clock)} s · real ${Math.round(stats.realClock)} s`,
    // The allocation figure is a claim the renderer is written to keep, so it is
    // stated where it can be argued with rather than only in a comment.
    //
    // The steady figure is the link buffer plus the grid — both high-water-marked,
    // both there for the life of the session. The transcript raster is called out
    // separately because it is the only one that comes and goes, it is two orders
    // of magnitude larger than the other two put together, and watching it
    // disappear when you fold the listing is how you can tell it is really being
    // released rather than merely documented as conditional.
    buffers: stats.rasterBytes > 0
      ? `${formatBytes(stats.linkBytes + stats.gridBytes)} · ${formatBytes(stats.rasterBytes)} raster · 0 alloc/frame`
      : `${formatBytes(stats.linkBytes + stats.gridBytes)} · 0 alloc/frame`,

    energy: stats.energy.toFixed(3),
    low: metrics.low.toFixed(3),
    mid: metrics.mid.toFixed(3),
    high: metrics.high.toFixed(3),

    source: source.sampleRate > 0
      ? `${typeName} · ${(source.sampleRate / 1000).toFixed(1)} kHz`
      : `${typeName} · idle`,
    drift: `${stats.speed.toFixed(2)}× · ${Math.round(stats.intensity * 100)}%`,
    uptime: formatUptime(uptimeMs),
  };
}

/** The Live view's four bar meters, as 0–1 fractions. */
export function liveMeters(stats, metrics) {
  return { low: metrics.low, mid: metrics.mid, high: metrics.high, energy: stats.energy };
}

/** The trace's caption. `peakMs` is the tallest sample currently in the window. */
export function sparkCaption(stats, peakMs, budgetMs) {
  return `17 s · peak ${peakMs.toFixed(2)} ms · ${budgetMs.toFixed(1)} ms budget · ${stats.stage} heaviest`;
}

/**
 * The Math view's second line: the same equation, with the numbers the renderer
 * is putting through it right now. A formula nobody can check against live
 * values is decoration; a formula with its operands beside it is instrumentation.
 */
export function mathRows(stats) {
  return {
    project: `z ${stats.probeZ.toFixed(3)} · δ ${stats.depth.toFixed(2)} → s ${stats.probeScale.toFixed(3)}`,
    energy: `b ${stats.probeBreath.toFixed(2)} · w ${stats.probeWave.toFixed(2)} · a ${stats.probeAudio.toFixed(2)} → ${stats.probeEnergy.toFixed(3)}`,
    distance: `d ${stats.sampleDistance.toFixed(0)} u · z_w ${Math.round(stats.zWorld)} u`,
    target: `r ${Math.round(stats.linkRadius)} u → t ${stats.sampleTarget.toFixed(3)}`,
    envelope: `λ 3.2 · Δt ${stats.dt.toFixed(4)} → k ${stats.attackK.toFixed(3)} · s ${stats.sampleStrength.toFixed(3)}`,
    wave: `ω 0.55 · ψ ${stats.wavePhase.toFixed(0)}° · λ ${Math.round(stats.waveLength)} u`,
    schedule: `D ${stats.dwell} s · ${stats.labelMode} · ${stats.modeRemaining.toFixed(1)} s left`,
    grid: `${stats.pairTests} of ${stats.bruteTests} pairs · ${stats.gridCells} cells`,
    life: `f_in 0.10 · f_out 0.16 · x̄ life ${stats.meanLifeS.toFixed(0)} s`,
    spawn: `1/g 0.7549 · 1/g² 0.5698 · ${stats.turnover.toFixed(1)} spawns/min`,
    trail: `r ${stats.trail.toFixed(1)}/s · Δt ${stats.dt.toFixed(4)} → α ${(1 - Math.exp(-stats.trail * stats.dt)).toFixed(3)}`,
    neighbours: `r ${Math.round(stats.linkRadius)} u → E[deg] ${expectedDegree(stats).toFixed(2)} · x̄ ${stats.meanDegree.toFixed(2)}`,
    detail: `M ${stats.modeCount} · base ${stats.labelMode} · ${stats.modesOnScreen} distinct on screen`,
  };
}

/**
 * The Code view: four pipeline stages, their measured share of the frame, and
 * the values their statements are producing.
 *
 * `hot` marks whichever stage currently dominates — the same signal that paces
 * the on-canvas ticker, which is the point: the panel and the overlay are
 * reading one measurement, not two that happen to agree.
 *
 * @returns {{stages: object, total: string}} per-stage `{ms, share, hot, live,
 *   live2}` keyed by stage name, plus the formatted total
 */
export function codeStages(stats, budgetMs) {
  const total = stats.msUpdate + stats.msLinks + stats.msNodes + stats.msInfo;
  const stage = (ms, hot, live, live2) => ({
    ms: total > 0 ? `${ms.toFixed(2)} ms · ${Math.round(ms / total * 100)}%` : '—',
    share: total > 0 ? ms / total : 0,
    hot,
    live,
    live2,
  });

  return {
    stages: {
      update: stage(stats.msUpdate, stats.stage === 'update',
        `n ${stats.nodes} · dt ${(stats.dt * 1000).toFixed(1)} ms`,
        `z ${stats.probeZ.toFixed(3)} → s ${stats.probeScale.toFixed(3)} · ${stats.turnover.toFixed(1)} spawns/min`),
      links: stage(stats.msLinks, stats.stage === 'links',
        `${stats.pairTests} pairs · ${stats.edges} edges · ${stats.batches} paths`,
        `x̄ deg ${stats.meanDegree.toFixed(2)} · max ${stats.maxDegree} · ${stats.gridCells} cells`),
      nodes: stage(stats.msNodes, stats.stage === 'nodes',
        `${stats.nodes} arcs · E ${stats.probeEnergy.toFixed(2)}`,
        `${stats.glowNodes} of ${stats.glowCap} glow · shadowBlur rationed`),
      info: stage(stats.msInfo, stats.stage === 'info',
        `${stats.labels} callouts · ${stats.edgeLabels} dimensions`,
        `${stats.modesOnScreen} of ${stats.modeCount} modes · ${describeOverlays(stats)}`),
    },
    total: total > 0
      ? `${total.toFixed(2)} ms of ${budgetMs.toFixed(1)} ms · ${Math.round(total / budgetMs * 100)}%`
      : '—',
  };
}

/**
 * Repeatable Still Field profiling harness.
 *
 * This is deliberately separate from the pass/fail suite: performance numbers
 * describe one browser and machine, and are evidence rather than a portable
 * assertion. Run with:
 *
 *   PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium \
 *     node tests/profile-still-field.mjs
 *
 * Add `--filter=desktop-150-source` for the steady source-only case. Add
 * `--churn` for the separate fold/unfold and stop/start interaction profile,
 * and optionally `--dpr=2` to exercise the renderer's backing-store cap.
 *
 * The 150-node scenarios use the renderer's documented hard ceiling rather
 * than the Field Lab's user-facing density range. The harness temporarily sets
 * the exported settings object from DevTools and immediately asks the owning
 * population module to reconcile; production code and persisted controls are
 * unchanged.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright';
import { startServer } from './server.mjs';

const ROOT = process.env.PROFILE_ROOT
  ? resolve(process.env.PROFILE_ROOT)
  : resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
const WARMUP_MS = 8000;
const SAMPLE_MS = 12000;
const SAMPLE_INTERVAL_MS = 250;
const CPU_THROTTLE = 4;
const CHURN_BASELINE_MS = 3000;
const CHURN_SETTLE_MS = 250;
const CHURN_CYCLES = 12;
const filterArg = process.argv.find(arg => arg.startsWith('--filter='));
const filter = filterArg ? filterArg.slice('--filter='.length) : '';
const churn = process.argv.includes('--churn');
const dprArg = process.argv.find(arg => arg.startsWith('--dpr='));
const deviceScaleFactor = dprArg ? Number(dprArg.slice('--dpr='.length)) : 1;
if (!Number.isFinite(deviceScaleFactor) || deviceScaleFactor <= 0 || deviceScaleFactor > 2) {
  throw new Error('--dpr must be greater than 0 and no greater than the renderer cap of 2');
}

const scenarios = [
  {
    name: 'desktop-default-all',
    viewport: { width: 1440, height: 900 },
    nodes: 'default',
    overlays: { callouts: true, edges: true, code: true },
    throttle: 1,
    minimise: false,
  },
  {
    name: 'desktop-150-all',
    viewport: { width: 1440, height: 900 },
    nodes: 150,
    overlays: { callouts: true, edges: true, code: true },
    throttle: CPU_THROTTLE,
    minimise: false,
  },
  {
    name: 'desktop-150-none',
    viewport: { width: 1440, height: 900 },
    nodes: 150,
    overlays: { callouts: false, edges: false, code: false },
    throttle: CPU_THROTTLE,
    minimise: false,
  },
  {
    name: 'mobile-150-all',
    viewport: { width: 412, height: 915 },
    nodes: 150,
    overlays: { callouts: true, edges: true, code: true },
    throttle: CPU_THROTTLE,
    minimise: true,
  },
  {
    name: 'mobile-150-none',
    viewport: { width: 412, height: 915 },
    nodes: 150,
    overlays: { callouts: false, edges: false, code: false },
    throttle: CPU_THROTTLE,
    minimise: true,
  },
];

const focusedDesktop = [
  ['desktop-150-callouts', { callouts: true, edges: false, code: false }],
  ['desktop-150-dimensions', { callouts: false, edges: true, code: false }],
  ['desktop-150-source', { callouts: false, edges: false, code: true }],
];

function percentile(values, fraction) {
  const ordered = values.slice().sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.floor((ordered.length - 1) * fraction))];
}

function summarise(samples, key) {
  const values = samples.map(sample => sample[key]);
  return {
    median: Number(percentile(values, 0.5).toFixed(3)),
    p95: Number(percentile(values, 0.95).toFixed(3)),
  };
}

function summariseValues(values) {
  if (!values.length) return { samples: 0, median: null, p95: null, max: null };
  return {
    samples: values.length,
    median: Number(percentile(values, 0.5).toFixed(3)),
    p95: Number(percentile(values, 0.95).toFixed(3)),
    max: Number(Math.max(...values).toFixed(3)),
  };
}

async function configure(page, scenario) {
  await page.evaluate(async ({ nodes, overlays }) => {
    const field = await import('/js/still-field.js');
    field.setStillFieldNerd(true);
    field.setStillFieldFps(30);
    field.setStillFieldCallouts(overlays.callouts);
    field.setStillFieldEdges(overlays.edges);
    field.setStillFieldCode(overlays.code);

    if (nodes === 150) {
      const { settings } = await import('/js/still-field/settings.js');
      const { applyNodeCount } = await import('/js/still-field/nodes.js');
      settings.density = 100;
      applyNodeCount();
    }
  }, { nodes: scenario.nodes, overlays: scenario.overlays });

  if (scenario.minimise) await page.click('#uiChromeMinimise');
}

async function sampleScenario(browser, server, scenario) {
  const context = await browser.newContext({
    viewport: scenario.viewport,
    deviceScaleFactor,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));

  // The field uses randomness for velocities and lifetime staggering. A small
  // deterministic generator keeps the graph shape comparable across worktrees;
  // this is benchmark setup only and never reaches production.
  await page.addInitScript(() => {
    let state = 0x6d2b79f5;
    Math.random = () => {
      state = Math.imul(state ^ state >>> 15, state | 1);
      state ^= state + Math.imul(state ^ state >>> 7, state | 61);
      return ((state ^ state >>> 14) >>> 0) / 4294967296;
    };
  });

  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: scenario.throttle });
  await page.goto(`${server.origin}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.complexNoiseStill, null, { timeout: 15000 });
  await configure(page, scenario);
  await page.waitForTimeout(WARMUP_MS);
  if (process.env.PROFILE_SCREENSHOT) {
    await page.screenshot({
      path: `${process.env.PROFILE_SCREENSHOT}-${scenario.name}.png`,
      animations: 'disabled',
    });
  }

  await cdp.send('HeapProfiler.collectGarbage');
  const heapBefore = await cdp.send('Runtime.getHeapUsage');
  const samples = [];
  const sampleCount = Math.floor(SAMPLE_MS / SAMPLE_INTERVAL_MS);
  for (let i = 0; i < sampleCount; i++) {
    samples.push(await page.evaluate(() => {
      const s = window.complexNoiseStill.getFieldStats();
      return {
        update: s.msUpdate,
        links: s.msLinks,
        nodesMs: s.msNodes,
        info: s.msInfo,
        total: s.frameMs,
        fps: s.fps,
        pairTests: s.pairTests,
        edges: s.edges,
        labels: s.labels,
        edgeLabels: s.edgeLabels,
        liveNodes: s.nodes,
      };
    }));
    await page.waitForTimeout(SAMPLE_INTERVAL_MS);
  }
  await cdp.send('HeapProfiler.collectGarbage');
  const heapAfter = await cdp.send('Runtime.getHeapUsage');

  const last = samples.at(-1);
  const result = {
    name: scenario.name,
    viewport: `${scenario.viewport.width}x${scenario.viewport.height}`,
    dpr: deviceScaleFactor,
    throttle: scenario.throttle,
    requestedNodes: scenario.nodes,
    liveNodes: last.liveNodes,
    overlays: scenario.overlays,
    samples: samples.length,
    stageMs: {
      update: summarise(samples, 'update'),
      links: summarise(samples, 'links'),
      nodes: summarise(samples, 'nodesMs'),
      info: summarise(samples, 'info'),
      total: summarise(samples, 'total'),
    },
    fps: summarise(samples, 'fps'),
    counters: {
      pairTests: Math.round(percentile(samples.map(s => s.pairTests), 0.5)),
      edges: Math.round(percentile(samples.map(s => s.edges), 0.5)),
      labels: Math.round(percentile(samples.map(s => s.labels), 0.5)),
      edgeLabels: Math.round(percentile(samples.map(s => s.edgeLabels), 0.5)),
    },
    heapAfterGcDelta: heapAfter.usedSize - heapBefore.usedSize,
    errors,
  };

  await context.close();
  return result;
}

async function sampleChurn(browser, server) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));

  // Measure the app's requestAnimationFrame callback itself. Reading the
  // renderer clock on either side excludes capped callbacks that did no draw
  // work. The first-frame marker captures immediate work; the phase and cycle
  // retain the whole interaction window in case Chromium defers raster work.
  // Installed before navigation so the app's first request is wrapped; this is
  // profiling instrumentation and never reaches production.
  await page.addInitScript(() => {
    const nativeRaf = window.requestAnimationFrame.bind(window);
    window.__profileFrames = [];
    window.__profileMarker = '';
    window.__profilePhase = '';
    window.__profileCycle = -1;
    window.requestAnimationFrame = callback => nativeRaf(timestamp => {
      const field = window.complexNoiseStill;
      const beforeClock = field ? field.getFieldStats().realClock : -1;
      const started = performance.now();
      callback(timestamp);
      const duration = performance.now() - started;
      const afterClock = field ? field.getFieldStats().realClock : -1;
      if (afterClock > beforeClock) {
        window.__profileFrames.push({
          duration,
          marker: window.__profileMarker,
          phase: window.__profilePhase,
          cycle: window.__profileCycle,
        });
        window.__profileMarker = '';
      }
    });
  });

  // Match the steady-state source scenario: deterministic field, 150 nodes,
  // source only, 4× CPU throttle and minimised chrome.
  await page.addInitScript(() => {
    let state = 0x6d2b79f5;
    Math.random = () => {
      state = Math.imul(state ^ state >>> 15, state | 1);
      state ^= state + Math.imul(state ^ state >>> 7, state | 61);
      return ((state ^ state >>> 14) >>> 0) / 4294967296;
    };
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
  await page.goto(`${server.origin}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.complexNoiseStill, null, { timeout: 15000 });
  await configure(page, {
    nodes: 150,
    overlays: { callouts: false, edges: false, code: true },
    minimise: true,
  });
  await page.waitForTimeout(WARMUP_MS);

  await cdp.send('HeapProfiler.collectGarbage');
  const heapBefore = await cdp.send('Runtime.getHeapUsage');
  await page.evaluate(() => { window.__profileFrames.length = 0; });
  await page.waitForTimeout(CHURN_BASELINE_MS);
  const baseline = await page.evaluate(() => window.__profileFrames.splice(0));

  for (let i = 0; i < CHURN_CYCLES; i++) {
    await page.evaluate(async cycle => {
      window.__profileMarker = 'fold';
      window.__profilePhase = 'fold';
      window.__profileCycle = cycle;
      (await import('/js/still-field.js')).setCodeFolded(true);
    }, i);
    await page.waitForTimeout(CHURN_SETTLE_MS);
    await page.evaluate(async cycle => {
      window.__profileMarker = 'unfold';
      window.__profilePhase = 'unfold';
      window.__profileCycle = cycle;
      (await import('/js/still-field.js')).setCodeFolded(false);
    }, i);
    await page.waitForTimeout(CHURN_SETTLE_MS);
  }

  for (let i = 0; i < CHURN_CYCLES; i++) {
    await page.evaluate(async () => {
      window.__profilePhase = '';
      window.__profileCycle = -1;
      (await import('/js/still-field.js')).setStillFieldEnabled(false);
    });
    await page.waitForTimeout(CHURN_SETTLE_MS);
    await page.evaluate(async cycle => {
      window.__profileMarker = 'restart';
      window.__profilePhase = 'restart';
      window.__profileCycle = cycle;
      (await import('/js/still-field.js')).setStillFieldEnabled(true);
    }, i);
    await page.waitForTimeout(CHURN_SETTLE_MS);
  }

  await page.evaluate(() => {
    window.__profilePhase = '';
    window.__profileCycle = -1;
  });
  const interactionFrames = await page.evaluate(() => window.__profileFrames.splice(0));
  await cdp.send('HeapProfiler.collectGarbage');
  const heapAfter = await cdp.send('Runtime.getHeapUsage');
  const stats = await page.evaluate(() => window.complexNoiseStill.getFieldStats());
  const tagged = marker => interactionFrames
    .filter(frame => frame.marker === marker)
    .map(frame => frame.duration);
  const windowMaxima = phase => {
    const maxima = new Array(CHURN_CYCLES).fill(0);
    for (const frame of interactionFrames) {
      if (frame.phase !== phase || frame.cycle < 0) continue;
      maxima[frame.cycle] = Math.max(maxima[frame.cycle], frame.duration);
    }
    return maxima.filter(value => value > 0);
  };
  const result = {
    name: 'desktop-150-source-churn',
    viewport: '1440x900',
    dpr: deviceScaleFactor,
    throttle: CPU_THROTTLE,
    cycles: CHURN_CYCLES,
    settleMs: CHURN_SETTLE_MS,
    drawnFrames: {
      baseline: baseline.length,
      interactions: interactionFrames.length,
    },
    firstFrameMs: {
      baseline: summariseValues(baseline.map(frame => frame.duration)),
      fold: summariseValues(tagged('fold')),
      unfold: summariseValues(tagged('unfold')),
      restart: summariseValues(tagged('restart')),
    },
    windowMaxMs: {
      fold: summariseValues(windowMaxima('fold')),
      unfold: summariseValues(windowMaxima('unfold')),
      restart: summariseValues(windowMaxima('restart')),
    },
    heapAfterGcDelta: heapAfter.usedSize - heapBefore.usedSize,
    rasterBytes: stats.rasterBytes ?? null,
    errors,
  };

  await context.close();
  return result;
}

const server = await startServer(ROOT);
const browser = await chromium.launch({
  headless: true,
  executablePath: CHROMIUM_PATH,
  args: ['--autoplay-policy=no-user-gesture-required'],
});

try {
  const results = [];
  if (!churn) {
    for (const scenario of scenarios) {
      if (filter && !scenario.name.includes(filter)) continue;
      const result = await sampleScenario(browser, server, scenario);
      results.push(result);
      console.log(JSON.stringify(result));
    }

    for (const [name, overlays] of focusedDesktop) {
      if (filter && !name.includes(filter)) continue;
      const result = await sampleScenario(browser, server, {
        name,
        viewport: { width: 1440, height: 900 },
        nodes: 150,
        overlays,
        throttle: CPU_THROTTLE,
        minimise: false,
      });
      results.push(result);
      console.log(JSON.stringify(result));
    }
  }

  if (churn) {
    const result = await sampleChurn(browser, server);
    results.push(result);
    console.log(JSON.stringify(result));
  }
} finally {
  await browser.close();
  await server.close();
}

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
const filterArg = process.argv.find(arg => arg.startsWith('--filter='));
const filter = filterArg ? filterArg.slice('--filter='.length) : '';

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
  const context = await browser.newContext({ viewport: scenario.viewport });
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

const server = await startServer(ROOT);
const browser = await chromium.launch({
  headless: true,
  executablePath: CHROMIUM_PATH,
  args: ['--autoplay-policy=no-user-gesture-required'],
});

try {
  const results = [];
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
} finally {
  await browser.close();
  await server.close();
}

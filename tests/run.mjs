/**
 * Browser smoke tests for Complex Noise.
 *
 * These drive a real Chromium against the real render loop. Several of them
 * exist because a plausible-looking refactor broke something that only shows up
 * after the app has been running for a while — the transparent-canvas guard in
 * particular. Add to them rather than replacing them.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright';
import { startServer } from './server.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HEADED = process.argv.includes('--headed');
const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`);
  }
}

const storage = (page, key) => page.evaluate(k => localStorage.getItem(k), key);

test('loads with no console or page errors', async page => {
  assertEqual(page.errors.length, 0, `page reported errors: ${page.errors.join(' | ')}`);
  const booted = await page.evaluate(() => typeof window.complexNoiseStill);
  assertEqual(booted, 'object', 'app did not boot (window.complexNoiseStill missing)');
});

test('defaults: Stats button uses aria-pressed and deep-bone colour is set', async page => {
  assertEqual(await page.getAttribute('#stillFieldNerdToggle', 'aria-pressed'), 'true', 'Stats (Info labels) should default to on');
  assertEqual(await page.getAttribute('#stillFieldTextureToggle', 'aria-checked'), 'true', 'Background texture should default to on');
  assertEqual(await page.getAttribute('.type-btn[data-type="brown"]', 'aria-pressed'), 'true', 'brown should be the default type');
  assertEqual(await page.getAttribute('#stillFieldToggle', 'aria-checked'), 'true', 'Still Field should default to on');
});

test('Field Lab defaults match constants.js', async page => {
  // A default that drifts away from DEFAULTS is how a "harmless" tuning commit
  // silently changes what every existing user sees on next load.
  assertEqual(await page.inputValue('#fieldDensity'), '1', 'node density should default to 1×');
  assertEqual(await page.inputValue('#fieldReach'), '1', 'link reach should default to 1×');
  assertEqual(await page.inputValue('#fieldDepth'), '0.75', 'perspective should default to 0.75');
  assertEqual(await page.inputValue('#fieldDwell'), '14', 'callout dwell should default to 14 s');
  assertEqual(await page.getAttribute('.fps-seg[data-fps="30"]', 'aria-pressed'), 'true', '30 fps should be the default cap');
  assertEqual(await page.getAttribute('#fieldCodeToggle', 'aria-checked'), 'true', 'source overlay should default to on');
});

test('the info layer has its own canvas, and clears when Stats is off', async page => {
  // Text and the field's alpha-subtracting trail cannot share a surface: a
  // moving label smears into a halo. The separation is the fix, so the test is
  // that the instrumentation really is on the other canvas, and that the other
  // canvas is genuinely emptied rather than merely stopped being drawn to.
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.click('#uiChromeMinimise');
  await page.waitForTimeout(1600);

  const countInk = () => page.evaluate(() => {
    const c = document.getElementById('stillFieldInfo');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
    return n;
  });

  assert(await countInk() > 500, 'info canvas should be carrying callouts once the interface is out of the way');
  await page.click('#uiChromeToggle');
  await page.click('#stillFieldNerdToggle');
  await page.waitForTimeout(400);
  assertEqual(await countInk(), 0, 'turning Stats off must clear the info canvas, not just stop drawing to it');
});

test('the field canvas stays transparent', async page => {
  // The trail subtracts alpha with destination-out. Filling with a background
  // colour instead drives the canvas opaque within seconds and buries the page
  // gradient and the Still Texture underneath it.
  await page.waitForTimeout(1800);
  const opaque = await page.evaluate(() => {
    const c = document.getElementById('stillField');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 250) n++;
    return n / (d.length / 4);
  });
  assert(opaque < 0.02, `field canvas should stay mostly transparent, ${(opaque * 100).toFixed(1)}% was fully opaque`);
});

test('the spatial grid tests far fewer pairs than brute force', async page => {
  await page.waitForTimeout(900);
  const s = await page.evaluate(() => {
    const x = window.complexNoiseStill.getFieldStats();
    return { pairs: x.pairTests, brute: x.bruteTests, nodes: x.nodes, cells: x.gridCells };
  });
  assert(s.nodes > 0, 'the field should have nodes');
  assert(s.cells > 1, 'the grid should have been allocated');
  assert(s.brute > 0 && s.pairs > 0, 'both pair counts should be reported');
  assert(s.pairs < s.brute * 0.7,
    `grid should cut pair tests well below n(n-1)/2, got ${s.pairs} of ${s.brute}`);
});

test('Field Lab drives the renderer and persists', async page => {
  const before = await page.evaluate(() => window.complexNoiseStill.getFieldStats().nodes);

  await page.evaluate(() => {
    const el = document.getElementById('fieldDensity');
    el.value = '2';
    el.dispatchEvent(new Event('input'));
  });
  await page.waitForTimeout(300);

  assertEqual(await storage(page, 'complexNoise_stillFieldDensity'), '2', 'density should persist');
  const after = await page.evaluate(() => window.complexNoiseStill.getFieldStats().nodes);
  assert(after > before, `raising density should add nodes, went ${before} → ${after}`);

  await page.click('.fps-seg[data-fps="60"]');
  await page.waitForTimeout(100);
  assertEqual(await page.getAttribute('.fps-seg[data-fps="60"]', 'aria-pressed'), 'true', '60 should read pressed');
  assertEqual(await page.getAttribute('.fps-seg[data-fps="30"]', 'aria-pressed'), 'false', '30 should read unpressed');
  assertEqual(await storage(page, 'complexNoise_stillFieldFps'), '60', 'frame cap should persist');

  await page.click('#fieldLabReset');
  await page.waitForTimeout(200);
  assertEqual(await page.inputValue('#fieldDensity'), '1', 'reset should put density back');
  assertEqual(await page.getAttribute('.fps-seg[data-fps="30"]', 'aria-pressed'), 'true', 'reset should put the cap back');
});

test('callout detail modes rotate on a dwell that the Lab controls', async page => {
  // The schedule is quasi-periodic, so this checks that it advances and that
  // the countdown is bounded by the dwell the user asked for — not that a
  // particular mode is showing at a particular second.
  await page.evaluate(() => {
    const el = document.getElementById('fieldDwell');
    el.value = '4';
    el.dispatchEvent(new Event('input'));
  });
  await page.waitForTimeout(200);

  const first = await page.evaluate(() => window.complexNoiseStill.getFieldStats().labelMode);
  const remaining = await page.evaluate(() => window.complexNoiseStill.getFieldStats().modeRemaining);
  assert(remaining <= 4 * 1.3, `remaining ${remaining}s should be inside one dwell slice`);

  await page.waitForTimeout(5200);
  const second = await page.evaluate(() => window.complexNoiseStill.getFieldStats().labelMode);
  assert(first !== second, `mode should have rotated within a dwell, stayed on ${first}`);
});

test('theme toggles to bone and uses deep-bone #E0D6C8', async page => {
  assertEqual(await page.getAttribute('html', 'data-still-theme'), 'dark', 'should start dark');
  await page.click('.theme-seg[data-theme="bone"]');
  await page.waitForTimeout(150);
  assertEqual(await page.getAttribute('html', 'data-still-theme'), 'bone', 'should switch to bone');
  assertEqual(await page.getAttribute('#themeColorMeta', 'content'), '#E0D6C8', 'theme-color meta should follow');
  assertEqual(await page.getAttribute('meta[name="color-scheme"]', 'content'), 'light', 'color-scheme meta should follow');
  assertEqual(await storage(page, 'complexNoise_stillTheme'), 'bone', 'theme should persist');
});

test('Stats card button toggles and persists', async page => {
  await page.click('#stillFieldNerdToggle');
  await page.waitForTimeout(100);
  assertEqual(await page.getAttribute('#stillFieldNerdToggle', 'aria-pressed'), 'false', 'Stats button should read unpressed');
  assertEqual(await storage(page, 'complexNoise_stillFieldNerd'), 'false', 'nerd preference should persist');
  await page.reload({ waitUntil: 'load' });
  assertEqual(await page.getAttribute('#stillFieldNerdToggle', 'aria-pressed'), 'false', 'Stats should restore as off');
  await page.click('#stillFieldNerdToggle');
  await page.waitForTimeout(100);
  assertEqual(await page.getAttribute('#stillFieldNerdToggle', 'aria-pressed'), 'true', 'Stats should be back on');
});

test('interactive controls are labelled and reach 44px touch targets', async page => {
  const audit = await page.evaluate(() => {
    const problems = [];
    document.querySelectorAll('input, select, button').forEach(el => {
      const labelled = el.getAttribute('aria-label')
        || el.getAttribute('aria-labelledby')
        || (el.id && document.querySelector(`label[for="${el.id}"]`))
        || el.textContent.trim();
      if (!labelled) problems.push(el.id || el.className || el.tagName);
    });
    return problems;
  });
  assertEqual(audit.length, 0, `unlabelled controls: ${audit.join(', ')}`);

  const small = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('button').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.height < 44) out.push(`${el.id || el.className}: ${Math.round(r.height)}px`);
    });
    return out;
  });
  assertEqual(small.length, 0, `touch targets under 44px: ${small.join(', ')}`);
});

// Runner
const server = await startServer(ROOT);
const browser = await chromium.launch({
  headless: !HEADED,
  executablePath: CHROMIUM_PATH,
  args: ['--autoplay-policy=no-user-gesture-required'],
});

let passed = 0;
const failures = [];

for (const { name, fn } of tests) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.errors = [];
  page.on('console', m => { if (m.type() === 'error') page.errors.push(m.text()); });
  page.on('pageerror', e => page.errors.push(`pageerror: ${e.message}`));

  try {
    await page.goto(`${server.origin}/index.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.complexNoiseStill, null, { timeout: 5000 });
    await fn(page);
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}\n      ${err.message.split('\n').join('\n      ')}`);
    failures.push(name);
  } finally {
    await context.close();
  }
}

await browser.close();
await server.close();

console.log(`\n${passed}/${tests.length} passed`);
if (failures.length) {
  console.log(`failed: ${failures.join(', ')}`);
  process.exit(1);
}

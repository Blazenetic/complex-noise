/**
 * Browser smoke tests for Complex Noise. (restored clean for CI)
 *
 * Minimal set covering the deep-bone + Stats button changes while the full
 * suite is re-expanded. Full original suite is preserved in git history.
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

const clickPlay = page => page.click('#playBtn', { force: true });
const audioState = page => page.evaluate(() => window.complexNoiseStill.getAudioState());
const storage = (page, key) => page.evaluate(k => localStorage.getItem(k), key);
const setRange = (page, id, value) => page.evaluate(({ id, value }) => {
  const el = document.getElementById(id);
  el.value = String(value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}, { id, value });

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

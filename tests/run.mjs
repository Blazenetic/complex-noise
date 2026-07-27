/**
 * Browser smoke tests for Complex Noise.
 *
 *   npm test              run everything headless
 *   npm test -- --headed  watch it happen in a real window
 *
 * These are end-to-end checks driven by Playwright against a real Chromium,
 * because everything worth breaking here lives in the browser: the Web Audio
 * graph, localStorage persistence, the canvas, and the theme tokens.
 *
 * ## Writing new tests
 *
 * Add a `test('name', async page => { ... })` block. Each test gets a fresh
 * page with clean storage. Use `assert*` helpers — a throw fails just that
 * test and the run continues, so one regression doesn't mask the rest.
 *
 * State the app exposes for testing lives on `window.complexNoiseStill`
 * (defined at the bottom of js/app.js).
 *
 * ## A gotcha worth knowing
 *
 * `#playBtn` runs a permanent CSS keyframe animation, so Playwright's
 * actionability check never sees it as "stable". Click it via `clickPlay()`,
 * which passes `{ force: true }`.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright';
import { startServer } from './server.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HEADED = process.argv.includes('--headed');

// ----------------------------------------------------------
// Tiny test harness
// ----------------------------------------------------------
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

/** Click the play button, bypassing the never-settling pulse animation. */
const clickPlay = page => page.click('#playBtn', { force: true });

/** Read the audio module's state snapshot. */
const audioState = page => page.evaluate(() => window.complexNoiseStill.getAudioState());

const storage = (page, key) => page.evaluate(k => localStorage.getItem(k), key);

/** Set a range input and fire the `input` event the app listens for. */
const setRange = (page, id, value) => page.evaluate(({ id, value }) => {
  const el = document.getElementById(id);
  el.value = String(value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}, { id, value });

// ==========================================================
// Loading & defaults
// ==========================================================

test('loads with no console or page errors', async page => {
  assertEqual(page.errors.length, 0, `page reported errors: ${page.errors.join(' | ')}`);
  const booted = await page.evaluate(() => typeof window.complexNoiseStill);
  assertEqual(booted, 'object', 'app did not boot (window.complexNoiseStill missing)');
});

test('defaults: brown noise, field off, status Ready', async page => {
  assertEqual(await page.getAttribute('.type-btn[data-type="brown"]', 'aria-pressed'), 'true', 'brown should be the default type');
  assertEqual(await page.getAttribute('#stillFieldToggle', 'aria-checked'), 'false', 'Still Field should default to off');
  assert(await page.isDisabled('#stillFieldIntensity'), 'intensity slider should be disabled while the field is off');
  assertEqual((await page.textContent('#status')).trim(), 'Ready', 'initial status');
  assertEqual(await page.getAttribute('#playBtn', 'aria-label'), 'Play noise', 'initial play button label');
});

// ==========================================================
// Playback
// ==========================================================

test('play starts audio and updates the button', async page => {
  await clickPlay(page);
  await page.waitForTimeout(400);

  const state = await audioState(page);
  assertEqual(state.isPlaying, true, 'engine should report playing');
  assert(state.status.includes('playing'), `status should mention playback, got "${state.status}"`);

  assert(await page.evaluate(() => document.getElementById('playBtn').classList.contains('playing')), 'button should get .playing');
  assertEqual(await page.getAttribute('#playBtn', 'aria-label'), 'Pause noise', 'aria-label should flip to Pause');
  assertEqual(await page.getAttribute('#playBtn', 'data-icon'), 'pause', 'pause icon should be mounted');

  const ctxState = await page.evaluate(() => window.complexNoiseStill.getAudioContext()?.state);
  assertEqual(ctxState, 'running', 'AudioContext should be running');
});

test('pause stops audio and restores the button', async page => {
  await clickPlay(page);
  await page.waitForTimeout(300);
  await clickPlay(page);
  await page.waitForTimeout(200);

  const state = await audioState(page);
  assertEqual(state.isPlaying, false, 'engine should report stopped');
  assertEqual(state.status, 'Paused', 'status should read Paused');
  assertEqual(await page.getAttribute('#playBtn', 'aria-label'), 'Play noise', 'aria-label should flip back to Play');
  assertEqual(await page.getAttribute('#playBtn', 'data-icon'), 'play', 'play icon should be mounted');
});

test('play during a fade-out keeps exactly one live source', async page => {
  // Regression: the teardown queued by the fade-out used to stop whichever
  // source was current when it fired — i.e. the freshly started one — leaving
  // a UI that claims to be playing over silence.
  await clickPlay(page);
  await page.waitForTimeout(300);
  await clickPlay(page);        // pause → starts a 0.9 s fade
  await page.waitForTimeout(150);
  await clickPlay(page);        // play again mid-fade
  await page.waitForTimeout(1500); // outlive the stale teardown

  const state = await audioState(page);
  assertEqual(state.isPlaying, true, 'should still be playing after the stale teardown window');

  const energy = await page.evaluate(() => window.complexNoiseStill.getMetrics().overall);
  assert(energy > 0.01, `analyser should see signal after the race, got ${energy}`);
});

test('switching type mid-playback cross-fades and persists', async page => {
  await clickPlay(page);
  await page.waitForTimeout(300);
  await page.click('.type-btn[data-type="pink"]');
  await page.waitForTimeout(500);

  assertEqual(await page.getAttribute('.type-btn[data-type="pink"]', 'aria-pressed'), 'true', 'pink should be pressed');
  assertEqual(await page.getAttribute('.type-btn[data-type="brown"]', 'aria-pressed'), 'false', 'brown should be unpressed');
  assertEqual(await storage(page, 'complexNoise_type'), 'pink', 'type should persist');

  const state = await audioState(page);
  assert(state.status.includes('Pink'), `status should name the new type, got "${state.status}"`);
  assertEqual(state.isPlaying, true, 'should still be playing after the switch');

  const energy = await page.evaluate(() => window.complexNoiseStill.getMetrics().overall);
  assert(energy > 0.01, `audio should be audible after the cross-fade, got ${energy}`);
});

// ==========================================================
// Sleep timer — the regression that started all this
// ==========================================================

test('sleep timer stop resets the play button', async page => {
  // Regression: audio.js stopped playback when the timer fired, but the button
  // was only ever updated inside its own click handler — so it stayed frozen
  // showing "pause" over stopped audio until the user tapped it twice.
  await page.evaluate(() => {
    const t = document.getElementById('timer');
    const opt = document.createElement('option');
    opt.value = String(2 / 3600); // two seconds, expressed in hours
    opt.textContent = 'test';
    t.appendChild(opt);
    t.value = opt.value;
    t.dispatchEvent(new Event('change', { bubbles: true }));
  });

  await clickPlay(page);
  await page.waitForTimeout(4000); // 2 s timer + 0.9 s fade + margin

  const state = await audioState(page);
  assertEqual(state.isPlaying, false, 'timer should have stopped playback');
  assertEqual(state.status, 'Sleep timer ended', 'status should explain why it stopped');
  assertEqual(await page.getAttribute('#playBtn', 'data-icon'), 'play', 'button must show the play icon again');
  assertEqual(await page.getAttribute('#playBtn', 'aria-label'), 'Play noise', 'aria-label must return to Play noise');
  assert(!(await page.evaluate(() => document.getElementById('playBtn').classList.contains('playing'))), '.playing must be removed');
});

test('changing the timer while playing confirms in the status', async page => {
  await clickPlay(page);
  await page.waitForTimeout(300);
  await page.selectOption('#timer', '1');
  await page.waitForTimeout(200);

  const state = await audioState(page);
  assert(state.status.includes('timer'), `status should confirm the timer, got "${state.status}"`);
  assertEqual(await storage(page, 'complexNoise_timer'), '1', 'timer should persist');
});

// ==========================================================
// Persistence
// ==========================================================

test('volume persists, including exactly zero', async page => {
  await setRange(page, 'volume', 0.75);
  assertEqual(await storage(page, 'complexNoise_volume'), '0.75', 'volume should persist');

  // Regression: `parseFloat(stored) || 0.4` treated a stored "0" as falsy, so
  // muting and reopening the app came back at 40%.
  await setRange(page, 'volume', 0);
  await page.reload({ waitUntil: 'load' });
  assertEqual(await page.inputValue('#volume'), '0', 'a stored volume of 0 must survive a reload');
  assertEqual((await audioState(page)).volume, 0, 'engine should restore 0, not the default');
});

test('EQ values persist and restore', async page => {
  await setRange(page, 'stillEqLow', 6);
  await setRange(page, 'stillEqHigh', -4.5);
  assertEqual(await storage(page, 'complexNoise_stillEqLow'), '6', 'low band should persist');

  await page.reload({ waitUntil: 'load' });
  assertEqual(await page.inputValue('#stillEqLow'), '6', 'low band should restore');
  assertEqual(await page.inputValue('#stillEqHigh'), '-4.5', 'high band should restore');
});

test('corrupt stored values fall back to defaults instead of breaking', async page => {
  await page.evaluate(() => {
    localStorage.setItem('complexNoise_volume', 'not-a-number');
    localStorage.setItem('complexNoise_type', 'chartreuse');
    localStorage.setItem('complexNoise_stillTheme', '<script>');
  });
  await page.reload({ waitUntil: 'load' });

  assertEqual(page.errors.length, 0, `corrupt storage should not throw: ${page.errors.join(' | ')}`);
  const state = await audioState(page);
  assertEqual(state.volume, 0.4, 'volume should fall back to the default');
  assertEqual(state.type, 'brown', 'unknown noise type should fall back to brown');
  assertEqual(await page.getAttribute('html', 'data-still-theme'), 'dark', 'unknown theme should fall back to dark');
});

// ==========================================================
// Theme
// ==========================================================

test('theme toggles, updates meta tags, and persists', async page => {
  assertEqual(await page.getAttribute('html', 'data-still-theme'), 'dark', 'should start dark');

  await page.click('#stillThemeToggle');
  await page.waitForTimeout(150);

  assertEqual(await page.getAttribute('html', 'data-still-theme'), 'bone', 'should switch to bone');
  assertEqual(await page.getAttribute('#themeColorMeta', 'content'), '#F4F0E8', 'theme-color meta should follow');
  assertEqual(await page.getAttribute('meta[name="color-scheme"]', 'content'), 'light', 'color-scheme meta should follow');
  assert((await page.textContent('#stillThemeLabel')).includes('Bone'), 'toggle label should say Bone');
  assertEqual(await storage(page, 'complexNoise_stillTheme'), 'bone', 'theme should persist');

  await page.reload({ waitUntil: 'load' });
  assertEqual(await page.getAttribute('html', 'data-still-theme'), 'bone', 'theme should restore after reload');
});

// ==========================================================
// Still Field
// ==========================================================

test('Still Field toggles on, paints, and toggles off', async page => {
  await page.click('#stillFieldToggle');
  await page.waitForTimeout(500);

  assertEqual(await page.getAttribute('#stillFieldToggle', 'aria-checked'), 'true', 'switch should read checked');
  assert(!(await page.isDisabled('#stillFieldIntensity')), 'intensity slider should enable');
  assert(!(await page.evaluate(() => document.getElementById('stillField').classList.contains('still-field-off'))), 'canvas should be visible');

  const painted = await page.evaluate(() => {
    const c = document.getElementById('stillField');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4000) if (d[i] !== 0) return true;
    return false;
  });
  assert(painted, 'canvas should have rendered something');

  await page.click('#stillFieldToggle');
  await page.waitForTimeout(300);
  assert(await page.evaluate(() => document.getElementById('stillField').classList.contains('still-field-off')), 'canvas should hide again');
  assertEqual(await storage(page, 'complexNoise_stillFieldEnabled'), 'false', 'field state should persist');
});

test('Still Field survives a resize without losing its nodes', async page => {
  await page.click('#stillFieldToggle');
  await page.waitForTimeout(400);
  await page.setViewportSize({ width: 390, height: 700 });
  await page.waitForTimeout(500); // outlast the 150 ms resize debounce

  assertEqual(page.errors.length, 0, `resize should not throw: ${page.errors.join(' | ')}`);
  const painted = await page.evaluate(() => {
    const c = document.getElementById('stillField');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4000) if (d[i] !== 0) return true;
    return false;
  });
  assert(painted, 'field should still render after a resize');
});

test('Still Field intensity persists', async page => {
  await page.click('#stillFieldToggle');
  await setRange(page, 'stillFieldIntensity', 0.85);
  assertEqual(await storage(page, 'complexNoise_stillFieldIntensity'), '0.85', 'intensity should persist');

  await page.reload({ waitUntil: 'load' });
  assertEqual(await page.inputValue('#stillFieldIntensity'), '0.85', 'intensity should restore');
});

// ==========================================================
// Noise generation
// ==========================================================

test('each noise colour produces signal with the expected spectral tilt', async page => {
  const spectra = await page.evaluate(async () => {
    const { generateNoiseBuffer } = await import('/js/noise.js');
    const out = {};
    for (const type of ['white', 'brown', 'pink']) {
      // Offline rendering keeps this deterministic and off the audio device.
      const ctx = new OfflineAudioContext(1, 44100, 44100);
      const buffer = generateNoiseBuffer(ctx, type, 1);
      const data = buffer.getChannelData(0);

      let sumSq = 0;
      for (let i = 0; i < data.length; i++) sumSq += data[i] * data[i];

      // Mean absolute first difference: a cheap proxy for high-frequency
      // content. White noise jumps sample to sample; brown barely moves.
      let diff = 0;
      for (let i = 1; i < data.length; i++) diff += Math.abs(data[i] - data[i - 1]);

      out[type] = { rms: Math.sqrt(sumSq / data.length), roughness: diff / (data.length - 1) };
    }
    return out;
  });

  for (const [type, { rms }] of Object.entries(spectra)) {
    assert(rms > 0.01 && rms < 1, `${type} noise RMS should be audible but not clipping, got ${rms}`);
  }
  assert(spectra.white.roughness > spectra.pink.roughness, 'white should be rougher than pink');
  assert(spectra.pink.roughness > spectra.brown.roughness, 'pink should be rougher than brown');
});

// ==========================================================
// Accessibility & markup
// ==========================================================

test('interactive controls are labelled and reachable', async page => {
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

  // Every touch target should clear the 44 px minimum on a phone.
  const small = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('button, select').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.height < 44) out.push(`${el.id || el.className}: ${Math.round(r.height)}px`);
    });
    return out;
  });
  assertEqual(small.length, 0, `touch targets under 44px: ${small.join(', ')}`);
});

test('the Still Field switch responds to the keyboard', async page => {
  await page.focus('#stillFieldToggle');
  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
  assertEqual(await page.getAttribute('#stillFieldToggle', 'aria-checked'), 'true', 'Space should toggle the switch');
});

// ==========================================================
// Runner
// ==========================================================

const server = await startServer(ROOT);
const browser = await chromium.launch({
  headless: !HEADED,
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

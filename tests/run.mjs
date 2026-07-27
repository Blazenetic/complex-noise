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

/**
 * Escape hatch for sandboxes and CI images that ship a pre-provisioned Chromium
 * rather than letting `playwright install` fetch one. Leave it unset locally and
 * Playwright resolves its own download as usual.
 */
const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

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

test('defaults: brown noise, field on, standard glass, status Ready', async page => {
  assertEqual(await page.getAttribute('.type-btn[data-type="brown"]', 'aria-pressed'), 'true', 'brown should be the default type');
  assertEqual(await page.getAttribute('#stillFieldToggle', 'aria-checked'), 'true', 'Still Field should default to on');
  assert(!(await page.isDisabled('#stillFieldIntensity')), 'intensity slider should be live while the field is on');
  assert(!(await page.isDisabled('#stillFieldSpeed')), 'speed slider should be live while the field is on');
  assertEqual(await page.inputValue('#stillFieldSpeed'), '2', 'default drift speed (old max is new medium)');
  assertEqual(await page.inputValue('#stillFieldIntensity'), '0.7', 'default intensity');
  assertEqual(await page.inputValue('#volume'), '0.22', 'default volume should start soft');
  assertEqual(await page.getAttribute('html', 'data-glass'), 'standard', 'glass should default to standard');
  assertEqual(await page.getAttribute('#stillGlassToggle', 'aria-checked'), 'false', 'glass switch should read unchecked');
  assertEqual(await page.getAttribute('html', 'data-ui-chrome'), 'visible', 'chrome should start visible');
  assertEqual((await page.textContent('#status')).trim(), 'Ready', 'initial status');
  assertEqual(await page.getAttribute('#playBtn', 'aria-label'), 'Play noise', 'initial play button label');
  assertEqual(await page.inputValue('#timer'), '0', 'timer should default to Off');
  assertEqual((await page.textContent('#timerValue')).trim(), 'Off', 'timer readout should say Off');
  // New controls default on
  assertEqual(await page.getAttribute('#stillFieldNerdToggle', 'aria-checked'), 'true', 'Info labels should default to on');
  assertEqual(await page.getAttribute('#stillFieldTextureToggle', 'aria-checked'), 'true', 'Background texture should default to on');
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
  //
  // The production slider uses step="0.5", which would snap a 2-second value
  // (~0.00055 h) to 0. Temporarily drop the step so the smoke test can drive
  // a short timer without changing the real UI contract.
  await page.evaluate(() => {
    const t = document.getElementById('timer');
    t.step = 'any';
    t.value = String(2 / 3600); // two seconds, expressed in hours
    t.dispatchEvent(new Event('input', { bubbles: true }));
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
  await setRange(page, 'timer', 1);
  await page.waitForTimeout(200);

  const state = await audioState(page);
  assert(state.status.includes('timer'), `status should confirm the timer, got "${state.status}"`);
  assertEqual(await storage(page, 'complexNoise_timer'), '1', 'timer should persist');
  assertEqual((await page.textContent('#timerValue')).trim(), '1 h', 'readout should show 1 h');
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
  assertEqual(state.volume, 0.22, 'volume should fall back to the default');
  assertEqual(state.type, 'brown', 'unknown noise type should fall back to brown');
  assertEqual(await page.getAttribute('html', 'data-still-theme'), 'dark', 'unknown theme should fall back to dark');
});

// ==========================================================
// Theme (segmented control)
// ==========================================================

test('theme toggles via segment, updates meta tags, and persists', async page => {
  assertEqual(await page.getAttribute('html', 'data-still-theme'), 'dark', 'should start dark');
  assertEqual(await page.getAttribute('.theme-seg[data-theme="dark"]', 'aria-pressed'), 'true', 'Dark segment should be pressed');
  assertEqual(await page.getAttribute('.theme-seg[data-theme="bone"]', 'aria-pressed'), 'false', 'Bone segment should be unpressed');

  await page.click('.theme-seg[data-theme="bone"]');
  await page.waitForTimeout(150);

  assertEqual(await page.getAttribute('html', 'data-still-theme'), 'bone', 'should switch to bone');
  assertEqual(await page.getAttribute('#themeColorMeta', 'content'), '#F4F0E8', 'theme-color meta should follow');
  assertEqual(await page.getAttribute('meta[name="color-scheme"]', 'content'), 'light', 'color-scheme meta should follow');
  assertEqual(await page.getAttribute('.theme-seg[data-theme="bone"]', 'aria-pressed'), 'true', 'Bone segment should be pressed');
  assertEqual(await storage(page, 'complexNoise_stillTheme'), 'bone', 'theme should persist');

  await page.reload({ waitUntil: 'load' });
  assertEqual(await page.getAttribute('html', 'data-still-theme'), 'bone', 'theme should restore after reload');
});

// ==========================================================
// Still Field
// ==========================================================

/** True when the canvas has any non-transparent pixel. */
const fieldPainted = page => page.evaluate(() => {
  const c = document.getElementById('stillField');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < d.length; i += 4000) if (d[i] !== 0) return true;
  return false;
});

test('Still Field paints on load, then toggles off and back on', async page => {
  await page.waitForTimeout(500);
  assert(!(await page.evaluate(() => document.getElementById('stillField').classList.contains('still-field-off'))), 'canvas should be visible by default');
  assert(await fieldPainted(page), 'canvas should have rendered something without any interaction');

  await page.click('#stillFieldToggle');
  await page.waitForTimeout(300);
  assertEqual(await page.getAttribute('#stillFieldToggle', 'aria-checked'), 'false', 'switch should read unchecked');
  assert(await page.isDisabled('#stillFieldIntensity'), 'intensity slider should disable');
  assert(await page.evaluate(() => document.getElementById('stillField').classList.contains('still-field-off')), 'canvas should hide');
  assertEqual(await storage(page, 'complexNoise_stillFieldEnabled'), 'false', 'field state should persist');

  await page.click('#stillFieldToggle');
  await page.waitForTimeout(400);
  assertEqual(await page.getAttribute('#stillFieldToggle', 'aria-checked'), 'true', 'switch should read checked again');
  assert(await fieldPainted(page), 'canvas should repaint after being switched back on');
});

test('Still Field stays transparent instead of painting over the background', async page => {
  // Regression: the residual trail used to be a translucent fill of the page's
  // own background colour, which drives the canvas to fully opaque within a few
  // seconds and buries the background gradient and the Still Texture beneath it.
  await page.waitForTimeout(3000);
  const opaqueFraction = await page.evaluate(() => {
    const c = document.getElementById('stillField');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let opaque = 0, total = 0;
    for (let i = 3; i < d.length; i += 4000) {
      total++;
      if (d[i] > 250) opaque++;
    }
    return opaque / total;
  });
  assert(opaqueFraction < 0.5, `canvas should stay mostly transparent, ${Math.round(opaqueFraction * 100)}% of samples were opaque`);
});

test('Still Field stops drawing while the page is hidden', async page => {
  // Regression guard for battery: a backgrounded tab still runs throttled
  // animation frames, and this app sits on a locked phone for eight hours.
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(300);

  const energyWhileHidden = await page.evaluate(() => window.complexNoiseStill.getEnergy());
  await page.waitForTimeout(400);
  assertEqual(
    await page.evaluate(() => window.complexNoiseStill.getEnergy()),
    energyWhileHidden,
    'nothing should advance while the page is hidden',
  );

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(400);
  assert(await fieldPainted(page), 'field should resume when the page becomes visible again');
});

test('Still Field survives a resize without losing its nodes', async page => {
  await page.waitForTimeout(400);
  await page.setViewportSize({ width: 390, height: 700 });
  await page.waitForTimeout(500); // outlast the 150 ms resize debounce

  assertEqual(page.errors.length, 0, `resize should not throw: ${page.errors.join(' | ')}`);
  assert(await fieldPainted(page), 'field should still render after a resize');
});

test('Still Field intensity and speed persist', async page => {
  await setRange(page, 'stillFieldIntensity', 0.85);
  await setRange(page, 'stillFieldSpeed', 0.8);
  assertEqual(await storage(page, 'complexNoise_stillFieldIntensity'), '0.85', 'intensity should persist');
  assertEqual(await storage(page, 'complexNoise_stillFieldSpeed'), '0.8', 'speed should persist');

  await page.reload({ waitUntil: 'load' });
  assertEqual(await page.inputValue('#stillFieldIntensity'), '0.85', 'intensity should restore');
  assertEqual(await page.inputValue('#stillFieldSpeed'), '0.8', 'speed should restore');
  assertEqual((await page.evaluate(() => window.complexNoiseStill.getFieldState())).speed, 0.8, 'engine should restore the stored speed');
});

test('speed outside the allowed range is clamped, not trusted', async page => {
  await page.evaluate(() => localStorage.setItem('complexNoise_stillFieldSpeed', '99'));
  await page.reload({ waitUntil: 'load' });
  assertEqual(page.errors.length, 0, `an out-of-range speed should not throw: ${page.errors.join(' | ')}`);
  // Deliberate update: STILL_SPEED_MAX is now 4.8
  assertEqual((await page.evaluate(() => window.complexNoiseStill.getFieldState())).speed, 4.8, 'speed should clamp to the maximum');
});

test('Info labels and Background texture toggles work and persist', async page => {
  // Both default on (covered in the defaults test). Toggle them off and confirm.
  await page.click('#stillFieldNerdToggle');
  await page.waitForTimeout(100);
  assertEqual(await page.getAttribute('#stillFieldNerdToggle', 'aria-checked'), 'false', 'Info labels switch should read unchecked');
  assertEqual(await storage(page, 'complexNoise_stillFieldNerd'), 'false', 'nerd preference should persist');

  await page.click('#stillFieldTextureToggle');
  await page.waitForTimeout(100);
  assertEqual(await page.getAttribute('#stillFieldTextureToggle', 'aria-checked'), 'false', 'Background texture switch should read unchecked');
  assertEqual(await storage(page, 'complexNoise_stillFieldTexture'), 'false', 'texture preference should persist');

  // A stored `false` is the interesting case: it is the value a naive
  // truthiness check would throw away and silently restore as the default.
  await page.reload({ waitUntil: 'load' });
  assertEqual(await page.getAttribute('#stillFieldNerdToggle', 'aria-checked'), 'false', 'Info labels should restore as off');
  assertEqual(await page.getAttribute('#stillFieldTextureToggle', 'aria-checked'), 'false', 'Background texture should restore as off');
  const restored = await page.evaluate(() => window.complexNoiseStill.getFieldState());
  assertEqual(restored.nerd, false, 'engine should restore nerd = false');
  assertEqual(restored.texture, false, 'engine should restore texture = false');

  // Restore
  await page.click('#stillFieldNerdToggle');
  await page.click('#stillFieldTextureToggle');
  await page.waitForTimeout(100);
  assertEqual(await page.getAttribute('#stillFieldNerdToggle', 'aria-checked'), 'true', 'Info labels should be back on');
  assertEqual(await page.getAttribute('#stillFieldTextureToggle', 'aria-checked'), 'true', 'Background texture should be back on');
});

test('Background texture off actually dims the overlay, on restores the theme value', async page => {
  const opacityNow = () => page.evaluate(
    () => getComputedStyle(document.querySelector('.still-texture')).opacity,
  );
  const themeValue = await opacityNow();
  assert(parseFloat(themeValue) > 0, `texture should start visible, got ${themeValue}`);

  await page.click('#stillFieldTextureToggle');
  await page.waitForTimeout(100);
  assertEqual(parseFloat(await opacityNow()), 0, 'texture should be fully hidden when off');

  await page.click('#stillFieldTextureToggle');
  await page.waitForTimeout(100);
  assertEqual(await opacityNow(), themeValue, 'texture should return to the theme opacity, not a hard-coded one');
});

test('the brightest nodes still paint under prefers-reduced-motion', async page => {
  // Under reduced motion the glow pass is skipped entirely, so any node the
  // flat pass defers to it is never drawn at all. Counting arcs is the only way
  // to see this: the links keep painting either way, so a pixel count stays
  // healthy while the highest-energy nodes quietly vanish.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    window.__arcs = 0;
    const original = CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc = function arc(...args) {
      window.__arcs++;
      return original.apply(this, args);
    };
  });
  await page.reload({ waitUntil: 'load' });
  await setRange(page, 'stillFieldIntensity', 1);

  // Silent: energy comes from the procedural layers alone, so almost nothing
  // clears GLOW_THRESHOLD and every node goes through the flat pass.
  const sample = async () => {
    await page.evaluate(() => { window.__arcs = 0; });
    await page.waitForTimeout(2000);
    return page.evaluate(() => window.__arcs);
  };
  const quiet = await sample();
  assert(quiet > 0, 'the field should draw nodes while paused');

  // Energised: white noise at full intensity pushes most nodes past the
  // threshold. Node count is unchanged, so the arc count must not collapse.
  await page.click('.type-btn[data-type="white"]');
  await clickPlay(page);
  await page.waitForTimeout(1500);
  const loud = await sample();

  assert(
    loud > quiet * 0.8,
    `raising energy must not stop nodes being drawn: ${quiet} arcs quiet vs ${loud} energised`,
  );
});

test('Info labels are drawn on screen, and only while the toggle is on', async page => {
  // Record every fillText the field issues. The world plane is sized so the far
  // plane fills the viewport, which means near nodes project past the edges —
  // and a nearest-first label pick walks straight into them.
  await page.addInitScript(() => {
    window.__labels = [];
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function fillText(text, x, y) {
      window.__labels.push({ text, x, y });
      return original.call(this, text, x, y);
    };
  });
  await page.reload({ waitUntil: 'load' });
  await page.click('.type-btn[data-type="white"]');
  await clickPlay(page);
  await setRange(page, 'stillFieldIntensity', 1);
  await page.waitForTimeout(3000);

  const drawn = await page.evaluate(() => window.__labels);
  assert(drawn.length > 0, 'labels should be drawn with the toggle on and the field energised');

  const size = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const offscreen = drawn.filter(l => l.x < 0 || l.x > size.w || l.y < 0 || l.y > size.h);
  assertEqual(offscreen.length, 0, `every label should land inside the viewport, ${offscreen.length}/${drawn.length} did not`);

  // Two decimals, and never built with toFixed in the loop — the readouts come
  // from a pre-quantised table, so every one of them must be in that table.
  const malformed = drawn.filter(l => !/^[01]\.\d{2}$/.test(l.text));
  assertEqual(malformed.length, 0, `readouts should be two-decimal energies, saw ${JSON.stringify(malformed.slice(0, 3))}`);

  await page.click('#stillFieldNerdToggle');
  await page.evaluate(() => { window.__labels.length = 0; });
  await page.waitForTimeout(1000);
  assertEqual((await page.evaluate(() => window.__labels.length)), 0, 'no labels should be drawn once the toggle is off');
});

test('Info labels toggle is disabled while the Still Field is off', async page => {
  assert(!(await page.isDisabled('#stillFieldNerdToggle')), 'labels toggle should start enabled');

  await page.click('#stillFieldToggle');
  await page.waitForTimeout(100);
  assert(await page.isDisabled('#stillFieldNerdToggle'), 'labels toggle should be disabled with the field off');
  // The texture is an independent CSS overlay, so it stays usable.
  assert(!(await page.isDisabled('#stillFieldTextureToggle')), 'texture toggle should stay enabled with the field off');

  await page.click('#stillFieldToggle');
  await page.waitForTimeout(100);
  assert(!(await page.isDisabled('#stillFieldNerdToggle')), 'labels toggle should re-enable with the field on');
});

test('ultra glass toggles, restyles the surfaces, and persists', async page => {
  const surfaceAlpha = () => page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--surface').trim());

  const standard = await surfaceAlpha();
  await page.click('#stillGlassToggle');
  await page.waitForTimeout(150);

  assertEqual(await page.getAttribute('html', 'data-glass'), 'ultra', 'html should carry data-glass="ultra"');
  assertEqual(await page.getAttribute('#stillGlassToggle', 'aria-checked'), 'true', 'glass switch should read checked');
  assert((await surfaceAlpha()) !== standard, 'ultra glass should actually change the --surface token');
  assertEqual(await storage(page, 'complexNoise_stillGlassTransparent'), 'true', 'glass choice should persist');

  await page.reload({ waitUntil: 'load' });
  assertEqual(await page.getAttribute('html', 'data-glass'), 'ultra', 'glass mode should restore after reload');
  assertEqual(await page.getAttribute('#stillGlassToggle', 'aria-checked'), 'true', 'restored glass switch should read checked');
});

test('ultra glass survives a theme change', async page => {
  await page.click('#stillGlassToggle');
  await page.click('.theme-seg[data-theme="bone"]');
  await page.waitForTimeout(150);

  assertEqual(await page.getAttribute('html', 'data-still-theme'), 'bone', 'theme should switch');
  assertEqual(await page.getAttribute('html', 'data-glass'), 'ultra', 'glass mode is a separate axis and must survive');
});

// ==========================================================
// UI chrome (immersion hide)
// ==========================================================

test('hiding chrome fades the main UI and persists, Escape restores', async page => {
  // Hide via the dedicated Minimise interface button inside the Still Field card.
  await page.click('#uiChromeMinimise');
  await page.waitForTimeout(150);

  assertEqual(await page.getAttribute('html', 'data-ui-chrome'), 'hidden', 'html should mark chrome as hidden');
  assertEqual(await page.getAttribute('#uiChromeToggle', 'aria-label'), 'Show controls', 'floating control should offer restore');
  assertEqual(await page.getAttribute('#uiChromeToggle', 'aria-pressed'), 'true', 'floating restore pressed while chrome is hidden');
  assertEqual(await storage(page, 'complexNoise_uiChromeHidden'), 'true', 'chrome hide should persist');

  // Main chrome is not interactive while hidden.
  const mainHidden = await page.evaluate(() => {
    const main = document.querySelector('main');
    const style = getComputedStyle(main);
    return style.visibility === 'hidden' || style.pointerEvents === 'none';
  });
  assert(mainHidden, 'main should be non-interactive while chrome is hidden');

  // Floating restore is now the only interactive entry point for the full UI.
  const floatingInteractive = await page.evaluate(() => {
    const btn = document.getElementById('uiChromeToggle');
    const style = getComputedStyle(btn);
    return parseFloat(style.opacity) > 0 && style.pointerEvents !== 'none';
  });
  assert(floatingInteractive, 'floating restore button should be interactive while chrome is hidden');

  // Minimised play and status should also be present.
  assert(await page.isVisible('#minimisedPlayBtn'), 'minimised play button should be visible');
  assert(await page.isVisible('#minimisedStatus'), 'minimised status should be visible');

  await page.reload({ waitUntil: 'load' });
  assertEqual(await page.getAttribute('html', 'data-ui-chrome'), 'hidden', 'hidden chrome should restore after reload');

  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  assertEqual(await page.getAttribute('html', 'data-ui-chrome'), 'visible', 'Escape should restore chrome');
  assertEqual(await storage(page, 'complexNoise_uiChromeHidden'), 'false', 'restored chrome should persist');
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
    document.querySelectorAll('button').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.height < 44) out.push(`${el.id || el.className}: ${Math.round(r.height)}px`);
    });
    return out;
  });
  assertEqual(small.length, 0, `touch targets under 44px: ${small.join(', ')}`);
});

test('the role="switch" controls respond to the keyboard', async page => {
  await page.focus('#stillFieldToggle');
  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
  assertEqual(await page.getAttribute('#stillFieldToggle', 'aria-checked'), 'false', 'Space should toggle the Still Field switch');

  await page.focus('#stillGlassToggle');
  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
  assertEqual(await page.getAttribute('#stillGlassToggle', 'aria-checked'), 'true', 'Space should toggle the glass switch');
});

test('Still Equaliser is open by default', async page => {
  assert(await page.evaluate(() => document.getElementById('stillPanel').open), 'equaliser details should start open');
});

// ==========================================================
// Runner
// ==========================================================

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

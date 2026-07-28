/**
 * Browser smoke tests for Complex Noise.
 *
 * These drive a real Chromium against the real render loop. Several of them
 * exist because a plausible-looking refactor broke something that only shows up
 * after the app has been running for a while — the transparent-canvas guard in
 * particular. Add to them rather than replacing them.
 *
 * ## How it runs
 *
 * One browser, one static server, and a pool of workers that each own a fresh
 * `BrowserContext`. Contexts are already the isolation boundary — separate
 * localStorage, separate page — so tests were never sharing anything; running
 * them one at a time was simply leaving the machine idle.
 *
 * That idleness was most of the suite. The tests that matter here are about
 * behaviour that emerges over *seconds* — a callout that must not change side
 * more than four times in six, a canvas that must not go opaque as the trail
 * accumulates — so they spend their time waiting on the app, not on the CPU.
 * Waiting concurrently costs nothing and is the whole speed-up.
 *
 *     npm test                      # all tests, auto-sized worker pool
 *     npm test -- --filter=colour   # only tests whose name contains "colour"
 *     npm test -- --workers=1       # serialise, e.g. when bisecting a flake
 *     npm test -- --repeat=20       # run the selection 20x to hunt a flake
 *     npm test -- --headed          # watch it (implies --workers=1)
 *     npm test -- --list            # print the test names and exit
 *
 * ## Waiting well
 *
 * Prefer `until(page, fn, ms)` over a bare `page.waitForTimeout`. Polling for
 * the condition with a deadline is *strictly stronger* than sleeping and then
 * checking once: it fails no later than the sleep would have, passes as soon as
 * the app is ready, and reports how long it actually took. Use a plain sleep
 * only when the elapsed time is itself the thing under test — the trail has to
 * accumulate for real seconds before "is the canvas opaque?" means anything.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { availableParallelism } from 'node:os';
import { chromium } from 'playwright';
import { startServer } from './server.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

/** `--flag`, `--key=value` and `-t value` in one small pass. */
function parseArgs(argv) {
  const opts = { headed: false, list: false, filter: '', workers: 0, repeat: 1 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const eq = arg.indexOf('=');
    const key = eq > 0 ? arg.slice(2, eq) : arg.replace(/^--/, '');
    const value = eq > 0 ? arg.slice(eq + 1) : argv[i + 1];
    if (arg === '--headed') opts.headed = true;
    else if (arg === '--list') opts.list = true;
    else if (key === 'filter' || arg === '-t') { opts.filter = value || ''; if (eq < 0) i++; }
    else if (key === 'workers') { opts.workers = Number(value) || 0; if (eq < 0) i++; }
    else if (key === 'repeat') { opts.repeat = Math.max(1, Number(value) || 1); if (eq < 0) i++; }
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));

/**
 * Worker count. Headed runs serialise so there is one window to watch, and CI
 * runners are small enough that oversubscribing a browser costs more in context
 * startup than it wins back. Four is plenty: the wall time floor is the single
 * longest test, not the pool size.
 */
const WORKERS = opts.headed
  ? 1
  : Math.max(1, opts.workers || Number(process.env.TEST_WORKERS) || Math.min(4, availableParallelism()));

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

/**
 * Poll an in-page predicate until it holds, or fail with `message` at `timeout`.
 *
 * The timeout is a *budget*, not a duration: a passing run leaves as soon as the
 * condition holds. Swapping a `waitForTimeout(3000)` for this never weakens the
 * assertion — the old code would have slept the full three seconds and then
 * checked the same predicate once, so anything that fails here failed there too.
 *
 * @param {import('playwright').Page} page
 * @param {Function|string} fn evaluated in the page; truthy return ends the wait
 * @param {number} timeout milliseconds before giving up
 * @param {string} message shown on timeout
 */
async function until(page, fn, timeout, message) {
  try {
    await page.waitForFunction(fn, null, { timeout, polling: 100 });
  } catch (err) {
    throw new Error(`${message} (waited ${timeout}ms)`);
  }
}

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
  // The three canvas overlays are separate settings, and all three default on,
  // so a first-run session looks as it did when they were one switch.
  assertEqual(await page.getAttribute('#fieldCodeToggle', 'aria-pressed'), 'true', 'source overlay should default to on');
  assertEqual(await page.getAttribute('#fieldCalloutToggle', 'aria-pressed'), 'true', 'node callouts should default to on');
  assertEqual(await page.getAttribute('#fieldEdgeToggle', 'aria-pressed'), 'true', 'edge dimensions should default to on');
});

test('the info layer has its own canvas, and clears when Stats is off', async page => {
  // Text and the field's alpha-subtracting trail cannot share a surface: a
  // moving label smears into a halo. The separation is the fix, so the test is
  // that the instrumentation really is on the other canvas, and that the other
  // canvas is genuinely emptied rather than merely stopped being drawn to.
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.click('#uiChromeMinimise');

  const inkExpression = () => {
    const c = document.getElementById('stillFieldInfo');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
    return n;
  };
  const countInk = () => page.evaluate(inkExpression);

  // Callouts fade in on an envelope, so this is a race against an animation
  // rather than a fixed delay. Polling for the ink both fails no later than the
  // old sleep did and returns the moment the layer is actually carrying text.
  await until(page, `(${inkExpression})() > 500`, 6000,
    'info canvas should be carrying callouts once the interface is out of the way');

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
  //
  // Measured against the field's own diagnostics clock, never against wall
  // time. `infoClockS` accumulates `dt` capped at MAX_STEP_S, so on a loaded
  // machine — a CI runner, or this suite's own worker pool — it deliberately
  // advances *slower* than the clock on the wall. Asserting "the mode rotated
  // within 5.2 real seconds" therefore tests the host's spare CPU as much as
  // the rotation, and fails on a busy one for a reason that has nothing to do
  // with the schedule.
  await page.evaluate(() => {
    const el = document.getElementById('fieldDwell');
    el.value = '4';
    el.dispatchEvent(new Event('input'));
  });
  await page.waitForTimeout(200);

  const start = await page.evaluate(() => window.complexNoiseStill.getFieldStats());
  const first = start.labelMode;
  assert(start.modeRemaining <= 4 * 1.3, `remaining ${start.modeRemaining}s should be inside one dwell slice`);

  // The longest weighted slice is 4 × 1.28, so one full slice of the field's own
  // clock is the bound the rotation has to land inside. The wall-clock budget is
  // only a backstop against a loop that has stopped advancing at all.
  const deadline = start.realClock + 4 * 1.28;
  await until(page, `(() => {
    const s = window.complexNoiseStill.getFieldStats();
    return s.labelMode !== ${JSON.stringify(first)} || s.realClock > ${deadline};
  })()`, 30000, 'the render loop stopped advancing its diagnostics clock');

  const second = await page.evaluate(() => window.complexNoiseStill.getFieldStats().labelMode);
  assert(first !== second, `mode should have rotated within a dwell, stayed on ${first}`);
});

test('callouts on screen read different quantities from each other', async page => {
  // One global detail mode meant every callout on screen was a copy of its
  // neighbour. Each node now offsets the rotation by its own lifetime ID.
  //
  // Sampled over several seconds and judged on the best observation, because
  // how many callouts are placed at any one instant depends on the energy gate
  // and the placement contest — three callouts cannot show five modes, and that
  // is not the thing under test.
  //
  // The sampling window is long rather than the bar low. The sticky side and
  // the longer hold make a given instant calmer, not less varied — φ still
  // spreads the offsets across all eight modes — so the right response to a
  // quiet frame is to keep watching, not to accept a field that reads two
  // quantities. Weakening this to 2 is what let a release ship claiming a
  // regime whose code was never merged.
  await page.setViewportSize({ width: 1400, height: 950 });
  await page.click('#uiChromeMinimise');
  await until(page, 'window.complexNoiseStill.getFieldStats().labels >= 1', 8000,
    'expected the callout layer to start placing blocks');

  let bestModes = 0;
  let bestLabels = 0;
  let modeCount = 0;
  for (let i = 0; i < 12; i++) {
    const s = await page.evaluate(() => window.complexNoiseStill.getFieldStats());
    modeCount = s.modeCount;
    if (s.labels > bestLabels) bestLabels = s.labels;
    if (s.modesOnScreen > bestModes) bestModes = s.modesOnScreen;
    // A moment with several callouts must never show only one quantity.
    if (s.labels >= 4) {
      assert(s.modesOnScreen >= 2,
        `${s.labels} callouts showed only ${s.modesOnScreen} distinct mode`);
    }
    await page.waitForTimeout(700);
  }

  assertEqual(modeCount, 8, 'there should be eight detail modes');
  assert(bestLabels >= 4, `expected several callouts on a wide viewport, best was ${bestLabels}`);
  assert(bestModes >= 3,
    `expected several distinct modes at once, best was ${bestModes} of ${bestLabels} callouts`);
});

test('a visible callout settles on one side of its node', async page => {
  // Which side a block sits on is remembered and only mirrored when the
  // preferred side is genuinely unusable, so a node drifting around the right
  // margin cannot throw a 132px plate back and forth across its own leader
  // line. Only blocks already faded in are counted — a side chosen at zero
  // opacity is not something anybody saw move — and a real flip is allowed, so
  // this bounds the rate rather than the count.
  //
  // Honest limitation: the pre-sticky placement also scores zero here, because
  // reproducing the bounce needs a node to sit on the margin threshold for
  // seconds and the harness cannot make one do that. This guards the invariant
  // going forward; it is not evidence about the code it replaced.
  await page.setViewportSize({ width: 1400, height: 950 });
  await page.click('#uiChromeMinimise');
  await until(page, 'window.complexNoiseStill.getFieldStats().labels >= 1', 8000,
    'expected callouts to be drawing');

  const before = await page.evaluate(() => window.complexNoiseStill.getFieldStats());
  // This one stays a real sleep: six seconds of elapsed motion *is* the
  // measurement, not a wait for something to become true.
  await page.waitForTimeout(6000);
  const after = await page.evaluate(() => window.complexNoiseStill.getFieldStats());

  const flips = after.calloutFlips - before.calloutFlips;
  assert(flips <= 4,
    `visible callouts changed side ${flips} times in six seconds — the bounce is back`);
});

test('the three canvas overlays toggle independently and persist', async page => {
  await page.setViewportSize({ width: 1400, height: 950 });
  await page.click('#uiChromeMinimise');
  await page.waitForTimeout(2500);
  await page.click('#uiChromeToggle');

  await page.click('#fieldEdgeToggle');
  await page.waitForTimeout(400);
  assertEqual(await page.getAttribute('#fieldEdgeToggle', 'aria-pressed'), 'false', 'dimensions should read off');
  assertEqual(await storage(page, 'complexNoise_stillFieldEdges'), 'false', 'dimensions should persist');
  assertEqual(await page.getAttribute('#fieldCalloutToggle', 'aria-pressed'), 'true', 'callouts should be untouched');
  let s = await page.evaluate(() => window.complexNoiseStill.getFieldStats());
  assertEqual(s.edgeLabels, 0, 'turning dimensions off must stop drawing them');

  await page.click('#fieldCalloutToggle');
  await page.waitForTimeout(400);
  s = await page.evaluate(() => window.complexNoiseStill.getFieldStats());
  assertEqual(s.labels, 0, 'turning callouts off must stop drawing them');
  assertEqual(await storage(page, 'complexNoise_stillFieldCallouts'), 'false', 'callouts should persist');

  await page.click('#fieldLabReset');
  await page.waitForTimeout(200);
  assertEqual(await page.getAttribute('#fieldCalloutToggle', 'aria-pressed'), 'true', 'reset should restore callouts');
  assertEqual(await page.getAttribute('#fieldEdgeToggle', 'aria-pressed'), 'true', 'reset should restore dimensions');
});

test('the source overlay folds from its own title bar', async page => {
  // The overlay is canvas, so the fold is a hit test rather than a button. It
  // must respond on the header and nowhere else.
  await page.setViewportSize({ width: 1400, height: 950 });
  await page.click('#uiChromeMinimise');
  await page.waitForTimeout(2500);

  // First free corner with the minimised cluster holding the bottom right.
  const left = 1400 - 356 - 20;
  const headerY = 24 + 6;

  await page.mouse.click(left + 120, headerY + 400);
  await page.waitForTimeout(200);
  assertEqual(await page.evaluate(() => window.complexNoiseStill.getFieldState().codeFolded), false,
    'a press on the listing body must not fold it');

  await page.mouse.click(left + 120, headerY);
  await page.waitForTimeout(300);
  assertEqual(await page.evaluate(() => window.complexNoiseStill.getFieldState().codeFolded), true,
    'a press on the title bar should fold the listing');

  await page.mouse.click(left + 120, headerY);
  await page.waitForTimeout(300);
  assertEqual(await page.evaluate(() => window.complexNoiseStill.getFieldState().codeFolded), false,
    'a second press should unfold it');
});

test('the Still Field facade keeps its whole public API', async page => {
  // The renderer is a directory now, and `js/still-field.js` is the front door
  // that re-composes it. `app.js` imports that door as one namespace, so an
  // export left behind in a module nobody re-exports is a `TypeError` at the
  // moment some button is pressed — possibly a button nobody presses until a
  // user does. Naming the surface here is what makes the *next* phase of the
  // split safe to attempt: move whatever you like, but this list must still
  // resolve.
  const expected = [
    'getState', 'subscribe',
    'initStillField', 'initStillFieldNodes', 'startStillFieldLoop', 'handleResize',
    'handleOverlayPointer', 'refreshThemeColors', 'setLabelKeepOuts',
    'getStillFieldStats', 'getStillAudioMetrics', 'getStillEnergy',
    'getStillFieldEnabled', 'getStillFieldIntensity', 'getStillFieldSpeed',
    'getStillFieldNerd', 'getStillFieldTexture', 'getStillFieldCode',
    'getStillFieldCallouts', 'getStillFieldEdges', 'getStillFieldDwell',
    'getStillFieldFps', 'getNerdFolded',
    'setStillFieldEnabled', 'setStillFieldIntensity', 'setStillFieldSpeed',
    'setStillFieldNerd', 'setStillFieldTexture', 'setStillFieldDensity',
    'setStillFieldReach', 'setStillFieldTrail', 'setStillFieldDepth',
    'setStillFieldDwell', 'setStillFieldFps', 'setStillFieldCode',
    'setStillFieldCallouts', 'setStillFieldEdges', 'setCodeFolded',
    'setNerdFolded', 'toggleNerdFolded', 'setNerdView',
  ];
  const missing = await page.evaluate(async names => {
    const mod = await import('/js/still-field.js');
    return names.filter(name => typeof mod[name] !== 'function');
  }, expected);
  assertEqual(missing.join(', '), '', 'js/still-field.js stopped exporting these');

  // MODE_HANDLE is indexed by mode, so a mode added to one array and not the
  // other draws `undefined` as a glyph — and MODE_WEIGHTS re-derives itself
  // from the same length, so a mismatch silently shortens the rotation too.
  const modes = await page.evaluate(async () => {
    const m = await import('/js/still-field/modes.js');
    return { names: m.LABEL_MODE_NAMES.length, handles: m.MODE_HANDLE.length, weights: m.MODE_WEIGHTS.length };
  });
  assertEqual(modes.handles, modes.names, 'MODE_HANDLE needs exactly one glyph per detail mode');
  assertEqual(modes.weights, modes.names, 'MODE_WEIGHTS needs exactly one weight per detail mode');
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

test('all six noise colours are wired, exclusive and persisted', async page => {
  const types = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.type-btn'), b => b.dataset.type));
  const expected = await page.evaluate(async () =>
    (await import('/js/constants.js')).NOISE_TYPES);
  assertEqual(types.join(','), expected.join(','),
    'the type buttons and NOISE_TYPES must agree, in order — app.js binds from data-type');
  const generators = await page.evaluate(async () =>
    Object.keys((await import('/js/noise.js')).GENERATORS));
  assertEqual(generators.sort().join(','), [...expected].sort().join(','),
    'GENERATORS and NOISE_TYPES must contain the same colours — fallback audio can otherwise hide a missing generator');

  for (const type of ['green', 'fan', 'rain']) {
    await page.click(`.type-btn[data-type="${type}"]`);
    await page.waitForTimeout(120);
    assertEqual(await page.getAttribute(`.type-btn[data-type="${type}"]`, 'aria-pressed'), 'true',
      `${type} should read pressed after selecting it`);
    const pressed = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.type-btn'))
        .filter(b => b.getAttribute('aria-pressed') === 'true').length);
    assertEqual(pressed, 1, `exactly one colour may read pressed, ${type} left ${pressed}`);
    assertEqual(await storage(page, 'complexNoise_type'), type, `${type} should persist`);
  }

  await page.reload({ waitUntil: 'load' });
  assertEqual(await page.getAttribute('.type-btn[data-type="rain"]', 'aria-pressed'), 'true',
    'the persisted colour should be restored on load');
});

test('every colour survives a real cross-fade through the audio graph', async page => {
  // setType() builds a fresh 12 s buffer inside a 150 ms dip, so this is where a
  // generator that throws, or fills the buffer with NaN, actually surfaces.
  // The play button animates forever and never satisfies Playwright's
  // actionability check, hence force.
  await page.click('#playBtn', { force: true });
  await page.waitForTimeout(300);

  const order = await page.evaluate(async () =>
    (await import('/js/constants.js')).NOISE_TYPES);
  for (const type of order) {
    await page.click(`.type-btn[data-type="${type}"]`);
    await page.waitForTimeout(320);
  }

  assertEqual(page.errors.length, 0, `switching colours reported errors: ${page.errors.join(' | ')}`);
  const state = await page.evaluate(async () => (await import('/js/audio.js')).getState());
  assertEqual(state.isPlaying, true, 'playback should have survived six colour changes');
  assertEqual(state.type, order[order.length - 1], 'the last colour clicked should be current');
  assert(/rain/i.test(state.status), `status should name the current colour, got "${state.status}"`);
});

test('rapid colour changes coalesce and cannot replace a resumed source', async page => {
  // Count real generated AudioBuffers. Before the timer was made cancellable,
  // three quick clicks generated three full 12 s buffers, and a colour timeout
  // that survived pause → play replaced the newly resumed source.
  await page.evaluate(() => {
    window.noiseBufferCount = 0;
    const createBuffer = window.AudioContext.prototype.createBuffer;
    window.AudioContext.prototype.createBuffer = function (...args) {
      window.noiseBufferCount++;
      return createBuffer.apply(this, args);
    };
  });

  await page.click('#playBtn', { force: true });
  await page.waitForTimeout(250);
  assertEqual(await page.evaluate(() => window.noiseBufferCount), 1,
    'starting playback should build exactly one noise buffer');

  // Driven from inside the page rather than over three `page.click` round
  // trips. The window under test is the 160 ms colour dip, and a Playwright
  // click costs a CDP round trip that is far from free on a loaded machine — so
  // the old version was really asserting "the harness can land three clicks in
  // 160 ms", which stops being true the moment anything else is running. The
  // clicks are real `click()` calls on the real buttons; only the latency of
  // asking for them from Node has been removed.
  await page.evaluate(() => {
    for (const type of ['green', 'fan', 'rain']) {
      document.querySelector(`.type-btn[data-type="${type}"]`).click();
    }
  });
  await page.waitForTimeout(450);
  assertEqual(await page.evaluate(() => window.noiseBufferCount), 2,
    'rapid colour clicks should coalesce into one replacement buffer');

  // Same reasoning: a pause and an immediate resume have to happen inside the
  // pending switch's own 160 ms timeout for this to be testing anything.
  await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    document.querySelector('.type-btn[data-type="green"]').click();
    await wait(40);
    document.getElementById('playBtn').click();
    await wait(40);
    document.getElementById('playBtn').click();
  });
  await page.waitForTimeout(450);

  assertEqual(await page.evaluate(() => window.noiseBufferCount), 3,
    'a colour timeout from before pause must not replace the newly resumed source');
  const state = await page.evaluate(async () => (await import('/js/audio.js')).getState());
  assertEqual(state.isPlaying, true, 'playback should remain active after pause and immediate resume');
  assertEqual(state.type, 'green', 'the selected colour should survive pause and immediate resume');
});

test('every colour is level-matched, has headroom, and loops without a seam', async page => {
  // Three separate regressions live here, all of them things you only notice
  // hours in, which is exactly when this app is being used:
  //
  //  - Loudness. Matching on raw RMS put the first cut of green +4.3 dB and rain
  //    +2.5 dB above the rest, so changing colour at 3 a.m. made the room louder.
  //    The measure is A-weighted, because where the energy sits matters as much
  //    as how much of it there is.
  //  - Headroom. A noise this long peaks near 5.15x its RMS. green, fan and rain
  //    all peaked over 1.0 on the first cut.
  //  - The loop seam. A filter started from zero state steps at every wrap;
  //    brown's step was 1.7x larger than anything else in its own signal, every
  //    twelve seconds. The generators run a second pass over the head of the
  //    sequence to carry the state round, and the test for it is that the wrap
  //    looks like ordinary noise rather than like an edit.
  const report = await page.evaluate(async () => {
    const { GENERATORS, generateNoiseBuffer } = await import('/js/noise.js');

    // A-weighting as a cascade of one-pole sections, accumulated in scalars so
    // no intermediate arrays are needed. Only ratios between colours are used,
    // so the 1 kHz normalisation cancels and is left out.
    const aWeightedRms = (x, count, sr) => {
      const hp = f => 1 / (1 + Math.tan(Math.PI * f / sr));
      const lp = f => { const w = Math.tan(Math.PI * f / sr); return w / (1 + w); };
      const h = [hp(20.598997), hp(20.598997), hp(107.65265), hp(737.86223)];
      const l = [lp(12194.217), lp(12194.217)];
      const xp = [0, 0, 0, 0], yp = [0, 0, 0, 0], ls = [0, 0];
      let sum = 0;
      for (let i = 0; i < count; i++) {
        let v = x[i];
        for (let k = 0; k < 4; k++) {
          const out = h[k] * (v - xp[k] + yp[k]);
          xp[k] = v; yp[k] = out; v = out;
        }
        for (let k = 0; k < 2; k++) { ls[k] += l[k] * (v - ls[k]); v = ls[k]; }
        // Skip the filter's own settling time.
        if (i > sr / 10) sum += v * v;
      }
      return Math.sqrt(sum / (count - sr / 10));
    };

    const out = {};
    const ctx = new OfflineAudioContext(1, 128, 48000);
    for (const name of Object.keys(GENERATORS)) {
      const d = generateNoiseBuffer(ctx, name).getChannelData(0);
      const n = d.length;

      let peak = 0, sum = 0, finite = true;
      for (let i = 0; i < n; i++) {
        const v = d[i];
        if (!Number.isFinite(v)) { finite = false; break; }
        const a = v < 0 ? -v : v;
        if (a > peak) peak = a;
        sum += v * v;
      }

      // The wrap step, judged against how far this signal moves between
      // adjacent samples anyway — an absolute threshold would be meaningless
      // across colours as different as brown and white.
      const sample = new Float32Array(40000);
      for (let i = 0; i < sample.length; i++) {
        const diff = d[i + 200000] - d[i + 199999];
        sample[i] = diff < 0 ? -diff : diff;
      }
      sample.sort();

      out[name] = {
        finite,
        rms: Math.sqrt(sum / n),
        peak,
        aRms: aWeightedRms(d, 48000 * 4, 48000),
        wrapStep: Math.abs(d[0] - d[n - 1]),
        ownP999: sample[Math.floor(sample.length * 0.999)],
      };
    }
    return out;
  });

  const centre = (report.brown.aRms + report.pink.aRms) / 2;
  for (const [name, m] of Object.entries(report)) {
    assert(m.finite, `${name} produced a non-finite sample — that is silence or a scream, never both`);
    assert(m.rms > 0.05, `${name} is effectively silent (rms ${m.rms.toFixed(4)})`);

    const level = 20 * Math.log10(m.aRms / centre);
    assert(Math.abs(level) <= 2,
      `${name} sits ${level.toFixed(2)} dB from the brown/pink centre, outside the ±2 dB window`);

    // Headroom is judged on RMS, not on the measured peak. The peak of a noise
    // sequence is a statistical maximum that moves several percent between
    // buffers, so asserting on it directly is either flaky or too loose to catch
    // anything. RMS over 576k samples is stable to a fraction of a percent, and
    // a Gaussian sequence this long peaks near 5.15x it. White is the exception:
    // it is uniform and hard-bounded, so its own peak is the honest figure.
    const expectedPeak = name === 'white' ? m.peak : m.rms * 5.15;
    assert(expectedPeak <= 1.15,
      `${name} has too little headroom: rms ${m.rms.toFixed(4)} implies a peak near `
      + `${expectedPeak.toFixed(3)} (measured ${m.peak.toFixed(3)} this run) — lower its gain`);

    // The wrap step is itself one random draw, so it is given a little room
    // above the 99.9th percentile. Brown's seam before the fix was 1.7x that
    // percentile, so the margin costs nothing in detection.
    assert(m.wrapStep <= m.ownP999 * 1.25,
      `${name} has an audible loop seam: the wrap steps ${m.wrapStep.toFixed(4)}, `
      + `beyond the ${m.ownP999.toFixed(4)} it moves between adjacent samples anywhere else`);
  }
});

test('modulated colours complete whole LFO cycles across the buffer', async page => {
  // An LFO whose period does not divide the buffer snaps back to its starting
  // phase at every wrap, which is a step in level every twelve seconds, all
  // night. It is asserted here rather than on the samples because the step is
  // around 0.6 dB and both the intended modulation and the noise's own
  // short-window level move further than that.
  const checks = await page.evaluate(async () => {
    const { lfoStep } = await import('/js/noise.js');
    const { BUFFER_DURATION } = await import('/js/constants.js');
    const out = [];
    for (const sr of [44100, 48000]) {
      const length = Math.floor(sr * BUFFER_DURATION);
      for (const target of [13.5, 6, 0.5, 400]) {
        const cycles = lfoStep(target, length, sr) * length / (2 * Math.PI);
        out.push({ sr, target, cycles });
      }
    }
    return out;
  });

  for (const { sr, target, cycles } of checks) {
    assert(Math.abs(cycles - Math.round(cycles)) < 1e-9,
      `a ${target}s LFO at ${sr}Hz spans ${cycles} cycles per buffer — must be a whole number`);
    assert(Math.round(cycles) >= 1,
      `a ${target}s LFO at ${sr}Hz rounded down to ${cycles} cycles; it must never reach zero, `
      + 'which would freeze the modulation at full level');
  }
});

test('the wake lock is released when playback stops during the request', async page => {
  // `navigator.wakeLock.request()` is asynchronous, and pressing play then pause
  // inside that gap used to strand the lock: stop() released a handle that was
  // still null, and the request then installed itself into the same variable
  // with nothing left to ever let go of it. On a phone that is a screen lit all
  // night over silent audio.
  //
  // The real API is stubbed rather than driven, because the outcome under test
  // is what *this* code does with a slow grant — a genuine wake lock resolves
  // too fast to reproduce the race, and is refused outright in headless.
  await page.addInitScript(() => {
    window.__wake = { requests: 0, released: 0, resolve: null };
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: () => new Promise(resolve => {
          window.__wake.requests++;
          window.__wake.resolve = () => resolve({
            release: () => { window.__wake.released++; return Promise.resolve(); },
            addEventListener: () => {},
          });
        }),
      },
    });
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.complexNoiseStill, null, { timeout: 15000 });

  // Play, then pause before the browser grants the lock.
  await page.click('#playBtn', { force: true });
  await until(page, 'window.__wake.requests === 1', 3000, 'play should have requested a wake lock');
  await page.click('#playBtn', { force: true });
  assertEqual(await page.evaluate(() => window.complexNoiseStill.getIsPlaying()), false,
    'playback should be stopped before the lock is granted');

  // Now let the request resolve into a stopped player.
  await page.evaluate(() => window.__wake.resolve());
  await until(page, 'window.__wake.released === 1', 3000,
    'a wake lock granted after playback stopped must be released, not stranded');
});

test('the sleep timer fires on its deadline, not on its setTimeout', async page => {
  // A backgrounded tab has its timers throttled to once a minute and a
  // suspended phone does not run them at all, so a one-hour sleep timer can come
  // back long overdue and still playing. The deadline is wall-clock, and coming
  // back to a visible page re-checks it.
  //
  // Time is moved rather than waited for: `Date.now` is offset from the page's
  // own clock so the test can put the device to sleep for two hours in a
  // millisecond.
  await page.addInitScript(() => {
    window.__skewMs = 0;
    const realNow = Date.now;
    Date.now = () => realNow() + window.__skewMs;
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.complexNoiseStill, null, { timeout: 15000 });

  await page.evaluate(() => {
    const el = document.getElementById('timer');
    el.value = '0.5';
    el.dispatchEvent(new Event('input'));
  });
  await page.click('#playBtn', { force: true });
  await until(page, 'window.complexNoiseStill.getIsPlaying()', 3000, 'playback should have started');

  const armed = await page.evaluate(() => window.complexNoiseStill.getTimerRemainingMs());
  assert(armed > 29 * 60 * 1000 && armed <= 30 * 60 * 1000,
    `a half-hour timer should be armed for ~30 minutes, got ${Math.round(armed / 1000)}s`);

  // Twenty minutes of "suspend": due later, so nothing should happen yet.
  await page.evaluate(() => {
    window.__skewMs = 20 * 60 * 1000;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  assertEqual(await page.evaluate(() => window.complexNoiseStill.getIsPlaying()), true,
    'a timer that is not due yet must not stop playback when the page comes back');

  // Now come back two hours later, long past the deadline. The setTimeout has
  // certainly not fired — only the deadline check can catch this.
  await page.evaluate(() => {
    window.__skewMs = 2 * 60 * 60 * 1000;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await until(page, '!window.complexNoiseStill.getIsPlaying()', 3000,
    'a sleep timer that came due while the device slept must stop playback on return');
  assert(/timer ended/i.test(await page.evaluate(() => window.complexNoiseStill.getAudioState().status)),
    'the status should say the sleep timer ended');
});

test('dragging a slider does not write to localStorage once per pointer move', async page => {
  // `localStorage.setItem` is synchronous and hits the disk. One per pointer
  // move — which is what a slider's `input` event rate means — put a hundred
  // blocking writes on the same thread as the render loop for one drag.
  const writes = await page.evaluate(async () => {
    const setItem = Storage.prototype.setItem;
    let calls = 0;
    Storage.prototype.setItem = function (...args) { calls++; return setItem.apply(this, args); };

    const el = document.getElementById('volume');
    for (let i = 0; i < 60; i++) {
      el.value = String(0.2 + i * 0.005);
      el.dispatchEvent(new Event('input'));
    }
    const during = calls;
    // Read the value back off the control: a range input snaps whatever it is
    // handed to its own `step`, so the last value the app actually saw is the
    // element's, not the one the loop asked for.
    const expected = el.value;
    // The value has to be readable immediately even though the disk write is
    // still queued — deferring the write must not defer the setting.
    const live = (await import('/js/storage.js')).read('complexNoise_volume');
    await new Promise(r => setTimeout(r, 400));
    return { during, after: calls, live, expected, stored: localStorage.getItem('complexNoise_volume') };
  });

  assert(writes.during <= 2,
    `60 slider events should not each hit the disk, saw ${writes.during} writes during the drag`);
  assert(writes.after <= 4,
    `the drag should settle into a handful of writes, saw ${writes.after}`);
  assertEqual(writes.live, writes.expected, 'a throttled write must be readable immediately');
  assertEqual(writes.stored, writes.expected,
    'the final value must reach localStorage once the drag settles');
});

test('a discrete setting still persists immediately', async page => {
  // The throttle is opt-in for continuous controls. Buttons and toggles keep the
  // straight-through write, so nothing that used to be durable on click stopped
  // being durable.
  const writes = await page.evaluate(() => {
    const setItem = Storage.prototype.setItem;
    let calls = 0;
    Storage.prototype.setItem = function (...args) { calls++; return setItem.apply(this, args); };
    document.querySelector('.type-btn[data-type="white"]').click();
    return { calls, stored: localStorage.getItem('complexNoise_type') };
  });
  assertEqual(writes.stored, 'white', 'a colour choice must reach localStorage on the click');
  assert(writes.calls >= 1, 'a discrete setting should write straight through');
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

// ----------------------------------------------------------
// Runner
// ----------------------------------------------------------

const selected = tests.filter(t => !opts.filter || t.name.includes(opts.filter));

if (opts.list) {
  for (const t of tests) console.log(t.name);
  process.exit(0);
}

if (!selected.length) {
  console.log(`no test matches --filter=${JSON.stringify(opts.filter)}`);
  process.exit(1);
}

/**
 * The queue every worker pulls from. Repeats are expanded into it rather than
 * looped around the pool, so `--repeat=20 --workers=4` really does keep four
 * browsers busy instead of running twenty serial passes four times over.
 */
const queue = [];
for (let pass = 0; pass < opts.repeat; pass++) {
  for (let i = 0; i < selected.length; i++) {
    queue.push({ index: i, pass, ...selected[i] });
  }
}

const server = await startServer(ROOT);
const browser = await chromium.launch({
  headless: !opts.headed,
  executablePath: CHROMIUM_PATH,
  args: ['--autoplay-policy=no-user-gesture-required'],
});

/** Results indexed by `selected` position, so output order never depends on timing. */
const results = selected.map(t => ({ name: t.name, runs: [] }));
let cursor = 0;

/**
 * Run one test in its own context.
 *
 * A fresh `BrowserContext` per test is what makes the pool safe: localStorage,
 * permissions and the page itself are all per-context, so two tests toggling the
 * same persisted setting cannot see each other. The shared pieces — the browser
 * process and the static server — are stateless with respect to the app.
 */
async function runOne(entry) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.errors = [];
  page.on('console', m => { if (m.type() === 'error') page.errors.push(m.text()); });
  page.on('pageerror', e => page.errors.push(`pageerror: ${e.message}`));

  const started = Date.now();
  try {
    await page.goto(`${server.origin}/index.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.complexNoiseStill, null, { timeout: 15000 });
    await entry.fn(page);
    return { ok: true, ms: Date.now() - started };
  } catch (err) {
    return { ok: false, ms: Date.now() - started, error: err.message };
  } finally {
    await context.close();
  }
}

async function worker() {
  while (cursor < queue.length) {
    const entry = queue[cursor++];
    const outcome = await runOne(entry);
    results[entry.index].runs.push(outcome);
    // Progress as it happens, so a hung suite shows which tests already landed.
    process.stdout.write(outcome.ok ? '.' : 'F');
  }
}

const wallStart = Date.now();
await Promise.all(Array.from({ length: Math.min(WORKERS, queue.length) }, worker));
process.stdout.write('\n\n');

await browser.close();
await server.close();

let passed = 0;
const failures = [];
for (const result of results) {
  const failed = result.runs.filter(r => !r.ok);
  // Slowest run is the honest figure: it is the one setting the wall-clock floor.
  const ms = Math.max(...result.runs.map(r => r.ms));
  if (failed.length) {
    failures.push(result.name);
    const detail = failed[0].error.split('\n').join('\n      ');
    const flaky = failed.length < result.runs.length ? ` (${failed.length}/${result.runs.length} runs)` : '';
    console.log(`  ✗ ${result.name}${flaky}  ${ms}ms\n      ${detail}`);
  } else {
    passed++;
    console.log(`  ✓ ${result.name}  ${ms}ms`);
  }
}

const wall = ((Date.now() - wallStart) / 1000).toFixed(1);
const repeated = opts.repeat > 1 ? ` × ${opts.repeat} passes` : '';
console.log(`\n${passed}/${results.length} passed in ${wall}s`
  + ` (${WORKERS} worker${WORKERS === 1 ? '' : 's'}${repeated})`);
if (failures.length) {
  console.log(`failed: ${failures.join(', ')}`);
  process.exit(1);
}

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

test('callouts on screen read different quantities from each other', async page => {
  // One global detail mode meant every callout on screen was a copy of its
  // neighbour. Each node now offsets the rotation by its own lifetime ID.
  //
  // Sampled over several seconds and judged on the best observation, because
  // how many callouts are placed at any one instant depends on the energy gate
  // and the placement contest — three callouts cannot show five modes, and that
  // is not the thing under test.
  //
  // Under the calm sticky-side + longer-hold regime the instantaneous spread
  // can legitimately sit at 2 for short windows; the per-sample guard and the
  // φ offset still guarantee disagreement whenever several labels are present.
  await page.setViewportSize({ width: 1400, height: 950 });
  await page.click('#uiChromeMinimise');
  await page.waitForTimeout(2500);

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
  assert(bestModes >= 2,
    `expected several distinct modes at once, best was ${bestModes} of ${bestLabels} callouts`);
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

  await page.click('.type-btn[data-type="green"]');
  await page.click('.type-btn[data-type="fan"]');
  await page.click('.type-btn[data-type="rain"]');
  await page.waitForTimeout(450);
  assertEqual(await page.evaluate(() => window.noiseBufferCount), 2,
    'rapid colour clicks should coalesce into one replacement buffer');

  await page.click('.type-btn[data-type="green"]');
  await page.waitForTimeout(40);
  await page.click('#playBtn', { force: true });
  await page.waitForTimeout(40);
  await page.click('#playBtn', { force: true });
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

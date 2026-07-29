/**
 * Temporary screenshot capture helper for Complex Noise.
 *
 * Re-uses the dependency-free static server from tests/server.mjs.
 * Run after `npm install` (Playwright is already a devDependency):
 *
 *   node scripts/capture-screenshots.mjs
 *
 * Produces the disciplined set defined in docs/SCREENSHOTS.md into
 * docs/screenshots/. Overwrites existing files of the same name.
 *
 * After the PNGs are good, update README.md + docs/INFO_LAYER.md embeds
 * and captions in the same PR, then optionally delete this script or leave
 * it as a non-published helper for future re-runs.
 *
 * No behavioural change to the product. Zero new runtime dependencies.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { startServer } from '../tests/server.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'screenshots');
const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

/** Poll until condition or timeout. Same spirit as the test harness. */
async function until(page, fn, timeout, message) {
  try {
    await page.waitForFunction(fn, null, { timeout, polling: 150 });
  } catch {
    throw new Error(`${message} (waited ${timeout}ms)`);
  }
}

async function clickPlay(page) {
  // The play button animates forever; force matches the test suite.
  await page.click('#playBtn', { force: true });
  await page.waitForTimeout(400);
}

async function setTheme(page, theme) {
  // Invoke the control without Playwright auto-scrolling it into view so paired
  // hero captures retain identical framing.
  await page.locator(`.theme-seg[data-theme="${theme}"]`).evaluate(button => button.click());
  await page.waitForTimeout(200);
}

async function setInfoLayer(page, enabled) {
  const toggle = page.locator('#stillFieldNerdToggle');
  const isEnabled = (await toggle.getAttribute('aria-pressed')) === 'true';
  if (isEnabled !== enabled) {
    await toggle.evaluate(button => button.click());
    await page.waitForTimeout(200);
  }
}

async function minimise(page) {
  await page.click('#uiChromeMinimise');
  await page.waitForTimeout(600);
}

async function restore(page) {
  await page.click('#uiChromeToggle');
  await page.waitForTimeout(400);
}

async function ensureFieldLabOpen(page) {
  // details#labPanel is open by default; make sure.
  const open = await page.evaluate(() => document.getElementById('labPanel')?.open);
  if (!open) {
    await page.click('#labPanel > summary');
    await page.waitForTimeout(200);
  }
}

async function waitForCallouts(page, minLabels = 2) {
  await until(
    page,
    `(() => {
      const s = window.complexNoiseStill?.getFieldStats?.();
      return s && s.labels >= ${minLabels};
    })()`,
    9000,
    `expected at least ${minLabels} callouts`
  );
}

async function capture(page, name, opts = {}) {
  const path = join(OUT, name);
  await page.screenshot({
    path,
    fullPage: opts.fullPage ?? false,
    type: 'png',
    ...opts,
  });
  console.log(`  wrote ${name}`);
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const server = await startServer(ROOT);
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROMIUM_PATH,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });

  try {
    console.log('Capturing Complex Noise screenshots…');
    console.log(`Server: ${server.origin}`);

  // ------------------------------------------------------------------
  // Desktop heroes & immersion (1440×900, DPR 2)
  // ------------------------------------------------------------------
  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.goto(`${server.origin}/index.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.complexNoiseStill, null, { timeout: 15000 });

    // Brown is default; ensure playing, field on, Stats on but we may fold later.
    await clickPlay(page);
    await page.waitForTimeout(1200); // trail + residual settle

    // Hero dark — full UI, clean. Hide the instrumentation overlays so the
    // product controls and field remain the focus.
    await setInfoLayer(page, false);
    await page.evaluate(() => window.scrollTo(0, 0));
    await capture(page, 'hero-dark.png');

    // Bone hero — same framing
    await setTheme(page, 'bone');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await capture(page, 'hero-bone.png');
    await setTheme(page, 'dark');

    // Field Lab full (panel already open by default)
    await setInfoLayer(page, true);
    await ensureFieldLabOpen(page);
    // Scroll the Field Lab into view if needed and wait for “n of 3”
    await page.evaluate(() => document.getElementById('labPanel')?.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(400);
    await capture(page, 'field-lab-full.png');

    // Callouts variety — wide, minimised, source preferably folded so labels breathe
    await minimise(page);
    await waitForCallouts(page, 3);
    // Optionally fold the source overlay via hit-test on its title bar if present
    // (left corner after minimise). Soft attempt; continue even if it fails.
    try {
      const left = 1440 - 356 - 20;
      const headerY = 24 + 6;
      await page.mouse.click(left + 120, headerY);
      await page.waitForTimeout(300);
    } catch { /* optional */ }
    await page.waitForTimeout(1500); // residual outlines + mode spread
    await capture(page, 'callouts-variety.png');

    // Immersion desktop — restore cluster settled, residual + edges
    await page.waitForTimeout(800);
    await capture(page, 'immersion-desktop.png');

    // Quiet residual focus (optional high-value)
    // Turn Stats off so only residual outlines + field remain
    await restore(page);
    await page.click('#stillFieldNerdToggle');
    await page.waitForTimeout(300);
    await minimise(page);
    await page.waitForTimeout(2000);
    await capture(page, 'residual-outlines.png');

    // Quiet field (Stats + overlays off). Re-enable the info layer briefly so
    // its overlay controls are interactive, switch them off, then hide it.
    await restore(page);
    await setInfoLayer(page, true);
    await page.click('#fieldCalloutToggle');
    await page.click('#fieldEdgeToggle');
    await page.click('#fieldCodeToggle');
    await setInfoLayer(page, false);
    await page.waitForTimeout(200);
    await minimise(page);
    await page.waitForTimeout(1500);
    await capture(page, 'quiet-field.png');

    await context.close();
  }

  // ------------------------------------------------------------------
  // Phone immersion (390×844, DPR 2)
  // ------------------------------------------------------------------
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto(`${server.origin}/index.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.complexNoiseStill, null, { timeout: 15000 });

    await clickPlay(page);
    await page.waitForTimeout(1000);
    await minimise(page);
    await page.waitForTimeout(2500); // residual + any callouts that fit
    await capture(page, 'immersion-phone.png');

    await context.close();
  }

  // ------------------------------------------------------------------
  // Refresh core instrumentation shots (desktop, Stats open, Live / Math / Code)
  // ------------------------------------------------------------------
  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.goto(`${server.origin}/index.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.complexNoiseStill, null, { timeout: 15000 });

    await clickPlay(page);
    await page.waitForTimeout(800);

    // Ensure Stats on and unfolded
    if (await page.getAttribute('#stillFieldNerdToggle', 'aria-pressed') !== 'true') {
      await page.click('#stillFieldNerdToggle');
    }
    if (await page.getAttribute('#nerdFoldBtn', 'aria-expanded') === 'false') {
      await page.click('#nerdFoldBtn');
    }
    await page.waitForTimeout(600);

    // Live (default)
    await capture(page, 'info-layer-dark.png');

    // Bone Live
    await setTheme(page, 'bone');
    await page.waitForTimeout(300);
    await capture(page, 'info-layer-bone.png');
    await setTheme(page, 'dark');

    // Math view
    await page.click('[data-nerd-view="math"]');
    await page.waitForTimeout(500);
    await capture(page, 'info-layer-math.png');

    // Code view
    await page.click('[data-nerd-view="code"]');
    await page.waitForTimeout(500);
    await capture(page, 'info-layer-code.png');

    // Transform mode is harder to force (global rotation + φ offset).
    // Leave the existing strong transform shot; refresh only if a clean moment appears.
    // Optional: wait and capture a variety of modes under Live again if desired.

    await context.close();
  }

    console.log('Done. Review docs/screenshots/ then update README + INFO_LAYER embeds.');
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

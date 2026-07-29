# Working on Complex Noise

Authoritative technical contract for AI coding agents and humans. Read this
before your first edit, then use
[`docs/agent-operations.md`](docs/agent-operations.md) for the repeatable
session workflow, task router, validation ladder and handover template. A
project skill is available at `.agents/skills/complex-noise/`.

## What this is

A zero-dependency, client-side procedural noise generator (brown / pink / white /
green / fan / rain) for sleep. It runs entirely in the browser, ships as static files, and is served
from GitHub Pages. There is no build step, no bundler, and no runtime
dependency — **keep it that way**. If a change would introduce a build step or a
runtime package, raise it in the PR rather than doing it quietly.

It is used to fall asleep to. That shapes every priority here: it must not stop
in the night, must not get louder unexpectedly, and must not burn battery.

## Run it

ES modules are fetched with CORS, so **opening `index.html` from the filesystem
will not work** — you need `http://`:

```bash
npm start           # serves on http://localhost:8123
# or: python3 -m http.server 8123
```

## Test it

```bash
npm ci                          # install the exact locked development dependencies
npm test                        # headless browser suite, ~15s
npm test -- --filter=colour     # only tests whose name contains "colour"
npm test -- --workers=1         # serialise, e.g. when bisecting a flake
npm test -- --repeat=20         # run the selection 20x to hunt a flake
npm test -- --headed            # watch it (implies --workers=1)
npm test -- --list              # print test names and exit
npm run test:list               # stable alias for test discovery
npm run test:serial             # stable alias for a one-worker full run
npm run check                   # CI-equivalent lint + browser suite
npm run profile:still-field     # evidence, not pass/fail; ~3 minutes
npm run profile:still-field -- --churn          # interaction churn only
npm run profile:still-field -- --churn --dpr=2  # largest transcript raster
```

`tests/run.mjs` drives a real Chromium against a real Web Audio graph. It starts
its own server on a free port, so nothing needs to be running first.

`tests/profile-still-field.mjs` is the repeatable performance harness. It warms
each scenario for eight seconds, samples the renderer's smoothed telemetry 48
times over twelve seconds, forces GC around its heap observation, and includes
native/throttled desktop and mobile controls. It is not a CI benchmark and has
no thresholds: timing describes the current browser and machine. Use
`--filter=<scenario>` to narrow a run and `PROFILE_ROOT=/another/worktree` for a
same-harness before/after comparison. `--churn` is a separate 12-cycle
fold/unfold and field stop/start observation; it records both the first drawn
frame and the worst callback in each 250 ms interaction window. `--dpr=2`
exercises the renderer's device-pixel-ratio cap.

Tests run in a **worker pool** (four by default, `TEST_WORKERS` to override),
each worker owning a fresh `BrowserContext`. The context is the isolation
boundary — separate localStorage, separate page — so tests never share state.
The wall-clock floor is the single longest test, not the sum of all of them.

**Run the suite before you open a PR.** Several tests exist because a
plausible-looking refactor broke playback in a way that only shows up minutes
later — the sleep-timer test in particular. If you change behaviour
deliberately, update the test in the same commit and say so.

### Writing a test that survives a busy machine

- **Prefer `until(page, fn, ms, message)` to `page.waitForTimeout`.** Polling for
  a condition with a deadline is strictly stronger than sleeping and then
  checking once: it fails no later than the sleep would have, and passes as soon
  as the app is ready. Use a bare sleep only when elapsed time *is* the
  measurement — the trail has to accumulate for real seconds before "is the
  canvas opaque?" means anything.
- **Never assert app behaviour against wall-clock time.** The render loop
  integrates `dt` capped at `MAX_STEP_S`, so on a loaded machine its diagnostics
  clock deliberately advances *slower* than the clock on the wall. Assert against
  `getFieldStats().realClock` instead. A test that says "this rotates within five
  seconds" is testing the host's spare CPU.
- **Drive tight timing races from inside the page.** A `page.click` costs a CDP
  round trip. Anything measuring a window of a few hundred milliseconds — the
  160 ms colour-switch dip, for instance — must dispatch its clicks inside one
  `page.evaluate`, or it is really asserting that the harness is fast today.

## CI

`.github/workflows/ci.yml` runs lint + the browser suite on every PR and on
pushes to `main`. Three things about it are load-bearing:

- **Skipping is decided inside the workflow, never with `paths-ignore`.** A
  workflow filtered out by `paths-ignore` does not run, and a job that does not
  run reports *no status*, so a required check waits forever and the PR can
  never merge. The `gate` job always runs and decides; the `CI` job always runs
  and reports. **Point branch protection at `CI`, never at `Browser smoke
  tests`.**
- **A change is "docs-only" by allow-list**: `docs/*`, `*.md`, `LICENSE`,
  `.gitignore`. Everything else counts as code, so a new directory is tested by
  default. `.github/**` is deliberately *not* on the list — a change to the
  workflow must run the suite whose rules it is changing.
- **Opt-outs**: `[skip ci]` / `[ci skip]` / `[skip-ci]` / `[no ci]` in the head
  commit message, or a `skip-ci` label on the PR. GitHub honours the commit
  markers natively on `push` but not on `pull_request`, which is why the gate
  checks them itself. The label is the only opt-out you can apply — and remove —
  without rewriting history.

Every uncertain case resolves to *running* the suite. A skip rule that guesses
wrong in the other direction ships untested code.

## Layout

```
index.html          markup only (plus a boot guard for the file:// case)
css/styles.css      every theme token and all layout
js/
  constants.js      durations, defaults, valid ranges, storage keys, icons
  storage.js        safe typed localStorage access
  noise.js          the noise generators
  audio.js          Web Audio graph, transport, EQ, sleep timer, wake lock
  still-field.js    the two canvases — front door only; see below
  still-field/      the renderer, one module per concern (22 files)
  theme.js          dark ↔ bone theme, and standard ↔ ultra glass
  ui-chrome.js      immersion hide/show of the main controls
  hud.js            the stats panel's strings — pure, and owns no DOM
  app.js            DOM wiring — the only module that touches the app's DOM
tests/run.mjs       browser smoke tests
docs/               product requirements and historical context
```

## The one architectural rule

**State modules own state and publish it. `app.js` renders it. Event handlers
never update the UI directly.**

`audio.js`, `still-field.js`, `theme.js` and `ui-chrome.js` each expose `getState()` and
`subscribe(fn)`. `subscribe` fires immediately with the current state snapshot
and again on every change. `app.js` subscribes and does all DOM writing in those
callbacks. Every snapshot is an object, so a module can grow a field without
every caller changing shape.

```js
// Wrong — misses every state change that has no click behind it.
playBtn.addEventListener('click', () => {
  audio.play();
  playBtn.innerHTML = PAUSE_ICON;
});

// Right — one render path, regardless of what caused the change.
playBtn.addEventListener('click', () => audio.play());
audio.subscribe(state => {
  playBtn.innerHTML = state.isPlaying ? PAUSE_ICON : PLAY_ICON;
});
```

This is not style preference. Playback stops on its own when the sleep timer
fires, and updating the button inside its click handler is exactly how it ends
up frozen on "pause" over silent audio at 3 a.m. That bug has already happened
once; `tests/run.mjs` now guards against it.

## Inside the Still Field

The renderer is a directory. `js/still-field.js` is the **front door**: it owns
the public API and nothing else, and it is what `app.js` imports. The work is
in `js/still-field/`:

```
settings.js      what the user chose, and the snapshot the UI renders
view.js          the two canvases, the viewport, the device
world.js         the world plane, the projection, the link radius
grid.js          a uniform spatial grid over a rectangle
math.js          φ, τ, smoothstep
clock.js         the drift clock and the diagnostics clock
palette.js       theme colours, pre-quantised into ramps
energy.js        the three energy layers and the CSS mirror
keep-outs.js     screen rectangles the info layer must avoid
telemetry.js     counters the renderer writes and the HUD reads
audio-metrics.js frequency-band energy from the analyser
nodes.js         the population: model, lifecycle, one simulation step
link-pass.js     the lattice, its envelopes, batching and telemetry
node-pass.js     the nodes, flat then glowing
modes.js         the callout detail modes and their rotation
callout-content.js  what a callout says: the eight detail-mode branches
callouts.js      node callouts: selection, placement, paint
edge-labels.js   edge dimensions: slots, quantised text, paint
code-lines.js    the transcript the source overlay prints
code-ticker.js   the on-canvas source listing
loop.js          one frame, and the loop control around it
stats.js         the public statistics snapshot
```

Three rules hold it together. [docs/still-field-architecture.md](docs/still-field-architecture.md)
has the reasoning and the worked examples; these are the rules themselves:

- **Shared state lives on an exported object with exactly one writer.** An
  imported binding is read-only in ES modules, so `export let` cannot be
  assigned from another file. `settings`, `view`, `world`, `grid`, `clock`,
  `telemetry`, `population` and `paint` are each a plain object owned by one
  module and read by many. Do not add a second writer; add a function to the
  owner instead. In a hot loop, destructure what you need into locals at the
  top of the function — the passes already do.
- **Imports point one way.** The graph is a DAG and must stay one: leaves
  (`math`, `clock`, `telemetry`, `grid`, `keep-outs`, `palette`, `view`) import
  nothing from the field, `stats.js` is allowed to know about everything and is
  imported only by the front door. If a change would need a cycle, the shared
  thing wants its own module — `modes.js` exists for exactly that reason.
- **Side effects compose in `js/still-field.js`.** A setter in `settings.js`
  clamps and persists, full stop. Knowing that a depth change also means
  remeasuring the world *and then* re-counting the nodes lives in the front
  door, where it reads as a list rather than as a call chain.

- **The stats panel is strings here, elements in `app.js`.** `js/hud.js` turns a
  stats snapshot into an object of strings and touches no DOM; `app.js` maps each
  key to an element. That keeps the one architectural rule intact — a `hud.js`
  that wrote into `#nerdHud` would be a second module touching the app's DOM, and
  the exception would then be citable by a third. `HUD_ROW_KEYS` is the shared
  contract: `defineRowMap()` rejects a missing or retired key once at boot, and
  `tests/run.mjs` also fails naming any row still reading the `—` `index.html`
  seeded it with after the field starts.

`tests/run.mjs` names the front door's whole export surface. Move code freely
between these modules; that test is what tells you the door still opens. It also
carries three `unit:` tests that import a module and call it directly — no DOM,
under a second between them. Arithmetic belongs there, not in a six-second test
that watches a field of nodes and infers the answer.

## UI chrome & immersion

- The main interface can be minimised via the **Minimise interface** button
  (inside the Still Field card). State lives in `ui-chrome.js`.
- When hidden, a floating cluster appears bottom-right: minimised play/pause,
  a compact status line, and a **Show controls** pill. The cluster starts a
  little larger and more purple, then settles calmly.
- Theme is a two-sided pill (Dark | Bone) rather than a single toggle.
- Status lives in a dedicated card directly under the main play button when
  the full interface is visible.
- Escape always restores the full interface.

## Still Field controls (current)

- **Field visualisation** toggle (default on)
- **Intensity** and **Speed** sliders (speed practical range **0.7 – 4.8**, default 2.0)
- **Stats** (the info layer) — default on, one toggle governing three things.
  The full description is in [docs/info-layer.md](docs/info-layer.md); the parts
  that constrain a change are:
  - Engineering-drawing callouts on the info canvas: node handle, leader line,
    plate, key/value rows (up to four). There are **eight** detail modes —
    energy, transform (axis-coloured), velocity, projection, wave, links,
    lifecycle, seed — and the mode a given node shows is the globally rotating
    base index **offset by that node's own `modeOffset`**, derived from its
    lifetime ID through φ. Several different quantities are therefore on screen
    at once; the base still rotates on the golden-ratio-weighted dwell. The
    node's handle glyph follows the mode (`MODE_HANDLE`). Caps are 8 / 6 / 4 by
    viewport width, reduced by screen bounds, interface keep-outs, the source
    overlay's corner and block collisions. Dynamic strings refresh once a
    second, not at frame rate.
  - Up to six edge dimensions, rotated onto the lines they measure, gathered
    inside the existing link pass. Each carries one of four **kinds** (span,
    coupling, reach, energy) chosen from the *pair's* identity, so it is stable
    for the life of the pair. Do not add a second graph scan or per-frame
    sorting. The caption's lead value sits above the line and its two secondary
    values sit on their own baselines below it; `EDGE_LABEL_HALF_H` is
    *derived* from that layout rather than picked, so changing the stack means
    changing the constants it is derived from, not the half-height directly.
  - Per-node `degree`, `coupling` and `nearest` for the `links` mode, zeroed at
    the top of the node step and accumulated inside `drawLinks()` on values the
    renderer had already computed. This is the only acceptable way to add graph
    telemetry.
  - One top-left panel (`#nerdHud`) with keyboard-navigable **Live**, **Math**
    and **Code** views. Live is grouped (Frame / Graph / Instrumentation / Field
    / Audio) and scrolls inside a bounded height. Math rows carry live evaluated
    operands; Code carries per-stage `performance.now()` timings. Dynamic DOM
    values are rendered by `app.js` on a 250 ms interval — *not* in the render
    loop — and only for the view that is actually showing, and not at all while
    the panel is folded. The interval is cleared whenever the page is hidden or
    the layer is off. Values are ordinary text, never live regions or `<output>`
    elements.

  All of it is disabled alongside the sliders when the field is off.
- **Canvas overlays** — node callouts, edge dimensions and the source listing
  are three independent persisted settings, exposed as a chip bank in the Field
  Lab (`.lab-chip`, `aria-pressed`). Each is also gated behind Stats and the
  field switch. The source listing additionally folds from its own on-canvas
  title bar via `handleOverlayPointer()`; that fold is session-only.
- **Background texture** — controllable procedural overlay (default on). Independent of the field, so it stays available with the field off. Toggle in the Still Field card.
- **Field Lab** (`#labPanel`, under the equaliser, open by default) — node
  density, link reach, trail persistence, perspective, callout dwell, frame cap
  (30/45/60) and the three canvas-overlay chips, plus a reset. Every range must match the
  matching `STILL_*_MIN` / `STILL_*_MAX` pair in `constants.js` and every default
  the matching `DEFAULTS` entry; `tests/run.mjs` asserts the defaults.
- Nodes keep a soft residual stroke-circle outline so a low-energy node stays
  legible instead of sinking into the background. The outline is scaled by the
  lifecycle envelope, so it still eases in at birth and out at death — the floor
  is against dimness, never against the lifecycle. Do not reintroduce a floor
  that ignores `node.fade`: nodes would pop on and off, because the step
  respawns a node the instant its life reaches 1, so `life` is never out of
  range by the time `draw()` runs.

New localStorage keys:
- `complexNoise_stillFieldNerd`
- `complexNoise_stillFieldTexture`
- `complexNoise_stillFieldDensity`
- `complexNoise_stillFieldReach`
- `complexNoise_stillFieldTrail`
- `complexNoise_stillFieldDepth`
- `complexNoise_stillFieldDwell`
- `complexNoise_stillFieldFps`
- `complexNoise_stillFieldCode`
- `complexNoise_stillFieldCallouts`
- `complexNoise_stillFieldEdges`

## Common tasks

**Add a noise colour** — add a generator to `GENERATORS` in `js/noise.js`, add
the name to `NOISE_TYPES` in `js/constants.js`, add a
`<button class="type-btn" data-type="…">` to `index.html`. No event wiring
needed; `app.js` binds from `data-type`. The type selector is a 3-column grid, so
colours arrive in rows of three.

Read the header comment in `js/noise.js` first — it carries three rules with
teeth, and `tests/run.mjs` asserts all three:

- **Loudness is matched A-weighted, not on RMS.** Where the energy sits matters
  as much as how much of it there is. Equal-RMS put the first cut of green
  +4.3 dB above brown, which in this app means the room gets louder at 3 a.m.
- **Leave headroom.** A noise of this buffer length peaks near 5.15× its RMS, so
  an RMS much over 0.2 clips on the loudest sample.
- **Be periodic over the buffer, not merely long.** See the bite below.

**Rebrand** — every colour is a CSS custom property in the `:root` /
`[data-still-theme="…"]` blocks at the top of `css/styles.css`.

**Add a theme** — add a token block in `css/styles.css`, the name to `THEMES`
in `js/constants.js`, an entry in `THEME_META` in `js/theme.js`. The segmented
control in `index.html` and the render logic in `app.js` need a matching
`.theme-seg[data-theme="…"]` button. Themes and glass modes are independent
axes on `<html>` (`data-still-theme` and `data-glass`).

**Restyle the Still Field** — it is a CSS edit. The canvas reads
`--still-field-node`, `--still-field-edge`, `--still-field-mid`,
`--still-field-spark` and `--still-field-glow` once per theme change and
pre-builds a quantised ramp from them. Alpha on the node and edge tokens sets
the field's baseline opacity; mid and spark supply hue only.

**Add a node detail mode** — add the name to `LABEL_MODE_NAMES` and a glyph to
`MODE_HANDLE` in `js/still-field/modes.js` (both arrays must stay the same
length — `tests/run.mjs` asserts it), then add the branch to
`refreshNodeCallout()` in `js/still-field/callout-content.js` — **not**
`callouts.js`, which is placement and paint and has no business in the diff for
a new mode. `MODE_WEIGHTS` re-derives and normalises itself to a mean of one,
and the per-node offset spreads the new mode across the field automatically. Up
to four key/value rows; only the first three can be axis-coloured.

**Add an edge dimension kind** — all in `js/still-field/edge-labels.js`: add an
`EDGE_KIND_*` index, raise `EDGE_KIND_COUNT`, add the branch in
`drawEdgeAnnotations()`, and add any new quantised string table inside
`ensureEdgeTables()` (they are built on first draw, not at module load, so a
visitor with Stats or dimensions disabled never pays for them). Whatever the
kind reads must be derivable from values the link pass already has.

**Add a persisted setting** — add the key to `STORAGE_KEYS` in
`js/constants.js` and read/write it through `js/storage.js`. Never call
`localStorage` directly: it throws in Safari Private Browsing, and
`parseFloat(x) || fallback` silently discards a stored `0`.

Pick the right writer:

- `write()` for a discrete choice — a colour, a theme, a toggle, a segmented
  pill. Straight through to disk on the click.
- `writeThrottled()` for anything driven by a **continuous control**. A slider's
  `input` event fires at pointer-move rate, and `localStorage.setItem` is
  synchronous and persistent, so a straight-through write meant ~60 blocking
  disk writes a second competing with the render loop for the same thread.
  Reads are unaffected: `read()` consults the pending value first, so the
  setting is live immediately and merely lands on disk a moment later.

Deferred writes are flushed on `pagehide` and on the hidden transition, because
a backgrounded phone can be killed without ever running another timer.

**Add an audio effect** — insert nodes in `ensureAudio()` in `js/audio.js`. The
analyser sits before the gain node on purpose, so the visualisation tracks the
noise rather than the listening volume.

## Things that will bite you

- **The play button animates forever.** Playwright's actionability check never
  considers it stable — click it with `{ force: true }` (the tests wrap this as
  `clickPlay`).
- **`localStorage` throws**, it does not return null, when storage is
  disabled. Every module reads persisted state at import time, so an unguarded
  read takes the whole app down before first paint.
- **AudioContext needs a user gesture.** The first `play()` must be reached
  from a real click.
- **This runs for eight hours straight on a phone**, and the Still Field is now
  on by default, so every per-frame cost is an overnight battery cost. Before
  touching the renderer, read `js/still-field/loop.js`: it defaults to 30 fps,
  stops the loop outright when the page is hidden, allocates nothing
  per frame, and rations `shadowBlur`. `getComputedStyle` and writing CSS custom
  properties both force style recalculation — it caches the former and throttles
  the latter, so don't reintroduce either into the render loop.
- **The frame cap is a setting now (30/45/60), so nothing may be per-frame.**
  Anything expressed as "x per frame" silently changes meaning when the cap
  moves. The trail decay is the example: it is a rate per second run through
  `1 - Math.exp(-rate * dt)`, and it used to be a fixed alpha. If you add a
  decay, a fade or a smoothing anywhere, write it the same way.
- **Text and the trail cannot share a canvas.** `#stillField` subtracts alpha
  each frame; a moving label drawn onto it leaves half a second of decaying
  copies of itself, which is exactly the soft halo that made the callouts look
  blurred. All instrumentation goes on `#stillFieldInfo`, which is cleared
  outright each frame, never sets `shadowBlur`, and snaps glyph origins to whole
  device pixels. Legibility comes from a plate behind the text, not a glow.
- **Linking is a spatial grid, and that has a sharp edge.** Only pairs inside
  the 5-cell half-neighbourhood are visited, so a pair that stops being visited
  freezes its envelope at whatever strength it held. `stepNodes()` calls
  `clearLinksFor()` on world wrap for exactly this reason, alongside the
  existing call on respawn, and `resizeField()` drops the whole array when a
  rescale changes the world's shape. If you add another way for a node to move
  discontinuously, clear its links too.
- **Callout timing is procedural, not an interval.** Mode dwell is
  `D · (0.72 + 0.56 · frac(kφ))`, acquisition and release use different energy
  gates, and opacity runs through attack/release envelopes on the *real* clock
  rather than the drift clock. Replacing any of that with a fixed timer brings
  back the flicker it was written to remove.
- **Motion is integrated from elapsed time, not counted in frames.** Anything
  new in the render loop must scale by the timestep, or the field will drift at
  double speed on a 120 Hz phone. Exponential smoothing needs
  `1 - Math.exp(-rate * dt)`, not a fixed per-frame coefficient.
- **The glow pass is not guaranteed to run.** `drawNodes` defers high-energy
  nodes to a second pass that carries `shadowBlur`, but that pass stops at
  `MAX_GLOW_NODES` and is skipped entirely under `prefers-reduced-motion`.
  Anything deferred to it unconditionally is deferred into nothing, and the
  brightest nodes disappear from the field. Draw them flat in pass 0 instead.
- **The info-label energy gate has a ceiling well below 1.** With nothing
  playing, `getStillAudioMetrics()` reports zeros, so `audioBoost` is 0 and
  `computeNodeEnergy` tops out at `0.3 + 0.24 = 0.54` — the two procedural
  layers alone. A gate above that makes the whole layer unreachable while the
  audio is paused, which is exactly what a gate of 0.55 did: the toggle read
  "on" and drew nothing, indefinitely. The field is deliberately alive when
  paused, so the labels must be too. `tests/run.mjs` now guards this.
- **Canvas labels must dodge the interface.** The canvas is painted *behind* the
  controls, so a label under a card is a `fillText` into a surface nobody can
  see — and at a phone viewport, where the control column spans the screen, that
  was every single one of them. `app.js` measures the chrome and pushes
  rectangles to `setLabelKeepOuts()` on resize, scroll, panel toggle and
  minimise/restore; the renderer never measures the document itself, because
  a `getBoundingClientRect` per frame forces layout just like `getComputedStyle`.
  The first measurement is synchronous in `boot()` — scheduling it on an
  animation frame lets the loop's first frames paint under the controls. The
  honest consequence is that on a phone with the interface up there is nowhere
  for the labels to go, so none are drawn; minimise the interface and they
  appear. The stats panel carries the numbers in the meantime.
- **Richer callouts still need a hard allocation budget.** Node detail strings
  are cached on the node and refreshed once a second; every edge dimension
  string, across all four kinds, comes from a quantised lookup table. Candidate
  and collision coordinates live in pre-sized typed arrays. Do not turn those
  paths back into template-string, object, or array creation at 30 fps — that
  includes innocent-looking array literals inside a draw helper.
- **An overlay slot that cannot draw must not keep its slot.** Edge dimensions
  have six slots. A pair whose midpoint lands under the source listing is
  unpaintable, and the listing changes corner when the interface is minimised —
  so pairs that were fine a second ago become permanently undrawable while still
  linked. `drawEdgeAnnotations()` folds "blocked" into the liveness test for
  exactly this reason: every slot held with one dimension on screen was the
  normal state in immersion mode before it did.
- **Callout side is hysteretic, and the hysteresis is the point.** A node
  remembers its block's side in `preferSide`; placement retries that side first
  and mirrors only when it is off the margin, under a keep-out, or over the
  source listing. Deriving the side from the node's position each frame — the
  obvious-looking simplification — puts a threshold back in, and a node drifting
  around it throws a 132px plate across its own leader line several times a
  second. Block-on-block collisions deliberately do *not* flip the side; they
  are transient, and flipping on them reintroduces the same bounce. The side is
  committed only after a placement actually draws.
- **The on-canvas fold is a hit test, not a control.** `#stillFieldInfo` is
  `pointer-events: none` behind a `z-index: 1` body, so presses arrive on the
  body; `app.js` forwards only those whose target *is* the body to
  `handleOverlayPointer()`. It cannot be focused or labelled, so the Field Lab
  chip stays the real control and the fold is session-only. Do not make it the
  only way to reach a setting.
- **Graph telemetry belongs inside `drawLinks()`.** Pair checks, painted edges
  and the deterministic edge sample reuse values already computed by the
  renderer. A second O(n²) scan, sorting by strength, or building an edge list
  would turn an information feature into an overnight battery regression.
- **The Still Field canvas must stay transparent.** Its trail effect subtracts
  alpha with `destination-out`. Filling with a background colour instead drives
  the canvas opaque within seconds and buries the background gradient and the
  Still Texture underneath it. `tests/run.mjs` guards this.
- **Fades are asynchronous.** Anything scheduled after a fade must capture the
  node it intends to clean up, or it will tear down whatever happens to be
  playing when it fires.
- **So is the wake lock, and its gap is where the battery goes.**
  `navigator.wakeLock.request()` resolves *after* the click that asked for it, so
  playback can already have stopped by the time the browser grants it. Assigning
  the result unconditionally strands a lock nothing will ever release, and the
  screen stays lit all night over silent audio. `requestWakeLock()` re-checks
  `isPlaying` after the await and releases immediately if it lost the race, and a
  `pending` guard stops two overlapping requests orphaning the first handle. Any
  new async acquisition needs the same shape.
- **`setTimeout` is not a promise about when anything happens.** A backgrounded
  tab has its timers throttled to once a minute; a suspended phone does not run
  them at all. The sleep timer therefore stores an absolute wall-clock
  `timerEndsAt` and treats the timeout as a hint: it re-checks the deadline
  whenever the page becomes visible and re-arms for the remainder. Do not
  "simplify" this back to a single `setTimeout` — the overshoot it prevents is
  the app playing for hours past the hour the user asked for, which is the one
  promise it makes to somebody who is asleep.
- **Persist the parsed value, not the argument.** `setTimerHours` takes a string
  from a range input. Writing the raw argument stored whatever arrived while the
  engine ran on the number it fell back to, so the control and the sound
  disagreed on the next load.
- **The noise buffer loops forever, so it has to be periodic — long is not
  enough.** Two ways to break it, both of which shipped once and both of which
  put a step in the level every twelve seconds, all night. A filter started from
  zero state makes sample 0 come out of a silent filter while sample N−1 does
  not; every stateful generator therefore runs a second pass over the head of its
  white-noise sequence (`seamScratch`) to carry the state round the join. And an
  amplitude LFO whose period does not divide the buffer snaps back to its
  starting phase at the wrap; rates come from `lfoStep()`, which rounds to whole
  cycles. Do not replace either with a plain loop or a literal period.
- **Buffer generation blocks the main thread inside a 150 ms cross-fade.**
  `setType()` dips the gain, then builds a fresh 12 s buffer synchronously. That
  is why the per-sample work in each generator is written out inline instead of
  being handed to one shared loop taking a step function: the tidier version
  measured six times slower, because the shared call site sees a different
  closure per colour and nothing inlines. Keep new colours inline. Slow periodic
  modulation uses an inline sine/cosine recurrence too; do not put `Math.sin`
  back in a per-sample loop.
- **A colour-change timeout is transport state.** Rapid type clicks must
  coalesce to the final selection, and pause/play must cancel any pending
  replacement. Otherwise every click builds a 12 s buffer and a stale timeout
  can tear down the source that `play()` just created. Keep
  `cancelPendingTypeSwitch()` paired with the fade-out cancellation paths.
- **Defaults live in `constants.js`.** Volume default is intentionally soft
  (0.22). Field defaults to on with intensity 0.7 and speed 2.0 (practical range
  **0.7–4.8**). The Field Lab defaults (density 1.0, reach 1.0, trail 8.2/s,
  depth 0.75, dwell 14 s, 30 fps, source overlay on) all reproduce the behaviour
  the field had before the panel existed. Changing a default without updating
  the matching test assertion will fail CI.
- **The link buffer and the grid arrays only ever grow, and they grow in bands.**
  Density, reach, depth and intensity are sliders, so they fire `input` at
  pointer-move rate; sizing those arrays to the exact population meant a
  full density sweep allocated 35 link buffers and 35 grid arrays, about 550 KB,
  *per drag*. `ensureLinkCapacity()` in `nodes.js` and `allocateGrid()` in
  `grid.js` high-water-mark them and round the node count up to the next
  sixteen, which makes every drag after the first allocate nothing. Growing to
  the exact figure is not good enough — each rising step needs one more row than
  the last, so it still allocates on nearly all of them. The consequence to
  remember: **these arrays are longer than the live count**, so anything that
  clears one must clear a bounded range (`counts.fill(0, 0, cells)`), and the
  HUD's Buffers row reports what is held rather than what is in use.
- **A cache that is conditional on the way in must be conditional on the way
  out.** The source listing rasterises its stable transcript into an
  `OffscreenCanvas` — 434 KiB at DPR 1, **1.7 MiB at the DPR 2 cap** — and the
  justification for paying that is "only a visible, expanded, wide-screen
  listing does". Allocating lazily is only half of keeping that promise: the
  first version was never freed, so a tablet that crossed 1000 px once, or a
  phone locked at 3 a.m., held it for the rest of the night. `layoutCodeTicker()`
  releases it whenever the listing is not printing its transcript, and
  `stopLoop()` releases it on every way the loop can stop. Re-earning it is one
  allocation and one re-raster, the same cost a theme or DPR change already pays.
  If you add another scratch surface, give it the same two halves — and report
  it in `stats.js`, because a Buffers row that omits the largest buffer is worse
  than no Buffers row.
- **Source-listing values are named before they are numbered.** The overlay's
  paint path uses integer slots because it runs for every visible frame, but
  `CODE_VALUE_SLOT` is the shared vocabulary between the transcript and its
  once-per-second producers. Add a name, use it on exactly one transcript line,
  and add its builder through `defineCodeValueMap()` in the same change. Do not
  restore parallel lists of numeric indices: they can print the wrong live
  number beside the right source statement without throwing.
- **Node density multiplies the clamped 26–44 window, not the raw viewport
  area.** Applying it to the raw figure opens a 1440×900 display on 132 nodes at
  the *default* setting, which is a redesign for every user who never touches
  the Lab. See `targetNodeCount()`.

## Conventions

- Plain ES modules, no framework, no transpilation. Target evergreen browsers.
- British spelling in user-facing copy ("visualisation", "colour"), which
  matches the existing product voice.
- JSDoc on exported functions.
- Comments explain *why*, not *what*.

## Supporting references

- Live contract: this file (always re-fetch; never rely on memory of an older version)
- Info-layer contract: `docs/info-layer.md`
- Product requirements: `docs/product-requirements.md`
- Historical context: `docs/history.md`, `docs/archaeology.md`, `docs/teachings-and-learnings.md`
- Visitor docs and Lab Voice live under the lab-voice skill

The software stays calm. The documentation is allowed to be chaotic. That is the deal — and the mechanics of keeping that balance stay outside the public repository.

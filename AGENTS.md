# Working on Complex Noise

Orientation for AI coding agents and humans. Read this before your first edit;
it is short on purpose.

## What this is

A zero-dependency, client-side procedural noise generator (brown / pink / white)
for sleep. It runs entirely in the browser, ships as static files, and is served
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
npm install         # first time only — Playwright is the sole dev dependency
npm test            # headless browser suite, ~30s
npm test -- --headed
```

`tests/run.mjs` drives a real Chromium against a real Web Audio graph. It starts
its own server on a free port, so nothing needs to be running first.

**Run the suite before you open a PR.** Several tests exist because a
plausible-looking refactor broke playback in a way that only shows up minutes
later — the sleep-timer test in particular. If you change behaviour
deliberately, update the test in the same commit and say so.

## Layout

```
index.html          markup only (plus a boot guard for the file:// case)
css/styles.css      every theme token and all layout
js/
  constants.js      durations, defaults, valid ranges, storage keys, icons
  storage.js        safe typed localStorage access
  noise.js          the noise generators
  audio.js          Web Audio graph, transport, EQ, sleep timer, wake lock
  still-field.js    the two canvases (+ live stats for the info layer)
  theme.js          dark ↔ bone theme, and standard ↔ ultra glass
  ui-chrome.js      immersion hide/show of the main controls
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
  The full description is in [docs/INFO_LAYER.md](docs/INFO_LAYER.md); the parts
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
  - Up to five edge dimensions, rotated onto the lines they measure, gathered
    inside the existing link pass. Each carries one of four **kinds** (span,
    coupling, reach, energy) chosen from the *pair's* identity, so it is stable
    for the life of the pair. Do not add a second graph scan or per-frame
    sorting.
  - Per-node `degree`, `coupling` and `nearest` for the `links` mode, zeroed at
    the top of `update()` and accumulated inside `drawLinks()` on values the
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
  that ignores `node.fade`: nodes would pop on and off, because `update()`
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
needed; `app.js` binds from `data-type`. Match the perceived loudness of the
existing colours.

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
`MODE_HANDLE` in `js/still-field.js` (both arrays must stay the same length),
then add the branch to `refreshNodeCallout()`. `MODE_WEIGHTS` re-derives itself,
and the per-node offset spreads the new mode across the field automatically. Up
to four key/value rows; only the first three can be axis-coloured.

**Add an edge dimension kind** — add an `EDGE_KIND_*` index, raise
`EDGE_KIND_COUNT`, add the branch in `drawEdgeAnnotations()`, and add any new
quantised string table next to `DISTANCE_TEXT`. Whatever the kind reads must be
derivable from values the link pass already has.

**Add a persisted setting** — add the key to `STORAGE_KEYS` in
`js/constants.js` and read/write it through `js/storage.js`. Never call
`localStorage` directly: it throws in Safari Private Browsing, and
`parseFloat(x) || fallback` silently discards a stored `0`.

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
  touching `still-field.js`, read its header comment: it defaults to 30 fps,
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
  freezes its envelope at whatever strength it held. `update()` calls
  `clearLinksFor()` on world wrap for exactly this reason, alongside the
  existing call on respawn. If you add another way for a node to move
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
  minimise/restore; `still-field.js` never measures the document itself, because
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
  have five slots. A pair whose midpoint lands under the source listing is
  unpaintable, and the listing changes corner when the interface is minimised —
  so pairs that were fine a second ago become permanently undrawable while still
  linked. `drawEdgeAnnotations()` folds "blocked" into the liveness test for
  exactly this reason: five slots held with one dimension on screen was the
  normal state in immersion mode before it did.
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
- **Defaults live in `constants.js`.** Volume default is intentionally soft
  (0.22). Field defaults to on with intensity 0.7 and speed 2.0 (practical range
  **0.7–4.8**). The Field Lab defaults (density 1.0, reach 1.0, trail 8.2/s,
  depth 0.75, dwell 14 s, 30 fps, source overlay on) all reproduce the behaviour
  the field had before the panel existed. Changing a default without updating
  the matching test assertion will fail CI.
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

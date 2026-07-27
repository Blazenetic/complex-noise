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
  still-field.js    the canvas visualisation
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
- **Info labels** (nerd layer) — default on, sparse, energy-gated (only appear when there is meaningful activity). At most four at a time, on the nearest qualifying nodes, and only where the label actually lands on screen. Disabled alongside the sliders when the field is off. Toggle in the Still Field card.
- **Background texture** — controllable procedural overlay (default on). Independent of the field, so it stays available with the field off. Toggle in the Still Field card.
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
  touching `still-field.js`, read its header comment: it runs at 30 fps on
  purpose, stops the loop outright when the page is hidden, allocates nothing
  per frame, and rations `shadowBlur`. `getComputedStyle` and writing CSS custom
  properties both force style recalculation — it caches the former and throttles
  the latter, so don't reintroduce either into the render loop.
- **Motion is integrated from elapsed time, not counted in frames.** Anything
  new in the render loop must scale by the timestep, or the field will drift at
  double speed on a 120 Hz phone. Exponential smoothing needs
  `1 - Math.exp(-rate * dt)`, not a fixed per-frame coefficient.
- **The glow pass is not guaranteed to run.** `drawNodes` defers high-energy
  nodes to a second pass that carries `shadowBlur`, but that pass stops at
  `MAX_GLOW_NODES` and is skipped entirely under `prefers-reduced-motion`.
  Anything deferred to it unconditionally is deferred into nothing, and the
  brightest nodes disappear from the field. Draw them flat in pass 0 instead.
- **The Still Field canvas must stay transparent.** Its trail effect subtracts
  alpha with `destination-out`. Filling with a background colour instead drives
  the canvas opaque within seconds and buries the background gradient and the
  Still Texture underneath it. `tests/run.mjs` guards this.
- **Fades are asynchronous.** Anything scheduled after a fade must capture the
  node it intends to clean up, or it will tear down whatever happens to be
  playing when it fires.
- **Defaults live in `constants.js`.** Volume default is intentionally soft
  (0.22). Field defaults to on with intensity 0.7 and speed 2.0 (practical range
  **0.7–4.8**). Changing a default without updating the matching test assertion
  will fail CI.

## Conventions

- Plain ES modules, no framework, no transpilation. Target evergreen browsers.
- British spelling in user-facing copy ("visualisation", "colour"), which
  matches the existing product voice.
- JSDoc on exported functions.
- Comments explain *why*, not *what*.

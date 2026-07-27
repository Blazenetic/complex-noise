# Complex Noise

**Procedural noise for deep rest**  
by **[Blazenetic](https://github.com/Blazenetic)**

> Free, zero-dependency procedural noise for deep rest.  
> Built in a small Australian lab by Blazenetic (systems), Arty (the one who actually tests the sleep timer), and a supporting cast of increasingly questionable decision-makers.

A pure client-side generator (Brown, Pink, White) optimised for long sleep sessions in mobile browsers, especially Android. No audio files, no looping clicks, no network after first load. True continuous-feeling playback via the Web Audio API.

**Live:** [blazenetic.github.io/complex-noise](https://blazenetic.github.io/complex-noise/)

---

## Quick Start

1. Open the live site (or run it locally — see below).
2. Tap the purple play button.
3. Choose **Brown** for sleep. Adjust volume. Optionally set a sleep timer.

Add to Home Screen on Android for an app-like experience.

### Run locally

ES modules require `http://` — opening `index.html` from the filesystem will not work.

```bash
git clone https://github.com/Blazenetic/complex-noise.git
cd complex-noise
npm start                  # http://localhost:8123
# or without Node:
python3 -m http.server 8123
```

(If you open the file directly, the page tells you so rather than failing silently.)

---

## Features

### Audio
- **Brown** (default — deep & calming), **Pink**, **White**
- Procedural generation → infinite, pattern-free, seamless 10+ hour playback
- Volume with smooth ramps (soft default 0.22)
- Continuous sleep timer (0–10 h, 0.5 h steps) with gentle fade-out
- 3-band Still Equaliser (low / mid / high)
- Wake Lock support where available

### Visual
- **Still Theme** — brushed-titanium dark (default) + bone-white calm theme with procedural texture
- **Still Field** — full-page nodes-and-edges with real perspective depth (default on). Nodes drift, breathe, are born and fade; links retract rather than blink off. Soft residual outlines keep quiet nodes legible. Colour moves violet → cyan with energy. Intensity + speed controls (practical range **0.7–4.8**)
- **Info labels** (nerd layer, default on) — stable node IDs + rotating diagnostics on canvas, plus Live / Math / Code panel for health, topology, equations and operations
- Controllable background texture

### UI & immersion
- Glass surfaces (standard + ultra-transparent) so the field shows through
- Dedicated **Minimise interface** + floating restore cluster (play + status + Show controls)
- Escape restores chrome
- Large touch targets, refined focus rings, ARIA labels
- Settings remembered in localStorage (safe in Private Browsing)

### Guarantees
- Zero runtime dependencies
- Zero network calls after first load — all audio synthesised on device
- Battery-conscious (30 fps field, stops when page is hidden)
- MIT License · Made in Australia

> **Offline note:** A loaded tab keeps working without a connection. True cold-start offline (airplane mode / Home Screen relaunch) needs a service worker — see [Roadmap](#roadmap).

---

## Architecture (for developers & AI agents)

> Working on this codebase? Start with **[AGENTS.md](./AGENTS.md)**. It covers how to run and test, the one architectural rule that keeps playback correct, and the traps that have already caused bugs.

The codebase is modular so agents and humans can work on one concern at a time.

```
complex-noise/
├── index.html              # Markup only
├── css/styles.css          # Theme tokens + layout + glass
├── js/
│   ├── constants.js        # Durations, defaults, ranges, icons, storage keys
│   ├── storage.js          # Safe typed localStorage
│   ├── noise.js            # White / brown / pink generators
│   ├── audio.js            # Graph, transport, EQ, timer, wake lock
│   ├── still-field.js      # Canvas visualisation + info layer
│   ├── theme.js            # Dark ↔ bone + glass mode
│   ├── ui-chrome.js        # Immersion hide/show
│   └── app.js              # Sole DOM writer + boot
├── tests/run.mjs           # Playwright browser suite
├── AGENTS.md               # Contributor / agent guide
├── CHANGELOG.md            # What shipped + Lab Log
└── docs/                   # Requirements, info layer, Meet the Lab
```

### The one rule

**State modules own state and publish it. `app.js` renders it. Event handlers never update the UI directly.**

`audio.js`, `still-field.js`, `theme.js` and `ui-chrome.js` expose `getState()` / `subscribe(fn)`. `app.js` is the only module that writes to the DOM, and only inside those callbacks. This is required because the sleep timer (and other events) change state with no click behind them. Updating the play button inside its own click handler is exactly how it freezes on “pause” over silence at 3 a.m.

### Audio graph

`AudioContext` → looping `AudioBufferSourceNode` (~12 s procedural buffer) → Still EQ (3× BiquadFilter) → `AnalyserNode` → `GainNode` → destination

### Noise generation

All synthesis lives in `js/noise.js`:
- **White** — pure uniform random
- **Brown** — leaky integrator of white noise (classic noisehack formula)
- **Pink** — multi-pole IIR approximation (Paul Kellet refined method)

Buffers are long enough that the loop point is effectively inaudible. Internal state is continuous within each buffer.

### Still Field (summary)

Full-viewport Canvas 2D, 26–44 nodes. No WebGL, no library — real perspective maths.

- **Depth** — pinhole projection (`scale = 1 / (1 + z · 0.75)`). Nodes breathe toward and away from the viewer on a bounded sinusoid.
- **Linking** — 3D distance (not screen overlap). Radius derived from mean spacing so degree stays ~3 on phone and desktop.
- **Lifecycle** — 70–150 s lives, ease in/out. Replacements on R2 low-discrepancy sequence. Links retract into surviving partners. Soft residual outlines floored against dimness but scaled by the lifecycle envelope.
- **Energy** — three non-aligning layers (per-node breath + irrational plane wave + analyser). Drives size, weight, violet→cyan colour and glow. Field stays alive when paused.
- **Info layer** — stable IDs + rotating diagnostics on canvas; Live / Math / Code panel for metrics and equations. DOM updates capped at 4 Hz and stop when the page is hidden.
- **Battery** — 30 fps, real elapsed time, zero per-frame allocation, glow rationed, full stop when hidden. `prefers-reduced-motion` supported.

Full metric definitions, equations and the instrumentation contract live in **[docs/INFO_LAYER.md](./docs/INFO_LAYER.md)**.

### Glass surfaces

Translucent panels with `backdrop-filter`. Transparency is an independent axis (`data-glass="standard"` | `"ultra"`) that combines freely with either theme.

### Extension points

- New noise colour → `GENERATORS` in `noise.js` + `data-type` button (app.js wires automatically)
- Rebrand → CSS custom properties in `styles.css`
- Extra audio effect → insert in `ensureAudio()` in `audio.js`
- Different field renderer → keep the same enable / intensity / analyser hooks in `still-field.js`

See [AGENTS.md](./AGENTS.md#common-tasks) for step-by-step recipes.

### Persistence keys

All keys live in `js/constants.js` → `STORAGE_KEYS` and are read/written only through `js/storage.js` (handles Private Browsing throws and a stored volume of `0`).

---

## Tests

```bash
npm install     # Playwright is the only dev dependency
npm test        # headless, ~30 s
npm test -- --headed
```

`tests/run.mjs` drives real Chromium against a real Web Audio graph and starts its own server. It covers playback + fade races, the sleep timer, persistence edge cases, theming & glass, canvas behaviour (including hidden-page stop), Info layer formats, graph metrics, keyboard navigation, spectral tilt of each noise colour, and basic accessibility (labels + 44 px targets).

Point at a pre-provisioned Chromium with `PLAYWRIGHT_CHROMIUM_PATH=… npm test` if needed.

CI runs the suite and ESLint on every pull request.

---

## Roadmap

- **Service worker** for true cold-start offline / airplane-mode use
- **AudioWorklet** generation for continuous non-buffered synthesis
- **Stereo width** via independent left/right buffers
- Additional noise colours and optional nature layers

---

## Browser support

Modern evergreen browsers (Chrome, Edge, Firefox, Safari) including Chrome for Android. ES modules and AudioContext (user-gesture start) are required. `backdrop-filter` is widely supported; the UI remains fully usable without it.

---

## Branding

Titanium dark surfaces + vibrant purple accents. Subtle silver-titanium Still Field. Glass panels that reveal the living field. Calm, premium, professional.

---

## License

MIT License  
Copyright (c) 2026 Blazenetic

---

Made in a small Australian lab by Blazenetic, Arty, and a supporting cast of increasingly questionable decision-makers.  
See [Meet the Lab](docs/MEET_THE_LAB.md) for the cast list.  

Sleep well. (Or don’t. We’re not your parents.)

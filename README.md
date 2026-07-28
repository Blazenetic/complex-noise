# Complex Noise

**Procedural noise for deep rest**  
by **[Blazenetic](https://github.com/Blazenetic)**

> It began because a commercial noise app decided ads on every pause and an annual fee were reasonable.  
> We disagreed.  
>  
> Complex Noise is a free, zero-dependency procedural noise generator for deep rest.  
> Built in a small Australian lab by Blazenetic (the one who invents the hard maths and then complains about it), Arty (the one who actually tests the sleep timer at 3 a.m.), and a supporting cast of increasingly questionable decision-makers.

**Documents**  
[Live demo](https://blazenetic.github.io/complex-noise/) · [Meet the Lab](docs/MEET_THE_LAB.md) · [History](docs/HISTORY.md) · [Changelog](CHANGELOG.md) · [AGENTS.md](AGENTS.md) · [All docs](docs/)

A pure client-side procedural noise generator (Brown, Pink, White) optimised for long sleep sessions in mobile browsers, especially Android. No audio files, no repeating loops that click, no network required after load. True continuous-feeling playback via the Web Audio API.

## Quick Start

1. **Live**: https://blazenetic.github.io/complex-noise/
2. Tap the big purple play button. Choose **Brown** for sleep. Adjust volume. Optionally set a sleep timer.

Add to Home Screen on Android for an app-like experience (via the manifest).

### Running it locally

The app is split into ES modules, which browsers fetch with CORS — so opening `index.html` directly from your filesystem will **not** work. Serve the folder over `http://` instead:

```bash
git clone https://github.com/Blazenetic/complex-noise.git
cd complex-noise
npm start                  # http://localhost:8123
# or, with no Node at all:
python3 -m http.server 8123
```

(If you do open the file directly, the page tells you so rather than sitting there silently. We are not monsters.)

## Features

- **Brown** (default, deep & calming for sleep), **Pink**, **White**
- Procedural generation → infinite, pattern-free, seamless 10+ hour playback
- Volume control with smooth ramps (soft default 0.22 on first start)
- Continuous sleep timer (0–10 h slider, 0.5 h steps) with gentle fade-out
- Settings remembered in localStorage
- **Still Theme**: Premium brushed-titanium dark (default) + toggleable bone-white calm theme with procedural SVG texture
- **Still Field**: Full-page nodes-and-edges visualisation with gentle perspective depth (default **on**). Nodes drift through a shallow 3D volume, coming slowly toward you and receding; they are born and fade away, and the lines attached to a fading node retract into their partners rather than blinking off. Nodes keep a soft residual outline so a quiet node stays legible instead of sinking into the background. Colour rides from cool violet toward electric cyan as energy rises, driven by the audio analyser. On/off toggle plus intensity and speed sliders (practical range **0.7 – 4.8**)
- **Stats** (the info layer, default on) — engineering-drawing callouts with leader lines and axis-coloured transform rows, edge dimensions rotated onto the lines they measure, a live source listing of the renderer with a profile-driven program counter, and one integrated Live / Math / Code panel exposing renderer health, graph topology, analyser levels, and equations with their operands evaluated live
- **Background texture** — controllable procedural overlay (default on)
- **Still Equaliser**: Simple 3-band (low / mid / high) equaliser with calm sliders (open by default)
- **Field Lab**: The renderer's own parameters — node density, link reach, trail persistence, perspective, callout dwell, frame cap (30/45/60) and the source overlay — all live, all persisted, with a reset
- **Glass UI**: Translucent control surfaces with backdrop blur so the Still Field shows through, plus an **ultra-transparent** mode for when you want the field foregrounded
- Dedicated **Minimise interface** action for immersion, with a floating restore cluster (play + status + Show controls)
- Seamless mobile scrolling (no visible scrollbars)
- Refined vibrant purple play button (gradient + soft glow) that remains the clear focal point
- Clean inline SVG icons for play/pause (no external assets)
- Large touch targets, mobile-first, improved focus rings and ARIA for accessibility
- Wake Lock support (keeps screen from sleeping while playing, where supported)
- Zero dependencies and zero network calls once loaded — all audio is synthesised on device
- MIT License · Made in Australia with the help of AI agents

> **Note on offline use:** nothing is fetched at runtime, so a loaded tab keeps working without a connection. True cold-start offline (airplane mode, app reopened from the Home Screen) needs a service worker, which is not shipped yet — see [Roadmap](#roadmap).

## Architecture (for developers & AI agents)

> Working on this codebase? Start with **[AGENTS.md](./AGENTS.md)** — it covers how to run and test the app, the one architectural rule that keeps playback correct, and the traps that have already caused bugs here.  
> (The Lab Voice is deliberately absent from that document. The sleep timer depends on it remaining so.)

The codebase is intentionally modular so AI coding agents (and humans) can work on one concern at a time without navigating a single 40 kB file.

```
complex-noise/
├── index.html              # Markup only — links styles + entry module
├── css/
│   └── styles.css          # All Still Theme tokens + layout + glass UI
├── js/
│   ├── constants.js        # Durations, defaults, valid ranges, icon SVGs, storage keys
│   ├── storage.js          # Safe, typed localStorage access
│   ├── noise.js            # generateNoiseBuffer() — white / brown / pink
│   ├── audio.js            # AudioContext, EQ chain, play/stop, volume, timer, wake lock
│   ├── still-field.js      # Canvas 3D nodes+edges visualisation driven by analyser
│   ├── theme.js            # Still Theme (dark ↔ bone) + glass mode + meta updates
│   ├── ui-chrome.js        # Immersion hide/show of the main controls
│   └── app.js              # DOM wiring, event listeners, boot sequence
├── tests/
│   └── run.mjs             # Browser smoke tests (Playwright)
├── manifest.json
├── AGENTS.md               # Contributor / agent guide (professional, zero banter)
├── README.md
├── LICENSE
├── CHANGELOG.md            # What shipped + Lab Log
└── docs/                   # Historical requirements, visitor notes, Meet the Lab, History
```

**State flows one way.** `audio.js`, `still-field.js`, `theme.js` and `ui-chrome.js` own state and publish it through `subscribe(fn)`; `app.js` is the only module that writes to the app's DOM, and it does so exclusively in those subscription callbacks. Event handlers just call into the state modules.

This matters because playback state changes without a click behind it — the sleep timer stops the audio hours later. Updating the play button inside its own click handler is precisely how it ends up stuck showing "pause" over silence. See [AGENTS.md](./AGENTS.md#the-one-architectural-rule).

**Audio graph**  
`AudioContext` → `AudioBufferSourceNode` (looping ~12 s procedural buffer) → Still EQ (3× BiquadFilterNode) → `AnalyserNode` → `GainNode` → destination

**Noise generation**  
All noise is synthesised in `js/noise.js` → `generateNoiseBuffer(audioCtx, type, durationSec)`.  
- White: pure uniform random  
- Brown (Brownian / red): leaky integrator of white noise (classic noisehack formula)  
- Pink: multi-pole IIR filter approximation (Paul Kellet refined method)

Buffers are long enough that the loop point is effectively inaudible for these stochastic signals. State (last sample / filter coefficients) is continuous *within* each buffer.

**Still Field visualisation**  
Two full-viewport Canvas 2D layers behind the UI (`js/still-field.js`): the field, and an info layer above it. 26–44 nodes depending on viewport, up to 2.2× that from the Field Lab. No WebGL, no library — the depth is real perspective maths, not a 3D engine.

- **Depth.** Each node carries a `z` and projects through a pinhole camera, `scale = 1 / (1 + z · 0.75)`, about the screen centre. That gives genuine parallax: near nodes are larger, brighter and sweep across faster than distant ones. `z` follows a bounded sinusoid, so nodes breathe toward and away from the viewer without any chance of drifting out of the volume overnight. The world plane is sized `1 / minScale` larger than the viewport so far nodes still reach the screen edges instead of leaving a bare border.
- **Linking.** Connections are made on 3D distance, so two nodes that merely overlap on screen at different depths stay unconnected. The link radius is derived from mean node spacing rather than fixed in pixels, which holds the graph at roughly three connections per node on a phone and a desktop alike. Candidate pairs come from a uniform spatial grid rebuilt each frame with a counting sort into pre-sized typed arrays — cells are one link radius across, and each node tests only its own cell and the four neighbours that have not already tested it. That is what makes a raisable node population affordable: at 97 nodes the field visits about 440 pairs a frame instead of 4 656, and both numbers are on screen in the Live view so the claim is checkable.
- **Lifecycle.** Nodes live 70–150 s, easing in and out. Replacements are placed on the R2 low-discrepancy sequence (Roberts, 2018) instead of at random, so coverage stays even without any repulsion pass. When a node fades, its links retract along themselves into the surviving node. A node also keeps a soft residual stroke-circle outline, floored against *dimness* so a low-energy node stays legible — but scaled by the lifecycle envelope, so births and deaths still ease rather than pop.
- **Energy.** Three layers that never line up: a per-node breath, a plane wave crossing the field at an irrational angle, and the analyser's mid/high bands. Energy drives size, line weight, colour along the violet → cyan ramp, and glow. Silence leaves the first two, so the field still lives while paused. Because the ramp is weighted toward the audio's mid and high content, brown noise keeps the field violet and calm while white noise pushes it to cyan.
- **New links pulse.** The brightness transient on a fresh connection is just the error signal of the link's envelope — the gap between where a link wants to be and where it is, which peaks the instant two nodes come into range.
- **Crisp instrumentation.** All text lives on a second canvas that is cleared outright every frame. It has to: the field subtracts alpha each frame to leave a trail, and a moving label drawn onto it leaves half a second of decaying copies of itself — the soft halo that used to make the callouts look blurred. Nothing on the info layer sets `shadowBlur`, and glyph origins are snapped to whole device pixels. Legibility over a busy field comes from a plate behind the text, not a glow.
- **Stats** (the info layer, default on) — three parts under one toggle:
  - *Callouts* — an open square handle on the node, a two-run leader line, and a plated block of key/value rows. Position mode reads like a 3D application's transform panel: X red, Y green, Z blue, values right-aligned in a monospaced column with units. Detail rotates through energy, position, velocity, projection and wave on a golden-ratio-weighted dwell, acquires and releases on different energy gates, and fades through opacity envelopes — so a readout stays long enough to read and never flickers.
  - *Edge dimensions* — up to five, with the number rotated onto the line it measures and witness ticks bounding the span, exactly as a length is annotated on a technical drawing. Sampled inside the existing pair scan.
  - *The information panel and the source overlay* — the top-left surface has **Live**, **Math** and **Code** views: pair tests against brute force, grid occupancy, node turnover, a rolling frame-time trace, equations with their operands evaluated live, and per-stage `performance.now()` timings. On wide viewports the field itself carries a column of the renderer's own source with a program counter whose dwell on each stage *is* that stage's measured share of the frame. Tabs are keyboard navigable; changing values are deliberately not a live region, refresh four times a second, and stop entirely while the page is hidden.
- **Battery.** Defaults to 30 fps with motion integrated from real elapsed time (so it drifts identically at 30, 60 or 120 Hz — the Field Lab's cap changes smoothness, not speed), stops the loop entirely when the page is hidden, allocates nothing per frame, and rations `shadowBlur` to the few highest-energy nodes. `prefers-reduced-motion` slows it and drops the glow.
- Colours come from `--still-field-*` custom properties, read once per theme change — restyling the field is a CSS edit.

See [Info Layer](./docs/INFO_LAYER.md) for metric definitions, displayed equations and the instrumentation performance contract.

**Glass surfaces**  
Control panels, type selector, theme toggle and EQ use translucent `rgba` backgrounds + `backdrop-filter: blur(...)`. Transparency is a second axis alongside the theme, set by `data-glass` on `<html>`: `standard` (default) or `ultra`, which drops surface opacity far enough for the field to read through the panels. Both combine freely with either theme; text, the play button and the active noise type keep their contrast in all four combinations.

**Key extension points for AI agents**
- `js/noise.js` → add a generator to `GENERATORS` + a `data-type` button; `app.js` wires it automatically
- `css/styles.css` → CSS custom properties in `:root` / `[data-still-theme]` — rebrand colours and Still Field palette instantly
- `js/audio.js` — insert additional `BiquadFilterNode`s or effects in `ensureAudio()`
- `js/still-field.js` — swap the rendering model entirely while keeping the same enable / intensity / analyser hooks

See [AGENTS.md](./AGENTS.md#common-tasks) for step-by-step recipes.

**State (localStorage keys)**  
`complexNoise_type`, `complexNoise_volume`, `complexNoise_timer`,  
`complexNoise_stillTheme`, `complexNoise_stillEqLow/Mid/High`,  
`complexNoise_stillFieldEnabled` (default true), `complexNoise_stillFieldIntensity`,  
`complexNoise_stillFieldSpeed` (0.7–4.8, default 2.0),  
`complexNoise_stillFieldNerd` (default true), `complexNoise_stillFieldTexture` (default true),  
`complexNoise_stillFieldDensity` (0.5–2.2, default 1.0), `complexNoise_stillFieldReach` (0.6–1.6, default 1.0),  
`complexNoise_stillFieldTrail` (2–26 /s, default 8.2), `complexNoise_stillFieldDepth` (0.3–1.6, default 0.75),  
`complexNoise_stillFieldDwell` (4–26 s, default 14), `complexNoise_stillFieldFps` (30/45/60, default 30),  
`complexNoise_stillFieldCode` (default true),  
`complexNoise_stillGlassTransparent`, `complexNoise_uiChromeHidden`

All keys are centralised in `js/constants.js` → `STORAGE_KEYS`, and read/written through `js/storage.js`, which degrades gracefully when storage is unavailable (Safari Private Browsing throws on access rather than returning null).

## Tests

```bash
npm install     # Playwright is the only dev dependency
npm test        # headless browser suite, ~30s
npm test -- --headed
```

`tests/run.mjs` drives a real Chromium against a real Web Audio graph and starts its own static server, so nothing needs to be running first. It covers playback and the fade-out/restart race, the sleep timer, persistence (including corrupt, zero and out-of-range values), theming and glass mode, the canvas visualisation (that it paints, stays transparent, and stops while the page is hidden), Info layer callout formats, graph metrics and keyboard tab navigation, the spectral tilt of each noise colour, and basic accessibility (labels and 44px touch targets).

If your environment ships a pre-provisioned Chromium rather than letting Playwright download one, point the suite at it with `PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium npm test`.

CI runs the suite and ESLint on every pull request.

## Roadmap

- **Service worker** for true cold-start offline / airplane-mode use. The app makes no network calls at runtime, but a first load still needs the network.
- **AudioWorklet generation** — move the generators into an `AudioWorkletProcessor` for continuous, non-buffered synthesis and zero main-thread cost.
- **Stereo width** — independent left/right buffers via `ChannelMergerNode`.
- **More noise colours** and optional nature layers mixed in as extra sources.
- Carefully measured Easter eggs (console greeting, hidden Info-panel lines, the occasional Baldrick quote). We will not apologise for these.

## Browser support

Modern evergreen browsers (Chrome, Edge, Firefox, Safari) including Chrome for Android.  
ES modules (`type="module"`) are used; all current mobile browsers support them.  
AudioContext requires a user gesture to start/resume — handled by the play button.  
`backdrop-filter` is widely supported on current mobile browsers; the UI remains fully usable without it.

## Branding

Titanium dark surfaces + vibrant purple accents (Still Theme). Subtle silver-titanium Still Field. Glass panels that reveal the living field. Professional, calm, premium feel by Blazenetic.

## License

MIT License

Copyright (c) 2026 Blazenetic

---

Made in a small Australian lab by Blazenetic, Arty, and a supporting cast of increasingly questionable decision-makers.  
See [Meet the Lab](docs/MEET_THE_LAB.md) for the cast list and [History](docs/HISTORY.md) for how we got here.  

**Blazenetic:** “The software stays calm. The documentation gets to be chaotic. That is the deal.”  
**Darling:** “And for once, he is correct.”  

Sleep well. (Or don’t. We’re not your parents.)

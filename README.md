# Complex Noise

**Procedural noise for deep rest**  
by **[Blazenetic](https://github.com/Blazenetic)**

A pure client-side procedural noise generator (Brown, Pink, White) optimised for long sleep sessions in mobile browsers, especially Android. No audio files, no repeating loops that click, no network required after load. True continuous-feeling playback via the Web Audio API.

## Quick Start

1. **Live**: https://blazenetic.github.io/complex-noise/
2. Tap the big purple play button. Choose **Brown** for sleep. Adjust volume. Optionally set a sleep timer.

Add to Home Screen on Android for an app-like experience (via the manifest).

### Running it locally

The app is split into ES modules, which browsers fetch with CORS — so opening
`index.html` directly from your filesystem will **not** work. Serve the folder
over `http://` instead:

```bash
git clone https://github.com/Blazenetic/complex-noise.git
cd complex-noise
npm start                  # http://localhost:8123
# or, with no Node at all:
python3 -m http.server 8123
```

(If you do open the file directly, the page tells you so rather than sitting
there silently.)

## Features

- **Brown** (default, deep & calming for sleep), **Pink**, **White**
- Procedural generation → infinite, pattern-free, seamless 10+ hour playback
- Volume control with smooth ramps (soft default 0.22 on first start)
- Continuous sleep timer (0–10 h slider, 0.5 h steps) with gentle fade-out
- Settings remembered in localStorage
- **Still Theme**: Premium brushed-titanium dark (default) + toggleable bone-white calm theme with procedural SVG texture
- **Still Field**: Full-page nodes-and-edges visualisation with gentle perspective depth (default **on**). Nodes drift through a shallow 3D volume, coming slowly toward you and receding; they are born and fade away, and the lines attached to a fading node retract into their partners rather than blinking off. Alive nodes keep a soft residual stroke-circle outline so they never fully vanish while still alive. Colour rides from cool violet toward electric cyan as energy rises, driven by the audio analyser. On/off toggle plus intensity and speed sliders (practical range **0.7 – 4.8**)
- **Info labels** (nerd layer, default on) — sparse, energy-gated labels that appear only when there is meaningful activity
- **Background texture** — controllable procedural overlay (default on)
- **Still Equaliser**: Simple 3-band (low / mid / high) equaliser with calm sliders (open by default)
- **Glass UI**: Translucent control surfaces with backdrop blur so the Still Field shows through, plus an **ultra-transparent** mode for when you want the field foregrounded
- Dedicated **Minimise interface** action for immersion, with a floating restore cluster (play + status + Show controls)
- Seamless mobile scrolling (no visible scrollbars)
- Refined vibrant purple play button (gradient + soft glow) that remains the clear focal point
- Clean inline SVG icons for play/pause (no external assets)
- Large touch targets, mobile-first, improved focus rings and ARIA for accessibility
- Wake Lock support (keeps screen from sleeping while playing, where supported)
- Zero dependencies and zero network calls once loaded — all audio is synthesised on device
- MIT License · Made in Australia with the help of AI agents

> **Note on offline use:** nothing is fetched at runtime, so a loaded tab keeps
> working without a connection. True cold-start offline (airplane mode, app
> reopened from the Home Screen) needs a service worker, which is not shipped
> yet — see [Roadmap](#roadmap).

## Architecture (for developers & AI agents)

> Working on this codebase? Start with **[AGENTS.md](./AGENTS.md)** — it covers
> how to run and test the app, the one architectural rule that keeps playback
> correct, and the traps that have already caused bugs here.

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
├── AGENTS.md               # Contributor / agent guide
├── README.md
├── LICENSE
└── docs/                   # Historical product requirements + context
```

**State flows one way.** `audio.js`, `still-field.js`, `theme.js` and `ui-chrome.js` own state
and publish it through `subscribe(fn)`; `app.js` is the only module that writes
to the app's DOM, and it does so exclusively in those subscription callbacks.
Event handlers just call into the state modules.

This matters because playback state changes without a click behind it — the
sleep timer stops the audio hours later. Updating the play button inside its own
click handler is precisely how it ends up stuck showing "pause" over silence.
See [AGENTS.md](./AGENTS.md#the-one-architectural-rule).

**Audio graph**  
`AudioContext` → `AudioBufferSourceNode` (looping ~12 s procedural buffer) → Still EQ (3× BiquadFilterNode) → `AnalyserNode` → `GainNode` → destination

**Noise generation**  
All noise is synthesised in `js/noise.js` → `generateNoiseBuffer(audioCtx, type, durationSec)`.  
- White: pure uniform random  
- Brown (Brownian / red): leaky integrator of white noise (classic noisehack formula)  
- Pink: multi-pole IIR filter approximation (Paul Kellet refined method)

Buffers are long enough that the loop point is effectively inaudible for these stochastic signals. State (last sample / filter coefficients) is continuous *within* each buffer.

**Still Field visualisation**  
Full-viewport Canvas 2D layer behind the UI (`js/still-field.js`), 26–44 nodes
depending on viewport. No WebGL, no library — the depth is real perspective
maths, not a 3D engine.

- **Depth.** Each node carries a `z` and projects through a pinhole camera,
  `scale = 1 / (1 + z · 0.75)`, about the screen centre. That gives genuine
  parallax: near nodes are larger, brighter and sweep across faster than distant
  ones. `z` follows a bounded sinusoid, so nodes breathe toward and away from
  the viewer without any chance of drifting out of the volume overnight. The
  world plane is sized `1 / minScale` larger than the viewport so far nodes
  still reach the screen edges instead of leaving a bare border.
- **Linking.** Connections are made on 3D distance, so two nodes that merely
  overlap on screen at different depths stay unconnected. The link radius is
  derived from mean node spacing rather than fixed in pixels, which holds the
  graph at roughly three connections per node on a phone and a desktop alike.
- **Lifecycle.** Nodes live 70–150 s, easing in and out. Replacements are placed
  on the R2 low-discrepancy sequence (Roberts, 2018) instead of at random, so
  coverage stays even without any repulsion pass. When a node fades, its links
  retract along themselves into the surviving node. Alive nodes keep a soft
  residual stroke-circle outline so they never fully vanish while still alive.
- **Energy.** Three layers that never line up: a per-node breath, a plane wave
  crossing the field at an irrational angle, and the analyser's mid/high bands.
  Energy drives size, line weight, colour along the violet → cyan ramp, and
  glow. Silence leaves the first two, so the field still lives while paused.
  Because the ramp is weighted toward the audio's mid and high content, brown
  noise keeps the field violet and calm while white noise pushes it to cyan.
- **New links pulse.** The brightness transient on a fresh connection is just
  the error signal of the link's envelope — the gap between where a link wants
  to be and where it is, which peaks the instant two nodes come into range.
- **Info labels** (nerd layer, default on). Sparse, energy-gated labels (max 4)
  that only appear on high-energy, nearer nodes.
- **Battery.** Runs at 30 fps with motion integrated from real elapsed time (so
  it drifts identically at 30, 60 or 120 Hz), stops the loop entirely when the
  page is hidden, allocates nothing per frame, and rations `shadowBlur` to the
  few highest-energy nodes. `prefers-reduced-motion` slows it and drops the glow.
- Colours come from `--still-field-*` custom properties, read once per theme
  change — restyling the field is a CSS edit.

**Glass surfaces**  
Control panels, type selector, theme toggle and EQ use translucent `rgba`
backgrounds + `backdrop-filter: blur(...)`. Transparency is a second axis
alongside the theme, set by `data-glass` on `<html>`: `standard` (default) or
`ultra`, which drops surface opacity far enough for the field to read through
the panels. Both combine freely with either theme; text, the play button and the
active noise type keep their contrast in all four combinations.

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
`complexNoise_stillGlassTransparent`, `complexNoise_uiChromeHidden`

All keys are centralised in `js/constants.js` → `STORAGE_KEYS`, and read/written
through `js/storage.js`, which degrades gracefully when storage is unavailable
(Safari Private Browsing throws on access rather than returning null).

## Tests

```bash
npm install     # Playwright is the only dev dependency
npm test        # headless browser suite, ~30s
npm test -- --headed
```

`tests/run.mjs` drives a real Chromium against a real Web Audio graph and starts
its own static server, so nothing needs to be running first. It covers playback
and the fade-out/restart race, the sleep timer, persistence (including corrupt,
zero and out-of-range values), theming and glass mode, the canvas visualisation
(that it paints, stays transparent, and stops while the page is hidden), the
spectral tilt of each noise colour, and basic accessibility (labels and 44px
touch targets).

If your environment ships a pre-provisioned Chromium rather than letting
Playwright download one, point the suite at it with
`PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium npm test`.

CI runs the suite and ESLint on every pull request.

## Roadmap

- **Service worker** for true cold-start offline / airplane-mode use. The app
  makes no network calls at runtime, but a first load still needs the network.
- **AudioWorklet generation** — move the generators into an
  `AudioWorkletProcessor` for continuous, non-buffered synthesis and zero
  main-thread cost.
- **Stereo width** — independent left/right buffers via `ChannelMergerNode`.
- **More noise colours** and optional nature layers mixed in as extra sources.

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

Made in Australia with the help of AI agents.  
Sleep well.

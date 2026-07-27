# Complex Noise

**Seamless noise for deep rest**  
by **Complex State**

A pure client-side procedural noise generator (Brown, Pink, White) optimized for long sleep sessions in mobile browsers, especially Android. No audio files, no repeating loops that click, no network required after load. True continuous-feeling playback via the Web Audio API.

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
- Volume control with smooth ramps
- Sleep timer (Off / 1h / 2h / 4h / 8h / 10h) with gentle fade-out
- Settings remembered in localStorage
- **Still Theme**: Premium brushed-titanium dark (default) + toggleable bone-white calm theme with procedural SVG texture
- **Still Field**: Optional full-page nodes-and-edges graph visualisation (default **off**). Subtle silver/titanium nodes connected by soft edges that slowly drift and reconfigure. Driven gently by audio analysis. Easy on/off toggle + intensity control
- **Still EQ**: Simple 3-band (low / mid / high) equaliser with calm sliders
- **Glass UI**: Translucent control surfaces with backdrop blur so the Still Field visualisation shows through beautifully in both themes
- Refined vibrant purple play button (gradient + soft glow) that remains the clear focal point
- Clean inline SVG icons for play/pause (no external assets)
- Large touch targets, mobile-first, improved focus rings and ARIA for accessibility
- Wake Lock support (keeps screen from sleeping while playing, where supported)
- Zero dependencies and zero network calls once loaded — all audio is synthesized on device
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
│   ├── still-field.js      # Canvas nodes+edges visualisation driven by analyser
│   ├── theme.js            # Still Theme (dark ↔ bone) + meta updates
│   └── app.js              # DOM wiring, event listeners, boot sequence
├── tests/
│   └── run.mjs             # Browser smoke tests (Playwright)
├── manifest.json
├── AGENTS.md               # Contributor / agent guide
├── README.md
├── LICENSE
└── docs/
```

**State flows one way.** `audio.js`, `still-field.js` and `theme.js` own state
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
All noise is synthesized in `js/noise.js` → `generateNoiseBuffer(audioCtx, type, durationSec)`.  
- White: pure uniform random  
- Brown (Brownian / red): leaky integrator of white noise (classic noisehack formula)  
- Pink: multi-pole IIR filter approximation (Paul Kellet refined method)

Buffers are long enough that the loop point is effectively inaudible for these stochastic signals. State (last sample / filter coefficients) is continuous *within* each buffer.

**Still Field visualisation**  
Full-viewport canvas layer behind the UI (`js/still-field.js`). Renders a calm nodes-and-edges graph:
- Small number of nodes (~24–36) that drift very slowly
- Soft edges appear between nearby nodes (distance-based opacity)
- Node/edge colours are subtle silver-titanium (dark theme) or muted warm grey (bone theme)
- Motion and connection strength are gently influenced by `AnalyserNode` frequency metrics and the intensity slider
- Completely optional — defaults to **off** so pure audio users see nothing extra. Toggle lives in the main controls area for easy access

**Glass surfaces**  
Control panels, type selector, theme toggle and EQ use translucent `rgba` backgrounds + `backdrop-filter: blur(...)` so the living Still Field remains visible and the whole interface feels lighter and more premium.

**Key extension points for AI agents**
- `js/noise.js` → add a generator to `GENERATORS` + a `data-type` button; `app.js` wires it automatically
- `css/styles.css` → CSS custom properties in `:root` / `[data-still-theme]` — rebrand colours and Still Field palette instantly
- `js/audio.js` — insert additional `BiquadFilterNode`s or effects in `ensureAudio()`
- `js/still-field.js` — swap the rendering model entirely while keeping the same enable / intensity / analyser hooks

See [AGENTS.md](./AGENTS.md#common-tasks) for step-by-step recipes.

**State (localStorage keys)**  
`complexNoise_type`, `complexNoise_volume`, `complexNoise_timer`,  
`complexNoise_stillTheme`, `complexNoise_stillEqLow/Mid/High`,  
`complexNoise_stillFieldEnabled` (default false), `complexNoise_stillFieldIntensity`

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
and the fade-out/restart race, the sleep timer, persistence (including corrupt
and zero values), theming, the canvas visualisation, the spectral tilt of each
noise colour, and basic accessibility (labels and 44px touch targets).

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

Titanium dark surfaces + vibrant purple accents (Still Theme). Subtle silver-titanium Still Field. Glass panels that reveal the living field. Professional, calm, premium feel for Complex State.

## License

MIT License

Copyright (c) 2026 Complex State / Blazenetic

---

Made in Australia with the help of AI agents.  
Sleep well.

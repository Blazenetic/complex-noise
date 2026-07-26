# Complex Noise

**Seamless noise for deep rest**  
by **Complex State**

A pure client-side procedural noise generator (Brown, Pink, White) optimized for long sleep sessions in mobile browsers, especially Android. No audio files, no repeating loops that click, no network required after load. True continuous-feeling playback via the Web Audio API.

## Quick Start

1. **Live**: Enable GitHub Pages (Settings → Pages → Deploy from branch `main` / root) then open  
   https://blazenetic.github.io/complex-noise/
2. **Local / offline**: Download `index.html`, open it in Chrome (or any modern browser) on your phone, and bookmark it.
3. Tap the big play button. Choose **Brown** for sleep. Adjust volume. Optionally set a sleep timer.

Add to Home Screen on Android for an app-like experience (via the manifest).

## Features (MVP+)

- **Brown** (default, deep & calming for sleep), **Pink**, **White**
- Procedural generation → infinite, pattern-free, seamless 10+ hour playback
- Volume control with smooth ramps
- Sleep timer (Off / 1h / 2h / 4h / 8h / 10h) with gentle fade-out
- Settings remembered in localStorage
- Dark titanium + deep purple professional theme
- Large touch targets, mobile-first
- Wake Lock support (keeps screen from sleeping while playing, where supported)
- Offline capable, zero dependencies

## Architecture (for developers & AI agents)

**Audio graph**  
`AudioContext` → `AudioBufferSourceNode` (looping ~12 s procedural buffer) → `GainNode` → destination

**Noise generation**  
All noise is synthesized in `generateNoiseBuffer(audioCtx, type, durationSec)`.  
- White: pure uniform random  
- Brown (Brownian / red): leaky integrator of white noise (classic noisehack formula)  
- Pink: multi-pole IIR filter approximation (Paul Kellet refined method)

Buffers are long enough that the loop point is effectively inaudible for these stochastic signals. State (last sample / filter coefficients) is continuous *within* each buffer.

**Key extension points**
- `generateNoiseBuffer(...)` — add a new `case` + UI button to introduce more noise colors or variants
- CSS custom properties in `:root` — rebrand colors instantly
- Insert `BiquadFilterNode` between source and gain for EQ / soft high-pass
- Upgrade path: move generators into an `AudioWorkletProcessor` for continuous (non-buffered) generation and zero main-thread cost

**State**  
`localStorage` keys: `complexNoise_type`, `complexNoise_volume`, `complexNoise_timer`

## How to edit / future AI work

1. Open `index.html` — everything is inline (CSS + JS) for maximum portability.
2. Change theme by editing the `:root` variables.
3. Add a noise type: implement the generator, add a button in the type selector, wire the click handler.
4. Want a visualizer? Add an `AnalyserNode` and a canvas.
5. Stereo width: generate independent left/right buffers and use `ChannelMerger` or two panners.
6. Nature layers or more complex synthesis can be mixed with additional sources + gains.

Comments throughout the code explain the major sections.

## Browser support

Modern evergreen browsers (Chrome, Edge, Firefox, Safari) including Chrome for Android.  
AudioContext requires a user gesture to start/resume — handled by the play button.

## Branding

Titanium dark surfaces + deep purple accents. No pure bone-white. Professional, calm, premium feel for Complex State.

## License

MIT

---

Made for Complex State. Sleep well.

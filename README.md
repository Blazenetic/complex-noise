# Complex Noise

**Seamless noise for deep rest**  
by **Complex State**

A pure client-side procedural noise generator (Brown, Pink, White) optimized for long sleep sessions in mobile browsers, especially Android. No audio files, no repeating loops that click, no network required after load. True continuous-feeling playback via the Web Audio API.

## Quick Start

1. **Live**: https://blazenetic.github.io/complex-noise/
2. **Local / offline**: Download `index.html`, open it in Chrome (or any modern browser) on your phone, and bookmark it.
3. Tap the big purple play button. Choose **Brown** for sleep. Adjust volume. Optionally set a sleep timer.

Add to Home Screen on Android for an app-like experience (via the manifest).

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
- Offline capable, zero dependencies
- MIT License · Made in Australia with the help of AI agents

## Architecture (for developers & AI agents)

**Audio graph**  
`AudioContext` → `AudioBufferSourceNode` (looping ~12 s procedural buffer) → Still EQ (3× BiquadFilterNode) → `AnalyserNode` → `GainNode` → destination

**Noise generation**  
All noise is synthesized in `generateNoiseBuffer(audioCtx, type, durationSec)`.  
- White: pure uniform random  
- Brown (Brownian / red): leaky integrator of white noise (classic noisehack formula)  
- Pink: multi-pole IIR filter approximation (Paul Kellet refined method)

Buffers are long enough that the loop point is effectively inaudible for these stochastic signals. State (last sample / filter coefficients) is continuous *within* each buffer.

**Still Field visualisation**  
Full-viewport canvas layer behind the UI. Renders a calm nodes-and-edges graph:
- Small number of nodes (~24–36) that drift very slowly
- Soft edges appear between nearby nodes (distance-based opacity)
- Node/edge colours are subtle silver-titanium (dark theme) or muted warm grey (bone theme)
- Motion and connection strength are gently influenced by `AnalyserNode` frequency metrics and the intensity slider
- Completely optional — defaults to **off** so pure audio users see nothing extra. Toggle lives in the main controls area for easy access

**Glass surfaces**  
Control panels, type selector, theme toggle and EQ use translucent `rgba` backgrounds + `backdrop-filter: blur(...)` so the living Still Field remains visible and the whole interface feels lighter and more premium.

**Key extension points**
- `generateNoiseBuffer(...)` — add a new `case` + UI button to introduce more noise colors or variants
- CSS custom properties in `:root` / `[data-still-theme]` — rebrand colours and Still Field palette instantly
- Insert additional `BiquadFilterNode`s or effects between the existing EQ chain and analyser
- Upgrade path: move generators into an `AudioWorkletProcessor` for continuous (non-buffered) generation and zero main-thread cost

**State (localStorage keys)**  
`complexNoise_type`, `complexNoise_volume`, `complexNoise_timer`,  
`complexNoise_stillTheme`, `complexNoise_stillEqLow/Mid/High`,  
`complexNoise_stillFieldEnabled` (default false), `complexNoise_stillFieldIntensity`

## How to edit / future AI work

1. Open `index.html` — everything is inline (CSS + JS) for maximum portability.
2. Change theme by editing the `:root` / `[data-still-theme]` variables (including the new glass alpha values and `--glass-blur`).
3. Add a noise type: implement the generator, add a button in the type selector, wire the click handler.
4. Still Field lives in the canvas + `updateStillField` loop — swap the rendering model if you want a different visual language while keeping the same enable/intensity/audio hooks.
5. Stereo width: generate independent left/right buffers and use `ChannelMerger` or two panners.
6. Nature layers or more complex synthesis can be mixed with additional sources + gains.

Comments throughout the code explain the major sections.

## Browser support

Modern evergreen browsers (Chrome, Edge, Firefox, Safari) including Chrome for Android.  
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

# Findings & Context — Complex Noise (for the build team)

**Repo:** https://github.com/Blazenetic/complex-noise  
**Live:** https://blazenetic.github.io/complex-noise/  

---

## Current State Summary

Complex Noise is a deliberately minimal, high-quality single-page app:

- **index.html** — complete app (inline CSS + JS)
- **manifest.json** — basic PWA
- **README.md** — excellent developer/AI notes already present
- **LICENSE** — MIT

### Core Audio Architecture (do not break)
```
AudioContext → AudioBufferSourceNode (looping ~12 s procedural buffer)
            → Still EQ (3× BiquadFilterNode) → AnalyserNode → GainNode → destination
```

Noise is generated in `generateNoiseBuffer(audioCtx, type, durationSec)`:
- White: uniform random
- Brown: classic leaky-integrator Brownian
- Pink: Paul Kellet multi-pole approximation

Buffers are long enough that loop points are effectively inaudible for these signals. State is continuous *within* each buffer.

### UI Polish (feature/ui-transparency-and-polish)
- Glass / translucent surfaces (`rgba` + `backdrop-filter`) so Still Field shows through in both themes
- Refined vibrant purple gradient play button with soft glow
- Inline SVG play/pause icons (simple free paths)
- Quick accessibility: `aria-pressed` on type buttons, stronger focus-visible rings, live status
- Phone-friendly touch targets and safe-area padding
- Footer credit: MIT License · Made in Australia with the help of AI agents

### localStorage keys already in use
- `complexNoise_type`
- `complexNoise_volume`
- `complexNoise_timer`
- `complexNoise_stillTheme`
- `complexNoise_stillEqLow/Mid/High`
- `complexNoise_stillFieldEnabled` (default false)
- `complexNoise_stillFieldIntensity`

### Manifest
Basic PWA with mathematical SVG icon. Theme-color updates with Still Theme.

---

## Design Direction

- Calm, premium, restful, procedural, mobile-first, zero-deps
- Glass UI that reveals the living Still Field without reducing readability
- Purple remains the signature accent and is intentionally more vibrant on the play button

---

## Notes for Reviewers / Future Sessions

- Noise type expansion and full accessibility audit remain open for future work.
- Prefer solutions that keep the app feeling lightweight and portable.
- The visualisation is a signature feature — glass surfaces were added specifically so users can enjoy it more fully.

This context document exists so the implementing team can move quickly with full understanding of the current codebase and the product intent.

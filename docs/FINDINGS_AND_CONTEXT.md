# Findings & Context — Complex Noise (for the build team)

**Repo:** https://github.com/Blazenetic/complex-noise  
**Live:** https://blazenetic.github.io/complex-noise/  
**Current main SHA (at branch creation):** `2bddcbbe6003dd49f7ad2c3c192bd71b9cb634de`

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
            → GainNode → destination
```

Noise is generated in `generateNoiseBuffer(audioCtx, type, durationSec)`:
- White: uniform random
- Brown: classic leaky-integrator Brownian
- Pink: Paul Kellet multi-pole approximation

Buffers are long enough that loop points are effectively inaudible for these signals. State is continuous *within* each buffer.

Existing extension points already documented in the README (and still valid):
- Insert `BiquadFilterNode` between source and gain → perfect place for the simple EQ
- Add `AnalyserNode` + canvas/SVG for visualisation
- Theme via CSS custom properties in `:root`
- New noise types by extending the generator + UI (explicitly deferred)

### Current Theme
Dark titanium + deep purple. README previously stated “No pure bone-white” — we are intentionally reversing that decision for a toggleable calm mode while improving the dark mode into a more premium brushed-titanium direction.

### localStorage keys already in use
- `complexNoise_type`
- `complexNoise_volume`
- `complexNoise_timer`

Any new keys should follow the same prefix for consistency.

### Manifest
Currently very basic (no icons). Theme-color is purple. Will need updating for the dual-theme system and for proper PWA icons.

---

## Design Direction Recap (from product owner)

- Start in improved **dark / premium brushed titanium**
- **Bone-white** as a full secondary theme with subtle procedural texture
- **Theme toggle** is required
- Visualisation is **full-page**, mathematical/procedural, reacts to audio, and should gently interact with buttons/UI in a calm way
- Visualisation should have some settings
- Equaliser: simple, calm, not over-engineered
- UI polish + GitHub link on the page
- Keep the spirit: calm, premium, restful, procedural, mobile-first, zero-deps

---

## Suggested Implementation Order for Agents

1. Theme system + CSS custom properties + toggle + persistence (dark first, then bone-white)
2. Subtle procedural background texture for bone-white (and optionally a very restrained version for dark)
3. Audio graph extension: AnalyserNode + simple multi-band or shelf EQ
4. Full-page visualisation layer that consumes analyser data and lightly influences UI elements
5. Settings UI for visualisation + EQ (collapsible or toggled to keep main surface clean)
6. Favicon / PWA icons (simple mathematical mark)
7. Footer GitHub link + minor UI polish
8. Thorough commenting + PR description

---

## Notes for Reviewers / Future Sessions

- Noise type expansion and accessibility are deliberately deferred.
- Prefer solutions that keep the app feeling lightweight and portable.
- The visualisation is intended to be a delightful, signature feature — invest care here while staying performant.

This context document exists so the implementing team can move quickly with full understanding of the current codebase and the product intent.

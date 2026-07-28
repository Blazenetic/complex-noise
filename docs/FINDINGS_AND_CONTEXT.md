# Findings & Context — Complex Noise (for the build team)

**Repo:** https://github.com/Blazenetic/complex-noise  
**Live:** https://blazenetic.github.io/complex-noise/  
**Date of original notes:** ~27 July 2026  
**Current technical contract:** [AGENTS.md](../AGENTS.md)  
**How to contribute now:** [CONTRIBUTING.md](../CONTRIBUTING.md)

> **Lab note (28 July 2026):** This document captures the codebase as it existed *before* the modular rewrite and the full Still Field / Info Layer work. It is kept for historical context and for anyone who wants to understand the starting point of the intensive sprint. The architecture, state ownership rules, testing requirements and “things that will bite you” now live exclusively in [AGENTS.md](../AGENTS.md). Do not treat the layout notes below as current.

**Melchett:** The original findings! Intelligence of the highest calibre!  
**Darling:** It is a snapshot from before we split the single file, Melchett.  
**Blazenetic:** And the core audio graph and the zero-dependency rule still stand. I researched the constraints, then complained about the single-file maintenance edge cases. You’re welcome.

---

## Current State Summary (as of the original notes)

Complex Noise was a deliberately minimal, high-quality single-page app:

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

### localStorage keys already in use (at the time)
- `complexNoise_type`
- `complexNoise_volume`
- `complexNoise_timer`
- `complexNoise_stillTheme`
- `complexNoise_stillEqLow/Mid/High`
- `complexNoise_stillFieldEnabled` (default false at the time)
- `complexNoise_stillFieldIntensity`

(Many more keys exist now — see `js/constants.js` and [AGENTS.md](../AGENTS.md).)

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

This context document exists so the implementing team can move quickly with full understanding of the current codebase and the product intent *at the time it was written*.

For the live rules, start with [AGENTS.md](../AGENTS.md).  
For how the Lab expects contributions, see [CONTRIBUTING.md](../CONTRIBUTING.md).  
For the public origin story, see [HISTORY.md](./HISTORY.md).

> **Arty:** I left the original audio graph description intact because it is still correct.  
> **Baldrick:** My cunning plan is to replace the entire findings document with a single potato.  
> **Darling:** No.

The software stays calm. The documentation (historical or otherwise) gets to be chaotic. That is the deal.

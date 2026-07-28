# History of Complex Noise

A short, mostly true account of how a small Australian lab turned a quiet idea into a zero-dependency sleep companion in roughly 36 hours.

## Origin — 26 July 2026

Complex Noise began as a single-file, pure client-side procedural noise generator. Brown (the default), Pink and White noise, synthesised live with the Web Audio API, looping ~12-second buffers whose seams are inaudible for these stochastic signals. Volume, a sleep timer, Wake Lock, titanium-and-purple branding, and a determined refusal to ship any runtime dependency or network call after load.

The goal was simple: something that would keep going all night on a phone without clicking, without getting louder, and without draining the battery more than necessary.

Live from the first day: https://blazenetic.github.io/complex-noise/

## The Sprint — 26–28 July 2026

What followed was intensive, iterative development (human + AI agents) that turned the MVP into the polished, modular, agent-friendly project you see today.

Key movements:

- **Still Theme & Glass** — Premium brushed-titanium dark (default) plus a bone-white calm theme with procedural SVG texture. Glass surfaces (standard and ultra-transparent) so the living field shows through. Theme and glass treated as independent axes.
- **Still Field** — Evolved from soft particles into a full-page nodes-and-edges visualisation with real perspective depth, node lifecycles (70–150 s), retracting links, residual outlines so quiet nodes stay legible, and three non-aligning energy layers driven by breath, an irrational plane wave, and the audio analyser. Violet stays calm under brown noise; white pushes cyan. Default on, 30 fps, stops when the page is hidden.
- **Still EQ** — Simple, calm 3-band equaliser (low / mid / high) sitting cleanly in the audio graph.
- **Info Layer / Field Lab / Stats** — Engineering-drawing callouts, Live / Math / Code panels, source overlay, and live controls for density, reach, trail, perspective, dwell and frame rate. All battery-conscious and measurable.
- **Immersion** — Dedicated “Minimise interface” path with a floating restore cluster. Escape always brings the controls back.
- **Architecture** — Clean ES-module split. One-way state flow: modules own state and publish; `app.js` is the only thing that writes to the DOM. This is what keeps the play button honest when the sleep timer fires hours later.
- **Tests & docs** — Playwright browser suite + CI, comprehensive AGENTS.md, and the beginning of the Lab Voice system.

The public [0.1.0] release landed on 28 July 2026. Full details live in the [Changelog](../CHANGELOG.md) (including the Lab Log).

## The Lab Voice

Somewhere in the middle of the sprint the documentation decided it was allowed to have a personality. The software itself stays calm and professional. The narrative surfaces (README framing, Changelog Lab Log, Meet the Lab) may sound like a late-night crossover episode written by people who still care about residual outlines having a floor.

The cast, the wall between narrative and agent docs, and the style rules live in the project Google Drive. The friendly public introduction is [Meet the Lab](./MEET_THE_LAB.md).

## What was deliberately kept

- Zero runtime dependencies, zero build step, static files only.
- Mobile-first, long-session reliability (8+ hours).
- Procedural audio with continuous internal state.
- The one architectural rule that prevents the classic “button stuck on pause over silence” bug.

## What comes next (Roadmap flavour)

Service worker for true cold-start offline, AudioWorklet continuous synthesis, stereo width, more noise colours, and a carefully measured quantity of Easter eggs. The full origin story and further Lab Logs will continue as the project grows.

---

Made in a small Australian lab.  
The software stays calm. The documentation gets to be chaotic. That is the deal.  
Sleep well. (Or don’t. We’re not your parents.)

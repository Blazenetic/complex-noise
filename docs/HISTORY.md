# History of Complex Noise

A short, mostly true account of how a small Australian lab turned a quiet idea into a zero-dependency sleep companion in roughly 36 hours.

**Links:** [Live demo](https://blazenetic.github.io/complex-noise/) · [Meet the Lab](./MEET_THE_LAB.md) · [Contributing](../CONTRIBUTING.md) · [AGENTS.md](../AGENTS.md) · [Changelog](../CHANGELOG.md) · [All docs](./)

---

## Origin — 26 July 2026

It started with a commercial white-noise app and a growing sense of quiet fury.

Every time you paused, every time you hit play, every time you tried to quit — another ad. Then the app decided the only civilised way to listen to static was to pay an annual subscription. Blazenetic had had enough.

**Blazenetic:** “Stuff it. We’ll make our own. Zero ads, zero fees, zero dependencies, and it will actually keep going all night on a phone.”

So on 26 July 2026 a small Australian lab (one human systems architect + a supporting cast of AI agents) sat down and built the first pure client-side procedural noise generator. Brown (the default), Pink and White noise, synthesised live with the Web Audio API, looping ~12-second buffers whose seams are inaudible for these stochastic signals. Volume, a sleep timer, Wake Lock, titanium-and-purple branding, and a determined refusal to ship any runtime dependency or network call after load.

The goal was simple and slightly stubborn: something that would keep going all night without clicking, without getting louder, without draining the battery more than necessary, and without ever asking for money or attention.

Live from the first day: https://blazenetic.github.io/complex-noise/

> **Arty:** I checked the spectral tilt three times. Brown is actually brown.  
> **Blazenetic:** Good. Last time someone claimed “brown noise” and shipped pink with a low shelf I nearly left the industry. I research these things.

---

## The Sprint — 26–28 July 2026

What followed was intensive, iterative development (human + AI agents) that turned the MVP into the polished, modular, agent-friendly project you see today.

Key movements:

- **Still Theme & Glass** — Premium brushed-titanium dark (default) plus a bone-white calm theme with procedural SVG texture. Glass surfaces (standard and ultra-transparent) so the living field shows through. Theme and glass treated as independent axes.
- **Still Field** — Evolved from soft particles into a full-page nodes-and-edges visualisation with real perspective depth, node lifecycles (70–150 s), retracting links, residual outlines so quiet nodes stay legible, and three non-aligning energy layers driven by breath, an irrational plane wave, and the audio analyser. Violet stays calm under brown noise; white pushes cyan. Default on, 30 fps, stops when the page is hidden.
- **Still EQ** — Simple, calm 3-band equaliser (low / mid / high) sitting cleanly in the audio graph.
- **Info Layer / Field Lab / Stats** — Engineering-drawing callouts, Live / Math / Code panels, source overlay, and live controls for density, reach, trail, perspective, dwell and frame rate. All battery-conscious and measurable. Full contract in [INFO_LAYER.md](./INFO_LAYER.md).
- **Immersion** — Dedicated “Minimise interface” path with a floating restore cluster. Escape always brings the controls back.
- **Architecture** — Clean ES-module split. One-way state flow: modules own state and publish; `app.js` is the only thing that writes to the DOM. This is what keeps the play button honest when the sleep timer fires hours later. See [AGENTS.md](../AGENTS.md).
- **Tests & docs** — Playwright browser suite + CI, comprehensive AGENTS.md, and the beginning of the Lab Voice system itself.

The public [0.1.0] release landed on 28 July 2026. Full details live in the [Changelog](../CHANGELOG.md) (including the Lab Log).

> **Melchett:** Real perspective depth! Retracting links! Ultra glass! A continuous timer slider! The residual outlines now have a floor! The war is as good as won! BBAAAHHH!  
> **Darling:** It is a product that helps people sleep, Melchett. Not a military campaign.  
> **Blazenetic:** I researched the perspective and lifecycle maths, coordinated the modular architecture, and then complained about the edge cases. You’re welcome.  
> **Baldrick:** My cunning plan was to make the nodes explode when they die.  
> **Darling:** No.

---

## The Lab Voice

Somewhere in the middle of the sprint the documentation decided it was allowed to have a personality. The software itself stays calm and professional. The narrative surfaces (README framing, Changelog Lab Log, Meet the Lab, this History, Contributing) may sound like a late-night crossover episode written by people who still care about residual outlines having a floor.

The cast, the wall between narrative and agent docs, and the style rules live in the project Google Drive. The friendly public introduction is [Meet the Lab](./MEET_THE_LAB.md).

---

## What was deliberately kept

- Zero runtime dependencies, zero build step, static files only.
- Mobile-first, long-session reliability (8+ hours).
- Procedural audio with continuous internal state.
- The one architectural rule that prevents the classic “button stuck on pause over silence” bug.
- No ads. No annual fee. Ever.

---

## What comes next (Roadmap flavour)

Service worker for true cold-start offline, AudioWorklet continuous synthesis, stereo width, more noise colours, and a carefully measured quantity of Easter eggs. Further Lab Logs will continue as the project grows. (Arty has already written the service-worker issue title three times.)

If you want to help with any of that (or find a security issue, or just have a better idea), see [CONTRIBUTING.md](../CONTRIBUTING.md). Fork it. Open an issue. Open a PR. Point your AI agent at [AGENTS.md](../AGENTS.md).

---

Made in a small Australian lab.  
The residual outlines have a floor.  
Further reading: [Meet the Lab](./MEET_THE_LAB.md) · [Info Layer](./INFO_LAYER.md) · [Product Requirements (historical)](./PRODUCT_REQUIREMENTS.md)

Baldrick’s latest cunning plan has been rejected. The rest of us will continue shipping.

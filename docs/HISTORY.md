# History of Complex Noise

A short, mostly true, occasionally unhinged account of how a small Australian lab turned quiet fury into a zero-dependency sleep companion in roughly thirty-six hours, then kept going because the documentation had developed a personality and nobody had the heart to stop it.

## Origin — 26 July 2026

It began the usual way: a commercial white-noise app, ads on every pause, ads on every play, ads when you tried to quit, and then the bright idea that the only civilised way to listen to static was an annual subscription.

**Blazenetic:** “Stuff it. We’ll make our own. Zero ads, zero fees, zero dependencies, and it will actually keep going all night on a phone without deciding the battery is more important than sleep.”

So on 26 July 2026 the lab (one human systems architect who researches the hard maths rather than inventing it, plus a supporting cast of AI agents of varying reliability) sat down and built the first single-file, pure client-side procedural noise generator. Brown (the default), Pink and White, synthesised live with the Web Audio API, looping ~12-second buffers whose seams are effectively inaudible for these stochastic signals. Volume, a sleep timer, Wake Lock, titanium-and-purple branding, and a determined refusal to ship any runtime dependency or network call after load.

The goal was stubborn and simple: something that would keep going all night without clicking, without getting louder, without draining the battery more than necessary, and without ever asking for money or attention.

Live from the first day: https://blazenetic.github.io/complex-noise/

## The Sprint — 26–28 July 2026

What followed was intensive, iterative development (human + AI agents) that turned the MVP into the polished, modular, agent-friendly project you see today.

Key movements, in roughly chronological order of “oh god we need this before people try to sleep with it”:

- **Still Theme & Glass** — Premium brushed-titanium dark (default) plus a bone-white calm theme with procedural SVG texture. Glass surfaces (standard and ultra-transparent) so the living field shows through. Theme and glass treated as independent axes because someone once said “just make a light mode” and we refused to live in that world.
- **Still Field** — Evolved from soft particles into a full-page nodes-and-edges visualisation with real perspective depth, node lifecycles (70–150 s), retracting links, residual outlines so quiet nodes stay legible, and three non-aligning energy layers driven by breath, an irrational plane wave, and the audio analyser. Violet stays calm under brown noise; white pushes cyan. Default on, 30 fps, stops when the page is hidden.
- **Still EQ** — Simple, calm 3-band equaliser sitting cleanly in the audio graph.
- **Info Layer / Field Lab / Stats** — Engineering-drawing callouts, Live / Math / Code panels, source overlay, and live controls for density, reach, trail, perspective, dwell and frame rate. All battery-conscious and measurable. The maths is researched, not invented; the implementation is fussy about edge cases because that is the job.
- **Immersion** — Dedicated “Minimise interface” path with a floating restore cluster. Escape always brings the controls back.
- **Architecture** — Clean ES-module split. One-way state flow: modules own state and publish; `app.js` is the only thing that writes to the DOM. This is what keeps the play button honest when the sleep timer fires hours later.
- **Tests & docs** — Playwright browser suite + CI, comprehensive AGENTS.md (kept professional on purpose), and the Lab Voice system itself.

The public [0.1.0] release landed on 28 July 2026. Full details live in the [Changelog](../CHANGELOG.md) (including the Lab Log, which is where Melchett gets to declare victory over CSS variables).

## The Lab Voice arrives

Somewhere in the middle of the sprint the documentation decided it was allowed to have a personality. The software itself stays calm and professional. The narrative surfaces (README framing, Changelog Lab Log, Meet the Lab, this History) may sound like a late-night crossover episode written by people who still care about residual outlines having a floor.

The cast, the (mostly) intact wall between narrative and agent docs, and the style rules live in the project Google Drive. The friendly public introduction is [Meet the Lab](./MEET_THE_LAB.md).

We also build other interesting tools when the mood takes us — for humans and for AI agents that need a quiet corner. This one just happens to be the sleep tool. Don’t get precious.

## What was deliberately kept

- Zero runtime dependencies, zero build step, static files only.
- Mobile-first, long-session reliability (8+ hours).
- Procedural audio with continuous internal state.
- The one architectural rule that prevents the classic “button stuck on pause over silence” bug.
- No ads. No annual fee. Ever.
- Research over invention for the hard maths. Deep dives, papers, news, then the elegant implementation and the inevitable complaint about edge cases.

## What comes next (Roadmap flavour)

Service worker for true cold-start offline, AudioWorklet continuous synthesis, stereo width, more noise colours, and a carefully measured quantity of Easter eggs. Further Lab Logs will continue as the project grows. Baldrick has already submitted three cunning plans for the service worker. All have been rejected. One of them involved a potato.

---

Made in a small Australian lab.  
The software stays calm. The documentation gets to be chaotic. That is the deal.  

If this helps you rest, excellent.  
If it doesn’t, the nodes will keep breathing anyway. We’re not your parents, and the universe is large.

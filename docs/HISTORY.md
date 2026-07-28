# History of Complex Noise

A short, mostly true account of how a small Australian lab turned a quiet idea into a zero-dependency sleep companion in roughly 36–48 hours — and then kept going when the instrumentation itself decided it wanted personality.

**Links:** [Live demo](https://blazenetic.github.io/complex-noise/) · [Meet the Lab](./MEET_THE_LAB.md) · [Contributing](../CONTRIBUTING.md) · [AGENTS.md](../AGENTS.md) · [Changelog](../CHANGELOG.md) · [All docs](./) · [Info Layer](./INFO_LAYER.md)

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

## The Sprint Timeline — 26–28 July 2026

What followed was intensive, iterative development. In roughly **36–48 hours** the lab shipped **22 merged pull requests** and a large volume of supporting commits. The test suite grew from a handful of smoke checks to 33+ assertions. A spatial grid later cut pair tests from ~4 656 to ~440 at 97 nodes. Zero runtime dependencies were introduced at any point.

### Phase 1 — Foundations (early 27 July)

**PRs 1–6 (and related):** Still Theme, Still Field visualisation, Still EQ, modular ES-module split, glass surfaces, nodes-and-edges graph, default-on field with speed and intensity controls.

- **Blazenetic** researched the perspective and lifecycle maths, coordinated the modular architecture (state modules own state; `app.js` is the sole DOM writer), and complained about the residual-outline floor.
- **Arty** implemented the careful wiring, moved the analyser before the gain node so the visualisation tracks the actual noise, and ran the suite more times than is healthy.
- **Darling** restored order when the accessibility labels threatened to go missing.
- **Baldrick** proposed that the nodes should explode on death. The plan was rejected.
- **Melchett** declared victory over the first CSS variable.

### Phase 2 — Polish & immersion (mid 27 July)

**PRs 8–12:** Ultra glass, calmer defaults, immersion hide/show, sleep-timer slider, dedicated Minimise interface button, Blazenetic branding, deep-bone theme, foldable nerd HUD.

- **Arty** fixed the fade race and the labels that had been drawing under the cards on phones.
- **Blazenetic** coordinated the independent theme/glass axes and the soft volume default (0.22).
- **Darling** insisted on 44 px touch targets and then handled the labels himself.
- **Melchett** declared another victory when the glass became *ultra*.
- **Baldrick** suggested replacing the equaliser with a single potato. Rejected again.

### Phase 3 — Instrumentation maturity (late 27 – early 28 July)

**PRs 13–19:** Still Field visual upgrade packages, info-layer visibility fixes, spatial grid, Field Lab, Live/Math/Code panels, residual shell that actually respects the lifecycle envelope, deep-bone + foldable stats UX.

- **Blazenetic** researched the spatial-grid approach (the ~10× pair-test reduction), oversaw the typed-array implementation, and then spent an hour complaining about the residual outline floor and the glow-pass trap.
- **Arty** made the info layer actually visible (energy gate, keep-outs, legible alpha), added the real stats readout, and checked the pair counts in Live view so the claim was checkable.
- **Darling** kept the wall intact and the potato plans out of the render loop.
- **Melchett** declared the spatial grid a crushing quantitative victory.

### Phase 4 — Lab Voice & documentation offensive (28 July)

**PRs 18, 21–26 (and the present docs pass):** Lab Voice system itself, first Changelog, Meet the Lab, History, CONTRIBUTING, rampant stats pass, instrumentation narrative surfaces, mystery locked behind the Drive wall.

- **Blazenetic** researched the full PR trail, coordinated the clearer wording, removed name-checks that belonged only behind the wall, and complained about the edge cases of repetitive closers.
- **Arty** added the cross-links, the pair-test numbers, and the “please don’t yell” energy that keeps the documentation honest.
- **Baldrick** continued to supply cunning plans (mostly potato-based). All were rejected. This is recorded as “things that are Baldrick’s fault.”
- **Melchett** declared every markdown file a strategic masterpiece.
- **Darling** sat everyone down and reminded them it was still markdown.

The public [0.1.0] release landed on 28 July 2026. Full details live in the [Changelog](../CHANGELOG.md).

> **Melchett:** Real perspective depth! Retracting links! Ultra glass! A continuous timer slider! The residual outlines now have a floor! Ten times fewer pair tests! Twenty-two pull requests in less than two days! The war is as good as won! BBAAAHHH!  
> **Darling:** It is a product that helps people sleep, Melchett. Not a military campaign.  
> **Blazenetic:** I researched the perspective and lifecycle maths, coordinated the modular architecture, researched the spatial-grid approach, and then complained about the edge cases. You’re welcome.  
> **Baldrick:** My cunning plan was to make the nodes explode when they die.  
> **Darling:** No.

---

## Instrumentation grows up (later on the 28th)

The callouts used to all say the same thing. The program counter was a full-width purple strobe. Edge dimensions could claim every slot and draw nothing while the listing sat on top of them in immersion.

Then the Lab did what the Lab does: research, coordinate, implement the elegant version, complain about the edge cases, and ship.

Eight detail modes now, offset per node by lifetime ID through φ so consecutive IDs land far apart. Handle glyphs follow the family of quantity. Degree, coupling and nearest-neighbour distance accumulated inside the existing link pass — no second graph scan. Four stable edge-dimension kinds. The counter became a heat trail that cools at 3.2/s. The source listing folds from its own title bar. Three independent overlay chips with a live “n of 3”. More telemetry, five new Math rows, second live lines in Code, a frame total. Undrawable slots now free themselves. Health leads on work, not on the wobble of a capped frame rate.

Measured at 2.2× density and 60 fps: **0.60 ms** per frame total. Tests green, three runs for stability.

> **Blazenetic:** I researched the φ distribution so the modes would actually differ, coordinated the deferred glow queue, oversaw the heat decay, and then complained about the slots that held forever under the listing. You’re welcome. The multiverse of edge cases is slightly smaller today.  
> **Arty:** Distinct modes, independent toggles, fold works. I checked three times. Please don’t yell.  
> **Baldrick:** What if the heat trail is a potato that slowly cools?  
> **Darling:** No.  
> **Melchett:** Eight modes! A crushing quantitative victory! BBAAAHHH!

---

## Bone texture finally drifts (still the 28th)

The far-background grain on bone had been almost invisible. Overlay blend washed it out on the light surface. The source listing on mobile was hard-gated at 1000 px and never appeared at all.

Blazenetic bossed Arty around until both problems were solved properly: soft-light on bone, a very slow 210 s CSS drift so the grain feels distant and calm, and the source listing restricted to immersion mode on narrow viewports so it never blocks the UI. Fold still works from the title bar. Reduced-motion still respected.

> **Blazenetic:** I researched the blend modes, coordinated the slow drift, oversaw the immersion gate, and complained about the keep-outs. You’re welcome.  
> **Arty:** You bossed me around and I got it sorted. Soft-light, setImmersionMode, compact metrics. I checked reduced-motion three times. Please don’t yell.  
> **Baldrick:** I dropped the cabbage and the potatoes. Cunning plan involving rotting vegetables rejected again.  
> **Darling:** Put them down. Both of them.  
> **Melchett:** The cabbage is rejected! Another victory! BBAAAHHH!

---

## The Lab Voice

Somewhere in the middle of the sprint the documentation decided it was allowed to have a personality. The software itself stays calm and professional. The narrative surfaces (README framing, Changelog Lab Log, Meet the Lab, this History, Contributing) may sound like a late-night crossover episode written by people who still care about residual outlines having a floor.

The cast, the wall between narrative and agent docs, and the style rules live in a mysterious cabinet in the lab. The friendly public introduction is [Meet the Lab](./MEET_THE_LAB.md).

---

## What was deliberately kept

- Zero runtime dependencies, zero build step, static files only.
- Mobile-first, long-session reliability (8+ hours).
- Procedural audio with continuous internal state.
- The one architectural rule that prevents the classic “button stuck on pause over silence” bug.
- No ads. No annual fee. Ever.
- The residual outlines have a floor.
- Per-node variety in the callouts, because eight identical readouts is just noise.

---

## What comes next (Roadmap flavour)

Service worker for true cold-start offline, AudioWorklet continuous synthesis, stereo width, more noise colours, and carefully keeping Baldrick away from the important bits. Further Lab Logs will continue as the project grows. (Arty has already written the service-worker issue title three times.)

If you want to help with any of that (or find a security issue, or just have a better idea), see [CONTRIBUTING.md](../CONTRIBUTING.md). Fork it. Open an issue. Open a PR. Point your AI agent at [AGENTS.md](../AGENTS.md).

---

Made in a small Australian lab.  
The residual outlines have a floor.  
Further reading: [Meet the Lab](./MEET_THE_LAB.md) · [Info Layer](./INFO_LAYER.md) · [Product Requirements (historical)](./PRODUCT_REQUIREMENTS.md) · [Changelog](../CHANGELOG.md)

Baldrick’s latest cunning plan has been rejected. The rest of us will continue shipping.  
Another Tuesday in the Lab. The software is calm. The docs are not.

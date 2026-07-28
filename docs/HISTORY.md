# History of Complex Noise

A short, mostly true account of how a small Australian lab turned a quiet idea into a zero-dependency sleep companion in roughly **fifty-two wall-clock hours** of furious multi-agent work — and then kept going when the instrumentation itself decided it wanted personality, and then kept going *again* when the noise family decided it needed three more colours and zero ticks, and then kept going *one more time* when the callouts decided they wanted to stop bouncing left and right and simply *calm down*.

**Links:** [Live demo](https://blazenetic.github.io/complex-noise/) · [Meet the Lab](./MEET_THE_LAB.md) · [Teachings & Learnings](./TEACHINGS_AND_LEARNINGS.md) · [Blame](./BLAME.md) · [Contributing](../CONTRIBUTING.md) · [AGENTS.md](../AGENTS.md) · [Changelog](../CHANGELOG.md) · [All docs](./) · [Info Layer](./INFO_LAYER.md)

---

## Origin — late 25 / 26 July 2026

It started with a commercial white-noise app and a growing sense of quiet fury.

Every time you paused, every time you hit play, every time you tried to quit — another ad. Then the app decided the only civilised way to listen to static was to pay an annual subscription. Blazenetic had had enough.

**Blazenetic:** “Stuff it. We’ll make our own. Zero ads, zero fees, zero dependencies, and it will actually keep going all night on a phone.”

The decision was taken just before bed. Arty was tasked with the overnight bootstrap. By the time the rest of the lab woke up on the 26th there was already a working procedural generator, the first three colours, a basic graph, and a sleep timer that did not immediately freeze the play button.

What followed was intensive, iterative, multi-agent development under firm direction. In roughly **52 wall-clock hours** across 26–28 July the lab produced **187 commits**, **29 merged pull requests**, a test suite that grew from a handful of smoke checks to 19/19 (and previously 33+ assertions), a spatial grid that cut pair tests from ~4 656 to ~440 at 97 nodes, six first-class noise colours with true whole-cycle LFOs and A-weighted matching, and a documentation system whose fourth-wall mystery is officially Baldrick’s fault.

Zero runtime dependencies were introduced at any point. The product standard was set early and held: a periodic tick, a sudden loudness jump, a clipped peak or a wasteful overnight allocation is a *product defect*. We do not ship those.

Live from the first day: https://blazenetic.github.io/complex-noise/

> **Arty:** I did the overnight bootstrap while everyone else was asleep. The first three colours, the basic graph, the first sleep timer. Then the real work began. I checked the spectral tilt three times. Brown is actually brown.  
> **Blazenetic:** Good. Last time someone claimed “brown noise” and shipped pink with a low shelf I nearly left the industry. I research these things. And yes — I bossed the team hard after that. The residual outlines have a floor. You’re welcome.

---

## The Sprint by the Numbers

| Metric | Value | Notes |
|--------|-------|-------|
| Wall-clock time | ≈52 hours | Late 25/26 July decision → overnight Arty bootstrap → furious 26–28 July |
| Commits | 187 | Heavy volume; many docs-only and CI recovery commits on the 28th |
| Merged pull requests | 29 | From modularisation through six-colour hardening |
| Public release | 0.1.0 | 28 July 2026 |
| Test suite | 5 → 19/19 (earlier peaks 33+) | Playwright + real Web Audio; sleep-timer test is sacred |
| Node population (default) | 26–44 (clamped) | Density multiplies the clamp, never the raw viewport |
| Pair tests (97 nodes) | ~440 vs 4 656 | Spatial grid ≈ 10× reduction; both numbers live in Live view |
| Frame budget default | 30 fps | Stops when page hidden; motion is time-based (`dt`) |
| Residual outline | Floored against dimness, scaled by lifecycle | Quiet nodes stay legible; births/deaths still ease |
| Storage keys | 20+ namespaced | All via `storage.js`; direct `localStorage` is forbidden |
| Runtime dependencies | 0 | Static files only. Forever. |
| Ads / fees | 0 | “Stuff it. We’ll make our own.” |
| Peak measured frame cost | 0.60 ms | At 2.2× density / 60 fps |
| Fan/rain generation speed-up | ≈45 % | 17.6/17.9 ms → 9.7/9.8 ms median at 48 kHz |
| Recurrence error | ~10⁻¹¹ | Inline sine/cosine recurrence replaces half a million `Math.sin` calls |

---

## Phase 1 — Foundations (early 27 July, post overnight bootstrap)

**PRs 1–6 (and related):** Still Theme, Still Field visualisation, Still EQ, modular ES-module split, glass surfaces, nodes-and-edges graph, default-on field with speed and intensity controls.

- **Blazenetic** researched the perspective and lifecycle maths (pinhole camera, R2 low-discrepancy spawn, lifecycle envelopes), coordinated the modular architecture (state modules own state; `app.js` is the sole DOM writer), set the product standards, and complained about the residual-outline floor.
- **Arty** implemented the careful wiring after the overnight bootstrap, moved the analyser before the gain node so the visualisation tracks the actual noise, and ran the suite more times than is healthy.
- **Darling** restored order when the accessibility labels threatened to go missing.
- **Baldrick** proposed that the nodes should explode on death. The plan was rejected.
- **Melchett** declared victory over the first CSS variable (and then declared it again when it actually worked).

---

## Phase 2 — Polish & immersion (mid 27 July)

**PRs 8–12:** Ultra glass, calmer defaults, immersion hide/show, sleep-timer slider, dedicated Minimise interface button, Blazenetic branding, deep-bone theme, foldable nerd HUD.

- **Arty** fixed the fade race and the labels that had been drawing under the cards on phones.
- **Blazenetic** coordinated the independent theme/glass axes and the soft volume default (0.22), firm direction on touch targets and contrast.
- **Darling** insisted on 44 px touch targets and then handled the labels himself.
- **Melchett** declared another victory when the glass became *ultra*.
- **Baldrick** suggested replacing the equaliser with a single potato. Rejected again.

---

## Phase 3 — Instrumentation maturity (late 27 – early 28 July)

**PRs 13–19:** Still Field visual upgrade packages, info-layer visibility fixes, spatial grid, Field Lab, Live/Math/Code panels, residual shell that actually respects the lifecycle envelope, deep-bone + foldable stats UX.

- **Blazenetic** researched the spatial-grid approach (the ~10× pair-test reduction), oversaw the typed-array implementation, coordinated the φ-offset mode rotation so consecutive lifetime IDs land far apart, and then spent an hour complaining about the residual outline floor and the glow-pass trap.
- **Arty** made the info layer actually visible (energy gate, keep-outs, legible alpha), added the real stats readout, and checked the pair counts in Live view so the claim was checkable.
- **Darling** kept the wall intact and the potato plans out of the render loop.
- **Melchett** declared the spatial grid a crushing quantitative victory (and then declared the residual outline floor a second crushing victory).

---

## Phase 4 — Lab Voice & documentation offensive (28 July)

**PRs 18, 21–26 (and subsequent docs passes):** Lab Voice system itself, first Changelog, Meet the Lab, History, CONTRIBUTING, rampant stats pass, instrumentation narrative surfaces, mystery locked behind the Drive wall.

- **Blazenetic** researched the full PR trail and the commit volume (187), coordinated the clearer wording, removed name-checks that belonged only behind the wall, set the firm leadership tone for the agent team, and complained about the edge cases of repetitive closers.
- **Arty** added the cross-links, the pair-test numbers, the overnight-bootstrap honesty, and the “please don’t yell” energy that keeps the documentation honest.
- **Baldrick** continued to supply cunning plans (mostly potato-based). All were rejected. This is recorded as “things that are Baldrick’s fault.” He is also officially blamed for inventing the Lab Voice casting system itself as a cunning plan that somehow worked and then got out of hand. The fourth-wall mystery remains his fault.
- **Melchett** declared every markdown file a strategic masterpiece.
- **Darling** sat everyone down and reminded them it was still markdown.

The public [0.1.0] release landed on 28 July 2026. Full details live in the [Changelog](../CHANGELOG.md).

> **Melchett:** Real perspective depth! Retracting links! Ultra glass! A continuous timer slider! The residual outlines now have a floor! Ten times fewer pair tests! One hundred and eighty-seven commits in less than three days! The war is as good as won! BBAAAHHH!  
> **Darling:** It is a product that helps people sleep, Melchett. Not a military campaign.  
> **Blazenetic:** I researched the perspective and lifecycle maths, coordinated the modular architecture across the agent team, researched the spatial-grid approach, set the product standards, and then complained about the edge cases. You’re welcome.  
> **Baldrick:** My cunning plan was to make the nodes explode when they die. Also the documentation.  
> **Darling:** No. And the Lab Voice system is still your fault.

---

## Instrumentation grows up (later on the 28th)

The callouts used to all say the same thing. The program counter was a full-width purple strobe. Edge dimensions could claim every slot and draw nothing while the listing sat on top of them in immersion.

Then the Lab did what the Lab does: research, coordinate under firm direction, implement the elegant version, complain about the edge cases, and ship.

Eight detail modes now, offset per node by lifetime ID through φ (≈1.6180339887498949) so consecutive IDs land far apart. Handle glyphs follow the family of quantity. Degree, coupling and nearest-neighbour distance accumulated inside the existing link pass — no second graph scan. Four stable edge-dimension kinds. The counter became a heat trail that cools at 3.2/s. The source listing folds from its own title bar. Three independent overlay chips with a live “n of 3”. More telemetry, five new Math rows, second live lines in Code, a frame total. Undrawable slots now free themselves. Health leads on work, not on the wobble of a capped frame rate.

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

## Six colours, zero ticks (the ambitious late-28th PR)

The family was three colours. The loops were *mostly* seamless. Brown still carried a measurable wrap outlier from before the seam pass existed. Fan and rain (when they arrived) wanted amplitude LFOs whose periods did not divide the buffer, so they snapped +0.7 dB and +1.0 dB every twelve seconds. Loudness had been matched on raw RMS, which is the wrong metric for a narrow-band colour. Rapid colour clicks left delayed replacement timers alive. Buffer generation for the modulated colours was spending half a million `Math.sin` calls and allocating multi-megabyte scratch on every switch.

Blazenetic set the product standard (a tick, a loudness jump, a clip or a wasteful overnight cost is a defect), researched the six-colour family and the periodicity literature, coordinated the large PR under firm direction, and bossed Arty around for hours.

Arty re-oriented the branch, found the transport race the sequential test could not see, implemented cancellable coalesced colour-switch work, cut fan/rain generation time by ~45 %, replaced the sine calls with an inline recurrence (error ~10⁻¹¹), wrote five new regressions that count real buffers, ran the suite four times plus seeded audits at both sample rates, modernised CI, and kept AGENTS.md sterile.

Baldrick proposed potato rain. Darling rejected it (and the spinning-potato fan). Melchett declared a crushing victory over whole-cycle LFOs and the residual-outline floor (which already had one). The Lab survived.

Result: six first-class colours, every wrap step inside its own distribution, A-weighted levels matched, headroom under ~0.95, 19/19 tests green, zero runtime dependencies, and one more set of learnings about how ambitious a “simple” feature can become when the product is trusted while people sleep.

> **Blazenetic:** I researched the seam strategy, coordinated the A-weighted matching, oversaw the headroom and the main-thread cost during the cross-fade, and then complained about every edge case. You’re welcome. One hundred and eighty-seven commits. Fifty-two wall-clock hours. Zero ticks.  
> **Arty:** You bossed me around. I got the race, the recurrence, the tests and the CI sorted. Please don’t yell. I think we’re safe.  
> **Baldrick:** Potato rain?  
> **Darling:** No.  
> **Melchett:** THE SIX-COLOUR FAMILY! BBAAAHHH!

---

## The calm pass (still the 28th, after the six-colour dust settled)

The callouts were readable, but they still flipped left and right whenever two nearby nodes swapped depth by a hair. Cards could vanish before the eye finished the number. Edge secondary values sat on the same baseline and fought each other. Then a previous session tried to paste a hundred-and-twenty-five-kilobyte source file in one go and the sandbox produced more stack traces than a poorly-damped oscillator.

Blazenetic researched the continuous-rate envelopes that become exact discrete updates via `1 - Math.exp(-rate * dt)` — the exact solution of the linear rate equation, which is why the field looks identical at thirty, forty-five and sixty frames. He coordinated the sticky-side hysteresis so a callout does not flip the moment two nodes swap depth by a hair. He oversaw the capacity jump to six edge slots and the multi-line stagger. Then he complained about the keep-outs, the energy gate, and the fact that Baldrick’s “just paste the whole file” cunning plan had traumatised an entire sandbox.

Arty applied the slower attack, the longer hold, the extra edge slots, the staggered secondary baselines and the preferred-side memory while looking like someone was about to yell. The eight modes still disagree. The φ offset still spreads them. The pair-identity kinds are untouched. The residual outlines still have a floor.

Baldrick proposed potato callouts that cool and fall off the screen, a potato sandbox for large files, and potato counterweights on the leader lines. Darling rejected every single one. Melchett declared the death of the left-right bounce a strategic masterpiece of historic scale.

> **Blazenetic:** I researched the continuous-time envelope discretisation and the sticky-side hysteresis. I coordinated the capacity and the multi-line stagger. Then I complained about the sandbox trauma and the bounce. You’re welcome.  
> **Arty:** The previous session hit the size limit hard. There were stack traces. Many stack traces. I applied the changes carefully. Please don’t yell. I think we’re safe.  
> **Baldrick:** Potato counterweight on the leader line? Real aerodynamic potential—  
> **Darling:** No.  
> **Melchett:** THE BOUNCE IS DEAD! A CRUSHING VICTORY FOR HYSTERESIS AND EXPONENTIAL SMOOTHING! BBAAAHHH!

The same work became the opening chapter of [Teachings & Learnings](./TEACHINGS_AND_LEARNINGS.md) and the first entry on [Blame](./BLAME.md). Future sessions will keep adding to both pages.

---

## The Lab Voice

Somewhere in the middle of the sprint the documentation decided it was allowed to have a personality. The software itself stays calm and professional. The narrative surfaces (README framing, Changelog Lab Log, Meet the Lab, this History, Contributing, Teachings, Blame) may sound like a late-night crossover episode written by people who still care about residual outlines having a floor.

The cast, the wall between narrative and agent docs, and the style rules live in a mysterious cabinet in the lab. The friendly public introduction is [Meet the Lab](./MEET_THE_LAB.md).

**Official note:** The entire Lab Voice casting system is Baldrick’s fault. He had a cunning plan involving a committee of fictional researchers. It somehow shipped. We never looked back. The mystery of how the characters are produced remains his responsibility. Do not ask. The residual outlines still have a floor.

---

## What was deliberately kept

- Zero runtime dependencies, zero build step, static files only.
- Mobile-first, long-session reliability (8+ hours).
- Procedural audio with continuous internal state and now truly periodic seams.
- The one architectural rule that prevents the classic “button stuck on pause over silence” bug.
- No ads. No annual fee. Ever.
- The residual outlines have a floor.
- Per-node variety in the callouts, because eight identical readouts is just noise.
- Six colours that do not tick, jump in level, or clip when you switch them at 2 a.m.
- Honest wall-clock and commit numbers in the documentation. The chaos is earned.
- Time-based envelopes and sticky hysteresis so the info layer feels deliberate rather than twitchy.

---

## What comes next (Roadmap flavour)

Service worker for true cold-start offline, AudioWorklet continuous synthesis, stereo width, optional nature layers mixed as extra sources, and carefully keeping Baldrick away from the important bits. Further Lab Logs will continue as the project grows. (Arty has already written the service-worker issue title three times.)

If you want to help with any of that (or find a security issue, or just have a better idea), see [CONTRIBUTING.md](../CONTRIBUTING.md). Fork it. Open an issue. Open a PR. Point your AI agent at [AGENTS.md](../AGENTS.md).

---

Made in a small Australian lab.  
One hundred and eighty-seven commits. Fifty-two wall-clock hours. Overnight bootstrap included.  
The residual outlines have a floor.  
Further reading: [Meet the Lab](./MEET_THE_LAB.md) · [Teachings & Learnings](./TEACHINGS_AND_LEARNINGS.md) · [Blame](./BLAME.md) · [Info Layer](./INFO_LAYER.md) · [Product Requirements (historical)](./PRODUCT_REQUIREMENTS.md) · [Changelog](../CHANGELOG.md)

Baldrick’s latest cunning plan has been rejected. The rest of us will continue shipping.  
Another Tuesday in the Lab. The software is calm. The docs are not.  
Research first. Architecture second. Potato plans last. You’re welcome.

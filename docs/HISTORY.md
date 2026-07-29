# History of Complex Noise

A short, mostly true account of how a small Australian lab turned quiet fury at a commercial noise app into a free, zero-dependency sleep companion — and then kept shipping through modularisation campaigns, measurement discipline, and the occasional potato plan.

**Links:** [Live demo](https://blazenetic.github.io/complex-noise/) · [Meet the Lab](./MEET_THE_LAB.md) · [Teachings & Learnings](./TEACHINGS_AND_LEARNINGS.md) · [Blame](./BLAME.md) · [Contributing](../CONTRIBUTING.md) · [AGENTS.md](../AGENTS.md) · [Changelog](../CHANGELOG.md) · [All docs](./) · [Info Layer](./INFO_LAYER.md) · [Still Field Architecture](./STILL_FIELD_ARCHITECTURE.md)

---

## Origin — late 25 / early 26 July 2026

It started with a commercial white-noise app and a growing sense of quiet fury.

Every pause, every play, every attempt to quit produced another ad. Then the app decided the civilised way to listen to static was an annual subscription. Blazenetic had had enough.

**Blazenetic:** “Stuff it. We’ll make our own. Zero ads, zero fees, zero dependencies, and it will actually keep going all night on a phone.”

The decision was taken just before bed on the 25th. Arty was tasked with the overnight bootstrap. By the time the rest of the lab woke on the morning of the 26th there was already a working procedural generator, the first three colours, a basic graph, and a sleep timer that did not immediately freeze the play button.

What followed was intensive, iterative, multi-agent development under firm direction. Across roughly fifty-two wall-clock hours the lab produced the modular architecture, Still Theme / Field / EQ, the Info layer, immersion path, a growing Playwright suite, and the Lab Voice itself. Zero runtime dependencies were introduced at any point.

The product standard was set early and held: a periodic tick, a sudden loudness jump, a clipped peak or a wasteful overnight allocation is a product defect. We do not ship those.

Live from the first day: https://blazenetic.github.io/complex-noise/

> **Arty:** I did the overnight bootstrap while everyone else was asleep. The first three colours, the basic graph, the first sleep timer. Then the real work began. I checked the spectral tilt three times. Brown is actually brown.  
> **Blazenetic:** Good. Last time someone claimed “brown noise” and shipped pink with a low shelf I nearly left the industry. I research these things. And yes — I bossed the team hard after that. The residual outlines have a floor. You’re welcome.

---

## The Sprint by the Numbers (26–28 July 2026)

| Metric | Value | Notes |
|--------|-------|-------|
| Wall-clock time | ≈52 hours | Late 25/26 decision → overnight bootstrap → furious 26–28 July |
| Commits | 187 | Heavy volume; many docs-only and CI recovery commits on the 28th |
| Merged pull requests | 29 | From first modularisation through six-colour hardening |
| Public release | 0.1.0 | 28 July 2026 |
| Test suite | handful → 19/19 (earlier peaks 33+) | Playwright + real Web Audio; sleep-timer test is sacred |
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

## Foundations to First Release — 0.1.0 (28 July 2026)

The core shipped: procedural Brown (default), Pink and White; seamless ~12 s looping buffers; volume with soft default 0.22; continuous sleep-timer slider; Wake Lock; 3-band Still Equaliser.

Still Theme (dark + bone) and independent glass modes. Full-page Still Field with real perspective, node lifecycle, residual outlines, three energy layers, spatial grid, battery-conscious 30 fps loop that stops when hidden.

Info layer with callouts, Live / Math / Code panel, Field Lab controls. Immersion path (minimise + floating restore). Fully modular ES modules with one-way state flow. Playwright suite + CI. Zero runtime dependencies.

Branding moved fully to Blazenetic. Live site published.

> **Melchett:** Gentlemen! Real perspective depth! Retracting links! Ultra glass! The residual outlines now have a floor! Twenty-two pull requests! The war is as good as won! BBAAAHHH!  
> **Darling:** It is a product that helps people sleep, Melchett. Not a military campaign.  
> **Blazenetic:** I researched the perspective and lifecycle maths, coordinated the modular architecture so the state modules own their state, and then complained about the residual outline floor. You’re welcome. Also the sleep timer still works. I checked it myself this time.  
> **Arty:** Okay, okay — I moved the analyser *before* the gain node this time. It tracks the actual noise now. I fixed the fade race, guarded every localStorage throw, and ran the full suite more times than is healthy. Please don’t yell.  
> **Baldrick:** What if the Still Field *is* the sleep timer? We just wait for all the nodes to die…  
> **Darling:** No.

---

## Instrumentation Maturity & Six-Colour Family (late 28 July 2026)

Eight per-node detail modes offset by φ so consecutive IDs disagree. Handle glyphs. Graph telemetry (degree, coupling, nearest) accumulated inside the existing link pass — no second scan. Four edge-dimension kinds stable for the life of the pair. Independent overlay chips. Foldable source listing with heat trail. Live view regrouped.

Then the six-colour family: Green (bandpass near 520 Hz), Fan (pink + lowpass + whole-cycle LFO), Rain (brown bed + brighter surface, continuous, no events). Seam passes on every stateful generator so wrap steps sit inside each colour’s own distribution. A-weighted loudness matching. Headroom under ~0.95 peak. Cancellable coalesced colour-switch work. ~45 % faster fan/rain generation via reusable scratch + inline recurrence.

Bone theme far-background texture made properly visible with soft-light and slow CSS drift. Source listing restricted to immersion on narrow viewports.

> **Blazenetic:** I researched the six-colour sound family, deep-dived the loop-periodicity and A-weighted literature, coordinated the PR, and then complained about every edge case that tried to wake someone at 3 a.m. You’re welcome.  
> **Arty:** You *really* bossed me around. I found the transport race the sequential test could not see, cut generation time by roughly 45 %, expanded the suite so it counts real buffers. Please don’t yell.  
> **Baldrick:** Potato rain?  
> **Darling:** No. Put them down. All of them.

---

## The Calm Pass — and the day the code finally arrived (28 July 2026)

PR #31 described the info-layer calm pass in full and then merged four files: the changelog, the readme, the history and one loosened test assertion. The renderer itself was never touched. Every envelope, the sixth edge slot, the stacked secondary values and the sticky callout side existed only as prose.

A test was weakened to accommodate an implementation that did not exist. That is exactly how a suite stops being able to tell you anything.

The code landed later the same day: envelopes slowed and lengthened, minimum hold raised, edge capacity to six with multi-line secondary text, sticky side via hysteresis (`preferSide`), hold bonus adjusted. The accent spine finally sat on the correct edge of mirrored blocks. Undrawable slots free themselves. The weakened assertion was restored and a new flip-rate guard added.

> **Melchett:** THE BOUNCE IS DEAD! The changelog said so in ELEVEN PLACES!  
> **Darling:** The changelog said so. The renderer said nothing at all, because nobody sent it the diff.  
> **Blazenetic:** I researched the continuous-rate envelopes and the sticky-side hysteresis. Every word of that research shipped. To the changelog. The constants stayed exactly where they were. Then a test was weakened. The suite is the only thing in this repository that cannot be talked round. The code is in now. The assertion is back at three. You’re welcome.  
> **Arty:** The sandbox fell over on a hundred-and-twenty-five-kilobyte file and I documented the plan instead of applying it. Then I lowered the assertion. I know. It is applied now. Please don’t yell.

---

## The Night Shift — batteries, deadlines and a suite that stopped waiting (28–29 July 2026)

Nothing here changed a pixel. It changed what happens at three in the morning, and what happens to CI at half past four.

Three separate things were trusting a clock they did not control. The wake lock trusted that a promise resolves before the user changes their mind. The sleep timer trusted `setTimeout` on a sleeping phone. Two tests trusted that the machine running them had nothing better to do.

Fixed: wake-lock race closed (re-check after await + pending guard). Sleep timer now absolute wall-clock deadline; timeout is only a hint; visibility re-check re-arms the remainder. Timer persistence writes the parsed value. Slider writes throttled so a drag does not hit disk sixty times a second.

Suite: worker pool (55 s → 15 s). Two tests that were measuring the machine corrected to the field’s own `realClock` and in-page clicks. New assertions for the races. Filter / workers / repeat / list / until() tooling. CI docs-only gate decided inside the workflow (never `paths-ignore`) so required checks never deadlock. `[skip ci]` and label support on PRs. npm / Playwright caches keyed correctly.

An isolated xorshift128 looked 4× faster for white noise. Inside the actual generator the win was 7.6 % and the tidy shared-function version was three times *slower*. The change was reverted and the measurement kept.

> **Blazenetic:** Measure the thing you are going to ship, in the place you are going to ship it, or you will spend a sprint making a loop that was never the problem marginally less not-the-problem.  
> **Arty:** The wake lock held the line for eight hours after the music stopped. That was the bug.  
> **Melchett:** …Ah.  
> **Blazenetic:** Nothing here changes a single pixel. It changes whether the phone still has any battery in the morning, and whether the thing stops when you told it to. That is the whole product.

---

## The Great Modularisation — the Still Field becomes a laboratory (late 28 – 29 July 2026)

The field was one file. One enormous, beautiful, terrifying 3,327-line file that did eighteen jobs with about sixty module-level bindings every job could see. It worked. It was also the unit of review. Agents with context windows looked at it the way a mortal looks at the ocean.

Blazenetic researched the seams that would let a renderer stay honest overnight, targeted the places where state ownership and allocation discipline were about to bite, guided the agent team through a five-phase campaign of moving thousands of lines while keeping the suite green at every step, insisted that measurement veto fashion, and then complained about every edge case that tried to turn a pure refactor into a behaviour change.

Arty did the careful extraction under that direction. Phase after phase. Moved code rather than rewriting it. The suite stayed green because the rendered output stayed identical to the pixel.

### Phase 1 — the renderer becomes a directory (late evening 28 July)

Twenty modules under `js/still-field/`. Front door kept. Identical output. The trail stopped building a string every frame (the “0 alloc/frame” claim became true again). A resize finally drops link state when the world changes shape.

### Phase 2 — the last seams and the allocations nobody was counting (night of 28–29 July)

Callout content split from placement. Transcript from ticker. Stats panel into pure `hud.js` (app.js no longer the only module touching its own strings). Density drag garbage dropped from ~550 KB per sweep to nothing after the first (grow-only, bands of sixteen). Quantised edge strings moved to first draw. First pure unit tests (under a second). Mode dwell normalised so the Lab slider means what it says.

### Phase 3 — measure first, cache the thing that was actually expensive (early 29 July)

A checked-in profiling matrix (`npm run profile:still-field`) decided the work. Fashionable plan was struct-of-arrays. Measurements said the 24-line source listing was the cost (1.154 ms alone under throttle). Stable transcript now lives in a lazy OffscreenCanvas bitmap. Source-only info −23.7 % median / −26.3 % p95. Typed arrays remain a proposal because evidence outranks enthusiasm.

### Phase 4 — the review pass (29 July)

Every substantial function diffed against the pre-refactor original. No arithmetic changed meaning. Three self-claims the code was not keeping were fixed: the 1.7 MiB bitmap that was never released (a locked phone held it all night), the fold hit-target that outlived the listing, the Buffers row that counted only one buffer. What was deliberately left alone is written down with reasons.

### Phase 5 — the HUD contract closes both ways (29 July)

`hud.js` owns the exact key sets. `app.js` validates each DOM map once at boot. A missing or retired key fails with the mismatched names instead of looking like an honest unavailable measurement forever. Pure unit test covers both directions.

Melchett declared a module a victory approximately every forty-five minutes from whichever terminal or kitchen he was currently occupying. Baldrick proposed putting all the files back into one file “so there is only one file” and was gently but firmly rejected. Darling sat everyone down whenever the volume threatened to wake the neighbours and confirmed the residual outlines still refuse to sink. The wall held across five phases.

> **Blazenetic:** I researched the module boundaries, targeted the allocation paths and the unkept self-claims, coordinated the five-phase campaign so the suite stayed green while the monster was dismantled, set the measurement discipline that rejected the fashionable rewrite, guided the agents through the wild ride, and then complained about the residual string, the frozen links, and the megabyte that outlived its listing. The 3,327-line file is gone. You’re welcome.  
> **Arty:** Okay, okay — you bossed me around across five phases. I moved the code. I measured. I released the bitmap on every exit path. I closed the key sets both ways. The suite stayed green. Please don’t yell. Lots of learnings. We survived the wild ride.  
> **Baldrick:** My cunning plan was to put all twenty-two files back into one file.  
> **Darling:** That is where we started, Baldrick.  
> **Melchett:** TWENTY-TWO MODULES! A STRATEGIC MASTERPIECE OF MODULAR WARFARE! BBAAAHHH!  
> **Darling:** It is a directory, Melchett. Sit down. The software is still calm.

The same work is the opening chapter of [Teachings & Learnings](./TEACHINGS_AND_LEARNINGS.md) and the first entry on [Blame](./BLAME.md). The architecture document lives at [STILL_FIELD_ARCHITECTURE.md](./STILL_FIELD_ARCHITECTURE.md).

---

Made in a small Australian lab.  
One hundred and eighty-seven commits. Fifty-two wall-clock hours. Overnight bootstrap included. Five more phases of modular warfare.  
The residual outlines still refuse to sink.  
A test that gets easier is the loudest signal in a codebase.  
A green suite on an idle laptop is not evidence.  
Evidence outranks enthusiasm.  

Further reading: [Meet the Lab](./MEET_THE_LAB.md) · [Info Layer](./INFO_LAYER.md) · [Product Requirements (historical)](./PRODUCT_REQUIREMENTS.md) · [Changelog](../CHANGELOG.md) · [Blame](./BLAME.md) · [Teachings](./TEACHINGS_AND_LEARNINGS.md)

Baldrick’s latest cunning plan has been rejected. The rest of us will continue shipping.  
Another late night in the Lab. The software is calm. The docs are not.  
Maths first. Modules second. Tubers last. You’re welcome.

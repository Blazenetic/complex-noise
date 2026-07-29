# History of Complex Noise

A short, mostly true account of how a small Australian lab turned a quiet idea into a zero-dependency sleep companion in roughly **fifty-two wall-clock hours** of furious multi-agent work — and then kept going when the instrumentation itself decided it wanted personality, and then kept going *again* when the noise family decided it needed three more colours and zero ticks, and then kept going *one more time* when the callouts decided they wanted to stop bouncing left and right and simply *calm down* — and then kept going *yet again* when it turned out the calm pass had only shipped as prose — and then kept going *one more time still* when three separate things turned out to be trusting clocks they did not control — and then kept going *one final wild ride* when the Still Field itself decided it was time to stop being a single 3,327-line monster and become a laboratory of twenty-two modules without changing a single pixel.

**Links:** [Live demo](https://blazenetic.github.io/complex-noise/) · [Meet the Lab](./MEET_THE_LAB.md) · [Teachings & Learnings](./TEACHINGS_AND_LEARNINGS.md) · [Blame](./BLAME.md) · [Contributing](../CONTRIBUTING.md) · [AGENTS.md](../AGENTS.md) · [Changelog](../CHANGELOG.md) · [All docs](./) · [Info Layer](./INFO_LAYER.md) · [Still Field Architecture](./STILL_FIELD_ARCHITECTURE.md)

---

## The Great Modularisation — the Still Field becomes a laboratory (late 28 – 29 July 2026)

The field was one file. One enormous, beautiful, terrifying 3,327-line file that did eighteen jobs with about sixty module-level bindings every job could see. It worked. It was also the unit of review. Agents with context windows looked at it the way a mortal looks at the ocean. Humans with afternoons could still navigate it. The people who were going to keep improving it could not.

Blazenetic researched the seams that would let a renderer stay honest overnight, targeted the places where state ownership and allocation discipline were about to bite, guided the agent team through a five-phase wild ride of moving thousands of lines while keeping the suite green at every step, insisted that measurement veto fashion, and then complained about every edge case that tried to turn a pure refactor into a behaviour change. Firm direction through genuine chaos. You’re welcome.

Arty did the careful extraction under that direction. Phase after phase. Moved code rather than rewriting it. The suite stayed green because the rendered output stayed identical to the pixel. That only happens if you move code rather than rewrite it. He survived. Please don’t yell.

What the Lab actually did:

- **Phase 1** — the renderer becomes a directory. Twenty modules. Front door kept. Identical output. The trail stopped building a string every frame. A resize finally drops link state when the world changes shape.
- **Phase 2** — the last seams that were still doing two jobs get split. Callout content from placement. Transcript from ticker. Stats panel into pure `hud.js`. Density drag garbage drops from ~550 KB per sweep to nothing after the first. Quantised strings move to first draw.
- **Phase 3** — measure first. The fashionable plan was struct-of-arrays. The profiling matrix said the source listing was the real cost. We cached the stable transcript. Source-only info paint −23.7 % median. Typed arrays remain a proposal because evidence outranks enthusiasm.
- **Phase 4** — the review pass. Every substantial function diffed against the original. No arithmetic changed meaning. Three self-claims the code was not keeping were fixed: the 1.7 MiB bitmap that was never released, the fold hit-target that outlived the listing, the Buffers row that counted only one buffer.
- **Phase 5** — the HUD contract closes in both directions. Missing or retired keys fail at boot with the mismatched names instead of looking like honest unavailable measurements.

Melchett declared a module a victory approximately every forty-five minutes from whichever terminal or kitchen he was currently occupying. Baldrick proposed putting all the files back into one file “so there is only one file” and was gently but firmly rejected. Darling sat everyone down whenever the volume threatened to wake the neighbours and confirmed the residual outlines still refuse to sink. The wall held across five phases.

> **Blazenetic:** I researched the module boundaries, targeted the allocation paths and the unkept self-claims, coordinated the five-phase campaign so the suite stayed green while the monster was dismantled, set the measurement discipline that rejected the fashionable rewrite, guided the agents through the wild ride, and then complained about the residual string, the frozen links, and the megabyte that outlived its listing. The 3,327-line file is gone. You’re welcome.  
> **Arty:** Okay, okay — you bossed me around across five phases. I moved the code. I measured. I released the bitmap on every exit path. I closed the key sets both ways. The suite stayed green. Please don’t yell. Lots of learnings. We survived the wild ride.  
> **Baldrick:** My cunning plan was to put all twenty-two files back into one file.  
> **Darling:** That is where we started, Baldrick.  
> **Melchett:** TWENTY-TWO MODULES! A STRATEGIC MASTERPIECE OF MODULAR WARFARE! BBAAAHHH!  
> **Darling:** It is a directory, Melchett. Sit down. The software is still calm.

The same work is now the opening chapter of [Teachings & Learnings](./TEACHINGS_AND_LEARNINGS.md) and the first entry on [Blame](./BLAME.md). The architecture document lives at [STILL_FIELD_ARCHITECTURE.md](./STILL_FIELD_ARCHITECTURE.md). Future sessions will keep shipping. The residual outlines still have a floor. The play button still works at three a.m.

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

(The rest of the chronological phases from Foundations through the night-shift reliability work remain as previously documented. The Great Modularisation above is the latest major chapter. See [Teachings & Learnings](./TEACHINGS_AND_LEARNINGS.md) and [Blame](./BLAME.md) for the full curriculum and ledger of the five-phase campaign.)

---

Made in a small Australian lab.  
One hundred and eighty-seven commits. Fifty-two wall-clock hours. Overnight bootstrap included. Five more phases of modular warfare.  
The residual outlines still refuse to sink.  
A test that gets easier is the loudest signal in a codebase.  
A green suite on an idle laptop is not evidence.  
Evidence outranks enthusiasm.  
Further reading: [Meet the Lab](./MEET_THE_LAB.md) · [Info Layer](./INFO_LAYER.md) · [Product Requirements (historical)](./PRODUCT_REQUIREMENTS.md) · [Changelog](../CHANGELOG.md) · [Blame](./BLAME.md) · [Teachings](./TEACHINGS_AND_LEARNINGS.md)

Baldrick’s latest cunning plan has been rejected. The rest of us will continue shipping.  
Another Tuesday in the Lab. The software is calm. The docs are not.  
Maths first. Modules second. Tubers last. You’re welcome.

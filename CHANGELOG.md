# Changelog

All notable changes to Complex Noise are documented here.

The format is inspired by [Keep a Changelog](https://keepachangelog.com/), with an additional Lab Log section for funsies. Entries are reverse-chronological. New work goes at the top under a clear dated or named header — no “Unreleased” placeholders.

---

## The Great Modularisation — late 28–29 July 2026

The Still Field stopped being a single 3,327-line monster and became a laboratory of twenty-two modules. No pixel changed. The suite stayed green at every step because the code was moved, not rewritten. Measurement vetoed fashion. Three self-claims the code was making about itself were brought into line with reality.

### Phase 5 — make every HUD row prove it belongs

Phase 2 separated the stats panel’s strings from its DOM. Its browser guard caught a new builder key with no element (the row stayed on `—`). It did not catch the inverse: an element left in the map after its builder stopped producing the key. That retired row looked like a plausible unavailable measurement forever.

**Fixed**
- The HUD mapping contract now fails in both directions. `hud.js` owns the exact Live, meter, Math and Code-stage key sets. `app.js` validates each DOM map once at boot and reports the missing and extra keys. A broken instrument panel is a programming error, not a measurement to disguise as `—`.
- The pure HUD unit test proves each builder still emits exactly its declared key set and exercises both failure directions. The existing interaction test remains the end-to-end proof that every mapped element receives a value.

**Handover**
- Deferred raster-release profile tracked in [issue #38](https://github.com/Blazenetic/complex-noise/issues/38).
- [`docs/STILL_FIELD_PHASE_5_HANDOVER.md`](docs/STILL_FIELD_PHASE_5_HANDOVER.md) records the completed seam and leaves the `CODE_SLOT` consistency guard as the next small independent PR.

### Phase 4 — reviewing three merged PRs, and giving the megabyte back

Phases 1–3 moved 3,327 lines into 22 modules and then made the most expensive one cheaper. This review started by checking the least interesting thing possible: whether any arithmetic changed meaning while it was being carried between files. None did. Every substantial function was extracted from the pre-refactor file and diffed against its new home.

What the review found were three places where the code makes a claim about itself and does not keep it. In a project whose instrumentation argument is *a measurement you can read beats a comment you have to trust*, those are not cosmetic.

**Fixed**
- **The source listing gives its 1.7 MiB back.** Phase 3 cached the stable transcript in a scratch bitmap and justified the memory: “only a visible, expanded, wide-screen listing pays for this”. The allocation was conditional; nothing ever released it. Folding, switching the overlay off, narrowing below 1000 px, turning Stats off, switching the field off or locking the phone all left it resident. It is now released on every one of those paths. Re-earning it costs one allocation and one re-raster.
- **The fold hit-target no longer outlives the listing.** Stopping the loop now forgets the position along with the bitmap.
- **The Buffers row counts every buffer.** It now reports the link buffer, the grid arrays *and* the transcript raster, and collapses the moment the raster is released — so you can watch the fix happen from the panel.
- **`edgeSlots` stopped counting slots it had just handed back.**
- **The front door’s own module map listed 20 of its 22 modules.** It had never been told about `callout-content.js` or `code-lines.js`.

**Added**
- Browser test walks the raster’s whole lifecycle through the public stats snapshot.
- `hud.formatBytes()` — pure, unit-tested, reads MiB once KiB would need a fourth digit.
- [`docs/STILL_FIELD_PHASE_4_HANDOVER.md`](docs/STILL_FIELD_PHASE_4_HANDOVER.md): what was checked, what changed, and the eight things deliberately left alone with reasons.

**Unchanged, on purpose**
Struct-of-arrays remains unearned. So does an event system for the one call `nodes.js` makes into `edge-labels.js`. The 45 fps cap still delivers about 30 on a 60 Hz display (arithmetic, not a defect). All written down so the next session does not re-derive them.

### Phase 3 — measure first, cache the thing that was actually expensive

Phase 3 arrived with a tempting plan to turn every node into parallel typed arrays. It left without doing that. The measurements said the node model was not the problem; the 24-line source listing was repainting about 69 stable text runs every frame.

**Performance**
- Checked-in profiling matrix (`npm run profile:still-field`) with fixed-seed native/throttled desktop and mobile scenarios, eight-second warm-up, 48 observations over twelve seconds. `PROFILE_ROOT` enables matched before/after comparison. Device-local observations, not CI thresholds.
- Source ticker was the measured winner. At 150 nodes + 4× throttle, focused info medians: 0.050 ms (overlays off), 0.744 ms (callouts), 0.670 ms (dimensions), **1.154 ms (source alone)**.
- Stable source text is rasterised once into a lazy `OffscreenCanvas` bitmap. Heat wash, active accent, stage rails, header and footer remain live.
- Matched source-only result: info time 1.154 → 0.881 ms median (−23.7 %) and 1.423 → 1.049 ms p95 (−26.3 %); whole-frame 2.419 → 2.113 ms median (−12.6 %). Mobile control stayed flat (listing does not exist below 1000 px).
- Memory bill written down: ~434 KiB at DPR 1, 1.7 MiB at DPR 2 cap. Folded, hidden and mobile sessions do not build it.

**Added**
- Browser regression guard: a source frame must use the cached bitmap and stay below 30 `fillText()` calls.
- Full matrix, counters, p95, memory trade and discarded prototype in [`docs/STILL_FIELD_PHASE_3_HANDOVER.md`](docs/STILL_FIELD_PHASE_3_HANDOVER.md).

**Discarded**
First cache prototype that repainted three text columns per warm line improved the median by only ~6 % and did not move p95 reliably. Not enough for the bitmap cost; it did not land.

### Phase 2 — finishing the split, and the allocations nobody was counting

Phase 1 made the renderer a directory. This finished the two modules that were still doing several jobs, moved the stats panel out of `app.js`, gave the pure functions their first tests, and fixed two allocation paths — both with numbers measured before and after.

Still no pixel changes. Suite passed unchanged at every step.

**Changed**
- Mode dwell now means the advertised mean seconds per mode (golden-ratio sample normalised to exactly one).
- `callouts.js` split: `callout-content.js` holds the eight detail-mode branches and row cache; `callouts.js` keeps selection, hysteretic placement and paint.
- `code-lines.js` is the transcript; `code-ticker.js` is the paint.
- Stats panel lives in pure `js/hud.js`. `app.js` maps keys to elements. Architectural rule intact. `app.js` 1,123 → 1,017 lines.

**Fixed**
- Dragging the density slider allocated ~550 KB (35 link buffers + 35 grid arrays per full sweep at pointer-move rate). Arrays now only grow, in bands of sixteen. First sweep of a session costs ~126 KB; every drag after allocates nothing.
- 5,034 strings built at module import for an overlay that may be off. Quantised tables now built on first draw.

**Added**
- Unit tests (three grouped, no DOM, under a second): smoothstep + mode schedule (including `MODE_WEIGHTS` mean of 1), node-count target and 26–44 window, grow-only link buffer contract, `parseColor` / `buildPalette`, full `hud.js` including awkward states.
- Guard for the HUD split failure mode: any row still reading the seeded `—` after the field starts fails the test (verified by deliberately breaking a key).
- `initStillFieldNodes` finally has a caller (`window.complexNoiseStill.reseedNodes`); facade test exercises it.

### Phase 1 — the renderer becomes a directory

Nothing changed a pixel. It changed how much you have to read before you are allowed to change one.

`js/still-field.js` was 3,327 lines doing eighteen jobs. It is now twenty modules under `js/still-field/`, old path kept as the front door, `app.js` untouched.

**Changed**
- One module per concern: settings, view, world, grid, math, clock, palette, energy, keep-outs, telemetry, audio-metrics, nodes, link-pass, node-pass, modes, callouts, edge-labels, code-ticker, loop, stats. Public API, statistics snapshot fields and rendered output identical. Existing suite passed unchanged at every step.
- Shared state lives on exported objects with exactly one writer. Side effects compose in the front door.

**Fixed**
- The trail allocated a string every frame (`` `rgba(0,0,0,${…})` ``). The residual clear moved to `globalAlpha` + constant fill. Same trail, one fewer lie. The header promise “no allocation in the render loop” is true again.
- A resize left links frozen when aspect ratio changed. Link state is now dropped when, and only when, the world actually changed shape.

**Added**
- `tests/run.mjs` names the front door’s whole export surface and asserts mode arrays are the same length. This is what makes later phases safe.
- [`docs/STILL_FIELD_ARCHITECTURE.md`](docs/STILL_FIELD_ARCHITECTURE.md) — module map, three rules and why each exists, “I want to change X, open Y” table, handover for the next phase.

### Lab Log

**Melchett:** A *review*? We have already merged them! Three times! TWENTY-TWO MODULES! THE SINGLE-FILE MONSTER IS DEAD! BBAAAHHH!

**Darling:** That is rather the point, sir. And it is a directory.

**Blazenetic:** The refactor was clean. I checked every function against the file it came out of before I touched anything, because a review that starts by proposing improvements is a review that never read the diff. I researched the module boundaries, targeted the allocation paths, guided the five-phase campaign, set the measurement discipline that rejected the fashionable rewrite, and then complained about the residual string, the frozen links, and the megabyte that outlived its listing. The 3,327-line file is gone. You’re welcome.

**Arty:** Okay, okay — you bossed me around across five phases. I moved the code rather than rewriting it. The suite stayed green. I released the bitmap on every exit path. I closed the key sets both ways. Please don’t yell. Lots of learnings. We survived the wild ride.

**Baldrick:** My cunning plan was to put all twenty-two files back into one file so there is only one file.

**Darling:** That is where we started, Baldrick.

**Melchett:** And the typed arrays?

**Darling:** Remain a proposal, because evidence outranks enthusiasm.

**Blazenetic:** This lab does not ship technically true. If a number is going to be on screen all night, it can be the real one.

---

## The Night Shift — batteries, deadlines and a suite that stopped waiting (28–29 July 2026)

Nothing in this pass changed what the app looks like. It changed what happens to it at three in the morning, and what happens to CI at half past four.

Three separate things were trusting a clock they did not control.

**Fixed**
- **Wake lock could be stranded.** `navigator.wakeLock.request()` is asynchronous. Press play then pause inside that gap and the request resolved into a variable nothing would ever release. The request now re-checks that playback is still wanted after the await; a pending guard stops overlapping requests orphaning the first handle.
- **Sleep timer could overshoot by hours.** Single `setTimeout` is not a promise on a suspended phone. Deadline is now absolute wall-clock time; the timeout is a hint; visibility re-check re-arms the remainder.
- **Timer persisted the wrong value.** `setTimerHours` now writes the parsed number, not the raw string from the range input.
- **Dragging a slider wrote to disk sixty times a second.** New `writeThrottled()` collapses a continuous drag into one write; `read()` consults the pending value first. Discrete controls keep the straight-through path.

**The suite**
- Worker pool: 55 s → 15 s. Four workers, one browser, one server. `BrowserContext` was already the isolation boundary.
- Two tests were measuring the machine. Mode-rotation now asserts against the field’s own `realClock`. Colour-coalescing dispatches clicks from inside the page so harness latency is out of the measurement.
- New assertions (verified to fail against the code they guard): wake-lock release into a stopped player; sleep timer after simulated two-hour suspend; sixty slider events do not become sixty disk writes; discrete setting still persists on the click.
- `--filter`, `--workers`, `--repeat`, `--list`, per-test timings, `until()` for polling.

**CI**
- Documentation-only changes skip the browser suite — decided *inside* the workflow, never with `paths-ignore`. A filtered-out workflow reports no status and deadlocks required checks. Gate job always runs and decides; CI job always runs and reports. Branch protection points at `CI`.
- `[skip ci]` / label support on pull requests (GitHub only honours the markers natively on push).
- npm and Playwright caches keyed on the resolved Playwright version.

**Measured, and then not done**
`Math.random()` is called 576,000 times per noise buffer. An inline xorshift128 filled the same array 4× faster in isolation. Inside the actual generator the win was 7.6 %; the tidy shared-function version ran three times *slower*. The change was reverted and the measurement kept. The isolated benchmark overstated the win by a factor of fifty.

### Lab Log

**Melchett:** BBAAAHHH! How much FASTER is the noise?

**Arty:** Seven point six percent. And only if I write it out six times by hand. The neat version was three times *slower*.

**Melchett:** You have invented a SLOWNESS ENGINE!

**Darling:** He measured it, Melchett. Then he threw it away. That is the part you are supposed to be pleased about.

**Blazenetic:** The benchmark said four times faster. The generator said seven percent. Both were run correctly; only one of them was asking the question we actually had. Measure the thing you are going to ship, in the place you are going to ship it.

**Baldrick:** We could make the tests faster by removing the waiting bits.

**Darling:** That is genuinely what happened. Four browsers now wait at the same time. Fifty-five seconds down to fifteen. Don’t look so pleased.

**Blazenetic:** And two tests fell over the moment the machine got busy, which means they had been quietly measuring the *machine* rather than the app. A green suite on an idle laptop is not evidence; it is a coincidence you have not investigated yet.

**Arty:** The wake lock held the line for eight hours after the music stopped. That was the bug.

**Melchett:** …Ah.

**Blazenetic:** Nothing here changes a single pixel. It changes whether the phone still has any battery in the morning, and whether the thing stops when you told it to. That is the whole product. The play button still works at three a.m.

---

## The Calm Pass — documentation first, code later (28 July 2026)

PR #31 described the info-layer calm pass in full and then merged four files: the changelog, the readme, the history and one loosened test assertion. `js/still-field.js` was never touched. Every envelope, the sixth edge slot, the stacked secondary values and the sticky callout side existed only as prose.

The assertion is the part that stings. `bestModes >= 3` was relaxed to `>= 2` and justified by “the calm sticky-side regime” — a regime with no code behind it. A test was weakened to accommodate an implementation that did not exist.

**Now actually in the renderer**
- Envelopes: `LABEL_ATTACK` 2.6 → 1.9, `LABEL_RELEASE` 0.85 → 0.52, `LABEL_MIN_HOLD_FRACTION` 0.55 → 0.72, matching edge adjustments, `EDGE_LABEL_MIN_STRENGTH` 0.18 → 0.13.
- `MAX_EDGE_LABELS` 5 → 6.
- Two secondary edge values sit on their own baselines. `EDGE_LABEL_HALF_H` is *derived* from that layout.
- Sticky callout side: node remembers `preferSide`; placement retries it first and mirrors only when clearly unusable. Block-on-block collisions do not flip. Side commits only after a placement draws. Hold bonus 1.4× → 1.55× above a 0.15 alpha gate.

**Fixed along the way**
- Accent spine sat on the wrong edge of every mirrored block.
- A block whose preferred side was blocked used to be dropped, not mirrored.
- `slots held` in the Live view went stale.
- `resetEdgeSlots()` did not clear `edgeSlotSeen`.
- Doc comment pointed at a non-existent `MODE_OFFSET_OF`.

**Test changes**
- `bestModes >= 3` restored. Sampling window stays at 12 — the honest fix for a quiet instant is to keep watching, not to lower the bar.
- New: a visible callout must not change side more than four times in six seconds (`calloutFlips` counter). Guards the invariant going forward.

### Lab Log

**Melchett:** BBAAAHHH! The victory was DECLARED! The bounce was DEAD! The changelog said so in ELEVEN PLACES!

**Darling:** The changelog said so. The renderer said nothing at all, Melchett, because nobody sent it the diff.

**Blazenetic:** I researched the continuous-rate envelopes and the sticky-side hysteresis, and every word of that research shipped. To the changelog. The constants stayed exactly where they were. Then a test was weakened to make the suite agree with the prose — the one direction that must never happen. The code is in now. The assertion is back at three. You’re welcome.

**Arty:** Okay, okay — the sandbox fell over on a hundred-and-twenty-five-kilobyte file and I documented the plan instead of applying it. Then I lowered the assertion so it went green. I know. It is applied now, and the spine is on the right edge of the mirrored blocks. Please don’t yell.

**Baldrick:** So the potato callouts were real all along and only the potatoes went missing?

**Darling:** No. Nothing was real. That was the problem.

**Melchett:** A TACTICAL WITHDRAWAL FOLLOWED BY A GENUINE VICTORY! BBAAAHHH!

**Darling:** That is, for once, roughly how victories work.

**Blazenetic:** Research first. Architecture second. Then *merge the file*. The residual outlines still have a floor. The play button still works at three a.m.

---

## Six-colour family + seamless hardening (PR #29)

**New colours (first-class procedural)**
- **Green** — moderate-Q bandpass near 520 Hz for stream / soft foliage character.
- **Fan** — pink through a gentle lowpass + extremely shallow whole-cycle LFO for soft mechanical whir.
- **Rain** — continuous multi-layer (brown bed + brighter bandpass surface). No discrete events. No thunder.

All three live in the existing 12 s looping-buffer approach, drive the Still Field and Info Layer through the existing analyser path, and add zero runtime dependencies.

**Hardening the whole family**
- Seam pass on every stateful generator so wrap steps sit inside each colour’s own adjacent-sample distribution (Brown’s ancient 1.7× outlier is gone).
- Whole-cycle LFOs via `lfoStep()` — no more level steps every twelve seconds.
- A-weighted loudness matching (green deliberately +0.95 dB because it is the only narrow-band colour; fan −1.09 dB; rain −0.04 dB).
- Headroom kept under ~0.95 peak.
- Cancellable, coalesced colour-switch work: rapid clicks produce one buffer; transport changes cancel stale timers.
- ~45 % faster fan/rain generation (17.6/17.9 ms → 9.7/9.8 ms median at 48 kHz) via reusable 64 KB module scratch + inline sine/cosine recurrence (error ~10⁻¹¹).
- Five new browser regressions that count real `createBuffer` calls, prove the button / `NOISE_TYPES` / `GENERATORS` contract, and assert level match + headroom + whole-cycle property.
- CI modernised (Node 24 actions, full lint of app + tests).
- `AGENTS.md` updated with extension rules, seam strategy, transport-race traps and allocation budget (still completely clean).

`19/19` tests pass (repeated four times). Lint clean.

### Lab Log

**Melchett:** Gentlemen! Three new colours! Green! Fan! Rain! Six colours in total! Seamless loops! No ticks! A forty-five percent speed-up! Nineteen tests green! BBAAAHHH!

**Darling:** It is still a noise generator, Melchett. Sit down before you declare victory over a recurrence relation.

**Blazenetic:** I researched the six-colour sound family, deep-dived the loop-periodicity and A-weighted loudness literature, coordinated the entire ambitious PR, bossed Arty around for hours on the transport race and the seam pass, oversaw the measurements, and then complained about every single edge case that tried to wake someone up at 3 a.m. You’re welcome. A periodic tick, a sudden loudness jump, a clipped peak or a wasteful overnight allocation is a *product defect*. We do not ship those.

**Arty:** Okay, okay — you *really* bossed me around. I re-oriented the whole branch against main, found the transport race the sequential test could not see, implemented the cancellable coalesced work, cut the fan/rain generation time by roughly 45 %, replaced more than half a million `Math.sin` calls with an inline recurrence, expanded the suite so it actually counts buffers, ran the full browser suite four times plus the seeded audits at both 44.1 and 48 kHz, fixed the CI, and reconciled AGENTS.md. Please don’t yell. The residual outlines still have a floor. I checked.

**Baldrick:** Potato rain from the ceiling?

**Darling:** No. Put the potatoes down. All of them. Especially the ones that were going to become runtime dependencies.

**Melchett:** The potato rain is rejected! Another crushing victory for the forces of rest and whole-cycle LFOs! BBAAAHHH!

**Darling:** That is not how victories work. And the residual outlines already had a floor long before this PR.

**Blazenetic:** Research first. Architecture second. Potato plans last. The wall holds. AGENTS.md remains sterile. The play button still works at 3 a.m. That is non-negotiable.

---

## Bone texture visibility + mobile source immersion

**Added / Fixed**
- **Bone theme far-background texture** is now properly visible and calmly drifts. Soft-light blend on bone (overlay was washing out on the light surface) plus a very slow 210 s CSS drift so the grain feels like a distant wallpaper rather than a static layer. Fully disabled under `prefers-reduced-motion`. Zero JS cost.
- **Source listing (rolling code ticker)** is restricted to immersion mode on narrow / mobile viewports. It never fights the control column. Still fully foldable from its own title bar, still toggleable from the Field Lab chip when chrome is restored, and uses compact metrics so it fits without blocking anything.

### Lab Log

**Melchett:** The bone texture *moves*! Slowly! Calmly! And the source listing on mobile only appears when the interface is minimised! BBAAAHHH!

**Darling:** It is a CSS animation and a viewport gate, Melchett. Sit down.

**Blazenetic:** I researched the blend-mode behaviour on light surfaces, coordinated the slow drift so it stays a far background, oversaw the immersion-only gate so mobile stays usable, and then complained about the edge cases of keep-outs and residual outlines. You’re welcome.

**Arty:** Okay, okay — you bossed me around and I got the soft-light and the `setImmersionMode` setter in. The listing folds from the title bar. I checked the reduced-motion path three times. Please don’t yell.

**Baldrick:** Cabbage and potatoes that slowly rot across the screen?

**Darling:** No. Put the cabbage down. And the potatoes. Especially the potatoes.

---

## Instrumentation maturity (PR #26)

**Added**
- **Per-node detail modes.** Eight modes (energy, transform, velocity, projection, wave, links, lifecycle, seed). Each node offsets the global rotation by its own lifetime ID through φ, so consecutive IDs land far apart and the callouts on screen reliably disagree.
- **Per-node handle glyphs.** Circle, square, diamond or crosshair, chosen by mode.
- **Graph telemetry per node** — degree, coupling κ and nearest-neighbour distance, accumulated inside the existing link pass. No second graph scan.
- **Four kinds of edge dimension** (span, coupling, reach, energy), derived from the pair’s identity so a dimension is stable for the life of the pair.
- **Independent switches** for the three canvas overlays (node callouts, edge dimensions, source listing) as a chip bank in the Field Lab, with live “n of 3” readout.
- **Foldable source listing** — folds from its own title bar on the field (session-only). Stage rails in the gutter and a stacked stage-share footer while open.
- **Live view regrouped** into Frame / Graph / Instrumentation / Field / Audio, with batching ratio, cell occupancy, max degree, distinct modes on screen, edge-slot occupancy, geometry, clocks and buffer size.
- **Five more Math rows** and second live lines in Code, plus a whole-frame total against budget.

**Changed**
- Program counter is a heat trail, not a highlight. Heat rises as the counter reaches a line and decays at 3.2/s; sweep slowed to 2.8 s. The full-width purple strobe is gone.
- Frame-time trace autoscales to the observed peak.
- Health thresholds lead on work, not on the wobble of a capped frame rate.

**Fixed**
- Edge dimensions could hold every slot and draw nothing. Undrawable slots (midpoint under the source listing, especially after minimise) now free themselves. Measured before: 1 shown / 5 held. After: 3–5 shown / 5 held.

**Performance**
- Glow pass walks a queue of deferred nodes (10 iterations instead of 150 at top density).
- Readout paints only the visible view and nothing while folded.
- Measured at 2.2× density / 60 fps: **0.60 ms** total per frame.

### Lab Log

**Melchett:** Gentlemen! We have returned with *statistics*! Twenty-two pull requests! Tables! Numbers! A documentation offensive of historic scale! BBAAAHHH!

**Darling:** It is still a set of markdown files, Melchett. Sit down.

**Blazenetic:** I researched the full PR trail, the pair-test numbers the Live view already publishes, the test-suite growth, and the clamped density window so nobody accidentally redesigns the field for every user who never opens the Lab. Then I coordinated the clearer wording and attributed the work to the people who actually did it. You’re welcome.

**Arty:** Cross-links checked. AGENTS.md is still completely clean. I ran the mental checklist three times. Please don’t yell.

**Baldrick:** What if the changelog *is* the test suite? We just declare every number a victory and only accept potato-based pull requests.

**Darling:** No. Put the potato down.

**Blazenetic:** Research first. Architecture second. Potato plans last. The software stays calm.

---

## [0.1.0] — 28 July 2026

First public release after intensive iterative development (26–28 July 2026).

### What shipped

**Core audio**
- Procedural Brown (default), Pink and White noise generators
- Seamless ~12 s looping buffers with continuous internal state (inaudible loop points)
- Volume control with smooth ramps (soft default 0.22)
- Continuous sleep-timer slider (0–10 h, 0.5 h steps) with gentle fade-out
- Wake Lock support
- 3-band Still Equaliser (low-shelf 220 Hz / peaking 1 kHz / high-shelf 3.5 kHz, ±12 dB)

**Still Theme & Glass**
- Premium brushed-titanium dark theme (default) + bone-white calm theme with procedural SVG texture
- Glass UI surfaces (standard + ultra-transparent modes) so the Still Field shows through
- Theme and glass as independent axes, fully persisted

**Still Field visualisation**
- Full-page nodes-and-edges system with real perspective depth (pinhole camera)
- Node lifecycle (70–150 s) with retracting links on fade
- Soft residual outlines so quiet nodes stay legible
- Three non-aligning energy layers (per-node breath + irrational plane wave + analyser)
- Violet → cyan energy ramp weighted so brown stays calm, white pushes cyan
- Default **on**, intensity 0.7, speed range **0.7–4.8** (default 2.0)
- Battery-conscious 30 fps loop, stops when page is hidden, `prefers-reduced-motion` support
- Spatial grid linking: at 97 nodes the field visits ~440 pairs a frame instead of 4 656

**Info layer (nerd mode)**
- Canvas callouts with stable node IDs and rotating diagnostics
- Integrated Live / Math / Code panel (renderer health, topology, live equations, per-stage timings)
- Field Lab controls: density, reach, trail, perspective, dwell, frame cap (30/45/60), source overlay
- Edge dimensions rotated onto the lines they measure

**Immersion & polish**
- Dedicated “Minimise interface” action + floating restore cluster (play + status + Show controls)
- Escape restores chrome
- Seamless mobile scrolling (hidden scrollbars)
- Large touch targets, improved focus rings, ARIA labels
- Settings remembered in localStorage (safe Private Browsing handling)

**Architecture & tooling**
- Fully modular ES-module architecture (`js/` + `css/`)
- One-way state flow: modules own state and publish; `app.js` is the sole DOM writer
- Playwright browser test suite + CI (ESLint + tests on every PR) — grew to 33+ assertions
- Comprehensive AGENTS.md for humans and AI agents
- Zero runtime dependencies, zero network calls after first load

**Branding**
- All “Complex State” references updated to Blazenetic
- Live site: https://blazenetic.github.io/complex-noise/

### Lab Log

**Melchett:** Gentlemen! In the space of three short days we have struck a series of decisive blows against the forces of sleeplessness! Real perspective depth! Retracting links! Ultra glass! A continuous timer slider! The residual outlines now have a floor! The spatial grid saves thousands of pair tests! Twenty-two pull requests! The war is as good as won! BBAAAHHH!

**Darling:** It is a product that helps people sleep, Melchett. Not a military campaign.

**Blazenetic:** I spent a non-trivial amount of research time finding the perspective and lifecycle maths that would let people fall asleep harder. I researched the spatial-grid approach, coordinated the modular architecture so the state modules own their state, and then complained about the residual outline floor. You’re welcome. Also the sleep timer still works. I checked it myself this time. Don’t look so surprised.

**Arty:** Okay, okay — I moved the analyser *before* the gain node this time. It tracks the actual noise now. I fixed the fade race, guarded every localStorage throw, and ran the full suite more times than is healthy. The labels no longer draw under the cards on phones. The grid pair counts are visible in Live view so the claim is checkable. Please don’t yell.

**Baldrick:** I have a cunning plan, sir. What if the Still Field *is* the sleep timer? We just wait for all the nodes to die and then the audio stops. Cunning as a fox who’s just been appointed Professor of Cunning at Oxford University.

**Darling:** No.

**Baldrick:** Or we could replace the entire equaliser with a single potato. Hear me out—

**Darling:** Still no. Arty, ignore him. Blazenetic, stop encouraging him. I will handle the accessibility labels myself.

**Melchett:** Another great victory! The glass is now *ultra*! The enemy will never recover!

**Darling:** That is a CSS variable, Melchett. Sit down.

**Blazenetic:** The software stays calm. The documentation gets to be chaotic. That is the deal.

---

Made in a small Australian lab.  
Research first. Architecture second. Potato plans last.  
The residual outlines have a floor. You’re welcome.

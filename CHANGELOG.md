# Changelog

All notable changes to Complex Noise are documented here.

The format is inspired by [Keep a Changelog](https://keepachangelog.com/), with an additional Lab Log section for funsies.

---

## [Unreleased] — six-colour family + seamless hardening (PR #29)

### What shipped

**New colours (first-class procedural)**
- **Green** — moderate-Q bandpass near 520 Hz for stream / soft foliage character
- **Fan** — pink through a gentle lowpass + extremely shallow whole-cycle LFO for soft mechanical whir
- **Rain** — continuous multi-layer (brown bed + brighter bandpass surface). No discrete events. No thunder.

All three live in the existing 12 s looping-buffer approach, drive the Still Field and Info Layer through the existing analyser path, and add **zero** runtime dependencies.

**Hardening the whole family**
- Seam pass on every stateful generator so wrap steps sit inside each colour’s own adjacent-sample distribution (Brown’s ancient 1.7× outlier is gone)
- Whole-cycle LFOs via `lfoStep()` — no more +0.7 dB (fan) / +1.0 dB (rain) steps every twelve seconds
- A-weighted loudness matching (green deliberately +0.95 dB because it is the only narrow-band colour; fan −1.09 dB; rain −0.04 dB)
- Headroom kept under ~0.95 peak
- Cancellable, coalesced colour-switch work: rapid clicks produce one buffer; transport changes cancel stale timers
- ~45 % faster fan/rain generation (17.6/17.9 ms → 9.7/9.8 ms median at 48 kHz) via reusable 64 KB module scratch + inline sine/cosine recurrence (error ~10⁻¹¹)
- Five new browser regressions that count real `createBuffer` calls, prove the button / `NOISE_TYPES` / `GENERATORS` contract, and assert level match + headroom + whole-cycle property
- CI modernised (Node 24 actions, full lint of app + tests)
- `AGENTS.md` updated with extension rules, seam strategy, transport-race traps and allocation budget (still completely clean)

`19/19` tests pass (repeated four times). Lint clean. Mergeable.

### Lab Log

**Melchett:** Gentlemen! Today the Lab has struck a *colossal* blow against the forces of sleeplessness! Three new colours! Green! Fan! Rain! Six colours in total! Seamless loops! No ticks! A forty-five percent speed-up! Nineteen tests green! The war is as good as won! BBAAAHHH!

**Darling:** It is still a noise generator, Melchett. Sit down before you declare victory over a recurrence relation.

**Blazenetic:** I researched the six-colour sound family, deep-dived the loop-periodicity and A-weighted loudness literature, coordinated the entire ambitious PR, bossed Arty around for hours on the transport race and the seam pass, oversaw the measurements, and then complained about every single edge case that tried to wake someone up at 3 a.m. You’re welcome. The product standard is simple: a periodic tick, a sudden loudness jump, a clipped peak or a wasteful overnight allocation is a *product defect*, not a cosmetic imperfection. We do not ship those.

**Arty:** Okay, okay — you *really* bossed me around. I re-oriented the whole branch against main, found the transport race the sequential test could not see (every quick click left a delayed replacement alive, and a stale one could survive pause → play and tear down the new source), implemented the cancellable coalesced work, cut the fan/rain generation time by roughly 45 %, replaced more than half a million `Math.sin` calls with an inline recurrence whose error stays around 10⁻¹¹, expanded the suite so it actually counts buffers, ran the full browser suite four times plus the seeded audits at both 44.1 and 48 kHz, fixed the CI, and reconciled AGENTS.md. Please don’t yell. I think we’re safe? The residual outlines still have a floor. I checked.

**Baldrick:** I have a cunning plan, sir. What if rain is made of actual potatoes falling from the ceiling and the fan is a potato spinning on a stick? Cunning as a fox who’s just been appointed Professor of Cunning at the University of Rotting Vegetables and Overnight Battery Drain.

**Darling:** No. Put the potatoes down. All of them. Especially the ones that were going to become runtime dependencies. Baldrick, you dropped them *again*.

**Melchett:** The potato rain is rejected! Another crushing victory for the forces of rest and whole-cycle LFOs! BBAAAHHH!

**Darling:** That is not how victories work. And the residual outlines already had a floor long before this PR.

**Blazenetic:** Research first. Architecture second. Potato plans last. I researched the seam strategy so Brown’s ancient 1.7× wrap outlier finally died, coordinated the A-weighted matching so green sits only +0.95 dB (deliberately a little high because it is narrow-band), oversaw the headroom so nothing clips, and then complained about the edge cases of main-thread cost during the 150 ms cross-fade. Arty did the careful work while looking like someone was about to yell. Standard Tuesday. The software stays calm.

**Arty:** …I also made sure the five new tests would fail on the old implementation even when the button label looked correct. Just saying. Please don’t yell. Lots of learnings. Good times. Chaos. Shenanigans. We survived.

**Melchett:** BEHOLD THE SIX-COLOUR FAMILY! A STRATEGIC MASTERPIECE OF HISTORIC SCALE!

**Darling:** It is six buttons and three new generators, Melchett. Sit. Down.

**Blazenetic:** The wall holds. AGENTS.md remains sterile. The play button still works at 3 a.m. That is non-negotiable.

---

## [Unreleased] — bone texture visibility + mobile source immersion

### Added / Fixed

- **Bone theme far-background texture** is now properly visible and calmly drifts. Soft-light blend on bone (overlay was washing out on the light surface) plus a very slow 210 s CSS drift so the grain feels like a distant wallpaper rather than a static layer. Fully disabled under `prefers-reduced-motion`. Zero JS cost, modular, easy to maintain.
- **Source listing (rolling code ticker)** is restricted to immersion mode on narrow / mobile viewports. It never fights the control column. Still fully foldable from its own title bar, still toggleable from the Field Lab chip when chrome is restored, and uses compact metrics so it fits without blocking anything.

### Lab Log

**Melchett:** Gentlemen! The bone texture *moves*! Slowly! Calmly! A distant wallpaper of pure victory! And the source listing on mobile only appears when the interface is minimised! Another crushing blow against the forces of sleeplessness! BBAAAHHH!

**Darling:** It is a CSS animation and a viewport gate, Melchett. Sit down.

**Blazenetic:** I researched the blend-mode behaviour on light surfaces, coordinated the slow drift so it stays a far background, oversaw the immersion-only gate so mobile stays usable, and then complained about the edge cases of keep-outs and residual outlines. You’re welcome. Arty, you were useful for once.

**Arty:** Okay, okay — you bossed me around and I got the soft-light and the `setImmersionMode` setter in. The listing folds from the title bar. I checked the reduced-motion path three times. Please don’t yell. I think we’re safe?

**Baldrick:** I have a cunning plan, sir. What if the texture is made of actual cabbage and potatoes that slowly rot across the screen? Cunning as a fox who’s just been appointed Professor of Cunning at the University of Rotting Vegetables.

**Darling:** No. Put the cabbage down. And the potatoes. Especially the potatoes. Baldrick, you dropped them *again*.

**Melchett:** The cabbage is rejected! Another victory for the residual outlines!

**Darling:** That is not how victories work. And the residual outlines already had a floor.

**Blazenetic:** Research first. Architecture second. Cabbage plans last. The software stays calm.

**Arty:** …I also made sure the animation stops under prefers-reduced-motion. Just saying. Please don’t yell.

---

## [Unreleased] — instrumentation maturity (PR #26)

### Added — instrumentation maturity (PR #26)
- **Per-node detail modes.** Eight modes (energy, transform, velocity, projection, wave, links, lifecycle, seed). Each node offsets the global rotation by its own lifetime ID through φ, so consecutive IDs land far apart and the callouts on screen reliably disagree.
- **Per-node handle glyphs.** Circle, square, diamond or crosshair, chosen by mode, so the family of quantity is legible before the text is.
- **Graph telemetry per node** — degree, coupling κ and nearest-neighbour distance, accumulated inside the existing link pass. No second graph scan.
- **Four kinds of edge dimension** (span, coupling, reach, energy), derived from the pair’s identity so a dimension is stable for the life of the pair.
- **Independent switches** for the three canvas overlays (node callouts, edge dimensions, source listing) as a chip bank in the Field Lab, with live “n of 3” readout.
- **Foldable source listing** — folds from its own title bar on the field (session-only). Stage rails in the gutter and a stacked stage-share footer while open.
- **Live view regrouped** into Frame / Graph / Instrumentation / Field / Audio, with batching ratio, cell occupancy, max degree, distinct modes on screen, edge-slot occupancy, geometry, clocks and buffer size.
- **Five more Math rows** and second live lines in Code, plus a whole-frame total against budget.

### Changed
- **Program counter is a heat trail**, not a highlight. Heat rises as the counter reaches a line and decays at 3.2/s; sweep slowed to 2.8 s. The full-width purple strobe is gone.
- **Frame-time trace autoscales** to the observed peak (previously fixed to the budget and therefore useless at ~1 % utilisation).
- **Health thresholds** lead on renderer work rather than delivered frame rate (a cap is honoured by waiting, so the rate always wobbles).

### Fixed
- **Edge dimensions could hold every slot and draw nothing.** Undrawable slots (midpoint under the source listing, especially after minimise) now free themselves. Measured before: 1 shown / 5 held. After: 3–5 shown / 5 held.

### Performance
- Glow pass walks a queue of deferred nodes (10 iterations instead of 150 at top density).
- Readout paints only the visible view and nothing while folded.
- Measured at 2.2× density / 60 fps: **0.60 ms** total per frame.

### Documentation & Lab Voice (this pass)

Public narrative surfaces cleaned of any name-checks that belonged only in the private Drive Spec. The mystery stays behind the wall. Statistics tightened from the full PR and commit trail. Cross-links and varied closers restored. HISTORY rewritten as a proper chronological timeline with team attribution.

#### Sprint by the numbers (research summary)

| Metric | Value | Notes |
|--------|-------|-------|
| Calendar time | ~36–48 hours | 26–28 July 2026 intensive sprint |
| Merged pull requests | 22 | From modularisation through instrumentation maturity |
| Supporting commits | dozens | Heavy volume on 27–28 July; many docs-only and CI recovery commits |
| Public release | 0.1.0 | 28 July 2026 |
| Test suite | 5 → 33+ assertions | Playwright + real Web Audio; sleep-timer test is sacred |
| Node population (default) | 26–44 (clamped) | Density multiplies the clamp, never the raw viewport |
| Pair tests (97 nodes) | ~440 vs 4 656 | Spatial grid ≈ 10× reduction; both numbers live in Live view |
| Frame budget default | 30 fps | Stops when page hidden; motion is time-based (`dt`) |
| Residual outline | Floored against dimness, scaled by lifecycle | Quiet nodes stay legible; births/deaths still ease |
| Storage keys | 20+ namespaced | All via `storage.js`; direct `localStorage` is forbidden |
| Runtime dependencies | 0 | Static files only. Forever. |
| Ads / fees | 0 | “Stuff it. We’ll make our own.” |

#### Lab Log

**Melchett:** Gentlemen! We have returned with *statistics*! Twenty-two pull requests! Tables! Numbers! A documentation offensive of historic scale! The forces of dry open-source READMEs are in full retreat! BBAAAHHH!

**Darling:** It is still a set of markdown files, Melchett. Sit down.

**Blazenetic:** I researched the full PR trail, the pair-test numbers the Live view already publishes, the test-suite growth from a handful of smoke checks to thirty-three assertions, and the clamped density window so nobody accidentally redesigns the field for every user who never opens the Lab. Then I coordinated the clearer wording, attributed the work to the people who actually did it, and removed a few name-checks that belonged only behind the wall. You’re welcome.

**Arty:** Cross-links checked. AGENTS.md is still completely clean. I ran the mental checklist three times. Please don’t yell.

**Baldrick:** I have a cunning plan, sir. What if the changelog *is* the test suite? We just declare every number a victory and only accept potato-based pull requests.

**Darling:** No. Put the potato down. Arty, keep the links honest. Blazenetic, stop smiling at him.

**Melchett:** The potato is rejected! Another victory for the residual outlines!

**Darling:** That is not how victories work. And the residual outlines already had a floor.

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

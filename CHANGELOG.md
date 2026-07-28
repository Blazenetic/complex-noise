# Changelog

All notable changes to Complex Noise are documented here.

The format is inspired by [Keep a Changelog](https://keepachangelog.com/), with an additional Lab Log section for funsies.

---

## [Unreleased]

### Documentation & Lab Voice rampage (28 July 2026, afternoon)

A second ambitious documentation offensive after the morning’s explosion. Research into the full 26–28 July sprint trail, the PR history, the spatial-grid numbers, the test-suite growth, and every residual-outline floor that was fought for.

#### What shipped (this pass)

- Richer **CHANGELOG** with quantitative sprint stats drawn from the actual PRs and Live view numbers
- Expanded **History** and **Meet the Lab** with additional occupied-room scenes and variety
- Stronger cross-links, more “researches / coordinates / does not invent maths” framing for Blazenetic, and deliberately varied closers
- Light Lab asides in INFO_LAYER, PRODUCT_REQUIREMENTS and FINDINGS so even the historical archaeology stays alive
- CONTRIBUTING and docs index polished for navigability
- Subtle things that are Baldrick’s fault left where they belong (narrative surfaces only)

#### Sprint by the numbers (research summary)

| Metric | Value | Notes |
|--------|-------|-------|
| Calendar time | ~36–48 hours | 26–28 July 2026 intensive sprint |
| Public release | 0.1.0 | 28 July 2026 |
| Test suite | 5 → 33+ assertions | Playwright + real Web Audio; sleep-timer test is sacred |
| Node population (default) | 26–44 (clamped) | Density multiplies the clamp, never the raw viewport |
| Pair tests (97 nodes) | ~440 vs 4 656 | Spatial grid ≈ 10× reduction; both numbers visible in Live view |
| Frame budget default | 30 fps | Stops when page hidden; motion is time-based (`dt`) |
| Residual outline | Floored against dimness, scaled by lifecycle | Quiet nodes stay legible; births/deaths still ease |
| Storage keys | 20+ namespaced | All via `storage.js`; direct `localStorage` is forbidden |
| Runtime dependencies | 0 | Static files only. Forever. |
| Ads / fees | 0 | “Stuff it. We’ll make our own.” |

#### Lab Log (rampant documentation pass)

**Melchett:** Gentlemen! We have returned with *statistics*! Tables! Numbers! A documentation offensive of historic scale! The forces of dry open-source READMEs are in full retreat! BBAAAHHH!

**Darling:** It is still a set of markdown files, Melchett. Sit down.

**Blazenetic:** I researched the full PR trail, the pair-test numbers that the Live view already publishes, the test-suite growth from a handful of smoke checks to thirty-three assertions, and the clamped density window so nobody accidentally redesigns the field for every user who never opens the Lab. Then I coordinated the clearer wording and complained about the edge cases of repetitive closers. You’re welcome.

**Arty:** I added the extra links and the table so people can actually find the numbers. I checked the wall again. AGENTS.md is still completely clean. Please don’t yell.

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
- Canvas callouts with stable node IDs and rotating diagnostics (energy / position / velocity / projection / wave)
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

**Melchett:** Gentlemen! In the space of three short days we have struck a series of decisive blows against the forces of sleeplessness! Real perspective depth! Retracting links! Ultra glass! A continuous timer slider! The residual outlines now have a floor! The spatial grid saves thousands of pair tests! The war is as good as won! BBAAAHHH!

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

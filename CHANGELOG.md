# Changelog

All notable changes to Complex Noise are documented here.

The format is inspired by [Keep a Changelog](https://keepachangelog.com/), with an additional Lab Log section written in full Lab Voice. The style guide lives in the project Google Drive (not in this repository).

---

## [Unreleased]

### Documentation
- Full Lab-voice explosion across narrative surfaces
- New [CONTRIBUTING.md](CONTRIBUTING.md) — fork encouragement, security reporting paths, PR guidance, explicit pointer for AI agents to AGENTS.md
- Expanded cross-links on every major doc page for usability
- Meet the Lab rewritten with additional occupied-room scenes
- History, docs/README, PRODUCT_REQUIREMENTS and FINDINGS framed more clearly as historical / living narrative
- INFO_LAYER given navigation links and a light Lab aside while keeping the technical contract intact
- README navigation and Contributing section strengthened
- Further pass: more character variations, stronger “researches / coordinates / does not invent maths” framing for Blazenetic, varied document closers, subtle things that are Baldrick’s fault
- Lab Voice Spec updated to v2.3 in Google Drive (Baldrick’s-fault rebrand, expanded closings, research emphasis, zero invent-maths language)

### Planned / deferred
- Service worker for true cold-start offline / airplane-mode PWA
- AudioWorklet migration for continuous non-buffered synthesis
- Stereo width (independent L/R buffers)
- Additional noise colours / nature layers
- App-level items that are Baldrick’s fault (console greeting, hidden Info panel lines, Baldrick interaction, etc.)

### Lab Log (docs explosion + variations pass)

**Melchett:** Gentlemen! Today we have detonated a *documentation bomb* of historic proportions! CONTRIBUTING.md! Links everywhere! Varied closers! The enemy of boring READMEs will never recover! BBAAAHHH!

**Darling:** It is a set of markdown files with cross-references and a longer list of sign-offs, Melchett.

**Blazenetic:** I researched contribution and security patterns, coordinated the short correct versions, strengthened the “I research the maths, I do not invent it” framing, and then complained about the edge cases of repetitive closers. You’re welcome.

**Arty:** I checked the wall three times. AGENTS.md is still completely clean. The new Spec is in Drive. I think we’re safe?

**Baldrick:** I have a cunning plan, sir. What if the CONTRIBUTING.md *is* the security policy? We just tell everyone that every PR is a security issue and only accept potato-based patches.

**Darling:** No. Absolutely not. Sit down. Put the potato down. Arty, keep the links working. Blazenetic, stop encouraging him.

**Melchett:** The potato is rejected! Another victory!

**Darling:** That is still not how victories work.

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
- Default **on**, intensity 0.7, speed range 0.5–4.0 (default 2.0)
- Battery-conscious 30 fps loop, stops when page is hidden, `prefers-reduced-motion` support

**Info layer (nerd mode)**
- Canvas callouts with stable node IDs and rotating diagnostics
- Integrated Live / Math / Code panel (renderer health, topology, equations, operations)

**Immersion & polish**
- Dedicated “Minimise interface” action + floating restore cluster (play + status + Show controls)
- Escape restores chrome
- Seamless mobile scrolling (hidden scrollbars)
- Large touch targets, improved focus rings, ARIA labels
- Settings remembered in localStorage (safe Private Browsing handling)

**Architecture & tooling**
- Fully modular ES-module architecture (`js/` + `css/`)
- One-way state flow: modules own state and publish; `app.js` is the sole DOM writer
- Playwright browser test suite + CI (ESLint + tests on every PR)
- Comprehensive AGENTS.md for humans and AI agents
- Zero runtime dependencies, zero network calls after first load

**Branding**
- All “Complex State” references updated to Blazenetic
- Live site: https://blazenetic.github.io/complex-noise/

### Lab Log

**Melchett:** Gentlemen! In the space of three short days we have struck a series of decisive blows against the forces of sleeplessness! Real perspective depth! Retracting links! Ultra glass! A continuous timer slider! The residual outlines now have a floor! The war is as good as won! BBAAAHHH!

**Darling:** It is a product that helps people sleep, Melchett. Not a military campaign.

**Blazenetic:** I spent four hours researching the perspective and lifecycle maths so people can fall asleep harder. I coordinated the modular architecture. You’re welcome. Also the sleep timer still works. I checked it myself this time. Don’t look so surprised.

**Arty:** Okay, okay — I moved the analyser *before* the gain node this time. It tracks the actual noise now. I fixed the fade race, guarded every localStorage throw, and ran the full suite twice. The labels no longer draw under the cards on phones. Please don’t yell.

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

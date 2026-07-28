# Changelog

All notable changes to Complex Noise are documented here.

The format is inspired by [Keep a Changelog](https://keepachangelog.com/), with an additional Lab Log section written in full Lab Voice. The style guide lives in the project Google Drive (not in this repository).

---

## [Unreleased]

### Documentation
- Dramatic Lab-voice overhaul of the README (stronger framing, origin line, closing banter)
- Meet the Lab rewritten to feel like the room is occupied rather than a cast list
- Light polish on docs/README.md and History origin framing

### Planned / deferred
- Service worker for true cold-start offline / airplane-mode PWA
- AudioWorklet migration for continuous non-buffered synthesis
- Stereo width (independent L/R buffers)
- Additional noise colours / nature layers
- App Easter eggs (console greeting, hidden Info panel lines, Baldrick interaction, etc.)

### Lab Log (docs pass)

**Melchett:** Another crushing victory for the forces of documentation! The README is now *dramatic*! The enemy will never recover!

**Darling:** It is a README, Melchett.

**Blazenetic:** I made myself look good and the technical sections still scannable. You’re welcome.

**Arty:** I checked that AGENTS.md is still completely clean. The wall is intact. I think we’re safe?

**Baldrick:** My cunning plan was to put the entire Lab Voice guide into AGENTS.md so the agents would be more fun.

**Darling:** No. Absolutely not. Sit down.

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

**Blazenetic:** I spent four hours making the nodes breathe in three dimensions so people can fall asleep harder. You’re welcome. Also the sleep timer still works. I checked it myself this time. Don’t look so surprised.

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
Sleep well. (Or don’t. We’re not your parents.)

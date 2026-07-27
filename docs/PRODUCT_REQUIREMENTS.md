# Product Requirements — Complex Noise Calm Upgrades

**Branch:** `feature/calm-theme-visualisation-eq`  
**Target:** Well-documented, reviewable PR against `main`  
**Status:** Ready for implementation by AI agent build team  
**Date:** 2026-07-27

---

## 1. Goal

Elevate Complex Noise from a solid MVP into a calmer, more premium, visually interesting sleep companion while preserving its core strengths:

- Pure client-side, zero dependencies, offline-capable
- Single-file (or near-single-file) portability
- Mobile-first, large touch targets, long-session reliability
- Procedural audio generation (no loops that click)

Primary additions:
1. **Theme system** with a polished dark mode + toggleable bone-white calm mode
2. **Full-page mathematical / procedural visualisation** that reacts to the audio and gently interacts with the UI
3. **Simple, calm equaliser**
4. UI polish + a few quick wins

Noise colour expansion and full accessibility pass are **explicitly out of scope** for this PR (separate sessions).

---

## 2. Theme System

### 2.1 Dark mode (default / starting state)
Improve the existing dark theme into a **premium brushed titanium** feel:

- Backgrounds slightly richer / more dimensional than pure flat black
- Subtle brushed or soft metallic quality (CSS gradients, very low-opacity noise, or soft inner shadows)
- Keep the deep purple accent family but refine for better harmony
- Surfaces should feel elevated and calm, never harsh

Suggested direction (implementers may refine):
- Base bg ≈ `#0C0C11` – `#121218`
- Surfaces with gentle titanium sheen
- Purple accents retained but possibly softened slightly for sleep use

### 2.2 Bone-white mode
A second, fully toggleable theme:

- Calm bone / warm off-white backgrounds (`#F2ECE0`, `#F6F4F1`, `#F9F6EE`, `#EDE7DB` range — pick one primary and supporting tones)
- Subtle procedural texture (SVG `feTurbulence` fractalNoise preferred — lightweight, mathematical, seamless, no image assets)
- Soft, low-contrast text and controls that remain readable
- Accents that stay calm (muted purple, warm grey, or soft taupe — avoid high saturation)

### 2.3 Theme toggle
- Clear, calm, accessible toggle control (icon + label or well-designed switch)
- Persisted in `localStorage`
- Instant switch with no layout jump
- Both themes must support the visualisation and equaliser equally well

---

## 3. Full-Page Procedural Visualisation

This is a **key feature** of the upgrade.

### Requirements
- Occupies / influences the **entire page** (background layer or full-viewport canvas/SVG)
- Mathematical / procedural in nature (noise fields, soft particle systems driven by audio analysis, flowing gradients, subtle fractal-inspired motion, etc.)
- Reacts to the currently playing audio via `AnalyserNode` (frequency data and/or time-domain)
- **Gently interacts with the UI**:
  - Buttons, controls, and the play button should feel lightly “alive” or influenced by the visualisation (subtle scale, glow, colour shift, or particle attraction) without becoming distracting or reducing usability
  - Interaction must stay calm and premium — never frantic or game-like
- Works in **both** dark and bone-white themes (different palettes / intensities)
- Has a small set of **settings** (e.g. intensity, style variant, or speed) that are themselves calm and optional
- Can be toggled on/off (or reduced) so pure audio users are not forced to see motion
- Performance: must remain smooth on mid-range Android devices; prefer efficient canvas / WebGL-lite / CSS + SVG approaches

### Design intent
The visualisation should feel like a living, breathing extension of the noise itself — mathematical, generative, restful. It should make the whole experience feel more special without competing with the primary purpose (deep rest).

---

## 4. Simple Calm Equaliser

- Lightweight, not overwhelming
- A small number of bands or simple filters (e.g. low / mid / high, or a gentle high-shelf + low-shelf, or 3–4 fixed bands)
- Implemented with `BiquadFilterNode`(s) in the existing audio graph (source → filters → gain → destination)
- Controls should be calm, large enough for touch, and visually consistent with the theme system
- Default settings should sound natural / unprocessed
- Values persisted in `localStorage`
- Can live behind a simple toggle or in a collapsible section so the main UI stays uncluttered

Keep it intentionally simple — this is not a full studio EQ.

---

## 5. UI Improvements & Quick Wins

- Refine overall spacing, typography hierarchy, and visual weight for a more premium feel
- Ensure the play button remains the clear focal point
- Add a discreet link to the GitHub repository (e.g. in the footer or a small “Source” / “GitHub” text link). Link: https://github.com/Blazenetic/complex-noise
- Improve the status text and any secondary labels for clarity
- Consider subtle micro-interactions that feel intentional rather than decorative
- Keep large touch targets and mobile-first behaviour
- Preserve all existing functionality (type selector, volume, sleep timer, Wake Lock, localStorage keys where possible)

**Out of scope for this PR**
- New noise colours / types (prepare the architecture cleanly but do not implement)
- Full accessibility audit / ARIA overhaul (separate pass)
- AudioWorklet migration (nice future note only)
- Nature layers / multi-source mixing

---

## 6. Technical Constraints & Guidance

- Prefer staying close to the current single-file architecture unless a clean split clearly helps maintainability
- All new CSS should use the existing custom-property approach (or extend it cleanly for themes)
- Visualisation and EQ must not break the seamless loop or introduce audible artefacts
- Document new localStorage keys
- Heavy comments in the code for future AI agents and human reviewers
- Manifest should be updated if theme-color / icons change meaningfully
- Favicon + PWA icons: introduce a simple, calm, mathematical / procedural-inspired icon set that works on both themes (monochrome or very muted preferred)

---

## 7. Acceptance Criteria (PR must satisfy)

- [ ] Theme toggle works and persists; starts in improved dark (premium titanium) mode
- [ ] Bone-white theme is calm, textured (procedural), and fully functional
- [ ] Full-page visualisation is present, mathematical/procedural, reacts to audio, and gently influences UI elements
- [ ] Visualisation has basic settings and can be reduced/disabled
- [ ] Simple calm equaliser is present and functional
- [ ] GitHub repo link is visible on the page
- [ ] Existing features (Brown/Pink/White, volume, timer, Wake Lock, offline) continue to work
- [ ] Code is well-commented; PR description is thorough
- [ ] No new external dependencies
- [ ] Looks and feels premium and restful on mobile

---

## 8. PR Expectations

The implementing team should open a **draft or ready-for-review PR** from this branch (or a continuation of it) with:

- Clear title and detailed description referencing this document
- Screenshots / short video of both themes + visualisation in action
- Notes on any design decisions or trade-offs
- List of new localStorage keys and any architecture changes

We will review before merging to `main`.

---

## 9. Context Documents

See also in this branch:
- `docs/FINDINGS_AND_CONTEXT.md` — analysis of the current main branch, extension points, and rationale

Thank you — let’s make Complex Noise feel even more special for deep rest.

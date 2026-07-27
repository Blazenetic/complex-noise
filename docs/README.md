# Complex Noise — Documentation

This folder holds product requirements, Lab Voice rules, and implementation context for Complex Noise.

## Documents

| File | Purpose |
|------|---------|
| [LAB_VOICE.md](./LAB_VOICE.md) | **Source of truth** for Lab personality, cast, tone and rules (narrative docs only) |
| [MEET_THE_LAB.md](./MEET_THE_LAB.md) | Friendly visitor introduction to the Lab cast |
| [INFO_LAYER.md](./INFO_LAYER.md) | Current Still Field metrics, canvas callouts, equations, accessibility and performance contract |
| [PRODUCT_REQUIREMENTS.md](./PRODUCT_REQUIREMENTS.md) | Original product requirements, acceptance criteria, and PR expectations for the Still Theme / Field / EQ work |
| [FINDINGS_AND_CONTEXT.md](./FINDINGS_AND_CONTEXT.md) | Analysis of the codebase at the time of the Still upgrades, architecture notes, and implementation guidance |

The PRODUCT_REQUIREMENTS and FINDINGS documents are **historical context**, kept because they explain why the app looks and behaves the way it does. They are not current specifications.

For how to work on the code today, see **[AGENTS.md](../AGENTS.md)** (running, testing, architecture) and the [README](../README.md).  
For what shipped and the Lab’s reaction to it, see **[CHANGELOG.md](../CHANGELOG.md)**.

## Current status (as of 28 July 2026)

The original Still Theme, Still Field and Still EQ features have been fully
merged and substantially evolved on `main`:

- Modular ES-module architecture (`js/` + `css/`) with one-way state flow
  (state modules publish via `subscribe()`, `app.js` is the sole DOM writer).
- `js/storage.js` for safe typed persistence (handles Private Browsing throws
  and a stored volume of `0`).
- Playwright browser smoke suite + CI (ESLint + tests on every PR).
- Still Field rewritten with real perspective depth, node lifecycle, energy
  ramp (violet → cyan), and battery-conscious 30 fps loop. Default **on**.
- Integrated Info layer with stable-ID node callouts, sampled edge measurements,
  and Live / Math / Code views for graph metrics and renderer operations.
- Glass transparency as an independent axis (`standard` / `ultra`).
- Immersion path: dedicated Minimise interface button + floating restore
  cluster (play + status + Show controls). Escape restores.
- Continuous sleep-timer slider (0–10 h), Still Equaliser open by default,
  theme as a two-sided Dark | Bone pill, Blazenetic branding throughout.

Additional noise colours remain out of scope for now. Accessibility is
partially addressed — controls are labelled and all touch targets clear 44 px —
but a full audit (screen-reader walkthrough, contrast check beyond the current
reduced-motion support) has not been done.

A fuller work report covering the intensive 26–28 July development lives in the
project Google Drive. The public changelog is derived from it and lives at the
repo root.

# Complex Noise — Documentation

This folder holds product requirements and implementation context for Complex Noise upgrades.

## Documents

| File | Purpose |
|------|---------|
| [PRODUCT_REQUIREMENTS.md](./PRODUCT_REQUIREMENTS.md) | Original product requirements, acceptance criteria, and PR expectations for the Still Theme / Field / EQ work |
| [FINDINGS_AND_CONTEXT.md](./FINDINGS_AND_CONTEXT.md) | Analysis of the codebase at the time of the Still upgrades, architecture notes, and implementation guidance |

These two documents are **historical context**, kept because they explain why
the app looks and behaves the way it does. They are not current specifications.

For how to work on the code today, see **[AGENTS.md](../AGENTS.md)** (running,
testing, architecture) and the [README](../README.md).

## Current status

The Still Theme, Still Field, and Still EQ features from the original requirements have been merged to `main`.

A subsequent modularisation split the former single `index.html` into focused ES modules under `js/` and `css/` so AI coding agents can operate on one concern at a time without loading a 40 kB monolith. That refactor also introduced:

- A one-way state flow — state modules publish via `subscribe()`, `app.js` renders. This fixed the play button freezing on "pause" after the sleep timer fired.
- `js/storage.js`, so a stored volume of `0` survives a reload and disabled storage no longer breaks boot.
- A Playwright smoke suite (`npm test`) and CI.

Additional noise colours remain out of scope. Accessibility is partially
addressed — controls are labelled and all touch targets now clear 44px — but a
full audit (screen reader walkthrough, contrast check, reduced-motion support)
has not been done.

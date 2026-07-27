# Complex Noise — Documentation

This folder holds product requirements and implementation context for Complex Noise upgrades.

## Documents

| File | Purpose |
|------|---------|
| [PRODUCT_REQUIREMENTS.md](./PRODUCT_REQUIREMENTS.md) | Original product requirements, acceptance criteria, and PR expectations for the Still Theme / Field / EQ work |
| [FINDINGS_AND_CONTEXT.md](./FINDINGS_AND_CONTEXT.md) | Analysis of the codebase at the time of the Still upgrades, architecture notes, and implementation guidance |

## Current status (main + modular refactor)

The Still Theme, Still Field, and Still EQ features from the original requirements have been merged to `main`.

A subsequent modularisation (`refactor/modularize-for-ai-agents`) splits the former single `index.html` into focused ES modules under `js/` and `css/` so AI coding agents can operate on one concern at a time without loading a 40 kB monolith.

Noise types and full accessibility remain out of scope for these upgrades.

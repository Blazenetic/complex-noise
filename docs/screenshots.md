# Screenshots Catalog

**Purpose**

Stable reference for the screenshot set used in the root README, `docs/info-layer.md`, learning material, and branding. This is a learning repository as well as a product, so the images must also illustrate interesting internals (residual outline floor, φ-offset modes, Field Lab chips, immersion cluster, battery-aware field) without turning the docs into a gallery.

**Principles**
- Coverage over quantity. Keep ≤13 images.
- Product first: hero → immersion → Field Lab → instrumentation → residual / φ variety.
- Dark / bone pairs where they earn their place.
- Prefer real defaults or one clear intentional state (Brown preferred, field alive).
- Static PNGs only under `docs/screenshots/`. No runtime cost.
- Lab Voice only in captions on narrative surfaces; this file and AGENTS.md stay sterile.

**Capture**

The Playwright helper `scripts/capture-screenshots.mjs` re-uses `tests/server.mjs`, captures at deviceScaleFactor 2 and sequences the product state deterministically. The current set was produced from `main` after the deeper Still Field traversal. Re-run it when the interface changes, then review every PNG and update embeds and captions in the same PR.

## Final set (13 images)

### A. Product heroes & immersion

| Filename | Purpose | Primary use |
|----------|---------|-------------|
| `hero-dark.png` | Primary hero — full UI, dark theme, Brown playing, field on | README top hero |
| `hero-bone.png` | Matching bone theme hero | README Still Theme section |
| `immersion-desktop.png` | Chrome minimised, living field + residual outlines / callouts / edges | README Look / immersion |
| `immersion-phone.png` | Portrait phone immersion | README phone-first claim |
| `field-lab-full.png` | Complete Field Lab panel with all three overlay chips | README Field Lab, learning |

### B. Instrumentation & learning

| Filename | Purpose | Primary use |
|----------|---------|-------------|
| `info-layer-dark.png` | Live view dominant, distinct φ-offset modes | info-layer.md, README Stats |
| `info-layer-bone.png` | Bone equivalent | info-layer.md, theme contrast |
| `info-layer-transform.png` | Transform-mode callouts with axis colours | info-layer.md |
| `info-layer-math.png` | Math view | info-layer.md |
| `info-layer-code.png` | Code view | info-layer.md |
| `callouts-variety.png` | 4–8 callouts showing different modes + edge dimensions | README residual section, info-layer.md, teaching |

### C. Residual & calm field

| Filename | Purpose | Primary use |
|----------|---------|-------------|
| `residual-outlines.png` | Quiet nodes with soft residual stroke circles still legible | Learning residual floor, marketing calm |
| `quiet-field.png` | Field only, Stats/overlays off | Marketing, “just the noise + field” |

## README visual flow (guidance only)

Hero near top, then Look section (bone + immersion + phone), then Features with residual and Field Lab call-outs, then Stats instrumentation. Captions may carry light Lab Voice; keep them short. Prefer the software staying calm while the captions get to be slightly chaotic. Do not invent new origin claims.

## Success criteria

- Visitor understands free / zero-dep / phone-first / residual outlines / Australian lab personality within 10–15 seconds of scrolling the README.
- info-layer.md screenshots illustrate the contracts they sit beside.
- Images are useful for branding and marketing without looking staged or noisy.
- Learning value is present (φ modes, residual floor, Field Lab chips, immersion cluster) without turning docs into a screenshot dump.
- No new runtime cost, no behaviour change.

## Related

- Capture helper: `scripts/capture-screenshots.mjs`
- Technical contract: `AGENTS.md`
- Info-layer contract: `docs/info-layer.md`

The residual outlines have a floor. The screenshots should show it.

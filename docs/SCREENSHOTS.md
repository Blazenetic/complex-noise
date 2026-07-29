# Screenshots Catalog

**Purpose**  
Stable reference for the screenshot set used in the root README, `docs/INFO_LAYER.md`, learning material, and branding/marketing. This is a learning repository as well as a product, so the images must also illustrate interesting internals (residual outline floor, φ-offset modes, Field Lab chips, immersion cluster, battery-aware field) without turning the docs into a gallery.

**Principles** (from the 2026-07-29 plan)
- Coverage over quantity. Target 9–13 final images.
- Product first: hero → immersion → Field Lab → instrumentation → residual/φ variety.
- Dark / bone pairs where they earn their place.
- Prefer real defaults or one clear intentional state (Brown preferred, field alive).
- Static PNGs only under `docs/screenshots/`. No runtime cost.
- Lab Voice only in captions on narrative surfaces; this file and AGENTS.md stay sterile.

**Capture**  
The Playwright helper `scripts/capture-screenshots.mjs` re-uses `tests/server.mjs`, captures at deviceScaleFactor 2 and sequences the product state deterministically. The current set was produced with that helper. Re-run it when the interface changes, then review the PNGs and update embeds and captions in the same PR.

## Final set

### A. Product heroes & immersion (highest priority for README branding)

| Filename | Purpose | Capture notes | Primary use |
|----------|---------|---------------|-------------|
| `hero-dark.png` | Primary hero — full UI, dark theme, Brown playing, field on | Desktop ~1440×900 or 1280×800, DPR 2. Clean framing. Play button, type grid, volume/timer, EQ summary, theme pill, Still Field card visible. Stats preferably folded or off for cleanliness. | README top hero |
| `hero-bone.png` | Matching bone theme hero | Identical framing and state so the theme switch is obvious. | README Still Theme section, marketing |
| `immersion-desktop.png` | Chrome minimised, living field + residual outlines / callouts / edges | Settled purple restore cluster bottom-right. Wait for residual outlines and at least one edge dimension. | README Look / immersion |
| `immersion-phone.png` | Portrait phone immersion | ~390×844. Residual callouts + edges if possible. Replace/improve the existing phone shot. | README phone-first claim, marketing |
| `field-lab-full.png` | Complete Field Lab panel | All three overlay chips + live “n of 3”, density/reach/trail/perspective/dwell/fps, Reset. Replaces incomplete `field-lab.png`. | README Field Lab, learning |

### B. Instrumentation & learning (INFO_LAYER + deeper README + teaching)

| Filename | Purpose | Capture notes | Primary use |
|----------|---------|---------------|-------------|
| `info-layer-dark.png` | Live view dominant, distinct φ-offset modes | Refresh existing. Source listing + callouts + edges visible. | INFO_LAYER, README Stats |
| `info-layer-bone.png` | Bone equivalent (currently unused) | Promote. | INFO_LAYER, theme contrast |
| `info-layer-transform.png` | Transform-mode callouts with axis colours | Keep/refresh. Strong existing. | INFO_LAYER |
| `info-layer-math.png` | Math view | Keep. | INFO_LAYER |
| `info-layer-code.png` | Code view | Keep. | INFO_LAYER |
| `callouts-variety.png` | 6–8 callouts showing different modes + 1–2 edge dimensions | Wide desktop, Source folded/off so labels have room. Demonstrates the φ-offset claim and residual outlines. High value for learning. | README residual section, INFO_LAYER, teaching |

### C. Optional high-value extras (only if clean; for marketing / deeper learning)

| Filename | Purpose | Capture notes | Primary use |
|----------|---------|---------------|-------------|
| `residual-outlines.png` | Quiet nodes with soft residual stroke circles still legible | Immersion or Stats-light, low-energy nodes visible against the field. | Learning residual floor, marketing calm |
| `quiet-field.png` | Field only, Stats/overlays off | Clean living field, no instrumentation. | Marketing, “just the noise + field” |
| `ultra-glass.png` | Ultra-transparent glass variant of a hero or immersion | Low priority; only if the glass reads clearly. | Theme exploration |
| `type-grid-playing.png` | Type selector with a non-Brown colour active while playing | Shows the six colours and the exclusive press state. | Learning noise colours |

Retire any file that becomes redundant once the new heroes and full Field Lab exist. Keep total ≤13.

## README visual flow (guidance only)

Hero near top, then Look section (bone + immersion + phone), then Features with residual and Field Lab call-outs, then Stats instrumentation. Captions may carry light Lab Voice; keep them short. Prefer the software staying calm while the captions get to be slightly chaotic. Do not invent new origin claims.

## Success criteria

- Visitor understands free / zero-dep / phone-first / residual outlines / Australian lab personality within 10–15 seconds of scrolling the README.
- INFO_LAYER screenshots illustrate the contracts they sit beside.
- Images are useful for branding and marketing without looking staged or noisy.
- Learning value is present (φ modes, residual floor, Field Lab chips, immersion cluster) without turning docs into a screenshot dump.
- No new runtime cost, no behaviour change, single reviewable PR for the image + MD update pass.

## Related

- Live plan: Google Drive “Complex Noise — Screenshots Refresh Plan 2026-07-29.md”
- Capture helper: `scripts/capture-screenshots.mjs` (added in the same prep work)
- Technical contract: `AGENTS.md`
- Info-layer contract: `docs/INFO_LAYER.md`

The residual outlines have a floor. The screenshots should show it.

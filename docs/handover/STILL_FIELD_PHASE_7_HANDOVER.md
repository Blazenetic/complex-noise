# Still Field phase 7 — make the edge-label table bound explicit

Status: implementation and local validation complete; publication in progress

Prepared: 29 July 2026

## Objective

Prevent a future larger Still Field world from silently pinning printed edge
distances or radii at `2000 u`.

## Project

- Repository: `Blazenetic/complex-noise`
- Role: Still Field Phase 7 implementation and PR-readiness handover
- Expected branch: `agent/edge-label-table-bound`
- Expected base or head: `origin/main` at `93fa990`
- Expected Git state: six Phase 7 paths intentionally uncommitted:
  `AGENTS.md`, `CHANGELOG.md`, `docs/info-layer.md`,
  `docs/handover/STILL_FIELD_PHASE_7_HANDOVER.md`,
  `js/still-field/edge-labels.js`, and `tests/run.mjs`

## Authority

- Governing task: the current user request, “Still Field Phase 7 — Edge-label
  table bound”
- Governing decision: retain the existing `2000 u` inclusive allocation budget,
  derive both table lengths from it, and fail before oversized text can paint
- Approval status: implementation, commit, push, and draft PR creation
  authorized; merge, release, and deployment not authorized
- Authorized paths: the edge-label owner, focused tests, matching
  teaching/operator notes, changelog, and this handover

## Read first

1. [`AGENTS.md`](../../AGENTS.md)
2. [`info-layer.md`](../info-layer.md)
3. [`still-field-architecture.md`](../still-field-architecture.md)

## Completed

- `EDGE_MEASUREMENT_MAX = 2000` is the named inclusive measurement ceiling.
- `EDGE_MEASUREMENT_TEXT_LEN` derives both lazy distance and radius table
  lengths as `EDGE_MEASUREMENT_MAX + 1`.
- `assertEdgeMeasurementBound()` checks the live link radius before edge text
  can paint and checks it again only when the radius changes. A value that would
  quantise above `2000 u`, or a non-finite value, throws with the table bound.
- `edgeMeasurementIndex()` owns rounding and clamping for both distance and
  radius lookups. The tracked-pair path still constructs no strings.
- `unit: edge measurement tables guard their bound and clamp indices` proves
  the inclusive bound, derived length, rounding/clamp behaviour, and loud
  failure beyond the printable domain.

The six-slot budget, keep-outs, pair collection, link pass, renderer motion,
lazy first-draw construction, and zero-runtime-dependency model are unchanged.

## Current gate

Commit the six explicit Phase 7 paths, push the dedicated branch, open a draft
PR against `main`, and let GitHub Actions supply the external CI gate.

## Next safe action

For Phase 7, complete draft-PR publication and record its commit, URL, and CI
state here. The next independent item is the Accessibility audit: perform and
record a screen-reader walkthrough and contrast audit separately; do not fold
it into this renderer-bound change.

## Hard stops

- No second graph scan or edge list.
- No per-frame string construction.
- No change to renderer motion, six-slot budget, or keep-out logic.
- No runtime dependency, build step, push, merge, or deployment.

## Exact verification results

```bash
npm test -- --filter="edge"  # 1/1 passed
npm run check                # lint clean; 33/33 passed
git diff --check             # clean
```

The focused test also drives `drawEdgeAnnotations()` with an oversized live
radius and proves the guard throws before touching the canvas.

No overnight profile comparison was run because the two tables remain lazy,
the existing tracked-pair paint path still performs numeric array lookups, and
the only steady-state addition is folded into the existing first-draw/radius
change guard. This is a structural cold-path conclusion, not a measured
performance claim.

## Final Git state

Publication in progress; resolve to `committed and clean`.

## Handover contract

- Preserve the six-file Phase 7 change set and the merged Phase 6 base.
- Update this handover if validation or Git state changes.
- Final Git-state requirement for this session: `committed and clean`.
- Merge, release, and deployment require fresh approval.

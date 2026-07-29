# Still Field phase 3 — execution handover

Status: ready for implementation  
Branch: `agent/still-field-phase-3`  
Base: `main` at `6d01f3ac65cc31ab905162a6e025c8ed036b64cc`  
Prepared: 29 July 2026

This is the working brief for the next Still Field session. Read
[`AGENTS.md`](../AGENTS.md) and
[`STILL_FIELD_ARCHITECTURE.md`](./STILL_FIELD_ARCHITECTURE.md) before editing
code. The architecture document remains the source of truth for module
ownership and dependency direction; this document turns its phase-three
handover into an executable sequence.

## Landed foundation

- [PR #34](https://github.com/Blazenetic/complex-noise/pull/34) split the
  3,327-line renderer into a public facade and one module per concern. It also
  removed a per-frame trail string allocation and cleared link state after a
  discontinuous resize.
- [PR #35](https://github.com/Blazenetic/complex-noise/pull/35) completed the
  information-layer split, made `hud.js` a pure string builder, introduced
  direct unit coverage, normalised mode dwell weights, made grid/link buffers
  grow-only in sixteen-node bands, and deferred 5,034 edge-label strings until
  first use.
- Both PRs were merged with normal merge commits in stack order. The phase-two
  head was `9ac6c10`; the resulting `main` merge commit is `6d01f3a`.
- The phase-two head passed GitHub Actions: 29/29 browser tests and clean ESLint.
  No unresolved review threads remained.
- The renderer module graph was checked as a DAG.

## Phase-three decision

Phase three begins with measurement, not a struct-of-arrays rewrite.

The only recorded stage sample is a desktop run at default settings with 44
nodes and every information overlay enabled:

| Stage | Recorded time |
|---|---:|
| Update | 0.09 ms |
| Links | 0.11 ms |
| Nodes | 0.04 ms |
| Information layer | 0.70 ms |
| Total | 0.94 ms |

This is an observation from one machine, not a benchmark result. It suggests
that the information layer is the first profiling target, but it does not yet
justify an optimisation.

## First session: establish a repeatable baseline

Profile the existing code before changing its behaviour.

### Scenario matrix

Use a settled field and record at least these cases:

| Case | Viewport | Nodes | Information overlays | CPU |
|---|---|---:|---|---|
| Desktop baseline | 1440 × 900 | default | all on | native |
| Desktop stress | 1440 × 900 | 150 | all on | throttled |
| Desktop control | 1440 × 900 | 150 | all off | throttled |
| Mobile stress | representative Android viewport | 150 | all on, interface minimised | throttled |
| Mobile control | same viewport | 150 | all off | throttled |

Keep audio state, frame cap, theme, density, reach and sampling duration
constant across each comparison. Record the actual browser/device or emulation
settings. Warm up before sampling so lazy string-table construction and initial
JIT work do not pollute steady-state figures.

### Measurements

At minimum capture:

- update, links, nodes and information-layer stage times;
- frame total and budget utilisation;
- nodes, pair tests, painted edges, callouts and edge dimensions;
- allocation or heap behaviour where the available browser tooling can measure
  it honestly;
- console and page errors;
- whether the result is native hardware, CPU throttling, or mobile emulation.

Report median and a high percentile or maximum over a stated sample window.
Do not compare isolated HUD frames as though they were stable distributions.

### Split the information layer before optimising it

The current `infoMs` total combines callouts, edge dimensions and the source
ticker. Add temporary or permanent low-overhead sub-stage timings only if they
can be collected without allocations in the render loop. The useful split is:

1. callout selection/content/placement/paint;
2. edge-dimension maintenance and paint;
3. source ticker update and paint.

Prefer accumulating numeric counters into existing telemetry state. Do not add a
second graph scan, construct per-frame arrays, format strings in the loop, or
move DOM work out of `app.js`.

If sub-stage instrumentation becomes permanent, expose it through
`stats.js`, format it in `hud.js`, map it to elements in `app.js`, and
extend the row-coverage test. If it is temporary, remove it before the
optimisation commit and preserve the raw benchmark evidence in this PR.

## Decision gates

Choose the first implementation only after the matrix identifies a material
winner.

### If callouts dominate

Inspect candidate selection, collision tests, keep-out checks and paint
separately. Preserve:

- acquisition/release hysteresis and minimum hold;
- sticky preferred side;
- cached dynamic strings refreshed at one-second cadence;
- pre-sized typed-array candidate and collision storage;
- viewport and source-overlay collision rules.

Do not trade calm, stable placement for a smaller timing number.

### If edge dimensions dominate

Inspect slot liveness, quantised lookup access and paint. Preserve:

- collection inside the existing link pass;
- six-slot cap and freeing of undrawable slots;
- stable kind selection for a pair;
- lookup-table strings rather than per-frame formatting.

Derive or validate the 2,001-entry distance/radius bound if the evidence leads
into this module; do not silently widen tables without measuring memory cost.

### If the source ticker dominates

Separate transcript/value refresh from painting in the measurement. Preserve
the heat-trail decay, folded state, immersion/mobile gating and keep-outs.
`code-lines.js` remains a hand-maintained transcript; verify any touched lines
against the real renderer.

### If node update or paint dominates

Only then prototype struct-of-arrays for the hot numeric fields. Treat it as a
separate commit with before/after numbers. Do not partially split the node model:
`makeNode()` remains one coherent representation until the full access pattern
and the callout row-cache boundary are accounted for.

A struct-of-arrays patch must demonstrate a meaningful improvement under the
150-node throttled cases and remain readable enough to maintain. If the gain is
noise, discard the prototype.

## Secondary seams, only when earned by the main work

- `nodes.js` reaches into `edge-labels.js` to release slots after a
  population change. Do not invent an event system for this one call. Revisit it
  only if phase three independently needs a lifecycle hook.
- Add a consistency guard for `CODE_SLOT` names only if work already touches
  the source transcript/value refresh path.
- Add the inverse HUD mapping guard—elements mapped to keys no builder
  produces—if HUD instrumentation is extended.

These are valid improvements, but none outranks identifying the real frame-cost
winner.

## Non-negotiable invariants

- Static, client-side, zero runtime dependencies and no build step.
- `app.js` remains the sole writer to app DOM elements.
- State objects have one writer; imports remain a DAG.
- No direct `localStorage`; continuous controls use throttled persistence.
- Render-loop work remains allocation-free where documented.
- Motion, smoothing and decay remain elapsed-time based.
- Discontinuous node movement clears affected link state.
- No second graph scan for telemetry or annotations.
- Field and information canvases retain their separate responsibilities.
- Reduced motion, touch targets, accessibility labels and keep-outs remain
  intact.
- Overnight playback, timer deadlines, wake-lock safety and audio loudness are
  outside the blast radius of a visual optimisation.

## Validation for every implementation commit

Run the narrowest relevant test first, then:

```bash
npm run lint
npm test
git diff --check
```

When module boundaries move, run the DAG checker from
[`STILL_FIELD_ARCHITECTURE.md`](./STILL_FIELD_ARCHITECTURE.md). For visual or
interaction changes, inspect the running app over HTTP in a real browser and
check console/page errors. Do not claim visual equivalence from static review.

For performance work, include in the PR:

- exact scenario and tool settings;
- before/after numbers from the same environment;
- functional checks;
- any memory trade;
- what was tried and discarded;
- remaining uncertainty.

## Recommended commit sequence

1. `docs: establish phase-three baseline and profiling protocol`
2. `perf(still-field): expose measured info sub-stages` — only if needed
3. `perf(still-field): optimise <measured winner>`
4. `test(still-field): guard the optimised invariant`
5. `docs: record phase-three evidence and outcome`

Keep measurement, implementation and behavioural changes separable in review.
Stop after the smallest change that produces a repeatable material improvement.

## Definition of done

Phase three is complete when:

- the profiling matrix and environment are documented;
- the dominant cost is identified with repeatable evidence;
- one focused optimisation is either landed with a meaningful improvement or
  explicitly rejected because the gain is noise;
- 29/29 existing tests remain green, plus focused regression coverage for any
  new invariant;
- lint, diff check and DAG check pass;
- no console/page errors or unintended visual/interaction changes are present;
- architecture and handover docs record the result and the next honest step.

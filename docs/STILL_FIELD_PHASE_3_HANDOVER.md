# Still Field phase 3 — execution handover

Status: implementation complete; ready for review
Branch: `agent/still-field-phase-3`  
Base: `main` at `6d01f3ac65cc31ab905162a6e025c8ed036b64cc`  
Prepared: 29 July 2026

This is the working brief for the next Still Field session. Read
[`AGENTS.md`](../AGENTS.md) and
[`STILL_FIELD_ARCHITECTURE.md`](./STILL_FIELD_ARCHITECTURE.md) before editing
code. The architecture document remains the source of truth for module
ownership and dependency direction; this document turns its phase-three
handover into an executable sequence.

## Phase-three outcome

The source ticker was the measured winner. The production change caches its
stable transcript body in a lazy scratch bitmap and keeps the heat wash, active
accent, gutter, header and footer live. It does not change the public API, user
controls, graph scan or mobile path.

The benchmark is now reproducible:

```bash
npm run profile:still-field
npm run profile:still-field -- --filter=desktop-150-source
PROFILE_ROOT=/path/to/before-worktree npm run profile:still-field
```

`tests/profile-still-field.mjs` uses a fixed random seed, an eight-second warmup
and 48 observations over twelve seconds. Stress cases use Chromium's 4× CPU
throttle. The 150-node cases deliberately inject the renderer's documented hard
ceiling from DevTools rather than widening the Field Lab's user-facing range.
Reported percentiles are distributions of the renderer's smoothed telemetry
sampled every 250 ms, not raw-frame percentiles.

### Environment

- Linux x86_64 container; Node 24.14.0; Playwright 1.62.0.
- Headless Chromium 149.0.7827.0; device pixel ratio 1.
- Desktop 1440 × 900; mobile 412 × 915.
- Audio paused; dark theme; 30 fps cap; default reach, trail and depth.
- Mobile stress/control minimised the interface. All runs checked console and
  page errors; none were reported.

### Baseline decision

Median stage times, in milliseconds:

| Scenario | Update | Links | Nodes | Info | Total |
|---|---:|---:|---:|---:|---:|
| Desktop, default 44, all overlays, native | 0.037 | 0.099 | 0.022 | **0.366** | 0.530 |
| Desktop, 150, all overlays, 4× | 0.177 | 0.900 | 0.206 | **1.949** | 3.281 |
| Desktop, 150, no overlays, 4× | 0.214 | 0.831 | 0.172 | 0.050 | 1.289 |
| Mobile, 150, all overlays, 4× | 0.111 | **0.840** | 0.212 | 0.682 | 1.845 |
| Mobile, 150, no overlays, 4× | 0.129 | **0.739** | 0.191 | 0.057 | 1.139 |

The focused desktop controls isolated the information sub-stages without adding
timers to production:

| 150 nodes, 4× CPU | Info median | Info p95 | Visible annotations |
|---|---:|---:|---:|
| None | 0.050 ms | 0.105 ms | — |
| Callouts only | 0.744 ms | 1.032 ms | 5 |
| Dimensions only | 0.670 ms | 0.797 ms | 5 |
| Source only | **1.154 ms** | **1.423 ms** | 24 source lines |

This ruled out a struct-of-arrays rewrite: node update and paint were not the
dominant costs. It also showed why the wide-screen source listing, not the
mobile overlays, was the focused first optimisation.

### Before and after

The matched, seeded source-only stress case is the clean comparison:

| Metric | Before | After | Change |
|---|---:|---:|---:|
| Source info median | 1.154 ms | 0.881 ms | **−23.7%** |
| Source info p95 | 1.423 ms | 1.049 ms | **−26.3%** |
| Whole frame median | 2.419 ms | 2.113 ms | **−12.6%** |
| Whole frame p95 | 2.772 ms | 2.429 ms | **−12.4%** |

At the native 44-node default, the all-overlay median moved from 0.366 to
0.345 ms for the info stage and from 0.530 to 0.492 ms for the whole frame.
The mobile all-overlay control was effectively unchanged (0.682 → 0.687 ms);
the listing is hidden below 1000 px, so the cache is neither constructed nor
consulted there.

The trade is explicit. The scratch bitmap is allocated only for a visible,
expanded, wide-screen source listing: about 434 KiB at DPR 1 and 1.7 MiB at the
renderer's DPR 2 cap. Browsers without `OffscreenCanvas` retain the old direct
paint. The live code still owns heat decay, stage rails, the active accent,
header and footer; only the stable line numbers, transcript and once-per-second
value strings are rasterised into the cache.

### Discarded experiment

The first cache prototype re-rasterised three text columns per warm line to
reproduce the old alpha equations exactly. Across repeated source-only runs it
improved the median by only about 6% and did not move p95 reliably—too small for
the memory trade. The landed version brightens a cached row with one bitmap
draw and retains the source-text accent overprint. It produced the material,
repeatable result above and remained visually equivalent in dark-theme
before/after browser captures.

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

Validation on the phase-three head:

- 30/30 browser tests passed, including the new source-cache invariant;
- ESLint, `git diff --check` and the 31-module DAG check passed;
- deterministic dark-theme before/after captures were inspected at 1440 × 900;
- every profiling scenario reported an empty console/page-error list.

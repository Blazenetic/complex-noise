# Still Field phase 4 — post-merge review of phases 1–3, and what is left

Status: review complete; fixes landed
Base: `main` at `65ef1d0` (the merge of [PR #36](https://github.com/Blazenetic/complex-noise/pull/36))
Reviewed: [PR #34](https://github.com/Blazenetic/complex-noise/pull/34),
[PR #35](https://github.com/Blazenetic/complex-noise/pull/35),
[PR #36](https://github.com/Blazenetic/complex-noise/pull/36)
Prepared: 29 July 2026

Read [`AGENTS.md`](../AGENTS.md) and
[`STILL_FIELD_ARCHITECTURE.md`](./STILL_FIELD_ARCHITECTURE.md) before editing
code. This document records what the review of the three-PR refactor checked,
what it changed, and — at least as usefully — what it deliberately did not.

---

## What the review actually checked

The refactor moved 3,327 lines into 22 modules across three PRs. The risk in a
move that size is not that a module is badly designed; it is that a line changed
meaning while it was being carried. So the review was mechanical first:

1. **Function-by-function equivalence.** The pre-refactor `js/still-field.js`
   was extracted at `e6c9d45` and every substantial function — `drawLinks`,
   `drawNodes`, `drawCallouts`, `drawEdgeAnnotations`, `trackEdgeAnnotation`,
   `drawCodeTicker`, `refreshCodeValues`, `layoutCodeTicker`, `drawInfoLayer`,
   `getStillFieldStats`, every setter — was diffed against its new home. **Every
   difference was a rename, a destructure, or a change the PRs described.** No
   arithmetic moved. That is the single most important finding here and it is
   worth stating plainly: the split did what it said it did.
2. **The dependency graph.** Re-derived from the imports: 22 modules, no cycles.
3. **Index-space safety.** `population.links` is indexed `i·n + j` against the
   live node count while `ensureLinkCapacity()` sizes it in bands of sixteen;
   `grid.items` / `grid.cellOf` are banded the same way. Every call path that
   changes the population was traced to confirm the buffer is grown *before* the
   pass that indexes it. All correct.
4. **Live behaviour.** The app was driven in Chromium at DPR 1 and DPR 2, 1440 ×
   900 and 700 × 900, through density sweeps, viewport changes, every overlay
   toggle, Stats off/on and field off/on, watching the public stats snapshot and
   the console. No errors, no stuck state, no leaked counters.

---

## What changed

Three defects, all in the same family: **a claim the code makes about itself
that the code does not keep.** This project's whole instrumentation argument is
that a measurement you can read is better than a comment you have to trust, so
these are not cosmetic.

### 1. The transcript raster was allocated conditionally and freed never

`code-ticker.js` rasterises the listing's stable 24-line body into an
`OffscreenCanvas`: **434 KiB at DPR 1, 1.7 MiB at the renderer's DPR 2 cap.**
Phase 3 justified that explicitly — "allocated only for a visible, expanded,
wide-screen source listing" — and measured a real 23.7% median win for it.

The allocation was conditional. Nothing released it. Folding the listing,
switching the overlay off, narrowing below the 1000 px threshold, turning Stats
off, switching the field off and hiding the page all left the bitmap resident.
The concrete case this matters for is the one the whole renderer is written
around: **a phone locked at 3 a.m. held 1.7 MiB for an overlay that had stopped
drawing hours earlier**, in an app whose loop is otherwise stopped outright while
the page is hidden precisely so it costs nothing.

Fixed in `code-ticker.js`:

- `layoutCodeTicker()` releases the raster whenever the listing is not printing
  its transcript — no corner, overlay off, viewport too narrow, or folded. The
  corner search moved into `findCodeCorner()` so there is one place that decides,
  rather than four early returns each needing to remember.
- `forgetCodeTicker()` releases it *and* clears `codeVisible`, and is called from
  `stopLoop()` — the one point every way of stopping the loop converges on — and
  from the render loop's Stats-off branch.

Clearing `codeVisible` fixes a second, smaller thing on its own. `codeVisible`
and the corner it records are only refreshed while the info layer is drawing, so
after the loop stopped they stayed frozen at the last frame's values. That left
`handleOverlayPointer()` with a live fold hit-target over a listing that was no
longer painted — press the background where the listing used to be with the
intensity slider at zero, and the fold state changed invisibly.

Re-earning the raster costs one allocation and one re-raster, which is what a
theme change or a DPR change already costs. Guarded by a new browser test that
walks the whole lifecycle: earn → fold → re-earn → narrow → re-earn → field off.

### 2. The Buffers row counted one buffer

`hud.js` printed `${linkBytes} KiB · 0 alloc/frame`. `linkBytes` is the link
buffer alone. The grid's five typed arrays sat beside it uncounted, and after
phase 3 so did up to 1.7 MiB of transcript raster — so the row read `36.0 KiB`
on a page holding closer to two megabytes. A row whose entire purpose is to state
the renderer's memory claim where it can be argued with should not be the thing
hiding the largest number.

`stats.js` now reports `linkBytes`, `gridBytes` and `rasterBytes`, and the row
reads `9.7 KiB · 1.69 MiB raster · 0 alloc/frame`, collapsing to
`9.7 KiB · 0 alloc/frame` when the raster is released. That difference is visible
in the panel, which is how the fix above is checked from the UI rather than from
a comment. `hud.formatBytes()` is pure and unit-tested.

### 3. `edgeSlots` counted slots it had just handed back

`drawEdgeAnnotations()` incremented its `held` counter at the top of the slot
loop and released dead slots further down the same iteration, so the panel
reported dimensions held over a field holding none of them for a frame after each
release. This is the same shape as the stale count phase 2 fixed in
`drawInfoLayer()` (`9ac6c10`, "make phase-two invariants honest") and it is
fixed the same way: count below the release, not above it.

Not separately tested — reproducing it means catching one frame, and a timing
race is a worse guard than the corrected arithmetic. Reviewed by reading.

### 4. Documentation

`js/still-field.js`'s own module map listed 20 of the 22 modules — it had never
been updated when phase 2 split out `callout-content.js` and `code-lines.js`.
`AGENTS.md` and the architecture document were already correct; only the front
door disagreed with itself.

---

## What was checked and deliberately not changed

These are all real observations. None of them earned a change, and the reasoning
matters more than the list, because the next session will see them again.

- **Edge-dimension slots above `edgeSlotCapacity()` after a viewport narrowing.**
  Narrowing from ≥ 720 px drops the cap from six to two. Slots 2–5 keep their
  pairs but are no longer scanned by `trackEdgeAnnotation()`, so they are never
  re-marked seen — which means they fade out and free themselves within a couple
  of seconds. The self-healing path is the correct one; adding an explicit reset
  would be more code for the same outcome.
- **`held` is a frame behind after a `resetEdgeSlots()`.** Same class as (3),
  bounded by one frame of a 250 ms readout. Below the noise floor of the panel.
- **`hitsEdgeLabel()` uses the caption's half-height where `trackEdgeAnnotation()`
  uses its half-width.** Inconsistent-looking, and both are deliberate: the
  candidate test bounds an unknown rotation with a disc, the collision test knows
  the box. Documented in place. Left alone.
- **`lastFrameMs` and `lastDrawMs` in `loop.js` are always assigned the same
  value**, so `dt` could be derived from one of them. Collapsing them would save
  a variable and lose the distinction between "when did we last integrate" and
  "when did we last honour the cap", which is the thing a future frame-pacing
  change will need. Left as two.
- **The 45 fps cap delivers ~30 fps on a 60 Hz display.** Arithmetic, not a bug:
  a 22.2 ms interval cannot be honoured by a 16.7 ms clock without skipping every
  other frame. Worth *saying* in the Lab someday; not worth changing the pacing
  for, since motion is integrated from elapsed time and looks correct either way.
- **`telemetry.respawns` and `clock.real` are lifetime totals**, so `turnover` is
  a lifetime mean rather than a recent rate. This is deliberate and the row says
  "observed". A windowed rate would read as noise.
- **`publishEnergy()` can leave `--still-energy` at up to 0.002** when the field
  is switched off, because the epsilon that rations style recalculation also
  rations the final write. Invisible, and the ration is load-bearing.
- **Struct-of-arrays.** Still not earned. Phase 3's matrix put links, not node
  update or paint, as the largest non-information stage, and its median stayed
  under a millisecond at the 150-node ceiling under 4× throttling. Re-run
  `npm run profile:still-field` on the target device before spending readability
  on it.

---

## What a later session should pick up

In rough order of value.

1. **Re-run the profiler with the raster release in place.** The release adds one
   allocation and one re-raster per fold/unfold and per loop restart. That is
   expected to be unmeasurable against the 0.881 ms steady-state info median, but
   it is an assumption and the harness exists to check assumptions:
   `npm run profile:still-field -- --filter=desktop-150-source`, and
   `PROFILE_ROOT` at a pre-change worktree for the matched comparison. If the
   fold path turns out to matter, the answer is a short grace period before the
   release, not putting the leak back.
2. **The inverse HUD mapping guard.** `tests/run.mjs` catches a `hud.js` row key
   with no element in `app.js`. It does not catch an element mapped to a key no
   builder produces — that row silently keeps whatever `index.html` seeded it
   with. Phase 2's handover named this and it is still open; it is now slightly
   more earned, because this PR touched the row set.
3. **A `CODE_SLOT` consistency guard.** `code-lines.js` addresses live-value slots
   by index and `refreshCodeValues()` fills them by index, with nothing tying the
   two together. Adding a line with the wrong slot number prints the wrong number
   against the right statement, confidently. Phase 3's handover named this too.
4. **`edge-labels.js` sizes its distance and radius tables at 2,001 by
   assumption.** The clamp is safe, but a large enough world silently pins the
   printed value at `2000 u`. Deriving the bound from the world plane, or
   asserting it, is a small honest fix.
5. **Accessibility audit.** Named in `docs/README.md` as outstanding since well
   before this refactor: controls are labelled and touch targets clear 44 px, but
   no screen-reader walkthrough or contrast audit beyond reduced-motion support
   has been done. Nothing in the renderer split touched it; it is simply the
   largest known gap in the project.

---

## Non-negotiable invariants (unchanged from phase 3)

- Static, client-side, zero runtime dependencies and no build step.
- `app.js` remains the sole writer to app DOM elements.
- State objects have one writer; imports remain a DAG.
- No direct `localStorage`; continuous controls use throttled persistence.
- Render-loop work remains allocation-free where documented.
- Motion, smoothing and decay remain elapsed-time based.
- Discontinuous node movement clears affected link state.
- No second graph scan for telemetry or annotations.
- Field and information canvases retain their separate responsibilities.
- Reduced motion, touch targets, accessibility labels and keep-outs stay intact.
- Overnight playback, timer deadlines, wake-lock safety and audio loudness are
  outside the blast radius of a visual change.

And one added by this pass:

- **A conditional cache must be conditional in both directions.** If a scratch
  surface is allocated lazily because "only some sessions pay for it", it must
  also be released when the session stops qualifying — and reported in
  `stats.js`, so the claim is checkable from the panel rather than the comment.

---

## Validation on this head

```bash
npm run lint      # clean
npm test          # 31/31, including the new raster-lifecycle test
git diff --check  # clean
```

- The 22-module DAG check was re-run after the new `stats.js → code-ticker.js`
  and `loop.js → code-ticker.js` edges. Still acyclic; both point down the layer
  order (`stats.js` is allowed to know about everything, and `loop.js` already
  drove the ticker).
- Driven in Chromium at DPR 1 and DPR 2 with an empty console/page-error list:
  the raster lifecycle was observed through the Buffers row across fold, unfold,
  narrow, widen, Stats off/on and field off/on.
- The edge-dimension readout was watched for 24 s in immersion mode at 1440 × 900
  to confirm `shown` tracks `held` (4–6 of 6) rather than settling at the
  "every slot held, nothing on screen" state the phase-2 blocked-slot fix
  removed. It does.

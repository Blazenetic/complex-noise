# Still Field phase 5 — close the HUD contract in both directions

Status: implementation complete; browser CI pending

Base: `main` at `49be3f2` (the merge of PR #37)

Prepared: 29 July 2026

Read [`AGENTS.md`](../AGENTS.md) and
[`STILL_FIELD_ARCHITECTURE.md`](./STILL_FIELD_ARCHITECTURE.md) before editing
code. This brief supersedes the phase-four handover as the active starting
point; phase four remains the full review record.

---

## What this phase closes

Phase 2 made `hud.js` pure: builders return keyed strings and `app.js`, the sole
DOM writer, maps those keys to elements. The existing browser guard caught one
direction of drift. Add a builder key without an element and the row stayed on
the `—` seeded by `index.html`, so the test named it.

The inverse remained silent. Remove a builder key but leave its element in the
app-side map and that retired row also stayed on a plausible `—`. Nothing threw,
and the interaction test could not distinguish it from an intentionally
unavailable value.

`hud.js` now owns frozen key sets for the Live rows, meters, Math rows and Code
stages. `app.js` passes all four DOM maps through `defineRowMap()` once while the
module loads. Missing and extra keys are both named in the thrown error. This is
boot-time work only; no validation or allocation was added to the 250 ms panel
tick or the render loop.

The pure HUD unit test independently checks that each builder emits exactly its
declared key set and exercises both error directions. The existing interaction
test stays because it proves the running application actually paints every
mapped element, not merely that two object shapes agree.

## The profiler question is tracked, not guessed

The first phase-four action was to re-run
`desktop-150-source` after PR #37 added the raster release. The hosted Work Mode
runtime has Playwright but cannot install its pinned Chromium: the CDN response
is an empty/truncated archive. Test discovery succeeded; no performance result
was claimed.

[Issue #38](https://github.com/Blazenetic/complex-noise/issues/38) carries the
target-machine command, matched `PROFILE_ROOT` comparison, evidence to record,
and decision rule. Keep immediate release unless normal fold/restart use produces
a measurable cost; if it does, evaluate a short grace period, never an
indefinitely retained bitmap.

## Validation

Local evidence available in the hosted runtime:

```bash
npm run lint
npm test -- --list
git diff --check
```

The full browser suite must pass in GitHub Actions before this PR is considered
ready. Test discovery is not recorded as a browser pass.

## Next independent PRs

1. **`CODE_SLOT` consistency guard.** Tie every live slot referenced by
   `code-lines.js` to the values populated by `refreshCodeValues()`. A wrong
   index currently prints the wrong number against the right statement with no
   error.
2. **Edge-label table bound.** Replace or assert the implicit `2001` distance
   and radius ceiling so a larger future world cannot silently pin its printed
   measurement at `2000 u`.
3. **Accessibility audit.** Perform a screen-reader walkthrough and contrast
   audit, recording environment, failures and fixes. This is larger than the two
   consistency guards and should not be folded into either.
4. **Target-browser raster profile.** Close issue #38 with measurements when a
   representative Chromium environment is available.

Keep these separate. None requires a state redesign, a second graph pass,
struct-of-arrays, or a new dependency.

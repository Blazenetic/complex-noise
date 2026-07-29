# Still Field phase 6 — give the source listing a checked vocabulary

Status: implementation and local validation complete; draft PR pending

Base: `origin/main` at `509fe6e`

Prepared: 29 July 2026

Read [`AGENTS.md`](../../AGENTS.md) and
[`still-field-architecture.md`](../still-field-architecture.md) before editing
code. This brief supersedes the phase-five handover as the active starting
point; phases four and five remain the review and HUD-contract records.

---

## What this phase closes

The source overlay pairs twenty-one transcript lines with live renderer values,
plus one footer summary. Before this phase, `code-lines.js` carried bare slot
integers and `refreshCodeValues()` populated a separate array by bare integer.
Both sides could be the right length while still disagreeing about meaning. A
swapped index printed a real number beside a real statement, confidently and
without an error.

`code-lines.js` now owns an ordered, named vocabulary in `CODE_VALUE_KEYS` and
`CODE_VALUE_SLOT`. Transcript lines use those names rather than literals. A
module-load check proves that every non-summary value appears on exactly one
line; a duplicate necessarily identifies the value it displaced.

`code-ticker.js` supplies its once-per-second formatters through
`defineCodeValueMap()`, which rejects missing and extra names at boot and returns
them in slot order. The renderer therefore pays twenty-two small function calls
on the existing one-second refresh cadence, while the visible per-frame paint
path retains the same integer array lookup and allocation profile.

This is intentionally not code generation. The transcript is still a
hand-maintained explanation of the renderer and must still be reviewed against
the owner modules. The guard closes the machine-checkable wiring seam without
pretending the prose can verify itself.

## Validation

Local evidence:

```bash
npm test -- --filter="source listing values"  # 1/1 passed
npm run check                                 # lint clean; 32/32 passed
git diff --check                             # clean
```

The focused test imports the data module directly, verifies the named-to-integer
ordering, proves every line slot is unique and complete, and exercises missing
and retired producer failures. The normal application boot covers the real
`code-ticker.js` producer map because a mismatch throws during module loading.

Earlier full-suite attempts reported 31/32 because
`callouts on screen read different quantities from each other` observed only
two modes during one timing window and only three callouts during another. That
unrelated test passed five consecutive focused repetitions, and the
CI-equivalent check passed completely on its final run. No renderer, callout or
timing code changed in this phase.

## Next independent PRs

1. **Edge-label table bound.** Replace or assert the implicit `2001` distance
   and radius ceiling so a larger future world cannot silently pin its printed
   measurement at `2000 u`.
2. **Accessibility audit.** Perform a screen-reader walkthrough and contrast
   audit, recording environment, failures and fixes.

Keep these separate. Neither requires a state redesign, another graph pass,
struct-of-arrays, or a new dependency.

## Current gate

Publish a draft PR and let GitHub Actions supply the external CI gate.

## Hard stops

- Do not merge or deploy from this handover.
- Do not broaden this guard into transcript generation or renderer changes.
- Preserve the zero-runtime-dependency, no-build static architecture.

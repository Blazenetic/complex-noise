---
name: complex-noise
description: Orient, plan, implement, validate, review, and hand off work in the Blazenetic/complex-noise repository. Use when a request names Complex Noise, changes its audio engine or Still Field, investigates its tests or CI, updates its documentation or screenshots, resumes a repository handover, or asks an agent to make this zero-runtime-dependency sleep-noise project easier to operate.
---

# Operate Complex Noise

Preserve overnight playback, stable loudness, battery discipline, and the
zero-runtime-dependency static architecture while completing the requested
work.

## Orient before acting

1. Resolve the repository root with `git rev-parse --show-toplevel`.
2. Read `AGENTS.md` completely. It is the architectural contract.
3. Read `.codex/FRESH_SESSION.md`, then discover the newest applicable
   feature-specific handover as it directs.
4. Capture `git status --short --branch`, recent commits, upstream divergence,
   and `git worktree list`.
5. Treat existing changes as user-owned. Stop writes if branch, base, dirty
   state, or active-task expectations conflict materially with the handover.
6. State authority, exact write scope, hard stops, acceptance gate, and the
   first safe action before material edits.

For the repository's reusable commands, task router, validation matrix, and
handover template, read
[docs/agent-operations.md](../../../docs/agent-operations.md). Read only the
task-specific source documents that its router selects.

## Classify the work

- For explanation, diagnosis, readiness, and review, remain read-only.
- For planning, write only accepted planning or handover records.
- For implementation, require the user's current request or a repository record
  to authorize the exact change.
- Treat push, PR mutation, merge, release, deployment, Drive updates, and
  screenshot replacement as separate external gates.

## Implement in reviewable units

1. Read the owner module and its tests before editing.
2. Keep state ownership singular and imports acyclic. Compose cross-module side
   effects in `js/still-field.js`; keep `app.js` as the sole app DOM writer.
3. Add no build step or runtime dependency without explicit approval.
4. Preserve time-based motion, allocation budgets, hidden-page shutdown,
   transparent trail rendering, periodic audio buffers, wake-lock cleanup, and
   absolute sleep-timer deadlines.
5. Put arithmetic in direct module tests; use browser tests for integrated
   behaviour. Poll app state instead of asserting against host wall-clock time.
6. Update the matching architecture or feature document when a contract,
   default, metric, or operator workflow changes.

## Validate proportionally

Run focused checks first. Before a reviewable code handoff, run:

```bash
npm run check
git diff --check
```

Use `npm run test:list`, `npm run test:serial`, or a filtered `npm test -- ...`
while iterating. Treat `npm run profile:still-field` as comparative evidence,
not a pass/fail gate. For renderer performance claims, use the same harness,
browser, scenario, DPR, and environment before and after.

If only Markdown or allow-listed documentation changed, `npm run lint` plus
`git diff --check` is normally proportionate; disclose that the browser suite
was not run. Workflow, package, script, or `.agents/` changes count as code and
receive the full gate.

## Finish durably

Lead with the outcome. Report:

- material files and behavioural impact;
- exact commands and results;
- branch, dirty paths, divergence, and whether the state is committed;
- remaining gate and the authority required to cross it;
- the current handover record, updated when another agent will continue.

Label the final Git state exactly as `committed and clean`, `intentionally
uncommitted with handover`, or `blocked with files preserved`.

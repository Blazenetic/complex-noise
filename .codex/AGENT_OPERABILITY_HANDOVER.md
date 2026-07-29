# Agent Operability Handover

## Objective

Make Complex Noise safer and faster for AI agents to orient, change, validate,
and hand off without relying on stale chat or milestone context.

## Project

- Repository: `Blazenetic/complex-noise`
- Role: zero-dependency static browser sleep-noise application
- Expected branch: `agent/agent-operability`
- Expected base: `origin/main` at `12ec580`
- Expected Git state: intentionally uncommitted with handover until publication

## Authority

- Governing request: create a project skill and improve repository, workspace,
  agent instructions, and CI support for future AI-agent work
- Governing decision: keep the skill repository-owned and make local and CI
  validation use the same command
- Approval status: implementation, relocation to a fresh main-based branch,
  commit, push, and dedicated draft PR creation are authorized; merge and
  deployment are not authorized
- Authorized categories: agent instructions, project skill, operational docs,
  package scripts, CI, and handover records

## Read First

1. `AGENTS.md`
2. `.agents/skills/complex-noise/SKILL.md`
3. `docs/agent-operations.md`

## Completed

- Added the repository-owned `complex-noise` skill with UI metadata.
- Added task routing, validation, authority, concurrency, and handover guidance.
- Replaced the obsolete PR #16 fresh-session brief with a stable entry point.
- Added `test:list`, `test:serial`, and CI-equivalent `check` npm commands.
- Expanded lint coverage to repository scripts.
- Kept lint valid on main-based branches where `scripts/` is absent by allowing
  unmatched ESLint patterns.
- Changed CI to call the same `npm run check` command used at handoff.

## Current Gate

- Review the dedicated draft PR from `agent/agent-operability`; CI and human
  review are the remaining acceptance gates.

## Next Safe Action

Inspect the draft PR diff and CI result. Merge remains a separate external
action requiring fresh approval.

## Hard Stops

- Do not merge or deploy without fresh approval.
- Do not mutate, mark ready, or merge screenshot PR #45 as part of this task.
- Do not skip CI: workflow, package, script, and `.agents/` changes count as
  code under the repository contract.
- Do not add a runtime dependency or build step.
- Do not discard the current uncommitted files when changing branches or
  worktrees.

## Verification

```text
skill quick_validate.py: passed
npm run test:list: passed; 31 tests listed
npm test -- --filter='callouts on screen read different quantities' --repeat=3:
passed; 3/3 repetitions
npm run lint: passed, including scripts/ when present
npm run check: passed; 31/31 in 15.2s (4 workers)
git diff --check: passed
```

## Handover Contract

- Preserve: all current uncommitted agent-operability paths; the completed
  screenshot commits remain isolated on `agent/refresh-depth-screenshots`
- Update before finishing: this record if branch, scope, validation, or commit
  state changes
- Final Git-state requirement: committed and clean after draft PR publication
- External actions requiring fresh approval: merge, release, deployment, and
  any screenshot PR mutation

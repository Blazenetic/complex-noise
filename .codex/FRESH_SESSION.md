# Fresh Codex Session Brief

## Objective

Review and iterate on the current-main integration of the richer Still Field
information layer; do not return to the stale PR #15 implementation.

## Project

- Repository: `Blazenetic/complex-noise`
- Role: zero-dependency static browser sleep-noise application
- Expected branch: `codex/field-lab-integration`
- Expected base: `origin/main` at `a6ab2f3`
- Implementation commit: `50be023`
- Expected Git state: committed and clean after the handover commit

## Authority

- Governing task: integrate the previous visualisation/nerd-stat ideas into
  current remote `main`, with tests, documentation and a reviewable PR.
- Governing decision: selectively extend the existing Info labels layer; do
  not merge, rebase or cherry-pick stale PR #15 wholesale.
- Approval status: implementation and draft-PR publication authorized.
- Authorized categories: Still Field canvas/state, existing information HUD,
  related markup/styles, browser tests and visualisation documentation.

## Read First

1. `AGENTS.md`
2. `docs/INFO_LAYER.md`
3. `js/still-field.js`, then the Info layer section of `js/app.js`

## Completed

- Existing `#nerdHud` upgraded to keyboard-navigable Live / Math / Code views.
- Live view adds renderer work, graph topology, health, analyser meters and
  travelling-wave data while keeping DOM updates at 250 ms.
- Canvas callouts now have stable lifetime node IDs, five eight-second detail
  modes, one-second text caching, adaptive 6/4 caps and collision checks.
- Up to three edge annotations expose real 3D distance and projected angle from
  inside the existing link scan; no second O(n²) pass was added.
- README, contributor guidance and the documentation index were reconciled.
- Visual checks covered Dark/Bone, desktop/390×844, full/minimised and
  paused/playing states.

## Current Gate

- Local gate review decision: `APPROVE`.
- Draft PR: [#16 — Upgrade the Still Field information layer](https://github.com/Blazenetic/complex-noise/pull/16)
- The PR is mergeable and CI was queued at handover; merge and deployment
  remain separately gated.

## Next Safe Action

Inspect the draft PR diff and CI. Address review findings on this branch without
touching the preserved `codex/procedural-telemetry` reference branch or PR #15.

## Hard Stops

- Do not merge or deploy without fresh approval.
- Do not replace the integrated Info layer with PR #15's separate Field Lab.
- Do not add a second graph scan, per-frame DOM writes, a build step, runtime
  dependency, or audio-behaviour changes.
- Preserve 30 fps, hidden-page shutdown, transparent canvas clearing,
  reduced-motion behaviour, lifecycle fades and chrome keep-outs.

## Verification

```text
npm run lint    passed
npm test        33/33 passed
git diff --check passed
Browser verification passed in Dark/Bone, desktop/phone, full/immersed,
paused/playing, including Math view fit at 390×844.
```

## Handover Contract

- Preserve: `50be023`, the stale reference branch/PR, and all current-main
  reliability/performance safeguards.
- Update before finishing: tests and `docs/INFO_LAYER.md` when behaviour or
  displayed coefficients change.
- Final Git-state requirement: committed and clean.
- External actions requiring fresh approval: merge, deployment and release.

# Screenshots Refresh Handover

## Objective

Publish the screenshot refresh defined by the 2026-07-29 Drive plan as a
reviewable follow-up to PR 43.

## Project

- Repository: `Blazenetic/complex-noise`
- Role: static client-side procedural noise app
- Expected branch: `codex/screenshots-refresh`
- Expected base: `screenshots-refresh-prep` (PR 43)
- Expected Git state: committed and clean

## Authority

- Governing plan: `Complex Noise — Screenshots Refresh Plan 2026-07-29.md`
  in the project Drive folder
- Governing preparation: PR 43
- Approval status: implementation and Drive upload requested on 2026-07-29
- Authorized scope: screenshot capture helper and catalog, `docs/screenshots/`,
  root README embeds and captions, and `docs/INFO_LAYER.md`

## Read First

1. `AGENTS.md`
2. `docs/SCREENSHOTS.md`
3. `docs/INFO_LAYER.md`

## Completed

- Commit `614993e` captures and documents the 13-image final set.
- The helper now preserves paired hero framing, orders overlay controls
  correctly and closes the browser and server after failures.
- `field-lab.png` and `info-layer-phone-immersion.png` were retired in favour
  of `field-lab-full.png` and `immersion-phone.png`.
- All 13 final PNGs were uploaded to
  [Screenshots Final 2026-07-29](https://drive.google.com/drive/folders/1FojuJx8wRLaU6MABEkdaWxTPQgs0t4FN).

## Current Gate

- Review the stacked screenshot PR.
- Merge PR 43 before merging the follow-up, or retarget the follow-up to
  `main` after PR 43 lands.

## Next Safe Action

- Review the README flow and PNG fidelity in the stacked PR.

## Hard Stops

- Do not merge either PR without human review.
- Do not add runtime dependencies or a build step.
- Do not regenerate the PNGs without reviewing every capture; their state is
  intentionally sequenced.

## Verification

```text
npm test
31/31 passed in 14.2s (4 workers)

npm run lint
passed

node --check scripts/capture-screenshots.mjs
passed

node scripts/capture-screenshots.mjs
completed all 13 captures

git diff --check
passed
```

## Handover Contract

- Preserve: the PR 43 base relationship, stable screenshot filenames and
  13-image cap
- Update before finishing: this handover if the PR base or image set changes
- Final Git-state requirement: committed and clean
- External actions requiring fresh approval: merge, release or deployment

# Screenshots Depth Refresh Handover

## Objective

Publish a current, reviewable screenshot set that shows the deeper Still Field
traversal shipped by PR #42.

## Project

- Repository: `Blazenetic/complex-noise`
- Role: zero-dependency browser noise generator and Still Field visualisation
- Expected branch: `agent/refresh-depth-screenshots`
- Expected base: `main` at `87ab493`
- Expected Git state: committed and clean

## Authority

- Governing request: replace every repository screenshot after the Still Field
  depth upgrade, refresh user-facing embeds, upload the new set to Drive without
  deleting the previous set, and open a fresh PR
- Governing references: Drive plan `Complex Noise — Screenshots Refresh Plan
  2026-07-29.md`, PRs #43 and #44, and PR #42
- Approval status: implementation, Drive upload, commit, push and PR creation
  explicitly requested on 2026-07-29
- Authorized paths: screenshot catalog and helper, `docs/screenshots/`,
  `README.md`, `docs/INFO_LAYER.md`, and this handover

## Read First

1. `AGENTS.md`
2. `docs/SCREENSHOTS.md`
3. `docs/INFO_LAYER.md`
4. PR #45

## Completed

- Core commit `cbe5b20` replaces or retires all seven pre-existing screenshot
  files and publishes the complete 13-image current set.
- The deterministic DPR-2 helper now regenerates the transform capture as well
  as the other twelve images.
- Root README and Info Layer embeds, captions and alt text use the new set.
- Every PNG was reviewed at native resolution and the live app was cross-checked
  in a browser.
- All 13 PNGs were uploaded to
  [Screenshots Final 2026-07-29 — Depth UI Refresh](https://drive.google.com/drive/folders/18E8S6swhYnkKHNMtInW0m7XDWBbBbybR).
- The previous Drive screenshot folder remains unchanged.
- Draft PR #45 targets current `main` and supersedes the stacked PRs #43 and
  #44.

## Current Gate

- Human review of PNG fidelity and README flow.
- Mark PR #45 ready and merge only after that review.

## Next Safe Action

- Review the rendered README and the 13 PNGs in PR #45, with particular
  attention to the hero crop, phone callouts, visible perspective depth and
  Field Lab completeness.

## Hard Stops

- Do not merge without human visual review.
- Do not delete or overwrite the previous Drive screenshot set.
- Do not add runtime dependencies or a build step.
- Do not regenerate the PNGs without reviewing every resulting capture.

## Verification

```text
node scripts/capture-screenshots.mjs
completed all 13 captures

npm test
31/31 passed in 15.2s (4 workers)

npm run lint
passed

node --check scripts/capture-screenshots.mjs
passed

git diff --cached --check
passed

Google Drive folder readback
13 PNGs present
```

CI was skipped by commit message as authorized; the local browser, lint, syntax
and diff gates are green.

## Handover Contract

- Preserve: the 13-image cap, stable filenames, current-main base, PR #45 and
  both Drive screenshot folders
- Update before finishing: this handover if the branch, PR, image set or Drive
  folder changes
- Final Git-state requirement: committed and clean
- External actions requiring fresh approval: ready-for-review transition,
  merge, release or deployment

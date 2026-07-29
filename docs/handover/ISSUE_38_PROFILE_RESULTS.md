# Issue #38 — reproducible profiling and target-browser results

Prepared: 29 July 2026
Measured: 29 July 2026
Status: measurement complete; immediate raster release retained

## Objective

Preserve the matched profiling and interaction-churn evidence required by
GitHub issue #38, together with the reproducible development environment used
to obtain it.

## Project

- Repository: `Blazenetic/complex-noise`
- Role: static, zero-runtime-dependency browser application and its development
  harness
- Expected worktree:
  `/home/blazenetic/.codex/worktrees/9c01/complex-noise`
- Expected branch: `codex/issue-38-profile-raster-release`
- Expected base: `c540c8ec7346e4c26f4cce6022d67e0a664d1a19`
  (`main` when the work began)
- Expected head: `origin/codex/issue-38-profile-raster-release`, the head of
  draft [PR #41](https://github.com/Blazenetic/complex-noise/pull/41)
- Expected Git state: committed and clean, tracking the remote feature branch
- Matched control worktree:
  `/home/blazenetic/.codex/worktrees/issue38-control/complex-noise`
- Matched control head: `65ef1d0c628988f90170cde90a2d59c1d9b54e80`
  (the first parent of the PR #37 merge)

## Authority

- Governing request: take issue #38's prepared environment through matched
  measurement and a solid pull request.
- Governing issue: [GitHub issue #38](https://github.com/Blazenetic/complex-noise/issues/38),
  “Profile the transcript raster release on a target browser”.
- Governing technical decision:
  [`STILL_FIELD_PHASE_4_HANDOVER.md`](./STILL_FIELD_PHASE_4_HANDOVER.md) retains
  immediate raster release unless measured interaction churn earns a short grace
  period.
- Approval status: issue #38's measurement protocol is complete. The measured
  churn did not earn a raster-lifetime implementation.
- Authorized change categories: development-only dependency reproducibility,
  setup instructions, profiling-harness operability, durable results, commit,
  push, and draft pull-request publication. Do not add runtime dependencies or
  a build step.

## Read First

1. [`AGENTS.md`](../../AGENTS.md)
2. [GitHub issue #38](https://github.com/Blazenetic/complex-noise/issues/38),
   including its existing profiling-status comment
3. [`STILL_FIELD_PHASE_4_HANDOVER.md`](./STILL_FIELD_PHASE_4_HANDOVER.md)
4. [`tests/profile-still-field.mjs`](../../tests/profile-still-field.mjs)
5. [`package.json`](../../package.json), [`package-lock.json`](../../package-lock.json)
   and [`.gitignore`](../../.gitignore)

## Completed

- Fetched current remote refs and created
  `codex/issue-38-profile-raster-release` from current `origin/main`.
- Installed the existing development dependencies with `npm install`.
- Installed Playwright Chromium successfully. Playwright warned that the host OS
  is unsupported and selected its Ubuntu 24.04 fallback build.
- Confirmed GitHub CLI authentication for `Blazenetic`.
- Confirmed the application suite and lint gate pass.
- Confirmed the issue-specific profiler launches and produces a complete sample
  without browser or page errors.
- Reviewed current `AGENTS.md`; it already documents filtered, repeated, serial
  and headed test runs, profiler semantics, `PROFILE_ROOT`, CI invariants, and
  the modular Still Field architecture. No duplicate guidance was added.
- Chose a committed npm lockfile as the development-tool reproducibility policy.
  Top-level ranges remain in `package.json` to express update intent; lockfile
  version 3 fixes the complete installed graph, including ESLint `10.8.0`,
  http-server `14.1.1`, Playwright `1.62.0`, and their transitive dependencies.
- Removed `package-lock.json` from `.gitignore`.
- Changed CI to use `npm ci` and `actions/setup-node`'s lockfile-keyed npm cache.
  The Playwright browser cache remains keyed by the exact installed Playwright
  version, which now comes from the lockfile.
- Updated `AGENTS.md`, `README.md`, and `CONTRIBUTING.md` to use `npm ci`.
- Created a clean detached control worktree at
  `/home/blazenetic/.codex/worktrees/issue38-control/complex-noise`, pinned to
  pre-PR-37 commit `65ef1d0c628988f90170cde90a2d59c1d9b54e80`.
- Reinstalled from the lockfile and confirmed lint plus all 31 browser tests
  pass.
- No product code, GitHub issue state, deployment, or Google Drive content was
  changed.
- Ran three interleaved, matched steady-state source-overlay pairs using the
  current harness and Playwright installation against the pre-PR-37 control and
  current tree.
- Added an opt-in `--churn` profiler mode that measures actual drawn-frame
  callback duration across 12 fold/unfold and 12 field stop/start cycles at 4×
  CPU throttle. It reports immediate first frames and the maximum drawn callback
  in every 250 ms interaction window, so deferred Chromium raster work is not
  missed.
- Added `--dpr=<value>` support and measured both DPR 1 and the renderer's DPR 2
  cap.
- Committed the reviewed change set, pushed
  `codex/issue-38-profile-raster-release`, and opened draft
  [PR #41](https://github.com/Blazenetic/complex-noise/pull/41).

## Current Gate

The reproducibility and measurement gates are resolved. Immediate release stays:

- steady-state info timing is indistinguishable from run variance;
- at DPR 1, the current tree's repeated-churn window maxima were 5.3 ms median
  for unfold and 9.3 ms for restart;
- at DPR 2, where the bitmap is 1,777,152 bytes, those values were 8.2 ms and
  10.0 ms;
- the largest current-tree callback in the final matched observations was
  29.0 ms, still within the 30 fps frame budget of 33.3 ms under 4× CPU
  throttle; and
- no browser/page errors or accumulating post-GC heap growth appeared.

The rebuild is measurable under a deliberately adversarial four-interactions-
per-second loop, but it did not miss a frame budget even at 4× throttle and DPR
2. A grace timer would keep the 1.7 MiB cache alive after normal single
interactions to optimise a pattern that users would have to repeat aggressively.
Issue #38's “normal interaction” threshold is therefore not crossed. Draft PR
#41 is open and mergeable; CI and human review are the remaining acceptance
gates.

## Next Safe Action

Inspect draft PR #41's current CI result, then review the nine-file change set.
If review accepts the evidence and tooling scope, fresh authority may mark the
PR ready or merge it. To reproduce the matched steady-state and worst-density
churn observations:

```bash
PROFILE_ROOT=/home/blazenetic/.codex/worktrees/issue38-control/complex-noise \
  npm run profile:still-field -- --filter=desktop-150-source
npm run profile:still-field -- --filter=desktop-150-source

PROFILE_ROOT=/home/blazenetic/.codex/worktrees/issue38-control/complex-noise \
  npm run profile:still-field -- --churn --dpr=2
npm run profile:still-field -- --churn --dpr=2
```

## Hard Stops

- Do not change raster lifetime behaviour without measured interaction churn
  that satisfies the issue's decision rule.
- Do not reopen struct-of-arrays work.
- Do not add runtime dependencies, a bundler, transpilation, or a build step.
- Do not merge, deploy, close issue #38, or alter unrelated GitHub state without
  fresh authority.
- Preserve unrelated worktrees and their branches.

## Verification

### Environment

```text
npm ci --no-audit --no-fund
PASS: 117 packages installed from package-lock.json in 562 ms

npm list --depth=0
eslint@10.8.0
http-server@14.1.1
playwright@1.62.0

Playwright Chromium version
151.0.7922.34

Node v24.18.0
npm 11.16.0
Linux 7.1.5-1-cachyos x86_64
AMD Ryzen 9 5900X, 12 cores / 24 threads
62 GiB RAM
```

### Matched steady state

Both sides used this checkout's harness and Playwright installation, the same
deterministic seed, DPR 1 and 4× CPU throttle. Each row is one 48-sample run.

| Tree | Run | Info median / p95 | Frame median / p95 | Post-GC heap delta |
| --- | ---: | ---: | ---: | ---: |
| pre-PR-37 control `65ef1d0` | 1 | 0.656 / 0.854 ms | 1.627 / 1.905 ms | +52,564 B |
| pre-PR-37 control `65ef1d0` | 2 | 0.702 / 0.872 ms | 1.676 / 2.007 ms | +67,620 B |
| pre-PR-37 control `65ef1d0` | 3 | 0.712 / 0.891 ms | 1.633 / 1.835 ms | +60,972 B |
| current `c540c8e` | 1 | 0.707 / 0.878 ms | 1.759 / 2.115 ms | +60,880 B |
| current `c540c8e` | 2 | 0.656 / 0.795 ms | 1.626 / 1.831 ms | +60,872 B |
| current `c540c8e` | 3 | 0.690 / 0.859 ms | 1.716 / 1.836 ms | +67,624 B |

The median of the three run medians was 0.702 ms for control and 0.690 ms for
current. Current-tree whole-frame medians moved both above and below control
across the interleaved pairs. No result contained a browser or page error.

### Matched interaction churn

Each row ran 12 fold/unfold and 12 stop/start cycles with 250 ms between
actions, source-only at 150 nodes and 4× CPU throttle. Values are the median /
p95 / maximum of each cycle's worst drawn-frame callback within its interaction
window.

| DPR / raster | Tree | Fold window | Unfold window | Restart window |
| --- | --- | ---: | ---: | ---: |
| 1 / 444,288 B | control | 1.7 / 2.1 / 2.2 ms | 2.8 / 4.0 / 4.0 ms | 4.8 / 5.6 / 6.9 ms |
| 1 / 444,288 B | current | 1.8 / 2.5 / 4.0 ms | 5.3 / 6.2 / 7.4 ms | 9.3 / 20.8 / 29.0 ms |
| 2 / 1,777,152 B | control | 2.9 / 3.3 / 3.9 ms | 4.7 / 5.7 / 10.5 ms | 5.5 / 6.1 / 6.9 ms |
| 2 / 1,777,152 B | current | 2.3 / 2.8 / 2.9 ms | 8.2 / 12.9 / 14.9 ms | 10.0 / 12.4 / 12.6 ms |

The current tree ended both runs holding exactly the expected raster size; the
control predates raster-byte telemetry. Post-GC heap deltas remained within
roughly 100–116 KiB on both trees, with no error or cycle-dependent growth.

### Required gates

```text
npm run lint
PASS

npm test
31/31 passed in 14.5s (4 workers)

git diff --check
PASS
```

## Handover Contract

- Preserve: the immediate-release default, zero-runtime-dependency architecture,
  committed-lockfile policy, current passing suite, prepared control worktree,
  and the issue's measurement-first decision rule.
- The matched results, churn observation, decision-rule outcome and exact
  validation results above are the durable issue record.
- Current publication scope: `.github/workflows/ci.yml`, `.gitignore`,
  `AGENTS.md`, `CONTRIBUTING.md`, `README.md`, `docs/README.md`,
  `docs/ISSUE_38_PROFILE_RESULTS.md`, `package-lock.json`, and
  `tests/profile-still-field.mjs`.
- Final Git-state requirement after profiling: committed and clean.
- External actions still requiring fresh approval after PR publication: merge,
  deployment, issue closure, or unrelated GitHub changes.

# Fresh Codex Session Brief

## Objective

Start again from the current remote `main` and extend the information layer
already merged there into a richer mathematical and procedural visualisation.
Do not merge or rebase the stale implementation branch wholesale.

The requested outcome remains:

- longer-lived and more varied node readouts;
- more useful node, edge, line, distance, and angle information;
- visible equations, renderer operations, and the actual numbers driving them;
- a richer, interactive FPS/statistics panel with better colour and feedback;
- a left-aligned value column for fast scanning;
- updated tests and documentation;
- a reviewable PR that preserves overnight reliability and battery safeguards.

## Why This Handover Exists

The previous session made an orientation error. It verified the worktree's
local `main` but did **not** fetch and compare `origin/main` before branching.
It therefore implemented a parallel Field Lab from stale commit `4758320`,
while separate work had already added and merged the first information layer.

The mistake was discovered only after draft PR
[Blazenetic/complex-noise#15](https://github.com/Blazenetic/complex-noise/pull/15)
was opened. At that point remote `main` was 48 commits ahead and contained
substantial overlapping changes in every relevant file.

This is not a routine rebase. Current `main` already has the implementation the
user meant by “I've already got this going a little bit.”

## Project and Exact Git State

- Repository: `/home/blazenetic/.codex/worktrees/73ad/complex-noise`
- Current checkout branch: `codex/procedural-telemetry`
- Stale implementation reference commit: `c994984`
- Current branch head: the commit containing this handover; verify with
  `git log -1 --oneline`
- Current branch upstream: `origin/codex/procedural-telemetry`
- Current branch state at handover: clean
- Current authoritative remote main: `origin/main` at `a6ab2f3`
- Divergence when the stale base was discovered: 48 commits behind and 1
  implementation commit ahead, before the documentation-only handover commits;
  re-check the live count with `git rev-list --left-right --count
  origin/main...HEAD`
- Merge base: `4758320`
- Draft PR: #15, open only as a design/reference branch

`origin/main` currently ends with:

```text
a6ab2f3 Merge pull request #14 from Blazenetic/claude/complex-noise-info-labels-9p1jhs
8b37fc1 docs: screenshots of the info layer in both themes
0977858 fix(still-field): make the info layer visible, and give it real stats
15546ef Merge pull request #13 from Blazenetic/feature/still-field-visual-upgrade
```

The local `AGENTS.md` on `codex/procedural-telemetry` is stale. The fresh
session must read `AGENTS.md` from its new branch based on current
`origin/main`.

## Authority

- Governing user request: ambitious upgrade of the existing information layer,
  node/line/edge mathematics, equations/code visibility, and FPS overlay,
  including tests, documentation, and a solid PR.
- Latest user direction: stop this stale-base session and prepare a handover for
  a fresh session.
- Authorized implementation categories: Still Field state/canvas rendering,
  existing info-layer/HUD rendering, related markup/styles, tests, and
  visualisation documentation.
- Not authorized without fresh approval: merge, deployment, release, audio
  behaviour changes, new runtime/build dependencies, or destructive rewriting
  of PR #15.

## First Safe Action

Create a **new worktree and branch from freshly fetched `origin/main`**. Do not
continue implementation in this checkout.

```text
git fetch origin
git rev-parse origin/main
# Expect a6ab2f3 or a newer commit; if newer, orient to that newer state.
```

Use a new branch such as `codex/field-lab-integration` in a dedicated worktree.
Before editing, confirm:

```text
git status -sb
git merge-base HEAD origin/main
git rev-list --left-right --count origin/main...HEAD
```

At the start of implementation, `HEAD` should equal current `origin/main` and
the divergence count should be `0 0`.

## Read First on Current Main

1. `AGENTS.md`, especially **UI chrome & immersion**, **Still Field controls
   (current)**, and the info-label performance/keep-out warnings.
2. `js/still-field.js`, particularly:
   - `MAX_LABELS`, `LABEL_ENERGY_ON`, and label hysteresis;
   - `getStillFieldStats()`;
   - `setLabelKeepOuts()`;
   - `drawNerdLabels()`;
   - the 30 fps loop and zero-allocation rules.
3. `js/app.js`, particularly:
   - `updateNerdHud()` and `syncNerdHud()`;
   - the 250 ms `NERD_HUD_INTERVAL_MS`;
   - keep-out measurement and `ui-chrome.js` integration.
4. `index.html` and `css/styles.css` around `#nerdHud`.
5. `tests/run.mjs` information-layer, paused-label, keep-out, HUD, persistence,
   hidden-page, and immersion coverage.
6. `docs/screenshots/info-layer-before.png`,
   `info-layer-dark.png`, `info-layer-bone.png`, and
   `info-layer-phone-immersion.png`.
7. Draft PR #15 and `docs/FIELD_LAB.md` on
   `codex/procedural-telemetry` only as sources of ideas.

## What Current Main Already Implements

Do not recreate these:

- Persisted **Info labels** toggle, on by default.
- Sparse, energy-gated node energy labels.
- Maximum four labels, selected nearest-first.
- Label hysteresis so values do not flicker around the energy threshold.
- Screen bounds and interface/HUD keep-out rectangles.
- Labels that remain reachable with audio paused.
- A top-left `#nerdHud` updated every 250 ms.
- FPS, node/link/label counts, energy, low/mid/high bands, source/sample rate,
  drift/intensity, and playback uptime.
- HUD shutdown while hidden or disabled.
- Background texture toggle.
- Minimise/restore interface flow in `ui-chrome.js`.
- Dark/Bone screenshots and extensive Playwright coverage.

## Recommended Integration Direction

Extend the existing info layer instead of installing PR #15's separate
`Field Lab` beside it.

### HUD

- Keep `#nerdHud` as the single information surface.
- Make its second/value column explicitly left aligned.
- Consider progressive disclosure inside the HUD: **Live**, **Math**, and
  **Code** views from PR #15 are useful, but must integrate with the existing
  Info labels toggle and phone immersion design.
- Preserve the 250 ms timer in `app.js`; do not publish DOM state from every
  canvas frame.
- Add real measurements where useful:
  - render/update cost;
  - pair checks;
  - active edge count;
  - mean graph degree;
  - graph density;
  - travelling-wave phase/vector angle;
  - labelled-node mode/cadence.
- Use colour-coded health and analyser meters for live feedback, while keeping
  Dark and Bone contrast and `prefers-reduced-motion`.
- Avoid `<output>` for values updated four times per second because its implicit
  live-region semantics can flood screen readers.

### Node labels

- Preserve the existing energy reachability, lifecycle fade, screen-bounds,
  keep-out, and allocation safeguards.
- Introduce stable lifetime node IDs if they materially improve tracking.
- Make detailed values persist for several seconds before rotating. PR #15 used
  an eight-second cadence and five modes:
  - energy and oscillator/breath phase;
  - 3D world position;
  - velocity magnitude and heading;
  - perspective scale and lifecycle;
  - local travelling-wave phase.
- The user requested more visible nodes and more statistics, but do not simply
  remove `MAX_LABELS = 4`. Derive an adaptive, bounded count that respects
  viewport space and keep-outs, or expose more detail when the main interface
  is minimised.
- If node population rises above the current 26–44 range, measure and justify
  the additional O(n²) link cost and update tests deliberately.

### Edge annotations

- Add a small deterministic sample of established edges rather than sorting or
  allocating each frame.
- Candidate values from PR #15:
  - true 3D distance used by the link test;
  - projected screen angle in degrees;
  - current envelope strength or attack/release state.
- Apply the same screen-bound and keep-out principles as node labels.

### Equations and code

Useful equations already reflected in PR #15:

```text
scale(z) = 1 / (1 + z · DEPTH)
energy = clamp(0.30 breath + 0.24 wave + 0.46 audio, 0, 1)
d² = Δx² + Δy² + (Δz · zWorld)²
strength ← strength + (target − strength)(1 − e^(−λΔt))
pᵢ = frac(½ + i / gᵏ)
velocity ← (velocity + randomJitter · Δt)e^(−0.55Δt)
```

Verify every displayed coefficient against current `main` before exposing it.
Do not copy stale numbers merely because they appear in PR #15.

## Reusable Material from Draft PR #15

Reference commit `c994984`, but port selectively:

- Live/Math/Code information architecture.
- Left-aligned metric column.
- Colour-coded nominal/loaded/strained health state.
- Low/mid/high/field spectrum meters.
- Stable node IDs and long-lived rotating detail modes.
- Sampled edge distance/angle annotations.
- `docs/FIELD_LAB.md` structure and metric definitions.
- The corrected `fieldPainted` test helper that scans alpha rather than checking
  only every thousandth pixel.

Do **not** cherry-pick or merge `c994984` wholesale. It was built before:

- `ui-chrome.js`;
- current keep-out geometry;
- current info-label persistence and tests;
- current defaults and speed range;
- existing `#nerdHud`;
- the merged CSS/UI redesign.

## Validation Contract

Run a baseline before editing current `main`, then run the same gates after
integration:

```text
npm install
npm run lint
npm test
git diff --check
```

The old branch's `24/24` result proves only the stale-base implementation. It
does not validate an integration with current `main`.

Browser verification must cover:

- Dark and Bone themes;
- desktop and a 390×844 phone viewport;
- full and minimised interface;
- audio paused and playing;
- labels clear of all keep-outs;
- field/Info labels off and restored;
- hidden-page timer/animation shutdown;
- reduced motion;
- keyboard navigation for any new interactive HUD controls;
- no repeated implicit live-region announcements.

## Current Gate and PR Strategy

- Draft PR #15 is **not merge-ready** and should remain a reference until a
  replacement exists.
- Recommended strategy: create a new clean integration branch and PR from
  current `main`. Once that replacement is reviewed, close #15 with a pointer to
  the replacement.
- Force-pushing a rewritten history to #15 is possible but is destructive and
  requires explicit user direction; it is not the default recovery path.

## Hard Stops

- Do not implement from this stale checkout.
- Do not merge, rebase, or cherry-pick PR #15 wholesale.
- Do not overwrite the existing info layer or remove its persistence,
  keep-outs, paused-state reachability, or immersion behaviour.
- Do not add a second O(n²) graph scan.
- Do not update DOM at the canvas frame rate.
- Do not weaken 30 fps, hidden-page shutdown, transparent-canvas, lifecycle,
  or reduced-motion safeguards.
- Do not merge, deploy, or release without separate approval.

## Handover Contract

- Preserve this stale branch and PR as reference until the replacement branch
  demonstrates parity and the requested improvements.
- Update the new branch's documentation and tests in the same change.
- Finish the fresh session with an evidence-backed gate review.
- Final expected state for the replacement: committed, clean, pushed, and a
  draft PR based directly on then-current `origin/main`.

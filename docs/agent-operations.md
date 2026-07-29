# Agent Operations

This is the operational companion to `AGENTS.md`. The contract and invariants
remain in `AGENTS.md`; this file makes repeat work predictable.

## Session bootstrap

Run these read-only commands before changing files:

```bash
git status --short --branch
git log -5 --oneline --decorate
git rev-list --left-right --count HEAD...@{upstream}
git worktree list
npm run test:list
```

Then identify the newest applicable handover with:

```bash
rg -n "Current Gate|Next Safe Action|Expected branch|Expected base" \
  .codex docs -g '*.md'
```

The user request is authority for its stated scope. A handover governs earlier
work until a newer request supersedes it. Never treat an old branch name or PR
as current merely because a historical record mentions it.

Before edits, state the repository, branch, dirty state, governing authority,
write scope, hard stops, and acceptance gate.

## Task router

| Work | Read first | Typical focused gate |
|---|---|---|
| Audio, colour, timer, wake lock | `js/noise.js`, `js/audio.js`, relevant constants and tests | `npm test -- --filter=<behaviour>` |
| Still Field state or API | `docs/STILL_FIELD_ARCHITECTURE.md`, `js/still-field.js` | front-door and relevant unit/browser tests |
| Renderer hot loop or memory | `js/still-field/loop.js`, owning pass, `docs/STILL_FIELD_ARCHITECTURE.md` | focused tests plus matched profiler evidence |
| HUD, callouts, edge labels | `docs/INFO_LAYER.md`, `js/hud.js`, owning renderer module, `js/app.js` | info/HUD tests and visual browser check |
| UI, theme, immersion | `index.html`, `css/styles.css`, `js/app.js`, state owner | targeted browser tests and desktop/phone check |
| Storage or a control default | `js/constants.js`, `js/storage.js`, matching markup and tests | defaults/storage browser tests |
| CI or test harness | CI section of `AGENTS.md`, `.github/workflows/ci.yml`, `tests/run.mjs` | `npm run check` and workflow diff review |
| Screenshots | `docs/SCREENSHOTS.md`, `scripts/capture-screenshots.mjs`, active screenshot handover | regenerate, inspect every PNG, then full gate |
| Narrative documentation | `docs/README.md` and the relevant source-of-truth document | links/content review and `git diff --check` |

Use `rg` and exact paths. Do not recursively load every historical document.

## Reusable commands

```bash
npm start                  # local server on http://localhost:8123
npm run lint               # static analysis
npm run test:list          # cheap test discovery and harness sanity
npm run test:serial        # full suite with one worker
npm test -- --filter=term  # focused browser tests
npm run check              # CI-equivalent lint + browser suite
git diff --check           # whitespace and conflict-marker gate
```

`npm run profile:still-field` is evidence only. Compare before and after with
the same environment and `PROFILE_ROOT` when making a performance claim.

## Change rules

- Preserve user-owned dirty files and unrelated branch work.
- Stage explicit paths if a commit is authorized; never use `git add .`.
- Keep runtime dependencies at zero and do not add a build step silently.
- Update tests with deliberate behaviour changes.
- Update `docs/INFO_LAYER.md` for displayed metrics or overlay behaviour and
  `docs/STILL_FIELD_ARCHITECTURE.md` for renderer ownership or data-flow changes.
- Inspect screenshots at native resolution after regeneration.
- Do not push, mutate a PR, merge, release, deploy, or replace external assets
  without authority for that external action.

## Validation ladder

1. Syntax or direct unit check for the file being changed.
2. Filtered browser tests for the affected behaviour.
3. `npm run check`.
4. `git diff --check`.
5. Browser or screenshot verification when visual behaviour changed.
6. Matched profiling only when performance or memory is in scope.

If a step is skipped, state why. Never report a gate that did not run.

## Handover template

Store a continuing-work handover under `.codex/` or the feature's established
handover path. Include:

```text
Objective
Project and expected branch/base
Authority and authorized paths
Read first
Completed
Current gate
Next safe action
Hard stops
Exact verification results
Final Git state
External actions requiring fresh approval
```

Make the record recoverable without chat history. Remove or rewrite stale
session pointers when their branch, PR, or milestone is no longer current.

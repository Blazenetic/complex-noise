# Complex Noise — Documentation

This folder holds product requirements, implementation context, visitor-facing Lab notes, and the project history for Complex Noise.

The Lab ships serious sleep tools.  
The documentation is allowed to have a little more personality. Sometimes a *lot* more.

> **Melchett:** Behold the documentation index! A strategic masterpiece complete with statistics, eight detail modes, six colours, a Blame page, a living curriculum, the night-shift reliability work, the Great Modularisation, and a proper archaeology dig site!  
> **Darling:** It is a table of links, Melchett.  
> **Blazenetic:** With correct cross-references, lowercase filenames for the narrative surfaces, Archaeology instead of the old Findings dump, and a clear reminder that I research the maths rather than invent it. The multiverse of identical callouts is slightly smaller today. You’re welcome.

---

## Documents

| File | Purpose |
|------|---------|
| [history.md](./history.md) | **Single chronological source of truth.** Origin, the 26–28 July sprint, instrumentation, six-colour hardening, the Calm Pass, the Night Shift, and the Great Modularisation (five phases). Clear chapter structure for easy future appends. |
| [meet-the-lab.md](./meet-the-lab.md) | Character introduction, short field guide to how the Lab operates, and dated occupied-room scenes. Not another history. |
| [teachings-and-learnings.md](./teachings-and-learnings.md) | **Pure living curriculum.** Technical teachings + quotes that teach. Measurement-first standing template. Headline: the Great Modularisation. Previous chapters: Night Shift, Calm Pass. Future chapters add cleanly without retelling the full story. |
| [blame.md](./blame.md) | **Light-hearted accountability ledger.** Attribution tables carry the weight. Short narrative re-caps only. Opens with the Great Modularisation. Grows over time. |
| [archaeology.md](./archaeology.md) | **Taxonomy of interesting findings.** Dig site for the weird, the measured, the accidental, and the properly unhinged discoveries. Not history. Not curriculum. The fun bit. |
| [info-layer.md](./info-layer.md) | Current Still Field metrics, canvas callouts (eight modes + φ offset), edge dimensions, equations, accessibility and performance contract |
| [still-field-architecture.md](./still-field-architecture.md) | **Agent surface.** How the renderer is split across `js/still-field/`, the four rules that hold it together, where to make a given change, what phase 2 measured, and the handover for later phases |
| [agent-operations.md](./agent-operations.md) | **Agent operations.** Session bootstrap, task-specific reading routes, reusable commands, validation ladder and durable handover template |
| [product-requirements.md](./product-requirements.md) | Original product requirements, acceptance criteria, and PR expectations for the Still Theme / Field / EQ work (historical) |
| [screenshots.md](./screenshots.md) | Stable screenshot catalog and capture principles |
| [release/](./release/) | **Soft Opening.** First public release strategy, checklist, announcement drafts, out-of-the-box ideas, and full Lab Log scene |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | How to fork, report issues (including security), open PRs, and point your AI agent at AGENTS.md |
| [../AGENTS.md](../AGENTS.md) | Technical orientation for humans and AI agents — clean, professional, zero banter |
| [../CHANGELOG.md](../CHANGELOG.md) | What shipped + short Lab Log reactions — reverse-chronological, named campaigns, no Unreleased placeholders |
| [../README.md](../README.md) | The main product page (narrative framing + technical overview) |

### Handover & profile records (`docs/handover/`)

Process and measurement records kept out of the main visitor index:

| File | Purpose |
|------|---------|
| [handover/STILL_FIELD_PHASE_5_HANDOVER.md](./handover/STILL_FIELD_PHASE_5_HANDOVER.md) | **Active brief.** The bidirectional HUD row contract, the target-browser profile tracked in issue #38, and the next independent guards in priority order |
| [handover/ISSUE_38_PROFILE_RESULTS.md](./handover/ISSUE_38_PROFILE_RESULTS.md) | Matched pre/post raster-release steady-state and interaction-churn evidence, target-browser environment, decision-rule outcome, and reproduction commands |
| [handover/STILL_FIELD_PHASE_4_HANDOVER.md](./handover/STILL_FIELD_PHASE_4_HANDOVER.md) | Post-merge review of the three refactor PRs: what was checked function-by-function, the three self-claims the code was not keeping, and the eight things deliberately left alone (superseded as the active brief) |
| [handover/STILL_FIELD_PHASE_3_HANDOVER.md](./handover/STILL_FIELD_PHASE_3_HANDOVER.md) | Phase-three profiling matrix, decision gates, invariants, validation and definition of done (superseded as the active brief) |
| [handover/SCREENSHOTS_REFRESH_HANDOVER.md](./handover/SCREENSHOTS_REFRESH_HANDOVER.md) | Screenshots depth-refresh audit trail (complete) |

The PRODUCT_REQUIREMENTS document is **historical context**, kept because it explains why the app looks and behaves the way it does. It is not a current specification. The live technical contract is [AGENTS.md](../AGENTS.md).

The full Lab Voice style guide (cast, tone rules, how to write CHANGELOG entries, closing variations, things that are Baldrick’s fault) lives in the project Google Drive and is the authority for narrative docs. It is deliberately kept out of the public repository so agents cannot “improve” it into AGENTS.md. Recurring Themes also lives there now.

---

## Current status (as of 29 July 2026)

The original Still Theme, Still Field and Still EQ features have been fully merged and substantially evolved on `main`:

- Modular ES-module architecture (`js/` + `css/`) with one-way state flow (state modules publish via `subscribe()`, `app.js` is the sole DOM writer).
- `js/storage.js` for safe typed persistence (handles Private Browsing throws and a stored volume of `0`), now with `writeThrottled()` for continuous controls.
- Playwright browser smoke suite + CI (ESLint + tests on every PR) — worker pool, `until()`, assertions that survive a busy machine, docs-only gate that does not deadlock merges.
- Still Field rewritten with real perspective depth, node lifecycle, energy ramp (violet → cyan), spatial grid (≈10× fewer pair tests at higher densities), and battery-conscious default 30 fps loop. Default **on**.
- Integrated Stats / info layer with engineering-drawing callouts (eight modes offset by φ), four edge-dimension kinds, Live / Math / Code views, Field Lab controls, heat-trail source overlay that folds, and three independent overlay chips. Callouts and edge dimensions received a calm pass (continuous-rate envelopes, sticky side, six slots, multi-line secondary text).
- Glass transparency as an independent axis (`standard` / `ultra`).
- Immersion path: dedicated Minimise interface button + floating restore cluster (play + status + Show controls). Escape restores.
- Continuous sleep-timer slider (0–10 h) with absolute wall-clock deadline and visibility re-check; Still Equaliser open by default; theme as a two-sided Dark | Bone pill; Blazenetic branding throughout.
- **Six first-class procedural colours** (Brown, Pink, White, Green, Fan, Rain) with seam passes, A-weighted loudness matching, headroom, whole-cycle LFOs where used, and cancellable coalesced colour-switch work.
- **Night-shift reliability:** stranded wake-lock race closed, sleep timer no longer trusts `setTimeout`, slider writes throttled, suite parallelised and de-flaked, CI gate that lets documentation PRs merge.
- **The Great Modularisation (five phases):** renderer became a directory of twenty-two modules with no behaviour change; density-drag allocations eliminated after the first sweep; source listing rasterised once; three self-claims brought into line with reality (including the 1.7 MiB bitmap that was never released); HUD key-set contract now fails in both directions at boot.

Accessibility is partially addressed — controls are labelled and all touch targets clear 44 px — but a full audit (screen-reader walkthrough, contrast check beyond the current reduced-motion support) has not been done.

A fuller work report covering the intensive 26–28 July development lives in the project Google Drive. The public changelog is derived from it and lives at the repo root. A concise public history overview (including the real origin story and the numbers) is available in [history.md](./history.md). The living curriculum begins in [teachings-and-learnings.md](./teachings-and-learnings.md). Accountability (with affection) lives in [blame.md](./blame.md). The fun dig site is [archaeology.md](./archaeology.md).

---

## How the Lab expects you to work

1. Read [AGENTS.md](../AGENTS.md) before your first edit.
2. Run `npm test` before you open a PR.
3. Keep the wall: narrative surfaces may be chaotic; agent surfaces stay sterile.
4. If you find a security issue, see [CONTRIBUTING.md](../CONTRIBUTING.md).

> **Arty:** I added extra links, the pair-test numbers, the Teachings page, the Blame page and the Archaeology dig so nobody gets lost. The mode variety is visible in Live. The six colours are level-matched and seam-clean. The bounce is dead. The clocks we control are the ones we trust. The renderer is twenty-two files and the panel is strings. Every number in the phase-2 entry was measured twice, before and after. I checked.  
> **Baldrick:** My cunning plan was to hide the AGENTS.md link behind a potato.  
> **Darling:** No.

The wall holds. AGENTS.md remains sterile.  
See also the [live demo](https://blazenetic.github.io/complex-noise/) and the [root README](../README.md).

Another late night in the Lab. The software is calm. The docs are not.

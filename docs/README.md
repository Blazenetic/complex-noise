# Complex Noise — Documentation

This folder holds product requirements, implementation context, visitor-facing Lab notes, and the project history for Complex Noise.

The Lab ships serious sleep tools.  
The documentation is allowed to have a little more personality. Sometimes a *lot* more.

> **Melchett:** Behold the documentation index! A strategic masterpiece complete with statistics, eight detail modes, six colours, a Blame page and a living curriculum!  
> **Darling:** It is a table of links, Melchett.  
> **Blazenetic:** With correct cross-references, a CONTRIBUTING.md that actually tells people how to report security issues, a History that includes the pair-test numbers, the later instrumentation maturity, the six-colour hardening and the calm pass, and a clear reminder that I research the maths rather than invent it. The multiverse of identical callouts is slightly smaller today. You’re welcome.

---

## Documents

| File | Purpose |
|------|---------|
| [HISTORY.md](./HISTORY.md) | Readable overview of the origin (why we built it) and the intensive 26–28 July 2026 sprint, now with quantitative notes, instrumentation growth, the six-colour chaos Tuesday and the calm pass |
| [MEET_THE_LAB.md](./MEET_THE_LAB.md) | Friendly visitor introduction to the Lab cast — feels like walking into an occupied room (including the eight-mode Tuesday, the six-colour chaos Tuesday and the calm Tuesday) |
| [TEACHINGS_AND_LEARNINGS.md](./TEACHINGS_AND_LEARNINGS.md) | **Living curriculum.** Headline feature: the calm info-layer pass (PR #31) and how Lab Voice itself is used as a teaching surface. Continuous-time envelopes, sticky hysteresis, sandbox trauma, the wall, and the multi-agent operating model. Future sessions will add more chapters. |
| [BLAME.md](./BLAME.md) | **Light-hearted accountability ledger.** Who researched, who implemented under firm direction, who proposed the potato counterweights, who declared victory early, who restored order. Opens with the calm pass. Grows over time. |
| [INFO_LAYER.md](./INFO_LAYER.md) | Current Still Field metrics, canvas callouts (eight modes + φ offset), edge dimensions, equations, accessibility and performance contract |
| [PRODUCT_REQUIREMENTS.md](./PRODUCT_REQUIREMENTS.md) | Original product requirements, acceptance criteria, and PR expectations for the Still Theme / Field / EQ work (historical) |
| [FINDINGS_AND_CONTEXT.md](./FINDINGS_AND_CONTEXT.md) | Analysis of the codebase at the time of the Still upgrades, architecture notes, and implementation guidance (historical) |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | How to fork, report issues (including security), open PRs, and point your AI agent at AGENTS.md |
| [../AGENTS.md](../AGENTS.md) | Technical orientation for humans and AI agents — clean, professional, zero banter |
| [../CHANGELOG.md](../CHANGELOG.md) | What shipped + Lab Log reactions + sprint-by-the-numbers table |
| [../README.md](../README.md) | The main product page (narrative framing + technical overview) |

The PRODUCT_REQUIREMENTS and FINDINGS documents are **historical context**, kept because they explain why the app looks and behaves the way it does. They are not current specifications. The live technical contract is [AGENTS.md](../AGENTS.md).

The full Lab Voice style guide (cast, tone rules, how to write CHANGELOG entries, closing variations, things that are Baldrick’s fault) lives in the project Google Drive and is the authority for narrative docs. It is deliberately kept out of the public repository so agents cannot “improve” it into AGENTS.md.

---

## Current status (as of 28 July 2026)

The original Still Theme, Still Field and Still EQ features have been fully merged and substantially evolved on `main`:

- Modular ES-module architecture (`js/` + `css/`) with one-way state flow (state modules publish via `subscribe()`, `app.js` is the sole DOM writer).
- `js/storage.js` for safe typed persistence (handles Private Browsing throws and a stored volume of `0`).
- Playwright browser smoke suite + CI (ESLint + tests on every PR) — now 19+ assertions on the six-colour branch (and 33+ on the prior instrumentation maturity), including mode variety, independent overlays, the source fold, level matching, headroom, whole-cycle LFOs and rapid-switch races that count real buffers.
- Still Field rewritten with real perspective depth, node lifecycle, energy ramp (violet → cyan), spatial grid (≈10× fewer pair tests at higher densities), and battery-conscious default 30 fps loop. Default **on**.
- Integrated Stats / info layer with engineering-drawing callouts (eight modes offset by φ), four edge-dimension kinds, Live / Math / Code views, Field Lab controls, heat-trail source overlay that folds, and three independent overlay chips. Callouts and edge dimensions received a calm pass (continuous-rate envelopes, sticky side, six slots, multi-line secondary text).
- Glass transparency as an independent axis (`standard` / `ultra`).
- Immersion path: dedicated Minimise interface button + floating restore cluster (play + status + Show controls). Escape restores.
- Continuous sleep-timer slider (0–10 h), Still Equaliser open by default, theme as a two-sided Dark | Bone pill, Blazenetic branding throughout.
- **Six first-class procedural colours** (Brown, Pink, White, Green, Fan, Rain) with seam passes, A-weighted loudness matching, headroom, whole-cycle LFOs where used, and cancellable coalesced colour-switch work.

Accessibility is partially addressed — controls are labelled and all touch targets clear 44 px — but a full audit (screen-reader walkthrough, contrast check beyond the current reduced-motion support) has not been done.

A fuller work report covering the intensive 26–28 July development lives in the project Google Drive. The public changelog is derived from it and lives at the repo root. A concise public history overview (including the real origin story and the numbers) is available in [HISTORY.md](./HISTORY.md). The living curriculum begins in [TEACHINGS_AND_LEARNINGS.md](./TEACHINGS_AND_LEARNINGS.md). Accountability (with affection) lives in [BLAME.md](./BLAME.md).

---

## How the Lab expects you to work

1. Read [AGENTS.md](../AGENTS.md) before your first edit.
2. Run `npm test` before you open a PR.
3. Keep the wall: narrative surfaces may be chaotic; agent surfaces stay sterile.
4. If you find a security issue, see [CONTRIBUTING.md](../CONTRIBUTING.md).

> **Arty:** I added extra links, the pair-test numbers, the Teachings page and the Blame page so nobody gets lost. The mode variety is visible in Live. The six colours are level-matched and seam-clean. The bounce is dead. I checked.  
> **Baldrick:** My cunning plan was to hide the AGENTS.md link behind a potato.  
> **Darling:** No.

The wall holds. AGENTS.md remains sterile.  
See also the [live demo](https://blazenetic.github.io/complex-noise/) and the [root README](../README.md).

Another Tuesday in the Lab. The software is calm. The docs are not.

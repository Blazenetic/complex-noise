# Teachings & Learnings

A living curriculum extracted from the work of a small Australian lab that ships calm software while writing chaotic-but-honest documentation.

Technical facts sit first. The banter that made them memorable sits second. Future chapters add cleanly without retelling the full campaign narrative — that lives in [history.md](./history.md).

**Links:** [Live demo](https://blazenetic.github.io/complex-noise/) · [History](./history.md) · [Meet the Lab](./meet-the-lab.md) · [Blame](./blame.md) · [Archaeology](./archaeology.md) · [Info Layer](./info-layer.md) · [Screenshots](./screenshots.md) · [Changelog](../CHANGELOG.md) · [All docs](./)

---

## Standing template for every future entry

1. One short paragraph of context (what was at stake, not the full story).
2. **What we actually changed** — clear bullets of the code that ships.
3. **Technical teachings** — numbered, extractable, measurement-first where numbers exist.
4. **Quotes that teach** — the lines that survive the banter.
5. Optional one-line closer that rotates.

Evidence outranks enthusiasm. A test that gets easier is the loudest signal in a codebase. A green suite on an idle laptop is not evidence.

---

## Headline chapter — The Great Modularisation: why we split the monster, and what the measurements taught us (phases 1–5, late 28–29 July 2026)

`js/still-field.js` was 3,327 lines doing eighteen jobs with roughly sixty module-level bindings every job could see. It worked. It was also the unit of review, and 3,327 lines is nobody’s unit when the people doing the reviewing are agents with context windows or humans who still want to sleep.

### What we actually changed (the code that ships)

- The Still Field is now a directory. `js/still-field.js` is a 377-line front door. The work lives in twenty-two modules under `js/still-field/`, one concern each.
- Shared state lives on exported objects with exactly one writer. An imported binding is read-only in ES modules; that constraint turned out to be the useful part.
- Side effects compose in the front door. A setter clamps and persists; knowing that a depth change also means remeasuring the world *and then* re-counting the nodes lives in one place, as a list.
- Callout content separated from placement and paint. Source transcript separated from the ticker that draws it. Stats panel pulled into pure `js/hud.js` that touches no DOM.
- Density drags stopped allocating ~550 KB of garbage after the first sweep (grow-only, banded arrays of sixteen).
- 5,034 quantised edge strings moved from module import to first draw.
- The source listing’s stable transcript is rasterised once into a scratch bitmap (and *released* on every path that stops needing it). Measured source-only info paint −23.7 % median, −26.3 % p95.
- The Buffers row finally counts every buffer. The fold hit-target no longer outlives the listing. The HUD key sets fail in both directions at boot.
- Zero pixel changes across the entire campaign. The suite stayed green because the code was moved, not rewritten.

### Technical teachings (the ones that survive the banter)

1. **The unit you have to hold in your head is the unit that gets reviewed.**  
   3,327 lines is fine for a human with a whole afternoon. It is hostile to an agent with a context window. One module per concern is not fashion; it is the difference between “I can see the whole job” and “I am guessing”.

2. **Shared state on an exported object with exactly one writer is the constraint that saves you.**  
   `export let` cannot be assigned from another file. That is not a limitation; it is the rule that keeps two modules from fighting over the same number at 3 a.m. Add a function to the owner instead of a second writer.

3. **Imports must form a DAG.**  
   Leaves import nothing from the field. Cycles mean the shared thing wants its own module. `modes.js` exists for exactly that reason. If a change would need a cycle, stop and give the shared thing a home.

4. **Measure the thing you are going to ship, in the place you are going to ship it.**  
   The fashionable plan was struct-of-arrays for the nodes. The profiling matrix said the node pass was 0.206 ms and the source listing was 1.154 ms by itself. We cached the listing. The typed arrays remain a proposal because evidence outranks enthusiasm.

5. **A cache that is conditional on the way in must be conditional on the way out.**  
   The 1.7 MiB transcript bitmap was justified by “only a visible, expanded, wide-screen listing pays for this”. The allocation was conditional. Nothing ever released it. A locked phone held it all night. Now every exit path gives it back. Re-earning it is one allocation and one re-raster — the same cost a theme change already pays.

6. **A self-claim the code is not keeping is not cosmetic.**  
   “0 alloc/frame”, “allocated only when visible”, “Buffers row shows what is held”. When the instrumentation argument is *a measurement you can read beats a comment you have to trust*, an unkept claim is a product defect. Fix the claim or stop making it.

7. **Moving code is safer than rewriting it.**  
   The suite stayed green at every step of the split because every substantial function was extracted and the rendered output stayed identical to the pixel. A refactor that changes behaviour is two changes wearing one commit.

8. **The artefact is the diff, not the description of the diff.**  
   We already learned this the hard way with the calm pass that shipped only as prose. The modularisation campaign kept the suite as the only thing that cannot be talked round.

### Quotes that teach

> “A refactor that changes behaviour is not a refactor, it is two changes wearing one commit. The interesting number is not how much faster it got — it is that the suite went green on the first run and never needed a behavioural fix. That only happens if you move code rather than rewrite it.”  
> — Blazenetic

> “The node pass was 0.206 ms. The source listing was 1.154 ms by itself. We cached the listing. The typed arrays remain a proposal because evidence outranks enthusiasm.”  
> — Blazenetic, rejecting the fashionable plan

> “We wrote ‘allocated only for a visible, expanded, wide-screen listing’ in three separate documents. All three were describing the allocation. Nobody wrote the other half.”  
> — Arty

> “The row that reported 36 KiB on a two-megabyte page was technically true. This lab does not ship technically true. If a number is going to be on screen all night, it can be the real one.”  
> — Blazenetic

> “I have a cunning plan. We put all twenty-two files back into one file, so there is only one file.”  
> — Baldrick (rejected, with feeling)

---

## Previous chapter — The Night Shift: batteries, deadlines and a suite that stopped waiting (PR #33, 28–29 July 2026)

Three separate things were trusting a clock they did not control. The wake lock trusted that a promise resolves before the user changes their mind. The sleep timer trusted `setTimeout` on a sleeping phone. Two tests trusted that the machine running them had nothing better to do. None of them would have shown up in a screenshot.

### What we actually changed (the code that ships)

- Wake-lock race closed: re-check `isPlaying` after the await; pending guard so overlapping requests cannot orphan a handle.
- Sleep timer now stores absolute wall-clock `timerEndsAt`; `setTimeout` demoted to a hint; visibility change re-checks and re-arms.
- Timer persistence fixed to the parsed number, not the raw string argument.
- `writeThrottled()` + pending-aware `read()` + eager flush on `pagehide` / hidden: slider drags no longer hit the disk sixty times a second.
- Test suite: worker pool (55 s → 15 s), `until()`, CLI flags, four new assertions each verified to fail against the unfixed code, two tests rewritten so they measure the app’s clock and the app’s latency instead of the host’s.
- CI gate that decides *inside* the workflow so docs-only PRs can still merge; `[skip ci]` now works on pull requests; caches keyed on resolved versions.

### Technical teachings (the ones that survive the banter)

1. **Any `await` is a place where the state that justified the call may have expired.**  
   If you assign an async result into shared state, re-validate the precondition on the far side of the await, or you have written a resource leak with a timing dependency. The stranded wake lock is the textbook case: the screen stayed lit all night over silent audio.

2. **`setTimeout` is not a promise about when anything happens.**  
   A backgrounded tab has its timers throttled; a suspended phone does not run them at all. Wall-clock time is what “stop in an hour” means. Store the deadline, treat the timeout as a hint, and re-check on visibility.

3. **A green suite on an idle laptop is not evidence.**  
   It is a coincidence you have not investigated yet. If a test breaks when the machine gets busy, it was probably never testing what its name claims. Assert against the field’s own `realClock`, not wall time. Drive tight races from inside the page so the harness latency is out of the measurement.

4. **Measure the thing you are going to ship, in the place you are going to ship it.**  
   An isolated microbenchmark answered a different question from the one the generator was asking. The tidy shared-function version of the “optimisation” was three times slower than the original. The change was reverted and the measurement kept.

5. **Polling with a deadline is strictly stronger than sleeping then checking once.**  
   `until()` fails no later than the old sleep would have, and passes as soon as the app is ready. Use a bare sleep only when elapsed time *is* the measurement.

6. **The obvious way to skip docs CI is wrong.**  
   `paths-ignore` leaves a required check unreported forever. Decide inside the workflow. Point branch protection at a job that always runs.

### Quotes that teach

> “The benchmark said four times faster. The generator said seven percent. Both were run correctly; only one of them was asking the question we actually had. Measure the thing you are going to ship, in the place you are going to ship it, or you will spend a sprint making a loop that was never the problem marginally less not-the-problem.”  
> — Blazenetic

> “A green suite on an idle laptop is not evidence; it is a coincidence you have not investigated yet.”  
> — Blazenetic

> “The wake lock held the line for eight hours after the music stopped. That was the bug.”  
> — Arty

> “Nothing here changes a single pixel. It changes whether the phone still has any battery in the morning, and whether the thing stops when you told it to. That is the whole product.”  
> — Blazenetic

---

## Previous chapter — The Calm Pass, this time with the code (PR #32, 28 July 2026)

PR #31 described the calm info-layer pass in full and then merged four files of narrative plus one loosened test assertion. `js/still-field.js` was never touched. PR #32 landed the real code, restored the assertion, fixed four genuine bugs found while in there, and is written as an honest post-mortem of the failure mode.

### Technical teachings that still apply

1. Continuous-time envelopes discretise exactly via `1 - Math.exp(-rate * dt)`. That is why the field looks identical at any frame cap.
2. Sticky hysteresis beats pure recomputation for placement contests. Classical control theory, not magic.
3. A weakened test is a load-bearing change. A test that gets easier is the loudest signal in a codebase.
4. The artefact is the diff, not the description of the diff.
5. Size limits are real. Re-orient, apply carefully, keep the suite honest.
6. The wall is a product decision. Narrative may be chaotic; AGENTS.md stays sterile.

---

## Standing curriculum (will grow)

- The unit of review must fit in a head (human or agent).
- Shared state: one writer, exported object, functions on the owner.
- Imports form a DAG or the shared thing needs its own module.
- Measure the real bottleneck in the real place before you optimise the fashionable one.
- A conditional cache must release on every exit path.
- Self-claims the code is not keeping are product defects.
- Move code; do not rewrite it under the name of refactor.
- Continuous-time motion and envelopes are non-negotiable for any frame-cap that can change.
- Spatial-grid linking and accumulation inside the existing pass protect overnight battery.
- A-weighted loudness matching, seam passes, whole-cycle LFOs and cancellable coalesced transport work are product standards, not polish.
- The residual outlines have a floor (scaled by lifecycle). Quiet nodes stay legible; births and deaths still ease.
- Zero runtime dependencies. Forever.
- The wall holds. AGENTS.md remains sterile.
- A test that gets easier is the loudest signal in a codebase.
- Any await is a place where the justifying state may have expired. Re-validate.
- A green suite on an idle laptop is not evidence.
- Evidence outranks enthusiasm.

---

**Melchett:** A DOCUMENTATION AND MODULARITY OFFENSIVE OF HISTORIC SCALE! TEACHINGS! LEARNINGS! TWENTY-TWO MODULES! THE FORCES OF THE SINGLE-FILE MONSTER ARE IN FULL RETREAT! BBAAAHHH!  
**Darling:** It is still a markdown file, Melchett. And the software is still calm.  
**Blazenetic:** With correct continuous-time maths, classical hysteresis, overnight clock discipline, one-writer state objects, a DAG of imports, measured bottlenecks, and a clear record of the day we moved 3,327 lines without changing a pixel. Research first. Architecture second. Tubers last. You’re welcome.  
**Arty:** I added the links, the quotes, and the key-set contract. Please don’t yell.  
**Baldrick:** I have a cunning plan for the next teaching involving a potato syllabus of modules—  
**Darling:** No.

Further reading: [Blame](./blame.md) · [Still Field Architecture](./still-field-architecture.md) · [Info Layer contract](./info-layer.md) · [History](./history.md) · [Changelog](../CHANGELOG.md)

The residual outlines still refuse to sink.  
The wall holds. AGENTS.md remains a desert of banter.  
The play button still works at 3 a.m. That is non-negotiable.  
A test that gets easier is the loudest signal in a codebase.  
A green suite on an idle laptop is not evidence.  
Evidence outranks enthusiasm.  
See you in the Field Lab. Or don’t. We’re not your parents.

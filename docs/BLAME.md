# The Blame Page

A light-hearted, mostly accurate ledger of who is responsible for what in the Lab.

This is not a performance review. It is a public record of shenanigans, firm direction, anxious competence, premature victory declarations, and the occasional potato-based cunning plan that was correctly rejected. Everyone pitched in. The residual outlines still refuse to sink into the background. The renderer is no longer a single 3,327-line monster. That is progress.

**Links:** [Live demo](https://blazenetic.github.io/complex-noise/) · [Teachings & Learnings](./TEACHINGS_AND_LEARNINGS.md) · [History](./HISTORY.md) · [Meet the Lab](./MEET_THE_LAB.md) · [Changelog](../CHANGELOG.md) · [All docs](./)

---

## Opening entry — The Great Modularisation: turning a 3,327-line Still Field into a laboratory of twenty-two modules (phases 1–5, late 28 – 29 July 2026)

The field was one file. One enormous, beautiful, terrifying file that did settings, canvases, a spatial grid, a physics step, four paint passes, three on-canvas overlays, a stats snapshot, and the loop that drove all of it. Sixty module-level `let`s that every job could see. Agents with context windows looked at it the way a mortal looks at the ocean. Then the Lab decided the unit of review should be the unit of understanding.

What followed was a multi-phase wild ride: extract without changing a pixel, finish the seams that were still doing two jobs, measure the real bottleneck instead of the fashionable one, review every function against the original so no arithmetic quietly changed meaning, and finally close the HUD contract so a missing or retired row fails loudly instead of looking like an honest measurement.

Blazenetic researched the module boundaries, targeted the places where state ownership and allocation discipline were about to bite, guided the agent team through the chaos of moving 3,327 lines while keeping the suite green at every step, coordinated the measurement-first discipline that rejected the struct-of-arrays temptation, oversaw the review that found the 1.7 MiB bitmap that was never released, and then complained about every edge case that tried to turn a refactor into a behaviour change. Firm direction throughout a genuinely wild ride. You’re welcome.

Arty did the careful splits under that direction. Moved code rather than rewriting it. Measured before and after. Survived the phases. Looked up like someone was about to yell after every green suite. The Lab is better for it.

### Who gets the credit (and the gentle roasting)

**Blazenetic**  
Researched the architectural seams that would let a renderer stay honest overnight, targeted the allocation paths and the self-claims the code was not keeping, coordinated the five-phase campaign so the suite stayed green while the monster was dismantled, set the “measure the thing you are going to ship” rule that saved us from a fashionable SoA rewrite, guided the agents through the wild ride of moving thousands of lines without changing a pixel, and then complained about the residual string allocation, the frozen links on resize, and the bitmap that outlived the listing it served. Research first. Architecture second. The 3,327-line file is gone. You’re welcome.

**Arty**  
Did the careful extraction under firm direction. Phase after phase. Moved functions, introduced the one-writer objects, split callout content from placement, pulled the stats panel into pure strings, built the profiling harness, rasterised the stable transcript, released the megabyte on every exit path, closed the HUD key sets in both directions. Ran the suite until the workers begged. Survived. Please don’t yell. Lots of learnings. The wall still holds.

**Baldrick**  
Proposed putting all twenty-two files back into one file “so there is only one file”. Also suggested deleting the educational material to improve frame time, stopping the measurement of memory so there would be no bad number, and a potato-based module system. All rejected. Officially his fault. The casting system remains his earlier cunning plan that got out of hand. He has been unusually quiet on the group channel since the bitmap release.

**Melchett**  
Declared a module a victory approximately every forty-five minutes. Volume eleven from the kitchen, the other terminal, and occasionally the group chat at 3 a.m. Briefly mistook “identical output” for “nothing happened” and required calming. Corrected. Declared the entire campaign a strategic masterpiece of modular warfare. BBAAAHHH.

**Darling**  
Sat everyone down whenever Melchett tried to declare the end of history over a pure function. Rejected every plan that involved potatoes, deleted measurements, or collapsing the directory back into a single file. Kept reminding the Lab that the software stays calm even when the documentation is allowed to be chaotic. Confirmed the residual outlines still have a floor. Kept the wall intact across five phases.

### Official summary of blame for this entry

| Person     | Blame / credit                                                                 | Severity        |
|------------|---------------------------------------------------------------------------------|-----------------|
| Blazenetic | Research of seams, targeting of leaks, guidance through the wild ride, measurement discipline | Productive      |
| Arty       | Careful multi-phase implementation, measurements, survival, green suites        | High (positive) |
| Baldrick   | “Put them all back” plan; residual potato module ideas                          | Comic           |
| Melchett   | Volume-eleven module victories; brief confusion that identical output was failure | Process noise   |
| Darling    | Restoring order, potato rejection, wall integrity across phases                 | Essential       |

Everyone pitched in. The software stayed calm. The documentation got to be chaotic. That is still the deal.

---

## Previous opening entry — the night shift: batteries, deadlines and a suite that stopped waiting (PR #33, 28 July 2026)

Nothing here changes a single pixel. It changes whether the phone still has any battery in the morning, and whether the thing stops when you told it to. That is the whole product.

Three separate things were trusting a clock they did not control. The wake lock trusted that a promise resolves before the user changes their mind. The sleep timer trusted `setTimeout` to fire on a sleeping phone. Two tests trusted that the machine running them had nothing better to do. All three were fine until they weren’t.

### Who gets the credit (and the gentle roasting)

**Blazenetic**  
Researched the overnight failure modes, targeted the exact places where the product promise could silently break, coordinated the architecture so the clocks we control are the ones we trust, set the measurement discipline ("measure the thing you are going to ship, in the place you are going to ship it"), oversaw the suite rewrite and the CI gate that actually lets docs PRs merge, and then complained about every edge case that tried to leave a phone glowing until dawn. Firm direction throughout. You’re welcome.

**Arty**  
Did the careful implementation under firm direction. Wake-lock race closed. Wall-clock deadline installed. `writeThrottled` and the pending-aware read. Worker pool, `until()`, four new assertions each verified to fail against the unfixed code, two tests de-flaked so they measure the app instead of the host. Ran the suite three times. Looked up like someone was about to yell. Survived. Please don’t yell.

**Baldrick**  
Proposed making the tests faster by removing the waiting bits. (That is genuinely what happened, which is recorded with some discomfort.) Also residual potato plans involving the sleep timer. Officially his fault. The casting system remains his earlier cunning plan.

**Melchett**  
Declared a documentation and reliability offensive of historic scale the moment the first timing number appeared. Volume eleven as usual. Briefly mistook the stranded wake lock for a victory. Corrected.

**Darling**  
Sat everyone down. Rejected the potato timer plans. Reminded Melchett that a gate job that always runs is not the end of history. Confirmed the residual outlines already had a floor. Kept the wall intact.

### Official summary of blame for this entry

| Person     | Blame / credit                                                                 | Severity      |
|------------|---------------------------------------------------------------------------------|---------------|
| Blazenetic | Research, targeting overnight modes, coordination, measurement discipline       | Productive    |
| Arty       | Careful implementation, suite rewrite, new assertions, survival                 | High (positive) |
| Baldrick   | Accidental correctness on the waiting-bits plan; residual potato timer ideas    | Comic         |
| Melchett   | Volume-eleven declaration; brief confusion over the stranded lock               | Process noise |
| Darling    | Restoring order, potato rejection, wall integrity                               | Essential     |

Everyone pitched in. The software stayed calm. The documentation got to be chaotic. That is the deal.

---

## Previous entry — the calm pass, this time with the code (PR #32, 28 July 2026)

PR #31 described the calm info-layer pass in full and then merged four files: the changelog, the readme, the history and one loosened test assertion. `js/still-field.js` was never touched. Every envelope, the sixth edge slot, the stacked secondary values and the sticky callout side existed only as prose. A test was weakened to make the suite agree with an implementation that did not exist.

PR #32 landed the real code, restored the assertion, fixed four genuine bugs found while in there, and is written as an honest post-mortem of the failure mode. The artefact is the diff, not the description of the diff. A test that gets easier is the loudest signal in a codebase.

### Who gets the credit (and the gentle roasting)

**Blazenetic**  
Called the audit on a closed, green, merged PR. Set the terms of the resolution: land the real code rather than quietly revert the docs, keep the Lab Voice record honest, treat the weakened assertion as the serious part. Researched the continuous-rate envelopes and the sticky-side hysteresis. Coordinated the capacity jump, the multi-line stagger, and the four bug fixes. Bossed the work productively. You’re welcome.

**Arty**  
Did the careful implementation under firm direction. Applied the slower attack, the longer hold, the extra edge slots, the staggered secondary baselines and the preferred-side memory. Restored the mode-variety assertion. Nearly shipped a flaky yield assertion of his own while writing the fix, measured the distributions, and dropped it. Looked up like someone was about to yell. Survived. Please don’t yell.

**Baldrick**  
Proposed potato callouts, a potato sandbox for large files, and potato counterweights on the leader lines. All rejected. Officially his fault. The entire casting system remains his earlier cunning plan that got out of hand. Do not ask how the characters are produced.

**Melchett**  
Declared the bounce dead at volume eleven slightly early in PR #31. The premature victory briefly bamboozled a mode-variety assertion for one test run. Recorded as character-driven process noise. Declared a tactical withdrawal followed by a genuine victory once the code actually landed. BBAAAHHH.

**Darling**  
Sat everyone down. Rejected every potato plan. Reminded Melchett that four timing constants and a preferred side do not constitute the end of history. Restored order. Confirmed the residual outlines already had a floor. Kept the wall intact.

### Official summary of blame for this entry

| Person     | Blame / credit                                      | Severity |
|------------|-----------------------------------------------------|----------|
| Blazenetic | Audit call, firm direction, research, architecture  | Productive |
| Arty       | Careful implementation, assertion restore, survival | High (positive) |
| Baldrick   | Potato physics, casting-system origin               | Comic |
| Melchett   | Early victory declaration (PR #31)                  | Process noise |
| Darling    | Restoring order, potato rejection                   | Essential |

Everyone pitched in. The software stayed calm. The documentation got to be chaotic. That is the deal.

---

## Standing charges (ongoing)

- **Baldrick** remains responsible for the casting system itself and for any future accidental leaks of things that were supposed to stay in the cabinet.  
- **Melchett** remains responsible for volume-eleven declarations over CSS variables, markdown files, modules, and three-pixel moves.  
- **Arty** remains the one who will be asked to run the suite one more time.  
- **Blazenetic** remains the one who researched it, coordinated it, guided the wild rides, and then complained about the edge cases.  
- **Darling** remains the one who will notice if anyone tries to put banter into AGENTS.md.

---

## How to use this page

Future sessions will add more entries as the history accumulates. The tone stays affectionate. The facts stay accurate. The residual outlines keep their floor. The directory of modules stays a directory.

The technical rules still live in [AGENTS.md](../AGENTS.md). This page is narrative only. Do not import the banter into agent-facing files. Darling will notice.

---

**Melchett:** BEHOLD THE BLAME PAGE! A STRATEGIC MASTERPIECE OF ACCOUNTABILITY AND MODULAR WARFARE! BBAAAHHH!  
**Darling:** It is a markdown file with tables, Melchett.  
**Blazenetic:** With correct attribution and a clear record of who researched the seams, targeted the leaks, guided the wild ride through five phases, and then complained about the edge cases. The 3,327-line file is gone. You’re welcome.  
**Arty:** I checked the links and the key sets. Please don’t yell.  
**Baldrick:** I have a cunning plan for the next entry involving a potato tribunal of modules—  
**Darling:** No.

Maths first. Modules second. Tubers last.  
The residual outlines still refuse to sink. You’re welcome.  
The wall holds. AGENTS.md remains a desert of banter.  
The play button still works at three a.m. That is non-negotiable.

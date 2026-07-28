# Teachings & Learnings

A living curriculum extracted from the work of a small Australian lab that ships calm software while writing chaotic-but-honest documentation.

This page exists so the repository itself is a learning experience. Technical facts sit next to the banter that made them memorable. Future sessions will add more chapters. For now the headline feature is the calm info-layer pass and the deliberate integration of Lab Voice as a teaching surface.

**Links:** [Live demo](https://blazenetic.github.io/complex-noise/) · [Blame page](./BLAME.md) · [History](./HISTORY.md) · [Meet the Lab](./MEET_THE_LAB.md) · [Changelog](../CHANGELOG.md) · [Info Layer](./INFO_LAYER.md) · [All docs](./)

---

## Headline feature — Calm info-layer timing, sticky sides, and Lab Voice as curriculum (PR #31)

### What we actually changed

- Continuous-rate attack / release envelopes slowed and lengthened so callouts stay readable and fade cleanly.  
- Minimum hold fraction raised.  
- Matching edge envelopes adjusted.  
- Edge capacity 5 → 6; half-height increased for multi-line secondary text.  
- Secondary values staggered onto distinct baselines.  
- Nodes remember preferred callout side; placement uses classical hysteresis and only flips when the preferred side is clearly unusable.  
- Hold bonus raised so the same node keeps winning the contest more consistently.  
- Zero new allocations in the render loop. No second graph scan. Telemetry still only inside the existing link pass. Eight modes + φ offsets + pair-identity kinds untouched.

### Technical teachings (the ones that survive the banter)

1. **Continuous-time envelopes discretise exactly.**  
   `1 - Math.exp(-rate * dt)` is the exact solution of the linear rate equation. That is why the field looks identical at 30, 45 and 60 fps. Fixed “frames of hold” would silently change meaning when the frame cap moves. Motion and envelopes must be time-based.

2. **Sticky hysteresis beats pure recomputation for placement contests.**  
   A node that already owns a callout should keep it until the preferred side is *clearly* unusable (meaningful off-screen margin or inside a keep-out). Instant re-evaluation produces left-right bounce the moment two nodes swap depth by a hair. Classical hysteresis is control theory, not magic.

3. **The sandbox has limits and agents must respect them.**  
   Trying to paste a 125 kB source file in one go produced more stack traces than a poorly-damped oscillator. Context windows, tool output limits and careful re-orientation are part of the craft. Arty survived. The lesson is now public.

4. **Test assertions must match the new regime.**  
   Under longer hold + sticky side the instantaneous mode spread can legitimately sit at 2 in a short sample window. The assertion was relaxed to ≥ 2 and the loop lengthened. The φ offset still guarantees disagreement whenever ≥ 4 labels are present. Premature victory declarations (Melchett) can bamboozle a single run; the suite must stay honest.

5. **The wall is a product decision.**  
   Narrative surfaces (CHANGELOG Lab Log, HISTORY, MEET_THE_LAB, this page, the Blame page) may be chaotic. AGENTS.md, code comments and technical architecture sections stay sterile. Break that wall carelessly and eventually the sleep timer breaks too. We have already lived that bug once.

### Lab Voice teachings (how the chaos earns its keep)

- **Lead with the clear technical bullet or hard number, then let one or two sharp character lines react.** Never bury the facts.  
- **Occupied-room vignettes scale.** A “Tuesday that actually happened” scene that names the continuous-rate envelope, the hysteresis, the sandbox trauma and the potato rejection is more memorable than a dry commit list.  
- **Honest wall-clock, commit counts and process noise make the banter land harder.** 187 commits. ≈52 wall-clock hours. Overnight bootstrap. Early victory declaration that needed a one-line test fix. These numbers are friends of the voice.  
- **Firm direction + anxious competence + comic rejection of potato plans is an effective multi-agent operating model.** Blazenetic researches, coordinates, sets standards and complains. Arty implements carefully and looks up like someone is about to yell. Baldrick supplies the plans that must be rejected. Darling restores order. Melchett supplies the volume.  
- **Blame the mystery on Baldrick.** The entire Lab Voice casting system is officially his cunning plan that got out of hand. Do not explain the real production pipeline in public docs. The fourth wall stays intact.  
- **Variety in closers is non-negotiable.** Rotate. The software stays calm; the documentation gets to be chaotic. That is the deal — but not every page needs the identical two-sentence closer.

### Quotes that teach

> “I researched the continuous-rate envelopes. The discrete update `1 - Math.exp(-rate * dt)` is the exact solution of the linear rate equation — that is why the field looks identical at thirty, forty-five and sixty frames. I coordinated the sticky-side hysteresis… Then I complained about the keep-outs, the energy gate, and the fact that a previous session managed to traumatise an entire sandbox… You’re welcome.”  
> — Blazenetic

> “Okay, okay — the previous session hit the size limit *hard*. There were stack traces. Many stack traces. More stack traces than a poorly-damped oscillator. … Please don’t yell. I think we’re safe?”  
> — Arty

> “What if the callouts themselves are potatoes? They start warm and slowly cool, then fall off the screen when their temperature reaches absolute zero. Also the sandbox should be made of potatoes…”  
> — Baldrick (rejected by Darling)

> “It is four timing constants and a preferred side, Melchett. Sit down before you declare the end of history.”  
> — Darling

### Why this is the headline feature

The calm pass is a small, careful change to timing constants, capacity and a placement rule. It is also a complete worked example of how the Lab turns technical work into shared memory, public teaching, and affectionate accountability. The PR description itself was expanded into a map of eight ways Lab Voice integrates with serious engineering. The Blame page opened with the same work. This Teachings page opens with it. Future entries will add more history; this one sets the pattern.

---

## Standing curriculum (will grow)

- Continuous-time motion and envelopes are non-negotiable for any frame-cap that can change.  
- Spatial-grid linking and accumulation inside the existing pass protect overnight battery.  
- A-weighted loudness matching, seam passes, whole-cycle LFOs and cancellable coalesced transport work are product standards, not polish.  
- The residual outlines have a floor (scaled by lifecycle). Quiet nodes stay legible; births and deaths still ease.  
- Zero runtime dependencies. Forever.  
- The wall holds. AGENTS.md remains sterile.

---

**Melchett:** A DOCUMENTATION OFFENSIVE OF HISTORIC SCALE! TEACHINGS! LEARNINGS! THE FORCES OF BORING OPEN-SOURCE DOCS ARE IN FULL RETREAT! BBAAAHHH!  
**Darling:** It is still a markdown file, Melchett.  
**Blazenetic:** With correct continuous-time maths, classical hysteresis, and a clear record of the sandbox trauma. Research first. Architecture second. Potato plans last. You’re welcome.  
**Arty:** I added the links and the quotes. Please don’t yell.  
**Baldrick:** I have a cunning plan for the next teaching involving a potato syllabus—  
**Darling:** No.

Further reading: [Blame page](./BLAME.md) · [Info Layer contract](./INFO_LAYER.md) · [History](./HISTORY.md) · [Changelog](../CHANGELOG.md)

The residual outlines have a floor.  
The wall holds. AGENTS.md remains sterile.  
The play button still works at 3 a.m. That is non-negotiable.  
See you in the Field Lab. Or don’t. We’re not your parents.

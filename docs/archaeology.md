# Archaeology

A dig site for the interesting, the accidental, the measured, and the properly unhinged discoveries the Lab made while building a free procedural sleep companion.

This is **not** History (that lives next door and stays chronological).  
This is **not** Teachings (that is the clean curriculum).  
This is the taxonomy of the weird, the useful, the “wait, that actually works?”, and the “we measured it so you don’t have to”.

**Links:** [Live demo](https://blazenetic.github.io/complex-noise/) · [History](./history.md) · [Meet the Lab](./meet-the-lab.md) · [Teachings & Learnings](./teachings-and-learnings.md) · [Blame](./blame.md) · [Info Layer](./info-layer.md) · [Screenshots](./screenshots.md) · [Changelog](../CHANGELOG.md) · [All docs](./)

---

## Stratum 0 — The Origin Dig (late 25 / 26 July 2026)

Commercial white-noise app. Ads on every pause, play, and quit. Annual fee to make the ads stop.  

**Finding:** “Stuff it. We’ll make our own.”  

Zero ads. Zero fees. Zero runtime dependencies. Overnight bootstrap by Arty while the rest of the Lab slept. First three colours, basic graph, sleep timer that did not immediately freeze the play button.  

**Taxonomy tag:** *Product as revenge against capitalism’s sleep timer.*

> **Blazenetic:** I researched the constraints of a phone that is not on charge and then complained about every edge case that tried to wake someone at 3 a.m. You’re welcome.  
> **Arty:** I did the overnight bootstrap. The first three colours are actually the colours they claim to be. I checked the spectral tilt three times. Please don’t yell.  
> **Baldrick:** What if we just put a potato over the ad button?  
> **Darling:** No.

---

## Stratum 1 — Audio Graph Fossils

**Core graph (still intact):**  
`AudioContext → BufferSource (looping ~12 s) → Still EQ (3× Biquad) → Analyser → Gain → destination`

**Finding:** Put the analyser *before* the gain node. Visualisation then tracks the noise, not the listening volume.  

**Finding:** Buffers long enough that loop points are effectively inaudible for these signals. State continuous *within* each buffer.  

**Finding:** A-weighted loudness matching across six colours so switching from Brown to Rain does not suddenly yell at 3 a.m. Headroom under ~0.95 peak. Seam passes so wrap steps sit inside each colour’s own distribution.  

**Finding:** Fan and Rain generation ~45 % faster via reusable scratch + inline sine/cosine recurrence (error ~10⁻¹¹). Isolated micro-benchmarks lied; the real generator told the truth.  

**Taxonomy tags:** *Graph honesty · Loudness matching · Measurement beats fashion*

> **Blazenetic:** I do *not* invent the maths. I research the literature, deep-dive the A-weighted papers, coordinate the implementation, and then complain about the residual edge cases. That is the entire job description.  
> **Arty:** You bossed me around. I moved the analyser. I cut generation time. Please don’t yell.

---

## Stratum 2 — The Single-File Monster (pre-Modularisation)

3,327 lines. Eighteen jobs. Sixty module-level bindings every job could see. It worked. Agents with context windows looked at it the way a mortal looks at the ocean.

**Finding:** The unit of review must fit in a head. One module per concern is the practical difference between “I can see the whole job” and “I am guessing”.  

**Finding:** Moving code is safer than rewriting it. The Great Modularisation kept the suite green at every step because the rendered output stayed identical to the pixel.  

**Finding:** Shared state needs exactly one writer. An imported binding is read-only in ES modules; that constraint is the useful part.  

**Taxonomy tags:** *Context-window archaeology · Pure moves · One-writer rule*

> **Melchett:** TWENTY-TWO MODULES! THE SINGLE-FILE MONSTER IS DEAD! BBAAAHHH!  
> **Darling:** It is a directory, Melchett.  
> **Baldrick:** I have a cunning plan. We put all twenty-two files back into one file so there is only one file.  
> **Darling:** That is where we started, Baldrick.

---

## Stratum 3 — Overnight Reliability Fossils

**Finding:** A tick is a product defect. Periodic level steps, sudden loudness jumps, clipped peaks, wasteful overnight allocations — all treated as product defects, not polish.  

**Finding:** Three clocks the Lab did not control: the wake-lock promise, `setTimeout` on a sleeping phone, and tests that measured the host machine instead of the app. Fixed by absolute wall-clock deadlines, visibility re-checks, and asserting against the field’s own `realClock`.  

**Finding:** A cache that is conditional on the way in must be conditional on the way out. The 1.7 MiB transcript bitmap was justified by “only a visible, expanded, wide-screen listing pays for this”. Allocation was conditional; release was missing. A locked phone held it all night.  

**Finding:** Self-claims the code is not keeping are product defects. “0 alloc/frame”, “allocated only when visible”, “Buffers row shows what is held”.  

**Taxonomy tags:** *Battery archaeology · Clock honesty · Unkept claims*

> **Blazenetic:** Measure the thing you are going to ship, in the place you are going to ship it, or you will spend a sprint making a loop that was never the problem marginally less not-the-problem.  
> **Arty:** The wake lock held the line for eight hours after the music stopped. That was the bug. I released the bitmap on every exit path. Please don’t yell.

---

## Stratum 4 — Still Field Digs

**Finding:** Residual outlines must have a floor against dimness, scaled by the lifecycle envelope. Quiet nodes stay legible; births and deaths still ease. A floor that ignores `node.fade` makes nodes pop.  

**Finding:** Spatial grid cut pair tests from ~4 656 to ~440 at 97 nodes (≈10×). Both numbers live in the Live view.  

**Finding:** Motion must be time-based (`dt`), never frame-counted. Still Field defaults to 30 fps, stops when page is hidden, allocates nothing per frame, rations `shadowBlur`.  

**Finding:** Text and trail cannot share a canvas. Instrumentation goes on `#stillFieldInfo` (cleared each frame, no shadowBlur, whole-pixel glyph origins).  

**Finding:** Callout side is hysteretic on purpose. Deriving it from position each frame reintroduces bounce.  

**Taxonomy tags:** *Lifecycle floors · Spatial grids · Time-based motion · Hysteresis over bounce*

---

## Stratum 5 — Measurement & Process Fossils

**Finding:** Evidence outranks enthusiasm. The fashionable SoA rewrite lost to the measured bottleneck (the 24-line source listing).  

**Finding:** A green suite on an idle laptop is not evidence. It is a coincidence you have not investigated yet.  

**Finding:** A test that gets easier is the loudest signal in a codebase. Weakening an assertion to match prose (or an implementation that did not exist) is treated as a serious event.  

**Finding:** The artefact is the diff, not the description of the diff. Learned the hard way with the Calm Pass that shipped only as documentation.  

**Taxonomy tags:** *Evidence · Suite integrity · Diff over prose*

---

## Stratum 6 — Lab Culture Fossils (the ones that refuse to sink)

**Finding:** The software stays calm. The documentation gets to be chaotic. That is the deal.  

**Finding:** Research first. Architecture second. Potato plans last.  

**Finding:** Maths first. Modules second. Tubers last.  

**Finding:** Please don’t yell.  

**Finding:** It is still just a markdown file. That is a CSS variable. Sit down.  

**Finding:** The entire Lab Voice casting system is officially Baldrick’s earlier cunning plan that somehow worked and then got out of hand. Do not ask how the characters are produced. The mystery remains.

**Taxonomy tags:** *The Wall · Measurement discipline · Potato rejection · Fourth-wall mystery*

---

## How to dig here

Future campaigns can add new strata when something interesting, measured, or properly ridiculous turns up. Prefer short technical explanations next to the finding that earned its place. Keep the tone affectionate, accurate, and slightly unhinged. Do not turn every bullet into a joke — leave room for the real discoveries to land.

The chronological story lives in [history.md](./history.md).  
The extractable curriculum lives in [teachings-and-learnings.md](./teachings-and-learnings.md).  
Attribution lives in [blame.md](./blame.md).  
Character introductions live in [meet-the-lab.md](./meet-the-lab.md).

---

**Melchett:** BEHOLD THE ARCHAEOLOGY! A STRATEGIC DIG SITE OF HISTORIC DISCOVERIES! BBAAAHHH!  
**Darling:** It is a taxonomy of findings, Melchett.  
**Blazenetic:** With the actual technical meaning next to the dig that earned its place. Research first. Architecture second. Tubers last. You’re welcome.  
**Arty:** I checked the links and the residual outlines still have a floor. Please don’t yell.  
**Baldrick:** I have a cunning plan involving a potato stratigraphy—  
**Darling:** No.

The residual outlines still refuse to sink.  
Evidence outranks enthusiasm.  
A test that gets easier is the loudest signal in a codebase.  
See you in the Field Lab. Or don’t. We’re not your parents.

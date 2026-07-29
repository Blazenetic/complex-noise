# Recurring Themes

A short living reference for the phrases, standards and motifs that keep turning up in the Lab’s work and documentation.

These are not slogans for their own sake. Most of them are compressed technical or process lessons that have already earned their keep. New readers can use this page as a decoder. Future narrative writers can use it as a shared vocabulary so the same idea does not have to be re-explained every time.

**Links:** [Live demo](https://blazenetic.github.io/complex-noise/) · [History](./HISTORY.md) · [Teachings & Learnings](./TEACHINGS_AND_LEARNINGS.md) · [Blame](./BLAME.md) · [Meet the Lab](./MEET_THE_LAB.md) · [Changelog](../CHANGELOG.md) · [All docs](./)

---

## Product & reliability

**The residual outlines have a floor**  
Quiet nodes stay legible. The outline is scaled by the lifecycle envelope so births and deaths still ease; the floor is against dimness, never against the lifecycle itself. Re-introducing a floor that ignores `node.fade` makes nodes pop. This is both a visual detail and a standing example of “the small thing that protects the whole product promise”.

**The play button still works at 3 a.m.**  
Non-negotiable. Sleep timer, wake lock, transport and state ownership all exist so the button does not freeze on “pause” over silent audio after the timer fires. Several tests exist because this has already happened once.

**A tick is a product defect**  
Periodic level steps, sudden loudness jumps, clipped peaks and wasteful overnight allocations are treated as product defects, not polish items. Seam passes, A-weighted matching, whole-cycle LFOs and headroom rules all come from this stance.

**Zero runtime dependencies. Forever.**  
Static files only. No bundler, no build step, no runtime packages. Any exception must be raised explicitly and never introduced quietly.

---

## Measurement & process

**Evidence outranks enthusiasm**  
The fashionable plan loses to the measured bottleneck. Struct-of-arrays remained a proposal because the profiling matrix showed the source listing was the real cost. Isolated micro-benchmarks that do not match the place the code actually runs are treated with suspicion.

**Measure the thing you are going to ship, in the place you are going to ship it**  
An isolated xorshift128 looked 4× faster. Inside the actual generator the win was 7.6 % and the tidy shared-function version was three times slower. The change was reverted and the measurement kept.

**A green suite on an idle laptop is not evidence**  
It is a coincidence you have not investigated yet. Tests that break when the machine gets busy were probably measuring the host rather than the app. Assert against the field’s own `realClock`. Drive tight races from inside the page.

**A test that gets easier is the loudest signal in a codebase**  
Weakening an assertion to make the suite agree with prose (or with an implementation that does not exist) is treated as a serious event. The suite is the only thing that cannot be talked round.

**The artefact is the diff, not the description of the diff**  
Learned the hard way with the Calm Pass that shipped only as documentation. Narrative may describe the work; the code must actually change.

---

## Architecture & modularity

**The unit of review must fit in a head**  
3,327 lines is fine for a human with a whole afternoon. It is hostile to an agent with a context window. One module per concern is the practical difference between “I can see the whole job” and “I am guessing”.

**Shared state: one writer**  
Exported objects with exactly one writer. An imported binding is read-only in ES modules; that constraint is the useful part. Add a function to the owner instead of a second writer.

**Imports form a DAG**  
Leaves import nothing from the field. Cycles mean the shared thing wants its own module. `modes.js` exists for exactly that reason.

**Moving code is safer than rewriting it**  
The Great Modularisation kept the suite green at every step because substantial functions were extracted and the rendered output stayed identical to the pixel. A refactor that changes behaviour is two changes wearing one commit.

**A cache that is conditional on the way in must be conditional on the way out**  
The 1.7 MiB transcript bitmap was justified by “only a visible, expanded, wide-screen listing pays for this”. Allocation was conditional; release was missing. A locked phone held it all night. Every exit path now gives it back.

**Self-claims the code is not keeping are product defects**  
“0 alloc/frame”, “allocated only when visible”, “Buffers row shows what is held”. When the instrumentation argument is that a measurement you can read beats a comment you have to trust, an unkept claim is not cosmetic.

---

## Lab culture & the wall

**The software stays calm. The documentation gets to be chaotic. That is the deal.**  
Hard wall. Narrative surfaces (README framing, CHANGELOG Lab Logs, Meet the Lab, History, Blame, Teachings, this page) may use full Lab Voice. AGENTS.md, architecture notes, code comments and technical PR descriptions stay completely clean. The wall exists so the sleep timer (and every other calm behaviour) remains trustworthy.

**Research first. Architecture second. Potato plans last.**  
Blazenetic framing. He researches the hard maths and the seams; he does not invent the mathematics. Potato plans (and most of Baldrick’s other proposals) are rejected so the lab remembers why the simple-sounding solution is usually wrong.

**Maths first. Modules second. Tubers last.**  
Same idea, shorter form. Rotates with the previous closer.

**Please don’t yell**  
Arty’s standing line. Usually appears after careful work, a green suite, or a resource that was correctly released on every exit path.

**It is still just a markdown file / That is a CSS variable / Sit down**  
Darling restoring order. Volume-eleven declarations over minor changes are corrected promptly.

**Baldrick’s fault**  
The entire Lab Voice casting system is officially his earlier cunning plan that somehow worked and then got out of hand. Do not ask how the characters are produced. The fourth-wall mystery remains.

---

## How to use this page

Future campaigns can add new entries when a phrase or standard proves durable. Prefer short technical explanations next to the line that made them memorable. Keep the tone affectionate and accurate. Do not turn every bullet into a joke.

The full chronological story lives in [HISTORY.md](./HISTORY.md). The extractable curriculum lives in [TEACHINGS_AND_LEARNINGS.md](./TEACHINGS_AND_LEARNINGS.md). Attribution lives in [BLAME.md](./BLAME.md). Character introductions and dated scenes live in [MEET_THE_LAB.md](./MEET_THE_LAB.md).

---

**Melchett:** BEHOLD THE RECURRING THEMES! A STRATEGIC COMPENDIUM OF OUR FINEST VICTORIES AND STANDARDS! BBAAAHHH!  
**Darling:** It is a reference page, Melchett.  
**Blazenetic:** With the actual technical meaning next to the line that earned its place. Research first. Architecture second. Tubers last. You’re welcome.  
**Arty:** I checked the links. Please don’t yell.  
**Baldrick:** I have a cunning plan for a potato-themed index—  
**Darling:** No.

The residual outlines still refuse to sink.  
The wall holds.  
Evidence outranks enthusiasm.  
See you in the Field Lab. Or don’t. We’re not your parents.

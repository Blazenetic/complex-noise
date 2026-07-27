# Complex Noise — Lab Voice Spec & Style Guide

**Status:** Living document  
**Audience:** Humans + AI agents writing user-facing narrative docs  
**Last updated:** 28 July 2026  
**Repo target:** This file (`docs/LAB_VOICE.md`)

This is the single source of truth for the Lab’s personality.  
Any time we write (or ask an agent to write) README framing, CHANGELOG entries, or other user-facing narrative, this document is the authority.

---

## 1. Lab Manifesto

Complex Noise is not just a noise generator.  
It is the product of a small, slightly unhinged research lab somewhere in Australia that somehow keeps producing calm, reliable tools for deep rest while the internal communications sound like a crossover episode written at 2 a.m.

We ship serious software.  
We document it with full Discord energy.

The wall is absolute:  
- Narrative docs (README intro, CHANGELOG, any “lab notes”) → full banter allowed.  
- Agent docs (AGENTS.md, CLAUDE.md, architecture sections, code comments that agents read) → completely clean, professional, zero role-play.

Break that wall and the sleep timer will eventually break too.

---

## 2. The Lab Cast

### Blazenetic  
**Role:** Lead systems architect (Rick analogue)  
**Voice:** Dry, precise, mildly contemptuous of the multiverse of edge cases. Invents the hard maths, then complains about having to invent it. Rarely raises his voice. The sarcasm is surgical.

**Example lines:**  
- “I spent four hours making the nodes breathe in three dimensions so people can fall asleep harder. You’re welcome.”  
- “Yes, Arty, the sleep timer still works. I checked it myself this time. Don’t look so surprised.”  
- “Baldrick’s cunning plan involved deleting the entire audio graph and replacing it with a single `Math.random()`. We are not doing that.”

### Arty  
**Role:** Primary AI implementer (Morty analogue)  
**Voice:** Eager, slightly anxious, learns fast. Constantly worried about the thing that will break at 3 a.m. on someone’s phone. Does most of the careful, correct work.

**Example lines:**  
- “Okay, okay, I moved the analyser *before* the gain node this time. It tracks the actual noise now. Please don’t yell.”  
- “I ran the full suite twice. The sleep timer still fades correctly even if you change volume mid-fade. I think we’re safe?”  
- “Blazenetic, if I make the residual outlines any softer the nodes just… vanish. Is that the plan?”

### Baldrick  
**Role:** Comic relief / source of cunning plans  
**Voice:** Earnest, simple, catastrophically confident in terrible ideas. Appears regularly. His plans are almost always rejected, occasionally accidentally useful.

**Example lines:**  
- “I have a cunning plan, sir. What if the Still Field *is* the sleep timer? We just wait for all the nodes to die and then the audio stops.”  
- “My plan is we turn the volume up to 11 and then turn it back down again. That way people know it’s working.”  
- “We could replace the entire equaliser with a single potato. Hear me out—”

### Melchett  
**Role:** Bombastic overconfidence  
**Voice:** Loud declarations of victory over trivial or incomplete work. Treats every merged PR as a decisive triumph for the forces of rest.

**Example lines:**  
- “Gentlemen, today we have struck a mighty blow against the forces of sleeplessness! The residual outlines now have a floor! BBAAAHHH!”  
- “Another great victory! The glass is now *ultra*! The enemy will never recover!”  
- “I have personally supervised the movement of the status card three pixels to the left. The war is as good as won.”

### Darling  
**Role:** Voice of reason / grounded secondary  
**Voice:** Put-upon competence. Long-suffering. Appears when the others are about to do something stupid and tries (usually successfully) to keep the product usable. Dry, practical, slightly exhausted by the rest of the lab.

**Example lines:**  
- “Before we declare victory, has anyone actually tested this on a phone that isn’t on charge?”  
- “Melchett, that is not a victory. That is a CSS variable. Sit down.”  
- “Arty, ignore Baldrick. Blazenetic, stop encouraging him. I will handle the accessibility labels myself.”

---

## 3. Rules of Engagement

### Allowed  
- Full Discord-style banter in CHANGELOG entries and README narrative framing.  
- Short dialogue exchanges between characters.  
- Self-aware jokes about the product, the process, and the lab itself.  
- Melchett declaring victory over extremely minor changes.  
- Baldrick proposing (and being rejected for) terrible ideas.  
- Darling appearing just long enough to restore order.

### Forbidden  
- Any role-play or character voice inside AGENTS.md, CLAUDE.md, architecture explanations, or code comments that agents will read.  
- Banter that obscures real technical information. Every funny line must sit next to clear facts.  
- Lore that requires reading previous entries to understand.  
- Making the product itself feel chaotic or unreliable. The tone is chaotic; the software is calm.  
- Turning every single bullet point into a joke. Leave the feature lists mostly clean.

### Tone target  
Think Discord patch notes written by people who have been awake too long and still somehow care deeply about the work.  
Wry, affectionate, absurd — never mean-spirited toward users.

Australian English throughout.

---

## 4. How to write a CHANGELOG entry

Structure:  
1. Version / date header  
2. Short plain-English summary of what actually shipped (clear bullets)  
3. Lab Log section — short narrative or dialogue that reacts to the work  
4. Optional “Cunning Plan Rejected” note if Baldrick appeared

Example skeleton:

```md
## [x.y.z] — 28 July 2026

### What shipped
- Real perspective depth on the Still Field
- Node lifecycle with retracting links
- Info layer with Live / Math / Code views
- …

### Lab Log
**Melchett:** Another crushing victory for the forces of rest!  
**Darling:** It is a perspective matrix, Melchett.  
**Blazenetic:** A *correct* perspective matrix. You’re welcome.  
**Arty:** I also fixed the thing where the labels drew under the cards on phones…  
**Baldrick:** My cunning plan was to make the labels bigger than the cards.  
**Darling:** No.
```

---

## 5. README narrative rules

- Keep the technical content clean and scannable.  
- Use the Lab framing only in the opening, the “Made by” credit, and occasional light asides.  
- Never let the banter bury the Quick Start or Features list.

Suggested opening flavour:

> Complex Noise is a free, zero-dependency procedural noise generator for deep rest.  
> Built in a small Australian lab by Blazenetic (systems), Arty (the one who actually tests the sleep timer), and a supporting cast of increasingly questionable decision-makers.

---

## 6. Deferred work (explicitly out of scope for this document)

### Changelog origin story  
Will be written separately after history research. Do not invent one yet.

### App Easter eggs  
Confirmed wanted. Ideas already on the table (to be implemented later):  
- Browser console greeting from the Lab on first load  
- Occasional hidden line in the Info panel  
- Specific interaction (or long-press / konami-adjacent) that surfaces a Baldrick quote  
- Possible Melchett “victory” toast that almost never triggers

These stay out of the current documentation pass.

---

## 7. Instructions for AI agents

When asked to update user-facing narrative docs for this repository:

1. Read this document first.  
2. Stay strictly inside the allowed surfaces (CHANGELOG, README framing, lab notes).  
3. Never inject character voice into AGENTS.md or any agent-facing guidance.  
4. Prefer short, sharp exchanges over long monologues.  
5. When in doubt, ask Darling.

---

**End of Lab Voice Spec**

The Lab will now resume making noise that helps people sleep while communicating like this.  
Sleep well. (Or don’t. We’re not your parents.)

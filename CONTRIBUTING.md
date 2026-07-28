# Contributing to Complex Noise

You found the door marked “research”.  
Welcome to the Lab.

We ship a calm, zero-dependency procedural noise generator that is supposed to keep working at 3 a.m. on a phone that is not on charge. The documentation is allowed to sound like a late-night Discord channel that somehow still cares about residual outlines having a floor.

If you want to help — brilliant. Fork it. Break things carefully. Tell us what you found.

---

## Quick paths

- **Just want the noise?** → [Live demo](https://blazenetic.github.io/complex-noise/)
- **Want to understand the architecture before touching anything?** → **[AGENTS.md](./AGENTS.md)** (the technical contract — clean, professional, zero banter. Agents start here.)
- **Want the origin story and the sprint?** → [History](./docs/HISTORY.md)
- **Want to meet the cast?** → [Meet the Lab](./docs/MEET_THE_LAB.md)
- **Want every document?** → [docs/](./docs/)

---

## How to contribute

### Fork and experiment

Fork freely. Clone your fork. Run it locally:

```bash
git clone https://github.com/YOUR_USERNAME/complex-noise.git
cd complex-noise
npm start          # http://localhost:8123
# or: python3 -m http.server 8123
```

Open the live version, change something, and see what happens. The app is static files only — no build step, no runtime packages. Keep it that way unless you raise the exception explicitly in a PR.

### Reporting issues (including security)

Open an issue for bugs, ideas, missing docs, or anything that feels wrong.

**Security-related findings** are especially welcome.  
- Prefer a private security advisory if the GitHub UI offers it.  
- Otherwise open a normal issue and mark it clearly, or message [@Blazenetic](https://github.com/Blazenetic) directly.  
We take “this could stop the noise at 3 a.m. or worse” seriously.

Please include:  
- What you expected  
- What actually happened  
- Browser / device / steps to reproduce  
- Whether it only shows up after the sleep timer has been running a while (yes, that has happened)

### Pull requests

PRs are welcome for anything important — especially security, battery, reliability, accessibility, or documentation that makes the Lab clearer.

Before you open one:

1. Read **[AGENTS.md](./AGENTS.md)**. It is short on purpose. The architectural rule (state modules publish; `app.js` is the only DOM writer) exists because the play button once froze on “pause” over silent audio at 3 a.m. We would prefer that not happen again.
2. Run the suite: `npm test`. Behaviour changes need matching test updates in the same commit.
3. Keep runtime dependencies at zero. Any exception must be called out loudly in the PR description.
4. British / Australian English in user-facing copy.
5. Do **not** inject Lab Voice into `AGENTS.md`, `CLAUDE.md`, code comments, or technical architecture sections. The wall is there for a reason. Darling will notice.

Point your AI coding agent at `AGENTS.md` first. That is the intended entry point. The Lab Voice lives only in the narrative surfaces (README framing, Changelog Lab Logs, Meet the Lab, History, this file, and similar visitor docs).

### What we will almost certainly accept

- Fixes that keep the sleep timer honest
- Battery or overnight reliability improvements
- Accessibility and mobile polish
- Clearer documentation (with links)
- Security hardening

### What we will push back on

- New runtime dependencies introduced quietly
- Per-frame allocations or second graph scans in the Still Field
- Banter inside agent-facing files
- Changes that make the product feel chaotic instead of calm

---

## Lab Log (first CONTRIBUTING.md)

**Melchett:** Gentlemen! We now have *official contribution guidelines*! Another crushing victory for the forces of open source!

**Darling:** It is a markdown file, Melchett.

**Blazenetic:** I researched how other calm tools handle security reports and contribution patterns, coordinated the short version, and then complained about the edge cases of people trying to put Lab Voice into AGENTS.md. You’re welcome.

**Arty:** I double-checked that AGENTS.md is still completely clean. The wall is intact. I think we’re safe?

**Baldrick:** I have a cunning plan, sir. What if every PR *is* a security issue? We just treat the whole world as hostile and only accept potato-based patches.

**Darling:** No. Put the potato down. Arty, keep the tests green. Blazenetic, stop encouraging him.

**Melchett:** The potato is rejected! Another victory! BBAAAHHH!

**Darling:** That is not how victories work.

---

Research first. Architecture second. Potato plans last.

If something is broken or unclear, open an issue, open a PR, or message the Lab.  
We are listening.

The wall holds. AGENTS.md remains sterile.  
Fork it. Improve it. See you in the Field Lab. Or don’t. We’re not your parents.

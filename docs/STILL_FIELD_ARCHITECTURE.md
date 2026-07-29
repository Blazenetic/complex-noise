# The Still Field, module by module

Companion to [AGENTS.md](../AGENTS.md). That file states the rules; this one
explains where they came from, so the next person to move code around knows
which constraints are load-bearing and which are merely current.

This is an **agent surface**: no banter, no narrative. If you want the story of
why any of this exists, that is [HISTORY.md](./HISTORY.md).

---

## Why the renderer became a directory

`js/still-field.js` was 3,327 lines and eighteen kinds of thing at once:
persisted settings, canvas sizing, a spatial grid, a physics step, four paint
passes, three on-canvas overlays, a statistics snapshot, and the loop that drove
them all. It was not badly written — most of its length is comments explaining
bugs that already happened — but everything in it could see everything else,
through about sixty module-level `let` bindings.

That has a specific cost in a repository whose point is teaching people to work
with AI agents. An agent asked to adjust the edge dimensions had to read the
node lifecycle to be *sure* it had not touched it. There was no smaller unit of
"the part I am changing" than the whole file, so every change was reviewed
against the whole file, and every context window carried the whole file.

The split does not make the code shorter. It makes the *unit you have to hold in
your head* smaller, which is a different and more useful property.

---

## The map

| Module | Owns | Reads |
|---|---|---|
| `math.js` | φ, τ, `smoothstep` | nothing |
| `clock.js` | the drift clock, the diagnostics clock | nothing |
| `telemetry.js` | every live counter | nothing |
| `grid.js` | a uniform spatial grid over a rectangle | nothing |
| `keep-outs.js` | screen rectangles the info layer must avoid | nothing |
| `palette.js` | theme colours, quantised into ramps | the DOM, once per theme change |
| `view.js` | the two canvases, viewport, dpr, reduced motion | nothing |
| `settings.js` | every user choice, and `subscribe()` | `constants`, `storage` |
| `world.js` | world plane, projection, link radius | `settings`, `view`, `grid` |
| `energy.js` | the three energy layers, the CSS mirror | `math`, `clock` |
| `modes.js` | the callout detail modes and their rotation | `math`, `settings` |
| `audio-metrics.js` | frequency-band energy | `audio.js` |
| `code-lines.js` | the transcript the source overlay prints | nothing |
| `code-ticker.js` | the on-canvas source listing | view, settings, clock, palette, keep-outs, telemetry, grid, modes, code-lines |
| `edge-labels.js` | edge dimension slots and their text tables | + `world`, `code-ticker` |
| `callout-content.js` | what a callout *says*: the eight mode branches | `math`, `world`, `clock`, `telemetry`, `energy`, `modes` |
| `callouts.js` | node callouts: selection, placement, paint | + `edge-labels`, `callout-content` |
| `node-pass.js` | the node paint, flat then glowing | view, world, settings, palette, telemetry |
| `nodes.js` | the population: model, lifecycle, one step | + `grid`, `energy`, `callouts`, `edge-labels` |
| `link-pass.js` | the lattice, envelopes, batching, telemetry | + `nodes`, `edge-labels` |
| `loop.js` | one frame, and loop control | most of the above |
| `stats.js` | the public statistics snapshot | everything |
| `../still-field.js` | the public API, and the order side effects happen in | everything |

One module sits outside the renderer entirely:

| Module | Owns | Reads |
|---|---|---|
| `js/hud.js` | every string the `#nerdHud` panel shows | nothing — it is handed a stats snapshot |

`hud.js` imports nothing and touches no DOM. See "Where the panel lives" below.

Read it top to bottom: each row may only depend on rows above it. That is the
whole layering rule, and it is checkable — see "Keeping the graph a DAG" below.

---

## Rule 1 — shared state lives on an object with exactly one writer

The obvious way to split a file full of `let` is to export the `let`s. It does
not work:

```js
// settings.js
export let speed = 2.0;

// loop.js
import { speed } from './settings.js';
speed = 3;            // TypeError: Assignment to constant variable.
```

ES module bindings are *live* but **read-only** from the importing side. Only
the declaring module may assign. That is a genuinely good constraint — it means
you can always find the writer — but it does mean shared mutable state has to be
a property on something.

So each cluster of state is one exported object, owned by one module:

```js
// settings.js — the only file that assigns to `settings`
export const settings = { speed: 2.0, /* … */ };
export function setSpeed(v) { settings.speed = clamp(v, MIN, MAX); write(KEY, settings.speed); }

// anywhere else — read freely
import { settings } from './settings.js';
const speed = view.reducedMotion ? settings.speed * 0.35 : settings.speed;
```

The eight objects are `settings`, `view`, `world`, `grid`, `clock`, `telemetry`,
`population` and `paint` (plus `surfaces` for the canvases and `energy` for the
one smoothed level). If you need to change one from a module that does not own
it, add a function to the owner. Do not add a second writer: the moment two
files assign to `telemetry.edges`, the counter stops meaning anything.

**Performance note.** These are read inside loops that run over 150 nodes at up
to 60 fps, so it is fair to ask what a property load costs versus a module-level
variable. Both are one indirection; the object is monomorphic and never changes
shape, so the load is inline-cached. Where it matters, the passes hoist:

```js
const { cols, rows, counts, start, items } = grid;   // once per frame
```

That is not a micro-optimisation ritual, it is the same thing the old code did
implicitly by having the arrays in scope. Do it in new hot loops too.

---

## Rule 2 — imports point one way

The graph is a DAG. Two consequences shaped the module boundaries, and both are
worth knowing because they will shape yours:

**`telemetry.js` is a leaf.** Every stage of the pipeline writes to it. If it
also *read* from those stages — to assemble the HUD snapshot, which is what it
did when it was part of the big file — it would sit at the centre of a cycle
with all of them. So it holds counters and nothing else, and `stats.js` does the
assembling. `stats.js` may import anything precisely because nothing imports
`stats.js` except the front door.

**`modes.js` exists to break a cycle.** `callouts.js` needs the mode rotation.
So does `code-ticker.js`, which prints the current mode against a line of source.
And `callouts.js` already imports `code-ticker.js`, because a callout must not
be placed over the listing. Leaving the rotation in `callouts.js` would have made
that a cycle. Extracting it gave the quasi-periodic dwell schedule a file of its
own, which turned out to be the clearest place for it anyway.

That is the general shape of the fix: **when two modules need the same thing and
one already depends on the other, the shared thing wants its own module.**

### Keeping the graph a DAG

There is no lint rule for this (the project has no build step and lives inside a
deliberately light ESLint config). It is a dozen lines of Python when you need
it:

```bash
python3 - <<'EOF'
import re, os
g = {}
for dirpath, _, files in os.walk('js'):
    for f in files:
        if not f.endswith('.js'): continue
        p = os.path.normpath(os.path.join(dirpath, f))
        # Strip block comments first: this file's own docs quote import
        # statements, and a grep that counts those reports a phantom cycle.
        src = re.sub(r'/\*.*?\*/', '', open(p).read(), flags=re.S)
        g[p] = {os.path.normpath(os.path.join(dirpath, m))
                for m in re.findall(r"from\s+'(\.{1,2}/[^']+)'", src)}
seen, stack, bad = set(), [], []
def walk(u):
    seen.add(u); stack.append(u)
    for v in g.get(u, ()):
        if v in stack: bad.append(stack[stack.index(v):] + [v])
        elif v not in seen: walk(v)
    stack.pop()
for n in list(g):
    if n not in seen: walk(n)
print(bad or 'no cycles')
EOF
```

Run it if you move code between modules. A cycle in ES modules does not throw —
it silently hands one side a partially-initialised module, and the symptom is a
`undefined is not a function` at import time that points at the wrong file.

---

## Rule 3 — side effects compose in the front door

`settings.js` setters clamp and persist. That is all they do. They do not
remeasure the world, restart the loop, or clear a canvas.

Everything that has to happen *around* a setting change lives in
`js/still-field.js`, where it reads as a short list:

```js
export function setStillFieldDepth(v) {
  prefs.setDepth(v);
  measureWorld(population.nodes.length);   // the far plane moved
  applyNodeCount();                        // …so the node target moved with it
  emit();
}
```

The payoff is that "what does this control do?" is answered by reading twenty
lines of one file, and "how is this value stored?" is answered by reading
`settings.js` without the renderer attached to it. The cost is that every public
setter must remember to `emit()`. That is deliberate: forgetting it fails
visibly and immediately (the UI stops updating), which is the right kind of
failure for a rule you have to remember.

---

## Where to make a change

| I want to… | Open |
|---|---|
| add or retune a persisted setting | `settings.js`, then `../constants.js` |
| change what a control *does* when it changes | `../still-field.js` |
| change how nodes move, are born or die | `nodes.js` |
| change how links are found or drawn | `link-pass.js` |
| change how nodes are drawn or which ones glow | `node-pass.js` |
| add a node detail mode | `modes.js` (name + glyph), then `callout-content.js` (the branch) |
| move a callout, or change when one is shown | `callouts.js` |
| add an edge dimension kind | `edge-labels.js` |
| correct a line of the source listing | `code-lines.js` |
| change how the source listing is drawn | `code-ticker.js` |
| change the perspective, the world size, the link radius | `world.js` |
| add a number to the HUD | `telemetry.js` (the counter), `stats.js` (the field), `../hud.js` (the string), `../app.js` (the element it lands in) |
| restyle the field | `css/styles.css` — the tokens `palette.js` reads |
| change the frame budget, the cap, or the stage order | `loop.js` |

---

## What the split deliberately did not change

- **Any behaviour.** The public API, every field of the statistics snapshot, and
  the rendered output are identical. The suite passed unchanged, and the world
  geometry (`worldW`, `linkRadius`, `gridCells`) was compared before and after.
- **The performance contract.** Same allocation-free passes, same pre-quantised
  palettes, same typed-array slot state, same `getComputedStyle`-once rule.
- **The public path.** `app.js` still does `import * as stillField from
  './still-field.js'` and did not change at all.

Two things *were* changed, in their own commits, on purpose: the trail's
per-frame `rgba()` string became a constant fill plus `globalAlpha`, and a
resize that rescales the field now drops link state. Both are described in their
commit messages.

---

## Rule 4 — the panel is strings, `app.js` is elements

Phase 2 moved the `#nerdHud` panel out of `app.js` and into `js/hud.js`, which
needed a boundary that does not break the one architectural rule.

The tempting split is a `hud.js` that owns `#nerdHud` the way `still-field.js`
owns its two canvases. It was rejected: the rule says `app.js` is the only module
that touches the app's DOM, and a second module with an exception is an exception
the *third* one can cite.

So the line is drawn somewhere else. **`hud.js` turns numbers into strings;
`app.js` puts strings into elements.**

```js
// hud.js — pure. Same stats in, same strings out.
export function liveRows(stats, metrics, source, budgetMs, uptimeMs) {
  return { fps: …, work: …, nodes: …, /* one key per row */ };
}

// app.js — the only file that knows a key corresponds to an element.
const LIVE_ROW_ELS = { fps: els.nerdFps, work: els.nerdWork, /* … */ };
for (const key in rows) setText(LIVE_ROW_ELS[key], rows[key]);
```

Three things follow, and the third is the one to remember:

- Every formatting decision is testable without a DOM. `tests/run.mjs` asserts
  the strings directly, including the ones that only appear in states that are
  awkward to reach in a browser — a stopped renderer, an audio context that does
  not exist yet, callouts switched off.
- The builders return **fresh objects**, unlike `getStillFieldStats()`, which
  reuses one snapshot. That is not an inconsistency: the snapshot is read by the
  render loop's contract of allocating nothing, while these run four times a
  second on a panel that is open and visible. A builder that mutated a shared
  object could not be tested by comparing two calls.
- **A key with no element is silently dropped.** No exception, no console
  warning: the row simply keeps the `—` that `index.html` seeded it with, which
  looks exactly like a measurement that happens to be unavailable. The test
  `every stats-panel row reaches an element` exists solely for this — it plays
  the field, opens each view, and fails naming any row still reading `—`.

---

## Phase 2, and what it found

Phase 1 was the structural move. Phase 2 finished the info layer's split, lifted
the panel out of `app.js`, added the first unit tests, and did the two allocation
fixes that had numbers attached. What follows is what it left.

### What was done

1. **`callouts.js` split.** `callout-content.js` holds the eight mode branches
   and the row cache; `callouts.js` keeps selection, the hysteretic placement and
   the paint. Adding a detail mode no longer puts the placement hysteresis in the
   diff. `code-ticker.js` split the same way: `code-lines.js` is the transcript,
   which is maintained by eye against the renderer, and the ticker is the paint.
2. **`hud.js`**, per Rule 4 above. `app.js` is 1,123 → 1,017 lines.
3. **Unit tests.** Three grouped tests over the pure functions, running in under
   a second between them, plus the row-coverage guard.
4. **Two allocation fixes, measured.** Both are described below.

### The allocation numbers

Sweeping the density slider end to end at 1440×900 walks 35 distinct node
counts. Measured before and after, per sweep:

| | before | after |
|---|---|---|
| first sweep | 35 link + 35 grid reallocations, ~550 KB | 4 link + 9 grid, 126 KB |
| every later drag | ~34 + ~34, ~530 KB | **0, nothing** |
| held at rest | 36.8 KiB | 49 KiB |

The fix is a high-water mark plus a band: `ensureLinkCapacity()` and
`allocateGrid()` grow only, and round the node count up to the next sixteen.
Growing to the *exact* figure was tried first and only took the first sweep from
35 to 24 — each rising step still needs one more row than the last, so exact
growth allocates on nearly every one of them. The band is what makes a drag
inside it free. It costs 12 KiB of headroom.

The eager string tables in `edge-labels.js` now build on first draw:
**5,034 strings, ~0.3 ms**, previously built at boot for every visitor whether or
not the info layer was ever switched on. That number is small and the comment in
that file says so. The argument for moving it is not the 0.3 ms, it is that the
cost is now conditional and it was on the boot path before.

### What phase 2 deliberately did not change

The renderer's behaviour. The suite passed unchanged at every step, the module
graph is still a DAG (the checker above reports no cycles across 31 modules), and
the panel's strings were compared against the running app before and after the
move.

---

## Handover: what phase 3 should pick up

### 1. Frame cost, measured on a throttled CPU

Still the first thing worth doing, and phase 2 did not do it either. What it did
do is write down one figure from a desktop run at default settings: **the info
layer is about 75% of the frame** (0.70 ms of 0.94 ms; update 0.09, links 0.11,
nodes 0.04). That is one machine, one viewport, 44 nodes, everything switched on
— not a result, but it is a place to start, and it says the interesting stage is
the one people assume is free.

Take the four stage timings to 150 nodes on a throttled CPU before optimising
anything. The obvious candidates are not obviously right: the analyser scan looks
like a fixed per-frame cost until you notice `fftSize` is 256, so it is 128
iterations and almost certainly noise.

### 2. Struct-of-arrays for the node hot fields

`x, y, z, vx, vy, energy, fade, sx, sy, scale` in parallel `Float32Array`s would
be more cache-friendly than 150 objects with forty fields each. This is a real
change with a real risk of making the code worse to read, and it should not be
attempted without a measurement showing it matters — which is what item 1 is for.

Note that phase 2 made this *harder* in one small way and easier in another: the
callout row cache is now reached through `calloutRowKey`/`calloutRowValue` in
`callout-content.js`, so the string fields could move without touching the paint,
but the node object is still one literal in `makeNode()` and must stay that way
until the whole thing changes at once.

### 3. The remaining seam in `nodes.js`

`nodes.js` imports `edge-labels.js` only so a population change can free the
dimension slots. It is a DAG edge in the right direction, but it is the one place
a simulation module reaches into an overlay. Phase 2 did not introduce an event
system to fix it, because one call does not justify one — if phase 3 grows a
lifecycle hook for another reason, this is its first customer.

### 4. Smaller things seen and left

- `code-lines.js` is checked against the renderer **by eye**. There is no test
  that a line still describes real code, and there cannot easily be one. If the
  transcript drifts, the overlay becomes confidently wrong. A future phase could
  at least assert that every `CODE_SLOT` a line names is one `refreshCodeValues()`
  actually fills.
- `edge-labels.js` still sizes `DISTANCE_TEXT` and `RADIUS_TEXT` at 2,001 by
  assumption rather than from a bound on the link radius. The clamp keeps it
  safe, but the number is a guess, and a world large enough to exceed it would
  silently pin every dimension at "2000 u".
- `hud.js` returns objects whose keys must match `app.js`'s element maps. The
  test catches a missing element; nothing catches an element mapped to a key
  nothing produces (it simply never updates, which is the same symptom).

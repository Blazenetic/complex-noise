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
| `code-ticker.js` | the on-canvas source listing | view, settings, clock, palette, keep-outs, telemetry, grid, modes |
| `edge-labels.js` | edge dimension slots and their text tables | + `world`, `code-ticker` |
| `callouts.js` | node callouts: selection, placement, paint | + `edge-labels`, `energy` |
| `node-pass.js` | the node paint, flat then glowing | view, world, settings, palette, telemetry |
| `nodes.js` | the population: model, lifecycle, one step | + `grid`, `energy`, `callouts`, `edge-labels` |
| `link-pass.js` | the lattice, envelopes, batching, telemetry | + `nodes`, `edge-labels` |
| `loop.js` | one frame, and loop control | most of the above |
| `stats.js` | the public statistics snapshot | everything |
| `../still-field.js` | the public API, and the order side effects happen in | everything |

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
| add a node detail mode | `modes.js` (name + glyph), then `callouts.js` (the branch) |
| add an edge dimension kind | `edge-labels.js` |
| change the source listing | `code-ticker.js` |
| change the perspective, the world size, the link radius | `world.js` |
| add a number to the HUD | `telemetry.js` (the counter), `stats.js` (the field), `../app.js` (the row) |
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

## Handover: what phase 2 should pick up

Phase 1 was the structural move. The list below is what was seen along the way
and deliberately left, roughly in the order it is worth doing.

### 1. Finish the info layer's split

`callouts.js` is still the largest module (~570 lines) and does three separable
jobs: **content** (`refreshNodeCallout`, the eight mode branches), **layout**
(selection, the hysteretic side, collision), and **paint** (plates, leaders,
rows). Those are three different kinds of change with three different risks —
adding a mode should not put the placement hysteresis in the diff.

Suggested boundary: `callout-content.js` (mode branches + the row cache),
leaving selection/placement/paint together, because they share the pre-sized
arrays and splitting them would mean exporting those.

`code-ticker.js` (~430 lines) has a similar seam: `CODE_LINES` is a transcript of
the renderer, not code, and could be a data module the paint imports.

**Risk: low.** Both are covered by existing tests.

### 2. Lift the HUD out of `app.js`

`app.js` is now the largest file in the project (1,123 lines), and a large slice
of it is the Live / Math / Code views of `#nerdHud` — which is the other half of
the info layer, wired to the DOM. Moving it to `js/hud.js` would leave `app.js`
as event wiring plus renderers, which is what its own header says it is.

**Careful:** the one architectural rule says `app.js` is the only module that
touches the app's DOM. A `hud.js` would be a second one. Either state the
exception explicitly (it owns exactly `#nerdHud`, the way `still-field` owns
exactly two canvases), or have `hud.js` export a pure "given stats, produce
rows" function and leave the DOM writing in `app.js`. The second is more honest
and also unit-testable. Prefer it.

**Risk: medium.** The 250 ms interval, the folded/hidden guards and the
per-view rendering are all battery-relevant; read the HUD notes in AGENTS.md
first.

### 3. Fast unit tests for the pure functions

The browser suite is excellent at behaviour and slow for arithmetic. The split
left a set of genuinely pure functions behind — `smoothstep`, `modeAt`,
`targetNodeCount`, `parseColor`, `buildPalette`, the R2 sequence — and the new
facade test proves the pattern works: a Playwright test can
`await import('/js/still-field/modes.js')` and assert on the module directly,
with no DOM at all.

A dozen of those would catch the class of bug the browser tests cannot see
cheaply: an off-by-one in a quantisation table, a mode weight that stops
averaging 1, a colour string the regex does not accept.

**Risk: none.** Additive.

### 4. Performance, with measurement

Deliberately not done in phase 1, because the brief was structure and because
each of these needs a number attached before and after:

- **What the frame actually costs, measured.** The HUD already reports the four
  stage timings; nobody has yet sat with them at 150 nodes on a throttled CPU
  and written down which stage wins. Do that before optimising anything below,
  because the obvious candidates are not obviously right — the analyser scan,
  for instance, looks like a fixed per-frame cost until you notice `fftSize` is
  256, so it is 128 iterations and almost certainly noise.
- **Eager string tables.** `edge-labels.js` builds ~5,000 strings at module load,
  including two 2,001-entry tables indexed by a distance that cannot exceed the
  link radius. They are built even when Stats is off. Either size them from a
  documented bound or build them the first time the info layer draws.
- **Allocation on slider drags.** `applyNodeCount()` allocates a new
  `Float32Array(n²)` and `measureWorld()` may reallocate the grid arrays, both
  on `input` events that fire at pointer-move rate. Not in the render loop, so
  not a per-frame cost, but it is garbage generated by dragging a slider.
- **Struct-of-arrays for the node hot fields.** `x, y, z, vx, vy, energy, fade,
  sx, sy, scale` in parallel `Float32Array`s would be more cache-friendly than
  150 objects with forty fields each. This is a real change with a real risk of
  making the code worse to read, and it should not be attempted without a
  measurement showing it matters. Phase 3 at the earliest.

### 5. Housekeeping

- `initStillFieldNodes` is exported by the front door and called by nobody. It
  is a reasonable debugging handle, but if it stays it should be used by
  something or documented as deliberate. `startStillFieldLoop` *is* used —
  `togglePlayback()` calls it after `audio.play()` resolves, so a field that
  stopped while paused comes back with the sound — which is worth knowing before
  anybody decides it looks redundant next to `initStillField`.
- The `nodes.js` → `edge-labels.js` import exists only so a population change
  can free the dimension slots. It is a DAG edge in the right direction but it
  is the one place a simulation module reaches into an overlay. If phase 2
  introduces any kind of event or lifecycle hook, that call is the first
  candidate to move onto it.

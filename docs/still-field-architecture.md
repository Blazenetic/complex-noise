# Still Field Architecture

Companion to [AGENTS.md](../AGENTS.md). That file states the rules; this one
explains the live module structure, ownership boundaries, and the constraints
that keep the renderer maintainable and battery-safe.

This is an **agent surface**: no banter, no narrative. Behavioural contracts for
the info layer itself live in [info-layer.md](./info-layer.md). Historical context
lives in [history.md](./history.md) and the handover notes under `docs/handover/`.

---

## Front door

`js/still-field.js` is the composition root and the only public import surface.
`app.js` imports from it and nothing else under `js/still-field/`.

It owns:

- the public API (`initStillField`, setters, getters, `subscribe`, stats);
- the order in which a setting change reaches the rest of the renderer;
- the two canvases handed in at init time (field + info).

It never queries the document for layout, never measures chrome, and never
writes into the app’s own DOM. `app.js` pushes keep-out rectangles via
`setLabelKeepOuts()` and renders every control from the snapshot published by
`subscribe()`.

A setting change is always “store it, then do whatever else has to happen, then
publish”. The interesting part is the middle step and it lives here so that
reading how a control behaves never means reading the renderer.

```js
export function setStillFieldDepth(v) {
  prefs.setDepth(v);
  measureWorld(population.nodes.length);   // the far plane moved
  applyNodeCount();                        // …so the node target moved with it
  emit();
}
```

---

## Module map

Read top to bottom. Each row may only depend on rows above it. That layering is
the whole DAG rule and is checkable (see “Keeping the graph a DAG” below).

| Module | Owns | Reads |
|---|---|---|
| `math.js` | φ, τ, `smoothstep` | — |
| `clock.js` | drift clock, diagnostics clock | — |
| `telemetry.js` | every live counter the renderer writes | — |
| `grid.js` | uniform spatial grid over a rectangle | — |
| `keep-outs.js` | screen rectangles the info layer must avoid | — |
| `palette.js` | theme colours, pre-quantised into ramps | DOM (once per theme change) |
| `view.js` | two canvases, viewport, DPR, reduced motion | — |
| `settings.js` | every user choice + `subscribe()` | `constants`, `storage` |
| `world.js` | world plane, projection, link radius | `settings`, `view`, `grid` |
| `energy.js` | three energy layers + CSS mirror | `math`, `clock` |
| `modes.js` | callout detail modes and their rotation | `math`, `settings` |
| `audio-metrics.js` | frequency-band energy from the analyser | `audio.js` |
| `code-lines.js` | transcript the source overlay prints | — |
| `code-ticker.js` | on-canvas source listing + its transcript raster | view, settings, clock, palette, keep-outs, telemetry, grid, modes, code-lines |
| `edge-labels.js` | edge dimension slots + quantised text tables | + `world`, `code-ticker` |
| `callout-content.js` | what a callout *says* (eight mode branches) | `math`, `world`, `clock`, `telemetry`, `energy`, `modes` |
| `callouts.js` | node callouts: selection, placement, paint | + `edge-labels`, `callout-content` |
| `node-pass.js` | node paint (flat then glowing) | view, world, settings, palette, telemetry |
| `nodes.js` | population model, lifecycle, one simulation step | + `grid`, `energy`, `callouts`, `edge-labels` |
| `link-pass.js` | lattice, envelopes, batching, graph telemetry | + `nodes`, `edge-labels` |
| `loop.js` | one frame + loop control | most of the above |
| `stats.js` | public statistics snapshot | everything |
| `../still-field.js` | public API + side-effect ordering | everything |

One module sits outside the renderer entirely:

| Module | Owns | Reads |
|---|---|---|
| `js/hud.js` | every string the `#nerdHud` panel shows | nothing — it is handed a stats snapshot |

`hud.js` imports nothing from the field and touches no DOM. See “HUD contract”
below.

---

## The three architectural rules

### 1. Shared state lives on an object with exactly one writer

ES module bindings are live but read-only from the importing side. Exporting a
`let` therefore cannot be assigned from another file:

```js
// settings.js
export let speed = 2.0;

// loop.js
import { speed } from './settings.js';
speed = 3;            // TypeError: Assignment to constant variable.
```

So each cluster of mutable state is one exported plain object, owned by one
module:

```js
// settings.js — the only file that assigns to `settings`
export const settings = { speed: 2.0, /* … */ };
export function setSpeed(v) {
  settings.speed = clamp(v, MIN, MAX);
  write(KEY, settings.speed);
}

// anywhere else — read freely
import { settings } from './settings.js';
const speed = view.reducedMotion ? settings.speed * 0.35 : settings.speed;
```

The owned objects are `settings`, `view`, `world`, `grid`, `clock`, `telemetry`,
`population`, `paint` (and `surfaces` for the canvases, `energy` for the
smoothed level). If a module needs to change a value it does not own, add a
function to the owner. Do not introduce a second writer; the moment two files
assign to `telemetry.edges` the counter stops meaning anything.

In hot loops, destructure what you need into locals once at the top of the
function. The object is monomorphic and never changes shape, so the load is
inline-cached; the destructure is the same thing the old monolithic code did by
having the arrays in scope.

### 2. Imports form a DAG

The graph is a directed acyclic graph and must stay one. Two consequences shaped
the current boundaries and will shape yours:

- **`telemetry.js` is a leaf.** Every stage writes to it. If it also assembled
  the HUD snapshot it would sit at the centre of a cycle with all of them. It
  therefore holds counters and nothing else; `stats.js` does the assembling.
  `stats.js` may import anything precisely because nothing imports it except the
  front door.
- **`modes.js` exists to break a cycle.** Both `callouts.js` and `code-ticker.js`
  need the mode rotation, and `callouts.js` already imports `code-ticker.js`
  (a callout must not be placed over the listing). Extracting the rotation gave
  the quasi-periodic dwell schedule a file of its own.

General rule: when two modules need the same thing and one already depends on
the other, the shared thing wants its own module.

#### Keeping the graph a DAG

There is no lint rule (the project has no build step). A dozen lines of Python
suffice:

```bash
python3 - <<'EOF'
import re, os
g = {}
for dirpath, _, files in os.walk('js'):
    for f in files:
        if not f.endswith('.js'): continue
        p = os.path.normpath(os.path.join(dirpath, f))
        # Strip block comments first: this file’s own docs quote import
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
it silently hands one side a partially-initialised module. The symptom is usually
`undefined is not a function` at import time pointing at the wrong file.

### 3. Side effects compose in the front door

`settings.js` setters clamp and persist. That is all they do. They do not
remeasure the world, restart the loop, or clear a canvas.

Everything that has to happen *around* a setting change lives in
`js/still-field.js`, where it reads as a short list. The cost is that every
public setter must remember to `emit()`. That is deliberate: forgetting it fails
visibly and immediately (the UI stops updating), which is the right kind of
failure for a rule you have to remember.

---

## Frame pipeline

`loop.js` is the only place a frame is defined. One frame is:

1. Accept a timestep (capped at `MAX_STEP_S` after a stall or hidden tab).
2. Advance the two clocks (drift clock at user speed, real clock at wall time).
3. `update()` — audio metrics in, node step + spatial grid out.
4. `draw()` — four stages in fixed order:
   - trail (destination-out alpha decay, rate per second);
   - links (`link-pass.js`);
   - nodes (`node-pass.js`, flat then optional glow);
   - info layer on `#stillFieldInfo` (edge dimensions → callouts → source listing).

The loop stops outright when the page is hidden. Requesting frames the browser
will only throttle still wakes the compositor; not asking is free.

Motion is integrated from elapsed time. Anything expressed as “x per frame”
silently changes meaning when the user moves the frame cap. Decays, fades and
smoothing use `1 - Math.exp(-rate * dt)`.

Nothing allocates inside the loop. Candidate and collision data live in
pre-sized typed arrays; every changing string comes from a quantised table;
the trail’s alpha rides `globalAlpha` rather than an `rgba()` string.

---

## HUD contract

The stats panel is strings here, elements in `app.js`.

`js/hud.js` turns a stats snapshot into an object of strings and touches no DOM.
`app.js` maps each key to an element. That keeps the single architectural rule
intact: a second module writing into `#nerdHud` would be an exception the third
one could cite.

```js
// hud.js — pure
export function liveRows(stats, metrics, source, budgetMs, uptimeMs) {
  return { fps: …, work: …, nodes: … /* one key per row */ };
}

// app.js — the only file that knows a key corresponds to an element
const LIVE_ROW_ELS = { fps: els.nerdFps, work: els.nerdWork, /* … */ };
for (const key in rows) setText(LIVE_ROW_ELS[key], rows[key]);
```

`HUD_ROW_KEYS` (and the parallel Math / Code / meter sets) is the shared
contract. `defineRowMap()` rejects a missing or retired key once at boot. The
browser test still fails naming any row that is still reading the `—` that
`index.html` seeded after the field has started.

Builders return fresh objects. The render-loop stats snapshot reuses one object
because the loop may allocate nothing; the HUD builders run four times a second
on a visible panel and are free to allocate.

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
| move a callout or change when one is shown | `callouts.js` |
| add an edge dimension kind | `edge-labels.js` |
| correct a line of the source listing | `code-lines.js` |
| change how the source listing is drawn | `code-ticker.js` |
| change perspective, world size or link radius | `world.js` |
| add a number to the HUD | `telemetry.js` (counter) → `stats.js` (field) → `../hud.js` (string) → `../app.js` (element) |
| restyle the field | `css/styles.css` — the tokens `palette.js` reads |
| change the frame budget, the cap, or stage order | `loop.js` |

`tests/run.mjs` names the front door’s whole export surface. Move code freely
between the modules under `js/still-field/`; that test is what tells you the
door still opens. Arithmetic that does not need a DOM belongs in a `unit:` test
that imports the module directly.

---

## Performance and overnight contracts

These are still live and still enforced by the suite and by AGENTS.md.

- The Still Field is on by default and expected to run for many hours on a phone
  that is not on charge. Every new per-frame cost is an overnight battery cost.
- Frame rate is a user setting (30 / 45 / 60). Nothing may be expressed as a
  per-frame coefficient.
- The loop stops when the page is hidden.
- No objects, arrays or template strings are allocated inside the render loop.
  Candidate and collision coordinates live in pre-sized typed arrays; strings
  are cached or quantised.
- Graph telemetry belongs inside `drawLinks()`. A second O(n²) scan or edge-list
  construction is an overnight regression.
- Text and trail cannot share a canvas. All instrumentation goes on
  `#stillFieldInfo` (cleared each frame, no `shadowBlur`, whole-pixel glyph
  origins).
- Callout side is hysteretic on purpose. Deriving it from position each frame
  reintroduces bounce.
- The info-label energy gate must remain reachable while audio is paused; the
  field is deliberately alive when paused.
- The source-listing raster is allocated only while the listing is visible,
  expanded and on a wide viewport. It is released on every path that stops the
  listing (fold, Stats off, field off, page hidden, `stopLoop`).
- Link buffer and grid arrays only ever grow, and they grow in bands (high-water
  mark + round to next sixteen). A density sweep therefore allocates once, not
  once per step of the slider.
- Distance and radius text tables are sized from the named inclusive bound
  `EDGE_MEASUREMENT_MAX`. The live link radius is asserted before those tables
  can paint.

---

## What this document deliberately does not cover

- The behavioural contract for callouts, edge dimensions, the source listing and
  the Live / Math / Code panel — see [info-layer.md](./info-layer.md).
- Product requirements, history, archaeology and teachings — see the matching
  files under `docs/`.
- Lab Voice narrative — kept outside agent-facing technical files.

The software stays calm. The documentation is allowed to be chaotic. That is the
deal — and the mechanics of keeping that balance stay outside the public
repository.

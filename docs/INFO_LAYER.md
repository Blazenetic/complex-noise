# Still Field Info Layer

![The info layer in the dark theme](screenshots/info-layer-dark.png)

**Navigation:** [Live demo](https://blazenetic.github.io/complex-noise/) · [History](./HISTORY.md) · [Meet the Lab](./MEET_THE_LAB.md) · [AGENTS.md](../AGENTS.md) · [Contributing](../CONTRIBUTING.md) · [All docs](./) · [Changelog](../CHANGELOG.md)

> **Lab aside:** This document is the technical contract for the instrumentation layer. It is allowed a small amount of personality at the edges, but the rules, numbers and constraints stay precise. Baldrick is not permitted to rewrite the pair-scan budget. The spatial grid already publishes its own pair-test counts in the Live view so anyone can verify the ~10× reduction.

The Stats control (card button + mobile launcher) governs one integrated
instrumentation layer: engineering-drawing callouts on the canvas, a source
listing that tracks the render loop, and the top-left Live / Math / Code panel.
It extends the sleep visualisation without introducing another renderer, graph
scan or DOM update loop.

## Two canvases, and why

`#stillField` keeps a trail: every frame subtracts alpha from the previous one
with `destination-out`. That is what gives the drift its comet tail — and it is
also what put a soft halo behind every callout, because a moving label leaves
half a second of decaying copies of itself smeared along its path. Text cannot
share a surface with a trail and stay crisp.

`#stillFieldInfo` is a second full-viewport canvas, later in the DOM (so it
paints above the field) and cleared outright every frame. Nothing drawn on it
ever sets `shadowBlur`, and every glyph origin is snapped to a whole device
pixel, so the type is as sharp as the display can draw it however fast it is
moving. The surface costs one `clearRect` per frame, and only while the layer is
on — when Stats is off it is cleared once and then left alone.

Legibility over a busy field comes from a **plate**, not a glow: a rounded,
mostly-opaque backing with a hairline border and an accent spine. A plate keeps
glyph edges intact; a halo is blur by definition.

## Controls

- **Still Field card** — distinctive Stats button (bar-chart icon + label).
- **Mobile (≤520 px)** — top-left Stats launcher when the panel is off.
- **HUD fold** — chevron in the panel head collapses the body to a compact
  header (session-only; defaults folded on narrow viewports).
- **Field Lab** — the disclosure panel under the equaliser, covering node
  density, link reach, trail persistence, perspective, callout dwell, frame cap
  and the source overlay. See [the Field Lab section](#field-lab).

On/off is persisted (`complexNoise_stillFieldNerd`). Fold is session-only.

## Node callouts

Every node receives a stable lifetime ID such as `n042`. Respawning creates a
new ID, so the callout identifies one procedural event rather than an array
slot.

A callout is an engineering annotation, not a floating caption:

- an **open square handle** on the node itself, so it is obvious which of a
  dozen nodes the block belongs to;
- a **leader line** — one diagonal run out of the handle, then a short
  horizontal shelf into the block. Two straight runs read as a drawing
  annotation; a curve reads as a speech bubble;
- a **plate** with an accent spine, a head rule, and key/value rows;
- a **gauge** on the modes that have a naturally bounded quantity.

Rows are key/value pairs rather than one packed string. That is what lets the
position mode read like a 3D application's transform panel — axis letter in its
axis colour on the left (X red, Y green, Z blue, the convention Blender and most
CAD gizmos share), value right-aligned in a monospaced column with its unit —
instead of `xyz 124, -33, 0.42`, which asks the reader to count commas.

![Transform-mode callouts with axis-coloured rows](screenshots/info-layer-transform.png)

| Mode | Rows | Gauge |
|---|---|---|
| `energy` | `E`, `φ` | energy |
| `position` | `X`, `Y`, `Z` in axis colours | — |
| `velocity` | `|v|`, `θ` | — |
| `projection` | `scale`, `depth`, `life` | lifecycle |
| `wave` | `ψ`, `k·p` | local wave |

The blocks are placed up and to the right of their node, mirroring left when the
right edge is close, and are rejected outright if they would land on another
block, on an edge dimension, on the source listing, or inside an interface
keep-out. Caps are 8 callouts on a wide viewport, 6 on a medium one and 4 on a
phone.

## Edge dimensions

Up to five established edges carry a dimension, drawn the way a length is
annotated on a technical drawing: the text **rides the line it measures**,
rotated to the edge's angle and flipped so it is never upside-down, with witness
ticks bounding the annotated span. Reading a length off a diagram works because
the number is parallel to the thing it describes; a horizontal caption floating
near a diagonal line makes the reader do the association themselves.

Each dimension shows the true three-dimensional distance in world units, the
projected screen angle `θ`, and the depth separation `Δz`.

Samples are collected inside the existing link pass, which already has each
pair's distance and endpoints. There is no second graph scan, no sorting and no
edge list.

## Timing is part of the simulation

Callouts used to vanish before you could read them. Three mechanisms fixed that,
and all three are procedural rather than a fixed interval.

**Quasi-periodic mode schedule.** Each of the five detail modes holds for
`D · (0.72 + 0.56 · frac(kφ))` seconds, where `D` is the Field Lab's dwell
setting and `φ` is the golden ratio. The weights average 1, so `D` remains the
mean seconds per mode, but every mode gets a different, irrationally-related
slice. The rotation therefore never lines up with the travelling wave or with
node lifetimes, and the schedule falls out of the same mathematics as the field.

**Hysteresis and a guaranteed hold.** A node acquires a callout above energy
`0.42` and keeps it until energy falls below `0.32`, and once acquired the
callout is guaranteed `0.55 · D` seconds regardless. A node hovering on the
threshold cannot flicker.

**Opacity envelopes.** Selection drives a per-node alpha toward 1 at 2.6/s and
toward 0 at 0.85/s. Losing the placement contest fades a callout out over more
than a second instead of cutting it. Edge dimensions have the same treatment,
plus slot-level persistence: a slot follows one *pair* — identified by both
endpoints' lifetime IDs, because array indices are recycled — until the pair
breaks or its own dwell expires.

Envelopes run on the real clock, not the drift clock. How long a readout stays
legible is a property of the reader, not of the simulation's speed setting.

## The source overlay

On viewports at least 1000 px wide, the field carries a column of this
renderer’s own source with a program counter sweeping it. Each line is a real
statement from `js/still-field.js`, printed with the value it is currently
producing — `dt`, the node count, the grid cell count, the live `d`, `t` and `s`
of the link envelope, the edge and callout counts.

The counter is not decorative timing. Each stage’s share of the sweep is its
**measured** share of the frame’s work, sampled with `performance.now()` around
`update()`, `drawLinks()`, `drawNodes()` and `drawInfoLayer()`. The marker
lingers where the time actually goes; raise the node density and watch the link
pass take over the listing.

The listing picks a free corner from four candidates rather than sitting in a
fixed one — in immersion mode the floating play cluster owns the bottom right,
and a single fixed position would mean the overlay silently never appeared for
exactly the people most likely to want it. Whichever corner it takes becomes a
keep-out for callouts and dimensions.

Toggle it in the Field Lab (`complexNoise_stillFieldCode`). It follows the Stats
toggle too — it is part of the info layer.

## Live view

| Metric | Definition |
|---|---|
| Frame | Smoothed reciprocal of the accepted render timestep, against the cap |
| Work | Smoothed wall time for one `update()` + `draw()` cycle, as a share of the frame budget |
| Nodes | Node population and the density multiplier that produced it |
| Edges | Link envelopes that were strong enough to paint |
| Pair tests | Pairs the grid actually visited, against `n(n − 1)/2`, and the ratio saved |
| Grid | Live cell count and the link radius in world units |
| Turnover | Observed node births per minute, and the implied mean lifetime |
| Mean degree | `2 · paintedEdges / nodes` |
| Density | `paintedEdges / n(n − 1)/2` |
| Callouts | Painted node callouts versus the viewport cap, plus edge dimensions |
| Mode | Current detail mode and the seconds left in its slice |
| Wave | Travelling-wave phase, vector angle and wavelength |
| Low / Mid / High | Normalised Web Audio analyser band means |
| Field | Smoothed analyser energy mirrored to `--still-energy` |

Below the table is a rolling **frame-time trace**: 68 samples at four a second,
so about seventeen seconds of history, with a rule at half the frame budget.
It is sampled on the readout’s own tick, never from the render loop.

Health is **nominal**, **loaded** or **strained**, derived from measured frame
rate and renderer work *relative to the chosen cap* — selecting 60 fps does not
make the field read as strained the moment it is selected. It is feedback about
the current browser and device, not a benchmark score.

## Math view

![The Math view with live operands](screenshots/info-layer-math.png)

Every row carries the symbolic form **and** the numbers the renderer is putting
through it this instant, evaluated against the highest-energy node on screen
(the "probe") and the first strong edge of the frame. A formula nobody can check
against live values is decoration; a formula with its operands beside it is
instrumentation.

```text
PROJECT     s(z) = 1 / (1 + δz)
            z 0.384 · δ 0.75 → s 0.776

ENERGY      E = .30b + .24w + .46a
            b 0.96 · w 0.97 · a 0.68 → 0.835

DISTANCE    d² = Δx² + Δy² + (Δz · z_w)²
LINK TARGET t = (1 − d / r)^.65
ENVELOPE    s ← s + (t − s)(1 − e^(−λΔt))
WAVE        ψ = ωt − k · p
SCHEDULE    T_k = D(0.72 + 0.56 · frac(kφ))
GRID        pairs ≈ n · ρ · 5c² << n(n−1)/2
```

The travelling-wave vector uses `WAVE_KY = WAVE_KX · φ`, giving an angle of
about `58.28°`. The irrational slope avoids a short visible repeat against the
low-discrepancy placement sequence.

## Code view

![The Code view with per-stage timings](screenshots/info-layer-code.png)

Four pipeline stages, each with its measured milliseconds and percentage, a
share bar, the statements it runs, and the values those statements are
producing. `data-hot` marks whichever stage currently dominates — the same
signal that paces the on-canvas program counter.

## Field Lab

![The Field Lab panel](screenshots/field-lab.png)

| Control | Range | Default | Effect |
|---|---|---|---|
| Node density | 0.5–2.2× | 1.0× | Multiplies the viewport-derived population (26–44) |
| Link reach | 0.6–1.6× | 1.0× | Multiplies the link radius |
| Trail persistence | 0.04–0.5 s | 0.12 s | Time constant of the trail’s alpha decay |
| Perspective | 0.3–1.6 | 0.75 | Depth strength; also re-derives the world plane |
| Callout dwell | 4–26 s | 14 s | Mean seconds per detail mode |
| Frame rate | 30 / 45 / 60 | 30 | Render cap |
| Source overlay | on / off | on | The on-canvas source listing |

The density default deserves a note: the multiplier applies to the *clamped*
26–44 window, not to the raw viewport area. Applying it to the raw figure would
have opened a 1440×900 display on 132 nodes at the default setting — a
different-looking field for everybody who never touches the Lab. Density is an
opt-in, not a silent redesign.

Motion is integrated from elapsed time, so the frame cap changes how smooth the
field looks and nothing about how fast it drifts. The trail is stored as a decay
*rate per second* for the same reason: a per-frame alpha would have quietly
halved every trail the moment the cap moved from 30 to 60.

Everything in the Lab is disabled while the field is off, and persisted under
`complexNoise_stillField*` keys.

## Performance

Linking is a **uniform spatial grid**, not an O(n²) scan. Cells are one link
radius across, and each node tests only its own cell and the four neighbours
that have not already tested it. Both the real and the would-be brute-force pair
counts are in the Live view, so the saving is visible rather than claimed —
typically 5× at the default population and above 10× with density raised.

The grid is rebuilt every frame with a counting sort into pre-sized typed
arrays: no maps, no arrays of arrays, no allocation. A node that wraps across
the world boundary clears its links, because a pair that stops being visited
would otherwise freeze its envelope at whatever strength it held.

Consecutive edge segments that quantise to the same colour, alpha and width
accumulate into one path. Alpha varies almost continuously with depth and
strength, so this collapses runs rather than whole frames — a real saving when
the field is calm and a no-op when it is not. The path count sits next to the
edge count in the Code view so the ratio is visible.

## Accessibility contract

- Stop the loop outright while the page is hidden, whatever the frame cap.
- Collect graph counters and edge samples inside the existing link pass. Do not
  add a second pair scan, per-frame arrays, sorting or DOM writes.
- Refresh DOM instrumentation at 250 ms; refresh dynamic canvas strings at
  one-second cadence.
- Preserve reduced-motion behaviour (no glow pass, slowed drift, a program
  counter that sweeps at a third speed, no CSS transitions in the panel),
  transparent trail clearing, lifecycle fades and interface keep-outs.
- Keep Live / Math / Code as the only interactive elements in the panel body.
  Values are ordinary text, not `<output>` elements or live regions, so a screen
  reader is not interrupted four times a second.
- Tabs use the standard tab pattern with `aria-selected`, associated panels,
  roving focus and Left/Right Arrow navigation.
- Every Field Lab control is labelled, carries an `aria-valuetext` in words, and
  clears a 44 px touch target. `tests/run.mjs` audits both.
- Axis and ink colours are per-theme tokens, chosen to hold contrast against
  their own plate in dark and in bone.

---

See also the live technical orientation in [AGENTS.md](../AGENTS.md), the contribution guidelines in [CONTRIBUTING.md](../CONTRIBUTING.md), and the quantitative Lab Log in [CHANGELOG.md](../CHANGELOG.md).

> **Blazenetic:** I researched the spatial-grid literature, coordinated the typed-array implementation, and then complained about the residual outline floor. The Live view publishes the pair counts so you can check the claim yourself. You’re welcome.  
> **Baldrick:** My cunning plan was to make the pair-test ratio a potato.  
> **Darling:** No.

The software stays calm. The documentation is allowed a little chaos at the edges. That is still the deal.

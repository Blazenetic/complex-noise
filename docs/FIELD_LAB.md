# Field Lab

Field Lab is the opt-in instrumentation surface for the Still Field. It makes
the renderer's real inputs, equations, graph topology, and frame cost visible
without turning the default sleep experience into a dashboard.

It is deliberately not a simulated diagnostics panel. Every live value is
measured or derived from the same update and draw passes that produce the
canvas.

## User model

Open **Still Field → Open Field Lab**. The lab has three views:

- **Live** — renderer timing, graph topology, travelling-wave phase, and
  analyser bands.
- **Math** — the six main equations responsible for placement, projection,
  energy, linking, link animation, and drift.
- **Code** — compact versions of the actual JavaScript operations in
  `js/still-field.js`.

The lab is not persisted. Reloading returns to the calm, uninstrumented sleep
surface. Turning off Still Field also closes Field Lab because there is no
renderer left to inspect.

## Canvas annotations

When the lab is open, every visible node gets a stable identifier such as
`n042`. The ID lasts for that node's lifetime and changes when the node is
respawned, so it represents an individual procedural event rather than an array
slot.

A rotating subset of up to 12 nodes receives a larger callout. A callout remains
on one statistic for eight seconds before moving to the next mode:

1. energy and personal breath phase;
2. three-dimensional world position;
3. velocity magnitude and heading in radians;
4. perspective scale and lifecycle progress;
5. the local phase of the travelling plane wave.

The long interval is intentional. A number that changes before it can be read
is visual noise, not information. Stable IDs on every node preserve continuity
while the detailed sample rotates through the graph.

Up to seven established edges also show:

- `d₃`, the real three-dimensional world distance used by the link test; and
- `θ`, the edge's current projected screen angle in degrees.

These are sampled deterministically rather than by strength sorting. Sorting
would allocate and add an extra pass on every frame; deterministic sampling
keeps the values representative and the implementation cheap.

## Live metric definitions

| Metric | Definition |
|---|---|
| frame rate | Exponentially smoothed reciprocal of the accepted render timestep |
| render cost | Smoothed wall time for `update()` plus `draw()` |
| nodes | Current adaptive node count, 32–58 |
| live edges | Link envelopes above the visibility epsilon |
| pair tests | `n(n − 1) / 2`, the pairs visited by the link pass |
| mean degree | `2 · liveEdges / nodes` |
| graph density | `liveEdges / pairTests` |
| wave phase | Global `ωt` phase, wrapped to 0–360° |
| low / mid / high | Normalised Web Audio analyser band means |
| field | Smoothed analyser energy mirrored to `--still-energy` |

The wave-vector angle is constant for the current tuning:

```text
atan2(WAVE_KY, WAVE_KX)
= atan2(0.0042 · φ, 0.0042)
≈ 58.28°
```

Using the golden ratio for the slope prevents the wave from settling into a
short, obvious repeat against the placement sequence.

## Equations

Perspective projection uses a pinhole camera:

```text
scale(z) = 1 / (1 + z · DEPTH)
screen   = centre + world · scale
```

Node energy combines a personal oscillator, a travelling plane wave, and the
audio analyser:

```text
breath = 0.5 + 0.5 sin(phase)
wave   = 0.5 + 0.5 sin(ωt − k·p)
energy = clamp(0.30 breath + 0.24 wave + 0.46 audio, 0, 1)
```

Links use real 3D distance. `zWorld` converts normalised depth into the same
world units as x and y:

```text
d² = Δx² + Δy² + (Δz · zWorld)²
```

The link envelope is frame-rate independent:

```text
strength ← strength + (target − strength)(1 − e^(−λΔt))
```

Attack and release use different λ values, so links arrive clearly and recede
slowly. Node drift uses the same continuous-time principle:

```text
velocity ← (velocity + randomJitter · Δt)e^(−0.55Δt)
position ← position + velocity · Δt
```

## Architecture and performance contract

`still-field.js` owns telemetry state and publishes it through the same
`getState()` / `subscribe()` channel as its settings. `app.js` is still the only
module that writes Field Lab DOM. Button handlers only call state-module
setters.

Keep these constraints when extending the lab:

- Instrumentation must remain opt-in.
- Do not add a second node-pair scan. Collect graph counters inside
  `drawLinks()`.
- Publish DOM telemetry no faster than 4 Hz. The canvas may draw at 30 fps, but
  humans cannot read 30 DOM updates per second.
- Avoid per-frame arrays, sorting, and object creation in the canvas passes.
- Keep detailed node and edge callouts capped.
- Stop all instrumentation with the existing hidden-page render shutdown.
- Add any new live value to the state snapshot and render it from `app.js`.

The small `getState()` telemetry copy occurs only on the 4 Hz publication path,
not on every frame. With Field Lab closed, timing measurement, annotations, and
telemetry publication are skipped.

## Accessibility

The canvas remains `aria-hidden`; the same information is available as text in
the Field Lab. Tabs use `role="tab"`, `aria-selected`, associated tab panels,
and Left/Right Arrow navigation. Live numeric columns use tabular figures and
are left aligned so changing digit widths remain easy to scan. The pulsing
health indicator stops under `prefers-reduced-motion`.

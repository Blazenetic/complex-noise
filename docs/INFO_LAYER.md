# Still Field Info Layer

The Info labels switch governs one integrated instrumentation layer: compact
canvas callouts and the top-left Live / Math / Code panel. It extends the
sleep visualisation without introducing another renderer, graph scan or DOM
update loop.

## Live view

Live values are measured or derived from the same passes that paint the field:

| Metric | Definition |
|---|---|
| Frame | Exponentially smoothed reciprocal of the accepted render timestep |
| Work | Smoothed wall time for one `update()` + `draw()` cycle |
| Nodes | Adaptive node population, 26–44 |
| Edges | Link envelopes that were strong enough to paint |
| Pair tests | `n(n − 1) / 2`, the pairs visited by `drawLinks()` |
| Mean degree | `2 · paintedEdges / nodes` |
| Density | `paintedEdges / pairTests` |
| Callouts | Painted node callouts versus the viewport cap, plus edge annotations |
| Mode | Current eight-second node-detail mode |
| Wave | Global travelling-wave phase and its fixed vector angle |
| Low / Mid / High | Normalised Web Audio analyser band means |
| Field | Smoothed analyser energy mirrored to `--still-energy` |

Health is **nominal**, **loaded** or **strained**, derived from measured frame
rate and renderer work. It is feedback about the current browser/device, not a
benchmark score.

## Canvas callouts

Every node receives a stable lifetime ID such as `n042`. Respawning creates a
new ID, so the label identifies one procedural event rather than an array slot.

The nearest qualifying nodes rotate through five modes every eight seconds:

1. energy and personal oscillator phase;
2. three-dimensional world position;
3. velocity magnitude and heading;
4. perspective scale and lifecycle progress;
5. local travelling-wave phase.

A phone can show up to four node callouts and a wider viewport up to six.
Energy gating, lifecycle fade, screen bounds, interface keep-outs and callout
collision checks can lower the live count. Dynamic strings are cached for one
second, so the 30 fps canvas reuses them rather than allocating text each frame.

Up to three established edges show:

- `d₃`, the true three-dimensional distance used by the link test; and
- `θ`, the projected screen angle in degrees.

The sample is collected while `drawLinks()` already has each pair's distance
and endpoints. It never sorts links or performs a second O(n²) pass. Edge text
comes from pre-quantised lookup tables.

## Displayed mathematics

Perspective projection:

```text
scale(z) = 1 / (1 + 0.75z)
screen   = centre + world · scale
```

Node energy:

```text
breath = 0.5 + 0.5 sin(phase)
wave   = 0.5 + 0.5 sin(ωt − k·p)
energy = clamp(0.30 breath + 0.24 wave + 0.46 audio, 0, 1)
```

Three-dimensional link distance and target:

```text
d² = Δx² + Δy² + (Δz · zWorld)²
target = (1 − d / radius)^0.65
```

Frame-rate-independent link envelope and node drift:

```text
strength ← strength + (target − strength)(1 − e^(−λΔt))
velocity ← (velocity + randomJitter · Δt)e^(−0.55Δt)
position ← position + velocity · Δt
```

The travelling-wave vector uses `WAVE_KY = WAVE_KX · φ`, giving an angle of
about `58.28°`. The irrational slope avoids a short visible repeat against the
low-discrepancy placement sequence.

## Performance and accessibility contract

- Keep the field at 30 fps and stop it outright while the page is hidden.
- Collect graph counters and edge samples inside the existing link pass.
- Do not add a second pair scan, per-frame arrays, sorting or DOM writes.
- Refresh DOM instrumentation at 250 ms; refresh dynamic canvas strings at
  one-second cadence.
- Preserve reduced-motion behaviour, transparent trail clearing, lifecycle
  fades and interface keep-outs.
- Keep Live / Math / Code as the only interactive elements in the panel.
  Values are ordinary text, not `<output>` elements or live regions, so a
  screen reader is not interrupted four times a second.
- Tabs use the standard tab pattern with `aria-selected`, associated panels,
  roving focus and Left/Right Arrow navigation.

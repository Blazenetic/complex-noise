# Audio reliability investigation

## What this change addresses

The reported symptom is an occasional brief cutout during long **brown-noise**
sessions. White noise is separately perceived as too sharp. The brown generator
and its character are unchanged. This patch does **not** claim to reproduce or
fix the reported hours-long device symptom.

The engine loops one native `AudioBufferSourceNode`; it does not refill audio
from a JavaScript timer. Brown's filter state is already carried across the
12-second wrap. A long animation frame alone therefore does not establish the
cause of an audible gap.

Confirmed lifecycle gaps corrected here:

- An unresolved first `play()` could start after `stop()` had returned. A
  request generation now invalidates that stale start.
- Repeated `play()` calls regenerated the buffer and restarted the sleep timer.
  They now preserve the source and deadline.
- Context suspension/interruption was not reflected in status. State changes
  now update status; returning to a visible page attempts to resume the same
  source after checking the sleep deadline. Rejected resumes remain retryable
  through pause/play. This cannot override browser or OS restrictions.
- The context now requests the standard `playback` latency hint. Browsers may
  ignore it; it favours power/glitch resistance over musical-instrument latency.
  It is not a promise of fewer dropouts on any particular device.

A colour replacement now prepares and starts a candidate before retiring the
existing source. If buffer allocation, source creation, connection or start
fails, the candidate is disposed, the previous selection is restored and the
gain fades back to the current volume. Initial source failures leave playback
stopped and offer a retry. These paths do not establish physical output or fix
all possible AudioContext setup failures.

## Evidence and limits

`npm run test:audio` runs deterministic fake-context lifecycle tests. These prove
ordering and cancellation, not browser output. `npm test` runs these first, then
the real Chromium suite. The added browser cases exercise context suspend/resume
and render three 12-second brown and white loops at 44.1, 48 and 96 kHz with an
`OfflineAudioContext`, comparing every output sample with the expected loop.
Offline rendering verifies samples and native loop scheduling, not Bluetooth,
speaker output, locked-phone playback or eight-hour reliability.

A separate seeded numerical investigation generated 24 brown and 24 white
12-second buffers across those sample rates. No exact-zero run appeared. The
minimum measured 128-sample RMS was 0.0436 for brown and 0.2351 for white; wrap
steps remained below the maximum internal adjacent-sample steps. This bounded
sample set rules out neither all random sequences nor device interruptions.
Brown can exceed ±1 before master gain (maximum 1.087 in that set); normal soft
volume provides headroom, while high volume plus EQ boost remains a separate
clipping risk. No limiter or gain change is introduced without listening tests.

## Capture useful evidence next time

After a cutout, while the same page remains open, an engineer can inspect:

```js
(await import('./js/audio.js')).getPlaybackDiagnostics()
```

This returns context state, sample rate, reported latency and the last 32
transport/context events. It is local-only, never persisted or sent, and contains
no microphone recording. A `running` context is **not** proof that the physical
output was continuous. Reloading clears the event history.

For a useful comparison, record browser/version, operating system, speaker/wired/
Bluetooth output, screen locked/unlocked, colour, volume, EQ, Still Field setting,
timer and approximate cutout time. Test the same brown settings with Still Field
on/off and with speaker versus Bluetooth, changing one thing at a time. Check
whether the interruption repeats every 12 seconds (a buffer-local clue) or is
irregular. Never restart playback automatically after an expired sleep timer.

## White sharpness and next experiments

White has equal energy per hertz, so it has much more upper-frequency content
than brown. Sharpness is not proof of a defective waveform. Try the existing
High EQ at −3 dB first; that is reversible and preserves the white option. An
optional softened-white preset or high-cut control deserves level-matched blind
listening on actual headphones/speakers before adoption. Do not silently change
the beloved brown sound or raise loudness to compensate.

An AudioWorklet experiment could avoid the audible repetition of a short stored
sequence, but is not automatically a cure for OS audio interruptions. Compare
CPU/battery cost and real device captures before replacing the simple native
loop. Device output capture and an overnight Android/iOS acceptance run remain
necessary before claiming the cutout resolved.

References: [AudioContext latencyHint](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/AudioContext),
[context states and interruptions](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state),
[native buffer looping](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/loop).

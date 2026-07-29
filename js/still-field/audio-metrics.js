/**
 * Frequency-band energy from the audio engine's analyser.
 *
 * The analyser sits *before* the gain node in `audio.js`, on purpose: the
 * visualisation tracks the noise rather than the listening volume, so turning
 * the sound down does not put the field to sleep.
 */

import { getAnalyser, getIsPlaying } from '../audio.js';

// Reused across frames so the render loop allocates nothing.
let metricsBuffer = null;
const metrics = { low: 0, mid: 0, high: 0, overall: 0 };

/**
 * Returns a live object that is rewritten in place each call — copy the fields
 * you need rather than holding the reference across frames.
 *
 * @returns {{low: number, mid: number, high: number, overall: number}} all 0–1
 */
export function getStillAudioMetrics() {
  const analyser = getAnalyser();
  if (!analyser || !getIsPlaying()) {
    metrics.low = metrics.mid = metrics.high = metrics.overall = 0;
    return metrics;
  }
  const bins = analyser.frequencyBinCount;
  if (!metricsBuffer || metricsBuffer.length !== bins) {
    metricsBuffer = new Uint8Array(bins);
  }
  analyser.getByteFrequencyData(metricsBuffer);

  let lowSum = 0, midSum = 0, highSum = 0, total = 0;
  const lowEnd = Math.floor(bins * 0.12);
  const midEnd = Math.floor(bins * 0.45);
  for (let i = 0; i < bins; i++) {
    const v = metricsBuffer[i] / 255;
    total += v;
    if (i < lowEnd) lowSum += v;
    else if (i < midEnd) midSum += v;
    else highSum += v;
  }
  metrics.low = lowSum / Math.max(1, lowEnd);
  metrics.mid = midSum / Math.max(1, midEnd - lowEnd);
  metrics.high = highSum / Math.max(1, bins - midEnd);
  metrics.overall = total / bins;
  return metrics;
}

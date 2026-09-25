/*
 * Game sound effects, synthesized with the Web Audio API.
 * No audio files to host or load; every sound is a few oscillators.
 */
let ctx = null;

function ac() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** One enveloped note. t = start offset in seconds. */
function note(freq, t, dur, { type = 'sine', gain = 0.16, slideTo } = {}) {
  const a = ac();
  if (!a) return;
  const start = a.currentTime + t;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g).connect(a.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

/** Bright two-note chime. Pitch climbs a little as the combo grows. */
export function correct(combo = 1) {
  const lift = 2 ** (Math.min(combo - 1, 12) / 24); // up to half an octave
  note(880 * lift, 0, 0.12, { type: 'triangle', gain: 0.14 });
  note(1318.5 * lift, 0.07, 0.22, { type: 'sine', gain: 0.16 });
  note(2637 * lift, 0.07, 0.12, { type: 'sine', gain: 0.03 }); // sparkle
}

/** Soft, low "bonk". Clear feedback without being punishing. */
export function wrong() {
  note(220, 0, 0.22, { type: 'triangle', gain: 0.16, slideTo: 140 });
  note(110, 0, 0.18, { type: 'sine', gain: 0.1 });
}

/** Rising arpeggio for combo milestones. */
export function milestone() {
  [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
    note(f, i * 0.07, 0.28, { type: 'triangle', gain: 0.13 }));
  note(2093, 0.36, 0.4, { type: 'sine', gain: 0.05 });
}

/** Short fanfare at the end of a round or when the daily goal is hit. */
export function fanfare() {
  const seq = [[392, 0], [523.25, 0.1], [659.25, 0.2], [783.99, 0.3], [1046.5, 0.42]];
  seq.forEach(([f, t]) => note(f, t, 0.35, { type: 'triangle', gain: 0.12 }));
  note(1046.5, 0.42, 0.7, { type: 'sine', gain: 0.08 });
}

/** Light haptic tap on phones that support it (Android). */
export function buzz(pattern) {
  try { navigator.vibrate?.(pattern); } catch { /* ignore */ }
}

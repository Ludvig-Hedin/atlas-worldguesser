/**
 * Tiny Web Audio sound engine — synthesised tones, no audio assets, works
 * offline, respects the device-local `sound` preference (see preferences.ts).
 *
 * The AudioContext is created lazily on the first play (which always happens
 * inside a user gesture — a click or key press — so browser autoplay policies
 * are satisfied) and resumed if the browser suspended it.
 */

let ctx: AudioContext | null = null;
let enabled = true;

/** Sync the engine with the persisted preference (called by the provider). */
export function setSoundEnabled(value: boolean): void {
  enabled = value;
}

export function isSoundEnabled(): boolean {
  return enabled;
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Play one envelope-shaped tone at `startAt` seconds from now. */
function tone(freq: number, startAt: number, dur: number, type: OscillatorType, gain: number): void {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + startAt;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Cheerful rising arpeggio for a correct answer. */
export function playCorrect(): void {
  if (!enabled) return;
  tone(587.33, 0, 0.12, "sine", 0.14); // D5
  tone(880.0, 0.085, 0.16, "sine", 0.14); // A5
  tone(1174.66, 0.17, 0.2, "sine", 0.12); // D6
}

/** Low descending buzz for a wrong answer. */
export function playWrong(): void {
  if (!enabled) return;
  tone(196, 0, 0.16, "sawtooth", 0.09); // G3
  tone(155.56, 0.1, 0.22, "sawtooth", 0.08); // D#3
}

/** Soft blip for menu selections. */
export function playClick(): void {
  if (!enabled) return;
  tone(660, 0, 0.05, "triangle", 0.06);
}

/** Little fanfare when a game finishes. */
export function playFinish(): void {
  if (!enabled) return;
  tone(523.25, 0, 0.14, "sine", 0.13); // C5
  tone(659.25, 0.12, 0.14, "sine", 0.13); // E5
  tone(783.99, 0.24, 0.14, "sine", 0.13); // G5
  tone(1046.5, 0.36, 0.24, "sine", 0.12); // C6
}

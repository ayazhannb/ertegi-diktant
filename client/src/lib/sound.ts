// Gentle sound effects generated with WebAudio (no audio files needed).
let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(m: boolean) { muted = m; }

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch { return null; }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.12) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.05);
}

export const sounds = {
  click() { tone(660, 0, 0.08, 'triangle', 0.06); },
  correct() { tone(523.25, 0, 0.18); tone(659.25, 0.09, 0.18); tone(783.99, 0.18, 0.28); },
  wrong() { tone(246.94, 0, 0.16, 'sine', 0.09); tone(220, 0.14, 0.22, 'sine', 0.09); },
  hint() { tone(880, 0, 0.12, 'triangle', 0.07); },
  complete() {
    [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.13, 0.2, 'triangle', 0.12));
  },
  star() { tone(1318.5, 0, 0.15, 'triangle', 0.1); },
};

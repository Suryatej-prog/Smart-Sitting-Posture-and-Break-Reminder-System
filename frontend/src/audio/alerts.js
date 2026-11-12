// Alert sounds are synthesised with the Web Audio API, so there are no audio files to ship.
// Browsers keep audio locked until the page has had a click or key press.
let ctx = null;

export async function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') await ctx.resume();
    return ctx.state === 'running';
  } catch {
    return false;
  }
}

export const audioRunning = () => Boolean(ctx && ctx.state === 'running');

function tone(freq, start, length, volume, type) {
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + length);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + length + 0.05);
}

const level = (volume) => Math.min(1, Math.max(0, volume)) * 0.5;

// Two falling notes: posture warning
export function playWarning(volume) {
  const v = level(volume);
  if (!audioRunning() || v < 0.005) return false;
  tone(523, 0, 0.22, v, 'triangle');
  tone(392, 0.25, 0.38, v, 'triangle');
  return true;
}

// Three rising notes: break reminder (clearly different from the warning)
export function playBreak(volume) {
  const v = level(volume);
  if (!audioRunning() || v < 0.005) return false;
  tone(659, 0, 0.3, v, 'sine');
  tone(784, 0.28, 0.3, v, 'sine');
  tone(988, 0.56, 0.55, v, 'sine');
  return true;
}

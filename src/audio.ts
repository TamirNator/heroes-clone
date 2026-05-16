// Lightweight Web Audio synth — no external assets.
// Browsers require a user gesture before AudioContext can resume; we lazy-init.

type AudioContextType = typeof AudioContext;
interface WindowWithAudio extends Window {
  AudioContext?: AudioContextType;
  webkitAudioContext?: AudioContextType;
}

let ctx: AudioContext | null = null;
let enabled = (() => {
  try {
    return localStorage.getItem("heroes-clone:muted") !== "1";
  } catch {
    return true;
  }
})();

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof window === "undefined") return null;
  try {
    const w = window as WindowWithAudio;
    const AC = w.AudioContext ?? w.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  } catch {
    return null;
  }
}

export function setAudioEnabled(value: boolean): void {
  enabled = value;
  try {
    localStorage.setItem("heroes-clone:muted", value ? "0" : "1");
  } catch {
    /* ignore */
  }
}

export function isAudioEnabled(): boolean {
  return enabled;
}

export function toggleAudio(): boolean {
  setAudioEnabled(!enabled);
  return enabled;
}

function playTone(freq: number, durationMs: number, type: OscillatorType = "sine", volume = 0.1): void {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  try {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = 0;
    osc.connect(gain).connect(c.destination);
    const now = c.currentTime;
    const dur = durationMs / 1000;
    // ADSR-ish: quick attack, linear decay
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.linearRampToValueAtTime(0, now + dur);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  } catch {
    /* ignore */
  }
}

export function sfxAttackHit(): void {
  playTone(220, 80, "square", 0.08);
}

export function sfxEnemyHit(): void {
  playTone(160, 80, "sawtooth", 0.08);
}

export function sfxPickup(): void {
  playTone(880, 120, "sine", 0.07);
}

export function sfxVictory(): void {
  playTone(523, 120, "triangle", 0.1);
  setTimeout(() => playTone(659, 120, "triangle", 0.1), 120);
  setTimeout(() => playTone(784, 200, "triangle", 0.1), 240);
}

export function sfxDefeat(): void {
  playTone(220, 200, "sawtooth", 0.1);
  setTimeout(() => playTone(165, 300, "sawtooth", 0.1), 200);
}

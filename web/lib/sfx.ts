/** Every sound is synthesized. No audio files, no licensing, and square waves suit pixel art. */

let ctx: AudioContext | null = null;
let muted = false;

export function initAudio(): void {
  if (typeof window === "undefined") return;
  if (!ctx) {
    ctx = new AudioContext();
    muted = localStorage.getItem("prodos:muted") === "1";
  }
  void ctx.resume();
}

export function setMuted(m: boolean): void {
  muted = m;
  try {
    localStorage.setItem("prodos:muted", m ? "1" : "0");
  } catch {
    // private mode, or site data blocked — the toggle just won't persist
  }
}

export function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem("prodos:muted") === "1";
  } catch {
    return muted;
  }
}

type ToneOpts = {
  freq: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  at?: number;
  to?: number;      // sweep target frequency
};

function tone({ freq, dur, type = "square", gain = 0.05, at = 0, to }: ToneOpts): void {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  amp.gain.setValueAtTime(0, t0);
  amp.gain.linearRampToValueAtTime(gain, t0 + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(amp).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur: number, gain = 0.08, at = 0): void {
  if (!ctx || muted) return;
  const rate = ctx.sampleRate;
  const buf = ctx.createBuffer(1, Math.floor(rate * dur), rate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  const amp = ctx.createGain();
  amp.gain.value = gain;
  src.buffer = buf;
  src.connect(amp).connect(ctx.destination);
  src.start(ctx.currentTime + at);
}

export const sfx = {
  click: () => tone({ freq: 880, dur: 0.04, gain: 0.03 }),
  keyed: () => tone({ freq: 1320, dur: 0.03, gain: 0.025, type: "triangle" }),

  /** one tick per deploy stage */
  stage: (n: number) => tone({ freq: 420 + n * 90, dur: 0.07, gain: 0.04 }),

  shipped: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.11, at: i * 0.07 }));
  },

  coin: () => {
    tone({ freq: 988, dur: 0.06 });
    tone({ freq: 1319, dur: 0.14, at: 0.06 });
  },

  /** incident klaxon: two-tone, twice */
  alarm: () => {
    for (const at of [0, 0.42]) {
      tone({ freq: 740, dur: 0.2, gain: 0.07, at, type: "sawtooth" });
      tone({ freq: 560, dur: 0.2, gain: 0.07, at: at + 0.2, type: "sawtooth" });
    }
  },

  crash: () => {
    noise(0.5, 0.09);
    tone({ freq: 220, dur: 0.5, to: 40, gain: 0.07, type: "sawtooth" });
  },

  /** rollback failed — the best joke in the game gets its own sound */
  buzz: () => {
    tone({ freq: 150, dur: 0.35, gain: 0.08, type: "square" });
    tone({ freq: 145, dur: 0.35, gain: 0.06, type: "sawtooth" });
  },

  recovered: () => {
    [784, 988].forEach((f, i) => tone({ freq: f, dur: 0.13, at: i * 0.09 }));
  },

  boot: () => {
    [392, 523, 659, 784].forEach((f, i) => tone({ freq: f, dur: 0.22, at: i * 0.1, gain: 0.04, type: "triangle" }));
  },

  over: () => {
    [523, 466, 415, 311].forEach((f, i) => tone({ freq: f, dur: 0.3, at: i * 0.16, gain: 0.05, type: "triangle" }));
    noise(0.6, 0.05, 0.64);
  },

  /** an acquisition offer lands */
  offer: () => {
    [659, 831, 988, 1319].forEach((f, i) => tone({ freq: f, dur: 0.18, at: i * 0.12, gain: 0.045, type: "triangle" }));
  },

  /** signed. you got out. */
  acquired: () => {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, dur: 0.26, at: i * 0.13, gain: 0.05 }));
    [784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.5, at: 0.65 + i * 0.02, gain: 0.04, type: "triangle" }));
  },

  flip: () => tone({ freq: 660, dur: 0.05, gain: 0.03, type: "triangle" }),
  deny: () => tone({ freq: 180, dur: 0.12, gain: 0.05 }),
};

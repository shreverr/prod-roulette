/** Seeded PRNG (mulberry32) with the handful of Python `random.Random` methods the engine uses.
 *  The cursor is a plain number so it can live inside the sealed game state. */
export class Rng {
  private s: number;

  constructor(seed?: number) {
    this.s = (seed ?? Math.floor(Math.random() * 2 ** 32)) >>> 0;
  }

  /** Current cursor — persist this, not the instance. */
  get seed(): number {
    return this.s;
  }

  random(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Inclusive on both ends, like Python's randint. */
  randint(a: number, b: number): number {
    return a + Math.floor(this.random() * (b - a + 1));
  }

  choice<T>(xs: readonly T[]): T {
    return xs[Math.floor(this.random() * xs.length)];
  }

  choices<T>(xs: readonly T[], weights: readonly number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.random() * total;
    for (let i = 0; i < xs.length; i++) {
      r -= weights[i];
      if (r < 0) return xs[i];
    }
    return xs[xs.length - 1];
  }

  /** Single weighted pick, weight computed per item. */
  pick<T>(xs: readonly T[], weight: (x: T) => number): T {
    const weights = xs.map(weight);
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.random() * total;
    for (let i = 0; i < xs.length; i++) {
      r -= weights[i];
      if (r < 0) return xs[i];
    }
    return xs[xs.length - 1];
  }

  /** Weighted draw without replacement — how a deployment picks the changes it contains. */
  weightedSample<T>(xs: readonly T[], weight: (x: T) => number, k: number): T[] {
    const pool = [...xs];
    const out: T[] = [];
    while (out.length < k && pool.length) {
      const chosen = this.pick(pool, weight);
      out.push(chosen);
      pool.splice(pool.indexOf(chosen), 1);
    }
    return out;
  }

  sample<T>(xs: readonly T[], k: number): T[] {
    const copy = [...xs];
    this.shuffle(copy);
    return copy.slice(0, k);
  }

  shuffle<T>(xs: T[]): void {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [xs[i], xs[j]] = [xs[j], xs[i]];
    }
  }
}

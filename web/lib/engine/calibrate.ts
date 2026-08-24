/** Monte Carlo calibration for the free-info channels.
 *
 *  The question this answers: if a player reads only what a deployment shows for free — commit
 *  message, author, clock, version, PR metadata, change list — how often are they right?
 *
 *  Target: ~70% combined, and no single channel much over 60% on its own, so the read is a real
 *  skill without making the paid tools pointless. `engine.test.ts` asserts the band.
 */
import { AUTHORS, CHANGES, NEUTRAL_COMMITS, PANIC_COMMITS } from "./content";
import { bake, buildTuning, dress, type Tuning, type Version } from "./engine";
import { Rng } from "./rng";
import type { Commit, Pr } from "./state";

export type Free = { changes: string[]; commit: Commit; pr: Pr; version: string };

const NL = String.fromCharCode(10);

const DANGER_BY_TEXT = new Map(CHANGES.map((c) => [c.text, c.danger as number]));
const RISK_BY_AUTHOR = new Map(AUTHORS.map((a) => [a.handle, a.risk as number]));

/** Tier is looked up from the pools rather than guessed with a regex, so adding new flavor
 *  text can never silently weaken the reader (and therefore the calibration). */
const TIER_BY_MESSAGE = new Map<string, "neutral" | "panic">([
  ...NEUTRAL_COMMITS.map((m) => [m, "neutral" as const] as const),
  ...PANIC_COMMITS.map((m) => [m, "panic" as const] as const),
]);

/** Anything not in a pool is a generated conventional commit: `type(scope): subject`. */
const TIDY_HINT = /^[a-z]+\([a-z]+\): /;

/** Bump type is inferred the way a human infers it: trailing zeroes mean a bigger bump. */
function bumpOf(version: string): "major" | "minor" | "patch" {
  const m = version.match(/^v(\d+)\.(\d+)\.(\d+)/);
  if (!m) return "patch";
  const [, , minor, patch] = m;
  if (minor === "0" && patch === "0") return "major";
  if (patch === "0") return "minor";
  return "patch";
}

/** One scorer per channel. Higher means "this looks like it will take prod down". */
export const CHANNELS: Record<string, (f: Free) => number> = {
  changes: (f) => f.changes.reduce((sum, t) => sum + (DANGER_BY_TEXT.get(t) ?? 0), 0) - 2,

  commit: (f) => {
    const tier = TIER_BY_MESSAGE.get(f.commit.message);
    if (tier === "panic") return 3;
    if (tier === "neutral") return 0;
    return TIDY_HINT.test(f.commit.message) ? -2 : 0;
  },

  author: (f) => (RISK_BY_AUTHOR.get(f.commit.author) ?? 0) - 1,

  clock: (f) => {
    let d = 0;
    if (f.commit.hour <= 5) d += 2;
    else if (f.commit.hour >= 21) d += 1;
    else if (f.commit.hour >= 10 && f.commit.hour <= 16) d -= 1;
    if (f.commit.day === "Fri" || f.commit.day === "Sat") d += 1;
    return d;
  },

  version: (f) => {
    const bump = bumpOf(f.version);
    let d = bump === "major" ? 2 : bump === "minor" ? 0 : -1;
    if (/-hotfix|-dirty/.test(f.version)) d += 2;
    else if (/-rc/.test(f.version)) d -= 1;
    return d;
  },

  pr: (f) => {
    let d = (2 - f.pr.approvals) + f.pr.unresolved - 1;
    if (f.pr.branchAgeDays > 10) d += 1;
    return d;
  },
};

export const readDanger = (f: Free): number =>
  Object.values(CHANNELS).reduce((sum, score) => sum + score(f), 0);

export function sample(n: number, seed = 1, tuning?: Tuning): { free: Free; bad: boolean }[] {
  const rng = new Rng(seed);
  let version: Version = { major: 2, minor: 4, patch: 0 };
  const out: { free: Free; bad: boolean }[] = [];
  for (let i = 0; i < n; i++) {
    const bad = i % 2 === 0;
    const paid = bake(rng, bad);
    const free = dress(rng, bad, version, paid.diffLines, tuning);
    version = free.next;
    out.push({ free, bad });
  }
  return out;
}

/** Best achievable accuracy for a scorer, sweeping the threshold a player would converge on. */
export function accuracyOf(rows: { free: Free; bad: boolean }[], score: (f: Free) => number) {
  const scored = rows.map((r) => ({ s: score(r.free), bad: r.bad }));
  const lo = Math.min(...scored.map((x) => x.s));
  const hi = Math.max(...scored.map((x) => x.s));
  let best = { accuracy: 0, threshold: lo };
  for (let t = lo; t <= hi; t++) {
    const right = scored.reduce((n, x) => n + (x.s >= t === x.bad ? 1 : 0), 0);
    const accuracy = right / scored.length;
    if (accuracy > best.accuracy) best = { accuracy, threshold: t };
  }
  return best;
}

export function measure(n = 40_000, seed = 1, tuning?: Tuning) {
  const rows = sample(n, seed, tuning);
  const perChannel = Object.fromEntries(
    Object.entries(CHANNELS).map(([name, score]) => [name, accuracyOf(rows, score)]),
  );
  return { combined: accuracyOf(rows, readDanger), perChannel, n };
}

/** Sweep the global knob to find the strength that lands on a target accuracy. */
export function sweep(target = 0.70, n = 20_000, seed = 1): string {
  const lines: string[] = [];
  for (let k = 0.05; k <= 0.65; k += 0.05) {
    const { combined, perChannel } = measure(n, seed, buildTuning(k));
    const worst = Math.max(...Object.values(perChannel).map((r) => r.accuracy));
    lines.push(
      `strength ${k.toFixed(2)}  combined ${(combined.accuracy * 100).toFixed(1)}%  strongest channel ${(worst * 100).toFixed(1)}%` +
        (Math.abs(combined.accuracy - target) < 0.015 ? "   <-- target" : ""),
    );
  }
  return lines.join(NL);
}

export function report(n = 40_000, seed = 1, tuning?: Tuning): string {
  const { combined, perChannel } = measure(n, seed, tuning);
  const lines = [
    `combined      ${(combined.accuracy * 100).toFixed(1)}%  (threshold >= ${combined.threshold})`,
    ...Object.entries(perChannel)
      .sort((a, b) => b[1].accuracy - a[1].accuracy)
      .map(([name, r]) => `  ${name.padEnd(11)} ${(r.accuracy * 100).toFixed(1)}%`),
  ];
  return lines.join("\n");
}

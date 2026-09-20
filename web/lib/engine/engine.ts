/** Ported 1:1 from prod_roulette/engine.py. Pure: no I/O, no globals, RNG cursor lives in state.
 *  Every mutating helper also appends to an event list the client replays as animation. */
import {
  AUTHORS, CHANGES, COMMIT_TYPES, COMPANIES, COMPANY_IDS, DAYS, HOTFIX_FAILS, HOUR_BUCKETS,
  INCIDENTS, ITEMS, ITEM_POOL, INVESTOR_UPDATES, NEUTRAL_COMMITS, PANIC_COMMITS, ROLLBACK_FAILS,
  SLACK_TOASTS, SPRINT_NAMES, UPGRADES, WAIT_FAILS,
  type Bump, type CommitTier, type CompanyId, type ItemId, type UpgradeId, type VersionTag,
} from "./content";
import { Rng } from "./rng";
import {
  IllegalAction,
  type Action, type Commit, type GameEvent, type GameState, type Incident, type IncidentChoice,
  type Outcome, type Pr, type Risk, type Slot,
} from "./state";

// ---------- difficulty curve ----------

/** [slots, disasters] for a round. Always leaves at least one safe deploy. */
export function queueSpec(round: number): [number, number] {
  const size = Math.min(4 + Math.floor(round / 2), 8);
  const ratio = Math.min(0.33 + 0.03 * round, 0.75);
  const bad = Math.max(1, Math.min(size - 1, Math.floor(size * ratio + 0.5)));
  return [size, bad];
}

export const baseRevenue = (round: number) => 60_000 + 25_000 * round;
export const baseLoss = (round: number) => 45_000 + 35_000 * round;

export const STARTING_USERS = 12_482;

/** Push the in-game clock forward. Every action costs time, which is how Friday arrives. */
export function advanceClock(g: GameState, minutes: number): void {
  let total = g.clock.hour * 60 + g.clock.minute + minutes;
  const days = Math.floor(total / (24 * 60));
  total -= days * 24 * 60;
  g.clock = { day: (g.clock.day + days) % 7, hour: Math.floor(total / 60), minute: total % 60 };
}

/** Revenue scales with the user base. Losing users shrinks income, which is what stops
 *  blue/green (uptime immortality) from also meaning invulnerability. */
export const userFactor = (g: GameState) =>
  Math.min(3, Math.max(0.25, g.users / STARTING_USERS));

/** Extra disasters per sprint from declining, capped so a third decline is a gamble
 *  rather than a guaranteed death. */
export const MAX_DECLINE_HEAT = 2;

/** Acquisition multiple, one rung per declined offer. */
export const MULTIPLIERS = [1.5, 2.5, 4, 6, 9];
export const multiplierFor = (declined: number) =>
  MULTIPLIERS[Math.min(declined, MULTIPLIERS.length - 1)];
/** Offers are gated on cumulative revenue, not cash on hand — so buying tooling never
 *  postpones your exit, and the number an acquirer quotes is a multiple of revenue. */
export const FIRST_OFFER = 2_000_000;
export const OFFER_STEP = 1.35;
export const handCap = (g: GameState) => (g.upgrades.includes("observability") ? 6 : 4);
export const co = (g: GameState) => COMPANIES[g.company];
export const maxVelocity = (g: GameState) =>
  co(g).velocity + (g.upgrades.includes("staging_env") ? 1 : 0);
export const has = (g: GameState, u: UpgradeId) => g.upgrades.includes(u);
export const currentSlot = (g: GameState): Slot | null =>
  g.queue.i < g.queue.slots.length ? g.queue.slots[g.queue.i] : null;

// ---------- queue ----------

/** Signals are baked once, from the hidden flag plus noise.
 *  Overlapping ranges are the point: tools give you evidence, not answers.
 *  A disaster ships green CI 25% of the time. */
export function bake(rng: Rng, bad: boolean) {
  const ciTotal = rng.choice([64, 96, 128, 210]);
  let fails: number;
  let diffLines: number;
  let risk: Risk;
  if (bad) {
    fails = rng.random() < 0.25 ? 0 : rng.randint(1, 7);
    diffLines = rng.randint(180, 1400);
    risk = rng.choices<Risk>(["HIGH", "MEDIUM", "LOW"], [70, 20, 10]);
  } else {
    fails = rng.random() < 0.70 ? 0 : rng.randint(1, 3);
    diffLines = rng.randint(12, 380);
    risk = rng.choices<Risk>(["LOW", "MEDIUM", "HIGH"], [60, 30, 10]);
  }
  return { ciPass: ciTotal - fails, ciTotal, diffLines, risk };
}

/** How readable a deployment is, controlled by ONE knob.
 *
 *  Each table below is the "sharp" shape — the direction each cue leans. `soften` blends it
 *  toward uniform: strength 1 uses the sharp table as-is, 0 makes it pure noise. Calibrated by
 *  `lib/engine/calibrate.ts`, asserted in `engine.test.ts`. Tune the knob, not the tables. */
export const SIGNAL_STRENGTH = 0.42;

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

const softenArr = (xs: number[], k: number): number[] => {
  const m = mean(xs);
  return xs.map((x) => m + k * (x - m));
};

const softenRec = <K extends string>(rec: Record<K, number>, k: number): Record<K, number> => {
  const m = mean(Object.values(rec));
  return Object.fromEntries(
    Object.entries(rec).map(([key, v]) => [key, m + k * ((v as number) - m)]),
  ) as Record<K, number>;
};

/** Sharp shapes. Index-keyed tables are indexed by the thing they describe
 *  (change danger, author risk, approval count, unresolved count, branch-age bucket). */
const SHARP = {
  change: { bad: [1, 2, 3, 4], safe: [4, 3, 2, 1] },
  author: { bad: [1, 2, 3, 4], safe: [4, 3, 2, 1] },
  approvals: { bad: [4, 3, 1], safe: [1, 3, 4] },
  unresolved: { bad: [2, 3, 2, 1], safe: [5, 2, 1, 0] },
  branchAge: { bad: [1, 2, 4], safe: [4, 3, 1] },
  commitTier: {
    bad: { tidy: 1, neutral: 2, panic: 4 },
    safe: { tidy: 4, neutral: 2, panic: 1 },
  },
  day: {
    bad: { Mon: 2, Tue: 1, Wed: 1, Thu: 1, Fri: 4, Sat: 2 },
    safe: { Mon: 2, Tue: 3, Wed: 3, Thu: 3, Fri: 1, Sat: 1 },
  },
  hour: {
    bad: { "deep-night": 4, morning: 1, afternoon: 1, evening: 3, late: 3 },
    safe: { "deep-night": 1, morning: 4, afternoon: 4, evening: 2, late: 1 },
  },
  bump: {
    bad: { major: 3, minor: 3, patch: 2 },
    safe: { major: 1, minor: 2, patch: 5 },
  },
  tag: {
    bad: { none: 3, rc: 1, build: 2, hotfix: 3, dirty: 3 },
    safe: { none: 4, rc: 3, build: 3, hotfix: 1, dirty: 1 },
  },
};

export type Tuning = {
  change: { bad: number[]; safe: number[] };
  author: { bad: number[]; safe: number[] };
  approvals: { bad: number[]; safe: number[] };
  unresolved: { bad: number[]; safe: number[] };
  branchAge: { bad: number[]; safe: number[] };
  commitTier: { bad: Record<string, number>; safe: Record<string, number> };
  day: { bad: Record<string, number>; safe: Record<string, number> };
  hour: { bad: Record<string, number>; safe: Record<string, number> };
  bump: { bad: Record<string, number>; safe: Record<string, number> };
  tag: { bad: Record<string, number>; safe: Record<string, number> };
};

/** Per-channel damping on top of the global knob, for channels that stack several cues
 *  (the PR line carries approvals + unresolved + branch age, so it needs holding back). */
const DAMP: Record<string, number> = { approvals: 0.6, unresolved: 0.6, branchAge: 0.6 };

export function buildTuning(strength: number): Tuning {
  const k = (name: string) => strength * (DAMP[name] ?? 1);
  return {
    change: { bad: softenArr(SHARP.change.bad, k("change")), safe: softenArr(SHARP.change.safe, k("change")) },
    author: { bad: softenArr(SHARP.author.bad, k("author")), safe: softenArr(SHARP.author.safe, k("author")) },
    approvals: { bad: softenArr(SHARP.approvals.bad, k("approvals")), safe: softenArr(SHARP.approvals.safe, k("approvals")) },
    unresolved: { bad: softenArr(SHARP.unresolved.bad, k("unresolved")), safe: softenArr(SHARP.unresolved.safe, k("unresolved")) },
    branchAge: { bad: softenArr(SHARP.branchAge.bad, k("branchAge")), safe: softenArr(SHARP.branchAge.safe, k("branchAge")) },
    commitTier: { bad: softenRec(SHARP.commitTier.bad, k("commitTier")), safe: softenRec(SHARP.commitTier.safe, k("commitTier")) },
    day: { bad: softenRec(SHARP.day.bad, k("day")), safe: softenRec(SHARP.day.safe, k("day")) },
    hour: { bad: softenRec(SHARP.hour.bad, k("hour")), safe: softenRec(SHARP.hour.safe, k("hour")) },
    bump: { bad: softenRec(SHARP.bump.bad, k("bump")), safe: softenRec(SHARP.bump.safe, k("bump")) },
    tag: { bad: softenRec(SHARP.tag.bad, k("tag")), safe: softenRec(SHARP.tag.safe, k("tag")) },
  };
}

export const TUNING = buildTuning(SIGNAL_STRENGTH);

const BUMPS: Bump[] = ["major", "minor", "patch"];
const TAGS: VersionTag[] = ["none", "rc", "build", "hotfix", "dirty"];
const TIERS: CommitTier[] = ["tidy", "neutral", "panic"];
const AGE_BUCKETS: [number, number][] = [[0, 3], [4, 10], [11, 60]];

export type Version = { major: number; minor: number; patch: number };

/** The free, always-visible half of a deployment — commit, author, clock, version, PR metadata,
 *  change list. Conditioned on the already-decided outcome exactly like `bake`, so the announced
 *  disaster count stays exactly true while the text still leans. */
export function dress(
  rng: Rng, bad: boolean, from: Version, diffLines: number, tuning: Tuning = TUNING,
): { changes: string[]; commit: Commit; pr: Pr; version: string; next: Version } {
  const side = bad ? "bad" : "safe";

  const picks = rng.weightedSample(CHANGES, (c) => tuning.change[side][c.danger], rng.randint(2, 4));
  const top = picks[0];

  const tier = rng.pick(TIERS, (t) => tuning.commitTier[side][t]);
  const message =
    tier === "tidy"
      ? `${rng.choice(COMMIT_TYPES)}(${top.area}): ${top.text[0].toLowerCase()}${top.text.slice(1)}`
      : tier === "neutral"
        ? rng.choice(NEUTRAL_COMMITS)
        : rng.choice(PANIC_COMMITS);

  const bucket = rng.pick(HOUR_BUCKETS, (b) => tuning.hour[side][b.name]);
  const commit: Commit = {
    message,
    author: rng.pick(AUTHORS, (a) => tuning.author[side][a.risk]).handle,
    day: rng.pick(DAYS, (d) => tuning.day[side][d]),
    hour: rng.randint(bucket.from, bucket.to),
    minute: rng.randint(0, 59),
  };

  const bump = rng.pick(BUMPS, (b) => tuning.bump[side][b]);
  const next: Version =
    bump === "major"
      ? { major: from.major + 1, minor: 0, patch: 0 }
      : bump === "minor"
        ? { major: from.major, minor: from.minor + 1, patch: 0 }
        : { major: from.major, minor: from.minor, patch: from.patch + 1 };

  const tag = rng.pick(TAGS, (t) => tuning.tag[side][t]);
  const suffix =
    tag === "none" ? ""
      : tag === "rc" ? `-rc${rng.randint(1, 3)}`
        : tag === "build" ? `+build.${rng.randint(1000, 9999)}`
          : `-${tag}`;

  const ageBucket = rng.pick([0, 1, 2], (i) => tuning.branchAge[side][i]);
  const [ageFrom, ageTo] = AGE_BUCKETS[ageBucket];

  const pr: Pr = {
    approvals: rng.pick([0, 1, 2], (n) => tuning.approvals[side][n]),
    unresolved: rng.pick([0, 1, 2, 3], (n) => tuning.unresolved[side][n]),
    branchAgeDays: rng.randint(ageFrom, ageTo),
    // Deliberately a noisy proxy for the paid diff: hints at size, never replaces reading it.
    // Never fewer files than listed changes, or the card contradicts itself.
    filesChanged: Math.max(picks.length, Math.round(diffLines / rng.randint(45, 170))),
  };

  return { changes: picks.map((c) => c.text), commit, pr, version: `v${next.major}.${next.minor}.${next.patch}${suffix}`, next };
}

export function buildQueue(g: GameState, rng: Rng, ev: GameEvent[]): [number, number] {
  const [size, baseBad] = queueSpec(g.round);
  // Each declined acquisition offer buys the acquirer one more disaster per sprint.
  const bad = Math.min(size - 1, baseBad + g.declineHeat);
  const flags = [...Array(bad).fill(true), ...Array(size - bad).fill(false)] as boolean[];
  rng.shuffle(flags);

  const slots: Slot[] = [];
  for (const b of flags) {
    const paid = bake(rng, b);
    const free = dress(rng, b, g.version, paid.diffLines);
    g.version = free.next;   // versions climb monotonically across the whole run
    slots.push({
      version: free.version,
      changes: free.changes,
      commit: free.commit,
      pr: free.pr,
      bad: b,
      ...paid,
      known: false,
      ciSeen: false,
      diffSeen: false,
      resolution: null,
    });
  }
  g.queue = { slots, i: 0 };
  g.sprintName = rng.choice(SPRINT_NAMES);
  g.velocity = maxVelocity(g);
  g.canaryUsed = false;
  g.flagUsed = false;
  g.friday = false;
  g.phase = "deploying";
  ev.push({ t: "round:start", round: g.round, size, bad });
  drawItems(g, 2, rng, ev);
  return [size, bad];
}

// ---------- actions ----------

function deploy(g: GameState, rng: Rng, ev: GameEvent[]): void {
  const s = g.queue.slots[g.queue.i];
  const index = g.queue.i;
  const reckless = !(s.known || s.ciSeen || s.diffSeen);
  const doubled = g.friday;
  g.friday = false;
  s.known = true;
  g.queue.i += 1;
  g.deploys += 1;
  g.lastDoubled = doubled;

  advanceClock(g, rng.randint(35, 95));
  ev.push({ t: "deploy:start", version: s.version });

  if (!s.bad) {
    let rev = Math.trunc(baseRevenue(g.round) * userFactor(g) * co(g).revenue);
    if (doubled) rev *= 2;
    if (reckless) {
      rev = Math.trunc(rev * 1.5);
      g.recklessDeploys += 1;
    }
    g.cash += rev;
    g.earned += rev;
    const growth = rng.randint(80, 400);
    g.users += growth;
    s.resolution = "ok";
    ev.push({ t: "deploy:ok", version: s.version, revenue: rev, reckless, doubled });
    ev.push({ t: "cash", delta: rev });
    ev.push({ t: "users", delta: growth });
    return;
  }

  g.incidents += 1;
  let damage = Math.max(1, Math.round((doubled ? 2 : 1) * co(g).damage));
  let absorbed = false;
  if (has(g, "canary") && !g.canaryUsed) {
    g.canaryUsed = true;
    absorbed = true;
    damage = 0;
  }
  const flavor = rng.choice(INCIDENTS);
  const frac = Math.min(0.6, flavor.frac * (1 + 0.04 * g.round) * co(g).userLoss);
  const usersHit = Math.max(1, Math.trunc(g.users * frac));
  const inc: Incident = {
    title: flavor.title,
    lines: [...flavor.lines],
    usersHit,
    cashLoss: baseLoss(g.round) + usersHit * 20,
    damage,
    absorbed,
  };

  s.resolution = "down";
  ev.push({ t: "deploy:bad", version: s.version, doubled });
  ev.push({
    t: "incident:open",
    title: inc.title, lines: inc.lines, usersHit: inc.usersHit,
    cashLoss: inc.cashLoss, absorbed: inc.absorbed,
  });

  if (absorbed) {
    // The canary already ate the damage — nothing to decide.
    resolveIncident(g, rng, inc, "canary", ev);
    return;
  }
  g.pending = inc;
  g.phase = "incident";
}

export function resolveIncident(
  g: GameState, rng: Rng, inc: Incident, choice: IncidentChoice | "canary", ev: GameEvent[],
): void {
  let damage = inc.damage;
  let loss = inc.cashLoss;
  let ok = false;
  let reason = "";

  if (choice === "canary") {
    ok = true;
    loss = Math.trunc(loss / 3);
  } else if (choice === "rollback") {
    const p = has(g, "blue_green") ? 1.0 : 0.55 + (has(g, "automated_rollback") ? 0.30 : 0);
    ok = rng.random() < p;
    if (ok) {
      damage = 0;
      loss = Math.trunc(loss / 2);
    } else {
      reason = rng.choice(ROLLBACK_FAILS);
    }
  } else if (choice === "hotfix") {
    ok = rng.random() < 0.40;
    if (ok) damage = 0;
    else {
      damage += 1;
      reason = rng.choice(HOTFIX_FAILS);
    }
  } else {
    ok = rng.random() < 0.30;
    if (ok) {
      damage = 0;
      loss = Math.trunc(loss / 2);
    } else {
      loss = Math.trunc(loss * 1.5);
      reason = rng.choice(WAIT_FAILS);
    }
  }

  advanceClock(g, rng.randint(25, 130));   // incidents eat the evening
  if (has(g, "db_replica")) loss = Math.trunc(loss / 2);
  g.uptime -= damage;
  g.cash -= loss;
  const churn = Math.max(1, Math.trunc(inc.usersHit / 2));
  g.users = Math.max(0, g.users - churn);
  g.pending = null;

  ev.push({ t: "incident:result", choice, ok, damage, loss, reason });
  // Toast lands after the result, never before it — flavor follows the outcome, always.
  if (rng.random() < 0.6) {
    const toast = rng.choice(SLACK_TOASTS);
    ev.push({ t: "slack", channel: toast.channel, text: toast.text });
  }
  if (damage) ev.push({ t: "uptime", delta: -damage });
  ev.push({ t: "cash", delta: -loss });
  ev.push({ t: "users", delta: -churn });
}

function skip(g: GameState, ev: GameEvent[]): void {
  if (g.velocity <= 0) throw new IllegalAction("no velocity tokens left");
  const s = g.queue.slots[g.queue.i];
  const index = g.queue.i;
  g.velocity -= 1;
  g.staged += 1;
  s.known = true;
  g.queue.i += 1;
  let missed = 0;
  if (!s.bad) {
    missed = Math.trunc(baseRevenue(g.round) / 3);
    g.cash -= missed;
  }
  s.resolution = s.bad ? "dodged" : "wasted";
  ev.push({ t: "skip", wasBad: s.bad, missed });
  if (missed) ev.push({ t: "cash", delta: -missed });
}

/** Feature-flag the current deployment into safety. Once per round. */
function neutralize(g: GameState, rng: Rng, ev: GameEvent[]): void {
  if (!has(g, "feature_flags")) {
    ev.push({ t: "flag", ok: false, message: "no feature flag infrastructure" });
    return;
  }
  if (g.flagUsed) {
    ev.push({ t: "flag", ok: false, message: "flag budget spent this round" });
    return;
  }
  const s = g.queue.slots[g.queue.i];
  g.flagUsed = true;
  const wasBad = s.bad;
  s.bad = false;
  s.known = true;
  Object.assign(s, bake(rng, false));
  ev.push({
    t: "flag", ok: true,
    message: wasBad
      ? "flagged off the dangerous path. it is safe now."
      : "flagged a deployment that was already fine.",
  });
}

// ---------- items ----------

type Effect = (g: GameState, rng: Rng, ev: GameEvent[]) => [boolean, string];

const EFFECTS: Record<ItemId, Effect> = {
  staging: (g) => {
    const s = g.queue.slots[g.queue.i];
    s.known = true;
    return [true, "staging says: " + (s.bad ? "this will take prod down" : "healthy")];
  },

  ci: (g) => {
    const s = g.queue.slots[g.queue.i];
    if (has(g, "better_monitoring")) {
      s.known = true;
      return [true, `tests ${s.ciPass}/${s.ciTotal} · instrumented verdict: ${s.bad ? "DISASTER" : "SAFE"}`];
    }
    s.ciSeen = true;
    return [true, `tests passed: ${s.ciPass}/${s.ciTotal}`];
  },

  diff: (g) => {
    const s = g.queue.slots[g.queue.i];
    s.diffSeen = true;
    return [true, `${s.diffLines} lines changed · risk: ${s.risk}`];
  },

  logs: (g, rng, ev) => {
    const later = g.queue.slots.slice(g.queue.i + 1);
    const hidden = later.filter((s) => !s.known);
    if (!hidden.length) return [false, "nothing later left to grep"];
    const s = rng.choice(hidden);
    s.known = true;
    const index = g.queue.slots.indexOf(s);
    return [true, `logs implicate #${index + 1} in the queue: ${s.bad ? "DISASTER" : "clean"}`];
  },

  revert: (g, _rng, ev) => {
    const s = g.queue.slots[g.queue.i];
    s.known = true;
    s.resolution = "reverted";
    g.queue.i += 1;
    return [true, `reverted ${s.version} unshipped — it was ${s.bad ? "a DISASTER" : "fine, actually"}`];
  },

  rewrite: (g, rng) => {
    const s = g.queue.slots[g.queue.i];
    // Only the paid signals re-bake. The commit, author and PR metadata stay as they were —
    // it is the same pull request, so the free read now points the wrong way on purpose.
    s.bad = !s.bad;
    s.known = false;
    s.ciSeen = false;
    s.diffSeen = false;
    Object.assign(s, bake(rng, s.bad));
    return [true, "migration rewritten. this deployment is something else now."];
  },

  friday: (g) => {
    if (g.friday) return [false, "already shipping Friday"];
    g.friday = true;
    return [true, "Friday 6pm deploy armed: double revenue, double damage."];
  },

  postmortem: (g, _rng, ev) => {
    if (g.uptime >= g.maxUptime) return [false, "uptime already maxed"];
    g.uptime += 1;
    ev.push({ t: "uptime", delta: 1 });
    return [true, "blameless postmortem. +1 uptime."];
  },

  contractor: (g, rng, ev) => {
    const got = drawItems(g, 2, rng, ev);
    if (!got.length) return [false, "no room in hand for contractors"];
    return [true, "contractor onboarded: " + got.map((i) => ITEMS[i].label).join(", ")];
  },

  yolo: (g, rng, ev) => {
    if (rng.random() < 0.5) {
      const before = g.uptime;
      g.uptime = Math.min(g.maxUptime, g.uptime + 2);
      ev.push({ t: "uptime", delta: g.uptime - before });
      return [true, "the yolo hotfix worked?! +2 uptime"];
    }
    g.uptime -= 1;
    ev.push({ t: "uptime", delta: -1 });
    return [true, "the yolo hotfix made it worse. -1 uptime."];
  },
};

function useItem(g: GameState, item: ItemId, rng: Rng, ev: GameEvent[]): void {
  const at = g.hand.indexOf(item);
  if (at < 0) throw new IllegalAction("you don't have that");
  const [ok, message] = EFFECTS[item](g, rng, ev);
  if (ok) {
    g.hand.splice(at, 1);
    g.toolsUsed += 1;
    advanceClock(g, rng.randint(5, 25));
  }
  ev.push({ t: "tool", item, ok, message });
}

export function drawItems(g: GameState, n: number, rng: Rng, ev: GameEvent[]): ItemId[] {
  const ids = Object.keys(ITEM_POOL) as ItemId[];
  const weights = ids.map((i) => ITEM_POOL[i]);
  const got: ItemId[] = [];
  for (let k = 0; k < n; k++) {
    if (g.hand.length >= handCap(g)) break;
    const item = rng.choices(ids, weights);
    g.hand.push(item);
    got.push(item);
  }
  if (got.length) ev.push({ t: "draw", items: got });
  return got;
}

// ---------- between rounds ----------

function endRound(g: GameState, rng: Rng, ev: GameEvent[]): void {
  const bonus = Math.trunc(baseRevenue(g.round) * 2 * userFactor(g) * co(g).revenue) + g.users * 8;
  g.cash += bonus;
  g.earned += bonus;
  // Overnight recovery dries up past sprint 8.
  const healChance = Math.max(0, 0.5 - 0.03 * Math.max(0, g.round - 8));
  const heal = g.uptime < g.maxUptime && rng.random() < healChance ? 1 : 0;
  g.uptime += heal;
  const got = drawItems(g, 2, rng, ev);
  g.round += 1;
  g.phase = "rewards";
  // A sprint boundary is a night's sleep, so the clock lands on the next morning.
  advanceClock(g, (24 * 60 - (g.clock.hour * 60 + g.clock.minute)) + 9 * 60 + rng.randint(0, 50));
  ev.push({ t: "round:clear", bonus, heal, got, investor: rng.choice(INVESTOR_UPDATES) });
  if (rng.random() < 0.35) {
    const toast = rng.choice(SLACK_TOASTS);
    ev.push({ t: "slack", channel: toast.channel, text: toast.text });
  }
  ev.push({ t: "cash", delta: bonus });
  if (heal) ev.push({ t: "uptime", delta: heal });

  if (g.cash < 0) {
    // Payroll is due at the end of the sprint, not the middle of it.
    finish(g, "insolvent", ev);
    return;
  }

  if (g.earned >= g.nextOffer) {
    const multiplier = multiplierFor(g.offersDeclined);
    g.pendingOffer = Math.trunc(g.earned * multiplier);
    ev.push({ t: "offer", amount: g.pendingOffer, multiplier, declined: g.offersDeclined });
  }
}

function buy(g: GameState, id: UpgradeId, ev: GameEvent[]): void {
  const u = UPGRADES[id];
  if (!u) throw new IllegalAction("no such upgrade");
  if (has(g, id)) {
    ev.push({ t: "buy", id, ok: false, message: "already installed" });
    return;
  }
  if (g.cash < u.price) {
    ev.push({ t: "buy", id, ok: false, message: "not enough cash" });
    return;
  }
  g.cash -= u.price;
  g.upgrades.push(id);
  if (id === "sre_hire") {
    g.maxUptime += 1;
    g.uptime += 1;
    ev.push({ t: "uptime", delta: 1 });
  }
  ev.push({ t: "cash", delta: -u.price });
  ev.push({ t: "buy", id, ok: true, message: `${u.name} installed` });
}

// ---------- public surface ----------

/** Ends the run. `score` is what the player actually walked away with. */
function finish(g: GameState, outcome: Outcome, ev: GameEvent[], amount?: number): void {
  g.phase = "over";
  g.outcome = outcome;
  const score = outcome === "acquired" ? (amount ?? g.cash) : g.cash;
  ev.push({ t: "over", outcome, score });
}

/** Called after any action that consumes a slot. Decides the next phase. */
function afterSlot(g: GameState, rng: Rng, ev: GameEvent[]): void {
  if (g.uptime <= 0) {
    finish(g, "outage", ev);
    return;
  }
  if (g.users <= 0) {
    finish(g, "insolvent", ev);
    return;
  }
  if (g.queue.i >= g.queue.slots.length) {
    endRound(g, rng, ev);
    return;
  }
  g.phase = "deploying";
}

export function newGame(seed?: number, company?: CompanyId): { state: GameState; events: GameEvent[] } {
  const rng = new Rng(seed);
  // Drawn from the seeded RNG, so "same seed replays identically" still holds.
  const id = company ?? rng.choice(COMPANY_IDS);
  const c = COMPANIES[id];
  const state: GameState = {
    seed: rng.seed,
    company: id,
    round: 1,
    uptime: c.uptime,
    maxUptime: c.uptime,
    cash: c.cash,
    users: 12_482,
    velocity: c.velocity,
    hand: [],
    upgrades: [],
    queue: { slots: [], i: 0 },
    friday: false,
    canaryUsed: false,
    flagUsed: false,
    deploys: 0,
    recklessDeploys: 0,
    incidents: 0,
    phase: "deploying",
    pending: null,
    version: { major: 2, minor: 4, patch: 0 },
    earned: 0,
    clock: { day: 0, hour: 9, minute: 12 },
    sprintName: SPRINT_NAMES[0],
    staged: 0,
    toolsUsed: 0,
    lastDoubled: false,
    offersDeclined: 0,
    nextOffer: FIRST_OFFER,
    pendingOffer: null,
    declineHeat: 0,
    outcome: null,
  };
  const events: GameEvent[] = [{ t: "company", name: c.name, blurb: c.blurb }];
  buildQueue(state, rng, events);
  state.seed = rng.seed;
  return { state, events };
}

/** The only way to mutate a game. One place that owns RNG cursor bookkeeping. */
export function apply(g: GameState, action: Action): GameEvent[] {
  const rng = new Rng(g.seed);
  const ev: GameEvent[] = [];
  try {
    switch (action.kind) {
      case "deploy":
        expect(g, "deploying");
        deploy(g, rng, ev);
        if (g.phase !== "incident") afterSlot(g, rng, ev);
        break;

      case "skip":
        expect(g, "deploying");
        skip(g, ev);
        afterSlot(g, rng, ev);
        break;

      case "flag":
        expect(g, "deploying");
        neutralize(g, rng, ev);
        break;

      case "item": {
        expect(g, "deploying");
        const before = g.queue.i;
        useItem(g, action.item, rng, ev);
        // revert commit consumes the slot; everything else leaves the cursor alone
        if (g.queue.i !== before || g.uptime <= 0) afterSlot(g, rng, ev);
        break;
      }

      case "incident": {
        expect(g, "incident");
        if (!g.pending) throw new IllegalAction("no incident open");
        resolveIncident(g, rng, g.pending, action.choice, ev);
        afterSlot(g, rng, ev);
        break;
      }

      case "continue":
        expect(g, "rewards");
        g.phase = g.pendingOffer === null ? "shop" : "offer";
        break;

      case "sign": {
        expect(g, "offer");
        if (g.pendingOffer === null) throw new IllegalAction("no offer on the table");
        finish(g, "acquired", ev, g.pendingOffer);
        break;
      }

      case "decline":
        expect(g, "offer");
        if (g.pendingOffer === null) throw new IllegalAction("no offer on the table");
        g.offersDeclined += 1;
        g.declineHeat = Math.min(MAX_DECLINE_HEAT, g.declineHeat + 1);
        g.nextOffer = Math.trunc(g.nextOffer * OFFER_STEP);
        g.pendingOffer = null;
        g.phase = "shop";
        break;

      case "buy":
        expect(g, "shop");
        buy(g, action.id, ev);
        break;

      case "nextRound":
        expect(g, "shop");
        buildQueue(g, rng, ev);
        break;

      default:
        throw new IllegalAction("unknown action");
    }
  } finally {
    g.seed = rng.seed;
  }
  return ev;
}

function expect(g: GameState, phase: GameState["phase"]): void {
  if (g.phase !== phase) throw new IllegalAction(`not allowed during ${g.phase}`);
}

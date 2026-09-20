/** Ported from test_engine.py, plus the three checks the web version added. */
import { describe, expect, it } from "vitest";
import {
  COMPANIES, COMPANY_IDS, CONSOLE_REPLIES, QUEUE_BRIEFINGS, runTitle, shareText, UPGRADES,
  UPGRADE_IDS, WEEK, type UpgradeId,
} from "./content";
import {
  apply, bake, baseRevenue, buildTuning, drawItems, FIRST_OFFER, handCap, MAX_DECLINE_HEAT,
  maxVelocity, multiplierFor, newGame, queueSpec, SIGNAL_STRENGTH,
} from "./engine";
import { CHANNELS, measure, readDanger, type Free } from "./calibrate";
import { Rng } from "./rng";
import { IllegalAction, type Action, type GameState } from "./state";
import { project } from "./view";
import { seal, unseal } from "./seal";

/** Pinned to the baseline company so a seed's starting numbers are stated, not inherited.
 *  Company variety has its own describe block below. */
function game(seed = 7, patch: Partial<GameState> = {}): GameState {
  const { state } = newGame(seed, "saas");
  Object.assign(state, patch);
  return state;
}

const badIndex = (g: GameState) => g.queue.slots.findIndex((s) => s.bad);
const safeIndex = (g: GameState) => g.queue.slots.findIndex((s) => !s.bad);

/** Park the cursor on a chosen slot without spending anything. */
function at(g: GameState, i: number): GameState {
  g.queue.i = i;
  g.phase = "deploying";
  return g;
}

/** Rebuild the queue as [disaster, safe, safe] so consuming one slot cannot end the round
 *  (a round clear would add the sprint bonus and draw new tools, muddying the assertion). */
function badFirst(g: GameState): GameState {
  const bad = g.queue.slots.find((s) => s.bad)!;
  const safe = g.queue.slots.find((s) => !s.bad)!;
  g.queue.slots = [structuredClone(bad), structuredClone(safe), structuredClone(safe)];
  return at(g, 0);
}

describe("queue", () => {
  it("holds exactly the advertised number of disasters", () => {
    for (let round = 1; round < 12; round++) {
      const [size, bad] = queueSpec(round);
      const g = game(round, { round, phase: "shop" });
      apply(g, { kind: "nextRound" });   // builds a queue for `round`
      expect(g.queue.slots.length).toBe(size);
      expect(g.queue.slots.filter((s) => s.bad).length).toBe(bad);
      expect(bad).toBeLessThan(size);    // always at least one safe deploy
    }
  });

  it("replays identically from the same seed", () => {
    const run = (seed: number) => {
      const g = game(seed);
      for (let k = 0; k < 20; k++) {
        if (g.phase === "deploying") apply(g, { kind: "deploy" });
        else if (g.phase === "incident") apply(g, { kind: "incident", choice: "rollback" });
        else if (g.phase === "rewards") apply(g, { kind: "continue" });
        else if (g.phase === "shop") apply(g, { kind: "nextRound" });
        else break;
      }
      return [g.cash, g.uptime, g.users, g.round];
    };
    expect(run(42)).toEqual(run(42));
    expect(run(42)).not.toEqual(run(43));
  });
});

describe("deploying", () => {
  it("pays and advances on a safe deploy, with the reckless bonus", () => {
    const g = game();
    const i = safeIndex(g);
    at(g, i);
    const before = g.cash;
    const ev = apply(g, { kind: "deploy" });
    const ok = ev.find((e) => e.t === "deploy:ok");
    expect(ok).toBeDefined();
    expect(ok).toMatchObject({ reckless: true });
    expect(g.cash).toBe(before + (ok as any).revenue);
    expect((ok as any).revenue).toBe(Math.trunc(baseRevenue(g.round) * 1.5));
    expect(g.queue.i).toBe(i + 1);
  });

  it("costs uptime on a disaster", () => {
    const g = badFirst(game());
    apply(g, { kind: "deploy" });
    expect(g.phase).toBe("incident");
    expect(g.pending?.damage).toBe(1);
    const ev = apply(g, { kind: "incident", choice: "wait" });
    const res = ev.find((e) => e.t === "incident:result") as any;
    expect(g.uptime).toBe(4 - res.damage);
    expect(g.cash).toBe(800_000 - res.loss);
  });

  it("stacks friday x2 with the reckless x1.5", () => {
    const g = game();
    g.hand.push("friday");
    at(g, safeIndex(g));
    apply(g, { kind: "item", item: "friday" });
    const ev = apply(g, { kind: "deploy" });
    const ok = ev.find((e) => e.t === "deploy:ok") as any;
    expect(ok.doubled && ok.reckless).toBe(true);
    expect(ok.revenue).toBe(Math.trunc(baseRevenue(g.round) * 2 * 1.5));
    expect(g.friday).toBe(false); // consumed by the deploy

    const h = game();
    h.friday = true;
    at(h, badIndex(h));
    apply(h, { kind: "deploy" });
    expect(h.pending?.damage).toBe(2);
  });

  it("refuses a deploy outside the deploying phase", () => {
    const g = game();
    at(g, badIndex(g));
    apply(g, { kind: "deploy" });
    expect(g.phase).toBe("incident");
    expect(() => apply(g, { kind: "deploy" })).toThrow(IllegalAction);
  });
});

describe("incident response", () => {
  it("never fails a rollback with blue/green", () => {
    const g = game(7, { upgrades: ["blue_green"] });
    for (let k = 0; k < 30; k++) {
      at(g, badIndex(g));
      g.pending = null;
      apply(g, { kind: "deploy" });
      const ev = apply(g, { kind: "incident", choice: "rollback" });
      expect((ev.find((e) => e.t === "incident:result") as any).ok).toBe(true);
      g.uptime = 4;        // keep the run alive for the next iteration
      g.users = 12_482;    // ...and out of an exodus
    }
  });

  it("lets the canary absorb only the first disaster of a round", () => {
    const g = game(7, { upgrades: ["canary"] });
    const bad = g.queue.slots.filter((s) => s.bad);
    g.queue.slots = [structuredClone(bad[0]), structuredClone(bad[0])];
    at(g, 0);
    apply(g, { kind: "deploy" });
    expect(g.canaryUsed).toBe(true);
    expect(g.uptime).toBe(4); // absorbed, no uptime lost
    expect(g.phase).not.toBe("incident"); // nothing to decide

    at(g, 1);
    apply(g, { kind: "deploy" });
    expect(g.pending?.absorbed).toBe(false);
    expect(g.pending?.damage).toBe(1);
  });

  it("halves the bill with a database replica", () => {
    const loss = (upgrades: UpgradeId[]) => {
      const g = game(11, { upgrades });
      at(g, badIndex(g));
      const ev = apply(g, { kind: "deploy" });
      return (ev.find((e) => e.t === "incident:result") as any).loss;
    };
    expect(loss(["canary", "db_replica"])).toBe(Math.trunc(loss(["canary"]) / 2));
  });
});

describe("tools", () => {
  it("discards a deployment unshipped with revert commit", () => {
    const g = badFirst(game());
    g.hand = ["revert"];
    apply(g, { kind: "item", item: "revert" });
    expect(g.uptime).toBe(4);
    expect(g.queue.i).toBe(1);
    expect(g.hand).not.toContain("revert");
    expect(g.cash).toBe(800_000);
  });

  it("clears stale signals when the migration is rewritten", () => {
    const g = game();
    at(g, badIndex(g));
    g.hand.push("ci", "rewrite");
    apply(g, { kind: "item", item: "ci" });
    expect(g.queue.slots[g.queue.i].ciSeen).toBe(true);
    apply(g, { kind: "item", item: "rewrite" });
    const s = g.queue.slots[g.queue.i];
    expect(s.bad).toBe(false);
    expect(s.ciSeen || s.diffSeen || s.known).toBe(false);
  });

  it("does not consume a tool that could not be used", () => {
    const g = game();
    g.hand.push("postmortem");
    const ev = apply(g, { kind: "item", item: "postmortem" });
    expect((ev.find((e) => e.t === "tool") as any).ok).toBe(false);
    expect(g.hand).toContain("postmortem");
    expect(g.uptime).toBe(4);
  });

  it("greps only later slots", () => {
    const g = game();
    at(g, g.queue.slots.length - 1);
    g.hand.push("logs");
    const ev = apply(g, { kind: "item", item: "logs" });
    expect((ev.find((e) => e.t === "tool") as any).ok).toBe(false);
    expect(g.hand).toContain("logs");

    const h = game();
    h.hand.push("logs");
    apply(h, { kind: "item", item: "logs" });
    expect(h.queue.slots.slice(1).filter((s) => s.known).length).toBe(1);
  });

  it("reveals the real verdict with better monitoring", () => {
    const g = game(7, { upgrades: ["better_monitoring"] });
    g.hand.push("ci");
    apply(g, { kind: "item", item: "ci" });
    expect(g.queue.slots[g.queue.i].known).toBe(true);
  });

  it("respects the hand cap", () => {
    const g = game();
    const rng = new Rng(1);
    g.hand = [];
    drawItems(g, 20, rng, []);
    expect(g.hand.length).toBe(handCap(g));
    g.upgrades.push("observability");
    drawItems(g, 20, rng, []);
    expect(g.hand.length).toBe(6);
  });
});

describe("staging and flags", () => {
  it("spends a velocity token and refuses at zero", () => {
    const g = game();
    expect(g.velocity).toBe(2);
    apply(g, { kind: "skip" });
    expect(g.velocity).toBe(1);
    apply(g, { kind: "skip" });
    expect(g.velocity).toBe(0);
    expect(() => apply(g, { kind: "skip" })).toThrow(IllegalAction);
  });

  it("grants an extra token with a staging environment", () => {
    const g = game(7, { upgrades: ["staging_env"] });
    g.phase = "shop";
    apply(g, { kind: "nextRound" });
    expect(g.velocity).toBe(3);
  });

  it("allows one feature flag per round", () => {
    const g = game(7, { upgrades: ["feature_flags"] });
    at(g, badIndex(g));
    apply(g, { kind: "flag" });
    expect(g.queue.slots[g.queue.i].bad).toBe(false);
    expect(g.queue.slots[g.queue.i].known).toBe(true);
    expect((apply(g, { kind: "flag" }).find((e) => e.t === "flag") as any).ok).toBe(false);

    g.phase = "shop";
    apply(g, { kind: "nextRound" });
    expect((apply(g, { kind: "flag" }).find((e) => e.t === "flag") as any).ok).toBe(true);
  });
});

describe("shop", () => {
  it("rejects what you cannot afford and refuses double-buying", () => {
    const g = game(7, { cash: 100_000, phase: "shop" });
    let ev = apply(g, { kind: "buy", id: "blue_green" });
    expect((ev.find((e) => e.t === "buy") as any).message).toBe("not enough cash");
    expect(g.upgrades).toHaveLength(0);

    g.cash = 1_000_000;
    apply(g, { kind: "buy", id: "sre_hire" });
    expect(g.maxUptime).toBe(5);
    expect(g.uptime).toBe(5);
    ev = apply(g, { kind: "buy", id: "sre_hire" });
    expect((ev.find((e) => e.t === "buy") as any).ok).toBe(false);
  });
});

describe("baked signals", () => {
  it("overlap, so tools are evidence and not answers", () => {
    const rng = new Rng(0);
    const disasters = Array.from({ length: 200 }, () => bake(rng, true));
    const safes = Array.from({ length: 200 }, () => bake(rng, false));
    expect(disasters.some((s) => s.ciPass === s.ciTotal)).toBe(true); // green CI, still a disaster
    expect(safes.some((s) => s.ciPass < s.ciTotal)).toBe(true);       // failing tests, still fine
  });
});

describe("the view", () => {
  it("never leaks a verdict the player has not uncovered", () => {
    const rng = new Rng(5);
    let guard = 0;
    for (let seed = 0; seed < 40; seed++) {
      const g = game(seed);
      while (g.phase !== "over") {
        const view = project(g);
        // Position, total, and the settled prefix. No layout, no tally of what is still ahead.
        expect(Object.keys(view.queue).sort()).toEqual(["index", "resolved", "total"]);
        expect(view.queue.total).toBe(g.queue.slots.length);
        // The strip may only ever describe slots the player has already acted on.
        expect(view.queue.resolved.length).toBe(g.queue.i);

        const wire = JSON.stringify(view);
        expect(wire).not.toContain("remaining");
        expect(wire).not.toContain('"slots"');
        expect(wire).not.toContain('"bad":');
        // the danger ratings behind the readable cues are the real tell — they must never ship
        expect(wire).not.toContain('"danger"');
        expect(wire).not.toContain('"area"');
        if (view.current && !view.current.verdict) {
          expect(wire).not.toContain('"ciPass"');
          expect(wire).not.toContain('"diffLines"');
        }

        if (g.phase === "deploying") {
          if (g.hand.length && rng.random() < 0.4) apply(g, { kind: "item", item: rng.choice(g.hand) });
          else if (g.velocity > 0 && rng.random() < 0.2) apply(g, { kind: "skip" });
          else apply(g, { kind: "deploy" });
        } else if (g.phase === "incident") {
          apply(g, { kind: "incident", choice: rng.choice(["rollback", "hotfix", "wait"] as const) });
        } else if (g.phase === "rewards") {
          apply(g, { kind: "continue" });
        } else if (g.phase === "offer") {
          apply(g, { kind: "decline" });
        } else if (g.phase === "shop") {
          if (g.round > 10) break;
          apply(g, { kind: "nextRound" });
        }
        if (guard++ > 3000) throw new Error("phase machine failed to terminate");
      }
    }
  });
});

describe("the sealed token", () => {
  it("round-trips a full state", async () => {
    const g = game(3);
    const restored = await unseal(await seal(g));
    expect(restored).toEqual(g);
  });

  it("rejects a tampered token", async () => {
    const token = await seal(game(3));
    const i = token.length - 5;
    const flipped = token.slice(0, i) + (token[i] === "A" ? "B" : "A") + token.slice(i + 1);
    await expect(unseal(flipped)).rejects.toThrow();
  });
});

describe("a long run", () => {
  it("never crashes and reaches an ending", () => {
    const rng = new Rng(3);
    const g = game(99);
    let guard = 0;
    while (g.phase !== "over" && guard++ < 4000) {
      if (g.phase === "deploying") {
        const roll = rng.random();
        if (g.hand.length && roll < 0.45) apply(g, { kind: "item", item: rng.choice(g.hand) });
        else if (g.velocity > 0 && roll < 0.55) apply(g, { kind: "skip" });
        else apply(g, { kind: "deploy" });
      } else if (g.phase === "incident") {
        apply(g, { kind: "incident", choice: rng.choice(["rollback", "hotfix", "wait"] as const) });
      } else if (g.phase === "rewards") {
        apply(g, { kind: "continue" });
      } else if (g.phase === "offer") {
        apply(g, { kind: "decline" });
      } else if (g.phase === "shop") {
        for (const id of UPGRADE_IDS) if (g.cash >= UPGRADES[id].price) apply(g, { kind: "buy", id });
        apply(g, { kind: "nextRound" });
      }
    }
    expect(g.phase).toBe("over");
    expect(g.round).toBeGreaterThan(1);
    void project(g);
  });
});


describe("readable signals", () => {
  it("stays in the calibrated band", () => {
    const { combined, perChannel } = measure(20_000, 1);
    // ~70% target: a real read, but never a substitute for spending a tool.
    expect(combined.accuracy).toBeGreaterThan(0.66);
    expect(combined.accuracy).toBeLessThan(0.76);
    for (const [name, r] of Object.entries(perChannel)) {
      expect(r.accuracy, `${name} alone is too strong`).toBeLessThan(0.64);
      expect(r.accuracy, `${name} carries no signal`).toBeGreaterThan(0.53);
    }
  });

  it("is driven by one knob", () => {
    const flat = measure(8_000, 1, buildTuning(0));
    const sharp = measure(8_000, 1, buildTuning(1));
    expect(flat.combined.accuracy).toBeLessThan(0.55);      // strength 0 is pure noise
    expect(sharp.combined.accuracy).toBeGreaterThan(0.85);  // strength 1 gives the game away
    expect(SIGNAL_STRENGTH).toBeGreaterThan(0);
    expect(SIGNAL_STRENGTH).toBeLessThan(1);
  });

  it("dresses every slot without changing the announced disaster count", () => {
    for (let seed = 0; seed < 30; seed++) {
      const g = game(seed);
      const [size, bad] = queueSpec(1);
      expect(g.queue.slots.length).toBe(size);
      expect(g.queue.slots.filter((s) => s.bad).length).toBe(bad);
      for (const slot of g.queue.slots) {
        expect(slot.changes.length).toBeGreaterThanOrEqual(2);
        expect(slot.commit.message.length).toBeGreaterThan(0);
        expect(slot.pr.filesChanged).toBeGreaterThanOrEqual(slot.changes.length);
        expect(slot.version).toMatch(/^v\d+\.\d+\.\d+/);
      }
    }
  });

  it("climbs the version monotonically across the whole run", () => {
    const g = game(4);
    const seen: number[][] = [];
    for (let round = 0; round < 4; round++) {
      for (const s of g.queue.slots) {
        const [, a, b, c] = s.version.match(/^v(\d+)\.(\d+)\.(\d+)/)!;
        seen.push([+a, +b, +c]);
      }
      g.phase = "shop";
      apply(g, { kind: "nextRound" });
    }
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i] > seen[i - 1], `${seen[i - 1]} -> ${seen[i]}`).toBe(true);
    }
  });

  it("lets a reader beat someone deploying blind", () => {
    const visible = (g: GameState): Free => {
      const s = g.queue.slots[g.queue.i];
      return { changes: s.changes, commit: s.commit, pr: s.pr, version: s.version };
    };
    const run = (seed: number, read: boolean) => {
      const g = game(seed);
      let guard = 0;
      while (g.phase !== "over" && guard++ < 5_000) {
        if (g.phase === "deploying") {
          const s = g.queue.slots[g.queue.i];
          const danger = s.known ? (s.bad ? 99 : -99) : read ? readDanger(visible(g)) : 0;
          if (danger >= 7 && g.velocity > 0) apply(g, { kind: "skip" });
          else apply(g, { kind: "deploy" });
        } else if (g.phase === "incident") apply(g, { kind: "incident", choice: "rollback" });
        else if (g.phase === "rewards") apply(g, { kind: "continue" });
        else if (g.phase === "offer") apply(g, { kind: "decline" });
        else if (g.phase === "shop") apply(g, { kind: "nextRound" });
      }
      expect(g.phase).toBe("over");   // no strategy may run forever
      return g.round;
    };
    const seeds = Array.from({ length: 60 }, (_, i) => i);
    const blind = seeds.reduce((n, s) => n + run(s, false), 0) / seeds.length;
    const reader = seeds.reduce((n, s) => n + run(s, true), 0) / seeds.length;
    expect(reader).toBeGreaterThan(blind);
  });

  it("scores each channel in the direction it claims", () => {
    // a panic commit must read more dangerous than a conventional one, and so on
    const base: Free = {
      changes: ["Enable gzip on the CDN edge"],
      commit: { message: "fix(cdn): enable gzip on the cdn edge", author: "meera.s", day: "Tue", hour: 14, minute: 0 },
      pr: { approvals: 2, unresolved: 0, branchAgeDays: 1, filesChanged: 1 },
      version: "v2.4.1",
    };
    const worse = (patch: Partial<Free>) =>
      expect(readDanger({ ...base, ...patch })).toBeGreaterThan(readDanger(base));

    worse({ changes: ["Move the primary database to a new region"] });
    worse({ commit: { ...base.commit, message: "final fix pls" } });
    worse({ commit: { ...base.commit, author: "the-ceo" } });
    worse({ commit: { ...base.commit, hour: 3 } });
    worse({ commit: { ...base.commit, day: "Fri" } });
    worse({ version: "v3.0.0-hotfix" });
    worse({ pr: { approvals: 0, unresolved: 3, branchAgeDays: 40, filesChanged: 9 } });
    expect(Object.keys(CHANNELS)).toHaveLength(6);
  });
});

describe("two ways to lose", () => {
  it("ends the run when the user base is gone", () => {
    const g = badFirst(game(3));
    g.users = 1;
    apply(g, { kind: "deploy" });
    apply(g, { kind: "incident", choice: "wait" });
    expect(g.users).toBe(0);
    expect(g.phase).toBe("over");
    expect(g.outcome).toBe("insolvent");
  });

  it("ends the run when payroll cannot be met at sprint end", () => {
    const g = game(5);
    g.cash = -50_000_000;          // deep underwater, no sprint bonus can cover it
    g.queue.i = g.queue.slots.length - 1;
    g.queue.slots[g.queue.i].bad = false;
    g.phase = "deploying";
    apply(g, { kind: "deploy" });
    expect(g.phase).toBe("over");
    expect(g.outcome).toBe("insolvent");
  });

  it("no longer makes blue/green an unlosable run", () => {
    // The rollback always works and costs no uptime — but users and cash still drain.
    const g = game(7, { upgrades: ["blue_green"] });
    const startUsers = g.users;
    let bled = 0;
    for (let k = 0; k < 6; k++) {
      const bad = g.queue.slots.findIndex((s) => s.bad);
      if (bad < 0) break;
      g.queue.i = bad;
      g.phase = "deploying";
      apply(g, { kind: "deploy" });
      if ((g.phase as string) !== "incident") break;   // apply() mutates phase; TS cannot see it
      const ev = apply(g, { kind: "incident", choice: "rollback" });
      const res = ev.find((e) => e.t === "incident:result") as any;
      expect(res.ok).toBe(true);
      expect(res.damage).toBe(0);        // the rollback always works
      bled += res.loss;                  // ...and it is never free
      g.queue.slots[bad].bad = true;     // reload the same disaster
    }
    expect(g.uptime).toBe(4);                    // never took an uptime hit
    expect(bled).toBeGreaterThan(0);             // still paid every time
    expect(g.users).toBeLessThan(startUsers);    // still bled users
  });
});

describe("the acquisition offer", () => {
  const toOffer = (g: GameState) => {
    g.earned = FIRST_OFFER;
    g.queue.i = g.queue.slots.length - 1;
    g.queue.slots[g.queue.i].bad = false;
    g.phase = "deploying";
    apply(g, { kind: "deploy" });        // clears the queue -> endRound -> offer armed
    expect(g.phase).toBe("rewards");
    apply(g, { kind: "continue" });
    return g;
  };

  it("fires on cumulative revenue, so buying tooling never delays the exit", () => {
    const g = toOffer(game(11));
    expect(g.phase).toBe("offer");
    expect(g.pendingOffer).toBe(Math.trunc(g.earned * multiplierFor(0)));
    expect(project(g).offer?.multiplier).toBe(multiplierFor(0));
  });

  it("ends the run as a win when signed", () => {
    const g = toOffer(game(12));
    const amount = g.pendingOffer!;
    const ev = apply(g, { kind: "sign" });
    expect(g.outcome).toBe("acquired");
    expect(g.phase).toBe("over");
    expect((ev.find((e) => e.t === "over") as any).score).toBe(amount);
    expect(project(g).score).toBe(amount);
  });

  it("raises the multiple and the danger when declined", () => {
    const g = toOffer(game(13));
    const threshold = g.nextOffer;
    apply(g, { kind: "decline" });
    expect(g.phase).toBe("shop");
    expect(g.offersDeclined).toBe(1);
    expect(g.declineHeat).toBe(1);
    expect(g.nextOffer).toBeGreaterThan(threshold);
    expect(multiplierFor(1)).toBeGreaterThan(multiplierFor(0));

    // heat is capped so a late decline is a gamble, not a certainty
    g.declineHeat = MAX_DECLINE_HEAT;
    g.pendingOffer = 1;
    g.phase = "offer";
    apply(g, { kind: "decline" });
    expect(g.declineHeat).toBe(MAX_DECLINE_HEAT);
  });

  it("adds a disaster to the queue for each declined offer", () => {
    const g = game(14);
    const [size, bad] = queueSpec(1);
    g.declineHeat = 2;
    g.round = 1;
    g.phase = "shop";
    apply(g, { kind: "nextRound" });
    expect(g.queue.slots.filter((s) => s.bad).length).toBe(Math.min(size - 1, bad + 2));
  });

  it("refuses to sign when there is nothing on the table", () => {
    const g = game(15);
    g.phase = "offer";
    g.pendingOffer = null;
    expect(() => apply(g, { kind: "sign" })).toThrow(IllegalAction);
  });
});


describe("flavor that must not become a tell", () => {
  /** Every event that carries writer-authored prose. If one of these can reach the player
   *  before the reveal, the joke has become free information about the hidden flag. */
  const FLAVOR = new Set(["slack", "incident:open", "round:clear", "company"]);
  const REVEAL = new Set(["deploy:ok", "deploy:bad", "skip", "incident:result", "round:clear"]);

  it("never puts flavor text ahead of the reveal it belongs to", () => {
    // This is the general form of the toast rule below: for any action on a hidden slot, the
    // outcome must already be on screen before any prose lands. Widening the flavor pools is
    // then free — a new joke cannot leak, whatever pool it goes in.
    for (let seed = 0; seed < 40; seed++) {
      const g = game(seed);
      let guard = 0;
      while (g.phase !== "over" && guard++ < 400) {
        const ev =
          g.phase === "deploying" ? apply(g, { kind: "deploy" })
            : g.phase === "incident" ? apply(g, { kind: "incident", choice: "rollback" })
              : g.phase === "rewards" ? apply(g, { kind: "continue" })
                : g.phase === "offer" ? apply(g, { kind: "decline" })
                  : apply(g, { kind: "nextRound" });

        const firstFlavor = ev.findIndex((e) => FLAVOR.has(e.t));
        if (firstFlavor < 0) continue;
        const firstReveal = ev.findIndex((e) => REVEAL.has(e.t));
        expect(
          firstReveal >= 0 && firstReveal <= firstFlavor,
          `flavor "${ev[firstFlavor].t}" landed before any reveal`,
        ).toBe(true);
      }
    }
  });

  it("keeps every sprint briefing outcome-independent", () => {
    // A briefing is chosen at random on the client, so it must read correctly for ANY
    // (size, bad) pair the engine can produce. Both counts must be placeholders, never baked in.
    for (const b of QUEUE_BRIEFINGS) {
      expect(b, `briefing missing {size}: ${b}`).toContain("{size}");
      expect(b, `briefing missing {bad}: ${b}`).toContain("{bad}");
      // no stray digits — a hardcoded number would contradict the announced count
      expect(b.replace(/\{size\}|\{bad\}/g, ""), `briefing hardcodes a number: ${b}`)
        .not.toMatch(/[0-9]/);
    }
  });

  it("never fires a slack toast before the player knows the outcome", () => {
    // A toast on an unresolved deploy would be free information about the hidden flag.
    for (let seed = 0; seed < 60; seed++) {
      const g = game(seed);
      let guard = 0;
      while (g.phase !== "over" && guard++ < 400) {
        const before = g.phase;
        const ev =
          g.phase === "deploying" ? apply(g, { kind: "deploy" })
            : g.phase === "incident" ? apply(g, { kind: "incident", choice: "rollback" })
              : g.phase === "rewards" ? apply(g, { kind: "continue" })
                : g.phase === "offer" ? apply(g, { kind: "decline" })
                  : apply(g, { kind: "nextRound" });

        if (ev.some((e) => e.t === "slack")) {
          const resolved = ev.some((e) => e.t === "incident:result" || e.t === "round:clear");
          expect(resolved, `toast fired on a bare ${before} action`).toBe(true);
        }
      }
    }
  });

  it("sends an investor update with every cleared sprint", () => {
    const g = game(2);
    let guard = 0;
    let seen = 0;
    while (g.round < 4 && guard++ < 400) {
      const ev =
        g.phase === "deploying" ? apply(g, { kind: "deploy" })
          : g.phase === "incident" ? apply(g, { kind: "incident", choice: "rollback" })
            : g.phase === "rewards" ? apply(g, { kind: "continue" })
              : g.phase === "offer" ? apply(g, { kind: "decline" })
                : g.phase === "over" ? []
                  : apply(g, { kind: "nextRound" });
      for (const e of ev) if (e.t === "round:clear") { expect(e.investor.length).toBeGreaterThan(0); seen++; }
      if (g.phase === "over") break;
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe("the in-game clock", () => {
  it("only ever moves forward, and wraps the week", () => {
    const g = game(6);
    const minutes = (s: GameState) => s.clock.day * 24 * 60 + s.clock.hour * 60 + s.clock.minute;
    let last = minutes(g);
    let wraps = 0;
    let guard = 0;
    while (g.phase !== "over" && guard++ < 500) {
      if (g.phase === "deploying") apply(g, { kind: "deploy" });
      else if (g.phase === "incident") apply(g, { kind: "incident", choice: "rollback" });
      else if (g.phase === "rewards") apply(g, { kind: "continue" });
      else if (g.phase === "offer") apply(g, { kind: "decline" });
      else apply(g, { kind: "nextRound" });

      const now = minutes(g);
      if (now < last) wraps++;            // a week rolled over
      else expect(now).toBeGreaterThanOrEqual(last);
      last = now;
      expect(g.clock.day).toBeGreaterThanOrEqual(0);
      expect(g.clock.day).toBeLessThan(WEEK.length);
      expect(g.clock.hour).toBeLessThan(24);
      expect(g.clock.minute).toBeLessThan(60);
    }
    expect(wraps).toBeLessThan(guard);    // sanity: it is a clock, not noise
  });

  it("names every sprint", () => {
    const g = game(8);
    const names = new Set<string>();
    for (let k = 0; k < 5; k++) {
      names.add(project(g).sprintName);
      expect(project(g).sprintName.length).toBeGreaterThan(0);
      g.phase = "shop";
      apply(g, { kind: "nextRound" });
    }
    expect(names.size).toBeGreaterThan(1);
  });
});

describe("the starting company", () => {
  it("sets the knobs it advertises", () => {
    for (const id of COMPANY_IDS) {
      const { state } = newGame(11, id);
      const c = COMPANIES[id];
      expect(state.company, id).toBe(id);
      expect(state.uptime, `${id} uptime`).toBe(c.uptime);
      expect(state.maxUptime, `${id} max uptime`).toBe(c.uptime);
      expect(state.cash, `${id} cash`).toBe(c.cash);
      expect(maxVelocity(state), `${id} velocity`).toBe(c.velocity);
    }
  });

  it("adds exactly one token for a staging environment, whatever the company", () => {
    for (const id of COMPANY_IDS) {
      const base = newGame(3, id).state;
      const withEnv = newGame(3, id).state;
      withEnv.upgrades.push("staging_env");
      expect(maxVelocity(withEnv) - maxVelocity(base), id).toBe(1);
    }
  });

  it("scales payouts by the company multiplier", () => {
    // crypto pays 2x, bank pays 0.6x — same seed, same queue, different revenue.
    const rev = (id: "crypto" | "bank" | "saas") => {
      const g = newGame(5, id).state;
      const i = g.queue.slots.findIndex((s) => !s.bad);
      g.queue.i = i;
      g.phase = "deploying";
      const before = g.cash;
      apply(g, { kind: "deploy" });
      return g.cash - before;
    };
    expect(rev("crypto")).toBeGreaterThan(rev("saas"));
    expect(rev("bank")).toBeLessThan(rev("saas"));
  });

  it("is drawn from the seed, so a run still replays", () => {
    for (let seed = 0; seed < 20; seed++) {
      expect(newGame(seed).state.company).toBe(newGame(seed).state.company);
    }
    // and the draw actually varies across seeds
    const seen = new Set(Array.from({ length: 60 }, (_, s) => newGame(s).state.company));
    expect(seen.size).toBeGreaterThan(1);
  });

  it("never hands out a company that cannot survive its own first sprint", () => {
    // uptime must outlast the worst case: every disaster in sprint 1 deployed blind.
    for (const id of COMPANY_IDS) {
      const g = newGame(9, id).state;
      const disasters = g.queue.slots.filter((s) => s.bad).length;
      const worst = disasters * Math.max(1, Math.round(COMPANIES[id].damage));
      expect(g.uptime, `${id} cannot absorb sprint 1`).toBeGreaterThanOrEqual(worst - g.velocity);
    }
  });
});

describe("the shareable result", () => {
  it("names the company and the sprint, and never leaks an unresolved slot", () => {
    const out = shareText({
      company: "CRYPTO EXCHANGE", round: 7, outcome: "acquired", title: "RECKLESS AND RICH",
      uptime: 2, maxUptime: 4, deploys: 34, incidents: 9, recklessDeploys: 21,
      score: 42_000_000, resolved: ["ok", "down", "dodged"],
    });
    expect(out).toContain("CRYPTO EXCHANGE");
    expect(out).toContain("sprint 7");
    // one glyph per settled slot, and nothing for the slots still hidden
    expect([...out].filter((ch) => "\u{1f7e9}\u{1f7e5}\u{1f7e7}".includes(ch)).length).toBe(3);
  });

  it("drops empty lines instead of printing null", () => {
    const out = shareText({
      company: "YC BATCH, WEEK 3", round: 1, outcome: "outage", title: null,
      uptime: 0, maxUptime: 2, deploys: 2, incidents: 2, recklessDeploys: 0,
      score: 0, resolved: [],
    });
    expect(out).not.toContain("null");
    expect(out.split(String.fromCharCode(10))).toHaveLength(3);
  });
});

describe("run titles", () => {
  const base = {
    outcome: "outage" as const, deploys: 10, recklessDeploys: 0, incidents: 3,
    staged: 0, toolsUsed: 5, upgrades: 2, totalUpgrades: 9, diedOnFriday: false,
  };

  it("picks the most specific title available", () => {
    expect(runTitle({ ...base, outcome: "acquired", upgrades: 0 })).toBe("LUCKY");
    expect(runTitle({ ...base, outcome: "acquired" })).toBe("EXITED");
    expect(runTitle({ ...base, diedOnFriday: true })).toBe("TOLD YOU SO");
    expect(runTitle({ ...base, upgrades: 9 })).toBe("WELL-TOOLED, STILL DEAD");
    expect(runTitle({ ...base, toolsUsed: 0 })).toBe("FEARLESS, BRIEFLY");
    expect(runTitle({ ...base, recklessDeploys: 20 })).toBe("COWBOY");
    expect(runTitle({ ...base, staged: 40 })).toBe("ARCHITECT OF STAGING");
    expect(runTitle({ ...base, incidents: 0 })).toBe("SUSPICIOUSLY LUCKY");
    expect(runTitle(base)).toBeNull();
  });

  it("counts staging and tool use for real", () => {
    const g = game(9);
    g.hand = ["diff"];
    apply(g, { kind: "item", item: "diff" });
    apply(g, { kind: "skip" });
    expect(project(g).stats.toolsUsed).toBe(1);
    expect(project(g).stats.staged).toBe(1);
  });
});

describe("console easter eggs", () => {
  it("documents only commands that exist", () => {
    const listed = CONSOLE_REPLIES.help.replace("commands: ", "").split(", ");
    for (const cmd of listed) expect(CONSOLE_REPLIES[cmd], `help lists ${cmd}`).toBeDefined();
  });
});

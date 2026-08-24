/** The hidden-information gate. The ONLY thing that decides what the client is allowed to see.
 *  If a fact is not in here, it never reaches the browser. */
import { ITEMS, runTitle, UPGRADES, UPGRADE_IDS, type ItemId, type UpgradeId } from "./content";
import { handCap, has, maxVelocity, multiplierFor } from "./engine";
import type { Commit, GameState, Outcome, Phase, Pr, Risk } from "./state";

export type View = {
  phase: Phase;
  round: number;
  uptime: number;
  maxUptime: number;
  cash: number;
  users: number;
  velocity: number;
  maxVelocity: number;
  handCap: number;
  fridayArmed: boolean;
  flagAvailable: boolean;
  hand: { id: ItemId; label: string; blurb: string }[];
  upgrades: UpgradeId[];
  shop: { id: UpgradeId; name: string; price: number; blurb: string; owned: boolean; affordable: boolean }[];
  /** Position only. What has already happened, and how many disasters are left, is the
   *  player's job to remember — so neither is sent. */
  queue: { index: number; total: number };
  current: {
    version: string;
    changes: string[];
    /** Free metadata — designed to be visible, and to lean without proving anything. */
    commit: Commit;
    pr: Pr;
    ci: { pass: number; total: number } | null;
    diff: { lines: number; risk: Risk } | null;
    verdict: "SAFE" | "DISASTER" | null;
  } | null;
  offer: { amount: number; multiplier: number; declined: number } | null;
  outcome: Outcome | null;
  score: number;
  earned: number;
  clock: { day: number; hour: number; minute: number };
  sprintName: string;
  /** One earned title per finished run, or null if the run was unremarkable. */
  title: string | null;
  pending: { title: string; lines: string[]; usersHit: number; cashLoss: number; absorbed: boolean } | null;
  stats: {
    deploys: number;
    recklessDeploys: number;
    incidents: number;
    staged: number;
    toolsUsed: number;
  };
};

export function project(g: GameState): View {
  const cur = g.queue.i < g.queue.slots.length ? g.queue.slots[g.queue.i] : null;

  return {
    phase: g.phase,
    round: g.round,
    uptime: g.uptime,
    maxUptime: g.maxUptime,
    cash: g.cash,
    users: g.users,
    velocity: g.velocity,
    maxVelocity: maxVelocity(g),
    handCap: handCap(g),
    fridayArmed: g.friday,
    flagAvailable: has(g, "feature_flags") && !g.flagUsed,
    hand: g.hand.map((id) => ({ id, ...ITEMS[id] })),
    upgrades: [...g.upgrades],
    shop: UPGRADE_IDS.map((id) => ({
      id,
      ...UPGRADES[id],
      owned: has(g, id),
      affordable: g.cash >= UPGRADES[id].price,
    })),
    queue: { index: g.queue.i, total: g.queue.slots.length },
    current: cur
      ? {
          version: cur.version,
          changes: cur.changes,
          commit: cur.commit,
          pr: cur.pr,
          ci: cur.ciSeen ? { pass: cur.ciPass, total: cur.ciTotal } : null,
          diff: cur.diffSeen ? { lines: cur.diffLines, risk: cur.risk } : null,
          verdict: cur.known ? (cur.bad ? "DISASTER" : "SAFE") : null,
        }
      : null,
    pending: g.pending
      ? {
          title: g.pending.title,
          lines: g.pending.lines,
          usersHit: g.pending.usersHit,
          cashLoss: g.pending.cashLoss,
          absorbed: g.pending.absorbed,
        }
      : null,
    offer:
      g.pendingOffer === null
        ? null
        : {
            amount: g.pendingOffer,
            multiplier: multiplierFor(g.offersDeclined),
            declined: g.offersDeclined,
          },
    outcome: g.outcome,
    earned: g.earned,
    clock: g.clock,
    sprintName: g.sprintName,
    title: g.outcome
      ? runTitle({
          outcome: g.outcome,
          deploys: g.deploys,
          recklessDeploys: g.recklessDeploys,
          incidents: g.incidents,
          staged: g.staged,
          toolsUsed: g.toolsUsed,
          upgrades: g.upgrades.length,
          totalUpgrades: UPGRADE_IDS.length,
          diedOnFriday: g.outcome !== "acquired" && g.lastDoubled,
        })
      : null,
    score: g.outcome === "acquired" ? (g.pendingOffer ?? g.cash) : g.cash,
    stats: {
      deploys: g.deploys,
      recklessDeploys: g.recklessDeploys,
      incidents: g.incidents,
      staged: g.staged,
      toolsUsed: g.toolsUsed,
    },
  };
}

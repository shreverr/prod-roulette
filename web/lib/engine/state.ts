import type { ItemId, UpgradeId } from "./content";

export type Risk = "LOW" | "MEDIUM" | "HIGH";

/** Free, always-visible metadata. Every field leans toward the hidden outcome, none proves it. */
export type Commit = {
  message: string;
  author: string;
  day: string;
  hour: number;
  minute: number;
};

export type Pr = {
  approvals: number;
  unresolved: number;
  branchAgeDays: number;
  filesChanged: number;
};

export type Slot = {
  version: string;
  /** Text only. `danger` and `area` are dropped here so they cannot leak by accident. */
  changes: string[];
  commit: Commit;
  pr: Pr;
  bad: boolean;
  ciPass: number;
  ciTotal: number;
  diffLines: number;
  risk: Risk;
  known: boolean;    // true nature uncovered
  ciSeen: boolean;
  diffSeen: boolean;
};

export type Incident = {
  title: string;
  lines: string[];
  usersHit: number;
  cashLoss: number;
  damage: number;
  absorbed: boolean;
};

export type Phase = "deploying" | "incident" | "rewards" | "offer" | "shop" | "over";

export type Outcome = "acquired" | "outage" | "insolvent";

export type GameState = {
  seed: number;                 // Rng cursor, travels with the state
  round: number;
  uptime: number;
  maxUptime: number;
  cash: number;
  users: number;
  velocity: number;
  hand: ItemId[];
  upgrades: UpgradeId[];
  queue: { slots: Slot[]; i: number };
  friday: boolean;              // ship-it-friday armed
  canaryUsed: boolean;
  flagUsed: boolean;
  deploys: number;
  recklessDeploys: number;
  incidents: number;
  phase: Phase;
  pending: Incident | null;     // incident awaiting a choice
  version: { major: number; minor: number; patch: number };
  earned: number;               // cumulative revenue banked — what an acquirer actually values
  clock: { day: number; hour: number; minute: number };   // in-game wall clock, day 0 = Mon
  sprintName: string;
  staged: number;
  toolsUsed: number;
  lastDoubled: boolean;         // was the most recent deploy Friday-armed
  offersDeclined: number;
  nextOffer: number;            // cash threshold that fires the next acquisition offer
  pendingOffer: number | null;  // amount currently on the table
  declineHeat: number;          // extra disasters per queue, one per declined offer
  outcome: Outcome | null;
};

export type IncidentChoice = "rollback" | "hotfix" | "wait";

export type Action =
  | { kind: "deploy" }
  | { kind: "skip" }
  | { kind: "item"; item: ItemId }
  | { kind: "flag" }
  | { kind: "incident"; choice: IncidentChoice }
  | { kind: "continue" }        // rewards -> shop
  | { kind: "buy"; id: UpgradeId }
  | { kind: "nextRound" }
  | { kind: "sign" }
  | { kind: "decline" };

export type GameEvent =
  | { t: "round:start"; round: number; size: number; bad: number }
  | { t: "deploy:start"; version: string }
  | { t: "deploy:ok"; version: string; revenue: number; reckless: boolean; doubled: boolean }
  | { t: "deploy:bad"; version: string; doubled: boolean }
  | { t: "incident:open"; title: string; lines: string[]; usersHit: number; cashLoss: number; absorbed: boolean }
  | { t: "incident:result"; choice: IncidentChoice | "canary"; ok: boolean; damage: number; loss: number; reason: string }
  | { t: "cash"; delta: number }
  | { t: "uptime"; delta: number }
  | { t: "users"; delta: number }
  | { t: "tool"; item: ItemId; ok: boolean; message: string }
  | { t: "skip"; wasBad: boolean; missed: number }
  | { t: "flag"; ok: boolean; message: string }
  | { t: "round:clear"; bonus: number; heal: number; got: ItemId[]; investor: string }
  | { t: "slack"; channel: string; text: string }
  | { t: "buy"; id: UpgradeId; ok: boolean; message: string }
  | { t: "draw"; items: ItemId[] }
  | { t: "offer"; amount: number; multiplier: number; declined: number }
  | { t: "over"; outcome: Outcome; score: number };

/** Thrown for an action the current phase does not allow. Routes turn this into a 400. */
export class IllegalAction extends Error {}

/** Trust boundary: actions arrive from the browser as arbitrary JSON. */
export function parseAction(raw: unknown): Action | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  switch (a.kind) {
    case "deploy":
    case "skip":
    case "flag":
    case "continue":
    case "nextRound":
    case "sign":
    case "decline":
      return { kind: a.kind } as Action;
    case "item":
      return typeof a.item === "string" ? ({ kind: "item", item: a.item } as Action) : null;
    case "buy":
      return typeof a.id === "string" ? ({ kind: "buy", id: a.id } as Action) : null;
    case "incident":
      return a.choice === "rollback" || a.choice === "hotfix" || a.choice === "wait"
        ? { kind: "incident", choice: a.choice }
        : null;
    default:
      return null;
  }
}

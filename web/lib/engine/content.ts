/** Transcribed from prod_roulette/content.py. Flavor and tuning only, no logic. */

/** Indian-grouped rupees: 842000 -> ₹8,42,000 */
export function inr(n: number): string {
  const sign = n < 0 ? "-" : "";
  const s = String(Math.abs(Math.trunc(n)));
  if (s.length <= 3) return `${sign}₹${s}`;
  let head = s.slice(0, -3);
  const tail = s.slice(-3);
  const parts: string[] = [];
  while (head.length > 2) {
    parts.unshift(head.slice(-2));
    head = head.slice(0, -2);
  }
  if (head) parts.unshift(head);
  return `${sign}₹${parts.join(",")},${tail}`;
}

export type Area =
  | "payments" | "db" | "deps" | "auth" | "cache"
  | "infra" | "email" | "api" | "reports" | "cdn" | "queue" | "web";

/** danger 0 = cosmetic, 3 = the kind of change that pages someone.
 *  Sampled *conditioned on* the already-decided outcome, so a disaster leans spicy without
 *  the count of disasters ever changing. Texts are imperative so they double as commit subjects. */
export type Change = { text: string; danger: 0 | 1 | 2 | 3; area: Area };

export const CHANGES: Change[] = [
  // cosmetic
  { text: "Add a new onboarding email template", danger: 0, area: "email" },
  { text: "Enable gzip on the CDN edge", danger: 0, area: "cdn" },
  { text: "Clean up dead feature flags", danger: 0, area: "infra" },
  { text: "Update copy on the pricing page", danger: 0, area: "web" },
  { text: "Add a health check endpoint", danger: 0, area: "api" },
  { text: "Bump the copyright year in the footer", danger: 0, area: "web" },
  // routine
  { text: "Upgrade the Sentry SDK", danger: 1, area: "deps" },
  { text: "Fix timezone handling in reports", danger: 1, area: "reports" },
  { text: "Replace moment.js with date-fns", danger: 1, area: "deps" },
  { text: "Tighten the CORS policy", danger: 1, area: "api" },
  { text: "Add retries to S3 uploads", danger: 1, area: "infra" },
  { text: "Log request IDs through the gateway", danger: 1, area: "api" },
  { text: "Paginate the admin audit log", danger: 1, area: "reports" },
  // touchy
  { text: "Add payment retry logic", danger: 2, area: "payments" },
  { text: "Add a Redis caching layer", danger: 2, area: "cache" },
  { text: "Add a rate limiter on /api/v2", danger: 2, area: "api" },
  { text: "Refactor the auth middleware", danger: 2, area: "auth" },
  { text: "Add an index on orders.created_at", danger: 2, area: "db" },
  { text: "Switch to connection pooling", danger: 2, area: "db" },
  { text: "Migrate cron jobs to the worker queue", danger: 2, area: "queue" },
  { text: "Add idempotency keys to checkout", danger: 2, area: "payments" },
  { text: "Move sessions into Redis", danger: 2, area: "auth" },
  // spicy
  { text: "Drop unused column users.legacy_id", danger: 3, area: "db" },
  { text: "Increase the DB pool size to 200", danger: 3, area: "db" },
  { text: "Rewrite the webhook dispatcher", danger: 3, area: "queue" },
  { text: "Apply 14 dependency updates", danger: 3, area: "deps" },
  { text: "Bump Node 20 to 22", danger: 3, area: "deps" },
  { text: "Shard the sessions table", danger: 3, area: "db" },
  { text: "Swap the payment provider SDK", danger: 3, area: "payments" },
  { text: "Move the primary database to a new region", danger: 3, area: "db" },
];

/** Conventional-commit prefixes. A tidy message borrows its scope from the top change's area
 *  and its subject from that change's text, so message and file list read coherently. */
export const COMMIT_TYPES = ["fix", "chore", "refactor", "perf", "feat"];

export const NEUTRAL_COMMITS = [
  "address review comments",
  "Merge branch 'main' into release",
  "small cleanup",
  "update tests",
  "rebase onto main",
  "apply review feedback",
  "bump version",
];

/** The tell is the style, not the words. */
export const PANIC_COMMITS = [
  "wip",
  "fix",
  "fix fix",
  "final fix pls",
  "revert revert fix",
  "asdf",
  "this should work",
  "quick fix before standup",
  "no time to test this",
  "trying something",
  "please work",
  "temporarily disable the check",
  "same as last time but actually",
  "ok NOW it works",
  "why",
  "committing from phone",
  "do not review this",
  "temp (permanent)",
];

export type CommitTier = "tidy" | "neutral" | "panic";

export const AUTHORS: { handle: string; risk: 0 | 1 | 2 | 3 }[] = [
  { handle: "meera.s", risk: 0 },
  { handle: "arjun.k", risk: 0 },
  { handle: "priya.n", risk: 1 },
  { handle: "raghav", risk: 1 },
  { handle: "dev.intern", risk: 2 },
  { handle: "oncall-bot", risk: 2 },
  { handle: "the-ceo", risk: 3 },
  { handle: "intern.2", risk: 2 },
  { handle: "bot.dependabot", risk: 2 },
  { handle: "ex-employee", risk: 3 },   // left in March. the commit did not.
];

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Hour windows. 3am and Friday evening are dangerous; mid-afternoon is not. */
export const HOUR_BUCKETS: { name: string; from: number; to: number }[] = [
  { name: "deep-night", from: 0, to: 5 },
  { name: "morning", from: 9, to: 12 },
  { name: "afternoon", from: 13, to: 16 },
  { name: "evening", from: 17, to: 20 },
  { name: "late", from: 21, to: 23 },
];

export type Bump = "major" | "minor" | "patch";
export type VersionTag = "none" | "rc" | "build" | "hotfix" | "dirty";

export const INCIDENTS: { title: string; lines: string[]; frac: number }[] = [
  { title: "PAYMENT GATEWAY MELTDOWN", lines: ["Payment failures: 23%", "Stripe webhook queue: 41k backed up"], frac: 0.15 },
  { title: "DATABASE ON FIRE", lines: ["Database CPU: 97%", "Slow query log: 8,400 entries/min", "Replication lag: 340s"], frac: 0.22 },
  { title: "OOM CASCADE", lines: ["Pods restarting: 14/16", "Memory: 99.2%", "p99 latency: 12.4s"], frac: 0.30 },
  { title: "AUTH SERVICE DOWN", lines: ["Login success rate: 4%", "Session store unreachable"], frac: 0.45 },
  { title: "MIGRATION LOCKED THE TABLE", lines: ["orders table: ACCESS EXCLUSIVE", "Writes blocked: 6m 12s"], frac: 0.18 },
  { title: "CACHE STAMPEDE", lines: ["Redis evictions: 2.1M/min", "Origin RPS: 40x normal"], frac: 0.12 },
  { title: "INFINITE RETRY LOOP", lines: ["Outbound webhooks: 3.4M sent", "Vendor rate-limited us permanently"], frac: 0.09 },
  { title: "SILENT DATA CORRUPTION", lines: ["Rows with null tenant_id: 12,904", "Nobody noticed for 40 minutes"], frac: 0.20 },
  { title: "CDN SERVED THE WRONG TENANT", lines: ["Cross-tenant cache hits: 1,208", "Legal has been notified"], frac: 0.11 },
];

export const ROLLBACK_FAILS = [
  "deployment service unavailable",
  "previous image was garbage-collected last Tuesday",
  "rollback needs the migration reverted first (it is not reversible)",
  "CI is rebuilding the old commit. ETA 22 minutes.",
  "the rollback pipeline itself was in this deploy",
  "kubectl: context 'prod' not found",
  "the person with prod access is on a flight",
  "the runbook links to a Confluence page that 404s",
  "rolling back would undo the fix for the last rollback",
  "prod and staging were swapped in January and nobody said anything",
  "the deploy key expired 40 minutes ago",
];

export const HOTFIX_FAILS = [
  "hotfix introduced a second incident",
  "you fixed staging",
  "typo in the hotfix. shipped it anyway.",
  "linter blocked the merge for 11 minutes",
  "hotfix needs a migration",
];

export const WAIT_FAILS = [
  "it did not self-heal. it spread.",
  "the retry storm found new victims",
  "Twitter found out",
  "support queue: 1,400 tickets",
];

export type ItemId =
  | "staging" | "ci" | "diff" | "logs" | "revert"
  | "rewrite" | "friday" | "postmortem" | "contractor" | "yolo";

export const ITEMS: Record<ItemId, { label: string; blurb: string }> = {
  staging: { label: "run staging", blurb: "exact verdict on this deployment" },
  ci: { label: "check ci", blurb: "read the test results" },
  diff: { label: "read the diff", blurb: "line count + risk rating" },
  logs: { label: "grep the logs", blurb: "exact verdict on a random later deployment" },
  revert: { label: "revert commit", blurb: "discard this deployment unshipped" },
  rewrite: { label: "rewrite migration", blurb: "flips this deployment safe<->disaster, blind" },
  friday: { label: "ship it friday", blurb: "next deploy: double revenue, double damage" },
  postmortem: { label: "blameless postmortem", blurb: "+1 uptime" },
  contractor: { label: "hire contractor", blurb: "draw 2 more tools" },
  yolo: { label: "yolo hotfix", blurb: "coin flip: +2 uptime or -1" },
};

export const ITEM_POOL: Record<ItemId, number> = {
  staging: 10, ci: 14, diff: 14, logs: 10, revert: 9,
  rewrite: 7, friday: 7, postmortem: 8, contractor: 6, yolo: 6,
};

export type UpgradeId =
  | "staging_env" | "observability" | "automated_rollback" | "better_monitoring"
  | "canary" | "db_replica" | "feature_flags" | "sre_hire" | "blue_green";

export const UPGRADES: Record<UpgradeId, { name: string; price: number; blurb: string }> = {
  staging_env: { name: "Staging environment", price: 250_000, blurb: "+1 velocity token per sprint" },
  observability: { name: "Observability budget", price: 300_000, blurb: "hold 6 tools. you still won't read the dashboards." },
  automated_rollback: { name: "Automated rollback", price: 350_000, blurb: "rollback success +30 points. mostly." },
  better_monitoring: { name: "Better monitoring", price: 400_000, blurb: "check ci returns the real verdict. it was always knowable." },
  canary: { name: "Canary deployment", price: 450_000, blurb: "absorbs the first disaster each sprint" },
  db_replica: { name: "Database replica", price: 500_000, blurb: "incident cash loss halved. the replica is quietly also on fire." },
  feature_flags: { name: "Feature flags", price: 600_000, blurb: "once a sprint: make this deployment safe. you will forget to remove it." },
  sre_hire: { name: "Hire an SRE", price: 700_000, blurb: "+1 max uptime. they will ask about runbooks." },
  blue_green: { name: "Blue/green deploys", price: 900_000, blurb: "rollback never fails" },
};

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
export const UPGRADE_IDS = Object.keys(UPGRADES) as UpgradeId[];

// ---------------------------------------------------------------- flavor, no mechanics

/** Full week for the in-game clock. Commits sample from DAYS (no Sundays) — that is a signal
 *  channel and is calibrated; this is just the wall clock. */
export const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const SPRINT_NAMES = [
  "Project Falcon", "Project Monsoon", "Project Chai", "Project Lantern",
  "Project Ledger", "Project Otter", "Project Cardamom", "Project Rickshaw",
  "Project Nimbus", "Project Tiffin", "Project Banyan", "Project Kite",
];

/** Fired only after an incident has already resolved, or on a sprint clear. Never on a deploy
 *  whose outcome the player has not seen yet — a toast that leaked would be free information. */
export const SLACK_TOASTS = [
  { channel: "#incidents", text: "@here who deployed?" },
  { channel: "#general", text: "the-ceo is typing…" },
  { channel: "#eng", text: "is prod down for everyone or just me" },
  { channel: "DM", text: "the-ceo: call me" },
  { channel: "#incidents", text: "someone should write a postmortem" },
  { channel: "#random", text: "lol" },
  { channel: "#eng", text: "reverting my unrelated PR just in case" },
  { channel: "#support", text: "customers are asking. what do we say" },
];

export const INVESTOR_UPDATES = [
  "'strong quarter, minor turbulence'",
  "'we are AI-first now'",
  "'MRR up 12% (excluding refunds)'",
  "'headcount flat, ambition up'",
  "skipped this month",
  "'the incident was a learning opportunity'",
];

export const BOOT_LINES: [string, string][] = [
  ["checking on-call rotation", "nobody"],
  ["mounting /dev/prod", "read-write (!)"],
  ["loading SLA", "99.9% (aspirational)"],
  ["restoring nines of uptime", "found 2"],
  ["reticulating the deploy queue", "ok"],
];

export const ABOUT_LINES: [string, string][] = [
  ["Series", "Seed"],
  ["Engineers", "3 (2 on notice)"],
  ["Memory", "640K should be enough"],
  ["Runway", "ask the CEO"],
  ["Office", "a WeWork in Koramangala"],
  ["On-call", "you"],
];

/** Console nudges when the player goes quiet. */
export const IDLE_NUDGES = [
  "the queue is not going to deploy itself",
  "standup started 11 minutes ago",
  "someone asked for an ETA",
  "the queue is still there",
  "your calendar says 'focus time'",
];

/** Typed into the console window. Purely cosmetic. */
export const CONSOLE_REPLIES: Record<string, string> = {
  sudo: "you are already root. that is the problem.",
  "rm -rf /": "not funny.",
  rm: "not funny.",
  blame: "git blame says: the intern. the intern started on Monday.",
  help: "commands: sudo, blame, uptime, deploy, vim, whoami, ship",
  uptime: "up 4 days. 3 of them were fine.",
  deploy: "use the button. it is right there.",
  vim: "you are trapped here with us.",
  whoami: "founder, on-call, and the person who wrote this migration.",
  ship: "that is the spirit.",
  ls: "deploy.app  queue.mon  metrics.mon  tools.kit  console.log  regrets/",
  "cat regrets": "permission denied.",
};

export type RunStats = {
  outcome: "acquired" | "outage" | "insolvent" | null;
  deploys: number;
  recklessDeploys: number;
  incidents: number;
  staged: number;
  toolsUsed: number;
  upgrades: number;
  totalUpgrades: number;
  diedOnFriday: boolean;
};

/** One earned title per run. First match wins, so order is priority. */
export function runTitle(s: RunStats): string | null {
  if (s.outcome === "acquired" && s.upgrades === 0) return "LUCKY";
  if (s.outcome === "acquired" && s.recklessDeploys >= 15) return "RECKLESS AND RICH";
  if (s.outcome === "acquired") return "EXITED";
  if (s.diedOnFriday) return "TOLD YOU SO";
  if (s.upgrades === s.totalUpgrades) return "WELL-TOOLED, STILL DEAD";
  if (s.deploys > 0 && s.toolsUsed === 0) return "FEARLESS, BRIEFLY";
  if (s.recklessDeploys >= 15) return "COWBOY";
  if (s.staged > s.deploys) return "ARCHITECT OF STAGING";
  if (s.incidents === 0) return "SUSPICIOUSLY LUCKY";
  return null;
}

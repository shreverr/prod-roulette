/** Transcribed from prod_roulette/content.py. Flavor and tuning only, no logic. */

/** Indian-grouped rupees: 842000 -> ₹8,42,000 */
const NEWLINE = String.fromCharCode(10);

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
  { title: "CERTIFICATE EXPIRED", lines: ["TLS handshake failures: 100%", "Renewal cron disabled in 2023", "Nobody owned the calendar invite"], frac: 0.38 },
  { title: "RATE LIMITER RATE-LIMITED ITSELF", lines: ["Rejected requests: 890k", "Including the health check"], frac: 0.16 },
  { title: "SEARCH INDEX WIPED", lines: ["Documents indexed: 0", "Reindex ETA: 6 hours", "Search box still very prominent"], frac: 0.14 },
  { title: "EMAIL SENT TO EVERYONE", lines: ["Recipients: 12,482", "Subject: 'test ignore'", "Reply-all count: 61"], frac: 0.08 },
  { title: "QUEUE CONSUMER DIED QUIETLY", lines: ["Unprocessed jobs: 2.2M", "Alert threshold: never configured"], frac: 0.19 },
  { title: "FEATURE FLAG INVERTED", lines: ["Users on the unfinished checkout: 100%", "The flag was named is_disabled"], frac: 0.24 },
  { title: "DISK FULL", lines: ["/var/log: 100%", "Largest file: the log about the disk being full"], frac: 0.21 },
  { title: "TIMEZONE BUG AT MIDNIGHT", lines: ["Orders dated 1970: 4,201", "Only reproducible in production, at midnight"], frac: 0.13 },
  { title: "THIRD PARTY WENT DOWN", lines: ["Vendor status page: green", "Vendor: not green", "Our fallback: also them"], frac: 0.17 },
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
  "the previous version also had this bug, just quieter",
  "rollback succeeded on 3 of 14 pods and then stopped",
  "terraform wants to destroy the load balancer first",
  "the artifact registry is rate-limiting us",
  "someone force-pushed over the tag",
  "the old config references a secret that was rotated",
  "rollback is behind a feature flag that is off in prod",
  "the last known good build is from a branch that was deleted",
  "you are not on the VPN and the VPN is behind the load balancer",
  "the rollback ran. it rolled back the rollback.",
];

export const HOTFIX_FAILS = [
  "hotfix introduced a second incident",
  "you fixed staging",
  "typo in the hotfix. shipped it anyway.",
  "linter blocked the merge for 11 minutes",
  "hotfix needs a migration",
  "the hotfix was correct and applied to the wrong service",
  "you hotfixed the symptom. the cause is compounding.",
  "required approvals: 2. awake engineers: 1.",
  "the hotfix passed review because nobody read it",
  "hotfix reverted automatically by a policy nobody remembers writing",
  "you fixed it locally and closed the laptop",
  "the build queue is 40 minutes and the queue is the incident",
];

export const WAIT_FAILS = [
  "it did not self-heal. it spread.",
  "the retry storm found new victims",
  "Twitter found out",
  "support queue: 1,400 tickets",
  "it stabilised, then the retry backlog landed all at once",
  "a customer livetweeted the whole hour",
  "it healed. the data did not.",
  "your status page is hosted on the thing that is down",
  "someone escalated to the CEO, who escalated to you",
  "the quiet was the connection pool filling up",
  "it resolved itself and nobody knows why, which is worse",
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

/** What you inherited. Drawn once per run from the seeded RNG, so a seed still replays.
 *  Every field is a knob the engine already had — this only sets it differently. */
export type CompanyId = "saas" | "fintech" | "crypto" | "bank" | "yc";

export const COMPANIES: Record<CompanyId, {
  name: string;
  blurb: string;
  uptime: number;      // starting and max nines
  velocity: number;    // base velocity tokens per sprint
  cash: number;
  revenue: number;     // multiplier on every payout
  damage: number;      // multiplier on uptime lost per incident
  userLoss: number;    // multiplier on users lost per incident
}> = {
  saas: {
    name: "ENTERPRISE SAAS",
    blurb: "four nines in the contract, two in production. nobody has read the contract.",
    uptime: 4, velocity: 2, cash: 800_000, revenue: 1, damage: 1, userLoss: 1,
  },
  fintech: {
    name: "SERIES A FINTECH",
    blurb: "the regulator makes leaving so painful that your users simply cannot. this is the moat.",
    uptime: 3, velocity: 3, cash: 600_000, revenue: 0.9, damage: 1, userLoss: 0.8,
  },
  crypto: {
    name: "CRYPTO EXCHANGE",
    blurb: "revenue is double. so is everything else. the audit is 'in progress' and always will be.",
    uptime: 3, velocity: 2, cash: 1_200_000, revenue: 2, damage: 2, userLoss: 1.5,
  },
  bank: {
    name: "FORTY-YEAR-OLD BANK",
    blurb: "six nines of uptime, one velocity token, and a change board that meets on Thursdays.",
    uptime: 5, velocity: 1, cash: 500_000, revenue: 0.55, damage: 1, userLoss: 0.7,
  },
  yc: {
    name: "YC BATCH, WEEK 3",
    blurb: "two nines, four tokens, and a demo day. move fast, there is nothing to break yet.",
    uptime: 2, velocity: 4, cash: 300_000, revenue: 1.4, damage: 1, userLoss: 1,
  },
};

export const COMPANY_IDS = Object.keys(COMPANIES) as CompanyId[];

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
  blue_green: { name: "Blue/green deploys", price: 1_200_000, blurb: "rollback almost never fails. almost." },
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
  "Project Peacock", "Project Sandalwood", "Project Dabba", "Project Monolith",
  "Project Second Attempt", "Project Clean Slate", "Project Northstar",
  "Project Simplify", "Project Simplify II", "Project Velocity",
  "Project Bedrock", "Project Quicksand", "Project Guardrail",
  "Project Last Mile", "Project Final Mile", "Project Actually Final Mile",
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
  { channel: "#incidents", text: "adding this to the postmortem doc. the doc is a folder now." },
  { channel: "#eng", text: "unrelated: does anyone know what this cron does" },
  { channel: "#general", text: "reminder: all-hands moved to 4pm" },
  { channel: "DM", text: "the-cto: are we down or are we 'degraded'" },
  { channel: "#support", text: "a customer used the phrase 'per our contract'" },
  { channel: "#incidents", text: "i can repro. i cannot explain." },
  { channel: "#eng", text: "who has the pagerduty password" },
  { channel: "#random", text: "posting the outage graph, it looks like a shark" },
  { channel: "#incidents", text: "rolling forward. do not ask." },
  { channel: "#design", text: "while we're down can we ship the new logo" },
  { channel: "#eng", text: "it works on my machine, which is now also prod" },
  { channel: "DM", text: "the-ceo: what is an SLA" },
  { channel: "#incidents", text: "declaring this a sev2. it is a sev1. i have plans tonight." },
  { channel: "#sales", text: "can i tell the client it was scheduled maintenance" },
  { channel: "#eng", text: "the fix is one line. the line is in a repo nobody owns." },
  { channel: "#general", text: "great work everyone. what happened?" },
  { channel: "#incidents", text: "root cause: yes." },
  { channel: "#eng", text: "i've muted this channel for my mental health" },
];

/** Diegetic sprint briefings. The count is the mechanic; this is who is telling you.
 *  {bad} and {size} are filled in. Picked at random on the client — the choice is cosmetic and
 *  independent of the queue, so it cannot become a tell. */
export const QUEUE_BRIEFINGS = [
  "QA signed off on all {size}. QA also flagged {bad} as 'concerning'. QA has left the company.",
  "sprint planning: {size} deployments. the staff engineer says {bad} of them scare her. she did not say which.",
  "the intern ran a risk model on {size} PRs. {bad} came back red. the model is a spreadsheet.",
  "{size} in the queue. an anonymous #eng poll says {bad} will take prod down. the poll had four votes.",
  "release notes: {size} changes, {bad} 'may affect availability'. legal made us write that.",
  "on-call handoff: {size} queued, {bad} bad ones in there somewhere. good luck. i'm going camping.",
  "your predecessor left a note. it says {bad} of these {size} are cursed. nothing else.",
  "{size} deployments. the security review found {bad} problems and then the reviewer went on leave.",
  "post-retro consensus: {size} ship this sprint, {bad} of them shouldn't. no further detail was minuted.",
  "the CTO reviewed all {size} on a phone in an Uber. verdict: {bad} are 'probably fine, actually no'.",
  "monitoring predicts {bad} incidents across {size} deploys. monitoring has been right once.",
  "{size} merged overnight. a bot labelled {bad} of them 'high risk' and was immediately muted.",
];

export const INVESTOR_UPDATES = [
  "'strong quarter, minor turbulence'",
  "'we are AI-first now'",
  "'MRR up 12% (excluding refunds)'",
  "'headcount flat, ambition up'",
  "skipped this month",
  "'the incident was a learning opportunity'",
  "'we have never been more focused'",
  "'churn is a signal that we are finding our true users'",
  "'downtime down 4% quarter on quarter'",
  "'we are hiring a Head of Reliability (contract, part-time)'",
  "'the roadmap has been simplified'",
  "'ARR is up if you annualise last Tuesday'",
  "'we made the difficult decision to sunset the status page'",
  "'no notes from the board this month'",
  "sent, then unsent, then sent again",
  "'our infrastructure is now AI-native'",
  "'engineering velocity has never been higher'",
  "'we are being deliberate about growth'",
  "read by two of nine recipients",
  "'the competitor's outage was much worse'",
];

/** Boot plays on every load, so it draws from a pool instead of reciting the same five lines.
 *  BOOT_SHOWN is how many make it to the screen. */
export const BOOT_SHOWN = 5;
export const BOOT_LINES: [string, string][] = [
  ["checking on-call rotation", "nobody"],
  ["mounting /dev/prod", "read-write (!)"],
  ["loading SLA", "99.9% (aspirational)"],
  ["restoring nines of uptime", "found 2"],
  ["reticulating the deploy queue", "ok"],
  ["reading the runbook", "404"],
  ["counting staging environments", "0"],
  ["locating the architecture diagram", "in someone's head"],
  ["verifying backups", "assumed"],
  ["loading incident history", "truncated"],
  ["checking test coverage", "41% (generous)"],
  ["resolving DNS", "eventually"],
  ["warming the cache", "with production traffic"],
  ["auditing prod access", "everyone"],
  ["fetching the postmortem template", "unused"],
  ["starting the status page", "green (hardcoded)"],
  ["counting open PRs", "too many"],
  ["checking the change freeze", "expired in March"],
  ["measuring blast radius", "all of it"],
  ["loading feature flags", "1,204 (none removed)"],
];

/** The rules, in the order a new player runs into them. Kept here with the rest of the
 *  copy so the numbers stay next to the flavor they describe. */
export const MANUAL: [string, string[]][] = [
  ["the queue", [
    "Every sprint queues a handful of deployments. Some of them take prod down.",
    "How many is announced. Which ones is not.",
    "You work the queue one at a time, in order.",
  ]],
  ["uptime", [
    "Your lives. Every incident you fail to contain costs one.",
    "At zero, prod is gone and the run is over.",
    "Clear a sprint and you might get one back overnight.",
  ]],
  ["deploy", [
    "Ships whatever is in front of you.",
    "Safe: revenue and new users. Dangerous: an incident, and a choice.",
    "Rolling back usually works. Hotfixes rarely do. Waiting it out is a prayer.",
    "Shipping blind pays more. Recklessness is a strategy, not a bug.",
  ]],
  ["staging", [
    "Burns a velocity token to route the deployment away from prod.",
    "Dangerous: you dodged it. Safe: you paid for the delay.",
    "Either way the slot is gone, which is the real reason to use it.",
  ]],
  ["velocity", [
    "Staging tokens. Refilled every sprint, and nothing else spends them.",
    "Out of tokens means the rest of the queue goes to prod.",
  ]],
  ["tools", [
    "Drawn at the start of a sprint and again when you clear it.",
    "Each is one use. Most buy information, some change the deployment.",
    "Information is the whole game: the queue is countable once you know what is behind you.",
  ]],
  ["cash", [
    "Revenue in, incidents out. Payroll clears at the end of each sprint.",
    "End one underwater and the run is over, however good the uptime looked.",
  ]],
  ["the exit", [
    "Acquirers watch revenue, not cash, so buying tooling never delays your exit.",
    "Earn enough and an offer arrives. Sign it and the run ends banked.",
    "Decline and the next one is worth more, but every sprint after it gets deadlier.",
    "Lose instead and someone still buys the wreckage. For much less.",
  ]],
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
  "the PR author is online and can see you have not merged",
  "a recruiter messaged you. it is tempting.",
  "the deploy window closes at some point, probably",
  "you have been staring at this commit for a while",
  "nothing is on fire. suspicious.",
  "someone renamed the channel to #incidents-active",
  "your laptop fan just started",
  "the intern is asking what 'staging' is",
  "there is a meeting about the queue instead of clearing it",
  "reading the diff again will not change what is in it",
];

/** Typed into the console window. Purely cosmetic. */
export const CONSOLE_REPLIES: Record<string, string> = {
  sudo: "you are already root. that is the problem.",
  "rm -rf /": "not funny.",
  rm: "not funny.",
  blame: "git blame says: the intern. the intern started on Monday.",
  help: "commands: sudo, blame, uptime, deploy, vim, whoami, ship, ls, git, oncall, standup, sla, friday, status, top, exit, ai",
  uptime: "up 4 days. 3 of them were fine.",
  deploy: "use the button. it is right there.",
  vim: "you are trapped here with us.",
  whoami: "founder, on-call, and the person who wrote this migration.",
  ship: "that is the spirit.",
  ls: "deploy.app  queue.mon  metrics.mon  tools.kit  console.log  regrets/",
  "cat regrets": "permission denied.",
  git: "your working tree is dirty. so is everyone's.",
  "git push --force": "to where. to WHERE.",
  ssh: "you are already inside. that is the problem.",
  kubectl: "context 'prod' is the only context.",
  top: "one process. it is the migration. it has been 40 minutes.",
  ps: "PID 1: hope",
  exit: "there is no exit. there is an acquisition offer.",
  pwd: "/var/www/prod (yes, really)",
  history: "you do not want the history.",
  man: "no manual entry. there was never a manual.",
  test: "in prod, like everything else.",
  rollback: "that is what the incident buttons are for.",
  standup: "you missed it. they discussed the queue.",
  oncall: "you.",
  postmortem: "blameless, as long as we all agree who to blame.",
  sla: "99.9%. aspirational. legally non-binding. mostly.",
  coffee: "the machine is also down. unrelated.",
  hire: "headcount is frozen. ambition is not.",
  "chmod 777": "already done, in 2019, by someone who left.",
  curl: "connection refused. by prod. personally.",
  docker: "it builds on your machine. that is the whole feature.",
  npm: "3,140 packages audited. 41 vulnerabilities. moving on.",
  logs: "which ones. there are nine services and four log formats.",
  monitoring: "monitoring is up. that is all monitoring can confirm.",
  friday: "do not.",
  vacation: "denied. the queue.",
  blameless: "see: postmortem.",
  status: "green. the status page is hardcoded.",
  scale: "we scaled. the bill scaled harder.",
  ai: "we put an LLM on the incident channel. it also panics.",
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
/** The shareable block. Pure string building, no state — the point is that it shows what
 *  happened without showing anyone the queue they would have had to read. */
export function shareText(r: {
  company: string;
  round: number;
  outcome: "acquired" | "outage" | "insolvent" | null;
  title: string | null;
  uptime: number;
  maxUptime: number;
  deploys: number;
  incidents: number;
  recklessDeploys: number;
  score: number;
  resolved: string[];
}): string {
  const GLYPH: Record<string, string> = {
    ok: "\u{1f7e9}", down: "\u{1f7e5}", dodged: "\u{1f7e7}", wasted: "\u2b1c", reverted: "\u2b1c",
  };
  const ending =
    r.outcome === "acquired" ? `sold for ${inr(r.score)}`
      : r.outcome === "insolvent" ? "ran out of runway"
        : "took prod down for good";

  const lines = [
    `PROD ROULETTE \u2014 ${r.company}, sprint ${r.round}`,
    r.title ? `"${r.title}"` : null,
    [
      `${"\u25a0".repeat(Math.max(0, r.uptime))}${"\u25a1".repeat(Math.max(0, r.maxUptime - r.uptime))} uptime`,
      `${r.deploys} deploys`,
      `${r.incidents} incidents`,
    ].join(" \u00b7 "),
    r.resolved.length ? r.resolved.map((x) => GLYPH[x] ?? "\u2b1c").join("") : null,
    r.recklessDeploys ? `${r.recklessDeploys} deploys shipped without reading a thing` : null,
    ending,
  ];
  return lines.filter(Boolean).join(NEWLINE);
}

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

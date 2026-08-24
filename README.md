# Prod Roulette

Buckshot Roulette, but you're gambling with production. A pixel-art desktop OS that happens to
be a game about shipping to prod.

```
cd web
npm install
npm run dev      # http://localhost:3000
```

## The deploy queue

Each sprint loads N deployments. You are told **how many** will take prod down — never which
ones, and the order is shuffled. For each one you either `DEPLOY` or spend a velocity token to
shunt it to staging.

**Nothing keeps count for you.** The queue window shows your position and nothing else: what has
already shipped, and how many disasters are still in front of you, is yours to track. The running
tally is not even sent to the browser — only the sprint-start announcement is, so there is no
devtools tab to peek at. `console.log` is your notebook.

A safe deploy pays revenue. A disaster opens an incident and one decision: `ROLLBACK`, `HOTFIX`,
or `WAIT IT OUT`. Rollback fails often, sometimes because the rollback pipeline was in the deploy.

## Reading a deployment

Everything visible about a deployment leans — noisily — toward its outcome. The commit message,
who wrote it and at what hour, the version bump, the PR's approvals and unresolved comments, the
files it touches. None of it is proof. Same queue, two different reads:

```
v4.0.0                          v4.1.3-rc2
"fix payment thing (final)"     "chore(deps): bump sentry sdk"
dev.intern · Fri 03:47          meera.s · Tue 14:12
2 files · 1 unresolved          1 file · +2 approvals
+ Increase DB pool size to 200  + Sentry SDK upgrade
+ Rewrite webhook dispatcher
```

Tools buy certainty on top of that read: `run staging` and `grep the logs` give the truth,
`check ci` and `read the diff` give evidence. A disaster ships green CI a quarter of the time.

Reading well is worth roughly **70%** accuracy — clearly better than the coin flip, nowhere near
proof. That figure is calibrated by Monte Carlo and asserted in the test suite, so a flavor edit
cannot quietly wreck the balance.

## Recklessness

Deploying a slot you spent no tool on pays **1.5x**, stacking with `ship it friday` for 3x. The
game is asking how reckless you can be while keeping the startup alive.

## Endings

Cross a cumulative-revenue threshold and someone offers to buy you out, at a multiple of
revenue. **Sign** and the run ends banked. **Decline** and the next offer is worth far more — but
every sprint after that carries an extra disaster.

Simulated over 300 runs per strategy, expected value peaks at declining twice, then falls off a
cliff:

| when you sign | blind play | reading the cues |
|---|---|---|
| first offer | 100% win | 100% win |
| after 2 declines | **0% win** | **87% win** |
| never | dies sprint 7 | dies sprint 10 |

Greed is priced, and skill buys the extra rungs.

Two ways to lose: `PRODUCTION IS DOWN` (uptime hits zero) and `OUT OF RUNWAY` (payroll comes due
at sprint end and the account is empty). Incidents cost users on every outcome — even a clean
rollback — and revenue scales with the user base, so bleeding users is its own death spiral. That
is what stops blue/green deploys from buying an unlosable run.

## The desktop

Windows drag by the titlebar, resize from the grow box in the bottom-right corner, and zoom to
fill from the box at the right of the titlebar (click again to restore). Growing `console.log`
gives you more log lines, which matters now that the log is the only record of what already
shipped.

PRODOS boots once with a startup sequence, then gets out of the way. The menu bar clock is the
**game's** clock, not yours — every deploy costs time, so Friday evening genuinely arrives, and
the commit timestamps live in the same fiction. `console.log` takes typed input; try `help`.

Incidents draw a Slack toast, sprints get codenames, cleared sprints send an investor update, and
a finished run earns exactly one title — `COWBOY`, `ARCHITECT OF STAGING`, `TOLD YOU SO`,
`FEARLESS, BRIEFLY`.

One rule holds all of it together: **no joke may carry signal.** Anything that fired only on a
bad deploy would be free information and would break the calibrated 70% read, so flavor either
waits until the outcome is already on screen or is independent of it. There is a test for that.

## Layout

See `web/README.md` for the architecture: server-authoritative engine, sealed state token, no
database.

The original Python CLI lived here until the web version replaced it; it is archived at
`../prod-roulette-cli-backup/`.

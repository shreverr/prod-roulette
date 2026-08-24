"use client";

import { useEffect, useRef, useState } from "react";

import { inr } from "@/lib/engine/content";
import type { View } from "@/lib/engine/view";
import { useAnimatedNumber } from "@/lib/useGame";
import { PixelChart } from "../pixel/PixelChart";
import { Sprite } from "../pixel/Sprite";
import { CHECK, MAGNIFIER, WARNING } from "../pixel/sprites";

export type Log = { id: number; at: string; text: string; tone: "info" | "good" | "bad" }[];

/** Hover copy for the tags that carry a lean, so a new player learns what they mean. */
const TAG_HINTS: [RegExp, string][] = [
  [/-hotfix/, "cut straight off a hotfix branch"],
  [/-dirty/, "built with uncommitted changes in the working tree"],
  [/-rc\d/, "release candidate — it has been through review rounds"],
  [/\+build\./, "CI build metadata"],
];

const versionHint = (version: string) =>
  TAG_HINTS.find(([re]) => re.test(version))?.[1] ?? "version this deploy will publish";

export function DeployPanel({
  view, busy, stage, stageLabel, onDeploy, onSkip, onFlag,
}: {
  view: View;
  busy: boolean;
  stage: number | null;
  stageLabel: string | null;
  onDeploy: () => void;
  onSkip: () => void;
  onFlag: () => void;
}) {
  const cur = view.current;
  const live = view.phase === "deploying" && !busy;

  if (!cur) {
    return <p className="muted">queue empty. waiting for the next sprint.</p>;
  }

  return (
    <>
      <div className="version">
        <span title={versionHint(cur.version)}>{cur.version}</span>{" "}
        <span className="muted">→ production</span>
        {view.fridayArmed ? <span className="badge friday">FRIDAY 6PM</span> : null}
      </div>

      <div className="commitblock">
        <p className="commitmsg">{cur.commit.message}</p>
        <p className="commitmeta">
          {cur.commit.author} · committed {cur.commit.day}{" "}
          {String(cur.commit.hour).padStart(2, "0")}:{String(cur.commit.minute).padStart(2, "0")}
        </p>
        <p className="commitmeta">
          {cur.pr.filesChanged} file{cur.pr.filesChanged === 1 ? "" : "s"}
          {" · "}
          {cur.pr.approvals ? `+${cur.pr.approvals} approval${cur.pr.approvals === 1 ? "" : "s"}` : "no approvals"}
          {cur.pr.unresolved ? ` · ${cur.pr.unresolved} unresolved` : ""}
          {` · branched ${cur.pr.branchAgeDays}d ago`}
        </p>
      </div>

      <ul className="changes">
        {cur.changes.map((c) => (
          <li key={c}>+ {c}</li>
        ))}
      </ul>

      <dl className="signals">
        <div>
          <dt>CI</dt>
          <dd className={cur.ci ? (cur.ci.pass === cur.ci.total ? "good" : "warn") : "unknown"}>
            {cur.ci ? `${cur.ci.pass}/${cur.ci.total} passing` : "not checked"}
          </dd>
        </div>
        <div>
          <dt>DIFF</dt>
          <dd className={cur.diff ? `risk-${cur.diff.risk.toLowerCase()}` : "unknown"}>
            {cur.diff ? `${cur.diff.lines} lines · ${cur.diff.risk}` : "not read"}
          </dd>
        </div>
        <div>
          <dt>VERDICT</dt>
          <dd className={cur.verdict ? (cur.verdict === "SAFE" ? "good" : "bad") : "unknown"}>
            {cur.verdict ?? "unknown"}
          </dd>
        </div>
      </dl>

      {stage !== null ? (
        <div className="progress">
          <div className="bar">
            <span style={{ width: `${((stage + 1) / 4) * 100}%` }} />
          </div>
          <p className="stagelabel">{stageLabel}</p>
        </div>
      ) : (
        <div className="actions">
          <button className="btn primary" disabled={!live} onClick={onDeploy}>
            DEPLOY <em>D</em>
          </button>
          <button
            className="btn"
            disabled={!live || view.velocity <= 0}
            title={view.velocity <= 0 ? "no velocity tokens left this sprint" : "burn this slot in staging"}
            onClick={onSkip}
          >
            STAGING <em>S</em>
          </button>
          {view.flagAvailable ? (
            <button className="btn" disabled={!live} onClick={onFlag}>
              FLAG IT OFF <em>F</em>
            </button>
          ) : null}
        </div>
      )}
    </>
  );
}

export function QueuePanel({ view }: { view: View }) {
  const drained = view.queue.index >= view.queue.total;
  return (
    <>
      <p className="sprintname">{view.sprintName}</p>
      <p className="position vt">
        {drained ? "queue drained" : `position ${view.queue.index + 1} of ${view.queue.total}`}
      </p>
      <p className="muted small">
        order shuffled. what already shipped, and how many disasters are left, is yours to
        remember.
      </p>
    </>
  );
}

/** The SLA you can still claim with this much uptime left. */
const NINES = ["down", "91.0%", "97.2%", "99.4%", "99.97%", "99.99%", "99.995%"];

export function MetricsPanel({
  view, history,
}: {
  view: View;
  history: { uptime: number[]; users: number[]; cash: number[] };
}) {
  const cash = useAnimatedNumber(view.cash);
  const users = useAnimatedNumber(view.users);

  return (
    <>
      <div className="meter">
        <span className="label">UPTIME</span>
        <b className={`vt nines${view.uptime <= 1 ? " bad" : ""}`}>
          {NINES[Math.min(view.uptime, NINES.length - 1)]}
        </b>
        <span className={`bars${view.uptime <= 1 ? " critical" : view.uptime === 2 ? " warn" : ""}`}>
          {Array.from({ length: view.maxUptime }, (_, i) => (
            <b key={i} className={i < view.uptime ? "on" : "off"} />
          ))}
        </span>
      </div>

      <div className="readouts">
        <div>
          <span className="label">USERS</span>
          <b className="vt">{users.toLocaleString("en-IN")}</b>
        </div>
        <div>
          <span className="label">CASH</span>
          <b className={`vt ${cash < 0 ? "bad" : "good"}`}>{inr(cash)}</b>
        </div>
        <div>
          <span className="label">VELOCITY</span>
          <b className="vt">
            {"◆".repeat(view.velocity)}
            {"◇".repeat(Math.max(0, view.maxVelocity - view.velocity))}
          </b>
        </div>
        <div>
          <span className="label">SPRINT</span>
          <b className="vt">{view.round}</b>
        </div>
      </div>

      <div className="charts">
        <PixelChart data={history.users} max={view.users} color="#4a7fd4" label="users" />
        <PixelChart data={history.cash.map((c) => Math.max(0, c))} max={view.cash} color="#3ac06a" label="cash" />
        <PixelChart data={history.uptime} max={view.maxUptime} color="#f0b429" label="uptime" />
      </div>

      {view.upgrades.length ? (
        <p className="installed">
          <Sprite sprite={CHECK} scale={1} /> {view.upgrades.length} upgrade
          {view.upgrades.length === 1 ? "" : "s"} installed
        </p>
      ) : null}
    </>
  );
}

export function ToolsPanel({
  view, busy, onUse,
}: {
  view: View;
  busy: boolean;
  onUse: (id: View["hand"][number]["id"]) => void;
}) {
  if (!view.hand.length) return <p className="muted">no tools. good luck.</p>;
  const live = view.phase === "deploying" && !busy;

  return (
    <ul className="tools">
      {view.hand.map((t, i) => (
        <li key={`${t.id}-${i}`}>
          <button className="tool" disabled={!live} onClick={() => onUse(t.id)}>
            <Sprite sprite={MAGNIFIER} scale={1} />
            <span className="toolname">{t.label}</span>
            <span className="toolblurb">{t.blurb}</span>
            <em>{i + 1}</em>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function ShopPanel({
  view, busy, onBuy, onNext,
}: {
  view: View;
  busy: boolean;
  onBuy: (id: View["shop"][number]["id"]) => void;
  onNext: () => void;
}) {
  return (
    <>
      <table className="shop">
        <tbody>
          {view.shop.map((u) => (
            <tr key={u.id} className={u.owned ? "owned" : ""}>
              <td className="name">{u.name}</td>
              <td className="blurb">{u.blurb}</td>
              <td className="price">{u.owned ? "installed" : inr(u.price)}</td>
              <td>
                <button
                  className="btn small"
                  disabled={u.owned || !u.affordable || busy || view.phase !== "shop"}
                  onClick={() => onBuy(u.id)}
                >
                  {u.owned ? "✓" : "BUY"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn primary wide" disabled={busy || view.phase !== "shop"} onClick={onNext}>
        SHIP THE NEXT SPRINT
      </button>
    </>
  );
}

export function ConsolePanel({
  log, onCommand,
}: {
  log: Log;
  onCommand: (input: string) => void;
}) {
  const [input, setInput] = useState("");
  const feed = useRef<HTMLOListElement>(null);

  // Keep the newest line in view, the way a terminal does.
  useEffect(() => {
    const el = feed.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  return (
    <div className="consolewrap">
      <ol className="console" ref={feed}>
        {log.map((l) => (
          <li key={l.id} className={l.tone}>
            <span className="stamp">{l.at}</span> <span className="prompt">$</span> {l.text}
          </li>
        ))}
        {log.length === 0 ? <li className="muted">$ waiting for a deployment…</li> : null}
      </ol>
      <form
        className="consoleform"
        onSubmit={(e) => {
          e.preventDefault();
          const value = input.trim();
          setInput("");
          if (value) onCommand(value);
        }}
      >
        <span className="prompt">$</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          aria-label="console"
          placeholder="try: help"
        />
      </form>
    </div>
  );
}

export function OfferPanel({ view }: { view: View }) {
  if (!view.offer) return null;
  return (
    <>
      <h2>{inr(view.offer.amount)}</h2>
      <p className="muted">
        {view.offer.multiplier}x cumulative revenue of {inr(view.earned)}.
      </p>
      <p>Sign and the run ends here, banked.</p>
      <p>
        Decline and the next offer is worth more — but diligence continues, and every sprint
        after this one carries an extra disaster.
      </p>
      {view.offer.declined ? (
        <p className="warn">declined {view.offer.declined} offer(s) already.</p>
      ) : null}
    </>
  );
}

export function GameOverPanel({ view }: { view: View }) {
  return (
    <>
      {view.title ? <p className="runtitle">“{view.title}”</p> : null}
      <dl className="summary">
      <div><dt>sprints survived</dt><dd>{view.round - 1}</dd></div>
      <div><dt>deployments</dt><dd>{view.stats.deploys}</dd></div>
      <div><dt>incidents</dt><dd className="bad">{view.stats.incidents}</dd></div>
      <div><dt>reckless deploys</dt><dd className="warn">{view.stats.recklessDeploys}</dd></div>
      <div><dt>users remaining</dt><dd>{view.users.toLocaleString("en-IN")}</dd></div>
      <div><dt>revenue earned</dt><dd>{inr(view.earned)}</dd></div>
      <div><dt>final cash</dt><dd className={view.cash < 0 ? "bad" : "good"}>{inr(view.cash)}</dd></div>
      <div><dt>tooling bought</dt><dd>{view.upgrades.length}/{view.shop.length}</dd></div>
      <div><dt>shipped to staging</dt><dd>{view.stats.staged}</dd></div>
      <div><dt>tools spent</dt><dd>{view.stats.toolsUsed}</dd></div>
      <div>
        <dt>{view.outcome === "acquired" ? "sale price" : "walked away with"}</dt>
        <dd className={view.outcome === "acquired" ? "good" : ""}>{inr(view.score)}</dd>
      </div>
      </dl>
    </>
  );
}

export { WARNING };

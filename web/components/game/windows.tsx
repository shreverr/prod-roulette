"use client";

import { useEffect, useRef, useState } from "react";

import { inr, shareText } from "@/lib/engine/content";
import type { Resolution } from "@/lib/engine/state";
import type { View } from "@/lib/engine/view";
import { useAnimatedNumber, type LogEntry } from "@/lib/useGame";
import { PixelChart } from "../pixel/PixelChart";
import { Sprite } from "../pixel/Sprite";
import { CHECK, COIN, MAGNIFIER, SKULL, WARNING, type PixelMap } from "../pixel/sprites";

export type Log = LogEntry[];

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

/** Glyph + hover copy for a settled slot. Every one of these was announced when it happened. */
const RESOLVED: Record<Resolution, { glyph: string; cls: string; title: string }> = {
  ok: { glyph: "\u2713", cls: "ok", title: "shipped clean" },
  down: { glyph: "\u2717", cls: "down", title: "took prod down" },
  dodged: { glyph: "\u229d", cls: "dodged", title: "staged \u2014 it was a disaster" },
  wasted: { glyph: "\u229d", cls: "wasted", title: "staged \u2014 it was fine, token burned" },
  reverted: { glyph: "\u21a9", cls: "wasted", title: "reverted unshipped" },
};

export function QueuePanel({ view }: { view: View }) {
  const { index, total, resolved } = view.queue;
  const drained = index >= total;
  const down = resolved.filter((r) => r === "down").length;
  const caught = resolved.filter((r) => r === "dodged").length;

  return (
    <>
      <p className="sprintname">{view.sprintName}</p>
      <p className="position vt">
        {drained ? "queue drained" : `position ${index + 1} of ${total}`}
      </p>

      {/* The settled prefix, then the cursor, then what is still hidden. */}
      <p className="queuestrip vt">
        {Array.from({ length: total }, (_, i) => {
          if (i < resolved.length) {
            const r = RESOLVED[resolved[i]];
            return <b key={i} className={r.cls} title={r.title}>{r.glyph}</b>;
          }
          if (i === index) return <b key={i} className="here" title="up next">{"\u25b8"}</b>;
          return <b key={i} className="unknown" title="not your problem yet">?</b>;
        })}
      </p>

      <p className="muted small">
        {down || caught
          ? `${down} took prod down${caught ? `, ${caught} caught in staging` : ""}. how many are left is still yours to work out.`
          : "order shuffled. what is still ahead of you is yours to work out."}
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
        <span className="label" title="outages you can still absorb. at zero the run ends.">UPTIME</span>
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
          <span className="label" title="every incident churns some away. bigger user base, bigger revenue.">USERS</span>
          <b className="vt">{users.toLocaleString("en-IN")}</b>
        </div>
        <div>
          <span className="label" title="payroll clears at the end of each sprint. below zero then, the run ends insolvent.">CASH</span>
          <b className={`vt ${cash < 0 ? "bad" : "good"}`}>{inr(cash)}</b>
        </div>
        <div>
          <span className="label" title="staging skips left this sprint. only STAGING spends them.">VELOCITY</span>
          <b className="vt">
            {"◆".repeat(view.velocity)}
            {"◇".repeat(Math.max(0, view.maxVelocity - view.velocity))}
          </b>
        </div>
        <div>
          <span className="label" title="each sprint is one queue of deployments. later sprints queue more, and more of them are disasters.">SPRINT</span>
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
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const draft = useRef("");
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
            <span className="stamp">{l.at}</span> <span className="prompt">$</span>{" "}
            <span className="logsource">[{l.source}]:</span> {l.text}
          </li>
        ))}
        {log.length === 0 ? <li className="muted">$ [system]: waiting for a deployment…</li> : null}
      </ol>
      <form
        className="consoleform"
        onSubmit={(e) => {
          e.preventDefault();
          const value = input.trim();
          setInput("");
          setHistoryIndex(null);
          draft.current = "";
          if (value) {
            setHistory((previous) => [...previous, value].slice(-50));
            onCommand(value);
          }
        }}
      >
        <span className="prompt">$</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") {
              e.preventDefault();
              if (history.length === 0) return;
              const nextIndex = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
              if (historyIndex === null) draft.current = input;
              setHistoryIndex(nextIndex);
              setInput(history[nextIndex]);
            } else if (e.key === "ArrowDown" && historyIndex !== null) {
              e.preventDefault();
              const nextIndex = historyIndex + 1;
              if (nextIndex < history.length) {
                setHistoryIndex(nextIndex);
                setInput(history[nextIndex]);
              } else {
                setHistoryIndex(null);
                setInput(draft.current);
              }
            }
          }}
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
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const text = shareText({
      company: view.company.name, round: view.round, outcome: view.outcome, title: view.title,
      uptime: view.uptime, maxUptime: view.maxUptime, deploys: view.stats.deploys,
      incidents: view.stats.incidents, recklessDeploys: view.stats.recklessDeploys,
      score: view.score, resolved: view.queue.resolved,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // clipboard blocked (insecure origin, denied permission) — fall back to a selectable box
      setCopied(false);
      setFallback(text);
    }
  };

  const [fallback, setFallback] = useState<string | null>(null);

  const rows: [string, string, string?][] = [
    ["sprints survived", String(view.round - 1)],
    ["deployments", String(view.stats.deploys)],
    ["incidents", String(view.stats.incidents), "bad"],
    ["reckless deploys", String(view.stats.recklessDeploys), "warn"],
    ["users remaining", view.users.toLocaleString("en-IN")],
    ["revenue earned", inr(view.earned)],
    ["final cash", inr(view.cash), view.cash < 0 ? "bad" : "good"],
    ["tooling bought", `${view.upgrades.length}/${view.shop.length}`],
    ["shipped to staging", String(view.stats.staged)],
    ["tools spent", String(view.stats.toolsUsed)],
    view.outcome === "acquired"
      ? ["sale price", inr(view.score), "good"]
      : ["fire sale", inr(view.fireSale), "warn"],
  ];
  if (view.outcome !== "acquired") rows.push(["walked away with", inr(view.score)]);

  const saveImage = async () => {
    const acquired = view.outcome === "acquired";
    const blob = await shareCard({
      windowTitle: acquired ? "acquired" : "run over",
      icon: acquired ? COIN : view.outcome === "insolvent" ? WARNING : SKULL,
      headline:
        acquired ? `sold for ${inr(view.score)}`
          : view.outcome === "insolvent" ? "out of runway"
            : "production is down",
      subtitle:
        acquired ? "You got out. Someone else owns the pager now."
          : view.outcome === "insolvent" ? "Payroll came due and the account was empty."
            : "Uptime hit zero. Nobody can reach the site.",
      aside: acquired
        ? null
        : view.fireSale > 0
          ? `An acqui-hire offer came in for ${inr(view.fireSale)}. You took it.`
          : "No offer came in. Not even for the domain.",
      company: view.company.name,
      title: view.title,
      rows,
    });
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prod-roulette-${view.company.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {view.title ? <p className="runtitle">“{view.title}”</p> : null}
      <dl className="summary">
        {rows.map(([label, value, tone]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className={tone ?? ""}>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="shareactions">
        <button className="btn" onClick={() => void copy()}>
          {copied ? "COPIED" : "COPY RESULT"}
        </button>
        <button className="btn" onClick={() => void saveImage()}>SAVE IMAGE</button>
      </div>
      {fallback ? (
        <textarea className="sharebox" readOnly rows={6} value={fallback} onFocus={(e) => e.currentTarget.select()} />
      ) : null}
    </>
  );
}

/** Renders the game-over window as a PNG — same chrome, palette and fonts as the desktop,
 *  so a saved result looks like the thing that was on screen. */
async function shareCard({
  windowTitle, headline, subtitle, aside, company, title, rows, icon,
}: {
  windowTitle: string;
  headline: string;
  subtitle: string;
  aside: string | null;
  company: string;
  title: string | null;
  rows: [string, string, string?][];
  icon: PixelMap;
}): Promise<Blob | null> {
  await document.fonts.ready;
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  const ui = v("--font-stack-ui") || "monospace";
  const mono = v("--font-stack-mono") || "monospace";
  const ink = v("--ink"), paper = v("--paper"), muted = v("--chrome-lo");
  const tones: Record<string, string> = { bad: v("--red"), warn: v("--amber"), good: v("--green") };

  const S = 3, W = 520, PAD = 20, BAR = 24, ROW = 26, VALUE_X = 250, ICON = 4 * 12;

  const c = document.createElement("canvas");
  const measureCtx = c.getContext("2d");
  if (!measureCtx) return null;
  /** Greedy wrap at `font`, so the copy lines up the way the dialog wraps it. */
  const wrap = (text: string, font: string, width: number) => {
    measureCtx.font = font;
    const out: string[] = [];
    let line = "";
    for (const word of text.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (line && measureCtx.measureText(next).width > width) {
        out.push(line);
        line = word;
      } else line = next;
    }
    if (line) out.push(line);
    return out;
  };

  const bodyW = W - PAD * 2 - ICON - 14;
  const subLines = wrap(subtitle, `12px ${ui}`, bodyW);
  const asideLines = aside ? wrap(aside, `12px ${ui}`, bodyW) : [];
  const headH = 26 + subLines.length * 17 + (title ? 22 : 0) + asideLines.length * 17;
  const H = BAR + PAD + headH + 4 + rows.length * ROW + 22 + PAD;

  c.width = W * S;
  c.height = H * S;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.scale(S, S);
  ctx.textBaseline = "alphabetic";

  // window: paper body, ink frame, striped titlebar
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = ink;
  ctx.fillRect(0, BAR - 2, W, 2);
  ctx.font = `12px ${ui}`;
  const titleW = ctx.measureText(windowTitle.toUpperCase()).width + 12;
  const stripeL = 22, stripeR = (W - titleW) / 2;
  for (let y = 6; y < BAR - 5; y += 3) {
    ctx.fillRect(stripeL, y, stripeR - stripeL - 4, 1);
    ctx.fillRect(stripeR + titleW + 4, y, W - 22 - (stripeR + titleW + 4), 1);
  }
  ctx.strokeStyle = muted;
  ctx.lineWidth = 2;
  ctx.strokeRect(7, BAR / 2 - 5, 10, 10);   // the dead closebox, as on screen
  ctx.fillStyle = ink;
  ctx.fillText(windowTitle.toUpperCase(), stripeR + 6, BAR / 2 + 4);

  // the alert icon, painted a pixel at a time like every other sprite
  const cell = ICON / icon.map.length;
  icon.map.forEach((line, y) => {
    [...line].forEach((ch, x) => {
      const color = icon.palette[ch];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(PAD + x * cell, BAR + PAD + y * cell, cell, cell);
    });
  });

  const x = PAD + ICON + 14;
  let y = BAR + PAD + 14;
  ctx.font = `16px ${ui}`;
  ctx.fillStyle = ink;
  ctx.fillText(headline.toUpperCase(), x, y);
  ctx.font = `12px ${ui}`;
  ctx.fillStyle = muted;
  for (const line of subLines) {
    y += 17;
    ctx.fillText(line.toUpperCase(), x, y);
  }
  if (title) {
    y += 22;
    ctx.fillStyle = tones.warn;
    ctx.fillText(`"${title.toUpperCase()}"`, x, y);
  }
  ctx.fillStyle = tones.warn;
  for (const line of asideLines) {
    y += 17;
    ctx.fillText(line.toUpperCase(), x, y);
  }

  y += 4;
  for (const [label, value, tone] of rows) {
    y += ROW;
    ctx.font = `11px ${ui}`;
    ctx.fillStyle = muted;
    ctx.fillText(label.toUpperCase(), PAD, y);
    ctx.font = `20px ${mono}`;
    ctx.fillStyle = tone ? tones[tone] ?? ink : ink;
    ctx.fillText(value, VALUE_X, y);
  }

  y += 22;
  ctx.font = `10px ${ui}`;
  ctx.fillStyle = muted;
  ctx.fillText(company.toUpperCase(), PAD, y);
  ctx.textAlign = "right";
  ctx.fillText("PROD ROULETTE \u00b7 @SHREVERRR & @SHIVAMBAJPAI04", W - PAD, y);
  ctx.textAlign = "left";

  ctx.strokeStyle = ink;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, W - 4, H - 4);

  return new Promise((resolve) => c.toBlob(resolve, "image/png"));
}

export { WARNING };

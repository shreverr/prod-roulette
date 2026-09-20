"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ConsolePanel, DeployPanel, GameOverPanel, MetricsPanel, OfferPanel, QueuePanel, ShopPanel, ToolsPanel,
} from "@/components/game/windows";
import { AlertDialog } from "@/components/os/AlertDialog";
import { Dock } from "@/components/os/Dock";
import { MenuBar } from "@/components/os/MenuBar";
import { Window, type WinPos } from "@/components/os/Window";
import { CANARY, CHART, COIN, FLAME, MAGNIFIER, ROCKET, SERVER, SKULL, WARNING, WRENCH } from "@/components/pixel/sprites";
import { ABOUT_LINES, BOOT_LINES, BOOT_SHOWN, CONSOLE_REPLIES, MANUAL, inr } from "@/lib/engine/content";
import { clockLabel, useGame } from "@/lib/useGame";
import { sfx } from "@/lib/sfx";

const WINDOWS = [
  { id: "deploy", title: "deploy.app", icon: ROCKET, width: 400, height: null, x: 32, y: 56, open: true },
  { id: "queue", title: "queue.mon", icon: SERVER, width: 240, height: null, x: 456, y: 56, open: true },
  { id: "metrics", title: "metrics.mon", icon: CHART, width: 330, height: null, x: 456, y: 268, open: true },
  { id: "tools", title: "tools.kit", icon: WRENCH, width: 360, height: null, x: 810, y: 56, open: true },
  { id: "console", title: "console.log", icon: MAGNIFIER, width: 420, height: 240, x: 32, y: 452, open: true },
  { id: "upgrades", title: "upgrades.store", icon: COIN, width: 620, height: null, x: 300, y: 150, open: false },
] as const;

type Id = (typeof WINDOWS)[number]["id"];

export default function Page() {
  const { view, busy, stage, stageLabel, log, toasts, notifications, dialog, shake, start, send, dismiss, say } = useGame();
  const [about, setAbout] = useState(false);
  const [help, setHelp] = useState(false);
  const [booting, setBooting] = useState<number | null>(null);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [lastReadNotification, setLastReadNotification] = useState(-1);

  const [pos, setPos] = useState<Record<Id, WinPos>>(() =>
    Object.fromEntries(
      WINDOWS.map((w, i) => [w.id, { x: w.x, y: w.y, z: i + 1, open: w.open, w: w.width, h: w.height }]),
    ) as Record<Id, WinPos>,
  );
  const zTop = useRef(WINDOWS.length);
  const [history, setHistory] = useState<{ uptime: number[]; users: number[]; cash: number[] }>({
    uptime: [], users: [], cash: [],
  });

  // Keep the default layout on screen on smaller displays.
  useEffect(() => {
    setPos((p) => {
      const next = { ...p };
      for (const w of WINDOWS) {
        next[w.id] = {
          ...next[w.id],
          x: Math.min(next[w.id].x, Math.max(8, window.innerWidth - next[w.id].w - 16)),
          y: Math.min(next[w.id].y, Math.max(40, window.innerHeight - 160)),
        };
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!view) return;
    setHistory((h) => ({
      uptime: [...h.uptime, view.uptime].slice(-40),
      users: [...h.users, view.users].slice(-40),
      cash: [...h.cash, view.cash].slice(-40),
    }));
  }, [view]);

  useEffect(() => {
    if (!notificationCenterOpen || notifications.length === 0) return;
    setLastReadNotification(notifications[notifications.length - 1].id);
  }, [notificationCenterOpen, notifications]);

  useEffect(() => {
    if (!notificationCenterOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotificationCenterOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [notificationCenterOpen]);

  /** A: the boot sequence. Plays on every load, so the skip has to actually cut it short —
   *  a ref, not state, because the loop below reads it between awaits. */
  const skipBoot = useRef(false);
  const loggingIn = useRef(false);
  const [bootLines, setBootLines] = useState<[string, string][]>([]);

  const boot = useCallback(async () => {
    skipBoot.current = false;
    // Fisher-Yates on a copy, then take the first few — boot plays every load, so the lines
    // should differ. (sort(() => Math.random() - 0.5) is a biased shuffle; this one isn't.)
    const pool = [...BOOT_LINES];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const lines = pool.slice(0, BOOT_SHOWN);
    setBootLines(lines);

    sfx.boot();
    for (let i = 1; i <= lines.length; i++) {
      setBooting(i);
      if (skipBoot.current) break;
      await new Promise((r) => setTimeout(r, 420));
    }
    // Land on the full list + "ready." and stay there. login() is what starts the run.
    setBooting(lines.length);
  }, []);

  const bootDone = booting !== null && booting >= BOOT_SHOWN;

  const login = useCallback(async () => {
    if (loggingIn.current) return;
    loggingIn.current = true;
    try {
      await start();
      setBooting(null);
      // First visit ever gets the manual unasked. After that it lives in the PRODOS menu.
      try {
        if (!localStorage.getItem("prodos:manual-seen")) {
          localStorage.setItem("prodos:manual-seen", "1");
          setHelp(true);
        }
      } catch {
        // storage blocked (private window) — no manual, no crash
      }
    } finally {
      loggingIn.current = false;
    }
  }, [start]);

  const focus = useCallback((id: Id) => {
    zTop.current += 1;
    setPos((p) => ({ ...p, [id]: { ...p[id], z: zTop.current } }));
  }, []);

  const toggle = useCallback((id: string) => {
    setPos((p) => ({ ...p, [id as Id]: { ...p[id as Id], open: !p[id as Id].open } }));
    focus(id as Id);
  }, [focus]);

  // The shop is a window, so it opens itself when there is something to buy.
  useEffect(() => {
    if (!view) return;
    setPos((p) => {
      const shouldOpen = view.phase === "shop";
      if (p.upgrades.open === shouldOpen) return p;
      return { ...p, upgrades: { ...p.upgrades, open: shouldOpen } };
    });
  }, [view?.phase, view]);

  const canAct = !!view && view.phase === "deploying" && !busy && !dialog;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Typing in the console prompt must not deploy to production.
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();

      if (booting !== null) {
        if (bootDone) { if (k === "enter") void login(); }
        else if (k === "enter" || k === " ") skipBoot.current = true;
        return;
      }
      if (dialog?.kind === "incident") {
        if (k === "r") void send({ kind: "incident", choice: "rollback" });
        if (k === "h") void send({ kind: "incident", choice: "hotfix" });
        if (k === "w") void send({ kind: "incident", choice: "wait" });
        return;
      }
      if (about) {
        if (k === "enter" || k === " " || k === "escape") setAbout(false);
        return;
      }
      if (help) {
        if (k === "enter" || k === " " || k === "escape") setHelp(false);
        return;
      }
      if (dialog?.kind === "offer") return;   // signing ends the run — click it deliberately
      if (dialog) {
        if (k === "enter" || k === " ") dismiss();
        return;
      }
      if (!canAct || !view) return;

      if (k === "d") void send({ kind: "deploy" });
      else if (k === "s" && view.velocity > 0) void send({ kind: "skip" });
      else if (k === "f" && view.flagAvailable) void send({ kind: "flag" });
      else if (/^[1-6]$/.test(k)) {
        const tool = view.hand[Number(k) - 1];
        if (tool) void send({ kind: "item", item: tool.id });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [about, bootDone, booting, canAct, dialog, dismiss, help, login, send, view]);

  /** K: the console prompt. Cosmetic, and it keeps the easter eggs out of the game hotkeys. */
  const runCommand = useCallback(
    (input: string) => {
      const cmd = input.toLowerCase().trim();
      sfx.keyed();
      say(`> ${input}`, "info", "terminal");
      const reply = CONSOLE_REPLIES[cmd];
      say(reply ?? `command not found: ${cmd.split(" ")[0]}`, reply ? "info" : "bad", "shell");
    },
    [say],
  );

  const dockItems = useMemo(
    () =>
      WINDOWS.map((w) => ({
        id: w.id,
        label: w.title.split(".")[0],
        icon: w.icon,
        open: pos[w.id].open,
        attention: w.id === "upgrades" && view?.phase === "shop",
      })),
    [pos, view?.phase],
  );

  const win = (id: Id, children: React.ReactNode, footer?: React.ReactNode) => {
    const meta = WINDOWS.find((w) => w.id === id)!;
    return (
      <Window
        key={id}
        title={meta.title}
        pos={pos[id]}
        defaultW={meta.width}
        defaultH={meta.height}
        shake={id === "deploy" && shake}
        focused={pos[id].z === Math.max(...Object.values(pos).map((w) => w.z))}
        onFocus={() => focus(id)}
        onMove={(x, y) => setPos((p) => ({ ...p, [id]: { ...p[id], x, y } }))}
        onResize={(w, h) => setPos((p) => ({ ...p, [id]: { ...p[id], w, h } }))}
        onClose={() => setPos((p) => ({ ...p, [id]: { ...p[id], open: false } }))}
        footer={footer}
      >
        {children}
      </Window>
    );
  };

  return (
    <div className="desktop">
      <MenuBar
        onNewRun={() => {
          setNotificationCenterOpen(false);
          void start();
        }}
        onAbout={() => setAbout(true)}
        onHelp={() => setHelp(true)}
        onNotifications={() => setNotificationCenterOpen((open) => !open)}
        notificationsOpen={notificationCenterOpen}
        unreadNotifications={notifications.filter((notification) => notification.id > lastReadNotification).length}
        clock={view ? clockLabel(view.clock) : "Mon 09:12"}
      />

      {notificationCenterOpen ? (
        <aside className="notificationcenter" aria-label="Notification Center">
          <header className="notificationheader">
            <strong>NOTIFICATION CENTER</strong>
            <button onClick={() => setNotificationCenterOpen(false)} aria-label="Close Notification Center">×</button>
          </header>
          <div className="notificationlist">
            {notifications.length ? (
              [...notifications].reverse().map((notification) => (
                <article className="notificationitem" key={notification.id}>
                  <div>
                    <span className="notificationchannel">{notification.channel}</span>
                    <time>{notification.at}</time>
                  </div>
                  <p>{notification.text}</p>
                </article>
              ))
            ) : (
              <p className="notificationempty">No notifications yet.</p>
            )}
          </div>
        </aside>
      ) : null}

      {view ? (
        <>
          {win(
            "deploy",
            <DeployPanel
              view={view}
              busy={busy}
              stage={stage}
              stageLabel={stageLabel}
              onDeploy={() => void send({ kind: "deploy" })}
              onSkip={() => void send({ kind: "skip" })}
              onFlag={() => void send({ kind: "flag" })}
            />,
            <span className="muted small">
              deploying blind pays 1.5x — {view.stats.recklessDeploys} reckless so far
            </span>,
          )}
          {win("queue", <QueuePanel view={view} />)}
          {win("metrics", <MetricsPanel view={view} history={history} />)}
          {win("tools", <ToolsPanel view={view} busy={busy} onUse={(item) => void send({ kind: "item", item })} />,
            <span className="muted small">{view.hand.length}/{view.handCap} slots used</span>)}
          {win("console", <ConsolePanel log={log} onCommand={runCommand} />)}
          {win(
            "upgrades",
            <ShopPanel
              view={view}
              busy={busy}
              onBuy={(id) => void send({ kind: "buy", id })}
              onNext={() => void send({ kind: "nextRound" })}
            />,
          )}
        </>
      ) : null}

      {toasts.length ? (
        <div className="toasts">
          {toasts.map((t) => (
            <div key={t.id} className="toast">
              <span className="toastchannel">{t.channel}</span>
              <span>{t.text}</span>
            </div>
          ))}
        </div>
      ) : null}

      <Dock items={dockItems} onToggle={toggle} />

      {booting !== null ? (
        <div className="bootscreen" onClick={() => { if (bootDone) void login(); else skipBoot.current = true; }}>
          <p className="bootheader">PRODOS 1.0</p>
          {bootLines.slice(0, booting).map(([label, result]) => (
            <p key={label}>
              {label}
              {".".repeat(Math.max(2, 36 - label.length))} {result}
            </p>
          ))}
          {bootDone ? (
            <>
              <p className="bootok">ready.</p>
              <p className="bootprompt">press RETURN to log in</p>
            </>
          ) : null}
        </div>
      ) : null}

      {about ? (
        <AlertDialog
          title="About this startup"
          icon={SERVER}
          actions={[{ label: "OK", primary: true, hint: "RET", onClick: () => setAbout(false) }]}
        >
          <h2>PRODOS 1.0</h2>
          <dl className="summary">
            {ABOUT_LINES.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <p className="credit">
            made by{" "}
            <a href="https://x.com/Shreverrr" target="_blank" rel="noreferrer">shreshth verma</a>
            {" & "}
            <a href="https://x.com/ShivamBajpai04" target="_blank" rel="noreferrer">shivam bajpai</a>
          </p>
        </AlertDialog>
      ) : null}

      {help ? (
        <AlertDialog
          title="How to play"
          icon={MAGNIFIER}
          actions={[{ label: "GOT IT", primary: true, hint: "RET", onClick: () => setHelp(false) }]}
        >
          <h2>PROD ROULETTE</h2>
          <p className="muted">Six deployments in the queue. Some are safe. Some take production down.</p>
          <dl className="manual">
            {MANUAL.map(([heading, lines]) => (
              <div key={heading}>
                <dt>{heading}</dt>
                <dd>{lines.join(" ")}</dd>
              </div>
            ))}
          </dl>
          <p className="muted small">keys: D deploy · S staging · 1-6 tools · R/H/W during an incident</p>
        </AlertDialog>
      ) : null}

      {!view && booting === null ? (
        <AlertDialog
          title="PRODOS 1.0"
          icon={ROCKET}
          actions={[{ label: "BOOT", primary: true, onClick: () => void boot() }]}
        >
          <h2>PROD ROULETTE</h2>
          <p>Six deployments in the queue. Some are safe. Some take production down.</p>
          <p>You are told how many. Never which.</p>
          <p className="muted small">keys: D deploy · S staging · 1-6 tools · R/H/W during an incident</p>
        </AlertDialog>
      ) : null}

      {view && dialog?.kind === "incident" && view.pending ? (
        <AlertDialog
          title="INCIDENT"
          icon={FLAME}
          tone="bad"
          actions={[
            { label: "ROLLBACK", hint: "R", danger: true, onClick: () => void send({ kind: "incident", choice: "rollback" }) },
            { label: "HOTFIX", hint: "H", onClick: () => void send({ kind: "incident", choice: "hotfix" }) },
            { label: "WAIT IT OUT", hint: "W", onClick: () => void send({ kind: "incident", choice: "wait" }) },
          ]}
        >
          <h2>{view.pending.title}</h2>
          {view.pending.lines.map((l) => (
            <p key={l} className="bad">{l}</p>
          ))}
          <p>Users affected: <b>{view.pending.usersHit.toLocaleString("en-IN")}</b></p>
          <p>Exposure: <b className="bad">{inr(view.pending.cashLoss)}</b></p>
        </AlertDialog>
      ) : null}

      {dialog?.kind === "result" ? (
        <AlertDialog
          title={dialog.absorbed ? "CONTAINED" : dialog.ok ? "RECOVERED" : "STILL BROKEN"}
          icon={dialog.absorbed ? CANARY : dialog.ok ? CHART : WARNING}
          tone={dialog.ok ? "good" : "bad"}
          actions={[{ label: "OK", primary: true, hint: "RET", onClick: dismiss }]}
        >
          <h2>
            {dialog.absorbed
              ? "The canary fleet took it"
              : `${dialog.choice.toUpperCase()} ${dialog.ok ? "SUCCEEDED" : "FAILED"}`}
          </h2>
          {dialog.reason ? <p className="bad">Reason: {dialog.reason}</p> : null}
          <p>uptime lost: <b className={dialog.damage ? "bad" : "good"}>{dialog.damage}</b></p>
          <p>cash burned: <b className="bad">{inr(dialog.loss)}</b></p>
        </AlertDialog>
      ) : null}

      {view && dialog?.kind === "offer" && view.offer ? (
        <AlertDialog
          title="ACQUISITION OFFER"
          icon={COIN}
          tone="good"
          actions={[
            { label: "SIGN", primary: true, onClick: () => void send({ kind: "sign" }) },
            { label: "DECLINE", danger: true, onClick: () => void send({ kind: "decline" }) },
          ]}
        >
          <OfferPanel view={view} />
        </AlertDialog>
      ) : null}

      {dialog?.kind === "rewards" ? (
        <AlertDialog
          title="SPRINT CLEARED"
          icon={COIN}
          tone="good"
          actions={[{ label: "COLLECT", primary: true, hint: "RET", onClick: dismiss }]}
        >
          <h2>+{inr(dialog.bonus)}</h2>
          <p>sprint revenue banked.</p>
          {dialog.heal ? <p className="good">+1 uptime recovered overnight.</p> : null}
          {dialog.got.length ? <p>new tools: {dialog.got.join(", ")}</p> : null}
          <p className="muted small">investor update sent: {dialog.investor}</p>
        </AlertDialog>
      ) : null}

      {view && dialog?.kind === "over" ? (
        <AlertDialog
          title={dialog.outcome === "acquired" ? "ACQUIRED" : "RUN OVER"}
          icon={dialog.outcome === "acquired" ? COIN : dialog.outcome === "insolvent" ? WARNING : SKULL}
          tone={dialog.outcome === "acquired" ? "good" : "bad"}
          actions={[{ label: "NEW RUN", primary: true, onClick: () => void start() }]}
        >
          <h2>
            {dialog.outcome === "acquired"
              ? `SOLD FOR ${inr(dialog.score)}`
              : dialog.outcome === "insolvent"
                ? "OUT OF RUNWAY"
                : "PRODUCTION IS DOWN"}
          </h2>
          <p className="muted">
            {dialog.outcome === "acquired"
              ? "You got out. Someone else owns the pager now."
              : dialog.outcome === "insolvent"
                ? "Payroll came due and the account was empty."
                : "Uptime hit zero. Nobody can reach the site."}
          </p>
          {dialog.outcome !== "acquired" ? (
            <p className="warn">
              {view.fireSale > 0
                ? `An acqui-hire offer came in for ${inr(view.fireSale)}. You took it. There was nothing else on the table.`
                : "No offer came in. Not even for the domain."}
            </p>
          ) : null}
          <GameOverPanel view={view} />
        </AlertDialog>
      ) : null}
    </div>
  );
}

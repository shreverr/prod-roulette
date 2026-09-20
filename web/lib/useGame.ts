"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IDLE_NUDGES, inr, QUEUE_BRIEFINGS, WEEK, type ItemId } from "./engine/content";
import type { Action, GameEvent, Outcome } from "./engine/state";
import type { View } from "./engine/view";
import { initAudio, sfx } from "./sfx";

export type Dialog =
  | { kind: "incident" }                                                    // needs a choice
  | { kind: "result"; title: string; choice: string; ok: boolean; damage: number; loss: number; reason: string; absorbed: boolean }
  | { kind: "rewards"; bonus: number; heal: number; got: ItemId[]; investor: string }
  | { kind: "offer" }
  | { kind: "over"; outcome: Outcome; score: number };

export const DEPLOY_STAGES = [
  "building image",
  "running test suite (94 skipped)",
  "pushing to registry",
  "shifting production traffic 10%… 50%… 100%",
];

/** Occasionally CI makes you wait, which is both true to life and a free extra beat. */
const CI_QUEUE_STAGE = "waiting for a free CI runner…";

export type Toast = { id: number; at: string; channel: string; text: string };
export type LogEntry = {
  id: number;
  at: string;
  source: string;
  text: string;
  tone: "info" | "good" | "bad";
};

export const clockLabel = (c: { day: number; hour: number; minute: number }) =>
  `${WEEK[c.day]} ${String(c.hour).padStart(2, "0")}:${String(c.minute).padStart(2, "0")}`;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useGame() {
  const [view, setView] = useState<View | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<number | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [notifications, setNotifications] = useState<Toast[]>([]);
  const [stageLabel, setStageLabel] = useState<string | null>(null);
  const [queue, setQueue] = useState<Dialog[]>([]);
  const [shake, setShake] = useState(false);

  const token = useRef<string | null>(null);
  const busyRef = useRef(false);
  const logId = useRef(0);
  const lastIncident = useRef<string>("");
  const clock = useRef("Mon 09:12");
  const lastAction = useRef(Date.now());

  const say = useCallback((text: string, tone: "info" | "good" | "bad" = "info", source = "system") => {
    // Oldest first: the console has a prompt at the bottom, so output must flow downward.
    setLog((prev) => [...prev, { id: logId.current++, at: clock.current, source, text, tone }].slice(-60));
  }, []);

  const toast = useCallback((channel: string, text: string) => {
    const id = logId.current++;
    const notification = { id, at: clock.current, channel, text };
    setToasts((prev) => [...prev, notification].slice(-3));
    setNotifications((prev) => [...prev, notification]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 6000);
  }, []);

  const playEvents = useCallback(
    async (events: GameEvent[]) => {
      const dialogs: Dialog[] = [];

      for (const e of events) {
        switch (e.t) {
          case "company":
            say(`you are running ${e.name}.`, "info", "system");
            say(e.blurb, "info", "system");
            break;

          case "round:start": {
            // The briefing is picked here, on the client: it is pure flavor wrapped around the
            // two numbers the server already sent, so it can never correlate with the queue.
            const brief = QUEUE_BRIEFINGS[Math.floor(Math.random() * QUEUE_BRIEFINGS.length)]
              .replace(/\{size\}/g, String(e.size))
              .replace(/\{bad\}/g, String(e.bad));
            say(`sprint ${e.round} — ${e.bad} of ${e.size} will take prod down`, "info", "scheduler");
            say(brief, "info", "scheduler");
            break;
          }

          case "deploy:ok": {
            const tags = [e.doubled && "friday x2", e.reckless && "reckless x1.5"].filter(Boolean);
            sfx.shipped();
            say(`${e.version} shipped. +${inr(e.revenue)}${tags.length ? ` (${tags.join(", ")})` : ""}`, "good", "deploy");
            await wait(220);
            break;
          }

          case "deploy:bad":
            sfx.crash();
            setShake(true);
            setTimeout(() => setShake(false), 600);
            await wait(320);
            break;

          case "incident:open":
            lastIncident.current = e.title;
            say(`INCIDENT: ${e.title} — ${e.usersHit.toLocaleString("en-IN")} users affected`, "bad", "monitor");
            if (!e.absorbed) sfx.alarm();
            await wait(260);
            break;

          case "incident:result": {
            if (e.choice === "canary") sfx.recovered();
            else if (e.ok) sfx.recovered();
            else sfx.buzz();
            dialogs.push({
              kind: "result",
              title: lastIncident.current,
              choice: e.choice,
              ok: e.ok,
              damage: e.damage,
              loss: e.loss,
              reason: e.reason,
              absorbed: e.choice === "canary",
            });
            say(
              e.choice === "canary"
                ? `canary contained it. ${inr(e.loss)} written off.`
                : `${e.choice} ${e.ok ? "held" : "failed"}${e.reason ? ` — ${e.reason}` : ""}. -${inr(e.loss)}`,
              e.ok ? "good" : "bad",
              "incident",
            );
            await wait(180);
            break;
          }

          case "tool":
            sfx.flip();
            say(e.message, e.ok ? "info" : "bad", `tool:${e.item}`);
            await wait(160);
            break;

          case "skip":
            say(
              e.wasBad
                ? "dodged a disaster in staging. velocity token spent."
                : `staging was fine — you shelved ${inr(e.missed)} of revenue.`,
              e.wasBad ? "good" : "info",
              "staging",
            );
            await wait(160);
            break;

          case "flag":
            say(e.message, e.ok ? "good" : "bad", "feature-flags");
            break;

          case "draw":
            if (e.items.length) say(`drew ${e.items.length} tool(s)`, "info", "inventory");
            break;

          case "buy":
            if (e.ok) sfx.coin();
            else sfx.deny();
            say(e.message, e.ok ? "good" : "bad", "upgrades");
            break;

          case "round:clear":
            sfx.coin();
            dialogs.push({ kind: "rewards", bonus: e.bonus, heal: e.heal, got: e.got, investor: e.investor });
            say(`sprint cleared. +${inr(e.bonus)}`, "good", "scheduler");
            say(`investor update sent: ${e.investor}`, "info", "investor");
            await wait(200);
            break;

          case "slack":
            toast(e.channel, e.text);
            await wait(120);
            break;

          case "offer":
            sfx.offer();
            say(
              `acquisition offer on the table: ${inr(e.amount)} (${e.multiplier}x revenue)`,
              "good",
              "investor",
            );
            break;

          case "over":
            if (e.outcome === "acquired") sfx.acquired();
            else sfx.over();
            dialogs.push({ kind: "over", outcome: e.outcome, score: e.score });
            say(
              e.outcome === "acquired"
                ? `acquired for ${inr(e.score)}. you got out.`
                : e.outcome === "insolvent"
                  ? "out of runway. run over."
                  : "production is down. run over.",
              e.outcome === "acquired" ? "good" : "bad",
              "system",
            );
            break;

          default:
            break;
        }
      }

      if (dialogs.length) setQueue((q) => [...q, ...dialogs]);
    },
    [say],
  );

  const start = useCallback(async () => {
    initAudio();
    sfx.boot();
    setLog([]);
    setToasts([]);
    setNotifications([]);
    setQueue([]);
    const res = await fetch("/api/new", { method: "POST" }).then((r) => r.json());
    token.current = res.token;
    clock.current = clockLabel(res.view.clock);
    setView(res.view);
    await playEvents(res.events as GameEvent[]);   // carries the sprint announcement
  }, [playEvents]);

  const send = useCallback(
    async (action: Action) => {
      if (busyRef.current || !token.current) return;
      busyRef.current = true;
      lastAction.current = Date.now();
      setBusy(true);
      initAudio();

      const request = fetch("/api/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: token.current, action }),
      }).then((r) => r.json());

      // The deploy animation is long enough to hide the round-trip completely.
      if (action.kind === "deploy") {
        const stalls = Math.random() < 0.18;
        for (let i = 0; i < DEPLOY_STAGES.length; i++) {
          setStage(i);
          setStageLabel(DEPLOY_STAGES[i]);
          sfx.stage(i);
          await wait(300);
          if (stalls && i === 1) {
            setStageLabel(CI_QUEUE_STAGE);
            await wait(900);
          }
        }
        setStage(null);
        setStageLabel(null);
      } else {
        sfx.click();
      }

      const res = await request;
      if (res?.error) {
        sfx.deny();
        say(`rejected: ${res.error}`, "bad", "api");
      } else {
        token.current = res.token;
        clock.current = clockLabel(res.view.clock);
        setView(res.view);
        await playEvents(res.events as GameEvent[]);
      }
      setBusy(false);
      busyRef.current = false;
    },
    [playEvents, say],
  );

  // J: a quiet player gets prodded, the way a real queue prods you.
  useEffect(() => {
    if (!view || view.phase !== "deploying") return;
    const id = setInterval(() => {
      if (busyRef.current || Date.now() - lastAction.current < 40_000) return;
      lastAction.current = Date.now();
      say(IDLE_NUDGES[Math.floor(Math.random() * IDLE_NUDGES.length)], "info", "scheduler");
    }, 5_000);
    return () => clearInterval(id);
  }, [view, say]);

  const dismiss = useCallback(() => {
    sfx.click();
    setQueue((q) => q.slice(1));
  }, []);

  // Rewards dialog dismissed -> move the server into the shop phase.
  useEffect(() => {
    if (!view || busy || queue.length) return;
    if (view.phase === "rewards") void send({ kind: "continue" });
  }, [view, busy, queue.length, send]);

  // The incident and the offer both need an answer, so the phase drives them rather than the queue.
  const dialog: Dialog | null =
    queue[0] ??
    (view?.phase === "incident"
      ? { kind: "incident" }
      : view?.phase === "offer"
        ? { kind: "offer" }
        : null);

  return { view, busy, stage, stageLabel, log, toasts, notifications, dialog, shake, start, send, dismiss, say };
}

/** Counts a number up or down so cash and users feel like meters, not labels. */
export function useAnimatedNumber(target: number, ms = 500): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const raf = useRef(0);

  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    const b = target;
    if (a === b) return;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - (1 - t) * (1 - t);
      setValue(Math.round(a + (b - a) * eased));
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else from.current = b;
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, ms]);

  return value;
}

"use client";

import { useEffect, useState } from "react";
import { isMuted, setMuted, sfx } from "@/lib/sfx";

export function MenuBar({
  onNewRun, onAbout, onNotifications, notificationsOpen, unreadNotifications, clock,
}: {
  onNewRun: () => void;
  onAbout: () => void;
  onNotifications: () => void;
  notificationsOpen: boolean;
  unreadNotifications: number;
  /** The game's clock, not the wall clock — so Friday evening means something. */
  clock: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [mute, setMute] = useState(false);

  useEffect(() => {
    setMute(isMuted());
  }, []);

  const menu = (name: string, items: { label: string; onClick: () => void }[]) => (
    <div className="menu" onPointerLeave={() => setOpen(null)}>
      <button
        className={`menutitle${open === name ? " active" : ""}`}
        onClick={() => {
          sfx.click();
          setOpen(open === name ? null : name);
        }}
      >
        {name}
      </button>
      {open === name ? (
        <ul className="dropdown">
          {items.map((it) => (
            <li key={it.label}>
              <button
                onClick={() => {
                  setOpen(null);
                  it.onClick();
                }}
              >
                {it.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );

  return (
    <nav className="menubar">
      <span className="logo">◧</span>
      {menu("PRODOS", [
        { label: "About this startup", onClick: onAbout },
        { label: "New run", onClick: onNewRun },
      ])}
      {menu("Sound", [
        {
          label: mute ? "Unmute" : "Mute",
          onClick: () => {
            const next = !mute;
            setMute(next);
            setMuted(next);
            if (!next) sfx.click();
          },
        },
      ])}
      <span className="menuspace" />
      <span className="clock">{mute ? "◌ " : "♪ "}{clock}</span>
      <button
        className={`notificationbutton${notificationsOpen ? " active" : ""}`}
        onClick={() => {
          sfx.click();
          onNotifications();
        }}
        aria-label="Notification Center"
        aria-expanded={notificationsOpen}
        title="Notification Center"
      >
        <span aria-hidden>▤</span>
        {unreadNotifications > 0 ? (
          <span className="notificationbadge">{Math.min(unreadNotifications, 99)}</span>
        ) : null}
      </button>
    </nav>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { isMuted, setMuted, sfx } from "@/lib/sfx";

export function MenuBar({
  onNewRun, onAbout, onHelp, onNotifications, notificationsOpen, unreadNotifications, clock,
}: {
  onNewRun: () => void;
  onAbout: () => void;
  onHelp: () => void;
  onNotifications: () => void;
  notificationsOpen: boolean;
  unreadNotifications: number;
  /** The game's clock, not the wall clock — so Friday evening means something. */
  clock: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [mute, setMute] = useState(false);
  const bar = useRef<HTMLElement>(null);

  useEffect(() => {
    setMute(isMuted());
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const menu = target.closest(".menu");
      if (!menu || !bar.current?.contains(menu)) setOpen(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const menu = (name: string, items: { label: string; onClick: () => void }[]) => (
    <div className="menu">
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
    <nav className="menubar" ref={bar}>
      <svg className="logo" viewBox="0 0 14 14" role="img" aria-label="PRODOS logo" shapeRendering="crispEdges">
        <path fill="currentColor" d="M1 0h12v10h-2v2h2v2H1v-2h2v-2H1z" />
        <path fill="var(--chrome-hi)" d="M3 2h8v6H3z" />
        <path fill="currentColor" d="M4 3h2v2H4zm4 0h2v2H8zM5 6h4v1H5z" />
      </svg>
      {menu("PRODOS", [
        { label: "About this startup", onClick: onAbout },
        { label: "How to play", onClick: onHelp },
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

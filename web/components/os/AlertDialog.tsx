"use client";

import type { ReactNode } from "react";
import { Sprite } from "../pixel/Sprite";
import type { PixelMap } from "../pixel/sprites";

export function AlertDialog({
  title, icon, tone = "normal", children, actions,
}: {
  title: string;
  icon: PixelMap;
  tone?: "normal" | "bad" | "good";
  children: ReactNode;
  actions: { label: string; hint?: string; onClick: () => void; primary?: boolean; danger?: boolean }[];
}) {
  return (
    <div className="modal-scrim">
      <div className={`alert tone-${tone}`} role="dialog" aria-modal aria-label={title}>
        <header className="titlebar">
          <span className="closebox ghost" />
          <span className="stripes" />
          <span className="wintitle">{title}</span>
          <span className="stripes" />
        </header>
        <div className="alertbody">
          <Sprite sprite={icon} scale={4} className="alerticon" />
          <div className="alerttext">{children}</div>
        </div>
        <div className="alertactions">
          {actions.map((a) => (
            <button
              key={a.label}
              className={`btn${a.primary ? " primary" : ""}${a.danger ? " danger" : ""}`}
              onClick={a.onClick}
            >
              {a.label}
              {a.hint ? <em>{a.hint}</em> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

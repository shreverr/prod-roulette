"use client";

import { Sprite } from "../pixel/Sprite";
import type { PixelMap } from "../pixel/sprites";
import { sfx } from "@/lib/sfx";

export type DockItem = { id: string; label: string; icon: PixelMap; open: boolean; attention?: boolean };

export function Dock({ items, onToggle }: { items: DockItem[]; onToggle: (id: string) => void }) {
  return (
    <div className="dock">
      {items.map((it) => (
        <button
          key={it.id}
          className={`dockicon${it.open ? " open" : ""}${it.attention ? " attention" : ""}`}
          title={it.label}
          onClick={() => {
            sfx.click();
            onToggle(it.id);
          }}
        >
          <Sprite sprite={it.icon} scale={2} />
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  );
}

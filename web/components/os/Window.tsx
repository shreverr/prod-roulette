"use client";

import { useRef, type ReactNode } from "react";
import { Sprite } from "../pixel/Sprite";
import type { PixelMap } from "../pixel/sprites";

/** `h` stays null until the user grows the window, so windows size to their content by default. */
export type WinPos = { x: number; y: number; z: number; open: boolean; w: number; h: number | null };

export function Window({
  title, icon, pos, defaultW, defaultH = null, minW = 210, minH = 110, shake, focused, closable = true,
  children, footer, onFocus, onMove, onResize, onClose,
}: {
  title: string;
  icon?: PixelMap;
  pos: WinPos;
  /** Size the grow box resets to on a double-click. */
  defaultW: number;
  defaultH?: number | null;
  minW?: number;
  minH?: number;
  shake?: boolean;
  focused?: boolean;
  closable?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  onFocus: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (w: number, h: number | null) => void;
  onClose: () => void;
}) {
  const frame = useRef<HTMLElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const grow = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  if (!pos.open) return null;

  const zoomed = pos.h !== defaultH || pos.w !== defaultW;

  return (
    <section
      ref={frame}
      className={`win${shake ? " shake" : ""}${focused ? " focused" : " blurred"}`}
      style={{ left: pos.x, top: pos.y, zIndex: pos.z, width: pos.w, height: pos.h ?? undefined }}
      onPointerDown={onFocus}
    >
      <header
        className="titlebar"
        onPointerDown={(e) => {
          drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          onMove(
            Math.max(4, Math.min(window.innerWidth - 60, e.clientX - drag.current.dx)),
            Math.max(26, Math.min(window.innerHeight - 40, e.clientY - drag.current.dy)),
          );
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        {closable ? (
          <button
            className="closebox"
            aria-label={`close ${title}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onClose}
          />
        ) : (
          <span className="closebox ghost" />
        )}
        <span className="stripes" />
        <span className="wintitle">
          {icon ? <Sprite sprite={icon} scale={1} /> : null}
          {title}
        </span>
        <span className="stripes" />
        <button
          className="zoombox"
          aria-label={`zoom ${title}`}
          title={zoomed ? "restore size" : "zoom to fill"}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() =>
            zoomed
              ? onResize(defaultW, defaultH)
              : onResize(
                  Math.max(minW, window.innerWidth - pos.x - 16),
                  Math.max(minH, window.innerHeight - pos.y - 16),
                )
          }
        />
      </header>

      <div className="winbody">{children}</div>
      {footer ? <div className="winfooter">{footer}</div> : null}

      <button
        className="growbox"
        aria-label={`resize ${title}`}
        title="drag to resize · double-click to reset"
        onPointerDown={(e) => {
          e.stopPropagation();
          grow.current = {
            x: e.clientX,
            y: e.clientY,
            w: pos.w,
            // null height means "as tall as the content" — measure it to grow from there
            h: pos.h ?? frame.current?.offsetHeight ?? minH,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const from = grow.current;
          if (!from) return;
          onResize(
            Math.max(minW, Math.min(window.innerWidth - pos.x - 8, from.w + (e.clientX - from.x))),
            Math.max(minH, Math.min(window.innerHeight - pos.y - 8, from.h + (e.clientY - from.y))),
          );
        }}
        onPointerUp={() => {
          grow.current = null;
        }}
        onDoubleClick={() => onResize(defaultW, defaultH)}
      />
    </section>
  );
}

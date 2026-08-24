"use client";

import { useEffect, useRef } from "react";
import type { PixelMap } from "./sprites";

/** Paints a pixel map at 1px per cell then scales it up with nearest-neighbour. */
export function Sprite({
  sprite, scale = 3, className, style,
}: {
  sprite: PixelMap;
  scale?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const w = sprite.map[0].length;
  const h = sprite.map.length;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    sprite.map.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        const color = sprite.palette[ch];
        if (!color) return;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      });
    });
  }, [sprite, w, h]);

  return (
    <canvas
      ref={ref}
      className={className}
      aria-hidden
      style={{ width: w * scale, height: h * scale, imageRendering: "pixelated", ...style }}
    />
  );
}

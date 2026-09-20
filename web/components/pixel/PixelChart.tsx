"use client";

import { useEffect, useRef } from "react";

const BAR = 2;   // bar width in canvas pixels
const GAP = 1;
const SLOT = BAR + GAP;

/** A fixed-slot bar chart, scaled up. Pixel art, not a smooth SVG line. */
export function PixelChart({
  data, max, color = "#3ac06a", height = 18, scale = 2, label,
}: {
  data: number[];
  max: number;
  color?: string;
  height?: number;
  scale?: number;
  label?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const slots = 12;
  const width = slots * SLOT;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    // empty slot tracks, so a short series still reads as a chart
    ctx.fillStyle = "#c8c8c0";
    for (let i = 0; i < slots; i++) ctx.fillRect(i * SLOT, 0, BAR, height - 1);

    const series = data.slice(-slots);
    const ceiling = Math.max(max, ...series, 1);
    ctx.fillStyle = color;
    series.forEach((v, i) => {
      const h = Math.max(1, Math.round((v / ceiling) * (height - 1)));
      ctx.fillRect(i * SLOT, height - 1 - h, BAR, h);
    });

    ctx.fillStyle = "#4a4a52";
    ctx.fillRect(0, height - 1, width, 1);
  }, [data, max, color, height, width]);

  return (
    <div className="chart">
      <canvas
        ref={ref}
        style={{ width: width * scale, height: height * scale, imageRendering: "pixelated" }}
      />
      {label ? <span className="chart-label">{label}</span> : null}
    </div>
  );
}

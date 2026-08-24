"use client";

import { useEffect, useRef } from "react";

/** A 1px-per-sample bar chart, scaled up. Pixel art, not a smooth SVG line. */
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
  const width = 36;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    // baseline
    ctx.fillStyle = "#4a4a52";
    ctx.fillRect(0, height - 1, width, 1);

    const series = data.slice(-width);
    const ceiling = Math.max(max, ...series, 1);
    series.forEach((v, i) => {
      const x = width - series.length + i;
      const h = Math.max(1, Math.round((v / ceiling) * (height - 1)));
      ctx.fillStyle = color;
      ctx.fillRect(x, height - h, 1, h);
    });
  }, [data, max, color, height]);

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

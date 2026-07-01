import { useId } from "react";

// Tiny SVG sparkline with gradient fill. Values are auto-scaled; with fewer
// than 2 points it renders a flat baseline.
export function Sparkline({
  values,
  color = "hsl(var(--chart-1))",
  width = 120,
  height = 40,
  className,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  const gid = useId();
  const pts = values.length >= 2 ? values : [0, 0];
  const max = Math.max(...pts, 1);
  const min = Math.min(...pts, 0);
  const range = max - min || 1;
  const pad = 3;
  const step = (width - pad * 2) / (pts.length - 1);
  const y = (v: number) => height - pad - ((v - min) / range) * (height - pad * 2);
  const points = pts.map((v, i) => `${pad + i * step},${y(v)}`).join(" ");
  const area = `${pad},${height} ${points} ${width - pad},${height}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ width, height }}
      aria-hidden
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gid})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

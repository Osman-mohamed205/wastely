import React, { useId } from 'react';

interface SparklineProps {
  data: number[];
  color?: string; // Hex or CSS color, e.g. '#0d9488'
  height?: number;
  className?: string;
  fillOpacity?: number;
  strokeWidth?: number;
}

export function Sparkline({
  data,
  color = '#0d9488',
  height = 42,
  className = '',
  fillOpacity = 0.15,
  strokeWidth = 2,
}: SparklineProps) {
  const gradientId = useId();

  // Handle empty or single point datasets
  if (!data || data.length === 0) {
    return (
      <div className={`w-full flex items-center justify-center text-[10px] text-slate-300 ${className}`} style={{ height }}>
        <span className="w-full border-b border-dashed border-slate-200" />
      </div>
    );
  }

  const cleanData = data.map(v => (isNaN(v) || !isFinite(v) ? 0 : v));
  const min = Math.min(...cleanData);
  const max = Math.max(...cleanData);
  const range = max - min || 1;

  const width = 200;
  const paddingY = 6;
  const chartHeight = height - paddingY * 2;

  // Compute normalized coordinates
  const points = cleanData.map((val, index) => {
    const x = cleanData.length > 1 ? (index / (cleanData.length - 1)) * width : width / 2;
    // Invert Y so highest value is at the top
    const y = paddingY + chartHeight - ((val - min) / range) * chartHeight;
    return { x, y };
  });

  // Generate smooth cubic Bezier path
  const createSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length <= 1) return `M 0,${height / 2} L ${width},${height / 2}`;

    let path = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;

    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(i + 2, pts.length - 1)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }

    return path;
  };

  const linePath = createSmoothPath(points);
  const lastPoint = points[points.length - 1];
  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;

  return (
    <div className={`relative overflow-hidden w-full select-none ${className}`} style={{ height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Gradient fill underneath curve */}
        <path d={areaPath} fill={`url(#${gradientId})`} />

        {/* Smooth line */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Live glowing pulse on the most recent point */}
        {lastPoint && (
          <>
            <circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r="4"
              fill={color}
              className="animate-ping opacity-30"
            />
            <circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r="3"
              fill={color}
              stroke="#ffffff"
              strokeWidth="1.5"
            />
          </>
        )}
      </svg>
    </div>
  );
}

export default Sparkline;

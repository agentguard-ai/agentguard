'use client';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CostVelocityLineChartProps {
  timeSeries: { timestamp: number; cost: number }[];
  threshold: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Format a timestamp for x-axis display.
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format a cost value for y-axis/tooltip display.
 */
function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

// ─── SVG Line Chart Component ────────────────────────────────────────────────

/**
 * CostVelocityLineChart — SVG-based line chart rendering cost over time
 * with a threshold reference line.
 *
 * This component is loaded lazily via next/dynamic to keep chart dependencies
 * out of the initial bundle.
 *
 * Requirements: 5.2, 16.5
 */
export function CostVelocityLineChart({ timeSeries, threshold }: CostVelocityLineChartProps) {
  if (timeSeries.length < 2) {
    return (
      <div
        className="flex h-[220px] items-center justify-center text-xs text-[var(--color-text-secondary)]"
        data-testid="chart-insufficient-data"
      >
        Not enough data points to render chart
      </div>
    );
  }

  // Chart dimensions
  const width = 500;
  const height = 220;
  const paddingTop = 16;
  const paddingBottom = 28;
  const paddingLeft = 48;
  const paddingRight = 16;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Data range
  const costs = timeSeries.map((d) => d.cost);
  const minCost = Math.min(...costs, threshold);
  const maxCost = Math.max(...costs, threshold);
  const costRange = maxCost - minCost || 1;

  const minTime = timeSeries[0].timestamp;
  const maxTime = timeSeries[timeSeries.length - 1].timestamp;
  const timeRange = maxTime - minTime || 1;

  // Scale functions
  const scaleX = (timestamp: number) =>
    paddingLeft + ((timestamp - minTime) / timeRange) * chartWidth;
  const scaleY = (cost: number) =>
    paddingTop + chartHeight - ((cost - minCost) / costRange) * chartHeight;

  // Build SVG polyline points
  const linePoints = timeSeries
    .map((d) => `${scaleX(d.timestamp)},${scaleY(d.cost)}`)
    .join(' ');

  // Area fill path (from line to bottom)
  const firstX = scaleX(timeSeries[0].timestamp);
  const lastX = scaleX(timeSeries[timeSeries.length - 1].timestamp);
  const bottomY = paddingTop + chartHeight;
  const areaPath = `M ${firstX},${bottomY} L ${linePoints.replace(/,/g, ' ').split(' ').reduce((acc, val, i) => {
    if (i % 2 === 0) return acc + ` L ${val},`;
    return acc + val;
  }, '').slice(3)} L ${lastX},${bottomY} Z`;

  // Threshold line Y position
  const thresholdY = scaleY(threshold);

  // X-axis tick marks (show ~4 time labels)
  const tickCount = Math.min(4, timeSeries.length);
  const tickIndices = Array.from({ length: tickCount }, (_, i) =>
    Math.round((i / (tickCount - 1)) * (timeSeries.length - 1))
  );

  // Y-axis labels (3 labels: min, mid, max)
  const yLabels = [
    { value: maxCost, y: scaleY(maxCost) },
    { value: (maxCost + minCost) / 2, y: scaleY((maxCost + minCost) / 2) },
    { value: minCost, y: scaleY(minCost) },
  ];

  return (
    <div className="w-full" data-testid="cost-velocity-line-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[220px] w-full"
        role="img"
        aria-label="Line chart showing cost over time with threshold reference"
      >
        <defs>
          <linearGradient id="cost-velocity-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent, #14b8a6)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--color-accent, #14b8a6)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yLabels.map((label, i) => (
          <line
            key={i}
            x1={paddingLeft}
            y1={label.y}
            x2={width - paddingRight}
            y2={label.y}
            stroke="var(--color-border, #334155)"
            strokeWidth="0.5"
            strokeDasharray="4 4"
          />
        ))}

        {/* Area fill under line */}
        <path
          d={areaPath}
          fill="url(#cost-velocity-gradient)"
        />

        {/* Cost line */}
        <polyline
          points={linePoints}
          fill="none"
          stroke="var(--color-accent, #14b8a6)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Threshold reference line */}
        <line
          x1={paddingLeft}
          y1={thresholdY}
          x2={width - paddingRight}
          y2={thresholdY}
          stroke="var(--color-warning, #f59e0b)"
          strokeWidth="1.5"
          strokeDasharray="6 3"
          data-testid="threshold-line"
        />
        <text
          x={width - paddingRight - 2}
          y={thresholdY - 4}
          textAnchor="end"
          className="fill-[var(--color-warning,#f59e0b)] text-[9px]"
        >
          Threshold
        </text>

        {/* Y-axis labels */}
        {yLabels.map((label, i) => (
          <text
            key={i}
            x={paddingLeft - 6}
            y={label.y + 3}
            textAnchor="end"
            className="fill-[var(--color-text-secondary,#94a3b8)] text-[9px]"
          >
            {formatCost(label.value)}
          </text>
        ))}

        {/* X-axis labels */}
        {tickIndices.map((idx) => (
          <text
            key={idx}
            x={scaleX(timeSeries[idx].timestamp)}
            y={height - 6}
            textAnchor="middle"
            className="fill-[var(--color-text-secondary,#94a3b8)] text-[9px]"
          >
            {formatTime(timeSeries[idx].timestamp)}
          </text>
        ))}
      </svg>
    </div>
  );
}

export default CostVelocityLineChart;

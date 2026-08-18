/** Format integer with comma thousand-separators */
export function formatCount(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

/** Format dollar amount: $X,XXX.XX (2 decimal places) */
export function formatDollar(value: number): string {
  return '$' + value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format dollar amount with 4 decimal places: $X.XXXX */
export function formatMicroDollar(value: number): string {
  return '$' + value.toFixed(4);
}

/** Format percentage to 1 decimal place: "72.3%" */
export function formatPercent(value: number): string {
  return value.toFixed(1) + '%';
}

/** Format latency as rounded integer with "ms" suffix */
export function formatLatency(value: number): string {
  return Math.round(value) + 'ms';
}

/** Calculate clamped percentage: clamp(round(current/total * 100), 0, 100) */
export function calcPercentage(current: number, total: number): number {
  if (total === 0) return 0;
  return Math.min(100, Math.max(0, Math.round((current / total) * 100)));
}

export type MetricCategory = 'positive' | 'danger' | 'warning' | 'neutral';

/** Map metric category to Tailwind color class */
export function getMetricColorClass(category: MetricCategory): string {
  switch (category) {
    case 'positive':
      return 'text-green-500';
    case 'danger':
      return 'text-red-500';
    case 'warning':
      return 'text-orange-500';
    case 'neutral':
      return 'text-gray-500';
  }
}

/** Get accessible label for a metric indicator */
export function getMetricAriaLabel(category: MetricCategory, value: string): string {
  switch (category) {
    case 'positive':
      return `Healthy metric: ${value}`;
    case 'danger':
      return `Critical metric: ${value}`;
    case 'warning':
      return `Warning metric: ${value}`;
    case 'neutral':
      return `Metric: ${value}`;
  }
}

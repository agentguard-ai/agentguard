import { CostVelocityChart } from '@/panels/CostVelocityChart';
import { BudgetForecastChart } from '@/panels/BudgetForecastChart';
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary';

/**
 * ChartsRow — Responsive grid layout wrapper for chart panels.
 *
 * Layout:
 * - ≥ 1400px: 2-column grid (each chart occupies ~50% width)
 * - < 1400px: Single-column stack
 *
 * Renders CostVelocityChart and BudgetForecastChart side by side
 * in wide viewports, stacking vertically on narrower screens.
 * Each chart is wrapped in PanelErrorBoundary for fault isolation.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.5, 12.7, 12.8
 */
export function ChartsRow() {
  return (
    <section
      className="grid grid-cols-1 min-[1400px]:grid-cols-2 gap-4"
      aria-label="Charts"
      data-testid="charts-row"
    >
      <PanelErrorBoundary panelName="Cost Velocity">
        <CostVelocityChart />
      </PanelErrorBoundary>
      <PanelErrorBoundary panelName="Budget Forecast">
        <BudgetForecastChart />
      </PanelErrorBoundary>
    </section>
  );
}

export default ChartsRow;

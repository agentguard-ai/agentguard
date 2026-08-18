import { DefensePipelineFlow } from '@/panels/DefensePipelineFlow';
import { CanaryAlertsPanel } from '@/panels/CanaryAlertsPanel';
import { AgentMatrixPanel } from '@/panels/AgentMatrixPanel';
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary';

/**
 * MidDetailRow — Responsive grid layout wrapper for mid-detail panels.
 *
 * Layout:
 * - ≥ 1600px: 3-column grid
 * - < 1600px: Single-column stack
 *
 * Renders DefensePipelineFlow, CanaryAlertsPanel, and AgentMatrixPanel
 * in a 3-column grid on wide viewports, stacking vertically on narrower screens.
 * Each panel is wrapped in PanelErrorBoundary for render error fault isolation.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.6, 12.1
 */
export function MidDetailRow() {
  return (
    <section
      className="grid grid-cols-1 min-[1600px]:grid-cols-3 gap-4"
      aria-label="Mid-detail panels"
      data-testid="mid-detail-row"
    >
      <PanelErrorBoundary panelName="Defense Pipeline">
        <DefensePipelineFlow />
      </PanelErrorBoundary>
      <PanelErrorBoundary panelName="Canary Alerts">
        <CanaryAlertsPanel />
      </PanelErrorBoundary>
      <PanelErrorBoundary panelName="Agent Matrix">
        <AgentMatrixPanel />
      </PanelErrorBoundary>
    </section>
  );
}

export default MidDetailRow;

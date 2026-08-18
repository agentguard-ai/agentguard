import { CostSavingsPanel } from '@/panels/CostSavingsPanel';
import { ModelRoutingPanel } from '@/panels/ModelRoutingPanel';
import { ProtocolGovernancePanel } from '@/panels/ProtocolGovernancePanel';
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary';

/**
 * BottomDetailRow — Responsive grid layout wrapper for bottom-detail panels.
 *
 * Layout:
 * - ≥ 1600px: 3-column grid
 * - < 1600px: Single-column stack
 *
 * Renders CostSavingsPanel, ModelRoutingPanel, and ProtocolGovernancePanel
 * in a 3-column grid on wide viewports, stacking vertically on narrower screens.
 * Each panel is wrapped in PanelErrorBoundary for render error fault isolation.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 12.4, 12.5, 12.6
 */
export function BottomDetailRow() {
  return (
    <section
      className="grid grid-cols-1 min-[1600px]:grid-cols-3 gap-4"
      aria-label="Bottom-detail panels"
      data-testid="bottom-detail-row"
    >
      <PanelErrorBoundary panelName="Cost Savings">
        <CostSavingsPanel />
      </PanelErrorBoundary>
      <PanelErrorBoundary panelName="Model Routing">
        <ModelRoutingPanel />
      </PanelErrorBoundary>
      <PanelErrorBoundary panelName="Protocol Governance">
        <ProtocolGovernancePanel />
      </PanelErrorBoundary>
    </section>
  );
}

export default BottomDetailRow;

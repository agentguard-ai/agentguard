'use client';

import { PanelErrorBoundary } from './PanelErrorBoundary';
import { PipelineStatusPanel } from '@/panels/PipelineStatusPanel';
import { DecisionExplorer } from '@/panels/DecisionExplorer';
import { CostTrackerPanel } from '@/panels/CostTrackerPanel';
import { ModuleHealthPanel } from '@/panels/ModuleHealthPanel';
import { AuditTrailViewer } from '@/panels/AuditTrailViewer';
import { ChainInspector } from '@/panels/ChainInspector';
import { KillSwitchPanel } from '@/panels/KillSwitchPanel';
import { AlertConfigPanel } from '@/panels/AlertConfigPanel';

/**
 * PanelGrid component providing the responsive grid layout for dashboard panels.
 * Each panel is wrapped in an independent PanelErrorBoundary so that a render
 * error in one panel does not affect the others.
 *
 * Grid layout adapts from 1280px to 2560px viewport widths:
 * - 1280px–1600px: 2-column grid
 * - 1600px–2560px: 3-column grid (4 on ultra-wide)
 */
export function PanelGrid() {
  return (
    <main className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-[2560px]">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          <PanelErrorBoundary panelName="Pipeline Status">
            <PipelineStatusPanel />
          </PanelErrorBoundary>

          <PanelErrorBoundary panelName="Decision Explorer">
            <DecisionExplorer />
          </PanelErrorBoundary>

          <PanelErrorBoundary panelName="Cost Tracker">
            <CostTrackerPanel />
          </PanelErrorBoundary>

          <PanelErrorBoundary panelName="Module Health">
            <ModuleHealthPanel />
          </PanelErrorBoundary>

          <PanelErrorBoundary panelName="Audit Trail">
            <AuditTrailViewer />
          </PanelErrorBoundary>

          <PanelErrorBoundary panelName="Chain Inspector">
            <ChainInspector />
          </PanelErrorBoundary>

          <PanelErrorBoundary panelName="Kill Switch">
            <KillSwitchPanel />
          </PanelErrorBoundary>

          <PanelErrorBoundary panelName="Alert Config">
            <AlertConfigPanel />
          </PanelErrorBoundary>
        </div>
      </div>
    </main>
  );
}

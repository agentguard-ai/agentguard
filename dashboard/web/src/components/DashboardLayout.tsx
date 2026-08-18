'use client';

import { Header } from './Header';
import { FreezeBanner } from './FreezeBanner';
import { AlertsBar } from './AlertsBar';
import { PanelGrid } from './PanelGrid';

/**
 * Main DashboardLayout component.
 * Orchestrates the full dashboard page structure:
 *   Header → FreezeBanner → AlertsBar → PanelGrid
 *
 * Responsive from 1280px to 2560px viewport widths.
 * Dark-mode-first with light mode toggle support.
 */
export function DashboardLayout() {
  return (
    <div className="flex min-h-screen min-w-[1280px] max-w-[2560px] flex-col">
      <Header />
      <FreezeBanner />
      <AlertsBar />
      <PanelGrid />
    </div>
  );
}

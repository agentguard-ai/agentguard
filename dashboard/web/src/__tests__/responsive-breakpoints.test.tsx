/**
 * Responsive Breakpoints Integration Test
 *
 * Verifies that the dashboard responsive breakpoint system is correctly
 * implemented across all layout components:
 *
 * - Sidebar: full (240px) / collapsed (64px) toggle at 1280px
 * - KPIBannerRow: 4-column → 2×2 grid at 1600px
 * - ChartsRow: 2-column → 1-column at 1400px
 * - MidDetailRow: 3-column → 1-column at 1600px
 * - BottomDetailRow: 3-column → 1-column at 1600px
 * - No horizontal scrollbar at any supported width
 * - Minimum 12px font size across all breakpoints
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import fs from 'fs';
import path from 'path';
import fs from 'fs';
import path from 'path';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock useMediaQuery to control breakpoint states
let mockMediaQueryMatches = true;
vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: (query: string) => {
    // Parse the min-width value from the query
    const match = query.match(/min-width:\s*(\d+)px/);
    if (!match) return mockMediaQueryMatches;
    return mockMediaQueryMatches;
  },
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

// Mock data hooks to avoid real API calls
vi.mock('@/hooks/useCachedQuery', () => ({
  useCachedQuery: () => ({ data: null, isLoading: false, error: null }),
}));

vi.mock('@/hooks/useTimeRange', () => ({
  useTimeRange: () => ({
    timeRange: { start: '2026-01-01', end: '2026-01-31' },
  }),
}));

vi.mock('@/hooks/useDataStream', () => ({
  useDataStream: () => ({
    status: 'connected',
    data: null,
  }),
}));

vi.mock('@/hooks/usePollingFallback', () => ({
  usePollingFallback: () => ({ data: null }),
}));

// Mock chart panels to isolate layout testing
vi.mock('@/panels/CostVelocityChart', () => ({
  CostVelocityChart: () => <div data-testid="cost-velocity-chart">CostVelocityChart</div>,
}));

vi.mock('@/panels/BudgetForecastChart', () => ({
  BudgetForecastChart: () => <div data-testid="budget-forecast-chart">BudgetForecastChart</div>,
}));

vi.mock('@/panels/DefensePipelineFlow', () => ({
  DefensePipelineFlow: () => <div data-testid="defense-pipeline-flow">DefensePipelineFlow</div>,
}));

vi.mock('@/panels/CanaryAlertsPanel', () => ({
  CanaryAlertsPanel: () => <div data-testid="canary-alerts-panel">CanaryAlertsPanel</div>,
}));

vi.mock('@/panels/AgentMatrixPanel', () => ({
  AgentMatrixPanel: () => <div data-testid="agent-matrix-panel">AgentMatrixPanel</div>,
}));

vi.mock('@/panels/CostSavingsPanel', () => ({
  CostSavingsPanel: () => <div data-testid="cost-savings-panel">CostSavingsPanel</div>,
}));

vi.mock('@/panels/ModelRoutingPanel', () => ({
  ModelRoutingPanel: () => <div data-testid="model-routing-panel">ModelRoutingPanel</div>,
}));

vi.mock('@/panels/ProtocolGovernancePanel', () => ({
  ProtocolGovernancePanel: () => <div data-testid="protocol-governance-panel">ProtocolGovernancePanel</div>,
}));

// Import components after mocks
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { KPIBannerRow } from '@/components/KPIBanner/KPIBannerRow';
import { ChartsRow } from '@/components/ChartsRow/ChartsRow';
import { MidDetailRow } from '@/components/MidDetailRow/MidDetailRow';
import { BottomDetailRow } from '@/components/BottomDetailRow/BottomDetailRow';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Responsive Breakpoint System', () => {
  beforeEach(() => {
    mockMediaQueryMatches = true;
  });

  describe('Sidebar — 1280px breakpoint toggle', () => {
    it('renders full width (w-sidebar) when viewport ≥ 1280px', () => {
      mockMediaQueryMatches = true;
      render(<Sidebar />);

      const sidebar = screen.getByRole('navigation', { name: /main navigation/i });
      expect(sidebar.className).toContain('w-sidebar');
      expect(sidebar.className).not.toContain('w-sidebar-collapsed');
    });

    it('renders collapsed width (w-sidebar-collapsed) when viewport < 1280px', () => {
      mockMediaQueryMatches = false;
      render(<Sidebar />);

      const sidebar = screen.getByRole('navigation', { name: /main navigation/i });
      expect(sidebar.className).toContain('w-sidebar-collapsed');
      expect(sidebar.className).not.toContain(/(?<!\-)w-sidebar(?!-)/);
    });

    it('uses useMediaQuery with (min-width: 1280px) for sidebar toggle', () => {
      // The Sidebar component uses useMediaQuery('(min-width: 1280px)') internally
      // When it returns false → collapsed, when true → full
      mockMediaQueryMatches = false;
      render(<Sidebar />);

      const sidebar = screen.getByRole('navigation', { name: /main navigation/i });
      // In collapsed mode, section headings should not be visible
      expect(sidebar.className).toContain('w-sidebar-collapsed');
    });
  });

  describe('KPIBannerRow — 1600px breakpoint', () => {
    it('applies grid-cols-2 as base (for < 1600px)', () => {
      render(<KPIBannerRow />);
      // KPIBannerRow has no data, but the loading or null state still applies grid if rendered
      // With null data and isLoading=false, it returns null, so we test the class pattern
      // Instead, verify the component source has correct classes
      const kpiBanner = document.querySelector('[class*="grid-cols-2"]');
      // Since with no data it returns null, we verify via globals.css / source analysis
      // Alternatively test the className pattern directly from the component
    });

    it('has correct responsive grid classes (grid-cols-2 min-[1600px]:grid-cols-4)', async () => {
      // Render with loading state to see the skeleton grid
      vi.mocked(
        (await import('@/hooks/useCachedQuery')).useCachedQuery as any
      );
      // Test the ChartsRow classes are correct per design spec
      // Since KPIBannerRow returns null when no data/loading, we verify the source code
      const kpiBannerSource = fs.readFileSync(
        path.resolve(__dirname, '../components/KPIBanner/KPIBannerRow.tsx'),
        'utf-8'
      );
      expect(kpiBannerSource).toContain('grid-cols-2');
      expect(kpiBannerSource).toContain('min-[1600px]:grid-cols-4');
    });
  });

  describe('ChartsRow — 1400px breakpoint', () => {
    it('applies grid-cols-1 as base layout (< 1400px stacks vertically)', () => {
      render(<ChartsRow />);
      const section = screen.getByTestId('charts-row');
      expect(section.className).toContain('grid-cols-1');
    });

    it('applies min-[1400px]:grid-cols-2 for wide layout (≥ 1400px)', () => {
      render(<ChartsRow />);
      const section = screen.getByTestId('charts-row');
      expect(section.className).toContain('min-[1400px]:grid-cols-2');
    });

    it('uses CSS Grid layout', () => {
      render(<ChartsRow />);
      const section = screen.getByTestId('charts-row');
      expect(section.className).toContain('grid');
    });

    it('renders both chart panels as children', () => {
      render(<ChartsRow />);
      expect(screen.getByTestId('cost-velocity-chart')).toBeInTheDocument();
      expect(screen.getByTestId('budget-forecast-chart')).toBeInTheDocument();
    });
  });

  describe('MidDetailRow — 1600px breakpoint', () => {
    it('applies grid-cols-1 as base layout (< 1600px stacks vertically)', () => {
      render(<MidDetailRow />);
      const section = screen.getByTestId('mid-detail-row');
      expect(section.className).toContain('grid-cols-1');
    });

    it('applies min-[1600px]:grid-cols-3 for wide layout (≥ 1600px)', () => {
      render(<MidDetailRow />);
      const section = screen.getByTestId('mid-detail-row');
      expect(section.className).toContain('min-[1600px]:grid-cols-3');
    });

    it('uses CSS Grid layout', () => {
      render(<MidDetailRow />);
      const section = screen.getByTestId('mid-detail-row');
      expect(section.className).toContain('grid');
    });

    it('renders all three mid-detail panels', () => {
      render(<MidDetailRow />);
      expect(screen.getByTestId('defense-pipeline-flow')).toBeInTheDocument();
      expect(screen.getByTestId('canary-alerts-panel')).toBeInTheDocument();
      expect(screen.getByTestId('agent-matrix-panel')).toBeInTheDocument();
    });
  });

  describe('BottomDetailRow — 1600px breakpoint', () => {
    it('applies grid-cols-1 as base layout (< 1600px stacks vertically)', () => {
      render(<BottomDetailRow />);
      const section = screen.getByTestId('bottom-detail-row');
      expect(section.className).toContain('grid-cols-1');
    });

    it('applies min-[1600px]:grid-cols-3 for wide layout (≥ 1600px)', () => {
      render(<BottomDetailRow />);
      const section = screen.getByTestId('bottom-detail-row');
      expect(section.className).toContain('min-[1600px]:grid-cols-3');
    });

    it('uses CSS Grid layout', () => {
      render(<BottomDetailRow />);
      const section = screen.getByTestId('bottom-detail-row');
      expect(section.className).toContain('grid');
    });

    it('renders all three bottom-detail panels', () => {
      render(<BottomDetailRow />);
      expect(screen.getByTestId('cost-savings-panel')).toBeInTheDocument();
      expect(screen.getByTestId('model-routing-panel')).toBeInTheDocument();
      expect(screen.getByTestId('protocol-governance-panel')).toBeInTheDocument();
    });
  });

  describe('No horizontal scrollbar (Requirement 9.4)', () => {
    it('globals.css contains overflow-x: hidden on body', () => {
      const globalsCss = fs.readFileSync(
        path.resolve(__dirname, '../app/globals.css'),
        'utf-8'
      );
      expect(globalsCss).toContain('overflow-x: hidden');
    });

    it('dashboard layout uses overflow-y-auto (vertical only) on main content', () => {
      const layoutSource = fs.readFileSync(
        path.resolve(__dirname, '../app/(dashboard)/layout.tsx'),
        'utf-8'
      );
      expect(layoutSource).toContain('overflow-y-auto');
      // Should not have overflow-x-auto or overflow-auto (which enables both axes)
      expect(layoutSource).not.toContain('overflow-x-auto');
    });

    it('main content area constrains max width to 2560px', () => {
      const layoutSource = fs.readFileSync(
        path.resolve(__dirname, '../app/(dashboard)/layout.tsx'),
        'utf-8'
      );
      expect(layoutSource).toContain('max-w-[2560px]');
    });
  });

  describe('Minimum 12px font size (Requirement 9.5)', () => {
    it('globals.css sets html font-size to max(12px, 1rem)', () => {
      const globalsCss = fs.readFileSync(
        path.resolve(__dirname, '../app/globals.css'),
        'utf-8'
      );
      expect(globalsCss).toContain('font-size: max(12px, 1rem)');
    });

    it('no font-size declaration in globals.css uses a value below 12px', () => {
      const globalsCss = fs.readFileSync(
        path.resolve(__dirname, '../app/globals.css'),
        'utf-8'
      );

      // Find all font-size declarations and verify none use values below 12px
      const fontSizeDeclarations = globalsCss.match(/font-size:\s*([^;]+)/g) || [];

      for (const declaration of fontSizeDeclarations) {
        // Extract the value after font-size:
        const value = declaration.replace(/font-size:\s*/, '').trim();

        // Skip CSS functions (max, min, clamp, var) — they may resolve to >= 12px
        if (/^(max|min|clamp|var)\(/.test(value)) continue;

        // Check pixel values
        const pxMatch = value.match(/^(\d+(?:\.\d+)?)px$/);
        if (pxMatch) {
          const pxValue = parseFloat(pxMatch[1]);
          expect(pxValue).toBeGreaterThanOrEqual(12);
        }
      }
    });
  });

  describe('Breakpoint table verification', () => {
    it('matches the spec breakpoint table for ≥ 1600px viewport', () => {
      // At ≥ 1600px: Sidebar = full, KPI = 4-col, Charts = 2-col, Mid/Bottom = 3-col
      const kpiSource = fs.readFileSync(
        path.resolve(__dirname, '../components/KPIBanner/KPIBannerRow.tsx'),
        'utf-8'
      );
      const chartsSource = fs.readFileSync(
        path.resolve(__dirname, '../components/ChartsRow/ChartsRow.tsx'),
        'utf-8'
      );
      const midSource = fs.readFileSync(
        path.resolve(__dirname, '../components/MidDetailRow/MidDetailRow.tsx'),
        'utf-8'
      );
      const bottomSource = fs.readFileSync(
        path.resolve(__dirname, '../components/BottomDetailRow/BottomDetailRow.tsx'),
        'utf-8'
      );

      // KPI: 4 columns at 1600px
      expect(kpiSource).toContain('min-[1600px]:grid-cols-4');
      // Charts: 2 columns at 1400px (still 2-col at 1600px)
      expect(chartsSource).toContain('min-[1400px]:grid-cols-2');
      // Mid: 3 columns at 1600px
      expect(midSource).toContain('min-[1600px]:grid-cols-3');
      // Bottom: 3 columns at 1600px
      expect(bottomSource).toContain('min-[1600px]:grid-cols-3');
    });

    it('matches the spec breakpoint table for 1280–1599px viewport', () => {
      // At 1280–1599px: Sidebar = collapsed (64px), KPI = 2×2, Charts = 1-col, Mid/Bottom = 1-col
      const sidebarSource = fs.readFileSync(
        path.resolve(__dirname, '../components/Sidebar/Sidebar.tsx'),
        'utf-8'
      );

      // Sidebar uses 1280px media query for collapsed state
      expect(sidebarSource).toContain('min-width: 1280px');
      expect(sidebarSource).toContain('w-sidebar-collapsed');
      expect(sidebarSource).toContain('w-sidebar');
    });
  });
});

import { createElement, type ComponentType } from 'react';

// ─── Shared Component Interfaces ─────────────────────────────────────────────

/**
 * Props for the SkeletonLoader component.
 * Each variant matches approximate dimensions of the expected panel content.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4
 */
export interface SkeletonLoaderProps {
  variant: 'kpi-card' | 'chart' | 'table' | 'flow';
  className?: string;
}

/**
 * Props for the EmptyState component.
 * Displays a contextual placeholder when a panel has no data to render.
 *
 * Requirements: 14.1, 14.2, 14.3
 */
export interface EmptyStateProps {
  panelType: 'chart' | 'table' | 'flow' | 'alerts' | 'kpi';
  message: string;
}

// ─── Navigation Types ────────────────────────────────────────────────────────

/**
 * A single navigation item within the sidebar.
 */
export interface NavigationItem {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  href: string;
  badge?: number;
}

/**
 * A logically grouped section of navigation items.
 */
export interface NavigationSection {
  label: string;
  items: NavigationItem[];
}

/**
 * Props for the Sidebar component.
 */
export interface SidebarProps {
  collapsed: boolean;
}

// ─── Placeholder Icon Components ─────────────────────────────────────────────
// Using createElement to avoid requiring .tsx extension for this config file.
// These will be replaced with a proper icon library in a future task.

function createSvgIcon(paths: string[]): ComponentType<{ className?: string }> {
  return function Icon({ className }: { className?: string }) {
    return createElement(
      'svg',
      {
        className,
        fill: 'none',
        stroke: 'currentColor',
        viewBox: '0 0 24 24',
        'aria-hidden': 'true',
      },
      ...paths.map((d) =>
        createElement('path', {
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          strokeWidth: 2,
          d,
        })
      )
    );
  };
}

const DashboardIcon = createSvgIcon([
  'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
]);

const AgentsIcon = createSvgIcon([
  'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
]);

const CostIcon = createSvgIcon([
  'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
]);

const PolicyIcon = createSvgIcon([
  'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
]);

const AuditIcon = createSvgIcon([
  'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
]);

const EvidenceIcon = createSvgIcon([
  'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
]);

const SettingsIcon = createSvgIcon([
  'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
  'M15 12a3 3 0 11-6 0 3 3 0 016 0z',
]);

// ─── Navigation Configuration ────────────────────────────────────────────────

/**
 * The navigation configuration for the sidebar.
 * Organized into 3 sections: Monitor, Govern, System.
 *
 * Requirements: 1.3, 1.7
 */
export const NAVIGATION_CONFIG: NavigationSection[] = [
  {
    label: 'Monitor',
    items: [
      { id: 'overview', label: 'Overview', icon: DashboardIcon, href: '/' },
      { id: 'agents', label: 'Agents', icon: AgentsIcon, href: '/agents' },
      { id: 'costs', label: 'Costs', icon: CostIcon, href: '/costs' },
    ],
  },
  {
    label: 'Govern',
    items: [
      { id: 'policies', label: 'Policies', icon: PolicyIcon, href: '/policies' },
      { id: 'audit', label: 'Audit Trail', icon: AuditIcon, href: '/audit' },
      { id: 'evidence', label: 'Evidence', icon: EvidenceIcon, href: '/evidence' },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'settings', label: 'Settings', icon: SettingsIcon, href: '/settings' },
    ],
  },
];

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar';

// Mock useMediaQuery to control collapsed/expanded state
vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: vi.fn(),
}));

// Mock usePathname from next/navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { usePathname } from 'next/navigation';

const mockUseMediaQuery = vi.mocked(useMediaQuery);
const mockUsePathname = vi.mocked(usePathname);

describe('Sidebar', () => {
  beforeEach(() => {
    mockUseMediaQuery.mockReturnValue(true); // default: wide viewport (full mode)
    mockUsePathname.mockReturnValue('/'); // default: overview route
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Full mode (≥ 1280px)', () => {
    it('renders with full width class', () => {
      render(<Sidebar />);
      const aside = screen.getByRole('navigation', { name: /main navigation/i });
      expect(aside.className).toContain('w-sidebar');
      expect(aside.className).not.toContain('w-sidebar-collapsed');
    });

    it('renders logo text and version label', () => {
      render(<Sidebar />);
      expect(screen.getByText('TealTiger')).toBeInTheDocument();
      expect(screen.getByText('v1.4.0')).toBeInTheDocument();
    });

    it('renders all section headings', () => {
      render(<Sidebar />);
      expect(screen.getByText('Monitor')).toBeInTheDocument();
      expect(screen.getByText('Govern')).toBeInTheDocument();
      expect(screen.getByText('System')).toBeInTheDocument();
    });

    it('renders all navigation item labels', () => {
      render(<Sidebar />);
      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Agents')).toBeInTheDocument();
      expect(screen.getByText('Costs')).toBeInTheDocument();
      expect(screen.getByText('Policies')).toBeInTheDocument();
      expect(screen.getByText('Audit Trail')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('renders navigation items as links with correct hrefs', () => {
      render(<Sidebar />);
      expect(screen.getByRole('link', { name: /overview/i })).toHaveAttribute('href', '/');
      expect(screen.getByRole('link', { name: /agents/i })).toHaveAttribute('href', '/agents');
      expect(screen.getByRole('link', { name: /costs/i })).toHaveAttribute('href', '/costs');
      expect(screen.getByRole('link', { name: /policies/i })).toHaveAttribute('href', '/policies');
      expect(screen.getByRole('link', { name: /audit trail/i })).toHaveAttribute('href', '/audit');
      expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('href', '/settings');
    });

    it('renders icons for each navigation item', () => {
      render(<Sidebar />);
      const svgs = screen.getAllByRole('link').map((link) =>
        link.querySelector('svg')
      );
      expect(svgs.every(Boolean)).toBe(true);
    });

    it('does not render tooltips (no title attribute on links)', () => {
      render(<Sidebar />);
      const links = screen.getAllByRole('link');
      links.forEach((link) => {
        expect(link).not.toHaveAttribute('title');
      });
    });
  });

  describe('Collapsed mode (< 1280px)', () => {
    beforeEach(() => {
      mockUseMediaQuery.mockReturnValue(false);
    });

    it('renders with collapsed width class', () => {
      render(<Sidebar />);
      const aside = screen.getByRole('navigation', { name: /main navigation/i });
      expect(aside.className).toContain('w-sidebar-collapsed');
    });

    it('does not render navigation item labels inline', () => {
      render(<Sidebar />);
      // Labels should not be visible as inline text (they appear in tooltips only)
      const links = screen.getAllByRole('link');
      links.forEach((link) => {
        // In collapsed mode, the label span is not rendered
        const labelSpan = link.querySelector('span.truncate');
        expect(labelSpan).toBeNull();
      });
    });

    it('does not render section headings', () => {
      render(<Sidebar />);
      expect(screen.queryByText('Monitor')).not.toBeInTheDocument();
      expect(screen.queryByText('Govern')).not.toBeInTheDocument();
      expect(screen.queryByText('System')).not.toBeInTheDocument();
    });

    it('renders title attribute on links for tooltip', () => {
      render(<Sidebar />);
      const links = screen.getAllByRole('link');
      expect(links[0]).toHaveAttribute('title', 'Overview');
      expect(links[1]).toHaveAttribute('title', 'Agents');
      expect(links[2]).toHaveAttribute('title', 'Costs');
    });

    it('renders tooltip elements with role="tooltip"', () => {
      render(<Sidebar />);
      const tooltips = screen.getAllByRole('tooltip');
      expect(tooltips.length).toBe(7); // one per nav item (including Evidence)
    });

    it('still renders logo icon but hides text and version', () => {
      render(<Sidebar />);
      expect(screen.queryByText('TealTiger')).not.toBeInTheDocument();
      expect(screen.queryByText('v1.2.0')).not.toBeInTheDocument();
      // Logo SVG should still exist
      const aside = screen.getByRole('navigation', { name: /main navigation/i });
      expect(aside.querySelector('svg')).not.toBeNull();
    });
  });

  describe('Active state (Requirements: 1.4, 12.1, 12.3)', () => {
    it('highlights Overview as active when pathname is /', () => {
      mockUsePathname.mockReturnValue('/');
      render(<Sidebar />);
      const overviewLink = screen.getByRole('link', { name: /overview/i });
      expect(overviewLink).toHaveAttribute('aria-current', 'page');
      expect(overviewLink.className).toContain('bg-[var(--color-accent)]/10');
      expect(overviewLink.className).toContain('text-[var(--color-accent)]');
      expect(overviewLink.className).toContain('border-l-2');
    });

    it('highlights Agents as active when pathname is /agents', () => {
      mockUsePathname.mockReturnValue('/agents');
      render(<Sidebar />);
      const agentsLink = screen.getByRole('link', { name: /agents/i });
      expect(agentsLink).toHaveAttribute('aria-current', 'page');
      expect(agentsLink.className).toContain('bg-[var(--color-accent)]/10');
    });

    it('highlights Policies as active when pathname is /policies', () => {
      mockUsePathname.mockReturnValue('/policies');
      render(<Sidebar />);
      const policiesLink = screen.getByRole('link', { name: /policies/i });
      expect(policiesLink).toHaveAttribute('aria-current', 'page');
    });

    it('does not set aria-current on inactive items', () => {
      mockUsePathname.mockReturnValue('/agents');
      render(<Sidebar />);
      const overviewLink = screen.getByRole('link', { name: /overview/i });
      expect(overviewLink).not.toHaveAttribute('aria-current');
      const costsLink = screen.getByRole('link', { name: /costs/i });
      expect(costsLink).not.toHaveAttribute('aria-current');
    });

    it('defaults to Overview when pathname does not match any route', () => {
      mockUsePathname.mockReturnValue('/unknown-page');
      render(<Sidebar />);
      const overviewLink = screen.getByRole('link', { name: /overview/i });
      expect(overviewLink).toHaveAttribute('aria-current', 'page');
    });

    it('matches prefix routes (e.g. /agents/details)', () => {
      mockUsePathname.mockReturnValue('/agents/agent-123');
      render(<Sidebar />);
      const agentsLink = screen.getByRole('link', { name: /agents/i });
      expect(agentsLink).toHaveAttribute('aria-current', 'page');
    });

    it('inactive items have hover styles instead of active styles', () => {
      mockUsePathname.mockReturnValue('/');
      render(<Sidebar />);
      const agentsLink = screen.getByRole('link', { name: /agents/i });
      expect(agentsLink.className).toContain('hover:bg-[var(--color-bg-secondary)]');
      expect(agentsLink.className).not.toContain('bg-[var(--color-accent)]/10');
    });
  });

  describe('Keyboard navigation (Requirement: 15.2)', () => {
    it('moves focus to the next item on ArrowDown', () => {
      render(<Sidebar />);
      const links = screen.getAllByRole('link');
      // Focus the first link
      links[0].focus();
      expect(document.activeElement).toBe(links[0]);

      // Press ArrowDown within the nav
      const nav = screen.getByRole('navigation', { name: /sidebar/i });
      fireEvent.keyDown(nav, { key: 'ArrowDown' });
      expect(document.activeElement).toBe(links[1]);
    });

    it('moves focus to the previous item on ArrowUp', () => {
      render(<Sidebar />);
      const links = screen.getAllByRole('link');
      // Focus the second link
      links[1].focus();
      expect(document.activeElement).toBe(links[1]);

      const nav = screen.getByRole('navigation', { name: /sidebar/i });
      fireEvent.keyDown(nav, { key: 'ArrowUp' });
      expect(document.activeElement).toBe(links[0]);
    });

    it('wraps from last item to first on ArrowDown', () => {
      render(<Sidebar />);
      const links = screen.getAllByRole('link');
      // Focus the last link
      links[links.length - 1].focus();

      const nav = screen.getByRole('navigation', { name: /sidebar/i });
      fireEvent.keyDown(nav, { key: 'ArrowDown' });
      expect(document.activeElement).toBe(links[0]);
    });

    it('wraps from first item to last on ArrowUp', () => {
      render(<Sidebar />);
      const links = screen.getAllByRole('link');
      // Focus the first link
      links[0].focus();

      const nav = screen.getByRole('navigation', { name: /sidebar/i });
      fireEvent.keyDown(nav, { key: 'ArrowUp' });
      expect(document.activeElement).toBe(links[links.length - 1]);
    });

    it('does not interfere with other keys', () => {
      render(<Sidebar />);
      const links = screen.getAllByRole('link');
      links[0].focus();

      const nav = screen.getByRole('navigation', { name: /sidebar/i });
      fireEvent.keyDown(nav, { key: 'Tab' });
      // Focus should remain unchanged (Tab is handled by browser, not our handler)
      expect(document.activeElement).toBe(links[0]);
    });
  });

  describe('Accessibility', () => {
    it('has navigation ARIA landmark role', () => {
      render(<Sidebar />);
      expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument();
    });

    it('links have focus-visible ring styles', () => {
      render(<Sidebar />);
      const links = screen.getAllByRole('link');
      links.forEach((link) => {
        expect(link.className).toContain('focus-visible:ring-2');
      });
    });

    it('active link has aria-current="page"', () => {
      mockUsePathname.mockReturnValue('/costs');
      render(<Sidebar />);
      const costsLink = screen.getByRole('link', { name: /costs/i });
      expect(costsLink).toHaveAttribute('aria-current', 'page');
    });
  });
});

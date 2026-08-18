'use client';

import { useCallback, useRef, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  NAVIGATION_CONFIG,
  type NavigationSection,
  type NavigationItem,
} from '@/config/navigation';

/**
 * Flatten all navigation items from the config for keyboard navigation.
 */
function getAllItems(): NavigationItem[] {
  return NAVIGATION_CONFIG.flatMap((section) => section.items);
}

/**
 * Determine the active navigation item id based on pathname.
 * Defaults to 'overview' if no route matches.
 *
 * Requirements: 12.3
 */
function getActiveItemId(pathname: string): string {
  const allItems = getAllItems();
  // Exact match first
  const match = allItems.find((item) => item.href === pathname);
  if (match) return match.id;
  // Prefix match for nested routes (e.g., /agents/123 matches /agents)
  const prefixMatch = allItems.find(
    (item) => item.href !== '/' && pathname.startsWith(item.href + '/')
  );
  if (prefixMatch) return prefixMatch.id;
  // Default to overview
  return 'overview';
}

/**
 * Sidebar component providing persistent left navigation.
 *
 * - Full mode (≥ 1280px): 240px wide, shows icon + label + section headings + logo/version
 * - Collapsed mode (< 1280px): 64px wide, icon-only with tooltip on hover
 * - Active item is determined by matching URL pathname against navigation config
 * - Arrow keys navigate between items when sidebar has focus
 *
 * Requirements: 1.1, 1.2, 1.4, 1.5, 1.6, 12.1, 12.3, 15.1, 15.2, 15.3
 */
export function Sidebar() {
  const isWide = useMediaQuery('(min-width: 1280px)');
  const collapsed = !isWide;
  const pathname = usePathname();
  const activeItemId = useMemo(() => getActiveItemId(pathname), [pathname]);
  const navRef = useRef<HTMLElement>(null);

  /**
   * Handle arrow key navigation within the sidebar.
   * Up/Down arrows cycle through focusable links.
   *
   * Requirements: 15.2
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

    const nav = navRef.current;
    if (!nav) return;

    const links = Array.from(nav.querySelectorAll<HTMLAnchorElement>('a[href]'));
    if (links.length === 0) return;

    const currentIndex = links.findIndex((link) => link === document.activeElement);
    let nextIndex: number;

    if (event.key === 'ArrowDown') {
      nextIndex = currentIndex < links.length - 1 ? currentIndex + 1 : 0;
    } else {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : links.length - 1;
    }

    event.preventDefault();
    links[nextIndex].focus();
  }, []);

  return (
    <aside
      className={`
        sticky top-0 h-screen shrink-0
        border-r border-sidebar-border bg-sidebar-bg
        transition-[width] duration-200 ease-in-out
        ${collapsed ? 'w-sidebar-collapsed' : 'w-sidebar'}
      `}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="flex h-full flex-col">
        {/* Logo + Version */}
        <div
          className={`
            flex items-center border-b border-sidebar-border
            ${collapsed ? 'justify-center px-2 py-4' : 'gap-3 px-4 py-5'}
          `}
        >
          <TealTigerLogo className="h-8 w-8 shrink-0" />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-[var(--color-accent)]">
                TealTiger
              </span>
              <span className="text-xs text-[var(--color-text-secondary)]">
                v1.4.0
              </span>
            </div>
          )}
        </div>

        {/* Navigation Sections */}
        <nav
          ref={navRef}
          className="flex-1 overflow-y-auto py-4"
          aria-label="Sidebar navigation"
          onKeyDown={handleKeyDown}
        >
          {NAVIGATION_CONFIG.map((section) => (
            <SidebarSection
              key={section.label}
              section={section}
              collapsed={collapsed}
              activeItemId={activeItemId}
            />
          ))}
        </nav>
      </div>
    </aside>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

interface SidebarSectionProps {
  section: NavigationSection;
  collapsed: boolean;
  activeItemId: string;
}

function SidebarSection({ section, collapsed, activeItemId }: SidebarSectionProps) {
  return (
    <div className="mb-4">
      {/* Section heading — hidden in collapsed mode */}
      {!collapsed && (
        <h3 className="mb-1 px-4 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
          {section.label}
        </h3>
      )}
      <ul role="list" className="space-y-0.5">
        {section.items.map((item) => (
          <SidebarItem
            key={item.id}
            item={item}
            collapsed={collapsed}
            isActive={item.id === activeItemId}
          />
        ))}
      </ul>
    </div>
  );
}

// ─── Item ────────────────────────────────────────────────────────────────────

interface SidebarItemProps {
  item: NavigationItem;
  collapsed: boolean;
  isActive: boolean;
}

function SidebarItem({ item, collapsed, isActive }: SidebarItemProps) {
  const Icon = item.icon;

  return (
    <li>
      <a
        href={item.href}
        title={collapsed ? item.label : undefined}
        aria-current={isActive ? 'page' : undefined}
        className={`
          group relative flex items-center gap-3 rounded-md
          text-sm font-medium
          transition-colors duration-150
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]
          ${collapsed ? 'justify-center px-2 py-2.5 mx-2' : 'px-4 py-2.5 mx-2'}
          ${
            isActive
              ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-l-2 border-[var(--color-accent)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]'
          }
        `}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {!collapsed && (
          <span className="truncate">{item.label}</span>
        )}
        {/* Badge */}
        {item.badge != null && item.badge > 0 && (
          <span
            className={`
              inline-flex items-center justify-center rounded-full
              bg-[var(--color-accent)] text-[10px] font-bold text-white
              ${collapsed ? 'absolute -right-0.5 -top-0.5 h-4 w-4' : 'ml-auto h-5 min-w-5 px-1.5'}
            `}
          >
            {item.badge}
          </span>
        )}
        {/* Tooltip for collapsed mode */}
        {collapsed && (
          <span
            className="
              pointer-events-none absolute left-full z-50
              ml-2 whitespace-nowrap rounded-md
              bg-[var(--color-bg-tertiary)] px-2.5 py-1.5
              text-xs font-medium text-[var(--color-text-primary)]
              opacity-0 shadow-lg
              transition-opacity duration-150
              group-hover:opacity-100
            "
            role="tooltip"
          >
            {item.label}
          </span>
        )}
      </a>
    </li>
  );
}

// ─── Logo ────────────────────────────────────────────────────────────────────

function TealTigerLogo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/tealtiger-logo.png"
      alt="TealTiger"
      className={className}
      aria-hidden="true"
    />
  );
}

export default Sidebar;

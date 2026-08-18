import { Sidebar } from '@/components/Sidebar/Sidebar';

/**
 * Dashboard route group layout.
 *
 * Provides the Sidebar + MainContent wrapper structure for all
 * dashboard pages. Does NOT re-wrap in ThemeProvider or TimeRangeProvider
 * since the root layout already provides those.
 *
 * The (dashboard) route group doesn't add a URL segment — pages render
 * at /, /agents, /policies, /costs, /audit, /settings.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />

      {/* Main content area */}
      <main
        className="content-area flex-1 overflow-y-auto bg-[var(--color-bg-primary)]"
        role="main"
        aria-label="Dashboard content"
      >
        <div className="mx-auto max-w-[2560px] p-[var(--content-padding,24px)]">
          {children}
        </div>
      </main>
    </div>
  );
}

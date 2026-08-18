import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { TimeRangeProvider } from '@/providers/TimeRangeProvider';

export const metadata: Metadata = {
  title: 'TealTiger Governance Dashboard',
  description: 'Real-time operational visibility into the TealTiger multi-stage defense pipeline',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] antialiased">
        <ThemeProvider>
          <TimeRangeProvider>{children}</TimeRangeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

'use client';

import { HeaderBar } from '@/components/HeaderBar/HeaderBar';
import { KPIBannerRow } from '@/components/KPIBanner/KPIBannerRow';
import { ChartsRow } from '@/components/ChartsRow/ChartsRow';
import { MidDetailRow } from '@/components/MidDetailRow/MidDetailRow';
import { BottomDetailRow } from '@/components/BottomDetailRow/BottomDetailRow';

/**
 * Overview page — default route for the (dashboard) group.
 * Renders at the root URL path: /
 *
 * Composes all dashboard row components in vertical sequence:
 * HeaderBar → KPIBannerRow → ChartsRow → MidDetailRow → BottomDetailRow
 *
 * The parent layout.tsx provides:
 * - role="main" on the <main> element (Requirement 15.3)
 * - max-w-[2560px] on the inner wrapper (Requirement 2.4)
 * - overflow-y-auto for vertical scrolling (Requirement 2.5)
 * - Content padding via var(--content-padding)
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 9.1, 9.4, 15.3
 */
export default function OverviewPage() {
  return (
    <div className="flex flex-col gap-[var(--row-gap,20px)]">
      <HeaderBar title="Overview" />
      <KPIBannerRow />
      <ChartsRow />
      <MidDetailRow />
      <BottomDetailRow />
    </div>
  );
}

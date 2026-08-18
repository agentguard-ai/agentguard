'use client';

import { useCachedQuery } from '@/hooks/useCachedQuery';
import { SkeletonLoader } from '@/components/SkeletonLoader';

interface CostSummary {
  session: { total: number; budget: number | null; utilization: number | null };
  daily: { total: number; budget: number | null; utilization: number | null };
  agent: { total: number; budget: number | null; utilization: number | null };
}

interface CostBreakdown {
  breakdown: { provider: string; model: string; totalCost: number; requestCount: number }[];
}

interface CostSavingsData {
  totalSaved: number;
  recommendations: { id: string; title: string; potentialSaving: number; confidence: number; status: string }[];
  monthlySavingsHistory: { month: string; saved: number }[];
}

function formatDollar(val: number) {
  return `$${val.toFixed(2)}`;
}

function UtilizationBar({ label, total, budget, utilization }: { label: string; total: number; budget: number | null; utilization: number | null }) {
  const pct = utilization != null ? Math.round(utilization * 100) : 0;
  const barColor = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-[var(--color-accent,#14b8a6)]';

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-[var(--color-text-secondary)]">{label}</span>
        <span className="text-[var(--color-text-primary)] font-medium">{formatDollar(total)} {budget ? `/ ${formatDollar(budget)}` : ''}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-[var(--color-bg-tertiary,#1e293b)] overflow-hidden">
        <div className={`h-full rounded-full ${barColor} transition-all duration-300`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-[var(--color-text-secondary)]">{pct}% consumed</span>
    </div>
  );
}

/**
 * Costs page — cost analytics with budget utilization, provider breakdown, and savings.
 */
export default function CostsPage() {
  const { data: summary, isLoading: summaryLoading } = useCachedQuery<CostSummary>({
    endpoint: '/api/v1/costs/summary',
  });

  const { data: breakdown } = useCachedQuery<CostBreakdown>({
    endpoint: '/api/v1/costs/breakdown',
  });

  const { data: savings } = useCachedQuery<CostSavingsData>({
    endpoint: '/api/v1/costs/savings',
  });

  return (
    <div className="flex flex-col gap-[var(--row-gap,20px)]">
      <h1 className="text-2xl font-semibold">Cost Analytics</h1>

      {summaryLoading && !summary && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <SkeletonLoader key={i} variant="kpi-card" />)}
        </div>
      )}

      {/* Budget Utilization */}
      {summary && (
        <section className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[var(--color-bg-secondary,#111827)] p-5">
          <h2 className="text-sm font-semibold mb-4 text-[var(--color-text-primary)]">Budget Utilization</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <UtilizationBar label="Session" total={summary.session.total} budget={summary.session.budget} utilization={summary.session.utilization} />
            <UtilizationBar label="Daily" total={summary.daily.total} budget={summary.daily.budget} utilization={summary.daily.utilization} />
            <UtilizationBar label="Agent (All-time)" total={summary.agent.total} budget={summary.agent.budget} utilization={summary.agent.utilization} />
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Provider Breakdown */}
        {breakdown && (
          <section className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[var(--color-bg-secondary,#111827)] p-5">
            <h2 className="text-sm font-semibold mb-4 text-[var(--color-text-primary)]">Cost by Provider & Model</h2>
            <div className="space-y-3">
              {breakdown.breakdown.map((row, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-[rgba(255,255,255,0.05)] last:border-0">
                  <div className="flex flex-col">
                    <span className="text-sm text-[var(--color-text-primary)]">{row.provider}</span>
                    <span className="text-xs text-[var(--color-text-secondary)]">{row.model}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">{formatDollar(row.totalCost)}</span>
                    <span className="text-xs text-[var(--color-text-secondary)]">{row.requestCount} requests</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Savings */}
        {savings && (
          <section className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[var(--color-bg-secondary,#111827)] p-5">
            <h2 className="text-sm font-semibold mb-1 text-[var(--color-text-primary)]">Cost Optimization</h2>
            <p className="text-xs text-emerald-400 mb-4">Total saved: {formatDollar(savings.totalSaved)}</p>
            <div className="space-y-3">
              {savings.recommendations.map((rec) => (
                <div key={rec.id} className="flex items-start gap-3 py-2 border-b border-[rgba(255,255,255,0.05)] last:border-0">
                  <span className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${rec.status === 'applied' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--color-text-primary)] truncate">{rec.title}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      Save ~{formatDollar(rec.potentialSaving)}/mo • {Math.round(rec.confidence * 100)}% confidence
                    </p>
                  </div>
                  <span className={`text-[10px] font-medium uppercase ${rec.status === 'applied' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {rec.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

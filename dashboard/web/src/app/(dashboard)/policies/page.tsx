'use client';

import { useCachedQuery } from '@/hooks/useCachedQuery';
import { SkeletonLoader } from '@/components/SkeletonLoader';

interface Protocol {
  id: string;
  name: string;
  description: string;
  mode: 'ENFORCE' | 'MONITOR' | 'REPORT_ONLY';
  evaluationsToday: number;
  denials: number;
  status: 'active' | 'disabled';
}

function ModeBadge({ mode }: { mode: Protocol['mode'] }) {
  const styles: Record<string, string> = {
    ENFORCE: 'bg-red-500/15 text-red-400 border-red-500/30',
    MONITOR: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    REPORT_ONLY: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  };

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${styles[mode]}`}>
      {mode.replace('_', ' ')}
    </span>
  );
}

/**
 * Policies page — governance protocol status and enforcement configuration.
 */
export default function PoliciesPage() {
  const { data, isLoading, error } = useCachedQuery<Protocol[]>({
    endpoint: '/api/v1/governance/protocols',
  });

  return (
    <div className="flex flex-col gap-[var(--row-gap,20px)]">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Governance Policies</h1>
        {data && (
          <span className="text-sm text-[var(--color-text-secondary)]">
            {data.length} policies active
          </span>
        )}
      </div>

      {isLoading && !data && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <SkeletonLoader key={i} variant="kpi-card" />)}
        </div>
      )}

      {error && !data && (
        <p className="text-sm text-red-400">Failed to load policy data</p>
      )}

      {data && (
        <div className="space-y-3">
          {data.map((policy) => (
            <article
              key={policy.id}
              className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[var(--color-bg-secondary,#111827)] p-5 flex items-center gap-4"
            >
              {/* Status dot */}
              <span className={`h-3 w-3 rounded-full shrink-0 ${policy.status === 'active' ? 'bg-emerald-400' : 'bg-gray-500'}`} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary,#f9fafb)]">
                    {policy.name}
                  </h3>
                  <ModeBadge mode={policy.mode} />
                </div>
                <p className="text-xs text-[var(--color-text-secondary,#9ca3af)] mt-1 truncate">
                  {policy.description}
                </p>
              </div>

              {/* Stats */}
              <div className="flex gap-6 shrink-0">
                <div className="flex flex-col items-center">
                  <span className="text-lg font-bold text-[var(--color-text-primary)]">{policy.evaluationsToday}</span>
                  <span className="text-[10px] text-[var(--color-text-secondary)] uppercase tracking-wider">Evaluations</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className={`text-lg font-bold ${policy.denials > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{policy.denials}</span>
                  <span className="text-[10px] text-[var(--color-text-secondary)] uppercase tracking-wider">Denials</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

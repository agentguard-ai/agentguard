'use client';

import { useCachedQuery } from '@/hooks/useCachedQuery';
import { SkeletonLoader } from '@/components/SkeletonLoader';

interface Agent {
  id: string;
  name: string;
  status: 'active' | 'idle' | 'frozen';
  requestsLastHour: number;
  deniedLastHour: number;
  avgLatencyMs: number;
  provider: string;
  model: string;
}

interface AgentMatrixResponse {
  agents: Agent[];
  totalActive: number;
  totalFrozen: number;
  totalIdle: number;
}

function StatusBadge({ status }: { status: Agent['status'] }) {
  const styles: Record<string, string> = {
    active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    idle: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    frozen: 'bg-red-500/15 text-red-400 border-red-500/30',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === 'active' ? 'bg-emerald-400' : status === 'idle' ? 'bg-amber-400' : 'bg-red-400'}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

/**
 * Agents page — displays the agent matrix with status, activity, and provider info.
 */
export default function AgentsPage() {
  const { data, isLoading, error } = useCachedQuery<AgentMatrixResponse>({
    endpoint: '/api/v1/agents/matrix',
  });

  return (
    <div className="flex flex-col gap-[var(--row-gap,20px)]">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Agents</h1>
        {data && (
          <div className="flex gap-4 text-sm">
            <span className="text-emerald-400">{data.totalActive} Active</span>
            <span className="text-amber-400">{data.totalIdle} Idle</span>
            <span className="text-red-400">{data.totalFrozen} Frozen</span>
          </div>
        )}
      </div>

      {isLoading && !data && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <SkeletonLoader key={i} variant="kpi-card" />)}
        </div>
      )}

      {error && !data && (
        <p className="text-sm text-red-400">Failed to load agent data</p>
      )}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.agents.map((agent) => (
            <article
              key={agent.id}
              className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[var(--color-bg-secondary,#111827)] p-5 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary,#f9fafb)]">
                  {agent.name}
                </h3>
                <StatusBadge status={agent.status} />
              </div>

              <div className="text-xs text-[var(--color-text-secondary,#9ca3af)]">
                {agent.provider} / {agent.model}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[rgba(255,255,255,0.06)]">
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-[var(--color-text-primary)]">{agent.requestsLastHour}</span>
                  <span className="text-[10px] text-[var(--color-text-secondary)] uppercase tracking-wider">Requests/hr</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-[var(--color-text-primary)]">{agent.deniedLastHour}</span>
                  <span className="text-[10px] text-[var(--color-text-secondary)] uppercase tracking-wider">Denied</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-[var(--color-text-primary)]">{agent.avgLatencyMs}ms</span>
                  <span className="text-[10px] text-[var(--color-text-secondary)] uppercase tracking-wider">Avg Latency</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

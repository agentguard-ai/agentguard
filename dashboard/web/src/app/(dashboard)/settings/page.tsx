'use client';

/**
 * Settings page — system configuration.
 */
export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-[var(--row-gap,20px)]">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* General Settings */}
        <section className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[var(--color-bg-secondary,#111827)] p-5">
          <h2 className="text-sm font-semibold mb-4 text-[var(--color-text-primary)]">General</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--color-text-primary)]">Platform Version</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Current TealTiger SDK version</p>
              </div>
              <span className="text-sm font-mono text-[var(--color-accent,#14b8a6)]">v1.4.0</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--color-text-primary)]">API Endpoint</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Dashboard API connection</p>
              </div>
              <span className="text-sm font-mono text-[var(--color-text-secondary)]">localhost:3100</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--color-text-primary)]">Authentication</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Auth mode for API access</p>
              </div>
              <span className="text-xs rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-2.5 py-0.5 font-medium">None (Dev)</span>
            </div>
          </div>
        </section>

        {/* Governance Settings */}
        <section className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[var(--color-bg-secondary,#111827)] p-5">
          <h2 className="text-sm font-semibold mb-4 text-[var(--color-text-primary)]">Governance Configuration</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--color-text-primary)]">Default Policy Mode</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Fallback mode for new policies</p>
              </div>
              <span className="text-xs rounded-full bg-red-500/15 border border-red-500/30 text-red-400 px-2.5 py-0.5 font-medium">ENFORCE</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--color-text-primary)]">Failure Policy</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Behavior when governance module errors</p>
              </div>
              <span className="text-sm text-[var(--color-text-primary)]">Fail-Closed</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--color-text-primary)]">Monthly Budget</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Organization spend limit</p>
              </div>
              <span className="text-sm font-mono text-[var(--color-text-primary)]">$500.00</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--color-text-primary)]">Velocity Alert Threshold</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Cost burn rate warning trigger</p>
              </div>
              <span className="text-sm font-mono text-[var(--color-text-primary)]">$10.00/hr</span>
            </div>
          </div>
        </section>

        {/* Provider Configuration */}
        <section className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[var(--color-bg-secondary,#111827)] p-5">
          <h2 className="text-sm font-semibold mb-4 text-[var(--color-text-primary)]">Configured Providers</h2>
          <div className="space-y-2">
            {['OpenAI', 'Anthropic', 'Google (Gemini)', 'AWS Bedrock', 'Azure OpenAI', 'Cohere', 'Mistral', 'Groq', 'DeepSeek', 'Together AI', 'HuggingFace TGI', 'xAI (Grok)'].map((provider) => (
              <div key={provider} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-[var(--color-text-primary)]">{provider}</span>
                <span className="h-2 w-2 rounded-full bg-emerald-400" title="Connected" />
              </div>
            ))}
          </div>
        </section>

        {/* Observe Mode (v1.4) */}
        <section className="rounded-lg border border-[var(--color-accent,#14b8a6)]/30 bg-[var(--color-bg-secondary,#111827)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Observe Mode</h2>
            <span className="text-[10px] rounded-full bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/30 text-[var(--color-accent)] px-2 py-0.5 font-medium">NEW in v1.4</span>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--color-text-primary)]">Status</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Zero-config behavioral observation</p>
              </div>
              <span className="text-xs rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-2.5 py-0.5 font-medium">Active</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--color-text-primary)]">Freeze on Anomaly</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Auto-freeze agents on drift detection</p>
              </div>
              <span className="text-sm text-[var(--color-text-primary)]">Enabled</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--color-text-primary)]">PII Scanning</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Scan prompts/responses for PII</p>
              </div>
              <span className="text-sm text-[var(--color-text-primary)]">Enabled</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--color-text-primary)]">Cost Accumulation</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Track spend per observed client</p>
              </div>
              <span className="text-sm text-[var(--color-text-primary)]">Enabled</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

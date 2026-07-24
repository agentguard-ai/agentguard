# Changelog

All notable changes to TealTiger are documented in this file.

## [1.4.0] — 2026-07-09

### Added

- **`observe(client)`** — Zero-config proxy wrapping for 12 LLM providers (OpenAI, Anthropic, Gemini, Bedrock, Azure OpenAI, Cohere, Mistral, DeepSeek, Groq, xAI, Together, HF-TGI)
- **Automatic Cost Tracking** — Per-request, per-session, per-agent cost accumulation across all providers
- **Behavioral Baseline** — Statistical profiling (P50/P95/P99 latency, token distribution, cost patterns) built from first 100 requests
- **PII Detection (REPORT_ONLY)** — Passive PII scanning without blocking in observe mode
- **`freeze()` / `unfreeze()`** — Instant kill switch to halt any agent immediately, zero policy required
- **Governance Dashboard** — Redesigned Overview page with light content area, color-coded KPI cards, defense pipeline flow, canary alerts, agent matrix, cost savings, model routing, protocol governance panels
- **Widget Error Isolation** — Each dashboard panel renders independently; single API failure never cascades

### Changed

- `ObserveCostSummary` type renamed from `CostSummary` (in observe module) to avoid conflict with cost module's `CostSummary`
- Integration packages dependency bumped to `tealtiger>=1.4.0`
- Dashboard API demo stubs updated with `/api/v1/costs/velocity`, `/api/v1/costs/budget-forecast` endpoints
- Pipeline flow API response updated to include `tokenRange` and `metrics` per stage

### Fixed

- TypeScript SDK duplicate `CostSummary` export causing compile error
- Unused `SupportedProvider` import in `provider-detector.ts`
- Dashboard `/costs` page crash when `totalSaved` field missing from API response


## [1.3.0] — 2026-05-18

### Added
- **TealEngine v1.3** — Pre/post evaluation pipeline with sequential short-circuit stages
- **Automation Levels** — `auto_allow`, `auto_deny`, `auto_sanitize`, `approval_required`
- **FREEZE Rules** — Immutable emergency kill switches with tamper detection
- **PLAN_ONLY Mode** — Block side-effects while allowing read-only operations
- **Policy Hot-Swap** — Live bundle replacement with validation and rollback
- **Anti-Tamper Controls** — Signed bundles, forbidden config key rejection, workload identity binding
- **Non-Human Identity (NHI)** — Agent lifecycle management (active, suspended, revoked), scope enforcement, Zero Standing Privilege (JIT grants), agent attestation
- **TealProof** — Cryptographic governance receipts using Merkle trees + RFC 3161 timestamping, Governance Passport, standalone Verification SDK
- **TealFlow** — Declarative YAML governance workflows with org-level inheritance and floor enforcement
- **TealClassifier** — Local ONNX-based ML inference for content classification (≤20ms, deterministic)
- **TealDrift** — Behavioral drift detection with statistical baselines and min_samples guard
- **TealState** — Context size governance with provenance metadata and mutation governance
- **TealTemporal** — Session TTL enforcement, cooldown periods, time-of-day restrictions
- **TealMonitor v2** — Governance-owned cost ceilings, anomaly detection, reasoning-token budgets, per-agent/per-workflow attribution
- **TealGuard v2** — Unicode normalization stripping, encoded output detection, control character sanitization, markdown exfiltration detection, multimodal input governance
- **TealMemory v2** — Write provenance tagging with transitive propagation, instruction injection detection, exfiltration prevention
- **TealRegistry v2** — MCP definition-drift monitoring, tool description injection scanning, adapter composition allowlist
- **OWASP Agentic Top 10 Policy Pack** — Zero-config governance for all 10 ASI risks
- **SOC/IR Pipeline** — SIEM export (JSON, CEF, LEEF), OpenTelemetry spans, response hooks with dedup and rate limiting
- **TEEC v2.0.0** — Enhanced evidence envelopes with NHI identity, proof, cost evidence, OWASP category
- **Secure Change Governance** — CODE_CHANGE action class with path/branch allowlists and two-person rule
- **Platform Adapters** — AWS Bedrock Agents, AWS AgentCore, Azure AI Agent Service
- **5 New Providers** — DeepSeek, Groq, Together AI, HuggingFace TGI, xAI (Grok) — total 12
- **GovernanceProvider Interface** — Portable, versioned evaluation context schema
- **Backward Compatibility** — v1.2 configs produce identical behavior, all new fields optional
- **Full Python SDK Parity** — All v1.3 modules ported with identical schemas and decisions
- **Governance Documentation** — Enterprise operating model, persona definitions, RACI matrix, policy lifecycle, audit guides
- **Reasoning-Trace Governance** — PII and secret redaction in chain-of-thought traces
- **OPA-Compatible Rego Export** — Export governance policies to OPA Rego format

### Changed
- TealEngine evaluation pipeline now supports pre-evaluation and post-evaluation stages
- Cost tracking uses longest-prefix model matching for accurate pricing
- Provider count increased from 7 to 12 (95%+ market coverage)

### Fixed
- GPT-4 Turbo preview models now use correct Turbo pricing instead of GPT-4 pricing

---

## [1.2.0] — 2026-05 — Governance Bundle

### Added
- TealEngineV12 — Parallel module evaluation with "most restrictive action wins" merge
- TealSecrets — Secret detection (500+ patterns, 9 categories, confidence scoring)
- TealRegistry — Model/tool allowlisting with provenance verification
- TealReliability — Retry budgets, circuit breakers, fallback chains
- TealMemory — Memory governance (5 scopes, 4 classifications)
- GovernanceDashboard — Governance visibility UI
- BundleExporter — SARIF v2.1.0, JUnit XML, JSON evidence export
- Docker governance sidecar (language-agnostic HTTP API)
- TEEC v1.0 evidence contract (32 reason codes, 18 event types, 12 decision actions)

---

## [1.1.1] — 2026-04 — Stability & Multi-Provider Parity

### Added
- Python SDK feature parity with TypeScript (7/7 providers)
- Documentation fixes and Apache 2.0 license update

---

## [1.1.0] — 2026-03 — Foundation Release

### Added
- TealEngine — Deterministic policy evaluation
- TealGuard — PII detection, prompt injection, content moderation
- TealMonitor — Cost tracking and budget management
- TealCircuit — Circuit breaker for failure isolation
- TealAudit — Audit logging with correlation IDs
- 7 LLM providers (OpenAI, Anthropic, Gemini, Bedrock, Azure OpenAI, Cohere, Mistral)
- Policy test harness with JUnit XML export
- Three policy modes (ENFORCE, MONITOR, REPORT_ONLY)

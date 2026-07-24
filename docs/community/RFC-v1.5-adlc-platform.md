# RFC: TealTiger v1.5 — Agent Development Lifecycle (ADLC) Governance Platform

**Status:** Draft — Seeking Community Feedback  
**Authors:** TealTiger Core Team  
**Created:** July 12, 2026  
**Target Release:** Q4 2026  
**Discussion:** [GitHub Discussions](https://github.com/agentguard-ai/tealtiger/discussions)

---

## Summary

TealTiger v1.5 transforms the project from a **governance SDK** into a **full Agent Development Lifecycle (ADLC) Governance Platform** — covering all six phases of building production AI agents with **defense-in-depth governance across 3 architectural levels**:

**Build → Test → Deploy → Monitor → Iterate → Govern**

**3 Governance Levels:**
```
┌─────────────────────────────────────────────────────────┐
│       Level 3: CENTRAL CONTROL PLANE                    │
│  Dashboard · Fleet Mgmt · Policy Distribution · RBAC    │
├─────────────────────────────────────────────────────────┤
│       Level 2: AGENT (Infrastructure Governance)        │
│  K8s · Docker Runtime · OS/Kernel · eBPF · Network      │
├─────────────────────────────────────────────────────────┤
│       Level 1: SDK (Application Governance)             │
│  In-process · observe() · TealGuard · Cost · PII        │
└─────────────────────────────────────────────────────────┘
```

We're publishing this RFC to invite community feedback on scope, priorities, API design, and use cases before implementation begins.

---

## Motivation

v1.4 established TealTiger's governance core: `observe()` zero-config adoption, deterministic policy enforcement, multi-stage defense, cost governance, 12-provider support, and cross-framework adapters (LangChain, CrewAI, Haystack, Strands, AG2).

But teams building agents in production consistently tell us the same thing:

> "Governance is table stakes. What we actually need is the full lifecycle — testing governance policies before deployment, understanding what's happening across 50+ agents, iterating on policies with data instead of guessing, and proving compliance to auditors."

v1.5 fills these gaps while maintaining TealTiger's core principles:
- **Deterministic** — no LLM in the governance path
- **In-process** — no mandatory external service
- **< 5ms overhead** — governance never becomes the bottleneck
- **Framework-agnostic** — works with any agent framework

---

## Architecture: 3 Levels of Governance (Defense-in-Depth)

Just as container security platforms (Aqua, Prisma Cloud) defend at multiple layers, TealTiger v1.5 introduces defense-in-depth governance across three architectural levels:

### Level 1: SDK Governance (Application Layer)

**What:** In-process, in-code governance embedded inside the agent application.  
**Where it runs:** Inside the agent process — no sidecar, no proxy.  
**What it governs:** LLM calls, tool invocations, cost budgets, PII, prompts, kill switch.  
**Status:** This is TealTiger today (v1.0–v1.4).

```python
from tealtiger import observe
client = observe(OpenAI())  # Immediate governance — zero config
```

### Level 2: Agent Infrastructure Governance (Infra Layer)

**What:** Infrastructure-level enforcement for the compute environment where agents run. Purpose-built for AI agent workloads — like Aqua/Prisma Cloud, but for agents.  
**Where it runs:** K8s admission controllers, Docker runtime hooks, eBPF probes, OS-level syscall filters.  
**What it governs:**

| Boundary | Governance Capabilities |
|----------|------------------------|
| **Kubernetes** | Admission control (approved agent images only), network policies (restrict API egress), resource quotas (CPU/memory/GPU per agent), pod security standards |
| **Docker/Container** | Read-only filesystems, blocked egress endpoints, process spawn limits, mount restrictions, runtime scanning |
| **OS/Kernel** | Seccomp profiles for agent processes, eBPF-based network monitoring, file access auditing, syscall allowlisting |
| **Network** | Service mesh integration, mTLS between agents, API gateway policies for agent-to-agent communication, egress allowlists |

```yaml
# TealTiger K8s AdmissionPolicy
apiVersion: tealtiger.ai/v1
kind: AgentPolicy
metadata:
  name: research-agent-boundary
spec:
  selector:
    matchLabels:
      tealtiger.ai/role: researcher
  network:
    egressAllow: ["api.openai.com", "api.anthropic.com"]
    egressDeny: ["*"]
  resources:
    maxCostPerHour: 10.00
    maxMemoryMb: 2048
  filesystem:
    readOnly: true
    allowedPaths: ["/workspace/data/**"]
  runtime:
    blockedSyscalls: ["execve", "fork"]
    maxProcesses: 5
```

### Level 3: Central Control Plane (Management Layer)

**What:** Single pane of glass that manages governance across all agents, all environments, all levels. Extension of the existing TealTiger dashboard into a full fleet management + policy distribution platform.  
**Where it runs:** Centralized service (self-hosted or cloud-hosted).  
**What it manages:**

- **Policy Distribution** — Author policies centrally, push to SDK agents + K8s clusters + Docker hosts simultaneously
- **Fleet Visibility** — Agent registry showing all agents across all levels with health, cost, compliance posture
- **Cross-Level Correlation** — SDK denial + infra network block = correlated incident (not two separate alerts)
- **Kill Switch Propagation** — `freeze("*")` propagates from control plane → SDK level + infra level simultaneously
- **RBAC & SSO** — Team-scoped access, custom roles, SAML/OIDC
- **Compliance Reporting** — Board-ready reports aggregating evidence from all 3 levels
- **Policy A/B Testing** — Test policy changes across the entire stack before promoting
- **Governance Regression** — CI/CD gate that validates policy changes don't break across any level

### How the 3 Levels Work Together

```
┌─────────────────────────────────────────────┐
│         Central Control Plane               │
│  Push policies │ Collect telemetry │ Alert  │
└───────┬─────────────────────────┬───────────┘
        │                         │
        ▼                         ▼
┌───────────────┐       ┌─────────────────────┐
│  Level 1: SDK │       │  Level 2: Infra     │
│  (in-process) │       │  (K8s/Docker/OS)    │
│               │       │                     │
│ • PII scan    │       │ • Network boundary  │
│ • Cost limit  │       │ • Syscall filter    │
│ • Tool allow  │       │ • Resource quota    │
│ • Kill switch │       │ • Image admission   │
└───────────────┘       └─────────────────────┘
        │                         │
        └─────────┬───────────────┘
                  ▼
         [Agent Process in Pod]
```

**Example: Coordinated Defense**

1. Agent tries to exfiltrate data via `curl` to external endpoint
2. **Level 1 (SDK):** TealGuard detects PII in the tool call arguments → blocks at application layer
3. **Level 2 (Infra):** Even if SDK is bypassed, K8s network policy blocks egress to unapproved endpoint
4. **Level 3 (Control Plane):** Correlates both signals, triggers alert, auto-freezes the agent fleet-wide

**Open questions:**
- Should Level 2 be delivered as a Helm chart, an operator, or both?
- Which eBPF-based capabilities are highest priority? (network monitoring vs. syscall filtering vs. file access)
- Should the control plane be self-hosted only, or offer a managed cloud option?

---

## Proposed Features

### 🧪 TEST Phase

#### 1. Governance Eval Dataset Builder

Automatically harvest denied/flagged production traces and turn them into reusable regression test fixtures. Run governance regression against any policy version in CI/CD.

```python
# Promote a production denial to the regression dataset
platform.promote_to_eval(decision_id="abc-123")

# Run regression against a new policy version
results = platform.run_governance_regression(
    dataset="production_denials_q3",
    policy=new_policy_v2
)
# → Reports which decisions changed (allow↔deny)
```

**Open questions:**
- Should auto-promotion require a review period? (Proposed: 7 days)
- What's the right threshold for auto-harvesting? (Proposed: risk_score > 0.7)

#### 2. Multi-Turn Governance Simulation

Test governance across full agent conversations — not just single tool calls. Simulate escalation chains, delegation, retry storms, and multi-step workflows.

```python
simulator = GovernanceSimulator(policy=my_policy)
report = simulator.run(trajectory=[
    {"agent": "researcher", "action": "search_db", "args": {...}},
    {"agent": "researcher", "action": "delegate_to", "target": "writer"},
    {"agent": "writer", "action": "generate_report", "args": {...}},
    {"agent": "writer", "action": "send_email", "args": {...}},  # Should this be denied?
])
```

**Open questions:**
- What pre-built scenarios would be most useful? (Proposed: retry storms, privilege escalation, budget exhaustion, PII exfiltration, delegation chain abuse)
- Should the simulator support real LLM calls or only scripted trajectories?

---

### 🔄 ITERATE Phase

#### 3. Policy A/B Testing

Run two policy versions on split traffic. Compare allow/deny rates, false positives, and cost impact with real production data.

```python
experiment = platform.create_experiment(
    name="stricter_pii_policy",
    primary=current_policy,
    alternate=proposed_policy,
    traffic_split=0.1,  # 10% sees alternate
    duration_days=7
)
# After 7 days: experiment.report() shows comparison
```

**Open questions:**
- Should the alternate policy be "shadow" (record-only) or optionally enforced on split traffic?
- What's the minimum sample size before a recommendation is statistically significant?

#### 4. Production-to-Eval Automated Loop

Continuous pipeline: Production anomalies → Candidate fixtures → Auto-promotion → Regression dataset → CI/CD gate.

```
Production traces
    ↓ (anomaly detection: denial spikes, new reason codes)
Candidate eval fixtures
    ↓ (7-day review period)
Active regression dataset
    ↓ (runs on every policy PR)
CI/CD governance gate (pass/fail)
```

**Open questions:**
- Should anomaly detection be configurable per team, or global?
- What SLA should we target for the loop latency (trace → candidate)?

---

### 🏗️ BUILD Phase

#### 5. Prompt and Context Governance

Govern what goes INTO the agent — not just what comes out. New `pre_inference` phase catches prompt injection, context poisoning, and memory manipulation before the LLM sees them.

```python
guardrails = {
    "pre_inference": {"injection": "block", "context_poisoning": "block"},
    "pre": {"pii": "block", "cost": "enforce"},
    "post": {"secrets": "block", "harmful_content": "monitor"}
}
```

**Open questions:**
- How aggressive should default injection detection be? (Trade-off: false positives vs. security)
- Should context allowlisting be per-retrieval-source or per-content-pattern?

#### 6. No-Code Governance Builder

Visual policy builder for compliance officers. Natural language → policy rule generation. Template marketplace for SOC2, HIPAA, GDPR, PCI-DSS.

```
"Block all tool calls that access customer PII unless the agent has admin role"
    ↓ (auto-generates)
{type: "pii_block", categories: ["ssn", "credit_card"], except_roles: ["admin"]}
```

**Open questions:**
- Should the NL→policy generator use a local model or cloud? (Trade-off: determinism vs. flexibility)
- What governance templates would you use first? (SOC2? HIPAA? Custom?)

---

### 🏛️ GOVERN Phase

#### 7. Agent Registry and Discovery

Central registry of all governed agents. See roles, policies, cost, health, and governance posture across your fleet. Flag ungoverned agents.

| Agent | Role | Framework | Mode | Cost (7d) | Denial Rate | Health |
|-------|------|-----------|------|-----------|-------------|--------|
| research-bot | researcher | LangChain | ENFORCE | $12.40 | 2.1% | ✅ |
| writer-agent | writer | CrewAI | OBSERVE | $8.70 | 0% | ⚠️ No policies |
| code-executor | admin | Strands | ENFORCE | $45.20 | 8.4% | ✅ |

**Open questions:**
- Should discovery be automatic (via observe mode) or require explicit registration?
- What governance readiness score dimensions matter most to you?

---

### 📊 MONITOR Phase

#### 8. Native Governance Trace Viewer

End-to-end trace viewer independent of Langfuse/AgentOps. See pre-inference → LLM → tool → output governance in one timeline. Supports replay against new policies.

#### 9. Feedback Collection API

Link user feedback to governance decisions. Surface false positive patterns where governance is hurting UX.

```python
platform.submit_feedback(
    trace_id="xyz-456",
    rating="negative",
    comment="I needed this tool call to work for my use case"
)
# → Surfaces as potential false positive for policy review
```

---

### 🚀 DEPLOY Phase

#### 10. Sandbox Governance

Govern agent behavior inside sandboxed execution (Daytona, E2B, Docker). Scan code for destructive operations, network exfiltration, and resource exhaustion before execution.

```python
sandbox_policy = {
    "allowed_paths": ["/workspace/**"],
    "blocked_commands": ["rm -rf", "DROP TABLE", "curl"],
    "max_execution_time": 30,
    "max_memory_mb": 512
}
```

**Open questions:**
- Which sandbox providers should we support first? (Proposed: Daytona, E2B, Docker)
- Should sandbox governance be synchronous (block before exec) or async (kill after violation)?

---

### 📈 ANALYTICS & REPORTING

#### 11. Rich Analytics Engine
Custom queries, time-series aggregation, cohort analysis, top-N analysis, saved queries, BI tool integration (Looker, Metabase, Grafana).

#### 12. Historical Trends
7/30/90-day governance trends, WoW/MoM comparisons, anomaly detection, governance health score trending.

#### 13. User and Team Management
RBAC, SSO (SAML/OIDC), team hierarchy, per-team cost allocation, custom roles, API key management.

#### 14. Interactive Agent Trajectory DAG
Visualize multi-agent workflows as interactive graphs. Step-through replay, governance intervention highlighting, what-if overlay.

#### 15. Compliance Reporting
Scheduled PDF/CSV reports, SOC2 evidence packaging, board-ready one-page governance summaries.

---

### 🌐 WEBSITE

#### 16. Cost of Ungoverned AI Calculator
Interactive calculator showing projected burn without governance vs. with governance. Shareable via URL.

#### 17. Board-Ready AI Governance Report
One-page PDF for C-suite. Business terms only — dollars, percentages, risk levels. No jargon.

---

## Design Principles

1. **Progressive disclosure** — Each feature works standalone. You adopt what you need.
2. **Deterministic governance** — No LLM in the decision path. Same input → same output. Always.
3. **Framework-agnostic** — Works with LangChain, CrewAI, Haystack, Strands, AG2, custom code.
4. **Self-hosted first** — Everything runs in your infra. No mandatory SaaS.
5. **Open source** — Apache 2.0. No open-core bait-and-switch.

---

## What We Need From You

We're looking for feedback on:

1. **Priority ranking** — Which features would you use first? What's missing?
2. **API design** — Do the proposed interfaces feel right for your workflow?
3. **Use cases** — What governance scenarios are you struggling with today that v1.5 should solve?
4. **Trade-offs** — Where should we prioritize simplicity over power (or vice versa)?
5. **Integration needs** — What tools/platforms should v1.5 integrate with that aren't listed?

---

## How to Provide Feedback

- **GitHub Discussion:** Comment on this RFC in [GitHub Discussions](https://github.com/agentguard-ai/tealtiger/discussions) (preferred)
- **GitHub Issues:** File a feature request with the `rfc-v1.5` label
- **Email:** feedback@tealtiger.ai
- **Discord:** [TealTiger Community](https://discord.gg/tealtiger)

---

## Timeline (Proposed)

| Phase | Target | Focus |
|-------|--------|-------|
| RFC feedback period | Jul–Aug 2026 | Community input, priority refinement |
| Alpha (core features) | Sep 2026 | Eval dataset, trace viewer, agent registry |
| Beta (full platform) | Oct 2026 | All features, integration testing |
| GA release | Nov 2026 | Production-ready v1.5.0 |

---

## Prior Art and Acknowledgments

This RFC draws inspiration from:
- [Weights & Biases](https://wandb.ai/) — experiment tracking and evaluation datasets
- [LaunchDarkly](https://launchdarkly.com/) — feature flags and A/B testing patterns
- [Datadog](https://www.datadoghq.com/) — APM trace visualization
- [OpenTelemetry](https://opentelemetry.io/) — observability standards
- [Haystack](https://haystack.deepset.ai/) / [LangSmith](https://smith.langchain.com/) — agent evaluation approaches

---

*TealTiger is open-source AI agent security. Deterministic governance, no LLM in the governance path, 95%+ provider coverage.*

**GitHub:** [github.com/agentguard-ai/tealtiger](https://github.com/agentguard-ai/tealtiger)  
**Docs:** [docs.tealtiger.ai](https://docs.tealtiger.ai)  
**Blog:** [blogs.tealtiger.ai](https://blogs.tealtiger.ai)

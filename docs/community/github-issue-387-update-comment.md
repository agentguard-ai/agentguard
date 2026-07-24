## Update: 3-Level Defense-in-Depth Governance Architecture

We've added a major architectural dimension to this RFC — **3 levels of governance**, inspired by how Aqua Security and Palo Alto Prisma Cloud provide defense-in-depth for container workloads.

```
┌─────────────────────────────────────────────────────────┐
│       Level 3: CENTRAL CONTROL PLANE                    │
│  Dashboard · Fleet Mgmt · Policy Distribution · RBAC    │
│  Cross-level correlation · Kill switch propagation      │
├─────────────────────────────────────────────────────────┤
│       Level 2: AGENT (Infrastructure Governance)        │
│  K8s Admission Control · Docker Runtime Policies        │
│  OS/Kernel Seccomp · eBPF Network/File Monitoring       │
│  Network Boundaries · Resource Quotas                   │
├─────────────────────────────────────────────────────────┤
│       Level 1: SDK (Application Governance)             │
│  In-process · observe() · TealGuard · Cost · PII        │
│  Tool allowlisting · Kill switch · Audit log            │
│  (TealTiger v1.0–v1.4 — what exists today)              │
└─────────────────────────────────────────────────────────┘
```

### Level 1: SDK Governance (Application Layer)
In-process governance inside the agent. This is TealTiger today — `observe()`, TealGuard, cost tracking, PII detection, kill switch. No external service required.

### Level 2: Agent Infrastructure Governance (K8s / Docker / OS)
Infrastructure-level enforcement — like Aqua/Prisma Cloud, but purpose-built for AI agent workloads:

- **Kubernetes**: Admission controller (approved images only), NetworkPolicy (restrict API egress), ResourceQuota (per-agent limits), CRD-based `AgentPolicy`
- **Docker/Container**: Read-only filesystems, blocked binaries, egress allowlists, process limits
- **OS/Kernel**: Seccomp profiles (syscall allowlisting), eBPF-based network monitoring, file access auditing

```yaml
# Example: TealTiger K8s AgentPolicy CRD
apiVersion: tealtiger.ai/v1
kind: AgentPolicy
spec:
  selector:
    matchLabels:
      tealtiger.ai/role: researcher
  network:
    egressAllow: ["api.openai.com", "api.anthropic.com"]
    egressDeny: ["*"]
  resources:
    maxCostPerHour: 10.00
  filesystem:
    readOnly: true
  runtime:
    blockedSyscalls: ["execve", "ptrace"]
```

### Level 3: Central Control Plane
Extension of the existing dashboard into a full fleet management platform:

- Push policies centrally → auto-distribute to SDK agents + K8s clusters
- Cross-level incident correlation (SDK denial + network block = one incident)
- Fleet-wide kill switch propagation (freeze across all levels in <5 seconds)
- Multi-cluster, multi-cloud governance view
- Self-hosted or managed cloud deployment

### Why This Matters

Nobody does this for AI agents today:
- **Lakera/Protect AI** = Level 1 only (SDK guardrails)
- **Aqua/Prisma Cloud** = Level 2 only (container security, not AI-agent aware)
- **LangSmith/Langfuse** = Monitoring only (no enforcement at any level)

TealTiger v1.5 = **first defense-in-depth governance platform specifically built for AI agents**, spanning application → infrastructure → control plane.

### Coordinated Defense Example

1. Agent attempts data exfiltration via `curl` to external endpoint
2. **Level 1 (SDK):** TealGuard detects PII in tool call → blocks at application layer
3. **Level 2 (Infra):** Even if SDK bypassed, K8s NetworkPolicy blocks egress
4. **Level 3 (Control Plane):** Correlates both signals → alerts + auto-freezes agent fleet-wide

---

**Additional feedback questions:**
- Should Level 2 be delivered as a Helm chart, a K8s operator, or both?
- Which eBPF capabilities are highest priority? (network monitoring vs. syscall filtering vs. file access)
- Should the control plane offer a managed cloud option, or self-hosted only?

Full updated RFC: https://github.com/agentguard-ai/tealtiger/issues/387

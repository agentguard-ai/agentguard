# OpenClaw Issue — TealTiger Governance Plugin

## Title

Governance plugin — deterministic tool-call authorization, PII scanning, cost budgets, and command allowlisting

---

## Summary

A plugin that evaluates deterministic governance policy before OpenClaw executes tool calls or shell commands — providing PII detection, command allowlisting, cost budget enforcement, and structured audit evidence with <2ms latency and no LLM in the governance path.

---

## Problem to solve

OpenClaw agents execute tools and shell commands autonomously. In shared infrastructure and enterprise deployments, this creates governance gaps:

1. **No pre-execution policy gate on tool calls.** When a channel plugin triggers a tool, there's no authorization layer between the LLM's decision and execution. An agent instructed via a compromised channel message can invoke destructive tools.

2. **No command allowlisting at the governance level.** The agent can run arbitrary shell commands. Sandboxing limits blast radius, but doesn't prevent the agent from executing commands that are valid-but-unauthorized (e.g., `curl` to exfiltrate data, `git push --force`, `npm publish`).

3. **No per-session cost cap.** Long-running agents (especially in always-on channels like Discord/Slack) accumulate unbounded token cost. A stuck conversation loop burns budget with no termination mechanism.

4. **No structured audit trail for compliance.** Enterprise teams need per-action evidence: what tool was called, what was evaluated, what decision was made, and what PII was present. Required for SOC2 in any environment where the agent accesses production data.

---

## Proposed solution

A **governance plugin** following OpenClaw's plugin architecture that intercepts tool/command execution:

```toml
# .openclaw/plugins/tealtiger-governance.toml
[plugin]
name = "tealtiger-governance"
version = "0.1.0"
description = "Deterministic governance — tool auth, PII scan, cost budgets"

[config]
mode = "ENFORCE"  # OBSERVE | MONITOR | ENFORCE

[config.tool_policy]
allowlist = ["search", "read_file", "list_dir", "git_diff"]
denylist = ["rm", "git_push_force", "curl", "npm_publish", "docker_exec"]

[config.command_policy]
allowlist = ["python", "pytest", "git status", "cat", "ls"]
denylist = ["rm -rf", "curl", "wget", "ssh", "nc"]
block_network = true

[config.pii]
action = "block"  # detect | redact | block
categories = ["ssn", "credit_card", "api_key", "private_key"]

[config.budget]
per_session_usd = 5.00
max_tool_calls = 100
```

**Behavior:**
- Before each tool/command execution → evaluate against policy
- ALLOW → proceed normally
- DENY → return structured denial to agent ("Governance: command `curl` is not in the allowlist for this session")
- Agent adapts (uses allowed alternative) rather than crashing
- Every evaluation emits: `{tool, args_hash, decision, findings, cost_so_far, latency_ms}`

---

## Alternatives considered

- **Prompt-level restrictions** ("never run curl") — unreliable under injection. Not auditable. Ignored in long contexts.
- **Custom spawn-interceptor modifications** — the existing `spawn-interceptor` plugin handles subprocess spawning, but doesn't evaluate policy based on content (PII in args), role-based authorization, or cumulative cost. Governance operates at a higher semantic level.
- **External proxy/firewall** — adds latency, doesn't have agent context (session cost, role, channel source), can't produce per-tool-call audit records.
- **Post-hoc log analysis** — detects violations after execution. Doesn't prevent the action.

---

## Impact

- **Affected users:** Enterprise teams deploying OpenClaw in shared infrastructure, regulated environments (fintech, healthcare), or multi-tenant platforms where agents from different channels share compute.
- **Severity:** Blocks workflow — can't deploy in SOC2/HIPAA environments without tool-call governance and audit evidence.
- **Frequency:** Every session — every tool call and command needs policy evaluation in regulated deployments.
- **Consequence:** Without governance: unauthorized data access, cost overruns ($50+ per stuck session), compliance failures, and no evidence for auditors. With governance: deterministic enforcement + structured proof of compliance.

---

## Evidence/examples

- [TealTiger](https://github.com/agentguard-ai/tealtiger) — Apache 2.0 governance SDK, already integrated with 12+ agent frameworks
- npm (TypeScript SDK): https://www.npmjs.com/package/tealtiger-ai-sdk
- Similar plugin (AG2): https://pypi.org/project/ag2-tealtiger/
- Similar plugin (Haystack): https://pypi.org/project/tealtiger-haystack/
- Supermemory already has an OpenClaw plugin — governance is a natural complement
- OpenClaw's `spawn-interceptor` plugin demonstrates the interception pattern; governance extends it with policy evaluation

---

## Do you plan to open a PR for this?

Yes — I'll build and maintain `openclaw-tealtiger-governance` as a plugin package following OpenClaw's plugin conventions. Will submit a PR once the implementation is ready.

---

## Additional information

- TealTiger evaluates in-process (<2ms), no external service required
- The plugin would be TypeScript (matching OpenClaw's stack)
- Compatible with all channel plugins (Discord, Slack, Teams, etc.) — governance applies regardless of input channel
- Kill switch support: `governance.freeze(session_id)` halts a runaway agent immediately
- Docs: https://docs.tealtiger.ai

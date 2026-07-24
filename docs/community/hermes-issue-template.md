# Hermes Agent Issue — TealTiger Governance Integration

## Title

Governance skill/middleware — tool-call authorization, PII scanning, cost budgets, and command allowlisting

---

## Problem or Use Case

Hermes agents run locally with full system access (file system, shell, network). This is powerful but creates governance gaps when deploying in shared or regulated environments:

1. **No pre-tool-call authorization.** Hermes calls tools based on model reasoning alone. There's no deterministic policy gate that blocks a tool call before execution based on content (PII in arguments), authorization (tool not allowed for this task), or cost (budget exceeded). A prompt injection via ingested context can instruct the agent to call unauthorized tools.

2. **No cost cap for long-running sessions.** Hermes sessions can run indefinitely (especially with memory providers keeping context alive). A stuck reasoning loop burns tokens with no termination. I've had local sessions accumulate $15+ before I noticed and manually stopped.

3. **No structured audit of tool calls.** For enterprise/team deployments, I need per-tool-call evidence: what was called, with what args, what governance decision was made, and what PII was present. Currently requires manually reviewing conversation logs.

4. **No PII/secret scanning on tool outputs.** Tools return data (file contents, API responses) that may contain secrets or PII. This enters the agent's context unscanned. When Hermes writes summaries or commits code, embedded secrets can leak.

This is NOT a niche integration — it's a core safety layer that applies to every tool call regardless of what skills are installed.

---

## Proposed Solution

A **governance middleware** (not a skill — this intercepts all tool calls, not a specific capability) that evaluates deterministic policy before each tool execution:

```toml
# .hermes/governance.toml
[governance]
mode = "enforce"  # observe | monitor | enforce

[governance.tool_policy]
allowlist = ["read_file", "write_file", "search", "run_command"]
denylist = ["delete_file", "ssh", "curl_external"]

[governance.command_policy]
allowlist = ["python", "pytest", "git", "cat", "ls", "grep"]
denylist = ["rm -rf", "curl", "wget", "nc", "ssh"]

[governance.pii]
action = "block"  # detect | redact | block
categories = ["ssn", "credit_card", "api_key", "private_key"]
scan_tool_outputs = true

[governance.budget]
per_session_usd = 5.00
max_tool_calls = 100
```

**CLI integration:**
```bash
# Start with governance enabled
hermes --governance .hermes/governance.toml

# Or via config
hermes config set governance.mode enforce
hermes config set governance.budget.per_session_usd 5.00
```

**Behavior:**
- Before each tool call → evaluate policy → ALLOW or DENY
- DENY → agent receives "Governance: tool `curl` blocked by policy" as tool output → adapts
- Every evaluation emits structured JSON to `~/.hermes/audit/` (or configured path)
- Budget exceeded → session terminates with summary of what was spent

---

## Alternatives Considered

- **Skill-based approach** — implementing this as a skill doesn't work because governance must intercept *all* tool calls, not be invoked by the agent optionally. The agent shouldn't be able to bypass governance.
- **Prompt instructions** ("never run curl") — unreliable. Model ignores under pressure or long context. Not auditable.
- **OS-level sandboxing** — prevents host damage but doesn't enforce application-level policy (which tools are authorized, PII in arguments, cost limits).
- **Post-hoc log review** — catches violations after execution. Doesn't prevent secrets from leaking or cost from accumulating.

---

## Feature Type

Core / Middleware (not a skill — must intercept all tool execution, not be optionally invoked)

---

## Scope

Medium — the tool execution path already has a defined interface. Adding a pre-execution hook that evaluates policy against a config file is architecturally clean. The policy evaluation engine itself is available as a library ([TealTiger](https://github.com/agentguard-ai/tealtiger), Apache 2.0).

---

## Contribution

✅ I'd like to implement this myself and submit a PR.

Will build as a middleware that hooks into the tool execution path. Need guidance on: is there a registered middleware/hook pattern for pre-tool-call interception, or should this be a wrapper around the tool executor?

---

## Additional Context

- [TealTiger](https://github.com/agentguard-ai/tealtiger) — Apache 2.0, NVIDIA Inception, deterministic governance SDK (<2ms, no LLM in governance path)
- PyPI: https://pypi.org/project/tealtiger/
- Supermemory already has a Hermes integration (memory provider) — governance is the natural complement
- NousResearch's emphasis on local/privacy-first aligns with deterministic governance (no data leaves the machine, no external API calls for policy evaluation)
- Similar middleware: AG2 (`ag2-tealtiger`), CrewAI (PR #6030), Haystack (`tealtiger-haystack`)

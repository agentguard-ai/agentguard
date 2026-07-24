# OpenHands Issue — TealTiger Governance Integration

## Title

Governance layer for agent actions — file access control, command allowlisting, cost budgets, and structured audit evidence

---

## Problem or Use Case

When deploying OpenHands in enterprise environments (shared dev infrastructure, regulated industries, multi-tenant platforms), the autonomous coding agent creates governance risks that manual coding doesn't:

1. **No file access governance.** The agent can read/write any file within its sandbox. A prompt injection (e.g., via a malicious README or dependency) can instruct the agent to read `.env` files, SSH keys, or credentials and exfiltrate them through code it writes. There's no policy layer that restricts which paths the agent can access based on role or task.

2. **No command allowlisting.** The agent executes arbitrary shell commands. A stuck or manipulated agent can run destructive commands (`rm -rf`, `DROP TABLE`, `curl` to external endpoints) with no pre-execution policy check. Existing sandboxing prevents host damage, but doesn't prevent damage *within* the sandbox (deleting the repo, corrupting the working state).

3. **No per-session cost budget with hard stop.** A coding agent in a retry loop (e.g., trying to fix a failing test repeatedly) can burn unlimited tokens. We've seen sessions hit $50+ when the agent enters a fix→fail→retry cycle with no termination condition.

4. **No structured audit trail for compliance.** Enterprise teams deploying OpenHands need to prove to auditors: what files the agent accessed, what commands it ran, what code it wrote, and what governance decisions were made. Currently requires building custom telemetry around the sandbox.

5. **No PII/secret scanning on agent output.** The agent can write code that embeds hardcoded secrets (API keys, passwords) or log PII. There's no scan of agent-generated code before it's committed or returned to the user.

---

## Proposed Solution

A governance hook at the action boundary — evaluated before each `FileReadAction`, `FileWriteAction`, `CmdRunAction`, and `BrowseURLAction`. Deterministic evaluation (no LLM in the governance path), <2ms per check.

```python
from openhands.core.config import AppConfig
from tealtiger_openhands import GovernanceConfig

governance = GovernanceConfig(
    mode="ENFORCE",
    file_policy={
        "read_allowlist": ["src/**", "tests/**", "docs/**"],
        "read_denylist": [".env*", "**/*.pem", "**/*secret*", ".ssh/**"],
        "write_allowlist": ["src/**", "tests/**"],
        "write_denylist": [".git/hooks/**", "*.exe", "/etc/**"],
    },
    command_policy={
        "allowlist": ["python", "pytest", "pip", "git", "cat", "ls", "grep"],
        "denylist": ["rm -rf", "curl", "wget", "nc", "ssh"],
        "block_network_access": True,  # deny commands that reach external hosts
    },
    budget={
        "per_session_usd": 5.00,
        "max_iterations": 50,
    },
    secret_scanning={
        "on_write": True,  # scan file writes for hardcoded secrets
        "action": "block",
    },
)

config = AppConfig(
    # ... existing config
    governance=governance,
)
```

**What happens on violation:**
- DENY action returned with structured reason (e.g., `FILE_ACCESS_DENIED: .env matches read_denylist`)
- Agent receives the denial as an observation ("Permission denied: governance policy blocks reading .env files")
- Agent can adapt (ask user, use a different approach) rather than crashing
- Governance decision record emitted for audit

**Capabilities:**

| Feature | Action Type | Description |
|---------|-------------|-------------|
| File read policy | FileReadAction | Allowlist/denylist by glob pattern. Block credential/secret file reads. |
| File write policy | FileWriteAction | Restrict where agent can write. Block writes to hooks, executables, system paths. |
| Command allowlist | CmdRunAction | Only approved commands can execute. Block destructive/network commands. |
| Cost budget | All actions | Per-session USD limit + iteration cap. Hard stop on exceed. |
| Secret scanning | FileWriteAction | Scan written content for API keys, passwords, tokens before write completes. |
| PII scanning | FileWriteAction, AgentFinishAction | Detect PII in agent output before it's returned/committed. |
| Structured audit | All actions | Every action produces: `{action_type, path/cmd, decision, findings, cost_so_far}` |
| Kill switch | Global | `governance.freeze(session_id)` — immediately halt a runaway session. |

---

## Alternatives Considered

- **Sandbox isolation alone** — Prevents host damage but doesn't prevent damage inside the sandbox (corrupted repo, leaked secrets in generated code, cost overruns). Governance operates at a higher level than sandboxing.
- **Prompt-level instructions** ("never read .env") — Unreliable under adversarial input. Not auditable. Ignored in long contexts.
- **Post-hoc log analysis** — Catches violations after the fact. Doesn't prevent the action. Not useful for real-time governance.
- **Custom EventStream observer** — Works but fragile, no standardized interface, breaks on OpenHands updates, no structured compliance output.

---

## Priority / Severity

**Important — affects my ability to deploy in production.** We can't deploy OpenHands in our enterprise environment without file access governance and audit trails.

---

## Estimated Scope

Medium — the EventStream architecture already provides the interception point. A governance observer that evaluates policy before action execution is architecturally clean. The main work is the policy evaluation engine + configuration schema.

---

## Feature Area

Security / Sandbox

---

## Technical Implementation Ideas (Optional)

OpenHands already has an `EventStream` with `Action` → `Observation` flow. The governance layer fits as a pre-action interceptor:

1. **Interception point:** Before the Runtime executes an Action, evaluate governance policy against it.
2. **Implementation:** A `GovernanceObserver` (or `SecurityPolicy` class) registered on the EventStream that:
   - Receives the Action before execution
   - Evaluates against configured policy (file globs, command allowlist, budget)
   - Returns ALLOW (proceed) or DENY (return a denied Observation to the agent)
3. **Configuration:** YAML/TOML in `.openhands/governance.yml` per-repo, or global config.
4. **Audit output:** Append governance decisions to the session trajectory for export.

The `SecurityAnalyzer` class already exists for some checks — this extends that pattern with deterministic, configurable policy evaluation.

[TealTiger](https://github.com/agentguard-ai/tealtiger) (Apache 2.0) already implements this pattern for 12+ agent frameworks. We'd build `tealtiger-openhands` as a standalone package.

---

## Additional Context

- TealTiger: https://github.com/agentguard-ai/tealtiger (Apache 2.0, NVIDIA Inception)
- PyPI: https://pypi.org/project/tealtiger/
- Docs: https://docs.tealtiger.ai
- Similar integration (AG2): https://pypi.org/project/ag2-tealtiger/
- Similar integration (Haystack): https://pypi.org/project/tealtiger-haystack/
- OWASP AI Security Index coverage: https://docs.tealtiger.ai/owasp/

We're willing to build and maintain the integration. Happy to submit a PR if you point us to the right extension point in the EventStream/Runtime architecture.

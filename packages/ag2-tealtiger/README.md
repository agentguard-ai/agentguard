# ag2-tealtiger

Full-lifecycle deterministic governance for [AG2](https://github.com/ag2ai/ag2) multi-agent systems. Policy enforcement, PII detection, prompt injection blocking, cost tracking, per-agent kill switch, governed speaker selection, inter-agent message governance, secret scanning, circuit breakers, and structured audit evidence — no LLM in the governance path.

[![PyPI](https://img.shields.io/pypi/v/ag2-tealtiger)](https://pypi.org/project/ag2-tealtiger/)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](https://github.com/agentguard-ai/tealtiger/blob/main/packages/ag2-tealtiger/LICENSE)
[![Python](https://img.shields.io/pypi/pyversions/ag2-tealtiger)](https://pypi.org/project/ag2-tealtiger/)

## Installation

```bash
pip install ag2-tealtiger
```

This installs the full TealTiger governance engine — all capabilities below are available.

## Quick Start

### Zero-Config Observe Mode

```python
from ag2_tealtiger import TealTigerGuard

guard = TealTigerGuard()  # No engine = observe mode
guard.attach(my_agent)
# Cost, PII, and tool usage tracked automatically. Nothing blocked.
```

Or the convenience subclass:

```python
from ag2_tealtiger import TealTigerAuditAgent

agent = TealTigerAuditAgent(name="coder")  # Zero config, observe mode built-in
```

### Policy Enforcement

```python
from ag2_tealtiger import TealTigerGuard, GovernanceMode

guard = TealTigerGuard(
    engine=my_engine,
    mode=GovernanceMode.ENFORCE,
    policies=[
        {"type": "pii", "action": "REDACT"},
        {"type": "tool_allowlist", "tools": ["search", "calculator", "read_file"]},
        {"type": "cost_limit", "max_per_session": 10.00},
        {"type": "prompt_injection", "action": "BLOCK"},
        {"type": "secrets", "action": "BLOCK"},
        {"type": "rate_limit", "max_calls": 50, "window": "1h"},
    ],
)
guard.attach(agent)
# DENY blocks the call with a structured denial message
```

### Governed GroupChat

```python
from ag2_tealtiger import GovernedGroupChat, TealTigerGuard, GovernanceMode

guard = TealTigerGuard(engine=engine, mode=GovernanceMode.ENFORCE)
group_chat = GovernedGroupChat(agents=[agent1, agent2, agent3], guard=guard)

# Speaker selection respects governance policies
speaker = group_chat.select_speaker(last_speaker=agent1)
# → Frozen agents are excluded from selection
# → Agents over budget are excluded
# → Inter-agent message policies are enforced
```

## Multi-Stage Defense

TealTiger governs at **every stage** of the AG2 agent lifecycle:

```
User Message → [Stage 1: Input Defense] → Agent Processing
                                                ↓
                                   LLM Call → [Stage 2: Pre-Model Defense]
                                                ↓
                                   Response → [Stage 3: Output Defense]
                                                ↓
                                   Tool Call → [Stage 4: Pre-Tool Defense]
                                                ↓
                                   Tool Result → [Stage 5: Post-Tool Defense]
                                                ↓
                                   Inter-Agent Message → [Stage 6: Message Governance]
```

| AG2 Hook | Defense Stage | What Runs |
|----------|--------------|-----------|
| `process_message_before_send` | **Input defense** | PII scan, prompt injection, content moderation |
| `on_tool_call` | **Pre-tool defense** | Tool authorization, argument validation, cost check |
| `on_tool_result` | **Post-tool defense** | Output PII scanning, secret detection |
| `on_reply` | **Output defense** | Response scanning, content classification |
| `inter_agent_message` | **Message governance** | Cross-agent PII isolation, data boundary enforcement |
| `select_speaker` | **Speaker governance** | Frozen agents excluded, budget enforcement |

All stages activate automatically when you `attach()` the guard — no per-stage configuration needed.

## Core Capabilities

### PII Detection (TealGuard)

Scans messages, tool arguments, and inter-agent communications for 40+ PII patterns in <2ms:

```python
TealTigerGuard(
    policies=[
        {
            "type": "pii",
            "action": "REDACT",          # BLOCK | REDACT | FLAG
            "patterns": "all",           # or: ["ssn", "credit_card", "email", "phone", "iban"]
            "stages": ["input", "output", "tool_args", "inter_agent"],
        }
    ],
)
```

**Detected patterns:** SSN, credit card numbers, IBAN, phone numbers, email addresses, IP addresses, AWS keys, passport numbers, driver's license, dates of birth, and 30+ more. Each detection includes a confidence score.

### Prompt Injection Detection

Deterministic pattern matching — blocks injection attempts before they reach the model:

```python
TealTigerGuard(
    policies=[
        {
            "type": "prompt_injection",
            "action": "BLOCK",
            "sensitivity": "high",    # low | medium | high
        }
    ],
)
```

Catches: instruction override attempts, role manipulation, jailbreak patterns, system prompt extraction, and context manipulation.

### Secret Scanning (TealSecrets)

Detects leaked credentials in agent messages and tool outputs:

```python
TealTigerGuard(
    policies=[
        {
            "type": "secrets",
            "action": "BLOCK",
            "patterns": "all",  # 500+ patterns: AWS keys, GitHub tokens, DB URLs, private keys...
        }
    ],
)
```

### Tool Authorization

Fine-grained control over what tools each agent can use:

```python
TealTigerGuard(
    policies=[
        # Allowlist — only these tools permitted
        {"type": "tool_allowlist", "tools": ["search", "calculator", "read_file"]},

        # Blocklist — always denied
        {"type": "tool_blocklist", "tools": ["delete_file", "execute_sql"]},

        # Argument constraints
        {
            "type": "tool_args",
            "tool": "web_search",
            "constraints": {"query": {"max_length": 200, "blocked_terms": ["internal"]}},
        },
    ],
    # FREEZE — immutable deny, enforced regardless of governance mode
    freeze_tools=["rm_rf", "drop_database", "format_disk"],
)
```

### Cost Governance

Per-agent and per-session budget enforcement with hard stop:

```python
TealTigerGuard(
    policies=[
        {
            "type": "cost_limit",
            "max_per_session": 10.00,     # $ per session across all agents
            "max_per_agent": 3.00,        # $ per individual agent
            "max_per_request": 0.50,      # $ per LLM call
            "max_daily": 100.00,          # $ daily cap
            "action": "BLOCK",
        }
    ],
)
```

When an agent exceeds its budget, further LLM calls are blocked and the agent is excluded from speaker selection.

### Rate Limiting

Prevent runaway agents from exhausting resources:

```python
TealTigerGuard(
    policies=[
        {"type": "rate_limit", "max_calls": 100, "window": "1h"},
        {"type": "rate_limit", "max_calls": 5, "window": "1m", "tool": "web_search"},
    ],
)
```

### Circuit Breaker (TealCircuit)

Automatic failure protection — stop calling broken tools or failing LLM endpoints:

```python
TealTigerGuard(
    policies=[
        {
            "type": "circuit_breaker",
            "failure_threshold": 5,       # open after 5 consecutive failures
            "recovery_time": 60,          # retry after 60s
            "half_open_calls": 2,         # test with 2 calls before fully closing
        }
    ],
)
```

### Content Moderation (TealClassifier)

Classify and filter message content by category:

```python
TealTigerGuard(
    policies=[
        {
            "type": "content_moderation",
            "blocked_categories": ["hate_speech", "self_harm", "violence"],
            "action": "BLOCK",
        }
    ],
)
```

## AG2-Specific Features

### Per-Agent Freeze / Unfreeze

Instantly disable a misbehaving agent without stopping the group:

```python
# Freeze a specific agent — blocked from all actions
guard.freeze(agent_name="risky_agent")

# Unfreeze when safe
guard.unfreeze(agent_name="risky_agent")

# Frozen agents are automatically excluded from GovernedGroupChat speaker selection
```

### Governed Speaker Selection

In GroupChat, governance policies influence which agent speaks next:

```python
group_chat = GovernedGroupChat(agents=[agent1, agent2, agent3], guard=guard)

# Speaker selection automatically:
# - Excludes frozen agents
# - Excludes agents over budget
# - Excludes agents whose circuit breaker is open
# - Respects inter-agent communication policies
speaker = group_chat.select_speaker(last_speaker=agent1)
```

### Inter-Agent Message Governance

Control what data flows between agents in multi-agent systems:

```python
TealTigerGuard(
    policies=[
        {
            "type": "inter_agent",
            "action": "REDACT",
            # PII detected in Agent A's output is redacted before Agent B receives it
            # Prevents sensitive data leaking across agent boundaries
        }
    ],
)
```

### REFER Escalation

Route sensitive decisions to a human or supervisor agent:

```python
TealTigerGuard(
    policies=[
        {
            "type": "refer",
            "conditions": ["risk_score > 80", "action_type == 'purchase'"],
            "escalate_to": "supervisor_agent",
            # Pauses execution and routes to supervisor for approval
        }
    ],
)
```

## Governance Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| `OBSERVE` | Track everything, block nothing | Zero-config auditing |
| `MONITOR` | Allow all, log violations | Staging / shadow testing |
| `ENFORCE` | Block denied actions | Production enforcement |

```python
# Start in OBSERVE, graduate to MONITOR, then ENFORCE
guard = TealTigerGuard(mode=GovernanceMode.OBSERVE)

# Switch modes at runtime
guard.set_mode(GovernanceMode.ENFORCE)
```

## Feature Matrix by Mode

| Capability | OBSERVE | MONITOR | ENFORCE |
|-----------|---------|---------|---------|
| Cost tracking per agent | ✅ | ✅ | ✅ |
| PII detection in messages & tool args | ✅ | ✅ | ✅ |
| Prompt injection detection | ✅ | ✅ | ✅ |
| Secret scanning | ✅ | ✅ | ✅ |
| Structured audit entries (TEEC) | ✅ | ✅ | ✅ |
| Per-agent freeze/unfreeze | ✅ | ✅ | ✅ |
| Policy evaluation | — | ✅ (log) | ✅ (block) |
| Budget enforcement | — | ✅ (log) | ✅ (block) |
| Tool authorization | — | ✅ (log) | ✅ (block) |
| Rate limiting | — | ✅ (log) | ✅ (block) |
| Circuit breaker | — | ✅ (log) | ✅ (trip) |
| REFER escalation | — | ✅ | ✅ |
| Inter-agent message governance | ✅ | ✅ | ✅ |
| Governed speaker selection | ✅ | ✅ | ✅ |
| Content moderation | — | ✅ (log) | ✅ (block) |

## Governance Evidence & Audit Trail

Every governance decision produces a typed **Decision Contract** (TEEC):

```python
# After agent execution
for decision in guard.evidence:
    print(decision)
    # Decision(
    #   correlation_id="a1b2c3d4-...",
    #   trace_id="otel-trace-...",           ← OpenTelemetry compatible
    #   action="DENY",
    #   risk_score=85,
    #   reason_code="PII_SSN_DETECTED",
    #   stage="pre_tool",
    #   agent_name="research_agent",
    #   tool_name="submit_form",
    #   triggered_policies=["pii"],
    #   evaluation_time_ms=1.2,
    #   timestamp="2026-08-10T14:32:01Z",
    # )

# Session summary
print(guard.summary)
# SessionSummary(
#   total_evaluations=24, allowed=20, denied=3, referred=1,
#   session_cost=4.56, agents={"coder": 2.10, "researcher": 2.46}
# )
```

### Evidence Export

```python
# JSONL for streaming/compliance
guard.export_evidence("audit.jsonl", format="jsonl")

# SARIF for security tooling
guard.export_evidence("governance.sarif", format="sarif")

# JUnit XML for CI/CD
guard.export_evidence("results.xml", format="junit")
```

## OpenTelemetry Integration

Governance decisions propagate as OTel spans:

```python
TealTigerGuard(
    engine=engine,
    otel_enabled=True,  # Decisions appear in your existing tracing backend
)
```

Each evaluation appears as a span with attributes:
- `tealtiger.action`: ALLOW / DENY / REDACT / REFER
- `tealtiger.risk_score`: 0–100
- `tealtiger.agent_name`: which agent triggered the evaluation
- `tealtiger.reason_code`: policy violation code
- `tealtiger.evaluation_ms`: governance latency

## OWASP AI Security Coverage

| OWASP ASI | Coverage | How |
|-----------|----------|-----|
| ASI-01: Excessive Agency | ✅ | Tool allowlist/blocklist, FREEZE, per-agent budgets |
| ASI-02: Inadequate Sandboxing | ✅ | Argument validation, inter-agent data boundaries |
| ASI-03: Prompt Injection | ✅ | Deterministic injection pattern detection |
| ASI-04: Sensitive Information Disclosure | ✅ | PII detection + redaction across all stages |
| ASI-05: Improper Output Handling | ✅ | Output scanning, content moderation |
| ASI-07: Inadequate Error Handling | ✅ | Circuit breaker, structured error responses |
| ASI-09: Insufficient Monitoring | ✅ | Full audit trail, OTel spans, TEEC evidence |

## Advanced: Direct Core Access

Access TealTiger core modules directly for custom patterns:

```python
from tealtiger import TealEngine, TealGuard, TealCircuit, TealAudit, TealSecrets

# Standalone PII scanning
guard = TealGuard()
result = guard.scan_pii("SSN: 123-45-6789")
# PIIScanResult(found=True, patterns=["ssn"], confidence=0.98, redacted="SSN: [REDACTED]")

# Custom policy evaluation
engine = TealEngine(policies=[...])
decision = engine.evaluate(content, context={"agent_name": "coder"})
```

All core modules available: TealEngine, TealGuard, TealCircuit, TealAudit, TealSecrets, TealRegistry, TealReliability, TealMemory, Decision Contract.

## Key Properties

| Property | Detail |
|----------|--------|
| **Deterministic** | No LLM in governance path. Same input → same decision |
| **Fast** | <5ms per evaluation, full multi-stage <15ms |
| **Multi-agent native** | Per-agent budgets, inter-agent governance, speaker control |
| **Multi-stage** | Input → output → tool → inter-agent defense in one guard |
| **Auditable** | TEEC evidence trail, SARIF/JUnit/JSONL export |
| **OTel-native** | Governance spans propagate through existing traces |
| **Composable** | Attach to any AG2 agent, works with GroupChat and nested chats |
| **Zero external deps** | All evaluation in-process, no API keys, no network calls |
| **OWASP coverage** | 7/10 AI Security Issues addressed deterministically |

## Related

- [TealTiger Documentation](https://docs.tealtiger.ai/)
- [Multi-Stage Defense](https://docs.tealtiger.ai/concepts/multi-stage-defense)
- [Governance Domains](https://docs.tealtiger.ai/concepts/governance-domains)
- [TealTiger GitHub](https://github.com/agentguard-ai/tealtiger)
- [AG2 Framework](https://github.com/ag2ai/ag2)

## License

Apache 2.0

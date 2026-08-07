# langchain-tealtiger

Full-lifecycle deterministic governance for LangChain agents. Multi-stage defense, PII detection, prompt injection blocking, cost governance, tool authorization, circuit breakers, secret scanning, and compliance-grade audit evidence — no LLM in the governance path.

[![PyPI](https://img.shields.io/pypi/v/langchain-tealtiger)](https://pypi.org/project/langchain-tealtiger/)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Python](https://img.shields.io/pypi/pyversions/langchain-tealtiger)](https://pypi.org/project/langchain-tealtiger/)

## Installation

```bash
pip install langchain-tealtiger
```

This installs the full TealTiger governance engine as a dependency — all capabilities below are available through the middleware.

## Quick Start

```python
from langchain.agents import create_agent
from langchain_tealtiger import TealTigerMiddleware

agent = create_agent(
    model="claude-sonnet-4-6",
    tools=[search, calculator, file_write],
    middleware=[
        TealTigerMiddleware(
            policies=[
                {"type": "tool_allowlist", "tools": ["search", "calculator"]},
                {"type": "pii", "action": "REDACT"},
                {"type": "cost_limit", "max_per_session": 5.00},
                {"type": "prompt_injection", "action": "BLOCK"},
                {"type": "secrets", "action": "BLOCK"},
            ],
            freeze_tools=["rm_rf", "drop_database"],
        )
    ],
)
```

Every tool call, model input, and model output now flows through deterministic governance evaluation.

## Multi-Stage Defense

TealTiger doesn't just govern tool calls — it protects at **every stage** of the agent lifecycle:

```
User Input → [Stage 1: Input Defense] → Model → [Stage 2: Output Defense]
                                                        ↓
                                               Tool Call → [Stage 3: Pre-Tool Defense]
                                                        ↓
                                               Tool Result → [Stage 4: Post-Tool Defense]
```

| LangChain Hook | Defense Stage | What Runs |
|----------------|--------------|-----------|
| `before_agent` | Session init | Initialize governance session, load policies |
| `before_model` | **Input defense** | PII detection, prompt injection blocking, content moderation |
| `after_model` | **Output defense** | Response PII scanning, secret detection, content classification |
| `wrap_tool_call` | **Pre-tool defense** | Tool authorization, argument validation, cost check |
| `after_tool` | **Post-tool defense** | Tool output scanning, secret detection, PII in results |
| `after_agent` | Session close | Finalize evidence trail, emit audit summary |

All stages are configured through a single middleware instance — policies are automatically applied at the appropriate lifecycle point.

## Core Capabilities

### PII Detection (TealGuard)

Scans inputs, outputs, and tool arguments for 40+ PII patterns in <2ms:

```python
TealTigerMiddleware(
    policies=[
        {
            "type": "pii",
            "action": "REDACT",          # BLOCK | REDACT | FLAG
            "patterns": "all",           # or specific: ["ssn", "credit_card", "email", "phone"]
            "stages": ["input", "output", "tool_result"],  # where to scan
        }
    ],
)
```

**Detected patterns include:** SSN, credit card numbers, IBAN, phone numbers, email addresses, IP addresses, AWS keys, passport numbers, driver's license, dates of birth, and 30+ more.

Each detection includes a **confidence score** (0.0–1.0) so you can tune sensitivity.

### Prompt Injection Detection

Deterministic pattern matching for common injection attacks — no LLM needed:

```python
TealTigerMiddleware(
    policies=[
        {
            "type": "prompt_injection",
            "action": "BLOCK",            # BLOCK | FLAG | MONITOR
            "sensitivity": "high",        # low | medium | high
        }
    ],
)
```

Catches: instruction override attempts, role manipulation, jailbreak patterns, system prompt extraction, and context manipulation.

### Secret Scanning (TealSecrets)

Detects leaked secrets and credentials in model inputs/outputs:

```python
TealTigerMiddleware(
    policies=[
        {
            "type": "secrets",
            "action": "BLOCK",
            "patterns": "all",  # 500+ secret patterns
            # AWS keys, GitHub tokens, Stripe keys, database URLs, private keys, etc.
        }
    ],
)
```

### Tool Authorization

Fine-grained control over what tools agents can use and how:

```python
TealTigerMiddleware(
    policies=[
        # Allowlist — only these tools permitted
        {"type": "tool_allowlist", "tools": ["search", "calculator", "read_file"]},

        # Blocklist — these tools always denied
        {"type": "tool_blocklist", "tools": ["delete_file", "execute_sql", "send_email"]},

        # Argument validation — restrict tool arguments
        {
            "type": "tool_args",
            "tool": "search",
            "constraints": {"query": {"max_length": 200, "blocked_terms": ["competitor"]}},
        },
    ],
    # FREEZE — immutable deny rules, enforced regardless of governance mode
    freeze_tools=["rm_rf", "drop_database", "format_disk"],
)
```

### Cost Governance

Hard budget enforcement at the proxy level — not just alerts:

```python
TealTigerMiddleware(
    policies=[
        {
            "type": "cost_limit",
            "max_per_session": 5.00,      # $ per agent session
            "max_per_request": 0.50,      # $ per individual LLM call
            "max_daily": 100.00,          # $ per day (across sessions)
            "action": "BLOCK",            # hard stop when exceeded
        }
    ],
)
```

Cost is tracked per-model using real token pricing. When budget is exhausted, the middleware blocks further calls — no surprise bills.

### Rate Limiting

Limit tool call frequency to prevent runaway agents:

```python
TealTigerMiddleware(
    policies=[
        {"type": "rate_limit", "max_calls": 100, "window": "1h"},
        {"type": "rate_limit", "max_calls": 10, "window": "1m", "tool": "search"},
    ],
)
```

### Circuit Breaker (TealCircuit)

Automatic failure protection — stop calling broken tools/models:

```python
TealTigerMiddleware(
    policies=[
        {
            "type": "circuit_breaker",
            "failure_threshold": 5,       # open circuit after 5 failures
            "recovery_time": 60,          # try again after 60 seconds
            "half_open_calls": 2,         # test with 2 calls before closing
        }
    ],
)
```

### Content Moderation (TealClassifier)

Classify and filter content by category:

```python
TealTigerMiddleware(
    policies=[
        {
            "type": "content_moderation",
            "blocked_categories": ["hate_speech", "self_harm", "violence"],
            "action": "BLOCK",
        }
    ],
)
```

## Governance Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| `ENFORCE` | Block denied actions, redact PII | Production |
| `MONITOR` | Allow all, log violations | Staging / shadow mode |
| `REPORT_ONLY` | Allow all, generate compliance reports | Initial rollout / audit |

```python
# Start in MONITOR to observe, graduate to ENFORCE
TealTigerMiddleware(policies=[...], mode="MONITOR")
```

## Governance Evidence & Audit Trail

Every governance decision produces a structured, typed **Decision Contract**:

```python
middleware = TealTigerMiddleware(policies=[...])
agent = create_agent(model="...", tools=[...], middleware=[middleware])

result = agent.invoke({"messages": [HumanMessage("...")]})

# Session summary
print(middleware.summary)
# SessionSummary(total_evaluations=12, allowed=10, denied=2, session_cost=2.34)

# Full evidence trail
for decision in middleware.evidence:
    print(decision)
    # Decision(
    #   correlation_id="a1b2c3d4-...",
    #   trace_id="otel-trace-...",         ← OpenTelemetry compatible
    #   action="DENY",
    #   risk_score=85,
    #   reason_code="PII_SSN_DETECTED",
    #   stage="pre_tool",
    #   tool_name="submit_form",
    #   triggered_policies=["pii"],
    #   evaluation_time_ms=1.2,
    #   timestamp="2026-08-10T14:32:01Z",
    # )
```

### Evidence Export

Export governance evidence for compliance teams:

```python
# JSON export for SOC2/HIPAA/ISO 27001
middleware.export_evidence("governance_report.json")

# SARIF format for security tooling
middleware.export_evidence("governance.sarif", format="sarif")

# JUnit XML for CI/CD integration
middleware.export_evidence("governance_results.xml", format="junit")
```

## OpenTelemetry Integration

Governance decisions propagate as OTel spans with the agent's trace context:

```python
TealTigerMiddleware(
    policies=[...],
    otel_enabled=True,  # Decisions appear as spans in your existing tracing
)
```

Each governance evaluation appears in LangSmith, Jaeger, Datadog, or any OTel-compatible backend as a child span with attributes:
- `tealtiger.action`: ALLOW / DENY / REDACT
- `tealtiger.risk_score`: 0–100
- `tealtiger.reason_code`: policy violation code
- `tealtiger.evaluation_ms`: latency

## OWASP AI Security Coverage

TealTiger addresses 7/10 OWASP Agentic Security Issues through the LangChain middleware:

| OWASP ASI | Coverage | How |
|-----------|----------|-----|
| ASI-01: Excessive Agency | ✅ | Tool allowlist/blocklist, FREEZE rules |
| ASI-02: Inadequate Sandboxing | ✅ | Argument validation, action constraints |
| ASI-03: Prompt Injection | ✅ | Deterministic injection pattern detection |
| ASI-04: Sensitive Information Disclosure | ✅ | PII detection + redaction (40+ patterns) |
| ASI-05: Improper Output Handling | ✅ | Output scanning, content moderation |
| ASI-07: Inadequate Error Handling | ✅ | Circuit breaker, structured error responses |
| ASI-09: Insufficient Monitoring | ✅ | Full audit trail with correlation IDs |

## Use with LangGraph

Works seamlessly in multi-agent LangGraph workflows — governance state persists across subgraphs:

```python
from langgraph.graph import START, StateGraph
from langchain.agents import AgentState, create_agent

governed_agent = create_agent(
    model="claude-sonnet-4-6",
    tools=[search, calculator, write_file],
    middleware=[
        TealTigerMiddleware(
            policies=[
                {"type": "pii", "action": "REDACT"},
                {"type": "tool_allowlist", "tools": ["search", "calculator"]},
                {"type": "cost_limit", "max_per_session": 10.00},
                {"type": "prompt_injection", "action": "BLOCK"},
            ],
        )
    ],
)

graph = (
    StateGraph(AgentState)
    .add_node("research", governed_agent)
    .add_node("writer", governed_agent)
    .add_edge(START, "research")
    .add_edge("research", "writer")
    .compile()
)
```

Governance decisions are visible in LangSmith traces and respect LangGraph checkpointing.

## Advanced: Direct Core Access

The middleware handles the common case, but you can also access TealTiger core directly for advanced patterns:

```python
from tealtiger import TealEngine, TealGuard, TealCircuit, TealAudit, TealSecrets

# Use TealGuard standalone for custom scanning
guard = TealGuard()
result = guard.scan_pii("My SSN is 123-45-6789")
# PIIScanResult(found=True, patterns=["ssn"], confidence=0.98, redacted="My SSN is [REDACTED]")

# Use TealEngine for complex multi-policy evaluation
engine = TealEngine(policies=[...])
decision = engine.evaluate(content, context={"user_id": "...", "model": "..."})
```

All TealTiger core modules are available after installing `langchain-tealtiger`:
- **TealEngine** — Policy evaluation engine
- **TealGuard** — PII, injection, content moderation
- **TealCircuit** — Circuit breaker
- **TealAudit** — Audit logging with PII redaction
- **TealSecrets** — Secret/credential detection (500+ patterns)
- **TealRegistry** — Model/tool allowlisting with provenance
- **TealReliability** — Retry budgets, fallback chains
- **TealMemory** — Memory governance (if using persistent memory)
- **Decision Contract** — Typed decision objects

## Key Properties

| Property | Detail |
|----------|--------|
| **Deterministic** | No LLM in governance path. Same input → same decision, every time |
| **Fast** | <5ms per evaluation. Full multi-stage scan <15ms total |
| **Multi-stage** | Input → output → pre-tool → post-tool defense in one middleware |
| **Auditable** | Full evidence trail with correlation IDs, SARIF/JUnit/JSON export |
| **OTel-native** | Governance spans propagate through existing OpenTelemetry traces |
| **Graph-native** | Visible in LangSmith, works with LangGraph checkpointing |
| **Composable** | Drop into any agent, works with subgraphs and multi-agent workflows |
| **Zero external deps** | All evaluation in-process, no API keys, no network calls |
| **OWASP coverage** | 7/10 AI Security Issues addressed deterministically |

## Related

- [TealTiger Documentation](https://docs.tealtiger.ai/)
- [Multi-Stage Defense Concept](https://docs.tealtiger.ai/concepts/multi-stage-defense)
- [Governance Domains](https://docs.tealtiger.ai/concepts/governance-domains)
- [TealTiger GitHub](https://github.com/agentguard-ai/tealtiger)
- [LangChain Middleware Docs](https://docs.langchain.com/oss/python/langchain/middleware/overview)

## License

Apache 2.0

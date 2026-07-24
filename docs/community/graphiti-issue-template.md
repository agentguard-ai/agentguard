# Graphiti Issue — TealTiger Governance Integration for Temporal Context Graphs

## Issue Title

`[Feature Request] Governance hooks for episode ingestion and graph retrieval — PII scanning, fact-level access control, and audit trail`

---

## Issue Body

### Problem

Graphiti builds temporal context graphs from episodes (raw conversations, structured data, external sources). When agents query the graph, retrieved facts flow directly into LLM context. In regulated environments, this creates governance gaps:

1. **PII in episodes persists into the graph** — A user says "my SSN is 123-45-6789" in a conversation. Graphiti extracts this as a fact, creates entity nodes, and the SSN becomes permanently queryable. Any agent querying that user's context retrieves the SSN without governance.

2. **No governance boundary at retrieval** — When an agent calls `graphiti.search()` or uses the MCP server to query context, the retrieved facts (entities + relationships + episode provenance) enter the agent's prompt with no scan for sensitive content, no access-level verification, and no audit trail of what was returned.

3. **Temporal facts with expired governance** — A fact like "User has admin access (valid_at: 2026-01-01, invalid_at: 2026-06-01)" is correctly tracked as expired by Graphiti. But there's no governance layer that prevents an agent from seeing expired-but-sensitive facts (e.g., old credentials, revoked access, past medical conditions).

4. **Episode provenance without governance provenance** — Graphiti has excellent provenance (every fact traces to episodes). But there's no governance provenance: which facts were scanned, what was redacted, and what evidence exists that a given retrieval was compliant.

### Proposed Solution

A governance layer at two boundaries:

1. **Ingestion boundary** — scan episodes for PII/secrets before they become facts in the graph
2. **Retrieval boundary** — scan/filter retrieved facts before they enter the agent's context

[TealTiger](https://github.com/agentguard-ai/tealtiger) is an open-source (Apache 2.0) deterministic governance SDK. We'd like to propose an integration via:

**(a) Ingestion hook** — a callback/middleware at `graphiti.add_episode()` that scans episode content before extraction, or
**(b) Retrieval hook** — a post-retrieval filter at `graphiti.search()` / `graphiti._search()` that governs results before returning them, or
**(c) External adapter** — a standalone `tealtiger-graphiti` package that wraps the Graphiti client with governance.

### What the integration would provide

| Capability | Ingestion | Retrieval | Description |
|-----------|:---------:|:---------:|-------------|
| **PII detection & redaction** | ✅ | ✅ | Scan episodes/facts for SSN, credit card, email, phone, API keys. Redact before storage or before return. |
| **Fact-level access control** | — | ✅ | Policy-based filtering: "agent role X cannot see facts tagged with classification Y." |
| **Temporal governance** | — | ✅ | Enforce that expired/invalidated facts containing sensitive data are not returned to agents (even though Graphiti correctly tracks them historically). |
| **Structured audit trail** | ✅ | ✅ | Every ingestion and retrieval produces a governance record with correlation_id, findings, action taken, and latency. |
| **Cost tracking** | — | ✅ | Track LLM cost of graph queries per session with budget limits (relevant since Graphiti uses LLMs for extraction and reranking). |
| **Injection defense** | ✅ | — | Detect prompt injection patterns in ingested episodes before they become facts that poison future retrievals. |

### Technical Approach

```python
from graphiti_core import Graphiti
from tealtiger_graphiti import GovernedGraphiti

# Wrap Graphiti with governance
graphiti = Graphiti("bolt://localhost:7687", "neo4j", "password")
governed = GovernedGraphiti(
    graphiti,
    mode="ENFORCE",  # OBSERVE | MONITOR | ENFORCE
    ingestion_governance={
        "pii": {"action": "redact", "categories": ["ssn", "credit_card"]},
        "injection": {"action": "block"},
    },
    retrieval_governance={
        "pii": {"action": "redact"},
        "access_control": {"deny_classifications": ["restricted"]},
        "temporal": {"deny_expired_sensitive": True},
    },
    budget={"max_llm_cost_per_session": 2.00},
)

# Governed episode ingestion — PII redacted before graph extraction
await governed.add_episode(
    name="support_chat",
    episode_body="Customer SSN is 123-45-6789, they want a refund on order #4521",
    source_description="Support chat transcript",
)
# → SSN redacted before Graphiti extracts entities
# → Governance record emitted with finding + action

# Governed search — facts filtered before reaching agent
results = await governed.search("customer refund history")
# → Results scanned for PII, access-controlled, audit trail emitted
```

### Why this matters for Graphiti users

- **Enterprise adoption** — Graphiti's temporal provenance is already enterprise-grade. Adding governance evidence at ingestion + retrieval completes the compliance story (SOC2, HIPAA, GDPR).
- **Context poisoning defense** — Episodes from untrusted sources (web crawlers, user messages, external connectors) can inject adversarial content into the graph. A governance scan at ingestion prevents poisoned facts from ever being created.
- **Zep differentiation** — Zep's managed platform mentions "governed, low-latency context retrieval." An open-source governance layer for Graphiti users narrows that gap while keeping the community version useful for regulated environments.
- **Temporal governance is novel** — No other memory/graph system governs based on fact validity windows. Graphiti already tracks this; governance can leverage it to enforce "expired sensitive facts don't reach agents."

### Implementation options

We're happy to:
1. Build and maintain a standalone `tealtiger-graphiti` package (no changes needed in Graphiti core) — wraps the client
2. Propose hook points in `graphiti_core` (e.g., `pre_ingest_hook`, `post_retrieval_hook`) that any governance provider can implement
3. Contribute directly if preferred — we respect the CLA process

### Compatibility

- Graphiti is Python, TealTiger has a Python SDK (`pip install tealtiger`)
- No Neo4j/FalkorDB dependency — governance operates at the application layer
- <2ms per governance evaluation (deterministic, no LLM in governance path)

### References

- TealTiger: https://github.com/agentguard-ai/tealtiger
- PyPI: https://pypi.org/project/tealtiger/
- Similar integration (Haystack memory): https://pypi.org/project/tealtiger-haystack/
- Similar integration (Hindsight/Vectorize): https://github.com/agentguard-ai/tealtiger/tree/main/packages/tealtiger-hindsight
- Graphiti paper: https://arxiv.org/abs/2501.13956

Happy to discuss architecture — open to whatever fits Graphiti's plugin model best.

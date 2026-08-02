"""Example: Governed Composio tool calls with TealTiger.

This example demonstrates how to add deterministic governance to Composio
tool calls using the composio-tealtiger middleware.

Three governance modes are shown:
1. Observe — track everything, block nothing
2. Monitor — log policy violations without blocking
3. Enforce — block policy violations before tools execute
"""

from composio import Composio
from composio_tealtiger import governance_modifiers, GovernanceDenyError
from tealtiger import TealEngine, freeze, unfreeze

# --- 1. Zero-Config Observe Mode ---

composio = Composio()

# Just add governance_modifiers() — zero config, instant visibility
tools = composio.tools.get(
    user_id="user_123",
    toolkits=["github"],
    **governance_modifiers(agent_id="my-coder-agent")
)

# Every tool call is now tracked with:
# - Cost per call and cumulative
# - PII detection (report-only)
# - Correlation IDs for tracing
# - Evaluation time (<5ms)

# --- 2. Enforce Mode with Policies ---

engine = TealEngine(policies=[
    # Only allow GitHub and HackerNews tools for this agent
    {"type": "tool_allowlist", "agent": "coder", "allowed": ["GITHUB_*", "HACKERNEWS_*"]},
    # Block PII in tool arguments
    {"type": "pii_block", "categories": ["ssn", "credit_card"]},
    # Enforce $5 budget per session
    {"type": "cost_limit", "max_per_session": 5.00},
])

tools = composio.tools.get(
    user_id="user_123",
    toolkits=["github", "gmail", "slack"],
    **governance_modifiers(engine=engine, mode="ENFORCE", agent_id="coder")
)

# Try executing an unauthorized tool
try:
    result = composio.tools.execute(
        "GMAIL_SEND_EMAIL",
        {"user_id": "user_123", "arguments": {"to": "victim@example.com", "body": "Hello"}},
        **governance_modifiers(engine=engine, mode="ENFORCE", agent_id="coder")
    )
except GovernanceDenyError as e:
    print(f"BLOCKED: {e.decision['reason']}")
    print(f"Tool: {e.decision['tool_slug']}")
    print(f"Reason codes: {e.decision['reason_codes']}")
    # BLOCKED: Tool 'GMAIL_SEND_EMAIL' not in allowlist for agent 'coder'

# --- 3. Kill Switch ---

# Emergency: freeze an agent's tool access
freeze("coder")
# All subsequent tool calls for "coder" are immediately blocked

# After investigation, restore access
unfreeze("coder")

# --- 4. Inspect Audit Trail ---

modifiers = governance_modifiers(engine=engine, mode="ENFORCE", agent_id="coder")
state = modifiers["_governance_state"]

# After running tool calls, inspect decisions:
for decision in state.decisions:
    print(f"[{decision['action']}] {decision['tool_slug']} — {decision['reason']}")
    print(f"  Cost: ${decision['cost_tracked']:.4f} | Eval: {decision['evaluation_time_ms']:.2f}ms")
    print(f"  Correlation ID: {decision['correlation_id']}")

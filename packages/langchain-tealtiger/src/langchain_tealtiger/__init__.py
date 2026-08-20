"""LangChain TealTiger — Deterministic governance middleware for LangChain agents.

Add TealTiger governance to any LangChain agent with a single middleware:

    from langchain.agents import create_agent
    from langchain_tealtiger import TealTigerMiddleware

    agent = create_agent(
        model="claude-sonnet-4-6",
        tools=[...],
        middleware=[
            TealTigerMiddleware(
                policies=[
                    {"type": "tool_allowlist", "tools": ["search", "calculator"]},
                    {"type": "cost_limit", "max_per_session": 5.00},
                    {"type": "rate_limit", "max_calls": 100, "window": "1h"},
                ],
                freeze_tools=["delete_all", "drop_database"],
            )
        ],
    )

No LLM in the governance path. All policy evaluation is deterministic, adding <5ms latency.
"""

from langchain_tealtiger.middleware import TealTigerMiddleware
from langchain_tealtiger._types import (
    GovernanceAction,
    GovernanceDecision,
    GovernanceMode,
    PolicyConfig,
    SessionSummary,
)

__version__ = "0.1.0"
__all__ = [
    "TealTigerMiddleware",
    "GovernanceAction",
    "GovernanceDecision",
    "GovernanceMode",
    "PolicyConfig",
    "SessionSummary",
]

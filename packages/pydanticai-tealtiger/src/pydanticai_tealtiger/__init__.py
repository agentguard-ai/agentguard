"""TealTiger Governance Guard for Pydantic AI.

Add deterministic governance to any Pydantic AI agent as a dependency:

    from pydantic_ai import Agent
    from pydanticai_tealtiger import TealTigerGuard

    guard = TealTigerGuard()
    agent = Agent('openai:gpt-4', deps_type=TealTigerGuard)

    @agent.tool
    async def search(ctx, query: str) -> str:
        ctx.deps.evaluate(tool="search", args={"query": query})
        return "results"

    # Zero-config mode: observe everything, allow all, track cost, detect PII
    # Policy mode with TealEngine:
    from tealtiger import TealEngine

    engine = TealEngine(policies=[...])
    guard = TealTigerGuard(engine=engine, mode="ENFORCE")

No LLM in the governance path. All policy evaluation is deterministic, adding <2ms latency.
"""

from pydanticai_tealtiger.guard import (
    AuditEntry,
    GovernanceAction,
    GovernanceDenyError,
    GovernanceMode,
    PIIFinding,
    TealTigerGuard,
    ToolBaseline,
    ToolSummary,
)
from pydanticai_tealtiger.agent import GovernedAgent, GovernanceConfig

__all__ = [
    "TealTigerGuard",
    "GovernanceDenyError",
    "GovernanceAction",
    "GovernanceMode",
    "AuditEntry",
    "PIIFinding",
    "ToolSummary",
    "ToolBaseline",
    "GovernedAgent",
    "GovernanceConfig",
]

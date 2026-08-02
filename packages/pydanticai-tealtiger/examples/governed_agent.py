import asyncio
from pydantic_ai import RunContext
from pydanticai_tealtiger import GovernedAgent, GovernanceConfig

# 1. Define type-safe governance configuration
config = GovernanceConfig(
    mode="enforce",
    allowed_tools=["web_search", "calculator"],
    blocked_pii=["ssn", "credit_card"],
    max_cost_per_session=5.00,
)

# 2. Initialize the GovernedAgent with the typed config
agent = GovernedAgent(
    "openai:gpt-4o-mini",
    governance=config,  # Fully typed, validated at init
)

# 3. Define tools (they will be automatically governed)
@agent.tool
async def web_search(ctx: RunContext, query: str) -> str:
    print(f"Executing web_search for query: {query}")
    return f"Results for {query}: ACME Corp Q3 earnings increased by 15%."

@agent.tool
async def calculator(ctx: RunContext, expression: str) -> str:
    print(f"Executing calculator for expression: {expression}")
    return "1500"

async def main():
    print("Starting agent run...")
    
    try:
        # 4. Run the agent. The guard is automatically injected and enforced!
        result = await agent.run("Research ACME Corp earnings and calculate 10% of their 1500M revenue.")
        print("\nAgent Result:", result.data)
        
        # 5. Access the deterministic audit trail via the guard
        print("\nAudit Trail:")
        for entry in agent.guard.audit_trail:
            print(f"- {entry.action}: {entry.tool_name} -> {entry.reason}")
            
    except Exception as e:
        print(f"\nGovernance Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())

import os
from openai_agents import Agent, Runner # Note: openai-agents SDK
from tealtiger.integrations.openai_agents import TealTigerGuardrail

# 1. Define custom tools
def web_search(query: str) -> str:
    """Search the web for the given query."""
    return f"Search results for {query}"

def calculator(expression: str) -> str:
    """Calculate the given mathematical expression."""
    return "42"

# 2. Initialize governance middleware
governance = TealTigerGuardrail(
    policies=["tool_allowlist:web_search,calculator", "pii_block", "cost_limit:5.00"],
    mode="enforce",
)

# 3. Create the agent with governance hooks attached
agent = Agent(
    name="research-agent",
    instructions="You help with research and math.",
    tools=[web_search, calculator],
    input_guardrails=[governance.input_guard],
    output_guardrails=[governance.output_guard],
)

def main():
    print("--- Running Governed OpenAI Agent ---")
    try:
        # 4. Run the agent natively
        result = Runner.run_sync(agent, "Find earnings data for ACME Corp and calculate ROI")
        print(f"Final Result: {result}")
    except Exception as e:
        print(f"❌ Governance Blocked Execution: {e}")

if __name__ == "__main__":
    # Ensure OPENAI_API_KEY is set
    main()

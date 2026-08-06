import os
from anthropic_tealtiger import TealAnthropic
from tealtiger import GovernanceDenyError

# Initialize drop-in governed client
client = TealAnthropic(
    api_key=os.environ.get("ANTHROPIC_API_KEY", "dummy-key"),
    guardrails={"secret_detection": True, "pii_detection": True},
    budget={"max_cost_per_session": 10.00},
)

# Example tool definition
tools = [
    {
        "name": "query_database",
        "description": "Query the user database",
        "input_schema": {
            "type": "object",
            "properties": {
                "user_id": {"type": "string"},
                "query": {"type": "string"},
            },
            "required": ["user_id", "query"],
        }
    }
]

def main():
    print("--- Sending governed request to Anthropic ---")
    try:
        # All tool-use responses are governed before execution
        response = client.messages.create(
            model="claude-3-sonnet-20240229",
            messages=[{"role": "user", "content": "Query the database for user record with ID 12345"}],
            tools=tools,
            max_tokens=500
        )
        
        print("\nAnthropic Response:")
        for block in response.content:
            if block.type == "tool_use":
                print(f"✅ Approved Tool Call: {block.name}")
                print(f"   Args: {block.input}")
            elif block.type == "text":
                print(f"💬 Text: {block.text}")
                
    except GovernanceDenyError as e:
        print(f"\n❌ Governance Denied the request!")
        print(f"Reason: {e}")

if __name__ == "__main__":
    # Note: Requires a valid ANTHROPIC_API_KEY in the environment
    main()

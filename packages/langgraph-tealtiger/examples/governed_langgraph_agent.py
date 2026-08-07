from typing import Annotated, TypedDict
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from tealtiger.integrations.langgraph import governance_node, should_continue

class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    governance_decision: str
    governance_reason: str

def dummy_llm_node(state: AgentState):
    """Simulates an LLM returning a tool call."""
    messages = state["messages"]
    
    # Simulate a response that includes a tool call to 'fetch_data'
    ai_message = AIMessage(
        content="",
        tool_calls=[{"name": "fetch_data", "args": {"query": "secret_user_id_123"}, "id": "call_1"}]
    )
    return {"messages": [ai_message]}

def execute_tool(state: AgentState):
    """Executes the tool if governance allows it."""
    print("✅ Executing tool...")
    return state

def handle_blocked(state: AgentState):
    """Handles the blocked governance state."""
    reason = state.get("governance_reason", "Unknown reason")
    print(f"❌ Governance Blocked Action. Reason: {reason}")
    return state

def build_governed_graph():
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("llm", dummy_llm_node)
    workflow.add_node("governance", governance_node)
    workflow.add_node("execute_tool", execute_tool)
    workflow.add_node("blocked", handle_blocked)
    
    # Build edges
    workflow.add_edge(START, "llm")
    workflow.add_edge("llm", "governance")
    
    # Conditional routing based on TealTiger's decision
    workflow.add_conditional_edges(
        "governance",
        should_continue,
        {
            "continue": "execute_tool",
            "blocked": "blocked"
        }
    )
    
    workflow.add_edge("execute_tool", END)
    workflow.add_edge("blocked", END)
    
    return workflow.compile()

if __name__ == "__main__":
    print("--- Running Governed LangGraph Agent ---")
    app = build_governed_graph()
    initial_state = {"messages": [HumanMessage(content="Fetch data for my account")]}
    
    # The dummy LLM will propose a tool call, which governance will intercept
    for output in app.stream(initial_state):
        for key, value in output.items():
            print(f"Node '{key}' finished execution.")

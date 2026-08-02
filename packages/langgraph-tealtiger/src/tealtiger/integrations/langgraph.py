import logging
from typing import Dict, Any, List
from langchain_core.messages import AIMessage, ToolCall
from tealtiger import TealTigerGuard

logger = logging.getLogger(__name__)

def governance_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LangGraph node that evaluates the latest agent message for policy violations.
    It expects the state to have a 'messages' key containing LangChain messages.
    Sets 'governance_decision' in the state.
    """
    messages = state.get("messages", [])
    if not messages:
        return {"governance_decision": "continue"}

    last_message = messages[-1]
    
    # We only need to govern the agent's proposed actions/outputs
    if not isinstance(last_message, AIMessage):
        return {"governance_decision": "continue"}

    # Initialize guard (in a real scenario, policies might be passed via state or env)
    guard = TealTigerGuard(mode="ENFORCE")
    
    # 1. Evaluate Tool Calls
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        for tool_call in last_message.tool_calls:
            decision = guard.evaluate(
                tool=tool_call["name"], 
                args=tool_call.get("args", {})
            )
            # Example check: if PII is detected, block it
            if decision.get("pii_detected") or decision.get("action") == "DENY":
                logger.warning(f"Governance blocked tool call: {tool_call['name']}")
                return {"governance_decision": "blocked", "governance_reason": decision.get("reason", "Policy violation")}

    # 2. Evaluate general text output for PII
    if last_message.content:
        decision = guard.evaluate(text=str(last_message.content))
        if decision.get("pii_detected") or decision.get("action") == "DENY":
            logger.warning("Governance blocked text output")
            return {"governance_decision": "blocked", "governance_reason": decision.get("reason", "PII detected in text")}

    return {"governance_decision": "continue"}

def should_continue(state: Dict[str, Any]) -> str:
    """
    Conditional edge function that routes based on the governance decision.
    """
    decision = state.get("governance_decision", "continue")
    if decision == "blocked":
        return "blocked"
    return "continue"

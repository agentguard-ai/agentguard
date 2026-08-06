import pytest
from unittest.mock import patch, MagicMock
from langchain_core.messages import AIMessage, HumanMessage
from tealtiger.integrations.langgraph import governance_node, should_continue

def test_should_continue():
    assert should_continue({"governance_decision": "blocked"}) == "blocked"
    assert should_continue({"governance_decision": "continue"}) == "continue"
    assert should_continue({}) == "continue"

def test_governance_node_no_messages():
    state = {}
    result = governance_node(state)
    assert result == {"governance_decision": "continue"}

def test_governance_node_not_aimessage():
    state = {"messages": [HumanMessage(content="Hello")]}
    result = governance_node(state)
    assert result == {"governance_decision": "continue"}

@patch("tealtiger.integrations.langgraph.TealTigerGuard")
def test_governance_node_tool_call_blocked(mock_guard_class):
    mock_guard = MagicMock()
    mock_guard.evaluate.return_value = {"action": "DENY", "reason": "Unauthorized tool"}
    mock_guard_class.return_value = mock_guard
    
    ai_msg = AIMessage(content="", tool_calls=[{"name": "dangerous_tool", "args": {}}])
    
    state = {"messages": [ai_msg]}
    result = governance_node(state)
    
    assert result["governance_decision"] == "blocked"
    assert result["governance_reason"] == "Unauthorized tool"
    mock_guard.evaluate.assert_called_once_with(tool="dangerous_tool", args={})

@patch("tealtiger.integrations.langgraph.TealTigerGuard")
def test_governance_node_text_blocked(mock_guard_class):
    mock_guard = MagicMock()
    mock_guard.evaluate.return_value = {"pii_detected": True, "reason": "PII in text"}
    mock_guard_class.return_value = mock_guard
    
    ai_msg = AIMessage(content="My social security number is 123-456-7890")
    
    state = {"messages": [ai_msg]}
    result = governance_node(state)
    
    assert result["governance_decision"] == "blocked"
    assert result["governance_reason"] == "PII in text"
    mock_guard.evaluate.assert_called_once_with(text="My social security number is 123-456-7890")

@patch("tealtiger.integrations.langgraph.TealTigerGuard")
def test_governance_node_allowed(mock_guard_class):
    mock_guard = MagicMock()
    mock_guard.evaluate.return_value = {"action": "ALLOW"}
    mock_guard_class.return_value = mock_guard
    
    ai_msg = AIMessage(content="Hello, how can I help you?", tool_calls=[{"name": "safe_tool", "args": {}}])
    
    state = {"messages": [ai_msg]}
    result = governance_node(state)
    
    assert result["governance_decision"] == "continue"
    assert mock_guard.evaluate.call_count == 2

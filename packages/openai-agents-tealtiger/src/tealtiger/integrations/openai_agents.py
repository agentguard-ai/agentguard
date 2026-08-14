import logging
from typing import List, Any, Optional

from tealtiger import TealTigerGuard, GovernanceDenyError

logger = logging.getLogger(__name__)

class TealTigerGuardrail:
    """
    TealTiger governance middleware for OpenAI Agents SDK.
    Intercepts inputs, outputs, and tool calls for policy enforcement.
    """
    def __init__(self, policies: List[str], mode: str = "enforce"):
        self.policies = policies
        self.mode = mode
        
        # Parse basic policies to config
        budget_limit = None
        for policy in policies:
            if policy.startswith("cost_limit:"):
                try:
                    budget_limit = float(policy.split(":")[1])
                except ValueError:
                    pass
                    
        self.guard = TealTigerGuard(
            mode=mode.upper(),
            budget_limit=budget_limit
        )

    def input_guard(self, context: Any, message: Any) -> Any:
        """
        Intercepts incoming messages to the agent.
        """
        if "pii_block" in self.policies:
            # Check text for PII
            # message is typically a string or dict with content in OpenAI Agents SDK
            content = message if isinstance(message, str) else getattr(message, 'content', '')
            decision = self.guard.evaluate(text=content)
            
            if decision.get("pii_detected"):
                raise GovernanceDenyError(decision, "PII detected in input message.")
        return message

    def output_guard(self, context: Any, message: Any) -> Any:
        """
        Intercepts outgoing messages and tool calls from the agent.
        """
        # If it's a tool call request
        if hasattr(message, "tool_calls") and message.tool_calls:
            for tc in message.tool_calls:
                # Check tool policy
                decision = self.guard.evaluate(tool=tc.function.name, args=tc.function.arguments)
                
                if "pii_block" in self.policies and decision.get("pii_detected"):
                    raise GovernanceDenyError(decision, f"PII detected in arguments for tool {tc.function.name}")
                    
                allowed_tools = []
                for p in self.policies:
                    if p.startswith("tool_allowlist:"):
                        allowed_tools.extend(p.split(":")[1].split(","))
                        
                if allowed_tools and tc.function.name not in allowed_tools:
                    raise GovernanceDenyError(decision, f"Tool {tc.function.name} is not in the allowlist.")

        # If it's a standard text response
        if "pii_block" in self.policies:
            content = message if isinstance(message, str) else getattr(message, 'content', '')
            if content:
                decision = self.guard.evaluate(text=content)
                if decision.get("pii_detected"):
                    raise GovernanceDenyError(decision, "PII detected in output message.")
                    
        return message

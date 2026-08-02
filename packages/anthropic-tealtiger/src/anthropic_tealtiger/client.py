import os
from typing import Any, Dict, List, Optional
from anthropic import Anthropic, AsyncAnthropic
from anthropic.resources.messages import Messages, AsyncMessages

class GovernedMessages:
    def __init__(self, parent_messages: Messages, guardrails: dict, budget: dict):
        self._messages = parent_messages
        self.guardrails = guardrails
        self.budget = budget
        
        # In a real implementation, we would initialize TealEngine or TealTigerGuard here
        from tealtiger import TealTigerGuard
        self.guard = TealTigerGuard(
            mode="ENFORCE",
            budget_limit=self.budget.get("max_cost_per_session") if self.budget else None
        )

    def create(self, *args, **kwargs):
        response = self._messages.create(*args, **kwargs)
        
        # Track cost using Anthropic's usage block
        if hasattr(response, "usage") and response.usage:
            usage = {
                "prompt_tokens": getattr(response.usage, "input_tokens", 0),
                "completion_tokens": getattr(response.usage, "output_tokens", 0),
                "total_tokens": getattr(response.usage, "input_tokens", 0) + getattr(response.usage, "output_tokens", 0),
            }
            # Record base cost for the completion
            self.guard.post_call(tool_name="anthropic_completion", result="", token_usage=usage)

        # Evaluate tools if the model decided to use them
        for block in response.content:
            if block.type == 'tool_use':
                # Evaluate tool before execution
                decision = self.guard.evaluate(tool=block.name, args=block.input)
                
                # Check for PII if enabled
                if self.guardrails.get("pii_detection") and decision.get("pii_detected"):
                    from tealtiger import GovernanceDenyError
                    raise GovernanceDenyError(decision, f"PII detected in arguments for tool {block.name}")
                
        return response

class GovernedAsyncMessages:
    def __init__(self, parent_messages: AsyncMessages, guardrails: dict, budget: dict):
        self._messages = parent_messages
        self.guardrails = guardrails
        self.budget = budget
        
        from tealtiger import TealTigerGuard
        self.guard = TealTigerGuard(
            mode="ENFORCE",
            budget_limit=self.budget.get("max_cost_per_session") if self.budget else None
        )

    async def create(self, *args, **kwargs):
        response = await self._messages.create(*args, **kwargs)
        
        if hasattr(response, "usage") and response.usage:
            usage = {
                "prompt_tokens": getattr(response.usage, "input_tokens", 0),
                "completion_tokens": getattr(response.usage, "output_tokens", 0),
                "total_tokens": getattr(response.usage, "input_tokens", 0) + getattr(response.usage, "output_tokens", 0),
            }
            self.guard.post_call(tool_name="anthropic_completion", result="", token_usage=usage)

        for block in response.content:
            if block.type == 'tool_use':
                decision = self.guard.evaluate(tool=block.name, args=block.input)
                if self.guardrails.get("pii_detection") and decision.get("pii_detected"):
                    from tealtiger import GovernanceDenyError
                    raise GovernanceDenyError(decision, f"PII detected in arguments for tool {block.name}")
                    
        return response

class TealAnthropic(Anthropic):
    def __init__(self, *args, guardrails: Optional[Dict[str, Any]] = None, budget: Optional[Dict[str, Any]] = None, **kwargs):
        super().__init__(*args, **kwargs)
        self.guardrails = guardrails or {}
        self.budget = budget or {}
        
        # Override the messages property to use our governed wrapper
        self.messages = GovernedMessages(super().messages, self.guardrails, self.budget)

class AsyncTealAnthropic(AsyncAnthropic):
    def __init__(self, *args, guardrails: Optional[Dict[str, Any]] = None, budget: Optional[Dict[str, Any]] = None, **kwargs):
        super().__init__(*args, **kwargs)
        self.guardrails = guardrails or {}
        self.budget = budget or {}
        
        self.messages = GovernedAsyncMessages(super().messages, self.guardrails, self.budget)

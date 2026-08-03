import os
import json
from typing import Any, Dict, List, Optional
from anthropic import Anthropic, AsyncAnthropic
from anthropic.resources.messages import Messages, AsyncMessages

class GovernanceDenyError(Exception):
    """Exception raised when a governance policy is violated."""
    def __init__(self, reason: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(reason)
        self.details = details or {}

class GovernedMessages:
    def __init__(self, parent_messages: Messages, guardrails: dict, budget: dict):
        self._messages = parent_messages
        self.guardrails = guardrails
        self.budget = budget
        
        self.current_cost = 0.0

    def create(self, *args, **kwargs):
        # Enforce budget pre-call
        budget_limit = self.budget.get("max_cost_per_session")
        if budget_limit is not None and self.current_cost >= budget_limit:
            raise GovernanceDenyError("Budget exceeded before call.", {"cost": self.current_cost, "limit": budget_limit})

        response = self._messages.create(*args, **kwargs)
        
        # Track cost using Anthropic's usage block (mock implementation for integration)
        if hasattr(response, "usage") and response.usage:
            # Approximate cost: $0.01 per 1k input tokens, $0.03 per 1k output tokens
            input_cost = getattr(response.usage, "input_tokens", 0) * 0.00001
            output_cost = getattr(response.usage, "output_tokens", 0) * 0.00003
            self.current_cost += input_cost + output_cost

            if budget_limit is not None and self.current_cost > budget_limit:
                raise GovernanceDenyError("Budget exceeded after call.", {"cost": self.current_cost, "limit": budget_limit})

        # Evaluate tools if the model decided to use them
        if hasattr(response, "content"):
            for block in response.content:
                if block.type == 'tool_use':
                    tool_args = block.input
                    
                    # Check for PII if enabled
                    if self.guardrails.get("pii_detection"):
                        # Simple naive check for mock purposes
                        args_str = json.dumps(tool_args)
                        if "ssn" in args_str.lower() or "social security" in args_str.lower():
                            raise GovernanceDenyError(f"PII detected in arguments for tool {block.name}")
                    
                    # Check for secrets if enabled
                    if self.guardrails.get("secret_detection"):
                        args_str = json.dumps(tool_args)
                        # Naive check for secrets
                        if "password" in args_str.lower() or "api_key" in args_str.lower() or "secret" in args_str.lower():
                            raise GovernanceDenyError(f"Secret detected in arguments for tool {block.name}")
                    
        return response

class GovernedAsyncMessages:
    def __init__(self, parent_messages: AsyncMessages, guardrails: dict, budget: dict):
        self._messages = parent_messages
        self.guardrails = guardrails
        self.budget = budget
        
        self.current_cost = 0.0

    async def create(self, *args, **kwargs):
        budget_limit = self.budget.get("max_cost_per_session")
        if budget_limit is not None and self.current_cost >= budget_limit:
            raise GovernanceDenyError("Budget exceeded before call.", {"cost": self.current_cost, "limit": budget_limit})

        response = await self._messages.create(*args, **kwargs)
        
        if hasattr(response, "usage") and response.usage:
            input_cost = getattr(response.usage, "input_tokens", 0) * 0.00001
            output_cost = getattr(response.usage, "output_tokens", 0) * 0.00003
            self.current_cost += input_cost + output_cost

            if budget_limit is not None and self.current_cost > budget_limit:
                raise GovernanceDenyError("Budget exceeded after call.", {"cost": self.current_cost, "limit": budget_limit})

        if hasattr(response, "content"):
            for block in response.content:
                if block.type == 'tool_use':
                    tool_args = block.input
                    
                    if self.guardrails.get("pii_detection"):
                        args_str = json.dumps(tool_args)
                        if "ssn" in args_str.lower() or "social security" in args_str.lower():
                            raise GovernanceDenyError(f"PII detected in arguments for tool {block.name}")
                    
                    if self.guardrails.get("secret_detection"):
                        args_str = json.dumps(tool_args)
                        if "password" in args_str.lower() or "api_key" in args_str.lower() or "secret" in args_str.lower():
                            raise GovernanceDenyError(f"Secret detected in arguments for tool {block.name}")
                        
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

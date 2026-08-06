"""
title: TealTiger Governance Filter
author: TealTiger Team
author_url: https://tealtiger.ai
version: 0.1.0
description: Scans messages for PII and secrets before they reach the local LLM and before they are returned to the user.
"""

from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from tealtiger import TealTigerGuard

class Filter:
    class Valves(BaseModel):
        tealtiger_api_key: str = Field(
            default="", 
            description="API Key for TealTiger Governance engine."
        )
        pii_detection: bool = Field(
            default=True, 
            description="Enable PII and Secrets detection."
        )
        governance_mode: str = Field(
            default="ENFORCE", 
            description="Mode of operation: ENFORCE or AUDIT."
        )

    def __init__(self):
        self.valves = self.Valves()
        self.guard = None

    def _get_guard(self) -> TealTigerGuard:
        if not self.guard:
            self.guard = TealTigerGuard(
                api_key=self.valves.tealtiger_api_key,
                mode=self.valves.governance_mode
            )
        return self.guard

    def inlet(self, body: dict, __user__: Optional[dict] = None) -> dict:
        """
        Scans the user's input messages before they reach the LLM.
        """
        if not self.valves.pii_detection:
            return body

        messages = body.get("messages", [])
        if not messages:
            return body

        # Get the latest user message
        last_message = messages[-1]
        if last_message.get("role") == "user":
            content = last_message.get("content", "")
            
            # Evaluate using TealTiger
            decision = self._get_guard().evaluate(text=content)
            
            if decision.get("pii_detected") or decision.get("action") == "DENY":
                raise Exception(
                    f"🛑 [TealTiger Governance Blocked]: {decision.get('reason', 'Policy violation detected in input.')}"
                )

        return body

    def outlet(self, body: dict, __user__: Optional[dict] = None) -> dict:
        """
        Scans the LLM's output messages before they reach the user.
        """
        if not self.valves.pii_detection:
            return body

        messages = body.get("messages", [])
        if not messages:
            return body

        # Get the latest assistant message
        last_message = messages[-1]
        if last_message.get("role") == "assistant":
            content = last_message.get("content", "")
            
            # Evaluate using TealTiger
            decision = self._get_guard().evaluate(text=content)
            
            if decision.get("pii_detected") or decision.get("action") == "DENY":
                # Provide a visual indicator in the chat
                last_message["content"] = f"🛑 **[TealTiger Governance Blocked]**: The model's response violated security policies (Reason: {decision.get('reason')})."

        return body

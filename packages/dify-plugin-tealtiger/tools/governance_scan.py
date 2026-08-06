from dify_plugin import Tool
from typing import Any, Dict
import os
from tealtiger import TealGuard

class TealTigerGovernanceTool(Tool):
    def _invoke(self, tool_parameters: Dict[str, Any]) -> Dict[str, Any]:
        api_key = self.runtime.credentials.get("api_key")
        if not api_key:
            return {
                "error": "api_key is missing",
                "decision": "DENY",
                "reason": "Missing TealTiger API key"
            }

        content = tool_parameters.get("content", "")
        pii_detection = tool_parameters.get("pii_detection", True)
        prompt_injection = tool_parameters.get("prompt_injection", True)
        content_moderation = tool_parameters.get("content_moderation", True)
        secret_detection = tool_parameters.get("secret_detection", True)
        # Note: Budget is retrieved but not enforced by TealGuard as it is a local scan.
        
        # Initialize TealTiger client (TealGuard for deterministic scanning)
        try:
            # TealGuard SDK respects the API key via env var if needed by any remote stages
            os.environ["TEALTIGER_API_KEY"] = api_key
            
            guard = TealGuard(
                guardrails={
                    "pre": {
                        "pii": pii_detection,
                        "injection": prompt_injection,
                        "content": content_moderation,
                        "secrets": secret_detection
                    }
                }
            )
            
            # Evaluate content deterministically without incurring LLM cost
            decision_obj = guard.evaluate_sync({"content": content})
            
            return {
                "decision": decision_obj.action,
                "content_evaluated": content,
                "security_info": {
                    "action": decision_obj.action,
                    "risk_score": getattr(decision_obj, "risk_score", 0.0),
                    "reason_codes": getattr(decision_obj, "reason_codes", []),
                    "short_circuited": getattr(decision_obj, "short_circuited", False),
                    "total_latency_ms": getattr(decision_obj, "total_latency_ms", 0.0)
                }
            }
        except Exception as e:
            return {
                "error": str(e),
                "decision": "DENY",
                "reason": f"TealTiger evaluation failed: {str(e)}"
            }

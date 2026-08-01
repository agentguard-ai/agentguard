from dify_plugin import Tool
from typing import Any, Dict
import os
from tealtiger import TealOpenAI

class TealTigerGovernanceTool(Tool):
    def _invoke(self, tool_parameters: Dict[str, Any]) -> Dict[str, Any]:
        api_key = self.runtime.credentials.get("api_key")
        content = tool_parameters.get("content", "")
        pii_detection = tool_parameters.get("pii_detection", True)
        prompt_injection = tool_parameters.get("prompt_injection", True)
        content_moderation = tool_parameters.get("content_moderation", True)
        budget = float(tool_parameters.get("budget", 0.0))
        
        # Initialize TealTiger client
        try:
            client_args = {
                "api_key": api_key,
                "guardrails": {
                    "pii_detection": pii_detection,
                    "prompt_injection": prompt_injection,
                    "content_moderation": content_moderation
                }
            }
            if budget > 0:
                client_args["budget"] = budget
                
            client = TealOpenAI(**client_args)
            
            # Evaluate content using TealTiger
            res = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": content}]
            )
            
            decision = getattr(res, 'security', {}).get('decision', 'ALLOW')
            
            return {
                "decision": decision,
                "content_evaluated": content,
                "security_info": getattr(res, 'security', {})
            }
        except Exception as e:
            return {
                "error": str(e),
                "decision": "DENY",
                "reason": "TealTiger evaluation failed"
            }

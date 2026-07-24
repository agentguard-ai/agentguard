@hadarishav Thanks for the interest! Happy to help scope this.

@azain-commits @NVJKKartik — to make the discussion concrete, here's how I'd approach the integration:

**Minimal first version (gateway plugin):**

```python
# future_agi/guardrails/tealtiger_plugin.py
from tealtiger import TealEngine

class TealTigerGuardrail:
    def __init__(self, policies, mode="enforce"):
        self.engine = TealEngine(policies=policies, mode=mode)

    def evaluate(self, request):
        """Called by gateway before routing to provider."""
        decision = self.engine.evaluate(
            tool_name=request.tool or request.model,
            tool_args=request.messages[-1].content,
            agent_id=request.metadata.get("agent_id", "default"),
        )
        if decision["action"] == "DENY":
            return GuardrailBlock(reason=decision["reason_codes"])
        return GuardrailAllow()
```

**What I'd need from the team:**

1. Where guardrails hook into the gateway request lifecycle (pre-route?)
2. The guardrail plugin interface/protocol (if one exists, or the shape you'd want)
3. Whether OTel spans are auto-collected or I should emit them explicitly

I can work against a draft interface and submit a PR. The TealTiger side is already built — just need to wire it into Future AGI's plugin system.

Happy to jump on a quick call or async thread to align on the design. Let me know what works.

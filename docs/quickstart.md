# Getting Started in 5 Minutes

Copy-paste path from `pip install` to a governed agent. **No API key required** — examples use a mock OpenAI client.

## Install

```bash
pip install tealtiger
```

## The full example

Save as `quickstart.py` (or run [`examples/quickstart_governance.py`](../examples/quickstart_governance.py)):

```python
import asyncio, fnmatch, json
from tealtiger import observe
from tealtiger.pipeline.modules.pre.pii_scanner import PIIPattern, PIIScannerConfig, PIIScannerModule

POLICIES = {"pii_block": ["ssn"], "tool_allowlist": ["search", "read_*"]}
PII = PIIScannerModule(PIIScannerConfig(
    patterns=[PIIPattern("ssn", r"\b\d{3}-\d{2}-\d{4}\b", 0.95)], threshold=0.5))

class MockOpenAI:
    def __init__(self):
        self.chat = self._Chat()
        self.base_url = "https://api.openai.com/v1"

    class _Chat:
        def __init__(self):
            self.completions = MockOpenAI._Completions()

    class _Completions:
        @staticmethod
        def create(**kwargs):
            msg = type("Msg", (), {"content": "Hello!"})()
            return type("R", (), {"choices": [type("C", (), {"message": msg})()]})()

async def govern(tool, args, mode="ENFORCE"):
    scan = await PII.evaluate({"tool": tool, "content": json.dumps(args)}, {}, {})
    codes = list(scan.get("reason_codes", []))
    if not any(fnmatch.fnmatch(tool, p) for p in POLICIES["tool_allowlist"]):
        codes.append("TOOL_NOT_ALLOWED")
    blocked = bool(codes)
    return {"action": "DENY" if blocked and mode == "ENFORCE" else "ALLOW",
            "mode": mode, "reason_codes": codes or ["POLICY_COMPLIANT"], "tool": tool}

async def main():
    client = observe(MockOpenAI())  # one line — cost + audit, no config
    client.chat.completions.create(model="gpt-4o-mini", messages=[{"role": "user", "content": "Hi"}])
    print("observe():", client.get_cost().request_count, "request tracked")
    for mode in ("MONITOR", "ENFORCE"):
        for tool, args in [("search", {"q": "docs"}), ("delete", {}),
                           ("read_file", {"path": "a.txt"}), ("search", {"note": "SSN 123-45-6789"})]:
            print(json.dumps(await govern(tool, args, mode)))

asyncio.run(main())
```

## What each step does

### 1. Zero-config `observe()`

`observe(client)` wraps your existing OpenAI (or 12 other provider) client. You keep the same API; TealTiger adds cost tracking, audit logs, and passive PII scanning — no policy file required.

In production, replace `MockOpenAI()` with `OpenAI()` and your API key.

### 2. PII policy — block SSNs in tool arguments

`PIIScannerModule` scans tool argument text. When an SSN pattern is found, the decision includes `PII_DETECTED` in `reason_codes`.

### 3. Tool allowlist — only `search` and `read_*`

The allowlist uses shell-style patterns (`read_*` matches `read_file`, `read_docs`, etc.). Calls to other tools add `TOOL_NOT_ALLOWED`.

### 4. Governance decision output (JSON)

Every `govern()` call returns a structured decision you can log, export, or send to your SIEM:

```json
{
  "action": "DENY",
  "mode": "ENFORCE",
  "reason_codes": ["PII_DETECTED"],
  "tool": "search"
}
```

### 5. MONITOR vs ENFORCE

| Mode | Violation detected | Tool call runs? |
|------|-------------------|-----------------|
| **MONITOR** | Logged in `reason_codes` | Yes — `action` stays `ALLOW` |
| **ENFORCE** | Logged in `reason_codes` | No — `action` is `DENY` |

**MONITOR** (safe rollout): same violations are flagged, but nothing is blocked.

```json
{"action": "ALLOW", "mode": "MONITOR", "reason_codes": ["TOOL_NOT_ALLOWED"], "tool": "delete"}
```

**ENFORCE** (production): violations block the call.

```json
{"action": "DENY", "mode": "ENFORCE", "reason_codes": ["TOOL_NOT_ALLOWED"], "tool": "delete"}
```

## Next steps

- [Zero-config observe() cookbook](./v1.4-docs/cookbook/observe-quickstart.md)
- [TealGuard multi-stage defense](./v1.4-docs/api-reference/python/teal-guard-v14.md)
- [Policy schema](../schemas/tealtiger-policy.schema.json) for YAML/JSON policies
- [FAQ](./faq.md) · [Full docs](https://docs.tealtiger.ai)

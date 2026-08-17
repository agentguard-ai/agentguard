"""Getting Started in 5 Minutes — governed agent without API keys.

Run: python examples/quickstart_governance.py
"""

import asyncio
import fnmatch
import json

from tealtiger import observe
from tealtiger.pipeline.modules.pre.pii_scanner import (
    PIIPattern,
    PIIScannerConfig,
    PIIScannerModule,
)

POLICIES = {
    "pii_block": ["ssn"],
    "tool_allowlist": ["search", "read_*"],
}
PII = PIIScannerModule(
    PIIScannerConfig(
        patterns=[PIIPattern("ssn", r"\b\d{3}-\d{2}-\d{4}\b", 0.95)],
        threshold=0.5,
    )
)


class MockOpenAI:
    """Drop-in for OpenAI() — swap this for the real client in production."""

    def __init__(self) -> None:
        self.chat = self._Chat()
        self.base_url = "https://api.openai.com/v1"

    class _Chat:
        def __init__(self) -> None:
            self.completions = MockOpenAI._Completions()

    class _Completions:
        @staticmethod
        def create(**kwargs):
            msg = type("Msg", (), {"content": "Hello from TealTiger!"})()
            choice = type("Choice", (), {"message": msg})()
            return type("Response", (), {"choices": [choice]})()


async def govern(tool: str, args: dict, mode: str = "ENFORCE") -> dict:
    """Evaluate a tool call and return a governance decision dict."""
    request = {"tool": tool, "content": json.dumps(args)}
    scan = await PII.evaluate(request, {}, {})
    codes = list(scan.get("reason_codes", []))
    if not any(fnmatch.fnmatch(tool, pattern) for pattern in POLICIES["tool_allowlist"]):
        codes.append("TOOL_NOT_ALLOWED")
    blocked = bool(codes)
    return {
        "action": "DENY" if blocked and mode == "ENFORCE" else "ALLOW",
        "mode": mode,
        "reason_codes": codes or ["POLICY_COMPLIANT"],
        "tool": tool,
    }


async def main() -> None:
    # 1) Zero-config observe — cost tracking + audit trail, no policy file
    client = observe(MockOpenAI())
    client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "What is TealTiger?"}],
    )
    print("observe():", client.get_cost().request_count, "request(s) tracked")

    # 2) Tool-call policies — block SSNs + allowlist search/read_*
    cases = [
        ("search", {"query": "docs"}),
        ("delete_file", {"path": "/tmp/x"}),
        ("read_file", {"path": "notes.txt"}),
        ("search", {"note": "SSN 123-45-6789"}),
    ]
    for mode in ("MONITOR", "ENFORCE"):
        print(f"\n--- {mode} ---")
        for tool, args in cases:
            print(json.dumps(await govern(tool, args, mode)))


if __name__ == "__main__":
    asyncio.run(main())

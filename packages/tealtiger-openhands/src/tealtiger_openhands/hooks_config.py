"""Generator for .openhands/hooks.json configuration."""

import json
from typing import Any, Dict


def generate_hooks_json(
    config_path: str = ".openhands/governance.yml",
    matcher: str = "*",
    timeout: int = 5,
) -> Dict[str, Any]:
    return {
        "pre_tool_use": [
            {
                "matcher": matcher,
                "hooks": [
                    {
                        "command": f"tealtiger-openhands-hook --config {config_path}",
                        "timeout": timeout,
                    }
                ],
            }
        ]
    }

"""pytest bootstrap for the KYC agent example.

Adds ``src/`` to ``sys.path`` so tests can import ``agents.decision_agent`` and
``interfaces`` directly, without requiring a package install.
"""
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent
_SRC = _ROOT / "src"

if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

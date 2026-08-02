"""Policy definitions for Semantic Kernel governance.

Policies define what functions are allowed/denied, what content is scanned,
and under what mode the governance operates.
"""

from dataclasses import dataclass, field
from typing import List, Optional
import fnmatch
import re


@dataclass
class FunctionPolicy:
    """Function invocation control using plugin_name-function_name patterns.

    Patterns use glob-style matching:
    - "HttpPlugin-*" — block all functions in HttpPlugin
    - "*-delete_*" — block any function starting with delete_
    - "FilePlugin-write_file" — block a specific function
    - "*" — match everything

    Denylist is checked first. If a function matches the denylist, it's denied.
    If allowlist is non-empty, functions must match at least one allowlist pattern.
    """

    allowlist: List[str] = field(default_factory=list)
    denylist: List[str] = field(default_factory=list)

    def check(self, plugin_name: str, function_name: str) -> Optional[str]:
        """Check if a function invocation is allowed.

        Args:
            plugin_name: The Semantic Kernel plugin name.
            function_name: The function name within the plugin.

        Returns:
            A denial reason string, or None if allowed.
        """
        qualified = f"{plugin_name}-{function_name}"

        # Denylist takes priority
        for pattern in self.denylist:
            if _pattern_match(qualified, pattern):
                return (
                    f"Function denied: '{qualified}' matches denylist pattern '{pattern}'"
                )

        # If allowlist is empty, everything not denied is allowed
        if not self.allowlist:
            return None

        # Must match at least one allowlist entry
        for pattern in self.allowlist:
            if _pattern_match(qualified, pattern):
                return None

        return f"Function denied: '{qualified}' not in function allowlist"


@dataclass
class PIIScanPolicy:
    """PII scanning policy for function arguments.

    Scans function arguments for personally identifiable information
    such as email addresses, phone numbers, SSNs, and credit card numbers.
    """

    enabled: bool = True
    action: str = "block"  # "block" | "redact" | "log"
    categories: List[str] = field(default_factory=lambda: [
        "email", "phone", "ssn", "credit_card",
    ])

    _PATTERNS = {
        "email": re.compile(
            r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
        ),
        "phone": re.compile(
            r"\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"
        ),
        "ssn": re.compile(
            r"\b\d{3}-\d{2}-\d{4}\b"
        ),
        "credit_card": re.compile(
            r"\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6(?:011|5\d{2}))"
            r"[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b"
        ),
    }

    def scan(self, content: str) -> List[dict]:
        """Scan content for PII patterns.

        Args:
            content: Text content to scan.

        Returns:
            List of findings with type, category, and redacted snippet.
        """
        if not self.enabled:
            return []

        findings = []
        for category, pattern in self._PATTERNS.items():
            if category not in self.categories and "all" not in self.categories:
                continue
            for match in pattern.finditer(content):
                findings.append({
                    "type": "pii",
                    "category": category,
                    "start": match.start(),
                    "end": match.end(),
                    "snippet": _redact_snippet(match.group(), max_visible=4),
                })
        return findings


@dataclass
class SecretScanPolicy:
    """Secret/credential scanning policy for function arguments."""

    enabled: bool = True
    action: str = "block"
    categories: List[str] = field(default_factory=lambda: [
        "api_key", "password", "token", "private_key", "aws_key",
    ])

    _PATTERNS = {
        "api_key": re.compile(
            r"(?i)(?:api[_-]?key|apikey)\s*[:=]\s*['\"]?[a-zA-Z0-9_\-]{20,}['\"]?"
        ),
        "password": re.compile(
            r"(?i)(?:password|passwd|pwd)\s*[:=]\s*['\"][^'\"]{8,}['\"]"
        ),
        "token": re.compile(
            r"(?i)(?:token|bearer|auth)\s*[:=]\s*['\"]?[a-zA-Z0-9_\-.]{20,}['\"]?"
        ),
        "private_key": re.compile(
            r"-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----"
        ),
        "aws_key": re.compile(
            r"(?:AKIA|ASIA)[A-Z0-9]{16}"
        ),
    }

    def scan(self, content: str) -> List[dict]:
        """Scan content for secret patterns.

        Args:
            content: Text content to scan.

        Returns:
            List of findings with type, category, and redacted snippet.
        """
        if not self.enabled:
            return []

        findings = []
        for category, pattern in self._PATTERNS.items():
            if category not in self.categories and "all" not in self.categories:
                continue
            for match in pattern.finditer(content):
                findings.append({
                    "type": "secret",
                    "category": category,
                    "start": match.start(),
                    "end": match.end(),
                    "snippet": _redact_snippet(match.group(), max_visible=8),
                })
        return findings


@dataclass
class GovernancePolicy:
    """Top-level governance policy combining all sub-policies.

    Modes:
    - ENFORCE: Block violations. Function call is terminated.
    - MONITOR: Log violations but allow execution to proceed.
    - OBSERVE: Passthrough with full audit trail. Zero enforcement.
    """

    mode: str = "ENFORCE"
    function_policy: Optional[FunctionPolicy] = None
    pii_scan: Optional[PIIScanPolicy] = None
    secret_scan: Optional[SecretScanPolicy] = None
    default_cost_estimate: float = 0.002

    def __post_init__(self):
        valid_modes = {"ENFORCE", "MONITOR", "OBSERVE"}
        if self.mode not in valid_modes:
            raise ValueError(f"Invalid mode '{self.mode}'. Must be one of: {valid_modes}")


def _pattern_match(value: str, pattern: str) -> bool:
    """Match a value against a glob-style pattern."""
    return fnmatch.fnmatch(value, pattern)


def _redact_snippet(text: str, max_visible: int = 4) -> str:
    """Redact a snippet showing only first N characters."""
    if len(text) <= max_visible:
        return text
    return text[:max_visible] + "..." + "*" * min(8, len(text) - max_visible)

"""Policy definitions for OpenHands governance."""

from dataclasses import dataclass, field
from typing import List, Optional
import fnmatch
import re


@dataclass
class FilePolicy:
    """File access control policy using glob patterns."""

    read_allowlist: List[str] = field(default_factory=list)
    read_denylist: List[str] = field(default_factory=list)
    write_allowlist: List[str] = field(default_factory=list)
    write_denylist: List[str] = field(default_factory=list)

    def check_read(self, path: str) -> Optional[str]:
        normalized = _normalize_path(path)
        for pattern in self.read_denylist:
            if _glob_match(normalized, pattern):
                return f"File read denied: '{path}' matches denylist pattern '{pattern}'"
        if not self.read_allowlist:
            return None
        for pattern in self.read_allowlist:
            if _glob_match(normalized, pattern):
                return None
        return f"File read denied: '{path}' not in read allowlist"

    def check_write(self, path: str) -> Optional[str]:
        normalized = _normalize_path(path)
        for pattern in self.write_denylist:
            if _glob_match(normalized, pattern):
                return f"File write denied: '{path}' matches denylist pattern '{pattern}'"
        if not self.write_allowlist:
            return None
        for pattern in self.write_allowlist:
            if _glob_match(normalized, pattern):
                return None
        return f"File write denied: '{path}' not in write allowlist"


@dataclass
class CommandPolicy:
    """Command execution policy."""

    allowlist: List[str] = field(default_factory=list)
    denylist: List[str] = field(default_factory=list)
    block_network_access: bool = False

    _NETWORK_COMMANDS = {"curl", "wget", "nc", "ncat", "ssh", "scp", "sftp", "telnet", "ftp"}
    _NETWORK_PATTERNS = [
        re.compile(r"\bhttp[s]?://"),
        re.compile(r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b"),
    ]

    def check(self, command: str) -> Optional[str]:
        command_stripped = command.strip()
        for pattern in self.denylist:
            if pattern in command_stripped:
                return f"Command denied: matches denylist pattern '{pattern}'"
        if self.block_network_access:
            base_cmd = _extract_base_command(command_stripped)
            if base_cmd in self._NETWORK_COMMANDS:
                return f"Command denied: '{base_cmd}' blocked by network access policy"
            for net_pattern in self._NETWORK_PATTERNS:
                if net_pattern.search(command_stripped):
                    return f"Command denied: network access detected in '{command_stripped[:50]}...'"
        if not self.allowlist:
            return None
        base_cmd = _extract_base_command(command_stripped)
        if base_cmd in self.allowlist:
            return None
        for allowed in self.allowlist:
            if command_stripped.startswith(allowed):
                return None
        return f"Command denied: '{base_cmd}' not in command allowlist"


@dataclass
class SecretScanPolicy:
    """Secret/credential scanning policy for file writes."""

    enabled: bool = True
    action: str = "block"
    categories: List[str] = field(default_factory=lambda: [
        "api_key", "password", "token", "private_key", "aws_key", "connection_string"
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
        "connection_string": re.compile(
            r"(?i)(?:mongodb|postgres(?:ql)?|mysql|redis)://[^\s'\"]{10,}"
        ),
        "github_token": re.compile(
            r"gh[pousr]_[A-Za-z0-9_]{36,}"
        ),
    }

    def scan(self, content: str) -> List[dict]:
        findings = []
        for category, pattern in self._PATTERNS.items():
            if category not in self.categories and "all" not in self.categories:
                continue
            matches = pattern.finditer(content)
            for match in matches:
                findings.append({
                    "type": "secret",
                    "category": category,
                    "start": match.start(),
                    "end": match.end(),
                    "snippet": _redact_snippet(match.group(), max_visible=8),
                })
        return findings


@dataclass
class BudgetPolicy:
    """Cost and iteration budget policy."""

    per_session_usd: float = float("inf")
    max_iterations: int = 0

    _current_cost: float = 0.0
    _current_iterations: int = 0

    def track(self, estimated_cost: float = 0.002) -> None:
        self._current_cost += estimated_cost
        self._current_iterations += 1

    def check(self) -> Optional[str]:
        if self._current_cost >= self.per_session_usd:
            return (
                f"Budget exceeded: ${self._current_cost:.4f} >= "
                f"${self.per_session_usd:.2f} session limit"
            )
        if self.max_iterations > 0 and self._current_iterations >= self.max_iterations:
            return (
                f"Iteration limit exceeded: {self._current_iterations} >= "
                f"{self.max_iterations} max iterations"
            )
        return None

    @property
    def current_cost(self) -> float:
        return self._current_cost

    @property
    def current_iterations(self) -> int:
        return self._current_iterations


@dataclass
class GovernancePolicy:
    """Top-level governance policy combining all sub-policies."""

    mode: str = "ENFORCE"
    file_policy: Optional[FilePolicy] = None
    command_policy: Optional[CommandPolicy] = None
    secret_scan: Optional[SecretScanPolicy] = None
    budget: Optional[BudgetPolicy] = None

    def __post_init__(self):
        valid_modes = {"ENFORCE", "MONITOR", "OBSERVE"}
        if self.mode not in valid_modes:
            raise ValueError(f"Invalid mode '{self.mode}'. Must be one of: {valid_modes}")


def _normalize_path(path: str) -> str:
    if path.startswith("./"):
        path = path[2:]
    if path.startswith("/"):
        path = path[1:]
    path = path.replace("\\", "/")
    return path


def _glob_match(path: str, pattern: str) -> bool:
    pattern = pattern.replace("\\", "/")
    if "**" in pattern:
        regex_pattern = pattern.replace(".", r"\.")
        regex_pattern = regex_pattern.replace("**", "DOUBLESTAR")
        regex_pattern = regex_pattern.replace("*", "[^/]*")
        regex_pattern = regex_pattern.replace("DOUBLESTAR", ".*")
        regex_pattern = f"^{regex_pattern}$"
        return bool(re.match(regex_pattern, path))
    return fnmatch.fnmatch(path, pattern)


def _extract_base_command(command: str) -> str:
    if "|" in command:
        command = command.split("|")[0].strip()
    if "&&" in command:
        command = command.split("&&")[0].strip()
    parts = command.split()
    if not parts:
        return ""
    base = parts[0]
    if "/" in base:
        base = base.rsplit("/", 1)[-1]
    return base


def _redact_snippet(text: str, max_visible: int = 8) -> str:
    if len(text) <= max_visible:
        return text
    return text[:max_visible] + "..." + "*" * min(8, len(text) - max_visible)

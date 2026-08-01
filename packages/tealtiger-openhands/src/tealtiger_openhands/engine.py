"""Governance engine for OpenHands hook evaluation."""

import time
from typing import Any, Dict, List, Optional

from tealtiger_openhands.decision import Decision, DecisionAction
from tealtiger_openhands.policy import GovernancePolicy


class GovernanceEngine:
    """Deterministic governance engine for OpenHands hooks."""

    def __init__(self, policy: GovernancePolicy):
        self.policy = policy
        self._decisions: List[Decision] = []
        self._frozen_sessions: set = set()

    def evaluate(self, event: Dict[str, Any]) -> Decision:
        start_time = time.perf_counter()
        tool_name = event.get("tool_name", "")
        tool_input = event.get("tool_input", {})
        session_id = event.get("session_id", "")

        if self._is_frozen(session_id):
            return self._make_decision(
                action=DecisionAction.DENY,
                reason=f"Session '{session_id}' is frozen by kill switch",
                reason_codes=["SESSION_FROZEN"],
                risk_score=1.0,
                tool_name=tool_name, tool_input=tool_input,
                session_id=session_id, start_time=start_time,
            )

        if self.policy.budget:
            budget_denial = self.policy.budget.check()
            if budget_denial:
                return self._make_decision(
                    action=DecisionAction.DENY, reason=budget_denial,
                    reason_codes=["BUDGET_EXCEEDED"], risk_score=0.8,
                    tool_name=tool_name, tool_input=tool_input,
                    session_id=session_id, start_time=start_time,
                )

        if tool_name == "terminal":
            decision = self._evaluate_command(tool_input, tool_name, session_id, start_time)
        elif tool_name in ("file_editor", "str_replace_editor"):
            decision = self._evaluate_file_operation(tool_input, tool_name, session_id, start_time)
        elif tool_name == "browser":
            decision = self._evaluate_browser(tool_input, tool_name, session_id, start_time)
        else:
            decision = self._make_decision(
                action=DecisionAction.ALLOW,
                reason=f"Tool '{tool_name}' allowed (no specific policy)",
                reason_codes=["NO_POLICY"],
                tool_name=tool_name, tool_input=tool_input,
                session_id=session_id, start_time=start_time,
            )

        if self.policy.budget and decision.is_allowed:
            self.policy.budget.track()

        if not decision.is_allowed and self.policy.mode != "ENFORCE":
            decision = self._make_decision(
                action=DecisionAction.ALLOW,
                reason=f"[{self.policy.mode}] Would deny: {decision.reason}",
                reason_codes=decision.reason_codes + ["MODE_PASSTHROUGH"],
                risk_score=decision.risk_score, findings=decision.findings,
                tool_name=tool_name, tool_input=tool_input,
                session_id=session_id, start_time=start_time,
            )

        self._decisions.append(decision)
        return decision

    def freeze(self, session_id: str = "*") -> None:
        self._frozen_sessions.add(session_id)

    def unfreeze(self, session_id: str = "*") -> None:
        self._frozen_sessions.discard(session_id)

    @property
    def decisions(self) -> List[Decision]:
        return list(self._decisions)

    @property
    def audit_trail(self) -> List[Dict[str, Any]]:
        return [d.to_dict() for d in self._decisions]

    def _is_frozen(self, session_id: str) -> bool:
        return "*" in self._frozen_sessions or session_id in self._frozen_sessions

    def _evaluate_command(self, tool_input, tool_name, session_id, start_time):
        command = tool_input.get("command", "")
        if not self.policy.command_policy:
            return self._make_decision(
                action=DecisionAction.ALLOW, reason="No command policy configured",
                reason_codes=["NO_POLICY"], tool_name=tool_name,
                tool_input=tool_input, session_id=session_id, start_time=start_time,
            )
        denial = self.policy.command_policy.check(command)
        if denial:
            return self._make_decision(
                action=DecisionAction.DENY, reason=denial,
                reason_codes=["COMMAND_DENIED"], risk_score=0.9,
                tool_name=tool_name, tool_input=tool_input,
                session_id=session_id, start_time=start_time,
            )
        return self._make_decision(
            action=DecisionAction.ALLOW, reason=f"Command allowed: '{command[:60]}'",
            reason_codes=["COMMAND_ALLOWED"], tool_name=tool_name,
            tool_input=tool_input, session_id=session_id, start_time=start_time,
        )

    def _evaluate_file_operation(self, tool_input, tool_name, session_id, start_time):
        command = tool_input.get("command", "")
        path = tool_input.get("path", "")
        new_str = tool_input.get("new_str", "")
        file_text = tool_input.get("file_text", "")

        is_write = bool(new_str or file_text or command == "create")
        is_read = command == "view" or (not is_write and path)
        findings = []

        if self.policy.file_policy:
            if is_write:
                denial = self.policy.file_policy.check_write(path)
            elif is_read:
                denial = self.policy.file_policy.check_read(path)
            else:
                denial = None
            if denial:
                return self._make_decision(
                    action=DecisionAction.DENY, reason=denial,
                    reason_codes=["FILE_ACCESS_DENIED"], risk_score=0.8,
                    tool_name=tool_name, tool_input=tool_input,
                    session_id=session_id, start_time=start_time,
                )

        if is_write and self.policy.secret_scan and self.policy.secret_scan.enabled:
            content = new_str or file_text or ""
            secret_findings = self.policy.secret_scan.scan(content)
            if secret_findings:
                findings.extend(secret_findings)
                if self.policy.secret_scan.action == "block":
                    categories = list(set(f["category"] for f in secret_findings))
                    return self._make_decision(
                        action=DecisionAction.DENY,
                        reason=f"Secrets detected in file write: {', '.join(categories)}",
                        reason_codes=["SECRET_DETECTED"], risk_score=0.95,
                        findings=secret_findings, tool_name=tool_name,
                        tool_input=tool_input, session_id=session_id, start_time=start_time,
                    )

        return self._make_decision(
            action=DecisionAction.ALLOW,
            reason=f"File operation allowed: {command or 'edit'} {path}",
            reason_codes=["FILE_ALLOWED"], findings=findings,
            tool_name=tool_name, tool_input=tool_input,
            session_id=session_id, start_time=start_time,
        )

    def _evaluate_browser(self, tool_input, tool_name, session_id, start_time):
        url = tool_input.get("url", "")
        return self._make_decision(
            action=DecisionAction.ALLOW,
            reason=f"Browser action allowed: {url[:60] if url else 'navigation'}",
            reason_codes=["BROWSER_ALLOWED"], tool_name=tool_name,
            tool_input=tool_input, session_id=session_id, start_time=start_time,
        )

    def _make_decision(self, action, reason, reason_codes, risk_score=0.0,
                       findings=None, tool_name="", tool_input=None,
                       session_id="", start_time=0.0):
        eval_time = (time.perf_counter() - start_time) * 1000
        return Decision(
            action=action, reason=reason, reason_codes=reason_codes,
            risk_score=risk_score, findings=findings,
            evaluation_time_ms=eval_time, tool_name=tool_name,
            tool_input=tool_input, session_id=session_id,
            cost_tracked=self.policy.budget._current_cost if self.policy.budget else 0.0,
            cumulative_cost=self.policy.budget._current_cost if self.policy.budget else 0.0,
        )

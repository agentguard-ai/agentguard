"""Reserve-then-reconcile budget tracking for Semantic Kernel governance.

Budget uses a reserve-then-reconcile pattern:
1. Before function execution: reserve the estimated cost
2. After function execution: reconcile actual cost vs. reserved amount
3. Budget check occurs at reservation time — prevents overspend

This prevents race conditions in async/parallel function calls and
provides accurate cost tracking even when actual costs differ from estimates.
"""

import threading
from typing import Optional


class BudgetTracker:
    """Thread-safe budget tracker with reserve-then-reconcile semantics.

    Args:
        per_session_usd: Maximum USD spend per session. Defaults to unlimited.
        per_agent_daily_usd: Maximum USD spend per agent per day. Defaults to unlimited.
    """

    def __init__(
        self,
        per_session_usd: float = float("inf"),
        per_agent_daily_usd: float = float("inf"),
    ):
        self.per_session_usd = per_session_usd
        self.per_agent_daily_usd = per_agent_daily_usd

        self._spent: float = 0.0
        self._reserved: float = 0.0
        self._lock = threading.Lock()

    @property
    def total_committed(self) -> float:
        """Total committed = spent + currently reserved."""
        with self._lock:
            return self._spent + self._reserved

    @property
    def spent(self) -> float:
        """Actual spend so far (reconciled)."""
        with self._lock:
            return self._spent

    @property
    def remaining(self) -> float:
        """Remaining budget after committed amounts."""
        with self._lock:
            committed = self._spent + self._reserved
            return max(0.0, self.per_session_usd - committed)

    def reserve(self, estimated_cost: float) -> bool:
        """Reserve estimated cost before function execution.

        Returns True if reservation succeeds (within budget).
        Returns False if reservation would exceed budget limits.

        Args:
            estimated_cost: Estimated cost of the upcoming function call.

        Returns:
            True if reserved successfully, False if would exceed budget.
        """
        with self._lock:
            new_committed = self._spent + self._reserved + estimated_cost
            if new_committed > self.per_session_usd:
                return False
            if new_committed > self.per_agent_daily_usd:
                return False
            self._reserved += estimated_cost
            return True

    def reconcile(self, actual_cost: float, reserved: float) -> None:
        """Reconcile actual cost after function execution.

        Releases the reservation and records the actual spend.
        If actual < reserved, the difference is freed back to the budget.
        If actual > reserved, the overshoot is still recorded accurately.

        Args:
            actual_cost: Actual cost incurred by the function call.
            reserved: The amount that was previously reserved for this call.
        """
        with self._lock:
            self._reserved -= reserved
            self._spent += actual_cost

    def check(self) -> Optional[str]:
        """Check if budget is exceeded.

        Returns a denial reason string if budget is exceeded, or None if OK.
        """
        with self._lock:
            committed = self._spent + self._reserved
            if committed >= self.per_session_usd:
                return (
                    f"Budget exceeded: ${committed:.4f} committed "
                    f"(${self._spent:.4f} spent + ${self._reserved:.4f} reserved) "
                    f">= ${self.per_session_usd:.2f} session limit"
                )
            if committed >= self.per_agent_daily_usd:
                return (
                    f"Daily budget exceeded: ${committed:.4f} committed "
                    f">= ${self.per_agent_daily_usd:.2f} daily limit"
                )
            return None

    def reset(self) -> None:
        """Reset all budget tracking. Use for new sessions."""
        with self._lock:
            self._spent = 0.0
            self._reserved = 0.0

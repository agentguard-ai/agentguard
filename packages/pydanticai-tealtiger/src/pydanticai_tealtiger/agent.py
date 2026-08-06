import functools
import inspect
from typing import Any, Callable, List, Literal, Optional, TypeVar, Union

from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from pydanticai_tealtiger.guard import TealTigerGuard

class GovernanceConfig(BaseModel):
    """Configuration for TealTiger Governance with full validation."""
    
    mode: Literal["enforce", "monitor", "observe"] = Field(
        default="enforce", 
        description="Governance mode: enforce (blocks), monitor (logs), observe (zero-config)."
    )
    allowed_tools: Optional[List[str]] = Field(
        default=None, 
        description="List of allowed tool names. If provided, other tools are denied."
    )
    blocked_pii: Optional[List[str]] = Field(
        default=None, 
        description="List of blocked PII types (e.g., 'ssn', 'credit_card')."
    )
    max_cost_per_session: Optional[float] = Field(
        default=None, 
        ge=0.0,
        description="Maximum allowed cost per session in USD."
    )


def _inject_governance_to_tool(func: Callable, tool_name: str) -> Callable:
    """Wraps a tool function to automatically call TealTigerGuard before execution."""
    is_async = inspect.iscoroutinefunction(func)
    
    # We must preserve the original signature so pydantic_ai can introspect it
    # We'll dynamically check if the first arg is RunContext
    sig = inspect.signature(func)
    has_ctx = False
    if sig.parameters:
        first_param = next(iter(sig.parameters.values()))
        if first_param.annotation is RunContext or first_param.name == "ctx":
            has_ctx = True

    if is_async:
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            ctx = args[0] if has_ctx and len(args) > 0 else kwargs.get("ctx")
            if ctx and hasattr(ctx, "deps") and isinstance(ctx.deps, TealTigerGuard):
                ctx.deps.evaluate(tool=tool_name, args=kwargs)
            return await func(*args, **kwargs)
        return async_wrapper
    else:
        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            ctx = args[0] if has_ctx and len(args) > 0 else kwargs.get("ctx")
            if ctx and hasattr(ctx, "deps") and isinstance(ctx.deps, TealTigerGuard):
                ctx.deps.evaluate(tool=tool_name, args=kwargs)
            return func(*args, **kwargs)
        return sync_wrapper


class GovernedAgent(Agent):
    """A Pydantic AI Agent wrapped with TealTiger governance."""
    
    def __init__(self, model: Any, governance: GovernanceConfig, **kwargs: Any):
        mode_mapping = {
            "enforce": "ENFORCE",
            "monitor": "MONITOR",
            "observe": "OBSERVE"
        }
        guard_mode = mode_mapping.get(governance.mode, "ENFORCE")
        
        self.guard = TealTigerGuard(
            mode=guard_mode,
            tool_allowlist=governance.allowed_tools,
            budget_limit=governance.max_cost_per_session
        )
        
        # Pydantic AI deps_type should match the guard
        kwargs["deps_type"] = type(self.guard)
        super().__init__(model, **kwargs)
        
    def tool(self, *args, **kwargs):
        """Decorator to register a tool and automatically apply governance evaluation."""
        def decorator(func):
            tool_name = kwargs.get("name", func.__name__)
            governed_func = _inject_governance_to_tool(func, tool_name)
            return super(GovernedAgent, self).tool(*args, **kwargs)(governed_func)
            
        if args and callable(args[0]):
            return decorator(args[0])
        return decorator

    async def run(self, user_prompt: str, deps: Any = None, **kwargs: Any) -> Any:
        """Run the agent, automatically injecting the TealTiger guard dependency."""
        if deps is None:
            deps = self.guard
        return await super().run(user_prompt, deps=deps, **kwargs)

    def run_sync(self, user_prompt: str, deps: Any = None, **kwargs: Any) -> Any:
        """Run the agent synchronously, automatically injecting the TealTiger guard dependency."""
        if deps is None:
            deps = self.guard
        return super().run_sync(user_prompt, deps=deps, **kwargs)

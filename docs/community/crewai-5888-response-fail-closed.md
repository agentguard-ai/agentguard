@Correctover @Tuttotorna — good questions. Let me address directly.

**PR #6030 link:** https://github.com/crewAIInc/crewAI/pull/6030

**What #6030 does and doesn't do:**

#6030 defines the `GovernanceDecision` and `GovernanceOutcome` TypedDicts — the *contract shape*. It specifies what a governance hook should return, how decisions link to outcomes, and what fields are required for an executable authorization. It does NOT modify CrewAI's hook dispatcher implementation.

So to answer the core question clearly:

- **Contract layer (#6030):** specifies `fail_closed=True` semantics, required binding fields, decision-outcome linkage ✅
- **Framework dispatcher layer:** still uses the observer hook pattern — this is CrewAI core code and a separate concern from #6030
- **SDK enforcement layer (TealTiger):** fail-closed is enforced at the SDK level, *inside* the hook. If `TealEngine.evaluate()` throws, the hook itself raises → tool blocked. The dispatcher never sees a "success" return.

This means: even if CrewAI's dispatcher catches exceptions and defaults to allow, TealTiger's hook implementation re-raises or returns `deny` before the dispatcher can swallow it. The enforcement is in the hook's return value, not in trusting the dispatcher to do the right thing with an exception.

**Concrete code path:**

```python
def before_tool_call(agent, tool_name, tool_input, context):
    decision = tealtiger.evaluate(agent, tool_name, tool_input)
    if decision.action != "allow":
        raise ToolBlockedError(decision.reason)  # dispatcher cannot ignore this
    return decision  # GovernanceDecision object persisted
```

If `tealtiger.evaluate()` itself crashes (internal error) and `fail_closed=True`:

```python
def before_tool_call(agent, tool_name, tool_input, context):
    try:
        decision = tealtiger.evaluate(agent, tool_name, tool_input)
    except Exception:
        raise ToolBlockedError("governance_evaluation_error")  # still raises
    if decision.action != "allow":
        raise ToolBlockedError(decision.reason)
    return decision
```

The dispatcher never gets `hook_blocked = False` because the hook never returns normally on deny/error — it raises.

**On the layering:**

| Layer | What it does | Who owns it |
|-------|-------------|-------------|
| Contract (#6030) | Defines decision shape, required fields, outcome linkage | CrewAI (framework-owned, vendor-neutral) |
| Hook implementation | Evaluates policy, returns/raises decision | TealTiger / CCS / any engine |
| Framework dispatcher | Calls hooks, handles results | CrewAI core |

The structural guarantee comes from the hook implementation raising on deny/error — not from trusting the dispatcher. Both TealTiger and CCS can provide this guarantee independently.

**On comparing TEEC and TransitionRecord:** Happy to look at alignment. The `extensions` field in GovernanceDecision is specifically designed for this — vendor evidence goes under `extensions["teec"]` or `extensions["ccs"]` without modifying the contract core.

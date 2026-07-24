# AG2 PR #2968 — Rewrite Summary

## Changes addressing @vvlrff's review

### 1. Namespace rename ✅
- Moved from `autogen/beta/extensions/tealtiger/` → `ag2/extensions/tealtiger/`
- All imports updated: `from ag2.extensions.tealtiger import ...`
- Tests moved to `test/extensions/tealtiger/`

### 2. MiddlewareFactory pattern ✅
- `TealTigerMiddleware` is now a **factory** (not a per-turn middleware)
- Implements `__call__(event, context) -> BaseMiddleware`
- Long-lived state (decisions, receipts, frozen_agents, cost) lives on the factory
- Per-turn `_TealTigerPerTurn` gets a reference to the factory via `self._factory`
- Follows the same pattern as `MetricsMiddleware` / `TelemetryMiddleware`

### 3. Actually imports and uses `tealtiger` package ✅
- `import tealtiger` in middleware.py
- Delegates policy evaluation to `tealtiger.TealEngine.evaluate()`
- The `missing_additional_dependency` guard is now justified — the `tealtiger` package IS imported

### 4. Cost tracking actually works ✅
- `_cumulative_cost` incremented on every ALLOW decision: `self._factory._cumulative_cost += self._factory.cost_per_call`
- Cost NOT incremented on DENY (blocked calls don't cost anything)
- Passed to TealEngine for budget evaluation

### 5. Returns proper `ToolErrorEvent` for denials ✅
- `on_tool_execution` returns `ToolErrorEvent(call_id=..., error=...)` for DENY
- No more returning raw strings
- Matches the `ToolResultType` contract (`ToolResultEvent | ToolErrorEvent | ClientToolCallEvent`)

### 6. Agent identity from context ✅
- Uses `context.dependencies[AGENT_CONTEXT_DEPENDENCY_KEY]` (same as `MetricsMiddleware`)
- No more `agent_id` constructor argument

### 7. Tool args extraction ✅
- Uses `event.arguments` (the actual `ToolCallEvent` field)
- Falls back to `str(event.args)` with a clear path, not `hasattr` probing that silently returns `{}`

### 8. Docstring import path fixed ✅
- Example shows `from ag2.extensions.tealtiger import ...`

### 9. Tests use real return types ✅
- Tests assert `isinstance(result, ToolErrorEvent)` for denials
- No more `"[GOVERNANCE DENIED]" in result` (which assumes string return)
- Added callback tests, cost tracking tests, factory state persistence tests

### 10. Removed dead invariant tests ✅
- Removed tests 5-6 that hand-constructed receipts without exercising actual logic
- All tests now exercise real middleware behavior

## File structure

```
ag2/extensions/tealtiger/
├── __init__.py      # Package init with missing_additional_dependency guard
├── middleware.py    # TealTigerMiddleware (factory) + _TealTigerPerTurn
└── types.py         # GovernancePolicy, GovernanceDecision, TEECReceipt, GovernanceMode

test/extensions/tealtiger/
└── test_governance_middleware.py  # 16 tests covering all reviewed issues
```

## How to apply

```bash
# On the fork (agentguard-ai/ag2)
git fetch upstream main
git rebase upstream/main

# Delete old files
rm -rf autogen/beta/extensions/tealtiger/
rm -rf test/beta/extensions/tealtiger/

# Copy new files
cp -r ag2/extensions/tealtiger/ <repo>/ag2/extensions/tealtiger/
cp -r test/extensions/tealtiger/ <repo>/test/extensions/tealtiger/

# Commit
git add -A
git commit -m "refactor(extensions/tealtiger): rewrite per review feedback

- Move to ag2.* namespace (autogen.beta.* removed in #3023)
- Use MiddlewareFactory pattern (state on factory, not per-turn)
- Return ToolErrorEvent for denials (proper ToolResultType contract)
- Actually import and use tealtiger package
- Implement working cost tracking
- Get agent identity from context dependencies
- Add proper tests (no hand-constructed assertions)

Addresses review from @vvlrff"

git push --force-with-lease
```

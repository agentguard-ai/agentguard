"""
Fix for test_intent_ref_stable_across_retries in test_governance_decision_contract.py

PROBLEM: A stray standalone triple-quote (""") exists immediately after the
completed function docstring, causing subsequent source to be interpreted as
a multiline string. This breaks Python test collection with a syntax error.

BEFORE (broken — extra """ on its own line):
```python
def test_intent_ref_stable_across_retries() -> None:
    \"\"\"Same authorized intent with different timestamps produces same intent_ref.

    intent_ref = SHA-256(JCS({agent_id, tool, normalized_scope, intent_digest}))
    Note: idempotency_key is explicitly EXCLUDED from intent_ref computation.
    Duplicate enforcement uses the pair (intent_ref, idempotency_key).
    \"\"\"
    \"\"\"                    <-- THIS STRAY LINE MUST BE REMOVED
    # ... rest of test
```

AFTER (fixed — remove the extra line):
```python
def test_intent_ref_stable_across_retries() -> None:
    \"\"\"Same authorized intent with different timestamps produces same intent_ref.

    intent_ref = SHA-256(JCS({agent_id, tool, normalized_scope, intent_digest}))
    Note: idempotency_key is explicitly EXCLUDED from intent_ref computation.
    Duplicate enforcement uses the pair (intent_ref, idempotency_key).
    \"\"\"
    # ... rest of test (no stray triple-quote)
```

ACTION: Delete the standalone `\"\"\"` line that appears after the closing
docstring triple-quote in test_intent_ref_stable_across_retries().
"""

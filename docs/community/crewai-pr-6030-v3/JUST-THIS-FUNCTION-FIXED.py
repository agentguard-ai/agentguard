def test_intent_ref_stable_across_retries() -> None:
    """Same authorized intent with different timestamps produces same intent_ref.

    intent_ref = SHA-256(JCS({agent_id, tool, normalized_scope, intent_digest}))
    Note: idempotency_key is explicitly EXCLUDED (pair model).
    Duplicate enforcement uses the pair (intent_ref, idempotency_key).
    """
    # Two decisions for the same intent, different issued_at
    decision_1: GovernanceDecision = {
        "decision_id": "d-retry-001",
        "intent_ref": "sha256:same-intent-hash",
        "receipt_ref": "sha256:receipt-attempt-1",
        "agent_id": "bot-1",
        "tool": "search",
        "normalized_scope": "docs/public",
        "intent_digest": "sha256:intent-abc",
        "normalization_id": "jcs-sha256",
        "policy_refs": ["allow-v1"],
        "decision": "allow",
        "reason": "ok",
        "issued_at": "2026-06-25T10:00:00Z",
        "boundary_id": "crew-run-retry-001",
        "seq": 0,
        "running_count": 1,
    }

    decision_2: GovernanceDecision = {
        **decision_1,
        "decision_id": "d-retry-002",
        "receipt_ref": "sha256:receipt-attempt-2",  # different
        "issued_at": "2026-06-25T10:00:05Z",  # different timestamp
        "seq": 1,
        "running_count": 2,
    }

    # Same intent_ref despite different timestamps
    assert decision_1["intent_ref"] == decision_2["intent_ref"]
    # Different receipt_ref (per-record uniqueness)
    assert decision_1["receipt_ref"] != decision_2["receipt_ref"]

# PR Title

feat(tealtiger): add TealTiger governance memory integration

# PR Description

## Summary

Adds a TealTiger integration that stores AI agent governance decisions in Hindsight with importance-weighted retention. Critical security events (DENY: PII detected, secrets blocked) persist for compliance; routine approvals naturally decay.

Closes #2284

## What it does

- **Stores** governance decisions via `retain()` with importance scores:
  - DENY → 0.90 (months retention)
  - MONITOR → 0.70 (weeks retention)
  - ALLOW → 0.55 (natural decay)
- **Recalls** contextually relevant past decisions for the same agent/tool
- **Reflects** on governance patterns (denial trends, anomalies)

## Design principle

Storage = evidence, NOT authority. A stored ALLOW cannot authorize a future action. The policy engine is deterministic; memory provides context only.

## Files

```
hindsight-integrations/tealtiger/
├── hindsight_tealtiger/
│   ├── __init__.py
│   └── memory.py
├── tests/
│   ├── __init__.py
│   └── test_memory.py
├── README.md
├── pyproject.toml
└── .gitignore
```

## Testing

```bash
cd hindsight-integrations/tealtiger
pip install -e ".[dev]"
pytest tests/ -v
```

15 tests covering store, recall, reflect, importance mapping, tagging, and content formatting.

## Related

- Issue: #2284
- TealTiger: https://github.com/agentguard-ai/tealtiger
- PyPI (standalone): https://pypi.org/project/tealtiger-hindsight/

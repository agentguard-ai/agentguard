# PR Title

docs: add TealTiger community integration listing

# PR Description

## Summary

Adds [TealTiger](https://tealtiger.ai) as a community integration on the integrations page. Per @nicoloboschi's guidance in #2770, the integration package lives on our repo and this PR adds the docs listing only.

Related: #2284

## What it is

`tealtiger-hindsight` provides governance-aware agent memory — stores AI agent governance decisions in Hindsight with importance-weighted retention:

- **DENY** events (PII detected, secrets blocked) → importance 0.90 → persist for months
- **MONITOR** events (flagged but allowed) → importance 0.70 → retained for weeks
- **Routine ALLOWs** → importance 0.55 → natural decay within days

Enables contextual recall ("what happened last time this agent called this tool?") without overriding deterministic policy evaluation. Storage = evidence, NOT authority.

## Changes

- `docs-integrations/tealtiger.md` — full integration guide (install, quick start, importance mapping, config reference, use cases)
- `src/data/integrations.json` — registry entry (`type: community`, `category: framework`)
- `static/img/icons/tealtiger.png` — logo icon

## Links

- **PyPI:** https://pypi.org/project/tealtiger-hindsight/
- **Source:** https://github.com/agentguard-ai/tealtiger/tree/main/packages/tealtiger-hindsight
- **TealTiger:** https://tealtiger.ai
- **Issue discussion:** #2284

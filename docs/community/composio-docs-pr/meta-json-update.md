# meta.json update instructions

## File location
`docs/content/docs/tools-direct/modify-tool-behavior/meta.json`

## What to add

Add `"governance-with-tealtiger"` to the `"pages"` array in the existing `meta.json`.

### Before (example — check actual current content):
```json
{
  "pages": [
    "before-execution-modifiers",
    "after-execution-modifiers",
    "schema-modifiers"
  ]
}
```

### After:
```json
{
  "pages": [
    "before-execution-modifiers",
    "after-execution-modifiers",
    "schema-modifiers",
    "governance-with-tealtiger"
  ]
}
```

## File to create
Place the `.mdx` file at:
```
docs/content/docs/tools-direct/modify-tool-behavior/governance-with-tealtiger.mdx
```

## PR title
```
docs: Add TealTiger governance modifier guide
```

## PR description
```
Adds documentation for using TealTiger deterministic governance as a
beforeExecute modifier — covering tool allowlisting, PII detection,
cost budgets, kill switch, and audit trail.

Closes ComposioHQ/composio#3556

Package: https://github.com/agentguard-ai/tealtiger/tree/main/packages/composio-tealtiger
```

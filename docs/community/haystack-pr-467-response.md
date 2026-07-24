Thanks @kacperlukawski — great point! I've completely rewritten the tutorial to use the `tealtiger-haystack` integration package (`TealTigerGovernanceComponent`) as the primary approach. No more manual wiring.

**Changes in the latest commit:**

- Uses `pip install tealtiger-haystack` and imports from `haystack_integrations.components.connectors.tealtiger`
- `TealTigerGovernanceComponent` is added to the pipeline and connected via `pipeline.connect()` — proper Haystack component pattern
- Removed the custom component / manual wiring entirely
- Also addressed all Copilot review comments (invalid placeholder PII, removed fake `sk-` secrets, fixed title/metadata, removed unused imports)

**Tutorial now covers:**
1. Zero-config OBSERVE mode — component added with no arguments, tracks cost + PII automatically
2. ENFORCE mode — policies block PII/secrets before they reach the LLM
3. Cost budget enforcement — prevents runaway agent loops
4. Structured audit trail inspection — correlation IDs, timestamps, findings

Let me know if there's anything else you'd like adjusted!

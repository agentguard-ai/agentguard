# Browser-Use Issue — TealTiger Governance for Browser Agents

## Title

Governance layer for browser actions — URL allowlisting, action budgets, PII exfiltration defense

---

## What is the problem that your feature request solves?

Browser-Use agents autonomously navigate the web, fill forms, and extract data. In enterprise/regulated deployments, this creates risks that don't exist in API-only agents:

1. **No URL boundary enforcement** — An agent told "find pricing info" can navigate to any domain. A prompt injection hidden in page content can redirect the agent to a malicious site. There's no policy that restricts which domains the agent can visit.

2. **No action budget** — A browser agent stuck in a loop performs unlimited navigations. Without iteration or cost caps, it burns tokens indefinitely. We've seen agents do 200+ navigations on a $3 task because a page kept loading new content.

3. **PII exfiltration via forms** — An agent filling a form can submit sensitive data from its context (SSNs, credit cards, API keys) to external websites. No scan happens before the submit action.

4. **No structured audit trail** — For SOC2/HIPAA compliance, teams need to prove: which URLs the agent visited, what data it entered, and what was extracted. Currently requires building custom logging around Browser-Use.

---

## What is your proposed solution?

A **governance hook at the action boundary** — evaluated before each `go_to_url`, `click_element`, `input_text`, and `submit` action. Either as:

**(a) A Controller extension** that evaluates policy before every browser action, or
**(b) A pre-action callback** in the Agent that governance engines can register.

We've built [TealTiger](https://github.com/agentguard-ai/tealtiger) (Apache 2.0, deterministic governance SDK, <2ms per evaluation) and would implement a `tealtiger-browser-use` adapter providing:

| Capability | How it works |
|-----------|-------------|
| **URL allowlist/denylist** | Before `go_to_url`: check domain against policy. Deny returns structured reason without loading the page. |
| **Navigation budget** | Count page loads per session. Hard-stop at N (configurable). |
| **Cost budget** | Track cumulative LLM cost across iterations. Deny when $X exceeded. |
| **PII exfiltration defense** | Before `input_text`/`submit`: scan field values for SSN/CC/secrets. Block if found. |
| **Injection defense** | After page load, before agent processes content: scan HTML for prompt injection patterns. |
| **Structured audit** | Every action produces: `{action, url, decision, pii_findings, cost_so_far, timestamp}` |

```python
from browser_use import Agent
from tealtiger_browser_use import GovernedAgent

agent = GovernedAgent(
    task="Find competitor pricing on acme.com",
    governance={
        "url_allowlist": ["*.acme.com", "*.google.com"],
        "max_navigations": 20,
        "max_cost_usd": 1.00,
        "pii_on_submit": "block",
    },
)
result = await agent.run()
# agent.governance_audit → list of per-action decision records
```

---

## What hacks or alternative solutions have you tried to solve the problem?

- **Custom Controller subclass** with URL checks in `act()` — works but fragile, breaks on Browser-Use updates, and doesn't handle PII scanning or cost tracking.
- **Wrapping the LLM call** to inject "never visit domains outside X" — prompt-level. The agent ignores it when page content overrides instructions (injection).
- **Post-hoc log parsing** — audit after the fact by reading browser history. Doesn't prevent the action, just documents the damage.

None of these provide deterministic, pre-action governance with structured audit evidence.

---

## What version of browser-use are you currently using?

Latest stable via `pip install browser-use` (0.2.x series as of July 2026). Tested against main branch as well.

---

## How badly do you want this new feature?

**💪 I'm willing to start a PR to work on this myself**

We'll build `tealtiger-browser-use` as a standalone package. What we need from the Browser-Use side: either (a) a documented pre-action hook/callback mechanism in the Controller or Agent, or (b) confirmation that subclassing Controller with action interception is the intended extension point.

---

## References

- TealTiger: https://github.com/agentguard-ai/tealtiger (Apache 2.0, NVIDIA Inception)
- PyPI: https://pypi.org/project/tealtiger/
- Similar adapter (Haystack pipelines): https://pypi.org/project/tealtiger-haystack/
- Similar adapter (AG2 agents): https://pypi.org/project/ag2-tealtiger/

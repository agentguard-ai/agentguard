# 🐯 TealTiger is looking for open-source contributors

We're building the governance layer for AI agents — deterministic policy enforcement that sits between your agent's intent and its side effects. No LLM in the governance path. Sub-5ms. Provably correct.

**TealTiger** is Apache 2.0, part of NVIDIA Inception, and already integrated with LangChain, CrewAI, AG2, Haystack, Google ADK, Composio, Strands, PydanticAI, Phoenix, Langfuse, AgentOps, and Opik.

We're looking for contributors who want to work on the frontier of AI agent security.

---

## What we're building

- **Deterministic governance** — policy evaluation with mathematical guarantees (no LLM judges)
- **Framework adapters** — `pip install tealtiger-<framework>` for every major agent framework
- **Formal verification** — Agent Behavioral Contracts, trajectory-level governance, constraint propagation
- **Cryptographic evidence** — Merkle-proofed governance decisions, verifiable offline
- **Cross-language contracts** — shared governance schemas between TypeScript and Python

## Open contribution areas

### 🟢 Good first issues (start here)

- Dashboard UI components (React/Next.js)
- Provider detection for new LLM providers (Groq, Together, Fireworks)
- Documentation pages for existing integrations
- Property-based test coverage for existing policies

### 🟡 Framework adapters (medium)

- `tealtiger-semantic-kernel` — Python IFunctionInvocationFilter
- `tealtiger-llamaindex` — tool-call governance callback
- `tealtiger-mastra` — TypeScript middleware
- `tealtiger-openai-agents` — Agents SDK guardrails hook

### 🔴 Research-grade (advanced)

- Trajectory-level governance (finite automata over agent action sequences)
- Constraint propagation in multi-agent delegation chains
- Adversarial governance red-teaming (automated policy bypass testing)
- Formal invariant monitoring (continuous property checking)
- Policy compilation (GDPR/SOC2 → executable rules)

---

## What contributors get

- Direct mentorship from the maintainer
- Co-authorship credit on all PRs
- NVIDIA Inception ecosystem visibility
- Experience shipping to 10+ framework integrations
- Real-world AI security engineering (not toy projects)

## Tech stack

- **Python SDK** — tealtiger (PyPI, 1.3.0)
- **TypeScript SDK** — tealtiger-ai-sdk (npm)
- **Testing** — Hypothesis (property-based), pytest
- **Dashboard** — Next.js, React, TailwindCSS
- **Infrastructure** — PostgreSQL, Docker, K8s Helm charts

## How to get started

1. Star the repo: https://github.com/agentguard-ai/tealtiger
2. Check open issues labeled `good first issue`: https://github.com/agentguard-ai/tealtiger/issues?q=label%3A%22good+first+issue%22
3. Read the contribution guide: https://github.com/agentguard-ai/tealtiger/blob/main/CONTRIBUTING.md
4. Pick an issue, comment "I'll take this", and ship it

## Links

- 🐙 GitHub: https://github.com/agentguard-ai/tealtiger
- 📖 Docs: https://docs.tealtiger.ai
- 📦 PyPI: https://pypi.org/project/tealtiger/
- 🌐 Website: https://tealtiger.ai
- 📝 Blog: https://blogs.tealtiger.ai

---

*If you're interested in AI agent security, governance contracts, or formal verification — this is the project. Come build the thing that makes autonomous agents safe.*

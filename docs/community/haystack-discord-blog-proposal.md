# Haystack Discord — Co-Authored Blog Proposal

## Channel: `#show-and-tell` (or DM to @kacperlukawski if preferred)

---

## Message (Discord-length — under 2000 chars)

Hey folks 👋

I'm the maintainer of [TealTiger](https://github.com/agentguard-ai/tealtiger) — a deterministic governance SDK for AI agents (Apache 2.0, NVIDIA Inception).

We recently shipped `tealtiger-haystack` on PyPI — a set of native Haystack components for pipeline governance:

- **TealTigerGovernanceComponent** — zero-config cost tracking + PII detection
- **TealTigerPIIRedactor** — redacts PII from retrieved documents before generation
- **TealTigerGuardComponent** — inter-agent prompt injection defense
- **TealTigerCircuitBreaker** — stops agent loops exceeding cost/iteration budgets

All deterministic (no LLM in the governance path), <2ms overhead, structured audit entries with correlation IDs.

We've also submitted a tutorial to the haystack-tutorials repo (PR #467) and worked with @kacperlukawski on revisions. It covers securing RAG pipelines against PII leaks, secret exposure, and runaway costs.

**Proposal:** I'd love to co-author a blog post with the deepset/Haystack team on governance for AI agent pipelines. The angle:

> *"Your RAG pipeline retrieves real data — here's how to enforce PII redaction, cost budgets, and injection defense without adding another LLM to the critical path."*

What we'd bring:
- Working code examples (already tested, published on PyPI)
- Benchmark data (<2ms governance overhead per evaluation)
- The tutorial as a starting point (notebook-ready)
- Cross-posting on our blog (blogs.tealtiger.ai) for mutual reach

What we'd love from the Haystack side:
- Co-authorship credit and cross-promotion
- Feedback on framing it for the Haystack audience
- Optional: listing in the Haystack integrations page

Happy to draft the full post and share a Google Doc for async review. Ping me here or on GitHub (@nagasatish007).

---

🔗 Links:
- PyPI: https://pypi.org/project/tealtiger-haystack/
- GitHub: https://github.com/agentguard-ai/tealtiger/tree/main/packages/haystack-tealtiger
- Tutorial PR: https://github.com/deepset-ai/haystack-tutorials/pull/467
- TealTiger blog: https://blogs.tealtiger.ai

---

## Alternative: Shorter version (if word limit is tight)

Hey 👋 I maintain TealTiger (deterministic AI governance, Apache 2.0). We shipped `tealtiger-haystack` on PyPI — native Haystack components for PII redaction, cost budgets, prompt injection defense, and circuit breaking. <2ms overhead, no LLM in the governance path.

We submitted a tutorial (PR #467) and worked with @kacperlukawski on it. Would love to co-author a blog post with the Haystack team on governance for AI pipelines — "how to enforce PII redaction and cost limits without adding another model."

We'd draft the post, share for review, and cross-post on both blogs. Interested?

🔗 PyPI: https://pypi.org/project/tealtiger-haystack/
🔗 Tutorial PR: https://github.com/deepset-ai/haystack-tutorials/pull/467
🔗 GitHub: https://github.com/agentguard-ai/tealtiger

---

## Notes

- **Why Discord and not a GitHub issue**: Blog proposals are informal collaboration — Discord `#show-and-tell` or a DM to @kacperlukawski (who already reviewed the tutorial PR) is the right channel.
- **Timing**: Good — the integration is live on PyPI, tutorial is submitted, and agent security/governance is a trending topic in the ecosystem.
- **Fallback**: If they don't want to co-author, ask if they'd be open to us publishing independently and them sharing/linking to it. Or listing `tealtiger-haystack` on their integrations page.

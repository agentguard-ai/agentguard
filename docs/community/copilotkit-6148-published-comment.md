# Comment for CopilotKit #6148 — Package Published

---

Shipped: [`tealtiger-copilotkit` on npm](https://www.npmjs.com/package/tealtiger-copilotkit) (v0.1.0)

```bash
npm install tealtiger-copilotkit
```

Implements the three-layer pattern per the bot's architecture guidance:

**Layer 1 — Route-level budget guard:**
- `createRouteGuard()` — pre-request budget check (returns 429 when exceeded), post-request cost recording
- Uses character-count token estimation (~4 chars/token) since CopilotKit doesn't expose usage in response headers
- User identity pulled from server-side auth (NextAuth, Clerk, custom JWT) — not client-supplied

**Layer 2 — Action handler wrapper:**
- `withTealTigerPolicy()` — wraps individual action handlers with governance
- Accepts `user` object from auth layer (`id`, `tenantId`, `roles`, `plan`)
- Glob-based allowlist/denylist (e.g., `delete*` matches `deleteAccount`)
- PII scanning on action arguments before execution

**Layer 3 — `useCopilotReadable` PII scanner:**
- `scanCopilotKitRequest()` — targets `<TextContext>` tags specifically in system messages
- Only scans readable state context, avoids false positives on user/assistant turns
- Supports detect / redact / block modes

All deterministic, <2ms per evaluation, zero external dependencies. Apache 2.0.

---

**What this covers vs. OpenBox:**

| | OpenBox | tealtiger-copilotkit |
|---|---|---|
| Architecture | External service (API calls) | In-process (<2ms, no network) |
| `useCopilotReadable` PII scanning | ❌ | ✅ |
| Per-user/tenant budget caps | ❌ | ✅ |
| Role-based action allowlists | ❌ | ✅ |
| Deterministic/auditable | LLM-based | Regex-based (reproducible) |
| External dependency | Requires account | None |

---

Happy to draft a cookbook recipe similar to the OpenBox one. Will bring to Discord as suggested.

🔗 npm: https://www.npmjs.com/package/tealtiger-copilotkit
🔗 Source: https://github.com/agentguard-ai/tealtiger/tree/main/packages/tealtiger-copilotkit

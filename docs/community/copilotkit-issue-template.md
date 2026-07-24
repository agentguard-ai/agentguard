# CopilotKit Issue — TealTiger Governance Integration

## Title

Governance middleware for copilot actions — tool-call authorization, PII scanning, cost budgets, and user-facing audit trail

---

## Problem or Motivation

CopilotKit enables in-app AI copilots that call backend actions (`useCopilotAction`) on behalf of users. In production SaaS applications, this creates governance gaps:

1. **No action authorization boundary.** When the copilot calls an action (e.g., `updateProfile`, `sendEmail`, `deleteRecord`), there's no policy layer that evaluates whether THIS user's copilot should be allowed to call THIS action with THESE arguments. The copilot can invoke any registered action based on model reasoning alone.

2. **No PII scanning on copilot context.** `useCopilotReadable` exposes application state to the copilot. If that state contains PII (customer SSNs, payment info, medical records), it flows into the model context unscanned. Enterprise SaaS products serving regulated industries need evidence that PII was evaluated before reaching the LLM.

3. **No per-user cost governance.** In multi-tenant SaaS, one user's copilot can consume disproportionate tokens (complex queries, long conversations, action loops). There's no per-user or per-session budget cap that stops the copilot when cost exceeds a threshold.

4. **No compliance audit for end users.** Enterprise customers deploying SaaS with CopilotKit-powered features need to answer: "what did the AI do on behalf of my user, and was it governed?" Currently no structured evidence exists.

---

## Tell us your idea

**What:** A governance middleware that evaluates deterministic policy before each copilot action executes and before context enters the model. Sits in the CopilotKit runtime as a hook/interceptor.

**How it works:**

```typescript
import { CopilotRuntime } from "@copilotkit/runtime";
import { TealTigerGovernance } from "tealtiger-copilotkit";

const governance = new TealTigerGovernance({
  mode: "ENFORCE",
  actionPolicy: {
    allowlist: ["searchDocs", "updatePreferences", "getAnalytics"],
    denylist: ["deleteAccount", "transferFunds", "exportAllData"],
  },
  pii: {
    scanReadable: true,     // scan useCopilotReadable content
    scanActionArgs: true,   // scan action arguments
    action: "redact",
    categories: ["ssn", "credit_card", "api_key"],
  },
  budget: {
    perUser: 0.50,          // per user per session
    perTenant: 50.00,       // per organization daily
  },
});

const runtime = new CopilotRuntime({
  middleware: [governance],  // governance in the runtime pipeline
});
```

**Behavior:**
- Before action execution → policy check → ALLOW or DENY with structured reason
- Before context assembly → PII scan → redact or block
- Per interaction → cost tracked → denied when budget exceeded
- Every evaluation → audit record emitted (correlation_id, user_id, action, decision, findings)

**Use cases:**
- SaaS product with copilot feature serving healthcare customers (HIPAA: PII must be scanned)
- Multi-tenant platform where per-user AI cost needs capping
- Enterprise product where copilot actions must be restricted by user role
- Any product where "the AI did X on behalf of user Y" needs audit evidence

**Who finds this useful:**
- SaaS teams building copilot features for enterprise/regulated customers
- Platform engineers managing multi-tenant copilot deployments
- Compliance teams that need to prove governance of AI-assisted actions

---

## Would you like to work on this?

**Yes, I'd love to work on it!**

We'll build `tealtiger-copilotkit` as a standalone npm package that integrates with the CopilotRuntime middleware pipeline. [TealTiger](https://github.com/agentguard-ai/tealtiger) (Apache 2.0) already has a TypeScript SDK (`npm install tealtiger-ai-sdk`) — the CopilotKit integration would wrap it as runtime middleware.

References:
- TealTiger: https://github.com/agentguard-ai/tealtiger
- npm: https://www.npmjs.com/package/tealtiger-ai-sdk
- Docs: https://docs.tealtiger.ai
- Similar middleware (Vercel AI SDK): existing integration pattern

# tealtiger-copilotkit

Deterministic governance middleware for [CopilotKit](https://www.copilotkit.ai/) — action authorization, PII scanning, cost budgets, and structured audit trail.

**No LLM in the governance path.** All policy evaluation is deterministic, adding <2ms latency.

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

## Installation

```bash
npm install tealtiger-copilotkit
```

## Three-Layer Governance

| Layer | What it does | Where it runs |
|-------|-------------|---------------|
| **Route Guard** | Per-user/tenant budget check + cost recording | Next.js route handler (before/after CopilotKit runtime) |
| **Action Wrapper** | Per-action authorization + PII scanning | Individual action handlers |
| **Content Scanner** | PII detection/redaction on `useCopilotReadable` state | Before context enters the model |

## Quick Start

### 1. Create the Governance Engine

```typescript
import { TealTigerGovernance } from "tealtiger-copilotkit";

const governance = new TealTigerGovernance({
  mode: "ENFORCE", // OBSERVE | MONITOR | ENFORCE
  actionPolicy: {
    allowlist: ["searchDocs", "updatePreferences", "getAnalytics"],
    denylist: ["deleteAccount", "transferFunds", "exportAllData"],
  },
  pii: {
    scanReadable: true,
    scanActionArgs: true,
    action: "redact",
    categories: ["ssn", "credit_card", "api_key"],
  },
  budget: {
    perUser: 0.50,
    perTenant: 50.00,
  },
});
```

### 2. Route-Level Budget Guard

```typescript
import { createRouteGuard } from "tealtiger-copilotkit";

const guard = createRouteGuard({
  governance,
  getUserId: (req) => req.headers.get("x-user-id") ?? undefined,
  getTenantId: (req) => req.headers.get("x-tenant-id") ?? undefined,
  costPer1kTokens: 0.003,
});

// Next.js App Router
export const POST = async (req: Request) => {
  // Check budget BEFORE processing
  const check = await guard.checkBudget(req);
  if (check.denied) return check.response; // 429

  // Process normally
  const response = await handleCopilotRequest(req);

  // Record usage AFTER
  await guard.recordUsage(req, response);
  return response;
};
```

### 3. Action Handler Wrapper

```typescript
import { withTealTigerPolicy } from "tealtiger-copilotkit";

const actions = [
  {
    name: "deleteRecord",
    description: "Deletes a customer record",
    parameters: [{ name: "recordId", type: "string" }],
    handler: withTealTigerPolicy(
      { governance, actionName: "deleteRecord" },
      async ({ recordId }) => {
        // Only runs if governance allows
        return await db.delete(recordId);
      }
    ),
  },
];
```

### 4. Content PII Scanner

```typescript
// Scan useCopilotReadable state before it enters the model
const userState = getUserData(); // may contain PII
const { text: safeState, decision } = await governance.scanContent(
  JSON.stringify(userState),
  userId,
  tenantId,
);

// safeState has PII redacted — safe to pass to copilot
// decision contains audit record of what was found
```

## Governance Modes

| Mode | Behavior |
|------|----------|
| **OBSERVE** | Log all decisions but never block. PII findings recorded, actions still execute. |
| **MONITOR** | Log + emit warnings. Actions still execute but decisions are flagged. |
| **ENFORCE** | Block violating actions. PII redacted/blocked. Budget enforced with 429. |

## Audit Trail

Every evaluation produces a structured `GovernanceDecision`:

```json
{
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-07-24T14:00:00.000Z",
  "action": "DENY",
  "mode": "ENFORCE",
  "reason": "Action 'deleteAccount' is in the denylist",
  "reasonCodes": ["ACTION_DENIED"],
  "riskScore": 80,
  "piiFindings": [],
  "costTracked": 0,
  "cumulativeCost": 0.42,
  "evaluationTimeMs": 0.8,
  "actionName": "deleteAccount",
  "userId": "user-123",
  "tenantId": "acme-corp"
}
```

Access via `governance.getDecisions()` or the `onAudit` callback.

## PII Detection

Built-in deterministic patterns for:
- Social Security Numbers (SSN)
- Credit card numbers (Visa, Mastercard, Amex, Discover)
- Email addresses
- Phone numbers (US/international)
- API keys (OpenAI, AWS, GitHub, GitLab)
- IP addresses

## License

Apache-2.0 — see [LICENSE](LICENSE).

# Spring AI Issue — TealTiger Governance Advisor Integration

## Issue Title

`[Feature Request] Governance Advisor for tool-call authorization, PII scanning, and cost budget enforcement`

---

## Issue Body

### Problem

Spring AI provides the Advisors API for intercepting AI interactions, and `ToolCallAdvisor` for tool-call management. However, there's no built-in governance layer that addresses enterprise deployment requirements:

1. **No tool-call authorization boundary** — When an agent invokes a tool via `ToolCallback`, there's no interception point that evaluates whether the call should proceed based on policy (e.g., "finance-agent cannot call delete_customer"). The advisor chain can log or modify requests, but doesn't enforce deterministic allow/deny decisions with structured evidence.

2. **No PII/secret scanning on prompts or tool results** — Retrieved documents (RAG) and tool results can contain SSNs, credit cards, API keys. These flow into the model context unscanned. Enterprise environments (HIPAA, PCI-DSS, SOC2) require evidence that sensitive data was scanned before reaching the LLM.

3. **No per-session cost budgets** — Spring AI tracks token usage, but there's no hard-stop mechanism that prevents a looping agent from exceeding a cost threshold. A runaway agentic loop can accumulate unbounded cost.

4. **No structured governance audit trail** — Advisors can log, but there's no standardized governance decision record (correlation ID, policy evaluated, risk score, action taken, evaluation latency) that satisfies auditor requirements.

### Proposed Solution

A `TealTigerGovernanceAdvisor` that implements Spring AI's Advisor interface, providing:

- **Pre-tool governance** — Evaluate policy before each tool call; deny/allow with structured evidence
- **Pre-inference PII scan** — Scan assembled prompts/context before sending to the model
- **Cost budget enforcement** — Track cumulative cost per session; deny when budget exceeded
- **Structured audit** — Every decision emits a typed `GovernanceDecision` record

[TealTiger](https://github.com/agentguard-ai/tealtiger) is an open-source (Apache 2.0, NVIDIA Inception) deterministic governance SDK currently available for Python and TypeScript, with integrations in 12+ agent frameworks. We'd like to propose a Spring AI integration via:

**(a) A Spring Boot starter** (`spring-ai-tealtiger-starter`) that auto-configures governance advisors, or
**(b) A standalone advisor library** that can be added to any Spring AI project, or
**(c) An MCP-based approach** — Spring AI connects to TealTiger's MCP server for governance decisions.

### What the integration would provide

| Capability | Implementation | Description |
|-----------|---------------|-------------|
| **Tool-call authorization** | `@PreAuthorize`-style governance on `ToolCallback` | Policy evaluation before tool execution. Deny returns structured reason without calling the tool. |
| **PII/secret scanning** | Advisor in the request chain | Scan prompt + retrieved context for SSN, credit card, email, API keys. Block or redact before model call. |
| **Cost budget enforcement** | Advisor tracking cumulative tokens | Per-request, per-session, and daily cost limits. `BudgetExceededException` when threshold hit. |
| **Circuit breaker** | Per-provider state machine | CLOSED→OPEN→HALF_OPEN. Prevents cascading retries against a failing provider. |
| **Structured audit trail** | `GovernanceDecision` record per evaluation | Correlation ID, policy_refs, risk_score, action, evaluation_time_ms. Integrates with Spring's observability (Micrometer). |
| **Governance modes** | OBSERVE / MONITOR / ENFORCE | Gradual rollout: observe-only first, then enforce in production. |

### Technical Approach

```java
@Configuration
public class GovernanceConfig {

    @Bean
    public TealTigerGovernanceAdvisor governanceAdvisor() {
        return TealTigerGovernanceAdvisor.builder()
            .mode(GovernanceMode.ENFORCE)
            .piiScanning(PiiConfig.builder()
                .action(PiiAction.BLOCK)
                .categories("ssn", "credit_card", "api_key")
                .build())
            .costBudget(CostBudgetConfig.builder()
                .perSession(5.00)
                .perRequest(0.50)
                .daily(100.00)
                .build())
            .circuitBreaker(CircuitBreakerConfig.builder()
                .failureThreshold(5)
                .timeout(Duration.ofSeconds(60))
                .build())
            .toolPolicy(ToolPolicyConfig.builder()
                .allowlist("search_docs", "get_customer")
                .denylist("delete_customer", "drop_table")
                .build())
            .build();
    }
}

// Usage with ChatClient
@Service
public class AgentService {

    private final ChatClient chatClient;

    public AgentService(ChatClient.Builder builder, 
                       TealTigerGovernanceAdvisor governance) {
        this.chatClient = builder
            .defaultAdvisors(governance)  // governance in the advisor chain
            .build();
    }

    public String ask(String question) {
        return chatClient.prompt()
            .user(question)
            .call()
            .content();
        // Governance scans prompt, evaluates tool calls, tracks cost
        // GovernanceDecision records emitted for each evaluation
    }
}
```

### Why this matters for Spring AI users

- **Enterprise Java** — Spring AI's primary audience is enterprise Java teams. These teams have compliance requirements (SOC2, HIPAA, PCI-DSS, EU AI Act) that Python-first governance tools don't serve.
- **Advisor pattern fit** — The Advisors API is designed exactly for this. A governance advisor is arguably the highest-value advisor possible for production deployments.
- **Agentic loops** — Spring AI's recent composable tool-calling architecture (June 2026 blog) enables agent loops. These loops need cost caps and circuit breakers to be production-safe.
- **Spring Security alignment** — Governance maps naturally to Spring Security patterns (`@PreAuthorize`, security filters, authentication context). A governance advisor can integrate with Spring Security's authorization model.

### Implementation considerations

TealTiger currently ships Python and TypeScript SDKs. For Spring AI, the options are:

1. **Native Java implementation** (recommended) — Implement TealTiger's governance patterns (deterministic policy evaluation, PII regex scanning, cost tracking, circuit breaker state machine) natively in Java. This gives best performance (<2ms), no external dependencies, and idiomatic Spring Boot integration.

2. **MCP server approach** — Spring AI already supports MCP. TealTiger has an MCP server (`@tealtiger/mcp`). A thin advisor could delegate governance decisions to the MCP server. Higher latency but shares governance state with Python/TS agents.

3. **Sidecar HTTP** — TealTiger runs as a sidecar; advisor calls it over HTTP. Similar tradeoffs to MCP.

We'd recommend option 1 for Spring AI — a native `spring-ai-tealtiger` library following Spring Boot conventions (auto-configuration, properties-based config, actuator integration, Micrometer metrics).

### References

- TealTiger: https://github.com/agentguard-ai/tealtiger
- TealTiger docs: https://docs.tealtiger.ai
- Spring AI Advisors: https://docs.spring.io/spring-ai/reference/api/advisors.html
- Similar integration (Python/Haystack): https://pypi.org/project/tealtiger-haystack/
- Similar integration (Python/CrewAI): https://github.com/crewAIInc/crewAI/pull/6030
- OWASP AI Security Index: https://owasp.org/www-project-ai-security-and-privacy-guide/

### Open questions for maintainers

1. Would this fit better as a community-contributed advisor in `spring-ai-community` or as a separate starter?
2. Is there interest in a governance-specific advisor interface (beyond the generic `Advisor`) with standardized decision records?
3. Any planned first-party governance/guardrails support on the Spring AI roadmap that this should align with?

Happy to discuss approach and contribute.

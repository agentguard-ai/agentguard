@Mayur021 — this is an excellent observation. You're right that reversibility is a missing governance axis, and it's exactly the kind of feedback we were hoping for.

**The core insight:** a read-only query and an irreversible external write should not carry the same governance gate. The *risk* of an action isn't just "does it violate a policy?" — it's "how bad is it if this action was wrong, and can we undo it?"

Here's how I see this fitting into v1.5:

### 1. Reversibility Classification (Design-Time, Deterministic)

We'd add a **reversibility class** to every tool/action in the registry:

| Class | Definition | Example | Default Gate |
|-------|-----------|---------|------|
| `read_only` | No state change | `search_db`, `get_weather` | Auto-allow |
| `reversible` | Can be undone programmatically | `create_draft`, `add_to_cart` | Auto with audit |
| `externally_reversible` | Undo requires external action | `send_email` (can recall), `create_PR` | Approval queue |
| `irreversible` | Cannot be undone | `delete_account`, `execute_trade`, `publish_to_prod` | Hard block or human approval |

This classification is **design-time and deterministic** — assigned by the policy author, not the agent. Fits the no-LLM-in-governance principle perfectly.

### 2. TealProof Extension

The governance receipt already carries `policy_ref`, `intent_ref`, `risk_score`. We'd add:

```json
{
  "reversibility_class": "externally_reversible",
  "gate_path": "approval",
  "approved_by": "operator@company.com",
  "approval_timestamp_ms": 1720000000000
}
```

Same Merkle-and-timestamp machinery. One more field. Auditors can now reconstruct: "this irreversible action required human approval, and here's who approved it."

### 3. Chain-Level Worst-Case Analysis

Your point about individually reversible steps composing to an irreversible end state is spot-on. For multi-turn chains and the simulator (Feature #2), we'd evaluate:

```
chain_reversibility = worst_case(step_1.class, step_2.class, ..., step_n.class)
```

If any step in the chain is `irreversible`, the chain is treated as `irreversible` for governance purposes — even if each individual step looks benign.

This also feeds into the **Agent Trajectory DAG** (Feature #14) — we can color nodes by reversibility class and highlight the point where a chain crosses from reversible to irreversible.

### 4. Reference to OWASP AISVS

Good call on the C9.2.3 vocabulary. We'd align our classification with that standard to maintain interoperability with broader AI security frameworks.

---

**Next steps:** I'm adding this as a first-class requirement in the v1.5 spec. The reversibility axis will likely land in:
- The tool registry (design-time classification)
- The governance gate (dynamic gate selection based on class)
- TealProof receipts (auditability)
- The multi-turn simulator (chain-level analysis)
- The control plane (fleet-wide reversibility posture view)

Thanks for this — it makes the governance model significantly more complete. This is exactly what deterministic governance should do: the hard classification decisions happen at design time, not runtime.

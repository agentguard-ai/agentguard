# TealTiger Sidecar

A lightweight Go sidecar that implements TealTiger governance policies, speaking the [Future AGI](https://futureagi.com) webhook contract.

## Features

- **Future AGI Contract**: POST `/evaluate` → `{pass, score, message, details}`
- **Tool Control**: Allowlist/denylist with glob pattern matching
- **PII Detection**: SSN, credit card, email, phone number, IBAN, passport number regex scanning
- **Secret Detection**: API keys, passwords, tokens, private keys, AWS credentials
- **Cost Budget Tracking**: Per-session cumulative cost enforcement
- **Agent Kill Switch**: Freeze/unfreeze agents via admin endpoints
- **Sub-millisecond evaluation**: Pure regex + in-memory checks, no network calls

## Quick Start

```bash
# Build and run locally
go build -o tealtiger-sidecar .
./tealtiger-sidecar -config config.yaml

# Or with Docker
docker build -t tealtiger-sidecar .
docker run -p 8080:8080 tealtiger-sidecar
```

## API Endpoints

### POST /evaluate

Evaluates text against all configured governance policies.

**Request:**
```json
{
  "text": "Please process payment for card 4111-1111-1111-1111",
  "metadata": {
    "agent_id": "agent-123",
    "tool_name": "process_payment"
  }
}
```

**Response:**
```json
{
  "pass": false,
  "score": 0.2,
  "message": "blocked: pii_detected:credit_card",
  "details": {
    "decision_id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
    "reason_codes": ["pii_detected:credit_card"],
    "evaluation_time_ms": 0.142
  }
}
```

### GET /health

Health check endpoint.

```json
{"status": "healthy", "frozen": false}
```

### POST /admin/freeze

Activates the kill switch. All subsequent evaluations will fail.

### POST /admin/unfreeze

Deactivates the kill switch. Evaluations resume normal policy checks.

## Configuration

Edit `config.yaml` to customize policies:

```yaml
server:
  port: 8080

policies:
  tool_control:
    enabled: true
    allowlist: ["read_*", "search_*"]
    denylist: ["exec_*", "shell_*"]

  pii_detection:
    enabled: true
    patterns: []  # empty = all patterns

  secret_detection:
    enabled: true
    patterns: []  # empty = all patterns

  cost_budget:
    enabled: true
    max_per_session: 5.00
    per_request_cost: 0.01

  kill_switch:
    enabled: true
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `TEALTIGER_CONFIG` | Override config file path |

## Docker Deployment

```bash
# Build
docker build -t tealtiger-sidecar .

# Run with custom config
docker run -p 8080:8080 -v $(pwd)/my-config.yaml:/app/config.yaml tealtiger-sidecar

# Docker Compose example
docker run -d \
  --name tealtiger-sidecar \
  --restart unless-stopped \
  -p 8080:8080 \
  tealtiger-sidecar
```

## Architecture

```
┌─────────────────────────────────────────┐
│  Agent Framework (LangChain, AG2, etc.) │
└────────────────────┬────────────────────┘
                     │ POST /evaluate
                     ▼
┌─────────────────────────────────────────┐
│         TealTiger Sidecar (:8080)       │
│                                         │
│  ┌─────────────┐  ┌──────────────────┐  │
│  │ Tool Control│  │  PII Detection   │  │
│  │  (globs)    │  │  (regex)         │  │
│  └─────────────┘  └──────────────────┘  │
│  ┌─────────────┐  ┌──────────────────┐  │
│  │   Secrets   │  │  Cost Budget     │  │
│  │  (regex)    │  │  (per-session)   │  │
│  └─────────────┘  └──────────────────┘  │
│  ┌─────────────────────────────────────┐ │
│  │         Kill Switch                 │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## Development

```bash
# Run tests
go test ./...

# Run with hot reload (using air)
air

# Benchmark
go test -bench=. ./governance/
```

## Integration with Future AGI

Configure this sidecar as a webhook evaluator in your Future AGI dashboard:

1. Deploy the sidecar alongside your agent
2. Set the webhook URL to `http://tealtiger-sidecar:8080/evaluate`
3. The sidecar will evaluate each request and return pass/fail decisions

## License

Apache 2.0 — Part of the TealTiger AI Agent Security Platform.

# Migration Guide: AgentGuard → TealTiger

This guide will help you migrate from AgentGuard to TealTiger. The rebrand includes breaking changes in package names, class names, and import paths.

## Overview

TealTiger v1.0.0 is a complete rebrand of AgentGuard with no backward compatibility. All references to "AgentGuard" have been replaced with "TealTiger" or "Teal" prefixes.

**Key Changes:**
- Package name: `agentguard` → `tealtiger`
- Class names: `GuardedOpenAI` → `TealOpenAI`, etc.
- Repository URLs: Updated to reflect new branding
- Domain: `tealtiger.co.in`

## TypeScript/JavaScript Migration

### 1. Update Package Installation

**Before (AgentGuard):**
```bash
npm uninstall agentguard
```

**After (TealTiger):**
```bash
npm install tealtiger
```

**Update package.json:**
```json
{
  "dependencies": {
    "tealtiger": "^1.0.0"
  }
}
```

### 2. Update Import Statements

**Before (AgentGuard):**
```typescript
import {
  GuardedOpenAI,
  GuardedAnthropic,
  GuardedAzureOpenAI,
  AgentGuard,
  AgentGuardConfig
} from 'agentguard';
```

**After (TealTiger):**
```typescript
import {
  TealOpenAI,
  TealAnthropic,
  TealAzureOpenAI,
  TealTiger,
  TealTigerConfig
} from 'tealtiger';
```

### 3. Update Class Names

#### OpenAI Client

**Before:**
```typescript
import { GuardedOpenAI } from 'agentguard';

const client = new GuardedOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  agentId: 'my-agent',
});
```

**After:**
```typescript
import { TealOpenAI } from 'tealtiger';

const client = new TealOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  agentId: 'my-agent',
});
```

#### Anthropic Client

**Before:**
```typescript
import { GuardedAnthropic } from 'agentguard';

const client = new GuardedAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  agentId: 'my-agent',
});
```

**After:**
```typescript
import { TealAnthropic } from 'tealtiger';

const client = new TealAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  agentId: 'my-agent',
});
```

#### Azure OpenAI Client

**Before:**
```typescript
import { GuardedAzureOpenAI } from 'agentguard';

const client = new GuardedAzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: '2024-02-15-preview',
  agentId: 'my-agent',
});
```

**After:**
```typescript
import { TealAzureOpenAI } from 'tealtiger';

const client = new TealAzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: '2024-02-15-preview',
  agentId: 'my-agent',
});
```

#### SSA Client (Advanced)

**Before:**
```typescript
import { AgentGuard, AgentGuardConfig } from 'agentguard';

const guard = new AgentGuard({
  apiKey: 'your-api-key',
  ssaUrl: 'http://localhost:3001',
  agentId: 'my-agent',
});
```

**After:**
```typescript
import { TealTiger, TealTigerConfig } from 'tealtiger';

const guard = new TealTiger({
  apiKey: 'your-api-key',
  ssaUrl: 'http://localhost:3001',
  agentId: 'my-agent',
});
```

### 4. Update Configuration Interfaces

**Before:**
```typescript
import { GuardedOpenAIConfig } from 'agentguard';

const config: GuardedOpenAIConfig = {
  apiKey: process.env.OPENAI_API_KEY,
  agentId: 'my-agent',
};
```

**After:**
```typescript
import { TealOpenAIConfig } from 'tealtiger';

const config: TealOpenAIConfig = {
  apiKey: process.env.OPENAI_API_KEY,
  agentId: 'my-agent',
};
```

### 5. Update Error Handling

**Before:**
```typescript
import { isAgentGuardError, AgentGuardErrorCode } from 'agentguard';

try {
  // ... code
} catch (error) {
  if (isAgentGuardError(error)) {
    console.error('AgentGuard Error:', error.code);
  }
}
```

**After:**
```typescript
import { isTealTigerError, TealTigerErrorCode } from 'tealtiger';

try {
  // ... code
} catch (error) {
  if (isTealTigerError(error)) {
    console.error('TealTiger Error:', error.code);
  }
}
```

### 6. Complete TypeScript Example

**Before (AgentGuard):**
```typescript
import {
  GuardedOpenAI,
  GuardrailEngine,
  PIIDetectionGuardrail,
  CostTracker,
  BudgetManager,
  InMemoryCostStorage
} from 'agentguard';

const storage = new InMemoryCostStorage();
const costTracker = new CostTracker({ enabled: true });
const budgetManager = new BudgetManager(storage);
const guardrailEngine = new GuardrailEngine();

guardrailEngine.registerGuardrail(new PIIDetectionGuardrail({
  name: 'pii-detection',
  enabled: true,
  action: 'redact'
}));

const client = new GuardedOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  agentId: 'my-agent',
  guardrailEngine,
  costTracker,
  budgetManager,
  costStorage: storage,
});

const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

**After (TealTiger):**
```typescript
import {
  TealOpenAI,
  GuardrailEngine,
  PIIDetectionGuardrail,
  CostTracker,
  BudgetManager,
  InMemoryCostStorage
} from 'tealtiger';

const storage = new InMemoryCostStorage();
const costTracker = new CostTracker({ enabled: true });
const budgetManager = new BudgetManager(storage);
const guardrailEngine = new GuardrailEngine();

guardrailEngine.registerGuardrail(new PIIDetectionGuardrail({
  name: 'pii-detection',
  enabled: true,
  action: 'redact'
}));

const client = new TealOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  agentId: 'my-agent',
  guardrailEngine,
  costTracker,
  budgetManager,
  costStorage: storage,
});

const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

---

## Python Migration

### 1. Update Package Installation

**Before (AgentGuard):**
```bash
pip uninstall agentguard
```

**After (TealTiger):**
```bash
pip install tealtiger
```

**Update requirements.txt:**
```
tealtiger>=1.0.0
```

**Update pyproject.toml:**
```toml
[project]
dependencies = [
    "tealtiger>=1.0.0",
]
```

### 2. Update Import Statements

**Before (AgentGuard):**
```python
from agentguard import (
    GuardedOpenAI,
    GuardedAnthropic,
    GuardedAzureOpenAI,
    AgentGuard,
)
```

**After (TealTiger):**
```python
from tealtiger import (
    TealOpenAI,
    TealAnthropic,
    TealAzureOpenAI,
    TealTiger,
)
```

### 3. Update Class Names

#### OpenAI Client

**Before:**
```python
from agentguard import GuardedOpenAI

client = GuardedOpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    agent_id="my-agent",
)
```

**After:**
```python
from tealtiger import TealOpenAI

client = TealOpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    agent_id="my-agent",
)
```

#### Anthropic Client

**Before:**
```python
from agentguard import GuardedAnthropic

client = GuardedAnthropic(
    api_key=os.getenv("ANTHROPIC_API_KEY"),
    agent_id="my-agent",
)
```

**After:**
```python
from tealtiger import TealAnthropic

client = TealAnthropic(
    api_key=os.getenv("ANTHROPIC_API_KEY"),
    agent_id="my-agent",
)
```

#### Azure OpenAI Client

**Before:**
```python
from agentguard import GuardedAzureOpenAI

client = GuardedAzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    api_version="2024-02-15-preview",
    agent_id="my-agent",
)
```

**After:**
```python
from tealtiger import TealAzureOpenAI

client = TealAzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    api_version="2024-02-15-preview",
    agent_id="my-agent",
)
```

#### SSA Client (Advanced)

**Before:**
```python
from agentguard import AgentGuard

guard = AgentGuard(
    api_key="your-api-key",
    ssa_url="http://localhost:3001",
    agent_id="my-agent",
)
```

**After:**
```python
from tealtiger import TealTiger

guard = TealTiger(
    api_key="your-api-key",
    ssa_url="http://localhost:3001",
    agent_id="my-agent",
)
```

### 4. Update Configuration Classes

**Before:**
```python
from agentguard import GuardedOpenAIConfig

config = GuardedOpenAIConfig(
    api_key=os.getenv("OPENAI_API_KEY"),
    agent_id="my-agent",
)
```

**After:**
```python
from tealtiger import TealOpenAIConfig

config = TealOpenAIConfig(
    api_key=os.getenv("OPENAI_API_KEY"),
    agent_id="my-agent",
)
```

### 5. Complete Python Example

**Before (AgentGuard):**
```python
import asyncio
import os
from agentguard import (
    GuardedOpenAI,
    GuardrailEngine,
    PIIDetectionGuardrail,
    CostTracker,
    BudgetManager,
    InMemoryCostStorage,
    CostTrackerConfig,
    BudgetConfig,
)

async def main():
    storage = InMemoryCostStorage()
    cost_tracker = CostTracker(CostTrackerConfig(enabled=True))
    budget_manager = BudgetManager(storage)
    guardrail_engine = GuardrailEngine()
    
    guardrail_engine.register_guardrail(PIIDetectionGuardrail(
        name="pii-detection",
        enabled=True,
        action="redact"
    ))
    
    client = GuardedOpenAI(
        api_key=os.getenv("OPENAI_API_KEY"),
        agent_id="my-agent",
        guardrail_engine=guardrail_engine,
        cost_tracker=cost_tracker,
        budget_manager=budget_manager,
        cost_storage=storage,
    )
    
    response = await client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": "Hello!"}],
    )

if __name__ == "__main__":
    asyncio.run(main())
```

**After (TealTiger):**
```python
import asyncio
import os
from tealtiger import (
    TealOpenAI,
    GuardrailEngine,
    PIIDetectionGuardrail,
    CostTracker,
    BudgetManager,
    InMemoryCostStorage,
    CostTrackerConfig,
    BudgetConfig,
)

async def main():
    storage = InMemoryCostStorage()
    cost_tracker = CostTracker(CostTrackerConfig(enabled=True))
    budget_manager = BudgetManager(storage)
    guardrail_engine = GuardrailEngine()
    
    guardrail_engine.register_guardrail(PIIDetectionGuardrail(
        name="pii-detection",
        enabled=True,
        action="redact"
    ))
    
    client = TealOpenAI(
        api_key=os.getenv("OPENAI_API_KEY"),
        agent_id="my-agent",
        guardrail_engine=guardrail_engine,
        cost_tracker=cost_tracker,
        budget_manager=budget_manager,
        cost_storage=storage,
    )
    
    response = await client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": "Hello!"}],
    )

if __name__ == "__main__":
    asyncio.run(main())
```

---

## Breaking Changes

### Version Strategy

TealTiger v1.0.0 represents a complete rebrand with **no backward compatibility**. This is a breaking change that requires code updates.

**Version Bump:**
- AgentGuard v0.2.2 → TealTiger v1.0.0

### What Changed

1. **Package Names**
   - NPM: `agentguard` → `tealtiger`
   - PyPI: `agentguard` → `tealtiger`

2. **Class Names**
   - `GuardedOpenAI` → `TealOpenAI`
   - `GuardedAnthropic` → `TealAnthropic`
   - `GuardedAzureOpenAI` → `TealAzureOpenAI`
   - `AgentGuard` → `TealTiger`

3. **Configuration Interfaces/Classes**
   - `GuardedOpenAIConfig` → `TealOpenAIConfig`
   - `GuardedAnthropicConfig` → `TealAnthropicConfig`
   - `GuardedAzureOpenAIConfig` → `TealAzureOpenAIConfig`
   - `AgentGuardConfig` → `TealTigerConfig`

4. **Error Types**
   - `isAgentGuardError` → `isTealTigerError`
   - `AgentGuardErrorCode` → `TealTigerErrorCode`

5. **Repository URLs**
   - `agentguard-ai/agentguard` → `agentguard-ai/tealtiger`
   - `agentguard-ai/agentguard-typescript` → `agentguard-ai/tealtiger-typescript`
   - `agentguard-ai/agentguard-python` → `agentguard-ai/tealtiger-python`

6. **Domain**
   - Documentation and support: `tealtiger.co.in`

### What Stayed the Same

1. **API Behavior**: All methods, parameters, and return types remain identical
2. **Features**: Cost tracking, guardrails, budget management work exactly the same
3. **Configuration Options**: All config options have the same names and types
4. **Dependencies**: Same underlying dependencies (OpenAI, Anthropic SDKs)

---

## Migration Checklist

### TypeScript/JavaScript Projects

- [ ] Uninstall `agentguard` package
- [ ] Install `tealtiger` package
- [ ] Update all import statements
- [ ] Replace `GuardedOpenAI` with `TealOpenAI`
- [ ] Replace `GuardedAnthropic` with `TealAnthropic`
- [ ] Replace `GuardedAzureOpenAI` with `TealAzureOpenAI`
- [ ] Replace `AgentGuard` with `TealTiger`
- [ ] Update configuration interface names
- [ ] Update error handling code
- [ ] Run tests to verify functionality
- [ ] Update documentation and comments

### Python Projects

- [ ] Uninstall `agentguard` package
- [ ] Install `tealtiger` package
- [ ] Update all import statements
- [ ] Replace `GuardedOpenAI` with `TealOpenAI`
- [ ] Replace `GuardedAnthropic` with `TealAnthropic`
- [ ] Replace `GuardedAzureOpenAI` with `TealAzureOpenAI`
- [ ] Replace `AgentGuard` with `TealTiger`
- [ ] Update configuration class names
- [ ] Run tests to verify functionality
- [ ] Update documentation and comments

---

## Support

If you encounter any issues during migration:

- **Documentation**: https://tealtiger.co.in
- **GitHub Issues**: https://github.com/agentguard-ai/tealtiger/issues
- **Email**: support@tealtiger.co.in

---

## FAQ

### Q: Can I use both AgentGuard and TealTiger in the same project?

**A:** No. TealTiger is a complete replacement for AgentGuard. You should migrate all code to use TealTiger.

### Q: Will AgentGuard continue to receive updates?

**A:** No. AgentGuard v0.2.2 is the final release. All future development will be under the TealTiger brand.

### Q: Do I need to change my API keys?

**A:** No. Your OpenAI, Anthropic, and Azure OpenAI API keys remain the same.

### Q: Will my cost tracking data be preserved?

**A:** If you're using in-memory storage, you'll need to migrate manually. If you're using persistent storage, the data format is compatible.

### Q: How long will the migration take?

**A:** For most projects, migration should take 15-30 minutes. It's primarily a find-and-replace operation.

### Q: Are there any performance differences?

**A:** No. TealTiger has identical performance characteristics to AgentGuard.

---

**Last Updated**: February 2026  
**Version**: 1.0.0

# @tealtiger/mastra

TealTiger governance middleware for the [Mastra](https://mastra.ai/) TypeScript agent framework.

This package provides a `withGovernance` wrapper that intercepts Mastra Tool executions. It enforces your TealTiger security policies natively within Mastra's execution pipeline, ensuring that sensitive data (PII, secrets) is never leaked to the LLM or returned by the tools.

## Installation

```bash
npm install @tealtiger/mastra tealtiger-sdk
```

## Usage

Wrap your Mastra tools with `withGovernance` to automatically scan tool inputs and outputs.

```typescript
import { createTool } from '@mastra/core';
import { z } from 'zod';
import { TealTigerClient } from 'tealtiger-sdk';
import { withGovernance } from '@tealtiger/mastra';

// 1. Initialize TealTiger
const tealTiger = new TealTigerClient({
  apiKey: process.env.TEALTIGER_API_KEY,
  mode: 'ENFORCE'
});

// 2. Define your Mastra tool
const myTool = createTool({
  id: 'customer-lookup',
  description: 'Lookup customer data by ID',
  inputSchema: z.object({
    customerId: z.string(),
  }),
  execute: async ({ context }) => {
    // some sensitive lookup
    return { name: "Alice", ssn: "000-00-0000" };
  }
});

// 3. Wrap the tool with governance
const governedTool = withGovernance(myTool, {
  client: tealTiger,
  scanInput: true,
  scanOutput: true // Prevent SSN from being returned to the LLM
});

// 4. Use the governed tool in your Mastra Agent
```

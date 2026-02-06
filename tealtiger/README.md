# TealTiger

<div align="center">

![TealTiger Logo](https://via.placeholder.com/200x200?text=TealTiger)

**Powerful protection for AI agents**

Open-source security and cost tracking for AI applications. Drop-in SDK for OpenAI, Anthropic, and Azure OpenAI with built-in guardrails and budget management.

[![npm version](https://badge.fury.io/js/tealtiger.svg)](https://www.npmjs.com/package/tealtiger)
[![PyPI version](https://badge.fury.io/py/tealtiger.svg)](https://pypi.org/project/tealtiger/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/agentguard-ai/tealtiger?style=social)](https://github.com/agentguard-ai/tealtiger)

[Website](https://tealtiger.co.in) • [Documentation](#documentation) • [Examples](#examples) • [Community](#community)

</div>

---

## 🚀 Quick Start

### TypeScript/JavaScript

```bash
npm install tealtiger
```

```typescript
import { TealOpenAI } from 'tealtiger';

const client = new TealOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  guardrails: {
    piiDetection: true,
    promptInjection: true,
    contentModeration: true,
  },
  budget: {
    maxCostPerRequest: 0.50,
    maxCostPerDay: 10.00,
  },
});

const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

### Python

```bash
pip install tealtiger
```

```python
from tealtiger import TealOpenAI

client = TealOpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    guardrails={
        "pii_detection": True,
        "prompt_injection": True,
        "content_moderation": True,
    },
    budget={
        "max_cost_per_request": 0.50,
        "max_cost_per_day": 10.00,
    },
)

response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello!"}],
)
```

---

## ✨ Features

### 🛡️ Security Guardrails

- **PII Detection** - Automatically detect and redact sensitive information
- **Prompt Injection Prevention** - Block malicious prompt injection attempts
- **Content Moderation** - Filter toxic, harmful, or inappropriate content
- **Custom Rules** - Define your own security policies

### 💰 Cost Control

- **Real-time Tracking** - Monitor AI costs as they happen
- **Budget Limits** - Set per-request, daily, and monthly limits
- **Cost Alerts** - Get notified before hitting budget thresholds
- **Usage Analytics** - Detailed cost breakdowns by model, user, and endpoint

### 🔌 Drop-in Integration

- **OpenAI Compatible** - Works with existing OpenAI code
- **Anthropic Support** - Claude integration included
- **Azure OpenAI** - Enterprise-ready Azure support
- **Zero Config** - Works out of the box with sensible defaults

### 🎯 Developer Experience

- **TypeScript First** - Full type safety and IntelliSense
- **Python Support** - Idiomatic Python API
- **Async/Await** - Modern async patterns
- **Streaming** - Full streaming support
- **Error Handling** - Detailed error messages and recovery

---

## 📦 SDKs

| Language | Repository | Package | Status |
|----------|------------|---------|--------|
| TypeScript/JavaScript | [tealtiger-typescript](https://github.com/agentguard-ai/tealtiger-typescript) | [tealtiger](https://www.npmjs.com/package/tealtiger) | ✅ Stable |
| Python | [tealtiger-python](https://github.com/agentguard-ai/tealtiger-python) | [tealtiger](https://pypi.org/project/tealtiger/) | ✅ Stable |

---

## 📚 Documentation

### Getting Started

- [Installation](./docs/installation.md)
- [Quick Start Guide](./docs/quick-start.md)
- [Configuration](./docs/configuration.md)
- [Migration Guide](./docs/migration.md)

### Guardrails

- [PII Detection](./docs/guardrails/pii-detection.md)
- [Prompt Injection Prevention](./docs/guardrails/prompt-injection.md)
- [Content Moderation](./docs/guardrails/content-moderation.md)
- [Custom Guardrails](./docs/guardrails/custom.md)

### Cost Management

- [Budget Configuration](./docs/cost/budget.md)
- [Cost Tracking](./docs/cost/tracking.md)
- [Usage Analytics](./docs/cost/analytics.md)
- [Alerts & Notifications](./docs/cost/alerts.md)

### API Reference

- [TypeScript API](https://github.com/agentguard-ai/tealtiger-typescript#api-reference)
- [Python API](https://github.com/agentguard-ai/tealtiger-python#api-reference)

---

## 💡 Examples

Explore real-world examples in the [`examples/`](./examples) directory:

- [Basic Usage](./examples/basic-usage.js) - Simple integration example
- [Guardrails Demo](./examples/guardrails-demo.js) - All guardrails in action
- [Budget Management](./examples/budget-management.js) - Cost control setup
- [Cost Tracking](./examples/cost-tracking.js) - Real-time cost monitoring
- [Streaming](./examples/streaming.js) - Streaming responses
- [Error Handling](./examples/error-handling.js) - Robust error handling

---

## 🗺️ Roadmap

See our [ROADMAP.md](./ROADMAP.md) for planned features and upcoming releases.

**Current Version:** v0.2.2

**Next Release (v0.3.0):**
- [ ] Gemini support
- [ ] Advanced analytics dashboard
- [ ] Team collaboration features
- [ ] Custom model pricing

---

## 🤝 Contributing

We welcome contributions! Please see our [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/agentguard-ai/tealtiger.git
cd tealtiger

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build
```

---

## 🌟 Community

- **Discord**: [Join our community](https://discord.gg/tealtiger) (coming soon)
- **Twitter**: [@tealtiger](https://twitter.com/tealtiger) (coming soon)
- **LinkedIn**: [TealTiger](https://www.linkedin.com/company/agentguard-ai)
- **Blog**: [Dev.to](https://dev.to/nagasatish007)

---

## 📄 License

TealTiger is [MIT licensed](./LICENSE).

---

## 🙏 Acknowledgments

Built with ❤️ by the TealTiger team and [contributors](https://github.com/agentguard-ai/tealtiger/graphs/contributors).

Special thanks to:
- OpenAI for the amazing API
- Anthropic for Claude
- The open-source community

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/agentguard-ai/tealtiger/issues)
- **Email**: support@tealtiger.co.in
- **Documentation**: [docs.tealtiger.co.in](https://docs.tealtiger.co.in) (coming soon)

---

<div align="center">

**[⬆ back to top](#tealtiger)**

Made with ❤️ for the AI community

</div>


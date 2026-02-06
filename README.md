# TealTiger - AI Security & Cost Control Platform

[![npm version](https://badge.fury.io/js/tealtiger.svg)](https://www.npmjs.com/package/tealtiger)
[![PyPI version](https://badge.fury.io/py/tealtiger.svg)](https://pypi.org/project/tealtiger/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Secure your AI. Control your costs.**

Drop-in SDKs that add security guardrails and cost tracking to your AI applications. Works with OpenAI, Anthropic, and Azure OpenAI.

---

## 🚀 Quick Start

### For Users (Install from Package Registries)

**TypeScript/JavaScript:**
```bash
npm install tealtiger
```

**Python:**
```bash
pip install tealtiger
```

### For Contributors (Clone & Develop)

```bash
# Clone the repository with submodules
git clone --recurse-submodules https://github.com/agentguard-ai/tealtiger.git
cd tealtiger

# If you already cloned without --recurse-submodules, initialize them:
git submodule update --init --recursive

# TypeScript SDK
cd packages/tealtiger-sdk
npm install
npm test
npm run build

# Python SDK
cd packages/tealtiger-python
pip install -e .
pytest
```

---

## 📦 Repository Structure

```
tealtiger/
├── packages/
│   ├── tealtiger-sdk/          # TypeScript/JavaScript SDK
│   │   ├── src/                # Source code
│   │   ├── tests/              # Test files
│   │   └── package.json        # NPM package config
│   │
│   └── tealtiger-python/       # Python SDK
│       ├── src/tealtiger/      # Source code
│       ├── tests/              # Test files
│       └── pyproject.toml      # PyPI package config
│
├── examples/                   # Usage examples
└── README.md                   # This file
```

---

## 💻 Usage

### TypeScript/JavaScript

```typescript
import { TealOpenAI } from 'tealtiger';

const client = new TealOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  enableGuardrails: true,
  enableCostTracking: true,
});

const response = await client.chat.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

### Python

```python
from tealtiger.clients import TealOpenAI, TealOpenAIConfig

config = TealOpenAIConfig(
    api_key="your-api-key",
    enable_guardrails=True,
    enable_cost_tracking=True
)

client = TealOpenAI(config)

response = await client.chat.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

---

## ✨ Features

### 🛡️ Security Guardrails
- **PII Detection** - Automatically detect and redact sensitive information
- **Prompt Injection Prevention** - Block malicious prompt injection attempts
- **Content Moderation** - Filter toxic, harmful, or inappropriate content

### 💰 Cost Control
- **Real-time Tracking** - Monitor AI costs as they happen
- **Budget Limits** - Set spending limits and get alerts
- **Usage Analytics** - Detailed cost breakdowns

### 🔌 Provider Support
- **OpenAI** - GPT-4, GPT-3.5, and all OpenAI models
- **Anthropic** - Claude 3 Opus, Sonnet, and Haiku
- **Azure OpenAI** - Enterprise-ready Azure integration

---

## 📚 Documentation

- **[TypeScript SDK](https://github.com/agentguard-ai/tealtiger-typescript)** - Full TypeScript documentation
- **[Python SDK](https://github.com/agentguard-ai/tealtiger-python)** - Full Python documentation
- **[Examples](./examples/)** - Working code examples

---

## 🧪 Testing

### TypeScript SDK
```bash
cd packages/tealtiger-sdk
npm test                    # Run all tests
npm run test:coverage       # Run with coverage
```

### Python SDK
```bash
cd packages/tealtiger-python
pytest                      # Run all tests
pytest --cov=tealtiger      # Run with coverage
```

---

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR-USERNAME/tealtiger.git
   cd tealtiger
   ```

3. **Install dependencies**
   ```bash
   # TypeScript
   cd packages/tealtiger-sdk && npm install
   
   # Python
   cd packages/tealtiger-python && pip install -e ".[dev]"
   ```

4. **Make your changes**
5. **Run tests**
6. **Submit a pull request**

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

---

## 📦 Publishing (Maintainers Only)

### TypeScript SDK
```bash
cd packages/tealtiger-sdk
npm version patch  # or minor, major
npm run build
npm test
npm publish
```

### Python SDK
```bash
cd packages/tealtiger-python
# Update version in pyproject.toml
python -m build
python -m twine upload dist/*
```

---

## 📄 License

MIT © TealTiger Team

See [LICENSE](./LICENSE) for details.

---

## 🔒 Security

Security is our top priority. If you discover a security vulnerability, please see our [Security Policy](./SECURITY.md).

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/agentguard-ai/tealtiger/issues)
- **Email**: support@tealtiger.co.in
- **Website**: [tealtiger.co.in](https://tealtiger.co.in)

---

## 🌟 Links

- **NPM Package**: [npmjs.com/package/tealtiger](https://www.npmjs.com/package/tealtiger)
- **PyPI Package**: [pypi.org/project/tealtiger](https://pypi.org/project/tealtiger/)
- **GitHub**: [github.com/agentguard-ai/tealtiger](https://github.com/agentguard-ai/tealtiger)

---

<div align="center">

Made with ❤️ for the AI community

</div>

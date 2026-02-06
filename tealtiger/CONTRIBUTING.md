# Contributing to TealTiger

Thank you for your interest in contributing to TealTiger! We welcome contributions from the community.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Coding Guidelines](#coding-guidelines)
- [Testing](#testing)
- [Documentation](#documentation)

---

## 📜 Code of Conduct

This project adheres to a Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to conduct@tealtiger.co.in.

### Our Standards

- Be respectful and inclusive
- Welcome newcomers
- Focus on what is best for the community
- Show empathy towards other community members

---

## 🤝 How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues. When creating a bug report, include:

- **Clear title and description**
- **Steps to reproduce**
- **Expected vs actual behavior**
- **Environment details** (OS, Node/Python version, SDK version)
- **Code samples** (if applicable)

### Suggesting Features

Feature requests are welcome! Please:

- **Check existing feature requests** first
- **Provide clear use case** and rationale
- **Describe the proposed solution**
- **Consider alternatives** you've thought about

### Contributing Code

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Make your changes**
4. **Write tests**
5. **Update documentation**
6. **Commit your changes** (`git commit -m 'Add amazing feature'`)
7. **Push to your fork** (`git push origin feature/amazing-feature`)
8. **Open a Pull Request**

---

## 🛠️ Development Setup

### Prerequisites

- Node.js 18+ (for TypeScript SDK)
- Python 3.8+ (for Python SDK)
- Git

### TypeScript SDK Setup

```bash
# Clone the repository
git clone https://github.com/agentguard-ai/tealtiger-typescript.git
cd tealtiger-typescript

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Run linter
npm run lint
```

### Python SDK Setup

```bash
# Clone the repository
git clone https://github.com/agentguard-ai/tealtiger-python.git
cd tealtiger-python

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Run linter
flake8
black .
mypy .
```

---

## 🔄 Pull Request Process

1. **Update documentation** for any changed functionality
2. **Add tests** for new features
3. **Ensure all tests pass** (`npm test` or `pytest`)
4. **Update CHANGELOG.md** with your changes
5. **Follow commit message conventions** (see below)
6. **Request review** from maintainers

### Commit Message Format

```
type(scope): subject

body (optional)

footer (optional)
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(guardrails): add bias detection guardrail

Implements a new guardrail that detects biased language in prompts and responses.

Closes #123
```

```
fix(cost): correct token counting for GPT-4

Token counting was off by 10% for GPT-4 models due to incorrect encoding.

Fixes #456
```

---

## 💻 Coding Guidelines

### TypeScript

- Use **TypeScript strict mode**
- Follow **ESLint rules** (run `npm run lint`)
- Use **Prettier** for formatting
- Write **JSDoc comments** for public APIs
- Prefer **async/await** over promises
- Use **meaningful variable names**

### Python

- Follow **PEP 8** style guide
- Use **type hints** for all functions
- Write **docstrings** for all public functions
- Use **Black** for formatting
- Use **mypy** for type checking
- Prefer **f-strings** for string formatting

### General

- **Keep functions small** and focused
- **Write self-documenting code**
- **Add comments** for complex logic
- **Avoid premature optimization**
- **Handle errors gracefully**

---

## 🧪 Testing

### Writing Tests

- **Write tests for all new features**
- **Maintain test coverage** above 80%
- **Test edge cases** and error conditions
- **Use descriptive test names**

### TypeScript Tests

```typescript
describe('GuardedOpenAI', () => {
  it('should detect PII in prompts', async () => {
    const client = new GuardedOpenAI({
      apiKey: 'test-key',
      guardrails: { piiDetection: true },
    });

    await expect(
      client.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'My SSN is 123-45-6789' }],
      })
    ).rejects.toThrow('PII detected');
  });
});
```

### Python Tests

```python
def test_pii_detection():
    """Test that PII is detected in prompts."""
    client = GuardedOpenAI(
        api_key="test-key",
        guardrails={"pii_detection": True},
    )

    with pytest.raises(PIIDetectedError):
        client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": "My SSN is 123-45-6789"}],
        )
```

---

## 📚 Documentation

### What to Document

- **Public APIs** - All public functions, classes, and methods
- **Configuration options** - All available settings
- **Examples** - Real-world usage examples
- **Migration guides** - For breaking changes

### Documentation Style

- Use **clear, concise language**
- Include **code examples**
- Explain **why**, not just **what**
- Keep **up to date** with code changes

---

## 🏆 Recognition

Contributors will be:

- Listed in [CONTRIBUTORS.md](./CONTRIBUTORS.md)
- Mentioned in release notes
- Eligible for contributor swag (coming soon!)

---

## 📞 Getting Help

- **GitHub Discussions**: [Ask questions](https://github.com/agentguard-ai/tealtiger/discussions)
- **Discord**: [Join our community](https://discord.gg/tealtiger) (coming soon)
- **Email**: contributors@tealtiger.co.in

---

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to TealTiger! 🎉


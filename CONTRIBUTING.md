# Contributing to TealTiger SDK

First off, thank you for considering contributing to TealTiger SDK! It's people like you that make TealTiger such a great tool for securing AI agents.

## 🌟 Ways to Contribute

There are many ways to contribute to TealTiger SDK:

- 🐛 **Report bugs** - Help us identify and fix issues
- 💡 **Suggest features** - Share ideas for new functionality
- 📝 **Improve documentation** - Help others understand and use the SDK
- 🔧 **Submit pull requests** - Contribute code improvements
- 💬 **Answer questions** - Help other users in discussions
- 🎨 **Share examples** - Show how you're using TealTiger

## 🚀 Getting Started

### Prerequisites

- Node.js 16+ and npm
- Git
- TypeScript knowledge (for code contributions)

### Development Setup

1. **Fork the repository**
   ```bash
   # Click the "Fork" button on GitHub
   ```

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/tealtiger.git
   cd tealtiger
   ```

3. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/agentguard-ai/tealtiger.git
   ```

4. **Install dependencies**
   ```bash
   npm install
   ```

5. **Run tests**
   ```bash
   npm test
   ```

6. **Build the project**
   ```bash
   npm run build
   ```

## 📝 Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test improvements

### 2. Make Your Changes

- Write clear, concise code
- Follow the existing code style
- Add tests for new functionality
- Update documentation as needed
- Keep commits focused and atomic

### 3. Test Your Changes

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linter
npm run lint

# Run type checking
npm run type-check
```

### 4. Commit Your Changes

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat: add new policy validation feature"
git commit -m "fix: resolve timeout issue in executeTool"
git commit -m "docs: update API reference for PolicyBuilder"
```

Commit message format:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Test additions or changes
- `chore:` - Build process or auxiliary tool changes

### 5. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 6. Create a Pull Request

1. Go to the [TealTiger repository](https://github.com/agentguard-ai/tealtiger)
2. Click "New Pull Request"
3. Select your fork and branch
4. Fill out the PR template
5. Submit the pull request

## 📋 Pull Request Guidelines

### PR Title

Use the same format as commit messages:
```
feat: add support for custom policy validators
fix: resolve memory leak in SSA client
docs: improve getting started guide
```

### PR Description

Include:
- **What** - What changes does this PR introduce?
- **Why** - Why are these changes needed?
- **How** - How were the changes implemented?
- **Testing** - How were the changes tested?
- **Screenshots** - If applicable, add screenshots

### PR Checklist

Before submitting, ensure:

- [ ] Code follows the project's style guidelines
- [ ] Tests pass locally (`npm test`)
- [ ] New tests added for new functionality
- [ ] Documentation updated (if needed)
- [ ] Commit messages follow conventional commits
- [ ] No merge conflicts with main branch
- [ ] PR description is clear and complete

## 🧪 Testing Guidelines

### Writing Tests

- Place tests in `__tests__` directories next to the code
- Use descriptive test names
- Test both success and failure cases
- Aim for high code coverage (>80%)

Example test structure:

```typescript
describe('TealTiger', () => {
  describe('executeTool', () => {
    it('should execute tool successfully with valid parameters', async () => {
      // Arrange
      const guard = new TealTiger(config);
      
      // Act
      const result = await guard.executeTool('test-tool', params);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should throw error when API key is invalid', async () => {
      // Arrange
      const guard = new TealTiger({ ...config, apiKey: 'invalid' });
      
      // Act & Assert
      await expect(
        guard.executeTool('test-tool', params)
      ).rejects.toThrow('Invalid API key');
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- TealTiger.test.ts

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## 📚 Documentation Guidelines

### Code Documentation

- Add JSDoc comments for all public APIs
- Include parameter descriptions and return types
- Provide usage examples

```typescript
/**
 * Execute a tool with security evaluation
 * 
 * @param toolName - Name of the tool to execute
 * @param parameters - Tool parameters
 * @param context - Execution context (sessionId, userId, etc.)
 * @param executor - Optional custom executor function
 * @returns Promise resolving to execution result
 * 
 * @example
 * ```typescript
 * const result = await guard.executeTool(
 *   'web-search',
 *   { query: 'AI security' },
 *   { sessionId: 'session-123' }
 * );
 * ```
 */
async executeTool(
  toolName: string,
  parameters: Record<string, any>,
  context: ExecutionContext,
  executor?: ToolExecutor
): Promise<ExecutionResult>
```

### README Updates

- Keep examples up-to-date
- Add new features to the feature list
- Update API reference for new methods

## 🎨 Code Style Guidelines

### TypeScript

- Use TypeScript for all new code
- Define interfaces for all public APIs
- Avoid `any` types when possible
- Use meaningful variable names

### Formatting

We use Prettier for code formatting:

```bash
npm run format
```

### Linting

We use ESLint for code quality:

```bash
npm run lint
npm run lint:fix
```

## 🐛 Bug Reports

### Before Submitting

1. Check if the bug has already been reported
2. Try to reproduce with the latest version
3. Gather relevant information

### Bug Report Template

```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Initialize TealTiger with '...'
2. Call executeTool with '...'
3. See error

**Expected behavior**
What you expected to happen.

**Actual behavior**
What actually happened.

**Environment**
- OS: [e.g., macOS 13.0]
- Node.js version: [e.g., 18.0.0]
- TealTiger SDK version: [e.g., 1.0.0]

**Additional context**
Any other relevant information.
```

## 💡 Feature Requests

### Before Submitting

1. Check if the feature has already been requested
2. Consider if it fits the project's scope
3. Think about how it would work

### Feature Request Template

```markdown
**Is your feature request related to a problem?**
A clear description of the problem.

**Describe the solution you'd like**
A clear description of what you want to happen.

**Describe alternatives you've considered**
Other solutions or features you've considered.

**Additional context**
Any other relevant information, mockups, or examples.
```

## 🔍 Code Review Process

### What We Look For

- **Correctness** - Does the code work as intended?
- **Tests** - Are there adequate tests?
- **Documentation** - Is the code well-documented?
- **Style** - Does it follow our style guidelines?
- **Performance** - Are there any performance concerns?
- **Security** - Are there any security implications?

### Review Timeline

- Initial review: Within 2-3 business days
- Follow-up reviews: Within 1-2 business days
- Merge: After approval from at least one maintainer

## 📜 Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inspiring community for all.

### Our Standards

**Positive behavior includes:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

**Unacceptable behavior includes:**
- Harassment, trolling, or discriminatory comments
- Publishing others' private information
- Other conduct which could reasonably be considered inappropriate

### Enforcement

Violations may result in:
1. Warning
2. Temporary ban
3. Permanent ban

Report violations to the repository maintainers via GitHub.

## 🏆 Recognition

Contributors will be:
- Listed in our [Contributors](https://github.com/agentguard-ai/tealtiger/graphs/contributors) page
- Mentioned in release notes for significant contributions
- Invited to our contributors Discord channel (coming soon)

## 📞 Getting Help

- **Questions?** Open a [Discussion](https://github.com/agentguard-ai/tealtiger/discussions)
- **Bug?** Open an [Issue](https://github.com/agentguard-ai/tealtiger/issues)
- **Security?** See [SECURITY.md](SECURITY.md) for reporting security vulnerabilities

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to TealTiger SDK! 🎉

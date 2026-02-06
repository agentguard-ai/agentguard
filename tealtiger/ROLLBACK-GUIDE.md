# TealTiger Rebrand Rollback Guide

This document provides instructions for rolling back the TealTiger rebrand to AgentGuard if critical issues are discovered.

## ⚠️ Rollback Triggers

Consider rolling back if any of the following occur:

### Critical Issues
- **Breaking bugs**: Core functionality is broken and cannot be fixed quickly
- **Security vulnerabilities**: New security issues introduced by the rebrand
- **Package registry issues**: Packages cannot be installed or have critical dependency conflicts
- **Legal issues**: Trademark or legal problems with the "TealTiger" name

### User Impact
- **Widespread complaints**: Multiple users reporting confusion or problems
- **Adoption failure**: Users refusing to migrate or abandoning the product
- **Integration failures**: Major frameworks or tools incompatible with new names

### Business Impact
- **Revenue loss**: Significant drop in usage or revenue
- **Reputation damage**: Negative press or community backlash
- **Partnership issues**: Key partners unable to work with rebranded product

## 🔄 Rollback Procedure

### Phase 1: Assessment (1-2 hours)

1. **Identify the scope**
   - Determine which components need rollback
   - Assess impact on existing users
   - Check if packages have been published

2. **Communicate with team**
   - Notify all team members of rollback decision
   - Assign responsibilities for rollback tasks
   - Set up incident response channel

3. **Notify users**
   - Post announcement on GitHub
   - Send email to users who have migrated
   - Update status page if available

### Phase 2: Code Rollback (2-4 hours)

#### Git Rollback

```bash
# Option 1: Revert specific commits
git log --oneline --grep="rebrand\|TealTiger" | head -20
git revert <commit-hash> <commit-hash> ...

# Option 2: Reset to pre-rebrand tag
git tag pre-rebrand-backup  # If you created this tag
git reset --hard pre-rebrand-backup

# Option 3: Cherry-pick good commits
git checkout -b rollback-branch
git cherry-pick <good-commits>
```

#### Manual Code Changes

If git revert is not clean, manually revert these changes:

**TypeScript SDK:**
```bash
# Rename classes back
TealOpenAI → GuardedOpenAI
TealAnthropic → GuardedAnthropic
TealAzureOpenAI → GuardedAzureOpenAI
TealOpenAIConfig → GuardedOpenAIConfig
TealAnthropicConfig → GuardedAnthropicConfig
TealAzureOpenAIConfig → GuardedAzureOpenAIConfig

# Rename files back
packages/tealtiger-sdk/src/clients/TealOpenAI.ts → GuardedOpenAI.ts
packages/tealtiger-sdk/src/clients/TealAnthropic.ts → GuardedAnthropic.ts
packages/tealtiger-sdk/src/clients/TealAzureOpenAI.ts → GuardedAzureOpenAI.ts

# Rename directories back
packages/tealtiger-sdk/ → packages/agent-guard-sdk/
```

**Python SDK:**
```bash
# Rename classes back
TealOpenAI → GuardedOpenAI
TealAnthropic → GuardedAnthropic
TealAzureOpenAI → GuardedAzureOpenAI

# Rename files back
packages/tealtiger-python/src/tealtiger/clients/teal_openai.py → guarded_openai.py
packages/tealtiger-python/src/tealtiger/clients/teal_anthropic.py → guarded_anthropic.py
packages/tealtiger-python/src/tealtiger/clients/teal_azure_openai.py → guarded_azure_openai.py

# Rename directories back
packages/tealtiger-python/ → packages/agentguard-python/
packages/tealtiger-python/src/tealtiger/ → src/agentguard/
```

**Configuration Files:**
```bash
# package.json
name: "tealtiger" → "agentguard-sdk"
version: "1.0.0" → "0.2.2" (or last stable version)
homepage: "https://tealtiger.co.in" → "https://agentguard.dev"

# pyproject.toml
name: "tealtiger" → "agentguard"
version: "1.0.0" → "0.2.2" (or last stable version)
```

**Documentation:**
```bash
# Replace all instances
TealTiger → AgentGuard
tealtiger → agentguard
tealtiger.co.in → agentguard.dev
support@tealtiger.co.in → support@agentguard.dev
```

### Phase 3: Package Rollback (1-2 hours)

#### NPM Rollback

```bash
# Option 1: Unpublish (only within 72 hours)
npm unpublish tealtiger@1.0.0

# Option 2: Deprecate and publish old name
npm deprecate tealtiger@1.0.0 "This package has been rolled back. Please use agentguard-sdk instead."
cd packages/agent-guard-sdk
npm version 0.2.3  # Bump patch version
npm publish
```

#### PyPI Rollback

```bash
# Option 1: Yank release (marks as unavailable but doesn't delete)
pip install twine
twine upload --repository pypi --skip-existing dist/*
# Then manually yank on PyPI web interface

# Option 2: Publish old name with new version
cd packages/agentguard-python
# Update version in pyproject.toml to 0.2.3
python -m build
twine upload dist/*
```

### Phase 4: Infrastructure Rollback (2-4 hours)

#### Repository Names

```bash
# GitHub repositories can be renamed back
# Go to Settings → General → Repository name
# Rename:
tealtiger → agentguard
tealtiger-typescript → agentguard-typescript
tealtiger-python → agentguard-python

# Note: GitHub provides automatic redirects from old names
```

#### Domain Rollback

```bash
# If tealtiger.co.in was configured:
# 1. Update DNS to point back to agentguard.dev
# 2. Update landing page config
# 3. Update all documentation links

# Landing page config (agentguard-landing/lib/config.ts)
url: 'https://agentguard.dev'
name: 'AgentGuard'
tagline: 'Secure your AI. Control your costs.'
```

#### CI/CD Rollback

```bash
# GitHub Actions workflows should work without changes
# But verify:
# 1. Package names in publish.yml
# 2. Test configurations
# 3. Environment variables
```

### Phase 5: Verification (1-2 hours)

1. **Run all tests**
   ```bash
   # TypeScript SDK
   cd packages/agent-guard-sdk
   npm test
   npm run build
   
   # Python SDK
   cd packages/agentguard-python
   pytest
   python -m build
   ```

2. **Test package installation**
   ```bash
   # NPM
   npm install agentguard-sdk
   
   # PyPI
   pip install agentguard
   ```

3. **Verify examples work**
   ```bash
   # Run all example files
   node examples/basic-usage.js
   python examples/basic_usage.py
   ```

4. **Check documentation**
   - Verify all links work
   - Check that README files are correct
   - Ensure migration guide is updated

### Phase 6: Communication (Ongoing)

1. **Announce rollback**
   - Post on GitHub Discussions
   - Update README with rollback notice
   - Send email to users

2. **Provide migration back guide**
   ```markdown
   # Migrating Back to AgentGuard
   
   ## TypeScript
   ```bash
   npm uninstall tealtiger
   npm install agentguard-sdk
   ```
   
   Update imports:
   ```typescript
   // Change from:
   import { TealOpenAI } from 'tealtiger';
   
   // Back to:
   import { GuardedOpenAI } from 'agentguard-sdk';
   ```
   
   ## Python
   ```bash
   pip uninstall tealtiger
   pip install agentguard
   ```
   
   Update imports:
   ```python
   # Change from:
   from tealtiger import TealOpenAI
   
   # Back to:
   from agentguard import GuardedOpenAI
   ```
   ```

3. **Monitor for issues**
   - Watch GitHub issues
   - Monitor package download metrics
   - Check error rates in logs

## ⏱️ Rollback Timeline

| Phase | Duration | Can Start |
|-------|----------|-----------|
| Assessment | 1-2 hours | Immediately |
| Code Rollback | 2-4 hours | After assessment |
| Package Rollback | 1-2 hours | After code rollback |
| Infrastructure Rollback | 2-4 hours | Parallel with package |
| Verification | 1-2 hours | After all rollbacks |
| Communication | Ongoing | Throughout process |

**Total estimated time**: 8-15 hours

## 🚨 Rollback Limitations

### Time-Sensitive Actions

1. **NPM unpublish**: Only available within 72 hours of publication
2. **PyPI yank**: Can be done anytime, but doesn't delete the package
3. **User migrations**: Users who already migrated will need to migrate back

### Permanent Changes

1. **Git history**: Rollback commits will be in history
2. **Package versions**: Cannot reuse version numbers (1.0.0 is burned)
3. **User confusion**: Some users may have already migrated

### Automatic Redirects

1. **GitHub**: Provides automatic redirects from old repository names
2. **NPM**: No automatic redirects (users must update package name)
3. **PyPI**: No automatic redirects (users must update package name)

## 📋 Rollback Checklist

### Pre-Rollback
- [ ] Assess severity of issue
- [ ] Get team approval for rollback
- [ ] Create rollback branch
- [ ] Tag current state for reference
- [ ] Notify users of impending rollback

### Code Rollback
- [ ] Revert or manually change all class names
- [ ] Revert or manually change all file names
- [ ] Revert or manually change all directory names
- [ ] Update all configuration files
- [ ] Update all documentation
- [ ] Run all tests
- [ ] Verify build succeeds

### Package Rollback
- [ ] Unpublish or deprecate new packages
- [ ] Publish old packages with new patch version
- [ ] Test package installation
- [ ] Verify package metadata

### Infrastructure Rollback
- [ ] Rename GitHub repositories
- [ ] Update domain configuration
- [ ] Update landing page
- [ ] Verify CI/CD pipelines
- [ ] Update all external links

### Post-Rollback
- [ ] Announce rollback to users
- [ ] Provide migration back guide
- [ ] Monitor for issues
- [ ] Document lessons learned
- [ ] Plan for future rebrand attempt (if applicable)

## 📞 Emergency Contacts

- **Technical Lead**: [Your contact]
- **DevOps**: [Your contact]
- **Community Manager**: [Your contact]
- **NPM Support**: https://www.npmjs.com/support
- **PyPI Support**: https://pypi.org/help/

## 📝 Post-Rollback Analysis

After rollback is complete, document:

1. **Root cause**: What went wrong?
2. **Impact**: How many users were affected?
3. **Response time**: How long did rollback take?
4. **Lessons learned**: What would we do differently?
5. **Future plans**: Will we attempt rebrand again?

---

**Last Updated**: February 2026
**Version**: 1.0
**Status**: Ready for use if needed

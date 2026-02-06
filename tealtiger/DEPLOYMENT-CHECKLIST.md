# TealTiger Deployment Checklist

Quick checklist for deploying the rebranded TealTiger product.

---

## ✅ Pre-Deployment (Completed)

- [x] All code changes complete
- [x] All documentation updated
- [x] All examples updated
- [x] TypeScript SDK tests passing (318/318)
- [x] Package configurations updated
- [x] Landing page configuration updated
- [x] Migration guide created
- [x] Rollback guide created
- [x] Comprehensive review complete

---

## 🚀 Deployment Steps

### 1. GitHub Repository Setup

- [ ] **Create main repository**
  - Go to: https://github.com/organizations/agentguard-ai/repositories/new
  - Name: `tealtiger`
  - Description: `Powerful protection for AI agents - Open-source security and cost tracking for AI applications`
  - Public repository
  - Initialize with README: No (we'll push our own)

- [ ] **Rename TypeScript SDK repository**
  - Go to: https://github.com/agentguard-ai/agentguard-typescript/settings
  - Rename: `agentguard-typescript` → `tealtiger-typescript`
  - Update description: `TealTiger TypeScript/JavaScript SDK - Drop-in security and cost tracking for OpenAI, Anthropic, and Azure OpenAI`

- [ ] **Rename Python SDK repository**
  - Go to: https://github.com/agentguard-ai/agentguard-python/settings
  - Rename: `agentguard-python` → `tealtiger-python`
  - Update description: `TealTiger Python SDK - Drop-in security and cost tracking for OpenAI, Anthropic, and Azure OpenAI`

### 2. Upload Files to Repositories

**Main Repository (`tealtiger`):**
```bash
# Clone the new repository
git clone https://github.com/agentguard-ai/tealtiger.git
cd tealtiger

# Copy all files from tealtiger/ directory
cp -r ../ai-agent-security-platform/tealtiger/* .

# Add, commit, and push
git add .
git commit -m "Initial commit: TealTiger v1.0.0"
git push origin main
```

**TypeScript SDK (`tealtiger-typescript`):**
```bash
# Clone the renamed repository
git clone https://github.com/agentguard-ai/tealtiger-typescript.git
cd tealtiger-typescript

# Copy all files from packages/tealtiger-sdk/
cp -r ../ai-agent-security-platform/packages/tealtiger-sdk/* .

# Add, commit, and push
git add .
git commit -m "Rebrand to TealTiger v1.0.0"
git push origin main
```

**Python SDK (`tealtiger-python`):**
```bash
# Clone the renamed repository
git clone https://github.com/agentguard-ai/tealtiger-python.git
cd tealtiger-python

# Copy all files from packages/tealtiger-python/
cp -r ../ai-agent-security-platform/packages/tealtiger-python/* .

# Add, commit, and push
git add .
git commit -m "Rebrand to TealTiger v1.0.0"
git push origin main
```

### 3. Publish NPM Package

```bash
cd tealtiger-typescript

# Login to NPM (if not already logged in)
npm login

# Publish the package
npm publish

# Verify publication
npm view tealtiger
```

**Expected Output:**
```
tealtiger@1.0.0 | MIT | deps: 3 | versions: 1
Powerful protection for AI agents
https://tealtiger.co.in

keywords: ai, security, cost-tracking, openai, anthropic, azure, guardrails

dist
.tarball: https://registry.npmjs.org/tealtiger/-/tealtiger-1.0.0.tgz
```

### 4. Publish PyPI Package

```bash
cd tealtiger-python

# Install build tools (if not already installed)
pip install build twine

# Build the package
python -m build

# Upload to PyPI
python -m twine upload dist/*

# Verify publication
pip index versions tealtiger
```

**Expected Output:**
```
tealtiger (1.0.0)
Available versions: 1.0.0
```

### 5. Deploy Landing Page

**Option A: Rename Directory (Recommended)**
```bash
cd ai-agent-security-platform

# Rename the directory using git
git mv agentguard-landing tealtiger-landing

# Commit the change
git commit -m "Rename landing page directory to tealtiger-landing"

# Push to GitHub
git push origin main
```

**Option B: Update Netlify Configuration**
- Go to: https://app.netlify.com/sites/mellifluous-melba-f67d20/settings/deploys
- Update "Base directory": `agentguard-landing` → `tealtiger-landing` (after renaming)
- Save changes
- Trigger new deployment

### 6. Domain Configuration

- [ ] **Purchase domain**
  - Domain: `tealtiger.co.in`
  - Registrar: (your choice - Namecheap, GoDaddy, etc.)

- [ ] **Configure DNS**
  - Add CNAME record: `tealtiger.co.in` → `mellifluous-melba-f67d20.netlify.app`
  - Or follow Netlify's custom domain setup guide

- [ ] **Update Netlify**
  - Go to: https://app.netlify.com/sites/mellifluous-melba-f67d20/settings/domain
  - Add custom domain: `tealtiger.co.in`
  - Enable HTTPS

### 7. Create GitHub Releases

**Main Repository:**
- Go to: https://github.com/agentguard-ai/tealtiger/releases/new
- Tag: `v1.0.0`
- Title: `TealTiger v1.0.0 - Initial Release`
- Description: See `tealtiger/CHANGELOG.md` for release notes

**TypeScript SDK:**
- Go to: https://github.com/agentguard-ai/tealtiger-typescript/releases/new
- Tag: `v1.0.0`
- Title: `TealTiger TypeScript SDK v1.0.0`
- Description: See `packages/tealtiger-sdk/CHANGELOG.md`

**Python SDK:**
- Go to: https://github.com/agentguard-ai/tealtiger-python/releases/new
- Tag: `v1.0.0`
- Title: `TealTiger Python SDK v1.0.0`
- Description: See `packages/tealtiger-python/CHANGELOG.md`

---

## 🧪 Post-Deployment Verification

### NPM Package
```bash
# Install and test
npm install tealtiger
node -e "const { TealOpenAI } = require('tealtiger'); console.log('✅ NPM package works!');"
```

### PyPI Package
```bash
# Install and test
pip install tealtiger
python -c "from tealtiger import TealOpenAI; print('✅ PyPI package works!')"
```

### Landing Page
- [ ] Visit: https://tealtiger.co.in
- [ ] Check all links work
- [ ] Check GitHub links point to correct repos
- [ ] Check NPM/PyPI links work
- [ ] Check mobile responsiveness

### GitHub Repositories
- [ ] Main repo README displays correctly
- [ ] TypeScript SDK README displays correctly
- [ ] Python SDK README displays correctly
- [ ] All badges show correct information
- [ ] All links work

---

## 📢 Announcement (Optional)

### Social Media
- [ ] Twitter/X announcement
- [ ] LinkedIn post
- [ ] Dev.to blog post
- [ ] Reddit r/MachineLearning post

### Communities
- [ ] Hacker News Show HN
- [ ] Product Hunt launch
- [ ] Discord/Slack communities

---

## 🔄 Rollback Plan

If anything goes wrong, see `tealtiger/ROLLBACK-GUIDE.md` for detailed rollback instructions.

**Quick Rollback:**
1. Unpublish NPM package: `npm unpublish tealtiger@1.0.0`
2. Delete PyPI release (contact PyPI support)
3. Revert GitHub repository names
4. Restore landing page configuration
5. Republish old packages

---

## ✅ Deployment Complete

Once all steps are checked off:

- [ ] All repositories created/renamed
- [ ] All files uploaded
- [ ] NPM package published
- [ ] PyPI package published
- [ ] Landing page deployed
- [ ] Domain configured
- [ ] GitHub releases created
- [ ] Post-deployment verification passed

**Congratulations! TealTiger is now live! 🎉**

---

## 📞 Support

If you encounter any issues during deployment:

- **Email**: support@tealtiger.co.in
- **GitHub Issues**: https://github.com/agentguard-ai/tealtiger/issues
- **Review Document**: See `tealtiger/REBRAND-REVIEW-COMPLETE.md`

# ⚠️ URGENT: Sensitive Files in Public Repository

## 🚨 Issue Identified

The main TealTiger repository at https://github.com/agentguard-ai/tealtiger contains **sensitive internal files** that should not be public:

- Internal documentation (agentguard-internal-docs/)
- Strategy and planning documents
- Daily progress reports
- Marketing plans
- Competitive analysis
- Internal scripts and tools
- Old deprecated folders with potentially sensitive data

## 📋 What Was Done

1. ✅ Created comprehensive `.gitignore` to prevent future commits
2. ✅ Created `PUBLIC-REPO-FILES.md` documenting what should/shouldn't be public
3. ✅ Created cleanup script `remove-sensitive-files-from-git.bat`

## 🔧 Required Actions

### Option 1: Clean Current Repository (Recommended)

**Steps:**
1. Run the cleanup script:
   ```cmd
   remove-sensitive-files-from-git.bat
   ```

2. Review what will be removed:
   ```cmd
   git status
   ```

3. Commit the removal:
   ```cmd
   git commit -m "chore: remove sensitive internal files from public repository"
   ```

4. **Force push** to rewrite history (⚠️ DESTRUCTIVE):
   ```cmd
   git push --force origin main
   ```

**⚠️ Warning**: Force pushing rewrites Git history. Anyone who has cloned the repo will need to re-clone.

### Option 2: Create New Clean Repository (Safest)

**Steps:**
1. Create a new repository: `tealtiger-public`
2. Copy only public files (see `PUBLIC-REPO-FILES.md`)
3. Initialize fresh Git history
4. Push to new repository
5. Archive old repository
6. Update all links to point to new repository

### Option 3: Make Repository Private (Temporary)

**Steps:**
1. Go to repository Settings
2. Scroll to "Danger Zone"
3. Click "Change visibility" → "Make private"
4. Clean up sensitive files
5. Make public again when ready

## 📁 Files That Should Be Removed

### Folders (Entire Directories)
- `agentguard-internal-docs/` - All internal documentation
- `agentguard/` - Old branding folder
- `agentguard-landing/` - Old landing page
- `agent-guard-sdk-public/` - Old SDK
- `tealtiger/` - Old folder structure
- `test-deprecated/` - Deprecated tests
- `test-install/` - Test installation folder
- `database/` - Database files
- `postman/` - Postman collections (may contain API keys)
- `htmlcov/` - Test coverage HTML
- `.hypothesis/` - Hypothesis test data
- `src/` - Source code (if monorepo wrapper only)

### Individual Files (100+ files)
All files matching these patterns:
- `*-STRATEGY.md`
- `*-PLAN.md`
- `*-PROGRESS-*.md`
- `*-STATUS*.md`
- `*-SUMMARY.md`
- `*-CHECKLIST*.md`
- `*-COMPLETE*.md`
- `DAILY-*.md`
- `WEEK-*.md`
- `PHASE-*.md`
- `LAUNCH-*.md`
- `PUBLISH-*.md`
- `RELEASE-*.md`
- `DEPLOY-*.md`
- `MARKETING-*.md`
- `SOCIAL-MEDIA-*.md`
- `BLOGGING-*.md`
- `BLOG-POST-*.md`
- `COMPETITIVE-*.md`
- `PRODUCT-*.md`
- `PROJECT-*.md`
- `DEVELOPMENT-*.md`
- `PYPI-*.md`
- `PYTHON-SDK-*.md`
- `GITHUB-*.md`
- `REPOSITORY-*.md`
- `CLEANUP-*.md`
- `AUDIT-*.md`
- And many more...

### Scripts
- `cleanup-*.bat`
- `copy-*.bat`
- `final-*.bat`
- `remove-*.bat`
- `update-*.bat`
- `push-examples.bat/sh`

## 📊 Impact Assessment

### What's Exposed
- ❌ Internal business strategy
- ❌ Marketing plans and timelines
- ❌ Competitive analysis
- ❌ Development progress and status
- ❌ Internal decision-making process
- ❌ Potentially sensitive scripts

### What Should Remain Public
- ✅ README.md
- ✅ LICENSE
- ✅ CODE_OF_CONDUCT.md
- ✅ CONTRIBUTING.md
- ✅ SECURITY.md
- ✅ CHANGELOG.md
- ✅ `.github/` (community files)
- ✅ `packages/` (SDK submodules)
- ✅ `examples/` (code examples)
- ✅ `docs/` (public documentation)

## 🎯 Recommended Approach

**I recommend Option 1 (Clean Current Repository)** because:
1. Maintains existing GitHub stars/forks
2. Keeps existing links working
3. Can be done quickly
4. Git history rewrite is acceptable for a new project

**Steps to execute:**
1. Make repository private temporarily (Settings → Change visibility)
2. Run cleanup script
3. Force push to remove files from history
4. Verify all sensitive files are gone
5. Make repository public again

## ⏱️ Timeline

- **Immediate**: Make repository private
- **Within 1 hour**: Run cleanup and force push
- **Verification**: Check GitHub to ensure files are gone
- **Final**: Make repository public again

## 📞 Next Steps

**DO NOT PUSH ANY MORE CHANGES** until sensitive files are removed.

Choose one of the three options above and execute immediately.

## 🔒 Prevention

Going forward:
- ✅ `.gitignore` is now comprehensive
- ✅ Use separate private repository for internal docs
- ✅ Review all commits before pushing
- ✅ Use pre-commit hooks to prevent sensitive files
- ✅ Regular audits of public repositories

---

**Created**: $(Get-Date)
**Priority**: 🔴 CRITICAL
**Action Required**: IMMEDIATE

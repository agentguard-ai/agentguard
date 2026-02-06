# Public Repository Files - What Should Be Included

## ✅ Files That SHOULD Be Public

### Root Files
- README.md (main repository overview)
- LICENSE
- CODE_OF_CONDUCT.md
- CONTRIBUTING.md
- SECURITY.md
- CHANGELOG.md
- .gitignore
- .eslintrc.js
- jest.config.js
- tsconfig.json
- package.json

### Directories
- `.github/` (issue templates, workflows, community files)
- `.kiro/` (specs for development)
- `packages/` (SDK submodules - tealtiger-sdk, tealtiger-python)
- `examples/` (code examples)
- `docs/` (public documentation only)

### What `.github/` Should Contain
- ISSUE_TEMPLATE/
- workflows/ (CI/CD)
- SUPPORT.md
- ENABLE-DISCUSSIONS-GUIDE.md
- ENABLE-SECURITY-ADVISORIES-GUIDE.md
- SOCIAL-PREVIEW-SPEC.md
- pull_request_template.md

## ❌ Files That Should NOT Be Public

### Internal Documentation
- agentguard-internal-docs/ (entire folder)
- All *-STRATEGY.md files
- All *-PLAN.md files
- All *-PROGRESS-*.md files
- All *-STATUS*.md files
- All *-SUMMARY.md files
- All *-CHECKLIST*.md files
- All DAILY-*.md, WEEK-*.md files
- All LAUNCH-*, PUBLISH-*, RELEASE-* files
- All MARKETING-*, SOCIAL-MEDIA-* files
- All BLOGGING-*, BLOG-POST-* files
- All COMPETITIVE-*, PRODUCT-*, PROJECT-* files
- All DEVELOPMENT-*, PYPI-*, PYTHON-SDK-* files
- All GITHUB-*, REPOSITORY-*, CLEANUP-* files
- All AUDIT-*, DISCOVERY-*, POSITIONING-* files

### Old/Deprecated Folders
- agentguard/ (old branding)
- agentguard-landing/ (old landing page)
- agent-guard-sdk-public/ (old SDK)
- tealtiger/ (old folder structure)
- test-deprecated/
- test-install/

### Internal Scripts
- cleanup-*.bat
- copy-*.bat
- final-*.bat
- remove-*.bat
- update-*.bat
- push-examples.bat/sh

### Build/Test Artifacts
- htmlcov/
- .hypothesis/
- .coverage
- node_modules/

### Infrastructure
- database/ (if contains sensitive data)
- postman/ (if contains API keys)
- docker-compose*.yml (if contains sensitive config)
- src/ (if this is just a monorepo wrapper)

### Misc
- Document.txt
- CLEANUP-ACTION-REQUIRED.txt
- All README-*.md except main README.md

## 🔧 Cleanup Actions Required

1. Update .gitignore to exclude all sensitive files
2. Remove sensitive files from Git tracking: `git rm --cached <files>`
3. Commit the removal: `git commit -m "chore: remove sensitive files"`
4. Force push if needed: `git push --force origin main`
5. Verify on GitHub that sensitive files are gone

## ⚠️ Important Notes

- Files removed from Git tracking will still exist locally
- Consider using a separate private repository for internal docs
- Never commit API keys, credentials, or sensitive business information
- Review all markdown files before making repository public

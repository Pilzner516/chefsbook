This is a git history cleanup session. No feature code changes.

## AGENTS TO READ FIRST
1. `.claude/agents/wrapup.md`
2. `CLAUDE.md`
3. `DONE.md`
4. `.claude/agents/testing.md`

---

## OBJECTIVE

Remove API keys and secrets from git history so that GitHub push protection
stops blocking all pushes. Multiple sessions of work are currently stuck as
local-only commits because of this blocker.

---

## CONTEXT

GitHub push protection is detecting Anthropic API keys in old commits
(specifically a3b6835904 and likely others). Current commits contain no
secrets — the blocker is historical commits only.

The local repo has undeployed commits that need to be pushed:
- 437e439 (YouTube classification confirmation dialog)
- 828257a (DONE.md update)
- Any other local commits not yet on origin

---

## STEP 1 — Identify all affected commits

```bash
cd C:\Users\seblu\aiproj\chefsbook

# List all local commits not yet pushed
git log origin/main..HEAD --oneline

# Search history for known secret patterns
git log --all --oneline | head -50
```

Also check what secrets GitHub detected — the push rejection message
names the specific commit SHAs.

---

## STEP 2 — Choose cleanup method

### Option A — BFG Repo Cleaner (preferred, fastest)
BFG is simpler than git filter-branch for secret removal.

```bash
# Download BFG (requires Java)
# https://rtyley.github.io/bfg-repo-cleaner/

# Create a file listing the secrets to remove
# (use placeholder text, not the actual keys)
echo "ANTHROPIC_API_KEY_VALUE_HERE" > secrets.txt

# Run BFG against the repo
java -jar bfg.jar --replace-text secrets.txt chefsbook.git

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push origin main --force
```

### Option B — git filter-branch (fallback if BFG unavailable)
```bash
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env .env.local' \
  --prune-empty --tag-name-filter cat -- --all
```

### Option C — Allow the push with GitHub bypass (if admin access available)
If the repo owner has admin access on GitHub, the push can be bypassed
for specific commits without rewriting history. This is the least
destructive option.

Go to: GitHub repo → Settings → Code security → Secret scanning →
Push protection → bypass the specific flagged push.

Try Option C first — it's non-destructive. If not available, use Option A.

---

## STEP 3 — Verify secrets are gone

```bash
# After cleanup, verify no secrets in history
git log --all --oneline
git show HEAD
```

---

## STEP 4 — Push all pending commits

```bash
git push origin main
```

If force push was needed (after BFG), use:
```bash
git push origin main --force
```

---

## STEP 5 — Pull and rebuild on RPi5

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull origin main
NODE_OPTIONS=--max-old-space-size=1536 npx next build --no-lint
pm2 restart chefsbook-web
```

Verify:
```bash
curl -I https://chefsbk.app/
curl -I https://chefsbk.app/dashboard
```

Both must return HTTP 200.

---

## STEP 6 — Update extension

After web is deployed, package and deploy the updated extension:
```bash
cd apps/extension
# Verify manifest.json version is 1.1.2 (set in Prompt H)
# Zip and deploy to Pi
```

---

## GUARDRAILS
- Do NOT commit any actual API keys or secrets anywhere
- Do NOT use --force push unless history was rewritten (BFG/filter-branch)
- If Option C (bypass) is used, no force push is needed
- After cleanup, verify .gitignore has .env and .env.local listed

---

## WRAPUP REQUIREMENT
DONE.md entry must include:
- Which option was used (A, B, or C)
- Commit SHAs that are now on origin/main
- Confirmation web build succeeded on RPi5
- Confirmation chefsbk.app returns HTTP 200
- Extension version deployed (if updated)

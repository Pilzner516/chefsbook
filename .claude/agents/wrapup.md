# ChefsBook Wrapup Agent
# Run this at the end of every Claude Code session.

## MANDATORY PRE-WRAPUP TESTING

You MUST complete all of the following before updating DONE.md.
"Verified in source" does NOT count. Only actual test execution counts.

### DB verification (any session with DB writes)
Run for EVERY table written to this session:
```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/supabase
docker compose exec db psql -U postgres -d postgres -c \
  "SELECT * FROM [table] ORDER BY created_at DESC LIMIT 3;"
```
Confirm rows exist. If not, the feature is broken — fix before /wrapup.

### Cross-platform verification
If the session was cross-platform (mobile + web):
- Web: curl -I https://chefsbk.app/[affected-page] returns 200
- Mobile: ADB screenshot confirms UI renders correctly
- BOTH must pass. If only one platform tested, the session is NOT done.

### Entry point verification
If a new component was built, verify it is used in ALL required locations:
```bash
grep -rn "NewComponentName" apps/ --include="*.tsx"
```
Count the usages. If fewer than expected, wire the missing entry points first.

### Schema verification
For any new query written: confirm column names match actual DB schema.
```bash
docker compose exec db psql -U postgres -d postgres -c "\d [tablename]"
```

### Deployment (web sessions)
Follow .claude/agents/deployment.md fully before /wrapup.
Do not update DONE.md until chefsbk.app is serving the new code.

## Navigator update check

After committing all changes:
- Check if any screens were added, removed, or significantly changed
- If yes: update .claude/agents/navigator.md
  - Update the relevant screen entries
  - Add a changelog entry with today's date
  - Commit the updated navigator: git add .claude/agents/navigator.md

## POST-FLIGHT AGENT CHECKS (run before updating DONE.md)

Before declaring a session complete, confirm:

UI checks:
- Every new bottom-positioned element uses useSafeAreaInsets()
- Every new screen with text input has KeyboardAvoidingView
- Every new button row fits at 360px minimum width
- Every new user-visible string has i18n keys in all 5 locale files

Import checks (if any import path was touched):
- URL routing: Instagram URLs → IG handler, recipe URLs → URL handler, never to search
- Every import path shows PostImportImageSheet if an image could be available
- Every imported recipe has title, description, ingredients, steps populated

Image checks (if any image code was touched):
- All uploads use FileSystem.uploadAsync with Authorization + apikey headers
- All Image components for Supabase URLs have apikey header
- Recipe card reflects image changes without app restart

Data checks (if any store or DB query was touched):
- After any write: the displaying screen reflects the change without navigation
- List screens use useFocusEffect to refresh on focus

General:
- No console.log or console.warn left in production code
- TypeScript: tsc --noEmit passes with no errors

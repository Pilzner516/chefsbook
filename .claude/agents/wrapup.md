# ChefsBook Wrapup Agent
# Run this at the end of every Claude Code session.

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

# Prompt: Raw alert() Cleanup
# Launch: Read docs/prompts/prompt-alert-cleanup.md and execute it fully.

## OBJECTIVE
Replace all remaining raw `alert()`, `confirm()`, and `prompt()` calls in `apps/web`
with the ChefsBook dialog system (`useAlertDialog` / `ChefsDialog`).

Raw browser dialogs block the main thread, look inconsistent, and break on mobile.
The replacement system already exists — this is purely a mechanical cleanup.

## PRE-FLIGHT
1. Read `.claude/agents/ui-guardian.md` — MANDATORY
2. Read `.claude/agents/feature-registry.md` — check dialog system entry
3. Read `.claude/agents/testing.md` — MANDATORY
4. Read `.claude/agents/deployment.md` — MANDATORY

Find every raw call:
```bash
grep -rn "window\.alert\|window\.confirm\|window\.prompt\|\balert(\|\bconfirm(\|\bprompt(" apps/web --include="*.tsx" --include="*.ts" | grep -v "node_modules" | grep -v ".next"
```

List all findings before writing a single line of code. Count them.

## REPLACEMENT RULES

### alert() → informational dialog
```tsx
// BEFORE
alert("Recipe saved successfully!")

// AFTER — import useAlertDialog from the existing hook
const { showAlert } = useAlertDialog()
showAlert({ title: "Saved", message: "Recipe saved successfully." })
```

### confirm() → confirmation dialog
```tsx
// BEFORE
if (confirm("Delete this recipe?")) { doDelete() }

// AFTER
const { showConfirm } = useAlertDialog()
showConfirm({
  title: "Delete Recipe",
  message: "This cannot be undone.",
  confirmLabel: "Delete",
  onConfirm: () => doDelete()
})
```

### Error alerts → toast or error dialog
If the call is an error message (e.g. `alert("Something went wrong")`),
prefer a toast notification if the project uses one, otherwise use `showAlert`.

## GUARDRAILS
- Do NOT change any dialog logic — only the mechanism of display
- Do NOT skip any file — fix 100% of occurrences
- Each file must compile after its changes (check incrementally)
- If a `confirm()` is used in a non-async context that makes async difficult,
  note it as a comment TODO but still replace the raw call
- Never use `window.alert` as a fallback

## VERIFICATION
After all replacements:
1. `cd apps/web && npx tsc --noEmit` — must be clean (0 errors)
2. Repeat the grep — must return 0 results
3. Spot-check 3 different replaced dialogs in browser to confirm they render

## DEPLOYMENT
Deploy per `deployment.md` after TypeScript is clean.

## WRAPUP REQUIREMENT
DONE.md entry must include:
- Total count of raw calls found at start
- Total count replaced
- Files changed (list them)
- tsc clean confirmed
- grep returns 0 confirmed
- Deploy confirmed

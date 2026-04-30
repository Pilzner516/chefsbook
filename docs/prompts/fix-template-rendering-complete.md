# Prompt: Complete Template Rendering Fix — End to End

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/fix-template-rendering-complete.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: BUG FIX — WEB ONLY

## Situation

Five hotfix sessions have not resolved preview generation. The error chain is:

```
⚠ Found lockfile missing swc dependencies, patching...
⨯ Failed to patch lockfile, please try uninstalling and reinstalling next
[TypeError: Cannot read properties of undefined (reading 'os')]
[Error: Minified React error #130 args[]=undefined args[]= ]
PDF generation error: TypeError: Cannot read properties of null (reading 'props')
```

React error #130 with `args[]=undefined` means a component being rendered INSIDE
a template is `undefined` at runtime. This is NOT about the template function
itself — the template is being called correctly. Something the template tries to
render (a react-pdf primitive, a sub-component, or a conditional element) is
resolving to `undefined`.

The lockfile/SWC warning may indicate a compilation issue affecting how
@react-pdf/renderer imports resolve in the server context.

This session fixes the problem completely and permanently. No more hotfixes.

---

## Agent files to read — in order, before writing any code

- `.claude/agents/wrapup.md`
- `.claude/agents/publishing.md`
- `.claude/agents/pdf-design.md`
- `.claude/agents/deployment.md`

---

## Pre-flight — read everything, trust nothing from previous sessions

Previous sessions made multiple changes to the templates, engine, and generate
route. The current state of these files may not match what any session described.
Read every file completely before forming any theory about the cause.

### Step 1 — Check the SWC/lockfile warning first

```bash
cd /mnt/chefsbook/repo && cat package-lock.json | grep -i "swc" | head -20
cd apps/web && npm ls @swc/core 2>&1 | head -10
```

If SWC dependencies are genuinely missing, this could prevent correct compilation
of TSX files including the templates. Fix this first before anything else:

```bash
cd /mnt/chefsbook/repo/apps/web && npm install
```

Then redeploy and test. If the error changes, report the new error before continuing.

### Step 2 — Read the current generate route completely

Read `apps/web/app/api/print-cookbooks/[id]/generate/route.ts` from top to bottom.
Write down:
- How `TemplateEngine.getTemplate()` is called and what it returns
- How `React.createElement()` is called — what is the first argument, what is the second
- Whether `React` is imported at the top of the file
- What `buildContext()` receives and what it returns

### Step 3 — Read the current trattoria.tsx completely

Read `apps/web/lib/pdf-templates/trattoria.tsx` from top to bottom. Write down:
- Every import statement — are all react-pdf primitives imported?
- The function signature — what does it accept?
- How it destructures its props — does `ctx.layout`, `ctx.settings`, `ctx.recipes` exist in TemplateContext?
- Every JSX element used — `<Document>`, `<Page>`, `<View>`, `<Text>`, `<Image>`, etc.
- Whether any sub-component is defined separately and whether it could be undefined
- Any conditional rendering that might produce undefined

### Step 4 — Run the React error decoder

React error #130 means "Element type is invalid — expected a string or class/function
but got: undefined (or null)". To find WHICH component is undefined, temporarily
switch to development mode rendering and check the full error:

```bash
# Check what NODE_ENV is set to in the generate route context
grep -n "NODE_ENV\|process.env" /mnt/chefsbook/repo/apps/web/app/api/print-cookbooks/*/generate/route.ts | head -10
```

Also add a temporary debug wrapper around the createElement call in the generate
route to catch and log which component is undefined:

```typescript
// TEMPORARY DEBUG — remove before wrapup
try {
  const element = React.createElement(TemplateDocument, context);
  console.log('[DEBUG] createElement succeeded, element type:', element?.type);
  const interiorBuffer = await renderToBuffer(element);
} catch (err) {
  console.error('[DEBUG] createElement or renderToBuffer failed:', err);
  console.error('[DEBUG] TemplateDocument type:', typeof TemplateDocument);
  console.error('[DEBUG] context keys:', Object.keys(context || {}));
  throw err;
}
```

Deploy this debug version, trigger a preview generation, then read PM2 logs
to see the actual debug output before writing any fix.

### Step 5 — Check ALL react-pdf imports in trattoria.tsx

The most common cause of React error #130 in react-pdf templates is a component
that is imported but resolves to undefined at runtime, often because:
- The import path is wrong after files were moved
- A named export doesn't exist in the installed version of @react-pdf/renderer
- A component is used in JSX but not imported (TypeScript may still compile)

```bash
# Check what version of react-pdf is installed
grep "@react-pdf/renderer" /mnt/chefsbook/repo/apps/web/package.json

# Check what the template imports
grep "^import" /mnt/chefsbook/repo/apps/web/lib/pdf-templates/trattoria.tsx
```

Verify every imported component actually exists in the installed version.

### Step 6 — Check the engine index for the system template path

```bash
grep -n "require\|import\|getTemplate\|system" /mnt/chefsbook/repo/apps/web/lib/pdf-templates/engine/index.ts | head -30
```

Confirm whether `getTemplate()` looks for templates in `./trattoria` or
`./system/trattoria`. The template migration moved files to a `system/`
subdirectory in the original plan — confirm whether this happened and whether
the engine paths match the actual file locations.

```bash
ls /mnt/chefsbook/repo/apps/web/lib/pdf-templates/
ls /mnt/chefsbook/repo/apps/web/lib/pdf-templates/system/ 2>/dev/null || echo "no system dir"
```

**This is critical** — if the engine requires `./system/trattoria` but the file
is at `./trattoria`, the require() returns an empty module and the component
is undefined.

---

## Fix approach

After the pre-flight, you will know the exact cause. Fix only what is broken.
Do not refactor anything that is working.

**If it is the SWC lockfile:** Run `npm install` in apps/web, redeploy, test.

**If it is a wrong import path in engine/index.ts:** Fix the require() paths.

**If it is an undefined component inside the template:** Fix that specific import.

**If it is a props mismatch between buildContext() output and template expectations:**
Reconcile the field names — pick one canonical shape and make both match.

**If it is multiple issues:** Fix them in order of dependency, test after each.

---

## Constraints

- Do NOT restructure the engine or templates beyond what is needed to fix the error
- Do NOT move any files
- Do NOT change the visual design of any template
- Remove ALL debug logging before wrapup
- Preserve the preview/print path split (publishing.md)
- Do NOT touch any mobile files

---

## Testing

### After deploy — verify in PM2 first

```bash
pm2 logs chefsbook-web --lines 30 --nostream | grep -i "error\|null\|undefined\|DEBUG"
```

Confirm the `[DEBUG]` lines appear and show what the actual failure is.
Then fix that specific thing, remove the debug logging, redeploy, and test again.

### Manual verification — do not wrap without these passing

1. Open a cookbook in the canvas editor
2. Click Generate Preview
3. Confirm the preview modal opens with recipe content visible — no error dialog
4. Confirm in PM2 logs: no TypeError, no React error #130 after the generation
5. Switch to BBQ template — generate preview — confirm it renders
6. Switch to Square (8×8) — generate preview — confirm it renders

### Final checklist

- [ ] SWC lockfile warning resolved or confirmed non-blocking
- [ ] Debug logging added, deployed, PM2 output captured
- [ ] Root cause identified from debug output
- [ ] Fix applied — minimum lines changed
- [ ] Debug logging removed
- [ ] Preview modal opens with recipe content — no error
- [ ] BBQ template renders in preview
- [ ] Square (8×8) renders in preview
- [ ] PM2 logs clean after generation
- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] Deployed to RPi5 — HTTP 200
- [ ] PM2 online, 0 restarts

---

## Deploy

```bash
ssh rasp@rpi5-eth
/mnt/chefsbook/deploy-staging.sh
```

---

## Wrapup

Follow `wrapup.md` fully.

In DONE.md, record this session as HOTFIX-TEMPLATE-COMPLETE and include:
- The actual root cause found from debug logging (not a theory — the actual output)
- Every file changed and exactly what changed
- Confirmation that preview generation works visually with a screenshot description
- Whether the SWC lockfile issue was resolved

In `.claude/agents/publishing.md`, update PATTERN 16 with the definitive
root cause and fix so this entire class of problem is documented permanently.

In AGENDA.md, note that Phase 2 (admin-template-dashboard.md) is now unblocked.

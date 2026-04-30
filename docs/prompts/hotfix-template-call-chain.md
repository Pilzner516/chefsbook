# Prompt: Hotfix — F is not a function (Template Call Chain)

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/hotfix-template-call-chain.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: BUG FIX — WEB ONLY

## Context

Multiple sessions have attempted to fix "F is not a function" in the generate route.
None have succeeded. This session must find the root cause by reading the ACTUAL
current state of every file in the call chain — not by assuming what the code looks
like based on previous sessions.

The error from PM2 logs:
```
PDF generation error: TypeError: F is not a function
    at T (.next/server/app/api/print-cookbooks/[id]/generate/route.js:1:159776)
```

This happens AFTER upscaling completes (or fails and falls back). The crash is at
the point where the template is called to render the PDF.

DO NOT assume the cause. Read every file first.

---

## Agent files to read — in order, before writing any code

- `.claude/agents/wrapup.md`
- `.claude/agents/publishing.md`
- `.claude/agents/pdf-design.md`
- `.claude/agents/deployment.md`

---

## Pre-flight: read EVERYTHING in the call chain before writing a single line

Read these files completely, in this order. Do not skip any.

1. `apps/web/lib/pdf-templates/engine/types.ts` — ALL interfaces
2. `apps/web/lib/pdf-templates/engine/index.ts` — ALL methods, especially:
   - `getTemplate()` — what does it return exactly?
   - `buildContext()` — what does it accept and return?
3. `apps/web/lib/pdf-templates/trattoria.tsx` — the FULL file. Specifically:
   - What is the function signature of the default export?
   - Does it accept `TemplateContext` or individual props?
   - Does it return a `<Document>` or a `<Page>` or something else?
   - Is it a React component (PascalCase, used as JSX) or a plain function?
4. `apps/web/app/api/print-cookbooks/[id]/generate/route.ts` — the FULL file.
   Specifically lines around the template call — find EXACTLY how the template
   is being invoked after `buildContext()` was added by the previous session.
5. Check what `renderToBuffer` expects — does it accept a React element
   (`renderToBuffer(<Component />)`) or a function call result
   (`renderToBuffer(Component(props))`)?

After reading all five, answer these questions before writing any code:
- What does `TemplateEngine.getTemplate('trattoria')` return? (a function? a class? a component?)
- What does the generate route pass to `renderToBuffer`?
- Does the template's default export match how it's being called?
- Is there a mismatch between the template being a React component vs a plain function?

---

## Known facts about the error

1. The crash happens at the template render call, AFTER images are fetched
2. Previous sessions changed:
   - Templates now export `default function` accepting `TemplateContext`
   - `getTemplate()` now uses `.default` to get the export
   - The generate route was updated to call `buildContext()`
3. The error "F is not a function" means something in the call chain is
   undefined or the wrong type when it gets called

---

## Common causes to check — verify each one explicitly

**Cause A — buildContext() returns wrong shape**
The template destructures specific fields from TemplateContext. If buildContext()
returns an object missing required fields, the template may fail during rendering
in a way that surfaces as "F is not a function" when a nested component is called.
Check: does buildContext() actually populate all fields the template uses?

**Cause B — renderToBuffer called with wrong argument**
`renderToBuffer` from @react-pdf/renderer expects a React element, not a function
call result. The correct call is:
```typescript
// CORRECT — React element
await renderToBuffer(<TemplateDocument {...ctx} />)
// or
await renderToBuffer(React.createElement(TemplateDocument, ctx))

// WRONG — function result (only works if template returns element directly)
await renderToBuffer(TemplateDocument(ctx))
```
If the template is structured as a React component with hooks or nested components,
calling it as a plain function instead of rendering it via React will cause failures.

**Cause C — getTemplate() returns undefined for the template ID**
If `coverInfo.cover_style` contains a value not matched in the switch statement
(e.g. 'trattoria' vs 'classic', 'bbq' vs 'pitmaster'), `getTemplate()` falls back
to trattoria but may return something unexpected. Add logging to confirm what ID
is being passed and what is returned.

**Cause D — Template file exports are mismatched**
After the migration, the template may export a named function but the engine
uses `.default`. Or the template may have BOTH a named export and a default export
pointing to different things. Verify the exact export structure.

**Cause E — TemplateContext fields don't match template destructuring**
The template may destructure `ctx.recipe` but buildContext() returns `ctx.recipes`
(plural). Field name mismatches cause undefined values that surface as call errors
when a nested component tries to use them.

---

## The fix

Once you identify the exact cause from pre-flight reading:

1. Fix the minimum number of lines necessary
2. Add a console.log before the template call that logs:
   - The template ID being used
   - The type of what getTemplate() returns (`typeof TemplateDocument`)
   - Whether buildContext() output has the expected shape
   This log must be removed before wrapup — it is only for debugging during this session.
3. Test locally if possible before deploying

Do NOT do a broad rewrite. Fix the specific broken thing.

---

## Constraints

- Do NOT rewrite the templates
- Do NOT change the engine types unless a field name mismatch is the cause
- Do NOT touch FlipbookPreview
- Do NOT touch any mobile files
- Preserve the preview/print image path split (publishing.md)

---

## Testing

### Manual — do not deploy without completing these

1. Open a cookbook in the canvas editor
2. Click Generate Preview
3. Confirm "Preview Generation Failed / F is not a function" is GONE
4. Confirm the preview modal opens and shows recipe content
5. Test with BBQ template — confirm it renders
6. Test at Square (8×8) page size — confirm it renders

### Checklist

- [ ] "F is not a function" error is gone from browser
- [ ] Preview generates successfully for at least 2 templates
- [ ] PM2 logs show no TypeError after a preview generation attempt
- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] Deployed to RPi5 — HTTP 200 on chefsbk.app
- [ ] PM2 online with no startup errors

---

## Deploy

```bash
ssh rasp@rpi5-eth
/mnt/chefsbook/deploy-staging.sh
```

```bash
pm2 logs chefsbook-web --lines 20 --nostream
# Confirm no TypeError in logs after a test generation
```

---

## Wrapup

Follow `wrapup.md` fully.

In DONE.md, record this session as HOTFIX-TEMPLATE-CALL-CHAIN and include:
- The EXACT root cause found (which of the five causes above, or a new one)
- The specific lines changed and why
- Confirmation that preview generation works visually

In `.claude/agents/publishing.md`, add the root cause as a new PATTERN so
this class of error is caught before it can recur in any future session that
touches the template call chain.

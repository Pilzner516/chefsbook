# Prompt: Hotfix — Template Props Interface Mismatch

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/hotfix-template-props-mismatch.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: BUG FIX — WEB ONLY

## Context

Current error in browser: "Cannot read properties of null (reading 'props')"
PM2 shows React error #130: "Element type is invalid, got undefined"

Session HOTFIX-TEMPLATE-CALL-CHAIN fixed the `renderToBuffer` call to use
`React.createElement(TemplateDocument, context)` instead of `TemplateDocument(context)`.
That fix was correct. But a deeper problem remains.

During that session's pre-flight, Opus noted:
> "trattoria.tsx signature — found it accepts CookbookPdfOptions via destructuring"

This means the templates were NOT fully migrated to TemplateContext internally.
The outer call now passes TemplateContext correctly, but inside the template the
destructuring still expects `CookbookPdfOptions` fields (`cookbook`, `recipes`,
`chefsHatBase64`, `language`). When the template receives TemplateContext instead,
those fields are all `undefined`, causing nested components to be undefined and
React error #130 to fire.

---

## Agent files to read — in order, before writing any code

- `.claude/agents/wrapup.md`
- `.claude/agents/publishing.md`
- `.claude/agents/pdf-design.md`
- `.claude/agents/deployment.md`

---

## Pre-flight: read the actual current state of everything

Do NOT assume what any file contains. Read each one completely.

1. `apps/web/lib/pdf-templates/engine/types.ts`
   — Write down every field in TemplateContext exactly as defined

2. `apps/web/lib/pdf-templates/engine/index.ts`
   — Write down exactly what `buildContext()` returns field by field

3. `apps/web/lib/pdf-templates/trattoria.tsx`
   — Find the function signature and destructuring at the top
   — List every field it destructures from its props
   — Compare those fields against TemplateContext — identify every mismatch

4. `apps/web/app/api/print-cookbooks/[id]/generate/route.ts`
   — Find exactly what is passed to `buildContext()`
   — Find exactly what `React.createElement(TemplateDocument, context)` passes
   — Confirm whether `context` is a TemplateContext or something else

5. Do the same destructuring audit for ALL SIX templates:
   `bbq.tsx`, `garden.tsx`, `nordic.tsx`, `studio.tsx`, `heritage.tsx`
   — Some may have been properly migrated, others not
   — Catalogue the exact mismatch per template before writing any fix

---

## The two possible root causes — determine which applies

### Possibility A — Templates still destructure CookbookPdfOptions

If trattoria.tsx starts with something like:
```typescript
export default function TrattoriaDocument({ cookbook, recipes, chefsHatBase64 }: CookbookPdfOptions)
```
Then the template was never migrated to TemplateContext internally. It needs to be
updated to destructure from TemplateContext:
```typescript
export default function TrattoriaDocument({ layout, settings, strings, cookbook, recipes }: TemplateContext)
```
But be careful — TemplateContext may not have `cookbook` and `recipes` as top-level
fields. Check engine/types.ts for the exact field names.

### Possibility B — buildContext() does not populate fields the templates need

If the templates were correctly migrated to use TemplateContext fields (`layout.*`,
`settings.*`, etc.) but `buildContext()` does not populate those fields correctly
from the `pdfOptions` data, the fix is in `buildContext()` in engine/index.ts.

### Possibility C — both problems exist together

The most likely scenario given the session history. Address both.

---

## The fix strategy

**Do not guess. Read first, then fix.**

After the pre-flight audit you will know exactly which fields each template expects
and which fields `buildContext()` provides. The fix is to make them match.

There are two valid approaches — choose the one that requires fewer changes:

**Approach 1 — Fix buildContext() to provide what templates currently expect**

If the templates still use `CookbookPdfOptions`-style destructuring, update
`buildContext()` to return a TemplateContext that also includes the legacy fields
the templates currently use. This is a smaller change:

```typescript
// In engine/index.ts buildContext():
return {
  // TemplateContext fields
  layout,
  settings,
  strings,
  fillZone: options?.fillZone,
  isPreview: options?.isPreview ?? false,
  // Legacy fields templates currently destructure
  cookbook: data.cookbook,
  recipes: data.recipes,
  chefsHatBase64: data.chefsHatBase64,
  language: data.language,
}
```

And update TemplateContext in types.ts to include these legacy fields so TypeScript
does not complain.

**Approach 2 — Update all six templates to use TemplateContext fields**

If the templates have been partially migrated (they use `layout.*` for sizing but
still destructure legacy fields for data), update the destructuring in all six
templates to match what TemplateContext actually provides.

**Choose Approach 1 if** the templates still heavily use `cookbook.*` and `recipes`
throughout — changing all those references would be a large risky change mid-hotfix.

**Choose Approach 2 if** the templates only destructure a few legacy fields at the
top and the rest of the template already uses `layout.*` and `settings.*`.

Either way: TypeScript must compile with 0 errors after the fix.

---

## Constraints

- Preserve the preview/print image path split in the generate route (publishing.md)
- Do NOT change anything outside engine/types.ts, engine/index.ts, the six templates,
  and the generate route
- Do NOT touch FlipbookPreview
- Do NOT touch any mobile files
- The fix must result in 0 TypeScript errors

---

## Testing

### Manual — do not deploy without completing these

1. Open a cookbook in the canvas editor — click Generate Preview
2. Confirm the preview modal opens with actual recipe content visible
3. Confirm no error dialog appears
4. Switch to BBQ template — regenerate — confirm it renders
5. Switch to Square (8×8) — regenerate — confirm it renders without overflow
6. Check PM2 logs after a successful generation:
   ```bash
   pm2 logs chefsbook-web --lines 20 --nostream | grep -i "error\|TypeError\|null"
   ```
   Confirm no errors appear related to props, null, or template rendering

### Checklist

- [ ] Preview modal opens with recipe content — no error dialog
- [ ] BBQ template renders in preview
- [ ] Square (8×8) renders in preview
- [ ] PM2 logs clean after generation — no TypeError
- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] All 6 templates: `grep -n "layout\." [template].tsx` returns results
      (confirms layout engine is being used)
- [ ] Deployed to RPi5 — HTTP 200 on chefsbk.app
- [ ] PM2 online with no startup errors

---

## Deploy

```bash
ssh rasp@rpi5-eth
/mnt/chefsbook/deploy-staging.sh
```

```bash
curl -I https://chefsbk.app/dashboard/print-cookbook
pm2 logs chefsbook-web --lines 20 --nostream
```

---

## Wrapup

Follow `wrapup.md` fully.

In DONE.md, record this session as HOTFIX-TEMPLATE-PROPS and include:
- Which of the three possibilities was the actual root cause
- Which approach (1 or 2) was used to fix it
- The exact fields that were missing/mismatched
- Confirmation that preview generation works visually
- Which templates needed changes and which were already correct

In `.claude/agents/publishing.md`, add or update the PATTERN added by
HOTFIX-TEMPLATE-CALL-CHAIN to include the props mismatch as a related failure
mode: "When migrating templates to a new props interface, verify that both the
call site AND the template's internal destructuring are updated together."

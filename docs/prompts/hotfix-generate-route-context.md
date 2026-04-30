# Prompt: Hotfix — Generate Route TemplateContext Mismatch

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/hotfix-generate-route-context.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: BUG FIX — WEB ONLY

## Overview

The template migration (TEMPLATE-ENGINE-MIGRATION) changed all six templates to
accept `TemplateContext` as their only prop. The generate route was not updated
to match. It still calls templates with the old `CookbookPdfOptions` object:

```typescript
// BROKEN — old signature
const TemplateDocument = TemplateEngine.getTemplate(coverInfo.cover_style);
const interiorBuffer = await renderToBuffer(TemplateDocument(pdfOptions));
```

Templates now expect `TemplateContext` (which includes `layout`, `settings`,
`strings`, `recipe`, `fillZone`, `isPreview`). Passing `CookbookPdfOptions`
instead causes "F is not a function" because the template receives the wrong
shape and fails before returning a React element.

The fix is to use `TemplateEngine.buildContext()` to construct a `TemplateContext`
from the existing `pdfOptions` data and pass that to the template instead.

One file only: `apps/web/app/api/print-cookbooks/[id]/generate/route.ts`

---

## Agent files to read — in order, before writing any code

- `.claude/agents/wrapup.md`
- `.claude/agents/publishing.md`
- `.claude/agents/deployment.md`

---

## Pre-flight: before writing any code

1. Read the engine files in full — understand what each method requires:
   - `apps/web/lib/pdf-templates/engine/types.ts` — TemplateContext, CookbookPdfOptions
   - `apps/web/lib/pdf-templates/engine/index.ts` — buildContext() signature
   - `apps/web/lib/pdf-templates/engine/layout.ts` — computeLayout(), PAGE_SIZES
2. Read the full generate route:
   `apps/web/app/api/print-cookbooks/[id]/generate/route.ts`
   Understand everything in `pdfOptions` — title, subtitle, author, recipes,
   pageSize, cover_style, foreword, language, chefsHatBase64.
3. Read one migrated template (trattoria.tsx) to confirm exactly what shape
   of TemplateContext it expects — verify the field names match engine/types.ts.
4. Confirm `TemplateEngine.buildContext()` exists and note its exact signature.
   If buildContext() does not exist or is incomplete, you will need to implement
   it in engine/index.ts as part of this fix.
5. Run `npx tsc --noEmit` in `apps/web` — record baseline error count.

---

## The fix

### Step 1 — Understand what buildContext() needs

From the design doc and engine types, `buildContext()` needs:
- `recipe: CookbookRecipe` — a single recipe (templates render one recipe at a time)
- `pageSize: PageSizeKey | PageDimensions` — from `pdfOptions.cookbook.pageSize`
- `templateId: string` — from `coverInfo.cover_style`
- `options.fillZone` — optional fill zone content
- `options.isPreview` — boolean from the request

### Step 2 — Update the generate route call site

Replace the broken call:

```typescript
// REMOVE THIS:
const TemplateDocument = TemplateEngine.getTemplate(coverInfo.cover_style);
const interiorBuffer = await renderToBuffer(TemplateDocument(pdfOptions));
```

With the correct pattern. Templates render per-recipe, so the interior PDF
is built by rendering each recipe through the template and combining the pages.
Study how the old templates handled this — look at how `cookbookRecipes` was
iterated in the route before the migration. The new pattern will be similar but
using TemplateContext.

The correct shape is something like:

```typescript
const TemplateDocument = TemplateEngine.getTemplate(coverInfo.cover_style);
const pageSize = bookLayout?.pageSize ?? 'letter';

// Build one Document wrapping all recipe pages
const element = TemplateDocument(
  TemplateEngine.buildContext(
    cookbookData,  // the full cookbook data including all recipes
    pageSize,
    coverInfo.cover_style,
    {
      isPreview: isPreviewMode,
      fillZone: fillZoneContent,
    }
  )
);
const interiorBuffer = await renderToBuffer(element);
```

The exact call depends on what `buildContext()` accepts and what the template
expects. Read both before writing this. Do not guess the field names.

### Step 3 — If buildContext() is missing or incomplete

If `TemplateEngine.buildContext()` does not exist or doesn't accept the right
params, implement it in `engine/index.ts`:

```typescript
static buildContext(
  data: {
    cookbook: CookbookData,
    recipes: CookbookRecipe[],
    chefsHatBase64?: string,
    language?: string,
  },
  pageSize: PageSizeKey | PageDimensions,
  templateId: string,
  options?: {
    fillZone?: FillContent,
    isPreview?: boolean,
  }
): TemplateContext {
  const layout = computeLayout(
    typeof pageSize === 'string' ? PAGE_SIZES[pageSize] : pageSize
  );
  const manifest = TemplateEngine.getManifest(templateId);
  return {
    cookbook: data.cookbook,
    recipes: data.recipes,
    layout,
    settings: manifest.settings,
    strings: getStrings(data.language ?? 'en'),
    chefsHatBase64: data.chefsHatBase64,
    fillZone: options?.fillZone,
    isPreview: options?.isPreview ?? false,
  };
}
```

Adjust field names to match what `engine/types.ts` actually defines.

### Step 4 — Preserve the preview/print path split

The generate route has two paths — preview (no upscaling) and print (upscaling).
This must be preserved exactly as it was (publishing.md PATTERN from PRINT-QUALITY-3).
Only change the template call — nothing else in the route.

---

## Constraints

- Do NOT touch any template files
- Do NOT touch FlipbookPreview
- Do NOT change any other part of the generate route — only the template call site
- Do NOT touch any mobile files
- Preserve the preview/print image path split exactly

---

## Testing

### Automated

```bash
cd apps/web && npx tsc --noEmit
# Must pass with 0 errors
```

### Manual — do not deploy without completing these

1. Open a cookbook in the canvas editor
2. Click Generate Preview — confirm "Preview Generation Failed" error is GONE
3. Confirm the preview renders and shows recipe content
4. Switch to BBQ template — generate preview — confirm it renders
5. Switch to Square (8×8) page size — generate preview — confirm it renders
   and text wraps correctly
6. Confirm step badges appear as dark circles with white numbers in BBQ template

### Checklist

- [ ] "F is not a function" error is gone
- [ ] Preview generates successfully for at least 2 different templates
- [ ] Preview generates at Square (8×8) page size without overflow
- [ ] BBQ template step badges render correctly
- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] Deployed to RPi5 — HTTP 200 on chefsbk.app
- [ ] PM2 logs show no startup errors

---

## Deploy

```bash
ssh rasp@rpi5-eth
/mnt/chefsbook/deploy-staging.sh
```

```bash
curl -I https://chefsbk.app/dashboard/print-cookbook
pm2 logs chefsbook-web --lines 30
```

---

## Wrapup

Follow `wrapup.md` fully.

In DONE.md, record this session as HOTFIX-GENERATE-CONTEXT and include:
- The root cause: generate route called templates with old CookbookPdfOptions
  instead of TemplateContext after the migration changed the template signature
- Exactly which lines were changed in the generate route
- Whether buildContext() already existed or had to be implemented
- That the preview is now working and visually verified

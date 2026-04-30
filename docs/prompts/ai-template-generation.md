# Prompt: AI Template Generation — Phase 3 of 3

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/ai-template-generation.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: FEATURE — WEB ONLY

## Overview

This is Phase 3 of the ChefsBook template system rebuild.
Read `docs/prompts/template-system-design.md` in full before doing anything else.

Phases 1 and 2 must be complete and deployed before this session starts.
Confirm both are in DONE.md before writing any code.

This session wires the "AI Generate" tab in the admin template upload modal.
Admins describe a template style in plain language, optionally pick colors,
and the AI generates a valid TypeScript template component that passes all
engine validation rules and Lulu requirements.

The AI generation route calls Claude Sonnet with a carefully constructed
system prompt that includes the full template spec, known failure patterns,
and a complete reference implementation. It returns the component code,
runs validation automatically, and returns both to the admin UI. The admin
can preview, regenerate, or accept. Accepting saves to the DB as a draft.

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/publishing.md`
- `.claude/agents/pdf-design.md`
- `.claude/agents/ui-guardian.md`
- `.claude/agents/ai-cost.md`
- `.claude/agents/deployment.md`

`ai-cost.md` is MANDATORY — this session introduces a new Claude API call.
Model selection, cost logging, and rate limiting rules all apply.
Run ALL pre-flight checklists before writing any code.

---

## Pre-flight: before writing any code

1. Read `docs/prompts/template-system-design.md` in full — mandatory.
2. Confirm Phase 1 AND Phase 2 are both in DONE.md and deployed. If either is
   missing, stop and report.
3. Read the Phase 1 and Phase 2 DONE.md entries to understand the exact engine
   API and admin UI structure this session extends.
4. Read `apps/web/lib/pdf-templates/engine/index.ts` — understand TemplateEngine.
5. Read `apps/web/lib/pdf-templates/engine/types.ts` — understand all interfaces.
6. Read `apps/web/lib/pdf-templates/system/trattoria.tsx` (Phase 1 rebuilt version)
   — this is the reference implementation the AI will receive as an example.
7. Read `.claude/agents/ai-cost.md` — note the model selection guide, logging
   requirements, and rate limiting rules. Code generation requires Sonnet, not Haiku.
8. Read `apps/web/app/admin/templates/page.tsx` — understand the Phase 2 UI
   so the AI Generate tab can be wired into the existing modal correctly.
9. Run `npx tsc --noEmit` in `apps/web` — record baseline error count.

---

## Task 1 — Generation API route

### `POST /api/admin/templates/generate`

Auth: `supabaseAdmin.auth.getUser(token)` — verify admin_users row.

Request body:
```typescript
{
  description: string      // "Modern Japanese minimalist, black and white, clean lines"
  accentColor?: string     // hex color e.g. "#000000"
  backgroundColor?: string // hex color e.g. "#FFFFFF"
  style?: string           // "minimal" | "bold" | "editorial" | "rustic" | "modern"
}
```

Response:
```typescript
{
  code: string                    // generated TypeScript component
  manifest: TemplateManifest      // generated manifest
  validation: ValidationResult    // result of TemplateEngine.validate(code)
  tokensUsed: number              // for cost display in UI
}
```

**Do not save to DB from this route.** Saving is handled by the existing
`POST /api/admin/templates/upload` route flow after the admin confirms.
The generate route only produces and validates code — it does not persist anything.

---

## Task 2 — AI system prompt construction

The system prompt sent to Claude Sonnet must contain all of the following in order.
Build it as a constant in the route file, not inline in the API call.

**Section 1 — Role and output format**
```
You are an expert React PDF template developer for ChefsBook, a recipe cookbook app.
Your job is to generate a valid TypeScript React component for a cookbook PDF template.

Return ONLY a JSON object with two keys:
- "code": the complete TypeScript component as a string
- "manifest": the template manifest as an object

Do not include any explanation, markdown, code fences, or preamble.
Return pure JSON only.
```

**Section 2 — Technical constraints (paste verbatim)**

Include the full `ComputedLayout` and `TemplateContext` interface definitions
from `engine/types.ts` so the AI knows exactly what it receives.

Include ALL of these rules explicitly:
- Only import from `@react-pdf/renderer` and `../engine/types`
- Use `layout.*` for all sizing — never hardcode pixel values for margins, fonts, or heights
- Never use `size="LETTER"` or any hardcoded page size on `<Page>`
- Never use emoji or Unicode characters above U+00FF in text content
- Never use `fontStyle: 'italic'` with Inter font
- Never use `height` or `minHeight` on step row Views
- Step row structure: outer View(flexDirection:row, wrap:false) → badge View(flexShrink:0) → inner View(flex:1, paddingLeft:8) → Text
- Badge: View with borderRadius = layout.badgeSize/2, color from settings.palette.accent
- Page order within recipe: PhotoPage → AdditionalImagePage → RecipeContentPage → CustomPage → FillZone
- Export a default function that accepts TemplateContext as its only parameter

**Section 3 — Lulu print spec**

Include:
- Minimum margins from the design doc
- DPI requirement
- That `computeLayout()` already enforces these margins

**Section 4 — Reference implementation**

Include the full content of the rebuilt `trattoria.tsx` as a reference.
Wrap it clearly: `// === REFERENCE IMPLEMENTATION (Trattoria template) ===`

**Section 5 — User request**

```
Generate a cookbook PDF template with this style:
Description: {description}
Accent color: {accentColor || "choose an appropriate color for this style"}
Background color: {backgroundColor || "choose an appropriate color for this style"}
Style: {style || "derive from description"}

The template name should reflect the style described.
Choose appropriate Google Fonts that match the aesthetic.
Ensure the template is visually distinct from the Trattoria (warm rustic Italian),
Studio (dark modern), Garden (minimal green), Heritage (farmhouse), 
Nordic (Scandinavian minimal), and BBQ (pitmaster charcoal) templates.
```

---

## Task 3 — Cost logging

Log every generation call to `ai_usage_log`:

```typescript
await logAiCall({
  action: 'generate_template',
  model: 'claude-sonnet-4-20250514',  // use the constant from @chefsbook/ai
  cost: estimatedCost,                // calculate from tokensUsed
  user_id: adminUserId,
})
```

Follow ai-cost.md for the exact cost calculation formula for Sonnet.

---

## Task 4 — Wire the AI Generate tab in the admin UI

Update `apps/web/app/admin/templates/page.tsx` to replace the Phase 2 placeholder
with the working AI Generate tab.

### AI Generate tab UI

**Inputs:**
- Text area: "Describe your template style" (required, 10–300 chars, placeholder:
  "e.g. Modern Japanese minimalist with black accents and white space. Clean, editorial.")
- Style selector: pill buttons — Minimal | Bold | Editorial | Rustic | Modern
- Accent color picker: native `<input type="color">` with hex display
- Background color picker: same

**Generate button:**
- Disabled until description is filled
- Shows spinner + "Generating..." during API call (can take 15–30 seconds)
- After success: shows the validation result checklist and template preview

**Validation result display:**
- Green checkmark rows for passing checks
- Red X rows for failing checks with the specific error message
- If ALL checks pass: "Validation passed — ready to save" in green
- If any check fails: "Fix required before saving" in red
- Show token count: "Generated using X tokens"

**Preview:**
- After successful generation, show the template preview using the same preview
  panel component from Phase 2
- "Regenerate" button: re-runs generation with same inputs (user can tweak description first)
- "Save as Draft" button (only if validation passed)

**Save as Draft flow:**
- Call `POST /api/admin/templates/upload` with the generated code and manifest
  formatted as a virtual ZIP (or add a separate endpoint that accepts code + manifest
  directly — choose the cleaner approach)
- On success: close modal, template appears in grid with Draft badge

---

## Task 5 — Rate limiting

AI template generation is an expensive operation. Apply rate limiting:
- Maximum 5 generate calls per admin per day
- Track calls in `ai_usage_log` — count rows with `action = 'generate_template'`
  and `user_id = adminUserId` for today
- If limit reached: return 429 with `{ error: "Daily generation limit reached (5/day)" }`
- Show this limit to the admin in the UI before they click Generate

---

## Constraints

- Do NOT touch the template engine files (Phase 1 — frozen)
- Do NOT touch the template list UI or upload flow (Phase 2 — frozen)
- Do NOT touch any mobile files
- Model MUST be Sonnet — not Haiku. Template generation requires full capability.
  (ai-cost.md MANDATORY — code generation is explicitly a Sonnet task)
- ALL admin routes must use `supabaseAdmin.auth.getUser(token)` (PATTERN 1)
- Do NOT auto-activate AI-generated templates — they must go through Draft → Admin
  preview → Admin activation. Never bypass the admin confirmation step.

---

## Testing

### Manual verification — complete ALL steps before deploying

**Step 1 — Basic generation**
1. Navigate to `/admin/templates` — click "Add Template"
2. Click the "AI Generate" tab
3. Enter description: "Clean Scandinavian baking cookbook, light grey tones, serif headings"
4. Select style: Minimal
5. Set accent: #4A4A4A, background: #F8F8F6
6. Click Generate
7. Confirm the spinner shows during generation (may take 15–30s)
8. Confirm validation result appears — all checks should pass
9. Confirm preview renders the generated template at Letter size
10. Switch to Square in the preview — confirm text wraps correctly
11. Click "Save as Draft" — confirm template appears in grid with Draft badge
12. Activate the template — confirm status changes to Active

**Step 2 — Validation failure handling**
- The AI should generate valid code, but to test error display:
  Temporarily add a validation rule that always fails in validate.ts for a test
  template name, generate one, confirm the error UI shows correctly, then remove
  the test rule.

**Step 3 — Rate limiting**
1. Check `ai_usage_log` to see current count for the admin user
2. If below 5: generate templates until the limit is reached
3. Confirm the 429 response is shown as a user-friendly message in the UI
4. Confirm the Generate button is disabled when the limit is reached

**Step 4 — Cost logging**
```sql
SELECT action, model, cost, created_at
FROM ai_usage_log
WHERE action = 'generate_template'
ORDER BY created_at DESC
LIMIT 5;
```
Confirm entries appear for every generation call.

### Checklist — do not deploy until all pass

- [ ] AI Generate tab renders correctly in the modal
- [ ] Generation produces valid TypeScript component code
- [ ] Validation runs automatically and displays pass/fail per check
- [ ] Preview shows the generated template at all 5 page sizes
- [ ] Regenerate button works
- [ ] Save as Draft saves to DB and template appears in grid
- [ ] Rate limit: 429 returned after 5 generations per day
- [ ] Rate limit shown to admin in UI before they hit it
- [ ] ai_usage_log entries created for every generation call
- [ ] Generated templates must be Draft before activation (no auto-activate)
- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] Deployed to RPi5 — HTTP 200 on chefsbk.app/admin/templates
- [ ] PM2 logs show no startup errors

---

## Deploy

Follow `deployment.md` exactly.

```bash
ssh rasp@rpi5-eth
/mnt/chefsbook/deploy-staging.sh
```

```bash
curl -I https://chefsbk.app/admin/templates
# Expect: HTTP 200

pm2 logs chefsbook-web --lines 30
# Expect: no startup errors
```

---

## Wrapup

Follow `wrapup.md` fully.

In DONE.md, record:
- The generation route and its input/output
- The model used (Sonnet) and why (code generation requirement)
- The rate limit (5/day per admin) and how it's tracked
- The system prompt structure (sections 1–5)
- Average token count per generation (from your test runs)
- Estimated cost per generation (from ai-cost.md formula)
- That all three phases are now complete

In `.claude/agents/ai-cost.md`, add a row for `generate_template`:
- Action: generate_template
- Model: Sonnet
- Typical tokens: (record from your test runs)
- Notes: Admin-only, rate limited to 5/day per admin

In `docs/prompts/template-system-design.md`, update Phase 3 status to COMPLETE
with the session name and date. Add a "System complete" note at the top.

In `.claude/agents/publishing.md`, add a section covering AI-generated templates:
- They must pass all the same validation rules as uploaded templates
- They are saved as Draft and require admin activation
- They use the same TemplateEngine as system templates once activated
- The generation route is admin-only and rate-limited

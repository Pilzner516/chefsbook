# Prompt: Admin Template Dashboard — Phase 2 of 3

## LAUNCH PROMPT (paste this into Claude Code to start the session)

```
Read and execute docs/prompts/admin-template-dashboard.md fully and autonomously, from pre-flight through deployment and /wrapup. Do not stop for questions unless you hit a genuine blocker.
```

---

## TYPE: FEATURE — WEB ONLY

## Overview

This is Phase 2 of the ChefsBook template system rebuild.
Read `docs/prompts/template-system-design.md` in full before doing anything else.

Phase 1 (template-engine-rebuild.md) must be complete and deployed before
this session starts. Confirm this in DONE.md before writing any code.

This session delivers the admin interface for managing cookbook templates.
Admins can view all templates, preview them at any page size, enable/disable
system templates, upload new templates as ZIP files, and validate uploaded
templates against the Lulu spec and engine requirements.

Phase 3 (ai-template-generation.md) adds AI generation on top of this UI.

---

## Agent files to read — ALL of these, in order, before writing a single line of code

- `.claude/agents/wrapup.md`
- `.claude/agents/testing.md`
- `.claude/agents/feature-registry.md`
- `.claude/agents/publishing.md`
- `.claude/agents/pdf-design.md`
- `.claude/agents/ui-guardian.md`
- `.claude/agents/deployment.md`
- `.claude/agents/ai-cost.md`

Run ALL pre-flight checklists before writing any code.

---

## Pre-flight: before writing any code

1. Read `docs/prompts/template-system-design.md` in full — mandatory.
2. Confirm Phase 1 is in DONE.md and deployed. If not present, stop and report.
3. Read DONE.md entries for the Phase 1 session to understand the engine API
   that this session will call.
4. Read `apps/web/app/admin/layout.tsx` — understand the existing admin nav
   structure and how to add a new nav item correctly.
5. Read an existing admin page (e.g. `apps/web/app/admin/feedback/page.tsx`) —
   understand the layout patterns, auth patterns, and Tailwind token conventions.
6. Read `apps/web/lib/pdf-templates/engine/index.ts` — understand the TemplateEngine
   API that the preview panel will use.
7. Confirm the `cookbook_templates` table schema by running `\d cookbook_templates`
   on RPi5 — do not assume columns from the design doc, verify them.
8. Run `npx tsc --noEmit` in `apps/web` — record baseline error count.

---

## Architecture

```
/admin/templates                        — template list + management
  → GET /api/admin/templates            — list all templates with manifest
  → PATCH /api/admin/templates/[id]     — enable/disable, update status
  → DELETE /api/admin/templates/[id]    — delete non-system templates only

/admin/templates/[id]/preview           — preview a template (side panel or modal)
  → GET /api/admin/templates/[id]/preview?pageSize=square&format=thumbnail
    — renders template with test recipe, returns image or PDF fragment

Upload flow:
  Admin uploads ZIP → POST /api/admin/templates/upload
  → Extract component.tsx + manifest.json + thumbnail.png
  → Run TemplateEngine.validate(code)
  → If valid: save to DB with status=draft
  → Return validation result + template id
  → Admin previews in UI
  → Admin confirms → PATCH status=active

Note: AI Generate tab is a placeholder in this session — it shows "Coming Soon"
and will be wired in Phase 3.
```

---

## Task 1 — API routes

### `GET /api/admin/templates`

Returns all templates from `cookbook_templates` table ordered by is_system DESC, name ASC.

```typescript
// Response
{
  templates: Array<{
    id: string
    name: string
    description: string
    is_system: boolean
    status: 'active' | 'inactive' | 'draft' | 'error'
    supported_page_sizes: string[]
    lulu_compliant: boolean
    thumbnail_url: string | null
    manifest: TemplateManifest | null
    validation_errors: string[] | null
    created_at: string
    updated_at: string
  }>
}
```

Auth: `supabaseAdmin.auth.getUser(token)` — verify admin_users row exists for this user.

### `PATCH /api/admin/templates/[id]`

Update `status` field only. Allowed transitions:
- active → inactive
- inactive → active
- draft → active (after validation passes)
- draft → inactive
- error → draft (triggers revalidation)

System templates (`is_system = true`) cannot be deleted but can be inactive.

```typescript
// Request body
{ status: 'active' | 'inactive' }
```

### `DELETE /api/admin/templates/[id]`

Delete a template. If `is_system = true`, return 403 with message
`"System templates cannot be deleted. Disable them instead."`.

Also delete the template's files from Supabase Storage if `thumbnail_url` is set.

### `POST /api/admin/templates/upload`

Accepts `multipart/form-data` with a single `file` field (ZIP).

Processing steps:
1. Verify file is a ZIP (check magic bytes, not just extension)
2. Extract: look for `component.tsx`, `manifest.json`, `thumbnail.png` in the ZIP root
3. If any required file is missing: return 400 with specific error
4. Parse and validate `manifest.json` against the TemplateManifest interface
5. Run `TemplateEngine.validate(componentCode)` on the extracted component.tsx
6. If validation fails: return 400 with `{ errors: ValidationResult.errors }`
7. If validation passes:
   - Upload thumbnail to Supabase Storage at `cookbook-templates/{uuid}/thumbnail.png`
   - Insert row into `cookbook_templates` with status=draft
   - Return `{ id, validationResult, thumbnailUrl }`

Use `supabaseAdmin` for all storage and DB operations.
ZIP parsing: use the `jszip` package (check if already installed, add if not — it's
small and well-maintained; log the addition in DONE.md).

### `GET /api/admin/templates/[id]/preview`

Query params: `pageSize` (letter|trade|large-trade|digest|square), `format` (pdf|png)

Renders the template with `engine/test-recipe.ts` at the given page size.
Returns a PDF buffer or a PNG thumbnail depending on `format`.

For system templates: load from filesystem.
For uploaded templates: load `component_code` from DB, evaluate safely.

Note on safe evaluation of uploaded template code: in Phase 2, use a simple
`new Function()` approach with restricted imports. Phase 3 will harden this.
Log a TODO comment in the code noting this needs hardening.

---

## Task 2 — Admin templates page

Route: `apps/web/app/admin/templates/page.tsx`

### Layout

Follow the existing admin page patterns exactly (check feedback/page.tsx for reference):
- `supabaseAdmin.auth.getUser()` for auth
- Redirect to `/admin` if not in admin_users
- `cb-*` Tailwind tokens for all colors — no hardcoded hex values
- Consistent header style with other admin pages

### Template grid

- Responsive grid: 3 columns on desktop, 2 on tablet, 1 on mobile
- Each card contains:
  - Thumbnail image (80×110px with cream background if no thumbnail)
  - Template name (bold)
  - Description (muted, 2 lines max with overflow ellipsis)
  - Status badge: green Active | gray Inactive | yellow Draft | red Error
  - Page size pills: small tags for each supported size
  - Lulu compliant: green checkmark or amber warning icon
  - System template: small lock icon if `is_system = true`
  - Action buttons: Preview | Enable/Disable toggle | Delete (hidden for system)

### Preview panel

Opens as a full-height slide-in panel from the right (not a modal — templates
need vertical space to render properly).

Panel contents:
- Template name as panel header with close button
- Page size tab strip: Letter | Trade | Large Trade | Digest | Square
- Rendered preview iframe or embedded PDF viewer for the selected size
- "Close" button

Use the existing `FlipbookPreview` component with a test recipe if possible.
If FlipbookPreview requires the full canvas editor context, call the preview
API endpoint instead and render the returned content.

### Upload modal

Trigger: "Add Template" button in the page header.

Two tabs:
1. **Upload** — active in this session
2. **AI Generate** — shows "Coming in Phase 3" placeholder

Upload tab:
- Drag-and-drop zone with file input (accepts .zip only)
- File name shown after selection
- "Upload & Validate" button
- Validation results shown as a checklist (pass/fail per check)
- If all pass: preview of the uploaded template appears below
- "Save as Draft" button → saves with status=draft
- "Activate Now" button → saves with status=active
- Error states clearly shown with specific error messages

### Enable/Disable

Toggle button on each card. Uses PATCH /api/admin/templates/[id].
Optimistic UI update — flip the status badge immediately, revert on error.

### Delete

Only shown on non-system templates.
Uses the existing `ChefsDialog` confirmation pattern (do not use native confirm()).
On confirm: DELETE /api/admin/templates/[id], remove card from grid.

---

## Task 3 — Admin navigation

Add "Templates" to the admin sidebar nav in `apps/web/app/admin/layout.tsx`.

Place it in the sidebar under the print-related section if one exists, or
after "Feedback" if no logical grouping exists yet.

Icon: use a consistent icon with the existing sidebar icon style.
Label: "Templates"
Route: `/admin/templates`

---

## Constraints

- Do NOT touch any template files or the engine — Phase 1 work is frozen
- Do NOT add AI generation functionality — that is Phase 3
- Do NOT touch any mobile files
- All admin routes must use `supabaseAdmin.auth.getUser(token)` for JWT validation
  (publishing.md PATTERN 1)
- All DB operations in admin routes use `supabaseAdmin` (publishing.md PATTERN 2)
- Use `ChefsDialog` for all confirmations — no native confirm() calls
- Use `cb-*` Tailwind tokens — no hardcoded hex values in the UI

---

## Testing

### Manual verification — complete ALL steps before deploying

**Step 1 — Template list**
1. Navigate to `/admin/templates` as an admin user
2. Confirm all 6 system templates appear with correct thumbnails (or placeholder)
3. Confirm system templates show the lock icon
4. Confirm status badges are correct

**Step 2 — Preview panel**
1. Click Preview on the Trattoria template
2. Confirm the panel opens with the template rendered at Letter size
3. Switch to Square tab — confirm the preview updates and text wraps correctly
4. Close the panel

**Step 3 — Enable/Disable**
1. Disable a system template — confirm status badge changes to Inactive
2. Re-enable it — confirm status returns to Active
3. Confirm the toggle is reflected in the DB (check via psql or Supabase Studio)

**Step 4 — Upload flow**
1. Create a valid ZIP with a copy of garden.tsx renamed to test-upload.tsx,
   a valid manifest.json, and a placeholder thumbnail.png
2. Upload the ZIP — confirm validation passes
3. Confirm the preview shows correctly
4. Save as Draft — confirm it appears in the template list with Draft badge
5. Activate — confirm status changes to Active
6. Delete the test template — confirm it disappears from the list

**Step 5 — Upload validation errors**
1. Upload a ZIP with a component that contains `size="LETTER"` hardcoded
2. Confirm validation fails with a specific error message about hardcoded page size
3. Confirm no template is saved to the DB

### Checklist — do not deploy until all pass

- [ ] `/admin/templates` loads for admin users
- [ ] Non-admin users are redirected away from `/admin/templates`
- [ ] All 6 system templates appear in the grid
- [ ] System templates show lock icon and cannot be deleted
- [ ] Preview panel opens and shows template at correct page size
- [ ] Preview page size switching works
- [ ] Enable/Disable toggle works and persists to DB
- [ ] Upload flow: valid ZIP uploads, validates, previews, saves
- [ ] Upload flow: invalid ZIP shows specific error messages
- [ ] Delete works for non-system templates with ChefsDialog confirmation
- [ ] Admin nav shows "Templates" item linking to `/admin/templates`
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
# Expect: HTTP 200 or redirect to login

pm2 logs chefsbook-web --lines 30
# Expect: no startup errors
```

---

## Wrapup

Follow `wrapup.md` fully.

In DONE.md, record:
- All new routes created and their purpose
- The upload ZIP format (component.tsx + manifest.json + thumbnail.png)
- The validation checks that run on upload
- Any new npm packages added (jszip if used)
- That Phase 3 (ai-template-generation.md) is ready to run

In `docs/prompts/template-system-design.md`, update the Phase 2 status to COMPLETE
with the session name and date.

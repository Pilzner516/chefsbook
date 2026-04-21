# Prompt H — YouTube: Extension Routing + Technique Video Embed
## Scope: apps/extension, apps/web (technique detail page, YouTube import pipeline)

---

## AGENTS TO READ FIRST (in order)
1. `.claude/agents/wrapup.md`
2. `CLAUDE.md`
3. `DONE.md`
4. `.claude/agents/testing.md`
5. `.claude/agents/feature-registry.md`
6. `.claude/agents/deployment.md`
7. `.claude/agents/import-pipeline.md`
8. `.claude/agents/import-quality.md`
9. `.claude/agents/ui-guardian.md`

Run ALL pre-flight checklists before writing a single line of code.
Inspect the techniques table schema before writing any queries: `\d techniques`
Inspect the recipes table schema: `\d recipes`

---

## CONTEXT

The web app (Import & Scan page) correctly handles YouTube URLs:
- Detects YouTube URLs via `isYouTubeUrl()` (or equivalent)
- Routes to the YouTube import endpoint instead of the standard scrape
- AI determines whether the video content is a recipe or a technique
- Creates the appropriate record and redirects

The Chrome extension does NOT do this — it sends all URLs through the standard
recipe scrape path. YouTube URLs via the extension fail silently or produce
incomplete results with no video embed.

Additionally, the technique detail page does not render YouTube video embeds —
it only shows the scraped thumbnail as a static image, even when a video URL
was stored during import.

---

## FIX 1 — Extension: YouTube URL detection and routing

### Where to look
`apps/extension/popup.js` — this is where the extension handles the import action.

Read the existing code carefully before making any changes. Understand:
- How the extension currently detects the current page URL
- Which API endpoint it calls for import
- How it handles the response and redirects the user

### What to check first
In `apps/web/app/api/extension/import/route.ts` — check whether this endpoint
already handles YouTube URLs internally (calls `isYouTubeUrl()` and routes
accordingly). If it does, the fix may be as simple as ensuring the extension
sends the YouTube URL to this same endpoint without any pre-filtering.

If the extension is currently pre-filtering or short-circuiting YouTube URLs
before they reach the API, remove that behaviour.

If the extension import route does NOT handle YouTube internally:
- Add `isYouTubeUrl()` detection to the extension import route
- Route to the same YouTube import logic used by the web app's Import & Scan page
- Do NOT duplicate the YouTube import logic — import and call the shared function

### Recipe vs Technique determination
The YouTube import pipeline should already determine recipe vs technique via AI.
Verify this is the case. If it is, no change needed — just make sure the extension
routes to the same endpoint and the response includes the content type and ID
so the extension can redirect correctly.

### Extension redirect after import
Currently the extension likely redirects to `/recipe/[id]` after a successful import.
Update this to redirect based on the content type returned by the API:
- `type: 'recipe'` → redirect to `https://chefsbk.app/recipe/[id]`
- `type: 'technique'` → redirect to `https://chefsbk.app/technique/[id]`

If the API response doesn't currently return a `type` field, add it.

### Extension loading message
When the extension detects a YouTube URL, show a specific loading message:
*"Your Sous Chef is fetching this recipe..."*
(This should already be the message from Prompt A — verify it's in place)

---

## FIX 2 — Technique detail page: YouTube video embed

### Where to look
Find the technique detail page component. Check CLAUDE.md navigator agent for
the file path, or search for `apps/web/app/technique/[id]/` or similar.

### What to check
1. Does the technique record have a `video_url` column? (`\d techniques`)
2. Is the video URL being stored during YouTube import? Query a recently imported
   technique to verify: `SELECT id, title, video_url FROM techniques WHERE title LIKE '%Neapolitan%' LIMIT 1;`
3. Is the technique detail page reading `video_url` from the record?
4. Is there a YouTube embed component being rendered?

### The fix
The recipe detail page already has a working YouTube embed component. Identify it
and reuse it on the technique detail page.

The embed should:
- Only render if `technique.video_url` is a valid YouTube URL
- Use `autoplay=0` in the embed URL (already required from Prompt F)
- Show the "Watch on YouTube" link below the embed (same as recipe detail)
- Replace the static thumbnail image IF a video URL is present
  (if no video URL, static image continues to show as before)
- Position: at the top of the technique detail page, same position as the
  current hero image/thumbnail

### YouTube URL → embed URL conversion
Use the same utility function already used by the recipe detail page to convert
a YouTube watch URL to an embed URL. Do not duplicate this logic.

If no shared utility exists, create one at `lib/youtubeEmbed.ts`:
```typescript
export function getYouTubeEmbedUrl(url: string): string | null {
  // Handles: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID
  // Returns: https://www.youtube.com/embed/ID?autoplay=0&rel=0
  // Returns null if not a valid YouTube URL
}
```

---

## FIX 3 — Verify recipe detail YouTube embed also uses autoplay=0

A quick verification check — Prompt F was supposed to ensure `autoplay=0` in
the recipe detail YouTube embed. Verify the embed URL in
`apps/web/app/recipe/[id]/page.tsx` contains `autoplay=0`.

If it's missing, add it. If it's already there, note it in DONE.md and move on.

---

## IMPLEMENTATION ORDER

1. Read extension popup.js and the extension import API route fully before touching anything
2. Check `\d techniques` for video_url column
3. Query a known YouTube-imported technique to confirm video_url is being stored
4. Fix 1 — Extension YouTube routing (API route first, then popup.js)
5. Fix 2 — Technique detail YouTube embed
6. Fix 3 — Verify recipe detail autoplay=0
7. Package and deploy extension zip to RPi5 (per existing extension deploy process)
8. TypeScript check: `cd apps/web && npx tsc --noEmit` — must be clean
9. Deploy web changes per `deployment.md`

---

## GUARDRAILS

- Do NOT duplicate YouTube import logic — route to the shared function
- Do NOT change how non-YouTube URLs are handled in the extension
- Do NOT change the technique detail page layout — video embed replaces the
  static thumbnail only when a video_url exists; all other content unchanged
- The extension zip must be incremented in version (manifest.json) and deployed
  to /mnt/chefsbook/ on RPi5 per the existing extension deploy process
- If video_url column does not exist on techniques table, create a migration:
  `ALTER TABLE techniques ADD COLUMN IF NOT EXISTS video_url TEXT;`
  Apply on RPi5 and restart supabase-rest before proceeding

---

## TESTING REQUIREMENTS

Before marking done:

1. **Extension — YouTube recipe**: Open a YouTube cooking video URL in Chrome,
   click the extension → import completes → redirects to recipe detail with
   video embedded
2. **Extension — YouTube technique**: Open a YouTube technique video URL,
   click extension → import completes → redirects to technique detail with
   video embedded
3. **Technique detail**: Open the Neapolitan Pizza Making with Poolish technique
   → YouTube video embeds (not static image) → video does NOT autoplay
4. **Extension — non-YouTube URL**: Standard recipe URL still imports as before
   (no regression)
5. **autoplay=0**: Confirm no video autoplays on any page

Provide curl or browser verification for items 1–3.

---

## WRAPUP REQUIREMENT

DONE.md entry must include:
- Whether the extension import route already handled YouTube or if logic was added
- Whether video_url existed on techniques table or migration was needed
- Confirmation video_url was being stored for the Neapolitan technique
- Extension zip version number and deploy confirmation
- tsc clean confirmed
- Web deploy confirmed

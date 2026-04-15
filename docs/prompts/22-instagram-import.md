# ChefsBook — Session: Instagram Share → Recipe Import
# Source: QA Report 2026-04-08 · Item 1
# Target: apps/mobile + @chefsbook/ai

---

## CONTEXT

When a user shares a post from Instagram to ChefsBook (via the Android share sheet), the app
opens but currently does nothing with the shared content. Instagram shares contain a URL to
the post — this session wires the incoming share into the recipe import pipeline.

Read CLAUDE.md before starting. Check `apps/mobile/app/_layout.tsx` for the existing
`expo-linking` share handler added in session 1 (April 6).

---

## WHAT INSTAGRAM SHARES VIA ANDROID SHARE SHEET

When sharing from Instagram to another app, Android passes:
- `text/plain` intent with the post URL (e.g. `https://www.instagram.com/p/ABC123/`)
- Sometimes also the post caption text

Instagram does NOT share the image file directly via the share sheet for feed posts.
The image must be fetched from the post URL.

---

## STEP 1 — Handle incoming Instagram URLs in the share handler

In `_layout.tsx`, the existing share handler catches incoming `SEND text/plain` intents.
Extend it to detect Instagram URLs:

```ts
const isInstagramUrl = (url: string) =>
  url.includes('instagram.com/p/') ||
  url.includes('instagram.com/reel/');
```

When an Instagram URL is detected, route to the **Instagram import flow** instead of the
standard URL import flow.

---

## STEP 2 — Fetch the Instagram post content

Instagram's web pages are publicly accessible (for public posts). Use the existing
`web_fetch` / scraping approach from the URL import pipeline.

Fetch `https://www.instagram.com/p/[postId]/?__a=1&__d=dis` — this is Instagram's
unofficial JSON endpoint that returns post metadata including:
- `graphql.shortcode_media.display_url` — the full-resolution image URL
- `graphql.shortcode_media.edge_media_to_caption.edges[0].node.text` — the caption

If the JSON endpoint is blocked (Instagram frequently changes these), fall back to
scraping the HTML page and extracting:
- `og:image` meta tag — the post's main image URL
- `og:description` — the caption

```ts
export async function fetchInstagramPost(postUrl: string): Promise<{
  imageUrl: string | null;
  caption: string | null;
  postUrl: string;
}>
```

Add this function to `@chefsbook/ai` or the web fetch utilities.

---

## STEP 3 — Extract recipe from Instagram content

Once the image URL and caption are fetched, pass both to Claude:

```ts
// In @chefsbook/ai:
export async function extractRecipeFromInstagram(params: {
  imageUrl: string | null;
  caption: string | null;
  postUrl: string;
}): Promise<ScannedRecipe | null>
```

Claude prompt:
```
You are analysing an Instagram post to extract a recipe.

Post URL: ${postUrl}
Caption text: ${caption ?? 'No caption available'}

${imageUrl ? 'An image from the post is also attached.' : ''}

Determine: does this Instagram post contain a recipe?

If YES: extract the complete recipe in the standard JSON format:
{
  "title": "...",
  "description": "...",
  "ingredients": [...],
  "steps": [...],
  "notes": "...",
  "cuisine": "...",
  "servings": N,
  "cook_time": "..."
}

If NO (it's just a photo of food with no recipe): return:
{
  "has_recipe": false,
  "dish_name": "best guess at dish name from image/caption"
}

Return JSON only, no other text.
```

If an `imageUrl` is available, include it as a vision input alongside the text prompt
(same multi-modal pattern as `scanRecipeMultiPage`).

---

## STEP 4 — Route the result

**If recipe extracted successfully:**
- Show the standard recipe review screen (same as URL import)
- The Instagram post image is offered as the cover photo in `PostImportImageSheet`
  as the "From Instagram" option (first in the list)
- Label it "From Instagram post" with a small Instagram icon or 📸 emoji

**If no recipe found (`has_recipe: false`):**
- Route into the **dish identification flow** (session 21) using the Instagram image
  and the `dish_name` guess as starting context
- Skip the initial cuisine question (go straight to the action sheet since we already
  have a dish name)
- Show: "We found a photo of [dish_name] — would you like to find a recipe or generate one?"

**If fetch failed (private account, deleted post, network error):**
- Show a friendly error: "We couldn't access this Instagram post. It may be private or
  the link may have expired."
- Offer: [Try pasting the recipe text manually] [Cancel]

---

## STEP 5 — Update the import loading UI

The Instagram import may take 3–8 seconds (fetch + Claude analysis). Show a loading state:

```
┌─────────────────────────────────────┐
│  📸 Reading Instagram post...       │
│  ████████░░░░░░░░  Analysing...    │
└─────────────────────────────────────┘
```

Use the same loading component as the existing URL import if one exists.

---

## STEP 6 — Add Instagram to the Scan tab

In the Scan/Import tab, add an "Instagram" option to the import grid alongside the existing
URL, scan, speak options:

- Icon: 📸 or a camera-with-heart icon
- Label: "Instagram"
- Tapping it opens a text input for pasting an Instagram post URL manually
  (for cases where the user didn't share directly from Instagram)

This gives users two ways to import from Instagram:
1. Share directly from the Instagram app → automatic
2. Paste URL in ChefsBook manually → same flow

---

## IMPORTANT CONSTRAINTS

- Only works for **public** Instagram posts — private accounts cannot be fetched
- Do not attempt to log in to Instagram or use any unofficial API that requires auth
- If Instagram changes their page structure and scraping breaks, the fallback is the
  manual paste flow with a clear error message
- The Instagram icon/branding in the UI should be tasteful — use 📸 emoji or a generic
  camera icon rather than the official Instagram logo (avoid trademark issues)

---

## COMPLETION CHECKLIST

- [ ] Incoming Instagram URLs detected in share handler (`_layout.tsx`)
- [ ] `fetchInstagramPost()` fetches image URL + caption from public posts
- [ ] Falls back to `og:image` + `og:description` if JSON endpoint blocked
- [ ] `extractRecipeFromInstagram()` sends image + caption to Claude
- [ ] Recipe result routes to standard review screen
- [ ] Instagram image offered as "From Instagram post" in `PostImportImageSheet`
- [ ] No-recipe result routes to dish identification flow with dish name pre-filled
- [ ] Private/failed fetch shows friendly error with manual fallback
- [ ] Loading state shown during fetch + analysis
- [ ] "Instagram" option added to Scan tab import grid
- [ ] Manual URL paste works same as direct share
- [ ] Safe area insets on all new modals
- [ ] Run `/wrapup` to update DONE.md and CLAUDE.md

# ChefsBook — Session 197: Fix Paste Ingredients Not Saving
# Target: apps/web (recipe detail missing-ingredients banner, /api/import/text route)

---

## CONTEXT

Read CLAUDE.md, DONE.md, .claude/agents/testing.md, .claude/agents/deployment.md,
.claude/agents/import-pipeline.md, and .claude/agents/feature-registry.md before starting.
Run all pre-flight checklists.

## PROBLEM

The "Paste ingredients" textarea on the missing-ingredients banner accepts
text input but after clicking Save, no ingredients appear on the recipe.
The paste-and-save flow from session 193 is broken — either importFromText()
is failing silently, the parsed result is not being saved to the recipe, or
the UI is not refreshing after save.

## DIAGNOSE FIRST

### Check the network request
Read the banner component that handles the paste save action. Find:
- What endpoint does Save call?
- What does it send in the request body?
- Does it handle the response and update the recipe, or fire-and-forget?
- Is there error handling that silently swallows failures?

### Check /api/import/text
Read the route handler. Confirm:
- Does it call importFromText() and get a result?
- Does it save the parsed ingredients back to the recipe?
- Does it return the updated recipe to the caller?
- Is there a recipe ID in the request so it knows which recipe to update?

### Check importFromText() output
The function may be returning parsed data but the calling code may not be
merging it into the existing recipe — it might be trying to create a new
recipe instead of updating the existing one.

Run a test call directly:
```bash
curl -s -X POST https://chefsbk.app/api/import/text \
  -H "Content-Type: application/json" \
  -d '{"text": "1/3 cup kewpie mayo\n1 tablespoon sriracha\n1 tablespoon Japanese BBQ sauce"}' \
  | jq .
```
Report what the API returns before fixing anything.

## FIX

Based on diagnosis, fix the specific break. Most likely scenarios:

**If /api/import/text creates a new recipe instead of updating existing:**
The banner must pass the existing recipe ID in the request, and the route
must UPDATE that recipe's ingredients rather than INSERT a new recipe row.

**If importFromText() returns data but it's not saved:**
Wire the merge — take the returned ingredients array and call
replaceIngredients() (or equivalent) on the existing recipe.

**If the UI doesn't refresh after save:**
After a successful save response, refresh the recipe data so ingredients
appear without a full page reload.

**If importFromText() is throwing and the error is swallowed:**
Expose the error to the user with a clear message. Never fail silently.

TYPE: CODE FIX — the paste flow must reliably save parsed ingredients
to the existing recipe and display them immediately.

## VERIFICATION

- Paste "1/3 cup kewpie mayo, 1 tablespoon sriracha, 1 tablespoon soy sauce"
  into the missing ingredients banner on any recipe
- Click Save
- Ingredients must appear on the recipe immediately without page reload
- Check DB confirms ingredients saved:
```bash
docker exec -it supabase-db psql -U postgres -c "
  SELECT title, jsonb_array_length(ingredients) as count
  FROM recipes
  WHERE title ILIKE '%katsu%'
  ORDER BY created_at DESC LIMIT 3;
"
```
- Banner must disappear after ingredients are saved (recipe is now complete)

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
rm -rf apps/web/.next
cd apps/web
NODE_OPTIONS=--max-old-space-size=1024 npx next build --no-lint 2>&1 | tail -20
pm2 restart chefsbook-web
```

## COMPLETION CHECKLIST

- [ ] Diagnosed — exact break point identified (API, merge logic, or UI refresh)
- [ ] /api/import/text updates existing recipe when recipe ID provided
- [ ] Pasted ingredients parsed and saved to the correct recipe
- [ ] UI refreshes ingredients immediately after save — no page reload needed
- [ ] Banner disappears after ingredients successfully saved
- [ ] Errors shown to user — no silent failures
- [ ] tsc --noEmit passes clean
- [ ] Deployed — chefsbk.app HTTP 200
- [ ] TYPE: CODE FIX
- [ ] Run /wrapup

# ChefsBook — Session 168: Generate Remaining Images + Test Regen End-to-End
# Source: Replicate credits exhausted — 4 recipes missing images, regen untested
# Target: scripts + database verification

---

## CONTEXT

Read CLAUDE.md, DONE.md, and .claude/agents/wrapup.md NOW.

Replicate credits are exhausted ($0.00). This session:
1. Generates the 4 remaining recipe images
2. Tests image regeneration end-to-end with a real regen pill click
3. Verifies the new image saves correctly to recipe_user_photos

NOTE: This session requires REPLICATE_API_TOKEN to be funded.
Before running the scripts, verify credits are available:

```bash
curl -s https://api.replicate.com/v1/account \
  -H "Authorization: Bearer $REPLICATE_API_TOKEN" \
  | jq '.billing'
```

If credits are $0.00, stop and notify the user to top up at
replicate.com/account/billing before proceeding.

---

## STEP 1 — Verify Replicate credits

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo

export REPLICATE_API_TOKEN=r8_ZE9sar6UuIxFjL7aEBrTrUJkaoe8Mt80sd6Og
export SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogInNlcnZpY2Vfcm9sZSIsICJpc3MiOiAic3VwYWJhc2UiLCAiaWF0IjogMTc1MTAwMDAwMCwgImV4cCI6IDE5MDg3NjY0MDB9.d0A4kE4okczvSWbLw9WxzVr9sr2AMdzh09Lnu7T1eXQ
export ANTHROPIC_API_KEY=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

# Check balance
curl -s https://api.replicate.com/v1/account \
  -H "Authorization: Bearer $REPLICATE_API_TOKEN"
```

If balance is $0.00 — STOP. Do not proceed. Report to user.
If balance > $0.00 — continue to Step 2.

---

## STEP 2 — Generate remaining 4 recipe images

```bash
node scripts/generate-recipe-images.mjs
```

Expected: 4 images generated, uploaded to Supabase storage,
watermark badge applied bottom-left.

Verify each recipe now has an image:
```bash
docker exec -it supabase-db psql -U postgres -d postgres -c "
SELECT r.title, p.url, p.is_ai_generated
FROM recipes r
LEFT JOIN recipe_user_photos p ON p.recipe_id = r.id AND p.is_primary = true
WHERE p.id IS NULL OR p.url IS NULL
LIMIT 10;"
```

Expected: 0 rows (all recipes have images).

---

## STEP 3 — Test image regeneration end-to-end via API

Find a recipe with regen_count = 0:
```bash
docker exec -it supabase-db psql -U postgres -d postgres -c "
SELECT r.id, r.title, p.regen_count, p.url
FROM recipes r
JOIN recipe_user_photos p ON p.recipe_id = r.id AND p.is_primary = true
WHERE p.is_ai_generated = true AND (p.regen_count = 0 OR p.regen_count IS NULL)
LIMIT 1;"
```

Get the recipe ID. Then trigger a regeneration via API:
```bash
# Get auth token
TOKEN=$(curl -s -X POST \
  "https://api.chefsbk.app/auth/v1/token?grant_type=password" \
  -H "apikey: eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogImFub24iLCAiaXNzIjogInN1cGFiYXNlIiwgImlhdCI6IDE3NTEwMDAwMDAsICJleHAiOiAxOTA4NzY2NDAwfQ.ISQ5gkoYSYom-YNgj1PUk-h8Hd6E0MQHtvrEB7NR_zw" \
  -H "Content-Type: application/json" \
  -d '{"email":"a@aol.com","password":"TestPass123!"}' \
  | jq -r '.access_token')

# Trigger regeneration with "wrong_dish" pill
curl -s -X POST "https://chefsbk.app/api/recipes/RECIPE_ID/regenerate-image" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pillId":"wrong_dish"}' \
  | jq '.'
```

Wait 15-20 seconds for Replicate to complete, then check:

```bash
# Verify new image was saved
docker exec -it supabase-db psql -U postgres -d postgres -c "
SELECT url, is_primary, is_ai_generated, regen_count, created_at
FROM recipe_user_photos
WHERE recipe_id = 'RECIPE_ID'
ORDER BY created_at DESC
LIMIT 3;"
```

Expected:
- New row with Supabase URL (not Replicate URL)
- is_primary = true
- is_ai_generated = true
- regen_count = 1

Also check the image_generation_status:
```bash
docker exec -it supabase-db psql -U postgres -d postgres -c "
SELECT image_generation_status FROM recipes WHERE id = 'RECIPE_ID';"
```

Expected: 'complete'

---

## STEP 4 — Apply watermarks to any new images

After generating the 4 missing images:
```bash
node scripts/apply-watermarks.mjs
```

Verify watermark badge visible by checking image dimensions match
expected with badge in bottom-left.

---

## STEP 5 — Report results

Show:
1. How many images were generated
2. Regeneration test result (new URL in DB? is_primary=true?)
3. Any failures with specific error messages

---

## WRAPUP REQUIREMENT

Read .claude/agents/wrapup.md before running /wrapup.
Every DONE.md entry must start with [SESSION 168].
Full ✓/✗ checklist audit required.
No item marked DONE without proof (show query results).

---

## COMPLETION CHECKLIST

- [ ] Replicate credits verified > $0.00 (show balance)
- [ ] generate-recipe-images.mjs run — show output
- [ ] 0 recipes without primary images (show psql query result)
- [ ] Regen API called for a test recipe (show curl response)
- [ ] DB verified: new Supabase URL in recipe_user_photos after regen
- [ ] DB verified: regen_count = 1 after regen
- [ ] DB verified: image_generation_status = 'complete'
- [ ] apply-watermarks.mjs run on new images
- [ ] Run /wrapup per .claude/agents/wrapup.md
- [ ] Every DONE.md entry starts with [SESSION 168]
- [ ] Full ✓/✗ audit with proof for every item

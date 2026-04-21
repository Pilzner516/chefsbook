# ChefsBook — Session 196: Fix False Positive "Missing Tags" Banner
# Target: apps/web (recipe detail banner logic, completeness check)

---

## CONTEXT

Read CLAUDE.md, DONE.md, .claude/agents/testing.md, .claude/agents/deployment.md,
and .claude/agents/feature-registry.md before starting.
Run all pre-flight checklists.

## PROBLEM

A recipe (Homemade Crepes) shows "This recipe is missing tags" but has 8 tags
visible on the page: French, breakfast, vegetarian, baked, quick, classic,
versatile, pantry-staple. The banner is a false positive.

## DIAGNOSE FIRST

Check the recipe in the DB:
```bash
docker exec -it supabase-db psql -U postgres -c "
  SELECT r.id, r.title, r.is_complete, r.completeness_verdict,
         COUNT(rt.tag_id) as tag_count,
         r.tags as tags_jsonb
  FROM recipes r
  LEFT JOIN recipe_tags rt ON rt.recipe_id = r.id
  WHERE r.title ILIKE '%crepe%'
  GROUP BY r.id, r.title, r.is_complete, r.completeness_verdict, r.tags
  ORDER BY r.created_at DESC LIMIT 3;
"
```

Then find what condition drives the "missing tags" banner in the recipe
detail page. It will be one of:
- Checking `recipes.tags` JSONB array length
- Checking `recipe_tags` join count
- Checking `recipe_categories` join count
- Checking `is_complete` flag
- Checking `completeness_verdict` string

Confirm which field the banner reads and which field actually has the tags.
If they are different fields, that is the root cause.

## FIX

Whatever the banner condition checks — make it consistent with where tags
are actually stored and displayed. If tags exist in either location, the
banner must not show.

Also: if is_complete is false on this recipe despite having full data,
update the completeness check to correctly evaluate tag presence and mark
the recipe complete.

TYPE: CODE FIX — the banner condition must not show false positives.

## VERIFICATION

- Homemade Crepes recipe must not show the missing tags banner
- A recipe with genuinely zero tags must still show the banner
- is_complete must be true on recipes that have tags, ingredients, and steps

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

- [ ] Root cause identified — which field the banner checks vs where tags live
- [ ] Banner condition fixed — no false positives
- [ ] Recipe with real tags: banner gone
- [ ] Recipe with zero tags: banner still shows correctly
- [ ] is_complete correctly reflects tag presence
- [ ] tsc --noEmit passes clean
- [ ] Deployed — chefsbk.app HTTP 200
- [ ] TYPE: CODE FIX
- [ ] Run /wrapup

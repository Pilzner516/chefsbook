# Implementation Plan: knowledge-gaps-detect Handler

## Pre-flight Verification ✓
- [x] `detectKnowledgeGaps` exported from `@chefsbook/ai` (confirmed at packages/ai/src/index.ts:104)
- [x] Function returns `{ detected, updated, filled }` (confirmed in detectKnowledgeGaps.ts)
- [x] Insertion point identified: line 1277 (after findGapRecipes, before unknown action)

## Step 1: Add Handler Code
**File**: `apps/web/app/api/admin/route.ts`  
**Location**: Insert at line 1277 (after closing brace of findGapRecipes handler)

```typescript
  if (action === 'knowledge-gaps-detect') {
    try {
      const { detectKnowledgeGaps } = await import('@chefsbook/ai');
      const result = await detectKnowledgeGaps();
      return NextResponse.json(result);
    } catch (err: any) {
      console.error('[admin] knowledge-gaps-detect failed:', err);
      return NextResponse.json({ error: err?.message ?? 'Detection failed' }, { status: 500 });
    }
  }
```

**Pattern**: Matches sibling `findGapRecipes` at line 1262 (dynamic import + try/catch)

## Step 2: Local Testing
1. **TypeScript check**: `cd apps/web && npx tsc --noEmit`
2. **Dev server**: `npm run web`
3. **Manual tests**:
   - Unauthorized: `curl -X POST http://localhost:3000/api/admin -d '{"action":"knowledge-gaps-detect"}'` → 401
   - Authorized: Add `Authorization: Bearer <token>` → 200 with `{detected, updated, filled}`
   - Regression: `{"action":"bogus"}` → 400 "Unknown action"

## Step 3: Commit
```bash
git add apps/web/app/api/admin/route.ts
git commit -m "feat(admin): add knowledge-gaps-detect action handler"
git push origin main
```

## Step 4: Deploy to slux
```bash
ssh pilzner@slux "cd /opt/luxlabs/chefsbook/repo && git pull && \
  rm -rf apps/web/node_modules/react apps/web/node_modules/react-dom apps/web/.next && \
  cd apps/web && NODE_OPTIONS=--max-old-space-size=4096 npx next build --no-lint"
ssh pilzner@slux "pm2 restart chefsbook-web"
```

**CRITICAL**: Do NOT run `npm install` on slux (EOVERRIDE conflict per CLAUDE.md)

## Step 5: Post-Deploy Verification
1. **Logs**: `ssh pilzner@slux "pm2 logs chefsbook-web --lines 50 --nostream"`
2. **Smoke test**: `curl -X POST https://chefsbk.app/api/admin -H "Authorization: Bearer <token>" -d '{"action":"knowledge-gaps-detect"}'`
3. **DB check**: Verify `knowledge_gaps` table updates via Supabase Studio

## Success Criteria
- [x] TypeScript compiles clean
- [ ] Unauthorized returns 401
- [ ] Authorized returns 200 with correct shape
- [ ] Unknown action still returns 400
- [ ] Production deployment succeeds
- [ ] PM2 logs show clean restart
- [ ] Production API test returns valid result

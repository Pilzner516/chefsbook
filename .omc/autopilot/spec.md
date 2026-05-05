# Specification: knowledge-gaps-detect Admin Handler

## Overview
Add a POST action handler to the web admin API that triggers knowledge gap detection in the cooking action timings graph.

## Functional Requirements

### FR1: POST Handler
- **Action name**: `'knowledge-gaps-detect'` (kebab-case, as specified by user)
- **Location**: `apps/web/app/api/admin/route.ts` line ~1277 (after `findGapRecipes` handler, before unknown-action fallback)
- **Authentication**: Uses existing `verifyAdmin(req)` - already handled at POST function entry
- **Request body**: `{ action: 'knowledge-gaps-detect' }`
- **Response**: `{ detected: number, updated: number, filled: number }`

### FR2: Function Call
- **Import**: Dynamic import from `@chefsbook/ai` (matches sibling pattern at line 1262)
- **Function**: `detectKnowledgeGaps()` - already implemented at `packages/ai/src/detectKnowledgeGaps.ts`
- **Signature**: `async function detectKnowledgeGaps(): Promise<GapDetectionResult>`
- **Return type**: `GapDetectionResult = { detected: number, updated: number, filled: number }`

### FR3: Error Handling
- Try/catch wrapper around import and function call
- On error: return `{ error: string }` with 500 status
- Console.error for PM2 log visibility

## Non-Functional Requirements

### NFR1: Code Pattern Consistency
Match existing handler patterns in the file:
- Dynamic import (like `findGapRecipes` at line 1262)
- Standard error handling
- NextResponse.json for all responses

### NFR2: Performance
- Dynamic import keeps AI package out of cold-start bundle
- Function may take 10-30s for full detection run (acceptable for admin operation)

### NFR3: Deployment
Deploy to slux production server using:
1. Local commit
2. Pull on slux
3. Clean build: `rm -rf apps/web/node_modules/react apps/web/node_modules/react-dom apps/web/.next`
4. Build: `NODE_OPTIONS=--max-old-space-size=4096 npx next build --no-lint`
5. Restart: `pm2 restart chefsbook-web`

## Acceptance Criteria

### AC1: Authorized Request
Returns: `200 { "detected": N, "updated": N, "filled": N }`

### AC2: Unauthorized Request
Without Bearer token or with non-admin token → `401 { "error": "Unauthorized" }`

### AC3: Error Handling
If `detectKnowledgeGaps()` throws → `500 { "error": "..." }`

### AC4: Unknown Action Fallback
Existing unknown action handler still works after insertion

## Implementation Notes

### Pre-flight Verification
Before implementing, verify:
- `packages/ai/src/index.ts` exports `detectKnowledgeGaps`
- TypeScript compiles: `cd apps/web && npx tsc --noEmit`

### Code Block to Insert (at line 1277)
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

## Out of Scope
- Modifying `detectKnowledgeGaps()` function
- Rate limiting or audit logging
- Web UI integration
- Parameters/filters

## Testing Strategy
1. TypeScript compilation passes
2. Unauthorized request returns 401
3. Authorized request returns 200 with correct shape
4. DB verification shows gap updates
5. Unknown action regression test passes

## Files Affected
- `apps/web/app/api/admin/route.ts` - add handler (~10 lines)

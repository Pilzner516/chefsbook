# Manual Testing Instructions - Done Chef Fix

## Fix Deployed
- Commit: af9c443
- Location: http://100.83.66.51:3000
- Fix: Version conflict handling now matches mobile pattern

## What Was Fixed
1. **persistRecomputedPlan return value now checked** - Refetches on conflict
2. **Proper error handling added** - Shows user feedback on version conflicts
3. **Simple version logic** - Always uses session.version (no complex conditional)
4. **Refetch on failure** - Fresh session loaded on any conflict

## Test Procedure

### Test 1: Fresh Session (Clean Path)
1. Open http://100.83.66.51:3000 in browser
2. Open DevTools Console (F12)
3. Navigate to any menu with dishes
4. Click "Start Cooking"
5. Complete setup (add chef name, select oven, etc.)
6. Watch console for 🔴 markers (verbose logging still active)
7. Click "Done, Chef" button
8. **Expected**: 
   - Step advances from 0 → 1
   - Console shows session and step data
   - TTS speaks next step
   - Timer resets for next step

### Test 2: Version Conflict Simulation
1. Open same menu in two browser tabs
2. Start cooking in Tab 1
3. Start cooking in Tab 2 (will create second session or sync via Realtime)
4. Click "Done, Chef" in Tab 1
5. Immediately click "Done, Chef" in Tab 2
6. **Expected**:
   - One tab succeeds, advances step
   - Other tab shows alert: "Another device updated the session. Please try again."
   - Both tabs automatically refetch fresh session
   - Console shows: 🔴 Version conflict warning

### Test 3: Complete Session
1. Open fresh menu
2. Start cooking
3. Click "Done, Chef" through ALL steps
4. **Expected**:
   - Each step advances correctly
   - step_actuals populated in DB
   - TTS speaks each step
   - Final step redirects to menu with "?cooked=1"

## Database Verification

Check stuck sessions are now working:
```sql
SELECT id, status, current_step_index, version, 
       jsonb_array_length(step_actuals) as actuals_count 
FROM cooking_sessions 
WHERE id IN (
  '07630972-ee8f-4d4b-9e63-dd996501df81',
  '4652dc7a-6cfc-48fe-8ae5-ac945c8a756d'
);
```

After testing, these should have:
- current_step_index > 0
- actuals_count > 0
- status may be 'complete' if finished

## Console Markers to Look For

✅ **Success indicators:**
- "🔴 STEP COMPLETE CALLED"
- Session object logged
- Current step object logged
- No error messages
- Step index increments

❌ **Failure indicators:**
- "🔴 STEP COMPLETE FAILED"
- "🔴 Version conflict during plan persist"
- "🔴 Version conflict during step update"
- Alert: "Another device updated..."

## After Testing
Report back:
1. Did steps advance correctly?
2. Were version conflicts handled gracefully?
3. Did TTS work?
4. Any console errors?

If all tests pass, verbose logging can be removed.

# Mobile Image Generation Fix - Verification Plan

## What was fixed
**Issue**: Selecting any theme in AI image generation showed "Something went wrong"

**Root Cause**: Mobile app was calling the wrong URL
- Before: `https://api.chefsbk.app/api/recipes/mobile-generate-image` (Supabase URL)
- After: `https://chefsbk.app/api/recipes/mobile-generate-image` (Web app URL)

**Fix**: Replaced port-replacement hack with proper env var
- Added `EXPO_PUBLIC_WEB_URL=https://chefsbk.app` to `.env.local`
- Updated 4 files to use the new env var

## Files Changed
1. `apps/mobile/components/AiImageGenerationModal.tsx` - Main image generation modal
2. `apps/mobile/app/speak.tsx` - Auto-generate after voice recipe
3. `apps/mobile/app/cook/[id].tsx` - Cook mode API calls (3 occurrences)
4. `apps/mobile/.env.local` - Added EXPO_PUBLIC_WEB_URL

## Verification Steps

### 1. Build and install the app
```bash
cd apps/mobile
npx expo start --dev-client
```

### 2. Navigate to recipe detail
- Tap "Recipes" tab
- Tap any recipe card
- Verify you see "Change Image" overlay on hero (owner-only)

### 3. Test image generation
- Tap "Change Image"
- Select "GENERATE AI IMAGE"
- Modal should open (not free plan gate)
- Select any theme (try all 8 themes)
- Tap "Generate"

### 4. Check debug logs
```bash
adb logcat -s ReactNativeJS:V | grep IMAGE-GEN-DEBUG
```

**Expected**: Real error message (if any) logged, not generic "Something went wrong"

**Success criteria**:
- Theme selection works without error
- Image generates successfully for all themes
- OR: Real error shows in Alert (e.g., "Image generation unavailable", "Unauthorized", "Regeneration limit reached")
- NO generic "Something went wrong" errors

### 5. Test all themes
Test each theme to verify the fix works universally:
1. bright_fresh (default)
2. rustic_homestyle
3. elegant_fine_dining
4. vibrant_modern
5. cozy_comfort
6. minimal_clean
7. artistic_plated
8. natural_organic

### 6. Verify other features using WEB_API_URL
After confirming image generation works:
- Test "Speak a Recipe" flow (auto-generates image for Chef+)
- Test Cook Mode if you have a cooking session setup

### 7. Remove debug logging
Once verified working, remove these lines from `AiImageGenerationModal.tsx`:
```typescript
console.error('[IMAGE-GEN-DEBUG] Real error:', err);
console.error('[IMAGE-GEN-DEBUG] Error message:', err.message);
console.error('[IMAGE-GEN-DEBUG] Error stack:', err.stack);
```

## Regression Checks
- [ ] Recipe detail page loads normally
- [ ] Existing recipe images still display
- [ ] Other Change Image options work (Choose from Library, Take a Photo)
- [ ] Speak a Recipe completes successfully

## Known Issues to Distinguish
This fix ONLY addresses the URL construction bug. Other potential errors that might still occur:
- 402 "Upgrade required" (free plan) - Expected, shows proper alert
- 429 "Regeneration limit reached" (5 regens) - Expected, shows proper alert
- 503 "Image generation unavailable" (Replicate API down) - Expected
- Network errors - Should show descriptive message, not generic error

## Delete this file after verification
Once image generation is confirmed working and debug logging is removed, delete this file.

# ChefsBook — Session 47: Unified Dialog & Alert Styling Sweep
# Source: Design review 2026-04-10
# Target: apps/mobile + apps/web

---

## CROSS-PLATFORM REQUIREMENT — READ FIRST

Every dialog, alert, confirmation, and warning on BOTH platforms must use the
unified ChefsBook dialog spec below. No native OS dialogs allowed anywhere.
Read .claude/agents/ui-guardian.md before starting.

---

## THE UNIFIED DIALOG SPEC

Apply this spec to every modal, alert, confirmation, and warning in the app:

```
Backdrop:    rgba(0, 0, 0, 0.5) semi-transparent overlay
Container:   background #ffffff
             border-radius 16px
             padding 24px
             max-width 360px, centered
             box-shadow: 0 4px 24px rgba(0,0,0,0.12)

Icon:        optional — centered above title, 32px emoji or icon
Title:       18px, font-weight 600, color #1a1a1a, centered
Body:        14px, color #6b7280, line-height 1.6, centered
             margin-bottom 24px before buttons

Buttons:     horizontal row, pill shape (border-radius 24px)
             padding 10px 24px, font-size 15px, font-weight 600
             gap 12px between buttons

Button types:
  Primary (destructive):  bg #ce2b37, text #ffffff  ← Delete, Remove, Clear
  Secondary (proceed):    bg transparent, border 1.5px #ce2b37, text #ce2b37
  Cancel:                 bg transparent, border 1.5px #d1d5db, text #6b7280
  Positive (save/confirm): bg #009246, text #ffffff  ← Save, Confirm, Add
```

---

## STEP 1 — Create shared dialog components

### Web — `apps/web/components/ChefsDialog.tsx`

```tsx
interface ChefsDialogProps {
  open: boolean;
  icon?: string;           // emoji e.g. "⚠️" "🗑️" "✓"
  title: string;
  body: string | ReactNode;
  buttons: {
    label: string;
    variant: 'primary' | 'secondary' | 'cancel' | 'positive';
    onClick: () => void;
  }[];
  onClose?: () => void;
}
```

Renders a centered modal with backdrop. Use this for ALL dialogs on web.
Never use `window.confirm()` or `window.alert()`.

### Mobile — `apps/mobile/components/ChefsDialog.tsx`

Same props interface. Uses React Native `Modal` with the same styling via
NativeWind or StyleSheet. Never use `Alert.alert()` (broken in landscape,
inconsistent styling).

The existing `ConfirmDialog` component (if present) should be replaced or
refactored to use `ChefsDialog` internally.

---

## STEP 2 — Find all native dialogs and replace them

### Web — search for native dialogs:
```bash
grep -r "window\.confirm\|window\.alert\|window\.prompt" apps/web --include="*.tsx" --include="*.ts" -n
grep -r "confirm(\|alert(" apps/web/app apps/web/components --include="*.tsx" -n
```

### Mobile — search for native dialogs:
```bash
grep -r "Alert\.alert\|Alert\.prompt" apps/mobile --include="*.tsx" --include="*.ts" -n
```

Replace every instance found with `<ChefsDialog>`.

---

## STEP 3 — Audit all existing modals and bottom sheets

Beyond native alerts, check every existing custom modal/sheet for style
consistency. They should all follow the unified spec above.

Known dialogs to check and update if needed:

### Web:
- Delete recipe confirmation
- Remove from shopping list confirmation
- Clear all (QA notepad)
- Unfollow user confirmation
- Block commenter confirmation
- Recipe visibility change warning (private → shared)
- Privacy mode warning (switching to private account)
- Upgrade/plan gate prompt
- Suspended account notice
- Recipe under review notice
- Account under review notice (serious moderation)
- Portions mismatch warning (meal plan)
- Conflict warning (meal plan slot already filled)

### Mobile:
- Delete recipe confirmation
- Clear all notepad confirmation
- Unfollow confirmation
- Remove shopping list item
- Plan gate upgrade prompt
- Language picker warning (switching to private)
- Suspended account notice
- Recipe under review notice
- Account frozen notice
- Portions mismatch warning
- Meal plan slot conflict warning

For each: verify it uses `ChefsDialog` (or the unified style). Update any that
use native OS dialogs or inconsistent custom styling.

---

## STEP 4 — Toast notifications

Also standardise toast messages (brief non-blocking confirmations like
"Saved to your collection", "Link copied", "Added to Tuesday · Dinner"):

```
Toast style:
- Background: #1a1a1a (near black)
- Text: #ffffff, 14px, font-weight 500
- Border-radius: 24px (pill)
- Padding: 10px 20px
- Position: bottom-center, 80px above bottom edge (respects safe area on mobile)
- Duration: 2.5 seconds, fade out
- Max-width: 280px
```

If a toast library is already in use (e.g. react-hot-toast on web,
react-native-toast-message on mobile), configure it to use this style.
If no toast library exists, install one:
- Web: `npm install react-hot-toast`
- Mobile: already has expo-based toast or similar — check and standardise

---

## DEPLOYMENT

After all changes, deploy to RPi5:
```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

---

## COMPLETION CHECKLIST

- [ ] `ChefsDialog` component created for web (correct spec)
- [ ] `ChefsDialog` component created for mobile (correct spec)
- [ ] All `window.confirm()` / `window.alert()` replaced on web
- [ ] All `Alert.alert()` replaced on mobile
- [ ] All known dialogs listed above updated to unified style
- [ ] Toast notifications styled consistently (pill, dark bg, bottom-center)
- [ ] No OS-native dialogs remain anywhere in the app
- [ ] TypeScript: tsc --noEmit passes both apps
- [ ] Deployed to RPi5 and verified live
- [ ] Run /wrapup to update DONE.md and CLAUDE.md

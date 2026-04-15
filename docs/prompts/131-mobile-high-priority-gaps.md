# ChefsBook — Session 131: Mobile High Priority Feature Gaps
# Source: Mobile parity audit session 128
# Target: apps/mobile

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, ui-guardian.md, data-flow.md
and ALL mandatory agents per SESSION START sequence before touching anything.

The parity audit identified 5 high priority gaps. Port these web features
to mobile. All use useTheme().colors — never hardcode hex.
All modals/alerts use ChefsDialog — never native Alert.

---

## FEATURE 1 — Notification UI (bell panel equivalent)

Web has a full notification bell panel with 5 tabs. Mobile has nothing.

### Implementation
Add a notifications screen accessible from the tab bar or a bell icon
in the header of the Recipes tab.

Option A (preferred): Add a bell icon to the top-right of the Recipes
tab header. Tapping opens a full-screen modal or bottom sheet with:
- 5 tabs: All / Comments / Likes / Follows / Moderation
- Each tab shows filtered notifications list
- Each notification row: avatar + message + relative time + unread dot
- Tapping a notification: marks as read + navigates to relevant content
  (recipe, profile, etc.)
- "Mark all as read" button

### DB queries needed
Use existing getNotifications(), getUnreadCount(), markRead(),
markAllRead() from packages/db.

### Unread badge
Show red badge count on the bell icon when unread count > 0.
Subscribe to changes via Supabase Realtime (or poll on focus).

---

## FEATURE 2 — Message inbox (/dashboard/messages equivalent)

Web has a full messages page. Mobile has a compose button on profiles
but no inbox to read messages.

### Implementation
Add a Messages tab or screen (accessible from tab bar or Settings area).

Screen layout:
- Conversation list (same as web left panel)
- Tap conversation → opens thread view (full screen)
- Thread view: bubbles (received left cream, sent right red)
- Compose area at bottom (textarea + Send button)
- Auto-scroll to bottom
- Mark as read on open

Use existing getConversationList(), getConversation(), sendMessage(),
markMessagesRead() from packages/db.

Unread badge on Messages nav item when unread_messages_count > 0.

---

## FEATURE 3 — Like plan gate (free plan cannot like)

Web correctly blocks free plan users from liking with an upgrade prompt.
Mobile still allows free plan users to like directly.

### Fix
In the mobile LikeButton component:
- Check user's plan_tier from preferencesStore or user_profiles
- If free: show ChefsDialog upgrade prompt instead of toggling like
  "Liking recipes is available on Chef plan and above."
  Buttons: "Upgrade" (→ plans screen) + "Maybe Later"
- If Chef/Family/Pro: proceed with like via the API route
  (same /api/recipe/[id]/like route used by web — mobile can call it
  with the user's JWT)

---

## FEATURE 4 — Translated titles in recipe list

Web shows translated recipe titles in the recipe list when user
switches language. Mobile shows original titles only.

### Fix
In the mobile recipe list screen (apps/mobile/app/(tabs)/index.tsx):
- After fetching recipes, call getBatchTranslatedTitles(recipeIds, language)
  from packages/db
- If user language = 'en': skip, show original titles
- If language ≠ 'en': replace title in display with translated version
  (fall back to original if no translation exists)
- This is display-only — never modify the recipe object's title

---

## FEATURE 5 — Recipe visibility toggle

Web recipe detail allows toggling visibility (private/shared_link/public).
Mobile does not have this toggle.

### Fix
In mobile recipe detail edit mode:
- Add a visibility picker below the title or in the recipe settings area
- Options: Private (🔒) / Shared Link (🔗) / Public (🌐)
- Shows as pill selector or segmented control
- Saves to DB on change via updateRecipeMetadata()
- Show current visibility state clearly
- Use ChefsDialog to confirm when changing from public → private
  ("This will hide the recipe from other users. Continue?")

---

## DEPLOYMENT NOTE

Mobile changes do not deploy to RPi5 — they require a new APK build.
After all fixes:

```bash
cd apps/mobile
export JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
npx expo run:android --variant release
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

Test on emulator (API 33/34 preferred) via ADB screenshots.
Describe what you see — do not embed screenshots.
Delete /tmp/cb_screen.png after each capture.

---

## COMPLETION CHECKLIST

- [ ] Notification bell icon in Recipes tab header with unread badge
- [ ] Notification panel/modal: 5 tabs, tap to navigate, mark all read
- [ ] Messages screen: conversation list + thread view + compose
- [ ] Messages unread badge on nav item
- [ ] Free plan like gate: ChefsDialog upgrade prompt on mobile
- [ ] Translated titles in recipe list (language ≠ en)
- [ ] Recipe visibility toggle in edit mode (private/shared_link/public)
- [ ] All colors from useTheme().colors — zero hardcoded hex
- [ ] All modals use ChefsDialog — zero native Alert
- [ ] Safe area insets on all new bottom sheets/modals
- [ ] tsc --noEmit passes mobile
- [ ] Release APK builds and installs on emulator
- [ ] ADB screenshots taken and described for new features
- [ ] feature-registry.md updated
- [ ] Run /wrapup
- [ ] At the end of the session, recap exactly what was completed from
      this prompt, what was left incomplete, and why.

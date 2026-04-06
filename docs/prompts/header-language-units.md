# Header Language Selector + Metric/Imperial Toggle
# Save to: docs/prompts/header-language-units.md

Read CLAUDE.md, apps/mobile/CLAUDE.md and
.claude/agents/navigator.md to orient yourself.

Add language selector and metric/imperial toggle to the 
ChefsBook header. This spans mobile AND web.

===================================================================
## STEP 1 — Database: user preferences
===================================================================

Add to user_profiles table:
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS preferred_units text DEFAULT 'imperial';

Run on rpi5-eth via SSH.

===================================================================
## STEP 2 — Shared constants in packages/ui
===================================================================

Create packages/ui/src/languages.ts:

export const LANGUAGES = [
  { code: 'en', name: 'English',    flag: '🇺🇸', nativeName: 'English' },
  { code: 'fr', name: 'French',     flag: '🇫🇷', nativeName: 'Français' },
  { code: 'es', name: 'Spanish',    flag: '🇪🇸', nativeName: 'Español' },
  { code: 'ar', name: 'Arabic',     flag: '🇸🇦', nativeName: 'العربية' },
  { code: 'zh', name: 'Chinese',    flag: '🇨🇳', nativeName: '中文' },
  { code: 'da', name: 'Danish',     flag: '🇩🇰', nativeName: 'Dansk' },
  { code: 'nl', name: 'Dutch',      flag: '🇳🇱', nativeName: 'Nederlands' },
  { code: 'fi', name: 'Finnish',    flag: '🇫🇮', nativeName: 'Suomi' },
  { code: 'de', name: 'German',     flag: '🇩🇪', nativeName: 'Deutsch' },
  { code: 'el', name: 'Greek',      flag: '🇬🇷', nativeName: 'Ελληνικά' },
  { code: 'he', name: 'Hebrew',     flag: '🇮🇱', nativeName: 'עברית' },
  { code: 'hi', name: 'Hindi',      flag: '🇮🇳', nativeName: 'हिन्दी' },
  { code: 'hu', name: 'Hungarian',  flag: '🇭🇺', nativeName: 'Magyar' },
  { code: 'id', name: 'Indonesian', flag: '🇮🇩', nativeName: 'Bahasa Indonesia' },
  { code: 'it', name: 'Italian',    flag: '🇮🇹', nativeName: 'Italiano' },
  { code: 'ja', name: 'Japanese',   flag: '🇯🇵', nativeName: '日本語' },
  { code: 'ko', name: 'Korean',     flag: '🇰🇷', nativeName: '한국어' },
  { code: 'ms', name: 'Malay',      flag: '🇲🇾', nativeName: 'Bahasa Melayu' },
  { code: 'no', name: 'Norwegian',  flag: '🇳🇴', nativeName: 'Norsk' },
  { code: 'pl', name: 'Polish',     flag: '🇵🇱', nativeName: 'Polski' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹', nativeName: 'Português' },
  { code: 'ro', name: 'Romanian',   flag: '🇷🇴', nativeName: 'Română' },
  { code: 'ru', name: 'Russian',    flag: '🇷🇺', nativeName: 'Русский' },
  { code: 'sv', name: 'Swedish',    flag: '🇸🇪', nativeName: 'Svenska' },
  { code: 'th', name: 'Thai',       flag: '🇹🇭', nativeName: 'ภาษาไทย' },
  { code: 'tr', name: 'Turkish',    flag: '🇹🇷', nativeName: 'Türkçe' },
  { code: 'uk', name: 'Ukrainian',  flag: '🇺🇦', nativeName: 'Українська' },
  { code: 'vi', name: 'Vietnamese', flag: '🇻🇳', nativeName: 'Tiếng Việt' },
]

export const PRIORITY_LANGUAGES = ['en', 'fr', 'es']

export type UnitSystem = 'metric' | 'imperial'

Export from packages/ui/src/index.ts

===================================================================
## STEP 3 — User preferences store on mobile
===================================================================

Create apps/mobile/lib/zustand/preferencesStore.ts:

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@chefsbook/db'

interface PreferencesStore {
  language: string
  units: UnitSystem
  setLanguage: (code: string) => Promise<void>
  setUnits: (system: UnitSystem) => Promise<void>
  loadFromSupabase: (userId: string) => Promise<void>
}

- persist to AsyncStorage key 'chefsbook_preferences'
- setLanguage: updates local state + writes to 
  user_profiles.preferred_language in Supabase
- setUnits: updates local state + writes to 
  user_profiles.preferred_units in Supabase
- loadFromSupabase: reads user_profiles on auth and 
  syncs to local state — called on login

===================================================================
## STEP 4 — Unit conversion utility
===================================================================

Create packages/ui/src/unitConversion.ts:

export type UnitSystem = 'metric' | 'imperial'

Conversion rules:
TEMPERATURE:
- imperial → metric: °F to °C = (F - 32) × 5/9
- metric → imperial: °C to °F = C × 9/5 + 32

WEIGHT:
- oz → g: × 28.3495
- lb → kg: × 0.453592
- g → oz: ÷ 28.3495
- kg → lb: ÷ 0.453592

VOLUME:
- fl oz → ml: × 29.5735
- cup → ml: × 236.588
- tbsp → ml: × 14.7868
- tsp → ml: × 4.92892
- ml → fl oz: ÷ 29.5735
- ml → cup: ÷ 236.588

export function convertIngredient(
  quantity: number,
  unit: string,
  targetSystem: UnitSystem
): { quantity: number; unit: string }
- Converts quantity + unit to target system
- Rounds to sensible precision (no 5.2917 cups)
- If unit has no conversion (e.g. "clove", "bunch") → return unchanged
- Returns formatted quantity: 0.5 → "½", 0.25 → "¼", 0.75 → "¾"

export function formatQuantity(n: number): string
- Converts decimals to fractions for common values
- 0.5 → "½", 0.25 → "¼", 0.333 → "⅓", 0.75 → "¾"
- Others: round to 1 decimal

Export from packages/ui/src/index.ts

===================================================================
## STEP 5 — ChefsBook header component update (mobile)
===================================================================

Update apps/mobile/components/ChefsBookHeader.tsx:

Header row layout (horizontal, space-between):
[ChefsBook logo]          [flag button] [unit toggle]

### Flag button:
- Shows current language flag emoji (24px font size)
- Tappable — opens language picker modal (see Step 6)
- No border, no background — just the flag
- Right of logo, left of unit toggle
- Touch target: 44x44px minimum

### Unit toggle:
- A small pill toggle: [kg] [lb]
  (shows metric units when metric selected, imperial when imperial)
- Active side: accent red background (#ce2b37), white text
- Inactive side: transparent, textMuted color
- Width: 72px total, height: 28px
- Font size: 12px, font weight 600
- On tap: toggles units via preferencesStore.setUnits()
- Shows "kg" for metric, "lb" for imperial as the label

===================================================================
## STEP 6 — Language picker modal (mobile)
===================================================================

Create apps/mobile/components/LanguagePickerModal.tsx:

A bottom sheet modal (use Modal from react-native with 
slide-up animation via Reanimated):

Header:
- "Select Language" title, 16px semibold
- X close button top right

Search bar:
- "Search languages..." placeholder
- Filters the list in real time as user types

Language list (ScrollView):
SECTION 1 — Priority languages (no section header):
  English 🇺🇸, French 🇫🇷, Spanish 🇪🇸
  Subtle divider below

SECTION 2 — All languages (alphabetical):
  All remaining languages from LANGUAGES constant

Each row:
- Flag emoji (28px) on left
- Native name (15px, textPrimary) 
- English name in parentheses (13px, textMuted) if different
- Checkmark (Ionicons "checkmark") on right if currently selected
- Tapping: calls preferencesStore.setLanguage(code), 
  closes modal, shows brief toast "Language updated"
- Active row: accentSoft background (#fdecea)
- Row height: 52px minimum

===================================================================
## STEP 7 — Apply unit conversion throughout mobile
===================================================================

Wherever ingredient quantities are displayed, wrap with 
convertIngredient() using the current unit system from 
preferencesStore:

Files to update:
- apps/mobile/app/recipe/[id].tsx — ingredient list
- apps/mobile/app/(tabs)/shop.tsx — shopping list quantities
- apps/mobile/app/(tabs)/plan.tsx — recipe cards if quantities shown

Pattern:
const { units } = usePreferencesStore()
const { quantity, unit } = convertIngredient(
  ingredient.quantity, 
  ingredient.unit, 
  units
)

Temperatures in recipe steps:
- Scan step text for temperature patterns: /(\d+)°([FC])/g
- Convert to user's preferred system
- Display: "180°C (350°F)" when metric, "350°F (180°C)" when imperial
  — always show both for clarity

===================================================================
## STEP 8 — Web header update
===================================================================

In apps/web/app/dashboard/layout.tsx or the shared header component:

Add to the top-right of the header/navbar (same row as user avatar):
- Flag button: shows current language flag, opens language picker
- Unit toggle: same [kg][lb] pill as mobile

Language picker on web:
- A dropdown/popover (not a modal)
- Same list structure as mobile
- Search input at top
- Priority languages first, then alphabetical
- Clicking outside closes it

Unit toggle on web:
- Same pill style using Trattoria theme colors
- Updates user_profiles via Supabase immediately

===================================================================
## STEP 9 — Persist and sync
===================================================================

On app launch (apps/mobile/app/_layout.tsx):
After auth session is confirmed:
- Call preferencesStore.loadFromSupabase(userId)
- This syncs any preferences set on web to mobile and vice versa

On web login:
- Read user_profiles.preferred_language and preferred_units
- Apply to the session immediately

===================================================================
## RULES
===================================================================
- useTheme().colors always — never hardcode hex
- Unit conversion logic lives ONLY in packages/ui/src/unitConversion.ts
- Language list lives ONLY in packages/ui/src/languages.ts
- Never duplicate these in app code
- Import supabase from @chefsbook/db always
- Fix all errors without stopping
- One adb screenshot per major step to /tmp/cb_screen.png
  Describe in text, delete immediately
- Do not embed screenshots in conversation
- Commit when complete:
  git add -A && git commit -m "feat: language selector + metric/imperial toggle in header"

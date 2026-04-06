# Real Device Bug Fixes — Tab Bar, Voice, Language, Shopping List, Meal Plan
# Save to: docs/prompts/real-device-bug-fixes.md

Read CLAUDE.md, apps/mobile/CLAUDE.md and
.claude/agents/navigator.md to orient yourself.

Fix all real device bugs identified during testing.
Execute in order without stopping.

===================================================================
## FIX 1 — Tab bar labels wrapping on real device
===================================================================

In apps/mobile/components/FloatingTabBar.tsx:

Labels are word-wrapping onto two lines on real devices
(Recipes → "Rec\nipes", Search → "Sea\nrch" etc.)

1. Widen the pill:
   Change: left: 40, right: 40
   To:     left: 16, right: 16

2. Prevent label wrapping on every tab label Text:
   numberOfLines={1}
   adjustsFontSizeToFit={true}
   minimumFontScale={0.8}

3. Reduce label font size: 11px → 10px

4. Reduce icon size if above 22px: reduce to 20px

5. Tighten active pill padding:
   Change: padding 6px 14px
   To:     padding 4px 10px

===================================================================
## FIX 2 — Voice recognition fails on real device
===================================================================

Replace @react-native-voice/voice with expo-speech-recognition.
The null module error cannot be fixed without replacing the package.

Step 1 — Install:
cd apps/mobile
npx expo install expo-speech-recognition

Step 2 — Update apps/mobile/app.json plugins:
"plugins": [
  [
    "expo-speech-recognition",
    {
      "microphonePermission": "Allow ChefsBook to use the microphone to record recipes",
      "speechRecognitionPermission": "Allow ChefsBook to recognize your speech to create recipes"
    }
  ]
]

Step 3 — Rewrite speak.tsx voice logic:

import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition'

const SPEECH_LOCALE_MAP: Record<string, string> = {
  'en': 'en-US', 'fr': 'fr-FR', 'es': 'es-ES',
  'de': 'de-DE', 'it': 'it-IT', 'pt': 'pt-PT',
  'nl': 'nl-NL', 'ja': 'ja-JP', 'ko': 'ko-KR',
  'zh': 'zh-CN', 'ar': 'ar-SA', 'ru': 'ru-RU',
  'pl': 'pl-PL', 'tr': 'tr-TR', 'sv': 'sv-SE',
  'da': 'da-DK', 'fi': 'fi-FI', 'no': 'nb-NO',
  'hi': 'hi-IN', 'th': 'th-TH', 'vi': 'vi-VN',
  'id': 'id-ID', 'ms': 'ms-MY', 'he': 'he-IL',
  'el': 'el-GR', 'hu': 'hu-HU', 'ro': 'ro-RO',
  'uk': 'uk-UA',
}

const { language } = usePreferencesStore()
const speechLocale = SPEECH_LOCALE_MAP[language] ?? 'en-US'

Start recording:
const startRecording = async () => {
  const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync()
  if (!result.granted) {
    setError('Microphone permission required')
    return
  }
  ExpoSpeechRecognitionModule.start({
    lang: speechLocale,
    interimResults: true,
    continuous: true,
  })
}

Stop recording:
ExpoSpeechRecognitionModule.stop()

Event listeners:
useSpeechRecognitionEvent('result', (event) => {
  setTranscript(event.results[0]?.transcript ?? '')
})
useSpeechRecognitionEvent('error', (event) => {
  setError(`Recognition error: ${event.message}`)
})
useSpeechRecognitionEvent('start', () => setIsRecording(true))
useSpeechRecognitionEvent('end', () => setIsRecording(false))

Show language indicator below mic button:
"Listening in [language name]" in 12px textMuted centered

Replace emoji mic with Ionicons:
<Ionicons name="mic" size={52} color="white" />

===================================================================
## FIX 3 — Language change not applying
===================================================================

In apps/mobile/lib/zustand/preferencesStore.ts:

Confirm setLanguage() correctly:
1. Updates zustand state immediately
2. Writes to user_profiles.preferred_language in Supabase
3. Persists to AsyncStorage

In speak.tsx: use speechLocale derived from current language
so switching language immediately affects recognition locale.

Show current language name on speak screen so user can
confirm the change took effect.

===================================================================
## FIX 4 — Missing ingredients when adding recipe to shopping list
===================================================================

In the "Add to Shopping List" function in recipe/[id].tsx:

Add console.log before processing to log raw ingredients.

Common causes to check and fix:
A) Filter removing null quantities:
   Remove any filter like: ingredients.filter(i => i.quantity > 0)
   Replace with: ingredients.filter(i => i !== null && i !== undefined)
   NEVER skip an ingredient due to null quantity or unit

B) Dry ingredient classifier throwing errors silently:
   Wrap convertIngredient() in try/catch — on error use original values

C) Batch insert limit:
   If inserting ingredients one by one or in batches,
   ensure ALL are inserted, not just the first N

Fix rule: NEVER silently drop an ingredient.
If quantity is null → add with blank quantity.
If unit is null → add with no unit.
All ingredients must always be added.

===================================================================
## FIX 5 — "No ingredients" error when adding meal plan day to list
===================================================================

In apps/mobile/app/(tabs)/plan.tsx — "Add to list" function:

The bug: meal plan entries are found but ingredients return empty.

Fix the fetch pipeline:

Step 1 — Fetch meal plan entries for the day:
const { data: entries } = await supabase
  .from('meal_plan_entries')
  .select('recipe_id')
  .eq('plan_date', date)
  .eq('user_id', userId)

Step 2 — Extract recipe IDs:
const recipeIds = entries?.map(e => e.recipe_id).filter(Boolean) ?? []
if (recipeIds.length === 0) {
  Alert.alert('No meals', 'No recipes planned for this day')
  return
}

Step 3 — Fetch full recipe data INCLUDING ingredients:
const { data: recipes } = await supabase
  .from('recipes')
  .select('id, title, ingredients')
  .in('id', recipeIds)

Step 4 — Flatten ingredients:
const allIngredients = recipes?.flatMap(r => 
  (r.ingredients ?? []).map(ing => ({
    ...ing,
    recipe_id: r.id,
    recipe_title: r.title,
  }))
) ?? []

Step 5 — Check for empty after flattening:
if (allIngredients.length === 0) {
  Alert.alert(
    'No ingredients found',
    'The planned recipes exist but have no ingredients stored. ' +
    'Try editing the recipes to add ingredients.'
  )
  return
}

Step 6 — Run mergeIngredientsIntoList(listId, allIngredients, userId)

Apply same fix to "Add week to shopping list" button —
same pipeline, just loops over all days in the week.

Always use authenticated supabase client from @chefsbook/db.
Never use anon client for user data queries.

===================================================================
## FIX 6 — Rebuild required
===================================================================

Fixes 2 (expo-speech-recognition) requires a full native rebuild.
After all code changes:

cd apps/mobile
npx expo run:android

This is mandatory — expo-speech-recognition requires
native compilation to work on real device.

Also install on real device after build completes:
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

===================================================================
## VERIFY ALL FIXES
===================================================================

After rebuild, verify each fix:

1. Tab bar: adb screenshot → confirm all 5 labels on one line
2. Voice: tap mic on speak screen → confirm no null error
3. Language: switch to FR → confirm speak shows "Listening in French"
4. Shopping list: add Baguette recipe → confirm all 4 ingredients appear
5. Meal plan: tap "Add to list" on Monday → confirm list selector opens
   (not "no ingredients" error)

For each: adb exec-out screencap -p > /tmp/cb_screen.png
Describe what you see, delete after.
Do not embed screenshots in conversation.

===================================================================
## RULES
===================================================================
- Fix all errors without stopping
- Do not embed screenshots in conversation
- Use @chefsbook/db always — never createClient() directly
- useTheme().colors always — never hardcode hex
- Commit after all fixes:
  git add -A && git commit -m "fix: real device bugs — tab bar, voice, language, shopping list, meal plan"

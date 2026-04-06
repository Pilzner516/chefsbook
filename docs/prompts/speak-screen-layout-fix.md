# Speak Screen Layout Fix — Transcript Below Mic, Button Pinned Above Nav Bar
# Save to: docs/prompts/speak-screen-layout-fix.md

Read CLAUDE.md, apps/mobile/CLAUDE.md and
.claude/agents/navigator.md to orient yourself.

Fix the speak screen layout in apps/mobile/app/speak.tsx
so the transcript shows directly below the mic button and
everything stays above the Android navigation bar.

## Current broken layout (top to bottom):
- Step indicator
- Instructions
- Example card
- Mic button
- [lots of empty space]
- Transcript [hidden behind Android nav bar]
- Save button [hidden behind Android nav bar]

## Correct layout:
- Step indicator
- Mic button (prominent, centered)
- "Tap to speak / Tap to pause" label
- Language indicator ("Listening in English")
- Transcript box (live, directly below mic, scrollable)
- Extract Recipe button (pinned above nav bar)

===================================================================
## IMPLEMENTATION
===================================================================

### Remove ScrollView as outer container
Replace the full-screen ScrollView with a flex layout:

<SafeAreaView style={{ flex: 1, backgroundColor: colors.bgScreen }}>
  <View style={{ flex: 1, paddingHorizontal: 20 }}>

    {/* Step indicator - compact at top */}
    <StepIndicator ... />

    {/* Instructions - short, one line */}
    <Text style={{ fontSize: 13, color: colors.textMuted,
      textAlign: 'center', marginBottom: 24 }}>
      Speak your recipe naturally — name, ingredients, steps
    </Text>

    {/* Mic button - centered, prominent */}
    <View style={{ alignItems: 'center', marginBottom: 16 }}>
      <TouchableOpacity onPress={toggleRecording} style={{
        width: 100, height: 100, borderRadius: 50,
        backgroundColor: isRecording ? '#a81f2a' : colors.accent,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons
          name={isRecording ? "mic" : "mic-outline"}
          size={48} color="white"
        />
      </TouchableOpacity>

      {/* Status label directly below mic */}
      <Text style={{ fontSize: 14, color: colors.textSecondary,
        marginTop: 10, fontWeight: '600' }}>
        {isRecording ? 'Tap to pause' :
         finalTranscript ? 'Tap to continue' : 'Tap to speak'}
      </Text>

      {/* Language indicator */}
      <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
        {isRecording ? `Listening in ${currentLanguageName}...` : ''}
      </Text>
    </View>

    {/* Transcript box - flex fills remaining space */}
    <View style={{
      flex: 1,
      backgroundColor: 'white',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isRecording ? colors.accent : colors.borderDefault,
      padding: 16,
      marginBottom: 16,
    }}>
      {/* Recording pulse indicator when active */}
      {isRecording && (
        <View style={{ flexDirection: 'row', alignItems: 'center',
          marginBottom: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4,
            backgroundColor: colors.accent, marginRight: 8 }} />
          <Text style={{ fontSize: 11, color: colors.accent }}>
            Recording...
          </Text>
          <View style={{ flex: 1 }} />
          {/* Clear button */}
          <TouchableOpacity onPress={clearTranscript}>
            <Ionicons name="refresh-outline" size={16}
              color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Transcript text - scrollable within the box */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {finalTranscript || interimTranscript ? (
          <Text style={{ fontSize: 15, color: colors.textPrimary,
            lineHeight: 24 }}>
            {finalTranscript}
            {interimTranscript ? (
              <Text style={{ color: colors.textMuted, fontStyle: 'italic' }}>
                {finalTranscript ? ' ' : ''}{interimTranscript}
              </Text>
            ) : null}
          </Text>
        ) : (
          <Text style={{ fontSize: 14, color: colors.textMuted,
            fontStyle: 'italic', textAlign: 'center', marginTop: 20 }}>
            Your recipe will appear here as you speak...
          </Text>
        )}
      </ScrollView>
    </View>

  </View>

  {/* Extract Recipe button — PINNED above Android nav bar */}
  <View style={{
    paddingHorizontal: 20,
    paddingBottom: insets.bottom + 16,
    paddingTop: 12,
    backgroundColor: colors.bgScreen,
    borderTopWidth: 0.5,
    borderTopColor: colors.borderDefault,
  }}>
    <TouchableOpacity
      onPress={handleExtract}
      disabled={!finalTranscript && !interimTranscript}
      style={{
        backgroundColor: finalTranscript || interimTranscript
          ? colors.accent : colors.borderDefault,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
        Extract Recipe
      </Text>
    </TouchableOpacity>
  </View>

</SafeAreaView>

===================================================================
## KEY RULES
===================================================================

- Remove the example card entirely — wastes space the
  transcript needs
- Transcript box uses flex: 1 to fill all available space
- Extract Recipe button is OUTSIDE the flex container,
  pinned at bottom using insets.bottom from useSafeAreaInsets()
- Transcript ScrollView is INSIDE the transcript box,
  not the outer container
- Border of transcript box turns red (colors.accent)
  when recording is active
- Extract Recipe button is disabled (gray) when transcript
  is empty, red when there is content
- useTheme().colors always — never hardcode hex
- Import useSafeAreaInsets from react-native-safe-area-context

===================================================================
## TRANSCRIPT ACCUMULATION (confirm still working)
===================================================================

Confirm these two state variables are in place:
const [finalTranscript, setFinalTranscript] = useState('')
const [interimTranscript, setInterimTranscript] = useState('')

useSpeechRecognitionEvent('result', (event) => {
  const result = event.results[0]
  if (!result) return
  if (event.isFinal || result.isFinal) {
    setFinalTranscript(prev => {
      const separator = prev.length > 0 ? ' ' : ''
      return prev + separator + result.transcript
    })
    setInterimTranscript('')
  } else {
    setInterimTranscript(result.transcript)
  }
})

useSpeechRecognitionEvent('end', () => {
  setIsRecording(false)
  if (interimTranscript) {
    setFinalTranscript(prev => {
      const separator = prev.length > 0 ? ' ' : ''
      return prev + separator + interimTranscript
    })
    setInterimTranscript('')
  }
})

clearTranscript function:
const clearTranscript = () => {
  Alert.alert('Clear recording?', 'This will erase everything spoken so far.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => {
        setFinalTranscript('')
        setInterimTranscript('')
      }}
    ]
  )
}

Pass full transcript to extraction:
const fullText = finalTranscript +
  (interimTranscript ? ' ' + interimTranscript : '')

===================================================================
## VERIFY
===================================================================

adb screenshot to /tmp/cb_screen.png:
1. Speak screen idle — confirm mic centered,
   empty transcript box visible directly below
2. Simulate recording — confirm transcript box has
   correct border color and recording indicator
3. Confirm Extract Recipe button fully visible above
   Android nav bar — not hidden behind it
Describe each, delete /tmp/cb_screen.png after each.

Fix all errors without stopping.
Do not embed screenshots in conversation.
Commit: git add -A && git commit -m "fix: speak screen layout — transcript below mic, extract button pinned above nav bar"

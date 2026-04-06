# QA Notepad — Hidden Testing Tool
# Save to: docs/prompts/qa-notepad.md

Read CLAUDE.md, apps/mobile/CLAUDE.md and
.claude/agents/navigator.md to orient yourself.

Add a hidden QA notepad to the ChefsBook app for bug and 
feature logging during testing. This is temporary and should
be easy to remove later.

## Step 1 — Tap handler on logo
In apps/mobile/components/ChefsBookHeader.tsx:

Wrap the ChefsBook logo text in a TouchableOpacity.
On press: open the QA notepad modal.
No visual change to the logo — tap is invisible to normal users.

## Step 2 — QA Notepad Modal
Create apps/mobile/components/QANotepad.tsx:

A full-screen modal (slide up from bottom):

HEADER:
- Title: "QA Notepad" in 18px semibold textPrimary
- Subtitle: "Tap + to log a bug or feature request" in 12px textMuted
- X close button top right

LIST:
- Numbered list of all logged items
- Each row:
  - Number on left (14px textMuted)
  - Item text (14px textPrimary, wraps to multiple lines)
  - Small X button on right (Ionicons "close-circle-outline", 
    colors.textMuted)
  - X tapping shows confirmation alert:
    "Delete this item?" [Cancel] [Delete]
  - On confirm: remove item from list

EMPTY STATE:
- "No items logged yet" centered in textMuted
- "Tap + Add to log your first item" below

FOOTER:
- Full width "+ Add Item" button in accent red
- Tapping opens a small Alert.prompt() or inline input:
  - Title: "Log Item"
  - Placeholder: "Describe the bug or feature..."
  - Two buttons: Cancel | Add
  - On Add: prepend item to top of list with timestamp

## Step 3 — Storage
Use AsyncStorage to persist items across app restarts:
Key: 'qa_notepad_items'

Each item shape:
{
  id: string (uuid or timestamp)
  text: string
  type: 'bug' | 'feature' | 'note'  (default 'note' for now)
  createdAt: string (ISO date)
}

On modal open: load from AsyncStorage
On any change: save to AsyncStorage immediately

## Step 4 — ADB export command
Add to apps/mobile/CLAUDE.md under "## QA Notepad":

### Export QA items via adb:
adb shell run-as com.chefsbook.app cat \
  /data/data/com.chefsbook.app/files/qa_notepad.json

### Clear all QA items via adb:
adb shell run-as com.chefsbook.app \
  sh -c 'echo "[]" > /data/data/com.chefsbook.app/files/qa_notepad.json'

Also save items to a JSON file (in addition to AsyncStorage)
so adb can read it directly:
Path: /data/data/com.chefsbook.app/files/qa_notepad.json

Use expo-file-system to write this file on every change:
import * as FileSystem from 'expo-file-system'
const QA_FILE = FileSystem.documentDirectory + 'qa_notepad.json'

On every add/delete: write full items array to QA_FILE as JSON.

## Step 5 — Export button in modal
Add a small "Export" button in the modal header (top left):
- Ionicons "share-outline" icon, textMuted color
- Tapping: formats all items as a numbered text list
- Shares via expo-sharing or copies to clipboard:
  "ChefsBook QA Report — [date]\n\n1. [item]\n2. [item]..."
- User can paste directly into Claude

## Step 6 — Clear all
In the modal header next to Export:
- Small "Clear all" text button in colors.textMuted
- Tapping shows confirmation: 
  "Clear all X items? This cannot be undone."
  [Cancel] [Clear All]
- On confirm: empties AsyncStorage + JSON file

## Step 7 — Document adb commands in CLAUDE.md
Add this section to apps/mobile/CLAUDE.md:

## QA Notepad (temp testing tool)
Triggered by tapping the ChefsBook logo in the header.
Remove QANotepad.tsx and the logo tap handler when done testing.

### Export QA report via adb (paste into Claude):
adb shell run-as com.chefsbook.app cat \
  /data/data/com.chefsbook.app/files/qa_notepad.json

### Clear all QA items via adb:
adb shell run-as com.chefsbook.app \
  sh -c 'echo "[]" > /data/data/com.chefsbook.app/files/qa_notepad.json'

### Read via Claude Code:
From the chefsbook project root run:
adb shell run-as com.chefsbook.app cat \
  /data/data/com.chefsbook.app/files/qa_notepad.json | \
  python -m json.tool

## Rules
- This feature is self-contained in QANotepad.tsx
- No impact on any other feature
- useTheme().colors always — never hardcode hex
- Fix errors without stopping
- Do not embed screenshots in conversation
- Commit: git add -A && git commit -m "feat: QA notepad (temp testing tool, logo tap trigger)"

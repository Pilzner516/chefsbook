# ChefsBook — Session 113: Print + PDF Options Popup
# Item 2: options to exclude comments and/or images before print/PDF
# Target: apps/web

---

## CONTEXT

Read CLAUDE.md, DONE.md, feature-registry.md, ui-guardian.md, and ALL
mandatory agents per SESSION START sequence before touching anything.

Before printing or generating a PDF, show the user a small options
popup so they can choose what to include.

---

## FEATURE — Print Options Popup

### Trigger

Currently "Print" opens the browser print dialog immediately.
Change this: clicking Print opens a ChefsDialog options modal first.

### Print options modal

```
┌─────────────────────────────┐
│  Print Options              │
│                             │
│  ☑ Include recipe image     │
│  ☑ Include comments         │
│                             │
│  [Cancel]    [Print]        │
└─────────────────────────────┘
```

- Both toggles default to ON (checked)
- "Print" button applies the selected options then opens browser print
- "Cancel" closes modal without printing

### Implementation

Use CSS classes to show/hide sections before triggering window.print():
- If "Include recipe image" is unchecked: add a class to the hero image
  container that sets display:none in @media print
- If "Include comments" is unchecked: add a class to the comments section
  that sets display:none in @media print
- After setting classes, call window.print()
- After print dialog closes (window.onafterprint): remove the classes
  to restore normal view

No AI calls. No server requests. Pure CSS + JS.

---

## FEATURE — PDF Options Popup

### Trigger

Currently "Download PDF" either downloads immediately or shows a loading
state. Add an options modal before generating.

### PDF options modal

```
┌─────────────────────────────┐
│  PDF Options                │
│                             │
│  ☑ Include recipe image     │
│  ☑ Include comments         │
│                             │
│  [Cancel]    [Generate PDF] │
└─────────────────────────────┘
```

- Both toggles default to ON
- "Generate PDF" passes options to the PDF generation API route

### Implementation

Pass options as query params to /recipe/[id]/pdf:
- ?includeImage=true&includeComments=true

Update the PDF route (apps/web/app/recipe/[id]/pdf/route.ts):
- Read includeImage and includeComments from query params
- If includeImage = false: skip the hero image in the PDF layout
- If includeComments = false: skip the comments section in the PDF layout

The @react-pdf/renderer layout already exists — conditionally render
the image and comments sections based on the params.

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
rm -rf node_modules/react node_modules/react-dom .next
NODE_OPTIONS=--max-old-space-size=1024 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

Only restart PM2 if build exits with code 0.

---

## COMPLETION CHECKLIST

- [ ] Clicking Print opens options modal (not browser dialog directly)
- [ ] Print modal: Include image toggle + Include comments toggle
- [ ] Print with image excluded: image hidden in printed output
- [ ] Print with comments excluded: comments hidden in printed output
- [ ] Classes removed after print — normal view restored
- [ ] Clicking Download PDF opens options modal first
- [ ] PDF modal: same two toggles
- [ ] PDF generated without image when unchecked
- [ ] PDF generated without comments when unchecked
- [ ] Options use ChefsDialog (not native dialog)
- [ ] No AI calls — pure client-side for print, query params for PDF
- [ ] tsc --noEmit passes
- [ ] Deployed to RPi5
- [ ] Run /wrapup
- [ ] At the end of the session, recap exactly what was completed from
      this prompt, what was left incomplete, and why.

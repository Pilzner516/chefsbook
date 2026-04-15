# ChefsBook — Session 51: Fix PDF Download Unauthorized Error
# Source: QA review 2026-04-10
# Target: apps/web

---

## CONTEXT

Clicking "Download PDF" on a recipe returns `{"error":"Unauthorized"}` on a black
screen. The PDF route correctly requires a Pro plan session, but the download
trigger is not sending the auth token with the request.

This is a one-file fix. Read nothing except this prompt — it is self-contained.

---

## ROOT CAUSE

The PDF download is almost certainly triggered as a plain `<a href="/recipe/[id]/pdf">`
link or `window.open()` — neither of which sends the Supabase session token.
The server sees an unauthenticated request and returns 401.

---

## FIX

Find the PDF download trigger in the Share dropdown component on the web recipe
detail page. Replace it with a fetch-based download that attaches the auth token:

```ts
async function downloadPdf(recipeId: string, recipeTitle: string) {
  try {
    setDownloadingPdf(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      showError('Please sign in to download PDFs.');
      return;
    }

    const response = await fetch(`/recipe/${recipeId}/pdf`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      if (response.status === 403) {
        showUpgradePrompt(); // Pro plan required
      } else {
        showError('PDF generation failed. Please try again.');
      }
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ChefsBook - ${recipeTitle}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

  } catch (err) {
    showError('PDF generation failed. Please try again.');
  } finally {
    setDownloadingPdf(false);
  }
}
```

Show a loading state while the PDF generates (it takes 1-3 seconds):
- Change the "Download PDF" button to show a spinner + "Generating..." while
  `downloadingPdf` is true
- Use the existing `ChefsDialog` for any error messages

---

## ALSO CHECK

While fixing this, also verify the PDF route itself is correctly reading the
auth token from the `Authorization` header (not just cookies):

```ts
// In /recipe/[id]/pdf/route.ts:
const authHeader = request.headers.get('Authorization');
const token = authHeader?.replace('Bearer ', '');

const { data: { user }, error } = await supabase.auth.getUser(token);
if (error || !user) {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
```

If the route is using `getSession()` from cookies only, it will fail for
fetch requests. Switch to `getUser(token)` with the bearer token.

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

Test: click Download PDF on a recipe as a Pro user → PDF downloads with correct
filename. Test as a Free user → upgrade prompt shown (not a black error screen).

---

## COMPLETION CHECKLIST

- [ ] PDF download uses fetch with Authorization header (not <a href> or window.open)
- [ ] PDF route reads auth from Authorization header (not cookies only)
- [ ] Loading state shown while PDF generates
- [ ] Pro user: PDF downloads correctly with filename "ChefsBook - [title].pdf"
- [ ] Free user: upgrade prompt shown via ChefsDialog (not black error screen)
- [ ] Deployed to RPi5 and tested live
- [ ] Run /wrapup to update DONE.md and CLAUDE.md

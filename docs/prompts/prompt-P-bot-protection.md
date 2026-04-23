# Prompt P — Bot Protection: Cloudflare Turnstile + Honeypot + Disposable Email Check
## Scope: apps/web (signup form, auth API), apps/mobile (bypass only)

---

## AGENTS TO READ FIRST (in order)
1. `.claude/agents/wrapup.md`
2. `CLAUDE.md`
3. `DONE.md`
4. `.claude/agents/testing.md`
5. `.claude/agents/feature-registry.md`
6. `.claude/agents/deployment.md`
7. `.claude/agents/ui-guardian.md`

Run ALL pre-flight checklists before writing a single line of code.
Read the existing signup/auth form fully before touching anything:
`apps/web/app/auth/page.tsx` (or wherever signup is handled)

---

## CONTEXT

ChefsBook needs bot protection on the signup flow to prevent:
- Fake account creation at scale
- Spam content from bot accounts
- Brute force login attempts

Three layers are being added:
1. Cloudflare Turnstile — invisible CAPTCHA on signup
2. Honeypot field — hidden field bots fill in, humans don't
3. Disposable email check — reject known throwaway email domains

---

## ENVIRONMENT VARIABLES NEEDED

Add to `.env.local` on RPi5 (do NOT commit these):
```
NEXT_PUBLIC_TURNSTILE_SITE_KEY=     # from Cloudflare dashboard
TURNSTILE_SECRET_KEY=               # from Cloudflare dashboard
```

**IMPORTANT FOR AGENT:** The admin (Bob) must create a Turnstile widget
in the Cloudflare dashboard before this can be tested end-to-end.
Steps:
1. Go to Cloudflare dashboard → Turnstile → Add widget
2. Widget type: **Managed** (invisible, non-intrusive)
3. Domain: chefsbk.app
4. Copy Site Key → NEXT_PUBLIC_TURNSTILE_SITE_KEY
5. Copy Secret Key → TURNSTILE_SECRET_KEY

**For development/testing bypass:** Also create a second widget with
domain `localhost` OR use Cloudflare's official test keys:
- Test site key: `1x00000000000000000000AA` (always passes)
- Test secret key: `1x0000000000000000000000000000000AA` (always passes)

Set these test keys in the emulator/dev environment so agents and
testers are never blocked during development.

Add to `apps/web/.env.local` on dev machine:
```
# Use test keys for local development — never blocks
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

On RPi5 production, use the real keys.

---

## FEATURE 1 — Cloudflare Turnstile on signup

### Install the package
```bash
cd apps/web && npm install @marsidev/react-turnstile
```

### Client-side (signup form)
Add the Turnstile widget to the signup form in
`apps/web/app/auth/page.tsx`:

```tsx
import { Turnstile } from '@marsidev/react-turnstile'

// In signup form state:
const [turnstileToken, setTurnstileToken] = useState<string>('')

// In the form JSX, before the submit button:
<Turnstile
  siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
  onSuccess={(token) => setTurnstileToken(token)}
  onError={() => setTurnstileToken('')}
  onExpire={() => setTurnstileToken('')}
/>
```

Disable the signup submit button if `turnstileToken` is empty.
Add a subtle message below the button if token is empty:
*"Verifying you're human..."*

### Server-side verification
In the signup API handler (wherever the Supabase `signUp` call is made),
verify the token before creating the account:

```typescript
async function verifyTurnstile(token: string): Promise<boolean> {
  if (!token) return false;
  
  const response = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: token,
      }),
    }
  );
  const data = await response.json();
  return data.success === true;
}
```

If verification fails: return HTTP 400 with error
*"Verification failed. Please try again."*
Do NOT call `supabase.auth.signUp()` if Turnstile fails.

### Turnstile on login too
Add the same Turnstile widget to the LOGIN form as well, with the
same server-side verification before calling `supabase.auth.signInWithPassword()`.
This prevents brute force login attempts.

---

## FEATURE 2 — Honeypot field

### How it works
Add a hidden field to the signup form that real users never see or fill.
Bots that auto-fill forms will populate it. If it has any value on
submission, silently reject the signup without telling the bot why.

### Implementation
In the signup form:

```tsx
// Hidden from real users via CSS — NOT display:none (bots detect that)
// Use position:absolute, opacity:0, height:0, overflow:hidden
const [honeypot, setHoneypot] = useState('')

<div style={{
  position: 'absolute',
  opacity: 0,
  height: 0,
  overflow: 'hidden',
  pointerEvents: 'none'
}} aria-hidden="true">
  <input
    type="text"
    name="website"
    tabIndex={-1}
    autoComplete="off"
    value={honeypot}
    onChange={(e) => setHoneypot(e.target.value)}
  />
</div>
```

In the submit handler, before any API call:
```typescript
if (honeypot.length > 0) {
  // Bot detected — silently "succeed" without creating account
  // Show fake success message to not tip off the bot
  setView('check-email'); // or whatever the post-signup state is
  return;
}
```

Silent failure — never tell the bot it was blocked.

---

## FEATURE 3 — Disposable email check

### How it works
Check the signup email domain against a list of known disposable/
throwaway email providers. Reject with a user-friendly message.

### Implementation
Create `apps/web/lib/disposableEmails.ts`:

```typescript
// Common disposable email domains — extend as needed
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'temp-mail.org',
  'throwaway.email', 'yopmail.com', 'sharklasers.com',
  'guerrillamailblock.com', 'grr.la', 'guerrillamail.info',
  'spam4.me', 'trashmail.com', 'trashmail.me', 'trashmail.net',
  'dispostable.com', 'maildrop.cc', 'spamgourmet.com',
  'getairmail.com', 'filzmail.com', 'throwam.com',
  'tempinbox.com', 'spambox.us', 'binkmail.com',
  'bobmail.info', 'dayrep.com', 'discard.email',
  'discardmail.com', 'fakeinbox.com', 'filzmail.com',
  'fleckens.hu', 'getonemail.com', 'gowikibooks.com',
  'incognitomail.com', 'mailnull.com', 'mailslite.com',
  'spamfree24.org', 'spamgob.com', 'superrito.com',
  'tempr.email', 'trbvm.com', 'wegwerfmail.de',
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.has(domain);
}
```

In the signup submit handler, before Turnstile check:
```typescript
if (isDisposableEmail(email)) {
  setError('Please use a permanent email address to sign up.');
  return;
}
```

This check is client-side only (fast, no API call). The Turnstile
server-side check provides the real security layer.

---

## TESTING BYPASS FOR AGENTS AND DEVELOPERS

### Web (localhost / dev)
The Cloudflare test keys always pass:
- `1x00000000000000000000AA` — site key (always passes)
- `1x0000000000000000000000000000000AA` — secret key (always passes)

Set these in `.env.local` on the dev machine. The Turnstile widget
renders and calls onSuccess immediately with a test token.
Agents running tests locally will never be blocked.

### Mobile emulator (ADB)
The mobile app does not use the web signup form — it has its own
native auth screens. Turnstile is web-only.
No changes needed to `apps/mobile`.

### CI/test environments
If any automated tests hit the signup endpoint, they should pass
`TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA` in the
test environment — the verification function will always return true.

---

## IMPLEMENTATION ORDER
1. Install `@marsidev/react-turnstile` in apps/web
2. Feature 3 — disposable email check (no dependencies, do first)
3. Feature 2 — honeypot field
4. Feature 1 — Turnstile on signup form (client-side)
5. Feature 1 — Turnstile server-side verification on signup API
6. Feature 1 — Turnstile on login form
7. Add test keys to `.env.local` on dev machine
8. Add production key placeholders to `.env.local` on RPi5
   (with comment: "Replace with real Cloudflare Turnstile keys")
9. TypeScript check: `cd apps/web && npx tsc --noEmit` — must be clean
10. Deploy per `deployment.md`

---

## GUARDRAILS
- NEVER commit real Turnstile keys to git — .env.local is gitignored ✓
- The honeypot div must use CSS hiding, NOT `display:none` or `hidden`
  attribute — bots detect those
- Honeypot silent failure must look identical to real success to the bot
- Turnstile widget must not block the form from rendering if the
  NEXT_PUBLIC_TURNSTILE_SITE_KEY env var is missing — wrap in
  conditional: `{siteKey && <Turnstile siteKey={siteKey} ... />}`
- Do NOT add Turnstile to any API routes other than signup and login
- Mobile app is unaffected — web only

---

## IMPORTANT NOTE FOR AGENT
The real Turnstile site key and secret key must be obtained by the
admin (Bob) from the Cloudflare dashboard after this session deploys.
Document clearly in DONE.md:
1. Where to get the keys (Cloudflare → Turnstile → Add widget)
2. Where to add them on RPi5 (`/mnt/chefsbook/repo/apps/web/.env.local`)
3. That pm2 restart is required after adding the keys

---

## REGRESSION CHECKS — MANDATORY
1. Signup form renders without errors ✓
2. Turnstile widget appears on signup form ✓
3. Disposable email (mailinator.com) shows error message ✓
4. Normal email proceeds past disposable check ✓
5. Login form has Turnstile widget ✓
6. With test keys: signup completes successfully ✓
7. Honeypot filled: silent fake success, no account created ✓
8. My Recipes page still works ✓
9. Recipe detail page still works ✓
10. Existing logged-in sessions unaffected ✓

---

## WRAPUP REQUIREMENT
DONE.md entry must include:
- Confirmation test keys are set in dev .env.local
- Confirmation production .env.local has placeholder with instructions
- Steps for Bob to get real Cloudflare keys (clear instructions)
- All 10 regression checks confirmed
- tsc clean + deploy confirmed

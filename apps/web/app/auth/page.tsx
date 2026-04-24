'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Turnstile } from '@marsidev/react-turnstile';
import { supabase, checkUsernameAvailable, setUsername, applyPromoCode } from '@chefsbook/db';
import { isUsernameFamilyFriendly } from '@chefsbook/ai';
import { isDisposableEmail } from '@/lib/disposableEmails';
import Link from 'next/link';

type Mode = 'login' | 'signup' | 'forgot';
type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'short';
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsernameVal] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [promoCode, setPromoCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [honeypot, setHoneypot] = useState('');

  const handleUsernameChange = (text: string) => {
    const lower = text.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsernameVal(lower);
    if (checkTimer.current) clearTimeout(checkTimer.current);
    if (!lower) { setUsernameStatus('idle'); return; }
    if (lower.length < 3) { setUsernameStatus('short'); return; }
    if (!USERNAME_RE.test(lower)) { setUsernameStatus('invalid'); return; }
    setUsernameStatus('checking');
    checkTimer.current = setTimeout(async () => {
      const available = await checkUsernameAvailable(lower);
      setUsernameStatus(available ? 'available' : 'taken');
    }, 500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    // Honeypot check — silently fail if filled
    if (honeypot.length > 0) {
      // Bot detected — fake success without creating account
      setMessage('Account created! Check your email to confirm, then sign in.');
      setMode('login');
      setLoading(false);
      return;
    }

    // Disposable email check (signup only)
    if (mode === 'signup' && isDisposableEmail(email)) {
      setError('Please use a permanent email address to sign up.');
      setLoading(false);
      return;
    }

    // Turnstile verification
    if (!turnstileToken) {
      setError('Please complete the verification challenge.');
      setLoading(false);
      return;
    }

    // Verify Turnstile token server-side
    try {
      const verifyRes = await fetch('/api/auth/verify-turnstile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: turnstileToken }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyData.success) {
        setError('Verification failed. Please try again.');
        setTurnstileToken(''); // Reset token to force re-verification
        setLoading(false);
        return;
      }
    } catch (err) {
      setError('Verification failed. Please try again.');
      setLoading(false);
      return;
    }

    if (mode === 'signup') {
      if (usernameStatus !== 'available') {
        setError('Please choose a valid, available username.');
        setLoading(false);
        return;
      }
      // Family-friendly check
      const friendly = await isUsernameFamilyFriendly(username);
      if (!friendly) {
        setError("Please choose a different username — this one isn't allowed on ChefsBook");
        setLoading(false);
        return;
      }
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signUpError) {
        setError(signUpError.message);
      } else {
        // Set username after signup trigger creates the profile row
        if (signUpData?.user?.id && username) {
          await new Promise((r) => setTimeout(r, 1000));
          try { await setUsername(signUpData.user.id, username); } catch {}
        }
        // Apply promo code if provided
        if (signUpData?.user?.id && promoCode.trim()) {
          try { await applyPromoCode(signUpData.user.id, promoCode.trim()); } catch {}
        }
        setMessage('Account created! Check your email to confirm, then sign in.');
        setMode('login');
      }
    } else {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
      } else {
        // Increment login count
        if (signInData?.session?.access_token) {
          fetch('/api/auth/login-success', {
            method: 'POST',
            headers: { Authorization: `Bearer ${signInData.session.access_token}` },
          }).catch(() => {});
        }
        router.push('/dashboard');
      }
    }

    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://chefsbk.app/auth/reset',
      });
      if (resetError) throw resetError;
      setMessage('Check your email for a password reset link.');
    } catch (e: any) {
      setError(e.message ?? 'Failed to send reset email');
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold">
            <span className="text-cb-primary">Chefs</span>book
          </Link>
          <p className="text-cb-secondary text-sm mt-2">
            {mode === 'forgot' ? 'Reset your password' : mode === 'login' ? 'Sign in to your account' : 'Create your account'}
          </p>
        </div>

        <div className="bg-cb-card border border-cb-border rounded-card p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-cb-primary rounded-input p-3 mb-4 text-sm">
              {error}
            </div>
          )}
          {message && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-input p-3 mb-4 text-sm">
              {message}
            </div>
          )}

          {mode === 'forgot' ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium mb-1">Email</label>
                <input
                  id="reset-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-cb-bg border border-cb-border rounded-input px-4 py-3 text-sm placeholder:text-cb-secondary/60 outline-none focus:border-cb-primary transition-colors"
                />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-cb-primary text-white py-3 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
              <div className="text-center">
                <button type="button" onClick={() => { setMode('login'); setError(''); setMessage(''); }} className="text-cb-primary text-sm font-medium hover:underline">
                  Back to sign in
                </button>
              </div>
            </form>
          ) : (
          <>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label htmlFor="username" className="block text-sm font-medium mb-1">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  placeholder="e.g. homechef42"
                  className="w-full bg-cb-bg border border-cb-border rounded-input px-4 py-3 text-sm placeholder:text-cb-secondary/60 outline-none focus:border-cb-primary transition-colors"
                />
                <div className="mt-1 text-xs min-h-[16px]">
                  {usernameStatus === 'checking' && <span className="text-cb-muted">Checking...</span>}
                  {usernameStatus === 'available' && <span className="text-green-600">&#10003; Available</span>}
                  {usernameStatus === 'taken' && <span className="text-cb-primary">&#10007; Already taken</span>}
                  {usernameStatus === 'short' && <span className="text-cb-muted">3-20 characters required</span>}
                  {usernameStatus === 'invalid' && <span className="text-cb-primary">Lowercase letters, numbers, underscores only</span>}
                </div>
                <p className="text-[11px] text-cb-muted">Choose carefully — this cannot be changed later</p>
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-cb-bg border border-cb-border rounded-input px-4 py-3 text-sm placeholder:text-cb-secondary/60 outline-none focus:border-cb-primary transition-colors"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full bg-cb-bg border border-cb-border rounded-input px-4 py-3 text-sm placeholder:text-cb-secondary/60 outline-none focus:border-cb-primary transition-colors"
              />
              {mode === 'login' && (
                <button type="button" onClick={() => { setMode('forgot'); setError(''); setMessage(''); }} className="text-xs text-cb-primary hover:underline mt-1">
                  Forgot password?
                </button>
              )}
            </div>
            {mode === 'signup' && (
              <div>
                <label htmlFor="promo" className="block text-sm font-medium mb-1">
                  Promo code (optional)
                </label>
                <input
                  id="promo"
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="e.g. disco20"
                  className="w-full bg-cb-bg border border-cb-border rounded-input px-4 py-3 text-sm placeholder:text-cb-secondary/60 outline-none focus:border-cb-primary transition-colors"
                />
              </div>
            )}

            {/* Honeypot field — hidden from real users */}
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

            {/* Cloudflare Turnstile */}
            {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
              <div className="flex flex-col items-center">
                <Turnstile
                  siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                  onSuccess={(token) => setTurnstileToken(token)}
                  onError={() => setTurnstileToken('')}
                  onExpire={() => setTurnstileToken('')}
                />
                {!turnstileToken && (
                  <p className="text-xs text-cb-muted mt-2">Verifying you&apos;re human...</p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (!turnstileToken && !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)}
              className="w-full bg-cb-primary text-white py-3 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading
                ? mode === 'login'
                  ? 'Signing in...'
                  : 'Creating account...'
                : mode === 'login'
                ? 'Sign in'
                : 'Create account'}
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-cb-secondary">
            {mode === 'login' ? (
              <>
                Don&apos;t have an account?{' '}
                <button
                  onClick={() => { setMode('signup'); setError(''); }}
                  className="text-cb-primary font-medium hover:underline"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => { setMode('login'); setError(''); }}
                  className="text-cb-primary font-medium hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
          </>
          )}
        </div>
      </div>
    </main>
  );
}

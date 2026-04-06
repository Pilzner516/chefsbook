'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@chefsbook/db';
import Link from 'next/link';

type Mode = 'login' | 'signup';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('a@aol.com');
  const [password, setPassword] = useState('123456');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (mode === 'signup') {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signUpError) {
        setError(signUpError.message);
      } else {
        setMessage('Account created! Check your email to confirm, then sign in.');
        setMode('login');
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
      } else {
        router.push('/dashboard');
      }
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
            {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
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

          <form onSubmit={handleSubmit} className="space-y-4">
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
            </div>
            <button
              type="submit"
              disabled={loading}
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
        </div>
      </div>
    </main>
  );
}

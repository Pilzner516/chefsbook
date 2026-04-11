'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@chefsbook/db';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase JS client automatically picks up the token from the URL hash
    // and establishes the session via onAuthStateChange
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });
    // Also check if there's already a session (token already processed)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setSuccess(true);
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (e: any) {
      setError(e.message ?? 'Failed to update password');
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-cb-bg">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold">
            <span className="text-cb-primary">Chefs</span>book
          </Link>
          <p className="text-cb-secondary text-sm mt-2">Set your new password</p>
        </div>

        <div className="bg-cb-card border border-cb-border rounded-card p-6">
          {success ? (
            <div className="text-center">
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-input p-3 mb-4 text-sm">
                Password updated! Redirecting to dashboard...
              </div>
            </div>
          ) : !ready ? (
            <div className="text-center text-cb-secondary text-sm py-4">
              <p>Processing your reset link...</p>
              <p className="text-xs mt-2 text-cb-muted">If this takes too long, the link may have expired. <button onClick={() => router.push('/auth')} className="text-cb-primary hover:underline">Request a new one</button></p>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-50 border border-red-200 text-cb-primary rounded-input p-3 mb-4 text-sm">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="new-password" className="block text-sm font-medium mb-1">New Password</label>
                  <input
                    id="new-password"
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full bg-cb-bg border border-cb-border rounded-input px-4 py-3 text-sm placeholder:text-cb-secondary/60 outline-none focus:border-cb-primary transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="confirm-password" className="block text-sm font-medium mb-1">Confirm Password</label>
                  <input
                    id="confirm-password"
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your new password"
                    className="w-full bg-cb-bg border border-cb-border rounded-input px-4 py-3 text-sm placeholder:text-cb-secondary/60 outline-none focus:border-cb-primary transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-cb-primary text-white py-3 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Update password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { supabase, logAiCallFromClient } from '@chefsbook/db';
import { moderateProfile } from '@chefsbook/ai';
import { proxyIfNeeded } from '@/lib/recipeImage';
import ImportActivityCard from '@/components/ImportActivityCard';
import { useConfirmDialog } from '@/components/useConfirmDialog';

export default function SettingsPage() {
  const [confirm, ConfirmDialog] = useConfirmDialog();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [email, setEmail] = useState('');
  const [planTier, setPlanTier] = useState('free');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState('');
  const [onboardingEnabled, setOnboardingEnabled] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? '');
      const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
      if (profile) {
        setDisplayName(profile.display_name ?? '');
        setUsername(profile.username ?? '');
        setBio(profile.bio ?? '');
        setLocation(profile.location ?? '');
        setInstagramUrl(profile.instagram_url ?? '');
        setWebsiteUrl(profile.website_url ?? '');
        setPlanTier(profile.plan_tier ?? 'free');
        setAvatarUrl(profile.avatar_url);
        setOnboardingEnabled(profile.onboarding_enabled ?? true);
      }
    })();
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    setMessage('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      // Store previous values for potential revert
      const prevDisplayName = displayName;
      const prevBio = bio;

      const { error } = await supabase.from('user_profiles').update({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        location: location.trim() || null,
        instagram_url: instagramUrl.trim() || null,
        website_url: websiteUrl.trim() || null,
      }).eq('id', user.id);
      if (error) throw error;
      setMessage('Saved');
      setTimeout(() => setMessage(''), 2000);

      // Non-blocking profile moderation (fire-and-forget)
      (async () => {
        try {
          const result = await moderateProfile({
            bio: bio.trim() || undefined,
            display_name: displayName.trim() || undefined,
          });

          await logAiCallFromClient({
            userId: user.id,
            action: 'moderate_profile',
            model: 'haiku',
            tokensIn: 100,
            tokensOut: 50,
            success: true,
          });

          if (result.verdict === 'flagged') {
            // Revert flagged fields
            const revertUpdates: any = {};
            if (result.flaggedFields.includes('bio')) {
              revertUpdates.bio = prevBio.trim() || null;
              setBio(prevBio);
            }
            if (result.flaggedFields.includes('display_name')) {
              revertUpdates.display_name = prevDisplayName.trim() || null;
              setDisplayName(prevDisplayName);
            }

            if (Object.keys(revertUpdates).length > 0) {
              await supabase.from('user_profiles').update(revertUpdates).eq('id', user.id);
              setMessage("Your profile update was removed — it doesn't meet our community guidelines.");
              setTimeout(() => setMessage(''), 4000);
            }
          }
        } catch {
          // Moderation unavailable (CORS) or error — changes stay
        }
      })();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const path = `${user.id}/avatar.${file.name.split('.').pop() ?? 'jpg'}`;
      await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      await supabase.from('user_profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      setAvatarUrl(publicUrl);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-8">Settings</h1>

      {message && (
        <div className={`rounded-input p-3 mb-6 text-sm ${message === 'Saved' ? 'bg-cb-green/10 text-cb-green' : 'bg-red-50 text-cb-primary'}`}>{message}</div>
      )}

      {/* Account */}
      <section className="mb-10">
        <h2 className="text-lg font-bold mb-4 pb-2 border-b border-cb-border">Account</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-4 mb-4">
            <label className="cursor-pointer">
              {avatarUrl ? (
                <img src={proxyIfNeeded(avatarUrl)} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-cb-border" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-cb-primary/20 flex items-center justify-center text-xl font-bold text-cb-primary">
                  {displayName?.charAt(0)?.toUpperCase() || email?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }} />
            </label>
            <div>
              <p className="text-sm font-medium">{uploading ? 'Uploading...' : 'Click avatar to change photo'}</p>
              <p className="text-xs text-cb-secondary">Stored in Supabase avatars bucket</p>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-cb-secondary block mb-1">Display Name</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2 text-sm outline-none focus:border-cb-primary" />
            <p className="text-xs text-cb-muted mt-1">Your name as shown to others. Can be changed anytime.</p>
          </div>
          <div>
            <label className="text-sm font-medium text-cb-secondary block mb-1">Username 🔒</label>
            <div className="flex items-center">
              <span className="text-sm text-cb-secondary mr-1">@</span>
              <input value={username} disabled className="flex-1 bg-cb-bg border border-cb-border rounded-input px-3 py-2 text-sm text-cb-secondary cursor-not-allowed" />
            </div>
            <p className="text-xs text-cb-muted mt-1">Your unique @handle used in recipe credits and search. Cannot be changed.</p>
          </div>
          <div>
            <label className="text-sm font-medium text-cb-secondary block mb-1">Email</label>
            <input value={email} disabled className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2 text-sm text-cb-secondary" />
          </div>
        </div>
      </section>

      {/* Profile */}
      <section className="mb-10">
        <h2 className="text-lg font-bold mb-4 pb-2 border-b border-cb-border">Public Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-cb-secondary block mb-1">Bio</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 160))} rows={3} maxLength={160} placeholder="Tell other cooks about yourself..." className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2 text-sm outline-none focus:border-cb-primary" />
            <p className="text-[10px] text-cb-secondary mt-0.5">{bio.length}/160</p>
          </div>
          <div>
            <label className="text-sm font-medium text-cb-secondary block mb-1">Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Paris, France" className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2 text-sm outline-none focus:border-cb-primary" />
          </div>
          <div>
            <label className="text-sm font-medium text-cb-secondary block mb-1">Instagram</label>
            <input value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} placeholder="@username or full URL" className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2 text-sm outline-none focus:border-cb-primary" />
          </div>
          <div>
            <label className="text-sm font-medium text-cb-secondary block mb-1">Website</label>
            <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://your-website.com" className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2 text-sm outline-none focus:border-cb-primary" />
          </div>
        </div>
        {username && (
          <p className="text-xs text-cb-secondary mt-4">Your public profile: <a href={`/chef/${username}`} className="text-cb-primary hover:underline">/chef/{username}</a></p>
        )}
      </section>

      {/* Plan */}
      <section className="mb-10" data-onboard="plan-tier">
        <h2 className="text-lg font-bold mb-4 pb-2 border-b border-cb-border">Plan & Billing</h2>
        <div className="grid grid-cols-3 gap-3 mb-3">
          {([
            { tier: 'free', name: 'Free', price: '$0', features: ['50 recipes', '5 scans/month', '1 shopping list', 'Share via link'] },
            { tier: 'pro', name: 'Pro', price: '$4.99/mo', features: ['Unlimited recipes', 'Unlimited scans', '10 shopping lists', 'Voice entry', 'Photo gallery', 'Public profile'] },
            { tier: 'family', name: 'Family', price: '$8.99/mo', features: ['Everything in Pro', 'Up to 6 members', 'Shared lists', 'Shared meal plans'] },
          ] as const).map((plan) => (
            <div key={plan.tier} className={`rounded-card border p-4 ${planTier === plan.tier ? 'border-cb-primary ring-2 ring-cb-primary/20' : 'border-cb-border'}`}>
              <p className="font-bold text-sm">{plan.name}</p>
              <p className="text-lg font-bold mb-2">{plan.price}</p>
              <ul className="space-y-1 mb-3">
                {plan.features.map((f) => (
                  <li key={f} className="text-[10px] text-cb-secondary flex items-start gap-1">
                    <svg className="w-3 h-3 text-cb-green mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                    {f}
                  </li>
                ))}
              </ul>
              {planTier === plan.tier ? (
                <span className="block text-center text-xs font-semibold text-cb-primary bg-cb-primary/10 py-1.5 rounded-input">Current Plan</span>
              ) : (
                <button
                  onClick={async () => {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) return;
                    await supabase.from('user_profiles').update({ plan_tier: plan.tier }).eq('id', user.id);
                    setPlanTier(plan.tier);
                  }}
                  className="w-full text-center text-xs font-semibold py-1.5 rounded-input border border-cb-border hover:border-cb-primary hover:text-cb-primary transition-colors"
                >
                  Select Plan
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-cb-secondary text-center">Payment integration coming soon. Plans can be selected freely during beta.</p>
        <ImportActivityCard />
      </section>

      {/* Appearance */}
      <section className="mb-10">
        <h2 className="text-lg font-bold mb-4 pb-2 border-b border-cb-border">Appearance</h2>
        <p className="text-sm text-cb-secondary">Shopping list font size can be adjusted using A+/A- buttons on any shopping list.</p>
      </section>

      {/* Help Tips */}
      <section className="mb-10" data-onboard="help-toggle">
        <h2 className="text-lg font-bold mb-4 pb-2 border-b border-cb-border">Help Tips</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Show guided help bubbles</p>
            <p className="text-xs text-cb-muted">Help bubbles appear when visiting new sections</p>
          </div>
          <button
            role="switch"
            aria-checked={onboardingEnabled}
            onClick={async () => {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;
              const newVal = !onboardingEnabled;
              const updates: any = { onboarding_enabled: newVal };
              if (newVal) updates.onboarding_seen_pages = []; // reset so bubbles show again
              await supabase.from('user_profiles').update(updates).eq('id', user.id);
              setOnboardingEnabled(newVal);
              setMessage(newVal ? 'Help tips turned on — bubbles will appear on each page' : 'Help tips turned off');
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${onboardingEnabled ? 'bg-cb-primary' : 'bg-cb-border'}`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${onboardingEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button onClick={saveProfile} disabled={saving} className="bg-cb-primary text-white px-6 py-2.5 rounded-input text-sm font-semibold hover:opacity-90 disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
      </div>

      {/* Privacy */}
      <section className="mb-10">
        <h2 className="text-lg font-bold mb-4 pb-2 border-b border-cb-border">Privacy</h2>
        <div>
          <p className="text-sm text-cb-secondary mb-3">Make all your public recipes private. They won't be visible to other members until you change them back to Public.</p>
          <button
            onClick={async () => {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;

              // Check if there are any public recipes
              const { count } = await supabase
                .from('recipes')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('visibility', 'public');

              if (!count || count === 0) {
                setMessage('All your recipes are already private');
                setTimeout(() => setMessage(''), 3000);
                return;
              }

              const confirmed = await confirm({ icon: '🔒', title: 'Make all recipes private?', body: `This will set all your public recipes to private. They won't be visible to other members until you change them back to Public.`, confirmLabel: 'Make Private' });
              if (!confirmed) return;

              setSaving(true);
              try {
                const { data: { session } } = await supabase.auth.getSession();
                const res = await fetch('/api/recipes/bulk-visibility', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`,
                  },
                  body: JSON.stringify({ ids: [], visibility: 'private', all: true }),
                });

                if (!res.ok) {
                  const data = await res.json();
                  throw new Error(data.error);
                }

                setMessage('All your recipes are now private');
                setTimeout(() => setMessage(''), 3000);
              } catch (e: any) {
                setMessage(e.message ?? 'Failed to update recipes');
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
            className="border border-red-200 text-cb-primary px-4 py-2 rounded-input text-sm font-semibold hover:bg-red-50 disabled:opacity-50"
          >
            {saving ? 'Updating...' : 'Make all my recipes private'}
          </button>
        </div>
      </section>

      {/* Change Password */}
      <section className="mb-10">
        <h2 className="text-lg font-bold mb-4 pb-2 border-b border-cb-border">Change Password</h2>
        {pwMessage && (
          <div className={`rounded-input p-3 mb-4 text-sm ${pwMessage === 'Password updated' ? 'bg-cb-green/10 text-cb-green' : 'bg-red-50 text-cb-primary'}`}>{pwMessage}</div>
        )}
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-cb-secondary block mb-1">New Password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2 text-sm outline-none focus:border-cb-primary" />
          </div>
          <div>
            <label className="text-sm font-medium text-cb-secondary block mb-1">Confirm New Password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat your new password" className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2 text-sm outline-none focus:border-cb-primary" />
          </div>
          <button
            onClick={async () => {
              setPwMessage('');
              if (newPassword.length < 8) { setPwMessage('Password must be at least 8 characters'); return; }
              if (newPassword !== confirmPassword) { setPwMessage('Passwords do not match'); return; }
              setPwSaving(true);
              try {
                const { error } = await supabase.auth.updateUser({ password: newPassword });
                if (error) throw error;
                setPwMessage('Password updated');
                setNewPassword('');
                setConfirmPassword('');
                setTimeout(() => setPwMessage(''), 3000);
              } catch (e: any) {
                setPwMessage(e.message ?? 'Failed to update password');
              }
              setPwSaving(false);
            }}
            disabled={pwSaving || !newPassword}
            className="bg-cb-primary text-white px-6 py-2 rounded-input text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {pwSaving ? 'Updating...' : 'Change Password'}
          </button>
        </div>
      </section>

      {/* Danger zone */}
      <section className="mt-12 pt-6 border-t border-red-200">
        <h2 className="text-sm font-bold text-cb-primary mb-2">Danger Zone</h2>
        <button disabled className="border border-red-200 text-cb-primary px-4 py-2 rounded-input text-sm font-medium opacity-50 cursor-not-allowed">Delete Account (coming soon)</button>
      </section>
      <ConfirmDialog />
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { adminFetch, adminPost } from '../../../lib/adminFetch';

interface SystemSetting {
  key: string;
  value: string;
  updated_by: string | null;
  updated_at: string | null;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, SystemSetting>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminFetch({ page: 'settings' });
      setSettings(data.settings ?? {});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const aiEnabled = settings['ai_auto_moderation_enabled']?.value === 'true';

  const toggleAiModeration = async () => {
    setSaving(true);
    try {
      await adminPost({
        action: 'updateSetting',
        key: 'ai_auto_moderation_enabled',
        value: aiEnabled ? 'false' : 'true',
      });
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const lastChanged = settings['ai_auto_moderation_enabled']?.updated_at;

  if (loading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Admin Settings</h1>

      <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-xl">
        <h2 className="text-lg font-semibold mb-2">AI Auto-Moderation</h2>
        <p className="text-sm text-gray-600 mb-4">
          When enabled, AI can automatically hide content and suspend accounts when it
          detects <strong>serious</strong> violations (hate speech, explicit content, etc.).
        </p>
        <p className="text-sm text-gray-600 mb-4">
          When disabled, AI flags content for human review only. All moderation actions
          require proctor or admin approval.
        </p>

        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={toggleAiModeration}
            disabled={saving}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              aiEnabled ? 'bg-cb-green' : 'bg-gray-300'
            } ${saving ? 'opacity-50' : ''}`}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                aiEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <span className={`text-sm font-semibold ${aiEnabled ? 'text-cb-green' : 'text-gray-500'}`}>
            {aiEnabled ? 'ON' : 'OFF'}
          </span>
        </div>

        <div className="text-xs text-gray-400 space-y-1">
          <p><strong>Applies to:</strong> recipe imports, comments, direct messages</p>
          <p><strong>Threshold:</strong> Serious violations only (never mild)</p>
          {lastChanged && (
            <p><strong>Last changed:</strong> {new Date(lastChanged).toLocaleString()}</p>
          )}
        </div>
      </div>

      <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6 max-w-xl">
        <h2 className="text-lg font-semibold mb-2">Permission Model</h2>
        <div className="text-sm text-gray-600 space-y-2">
          <p><strong>Users:</strong> report only (flag) — no content changes</p>
          <p><strong>AI:</strong> flag + auto-act on serious (when toggle is ON)</p>
          <p><strong>Proctors:</strong> hide, warn, resolve flags</p>
          <p><strong>Admins:</strong> all actions including permanent removal</p>
          <p><strong>Super Admins:</strong> all actions + system settings</p>
        </div>
      </div>
    </div>
  );
}

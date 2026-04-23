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
  const botProtectionEnabled = settings['bot_protection_enabled']?.value === 'true';

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

  const toggleBotProtection = async () => {
    setSaving(true);
    try {
      await adminPost({
        action: 'updateSetting',
        key: 'bot_protection_enabled',
        value: botProtectionEnabled ? 'false' : 'true',
      });
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const lastChanged = settings['ai_auto_moderation_enabled']?.updated_at;
  const botProtectionLastChanged = settings['bot_protection_enabled']?.updated_at;

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

      {/* Bot Protection */}
      <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6 max-w-xl">
        <h2 className="text-lg font-semibold mb-2">Security</h2>
        <h3 className="text-base font-medium mb-2">Bot Protection (Cloudflare Turnstile)</h3>
        <p className="text-sm text-gray-600 mb-2">
          Blocks bots on signup and login. Enable in production. Requires real Turnstile keys in .env.local
        </p>

        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={toggleBotProtection}
            disabled={saving}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              botProtectionEnabled ? 'bg-cb-green' : 'bg-gray-300'
            } ${saving ? 'opacity-50' : ''}`}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                botProtectionEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <span className={`text-sm font-semibold ${botProtectionEnabled ? 'text-cb-green' : 'text-gray-500'}`}>
            {botProtectionEnabled ? 'ON' : 'OFF'}
          </span>
        </div>

        <div className="text-xs text-gray-400 space-y-1">
          <p><strong>When OFF:</strong> All signups/logins pass through without Turnstile</p>
          <p><strong>When ON:</strong> Cloudflare Turnstile enforced on every signup/login</p>
          <p><strong>Note:</strong> Honeypot and disposable email checks always run regardless of this setting</p>
          {botProtectionLastChanged && (
            <p><strong>Last changed:</strong> {new Date(botProtectionLastChanged).toLocaleString()}</p>
          )}
        </div>
      </div>

      {/* Creativity slider */}
      <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6 max-w-xl">
        <h2 className="text-lg font-semibold mb-2">Image Creativity Level</h2>
        <p className="text-sm text-gray-600 mb-4">
          All levels use img2img with Flux Dev — the source photo anchors the output. Lower levels stay closer to the source composition; higher levels let the AI reinterpret the dish.
        </p>
        {(() => {
          const currentLevel = parseInt(settings['image_creativity_level']?.value ?? '3', 10);
          const levels = [
            { n: 1, label: 'Very Faithful', desc: 'Nearly identical to source photo' },
            { n: 2, label: 'Faithful', desc: 'Same style, small variation' },
            { n: 3, label: 'Balanced', desc: 'Same dish, different take (recommended)' },
            { n: 4, label: 'Creative', desc: 'Inspired by source, reimagined' },
            { n: 5, label: 'Very Creative', desc: 'Fully AI, source as loose reference' },
          ];
          return (
            <div className="space-y-2 mb-4">
              {levels.map((l) => (
                <label
                  key={l.n}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer border transition ${
                    currentLevel === l.n ? 'border-cb-primary bg-cb-primary/5' : 'border-transparent hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="creativity"
                    checked={currentLevel === l.n}
                    onChange={async () => {
                      setSaving(true);
                      try {
                        await adminPost({ action: 'updateSetting', key: 'image_creativity_level', value: String(l.n) });
                        await load();
                      } catch (err) { console.error(err); }
                      setSaving(false);
                    }}
                    className="accent-cb-primary"
                  />
                  <div>
                    <span className="text-sm font-medium">{l.n}. {l.label}</span>
                    <span className="text-xs text-gray-400 ml-2">{l.desc}</span>
                  </div>
                </label>
              ))}
              <p className="text-xs text-gray-400 mt-2">
                Each level maps to a Flux Dev prompt_strength: 0.2 / 0.4 / 0.6 / 0.8 / 0.95. Legacy recipes without a stored source photo fall back to text-to-image at the same strength.
              </p>
            </div>
          );
        })()}
      </div>

      {/* Throttle configuration */}
      <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6 max-w-xl">
        <h2 className="text-lg font-semibold mb-2">Throttle Configuration</h2>
        <p className="text-sm text-gray-600 mb-4">
          Automatically limits AI features for users who exceed expected cost thresholds.
        </p>
        {(() => {
          const enabled = settings['throttle_enabled']?.value === 'true';
          const windowDays = settings['throttle_window_days']?.value ?? '7';
          const graceDays = settings['throttle_grace_days']?.value ?? '30';
          const yellowPct = settings['throttle_yellow_pct']?.value ?? '150';
          const redPct = settings['throttle_red_pct']?.value ?? '300';
          const costs: Record<string, string> = {
            free: settings['throttle_expected_cost_free']?.value ?? '0.05',
            chef: settings['throttle_expected_cost_chef']?.value ?? '0.20',
            family: settings['throttle_expected_cost_family']?.value ?? '0.71',
            pro: settings['throttle_expected_cost_pro']?.value ?? '0.44',
          };

          const saveSetting = async (key: string, value: string) => {
            setSaving(true);
            try { await adminPost({ action: 'updateSetting', key, value }); await load(); } catch (e) { console.error(e); }
            setSaving(false);
          };

          const w = parseInt(windowDays); const rp = parseInt(redPct);
          return (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="w-28 text-gray-600">Status:</span>
                <button onClick={() => saveSetting('throttle_enabled', enabled ? 'false' : 'true')}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                >{enabled ? 'Enabled' : 'Disabled'}</button>
              </div>
              {[
                { label: 'Rolling window', key: 'throttle_window_days', val: windowDays, suffix: 'days' },
                { label: 'Grace period', key: 'throttle_grace_days', val: graceDays, suffix: 'days' },
                { label: 'Yellow threshold', key: 'throttle_yellow_pct', val: yellowPct, suffix: '% of expected' },
                { label: 'Red threshold', key: 'throttle_red_pct', val: redPct, suffix: '% of expected' },
              ].map((f) => (
                <div key={f.key} className="flex items-center gap-3">
                  <span className="w-28 text-gray-600">{f.label}:</span>
                  <input type="number" defaultValue={f.val} className="w-16 border border-gray-200 rounded px-2 py-1 text-sm"
                    onBlur={(e) => saveSetting(f.key, e.target.value)} />
                  <span className="text-xs text-gray-400">{f.suffix}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">Expected monthly cost by plan:</p>
                {Object.entries(costs).map(([plan, val]) => (
                  <div key={plan} className="flex items-center gap-3 mb-1">
                    <span className="w-28 text-gray-600 capitalize">{plan}:</span>
                    <span className="text-xs text-gray-400">$</span>
                    <input type="text" defaultValue={val} className="w-16 border border-gray-200 rounded px-2 py-1 text-sm"
                      onBlur={(e) => saveSetting(`throttle_expected_cost_${plan}`, e.target.value)} />
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-gray-100 text-xs text-gray-400">
                <p className="font-medium text-gray-500 mb-1">Effective red thresholds ({w}-day window):</p>
                {Object.entries(costs).map(([plan, val]) => {
                  const eff = (parseFloat(val) * (w / 30) * (rp / 100)).toFixed(3);
                  return <span key={plan} className="mr-3">{plan}: ${eff}</span>;
                })}
              </div>
              {parseInt(redPct) > 0 && Object.values(costs).some((v) => parseFloat(v) * (w / 30) * (rp / 100) < 0.10) && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                  Some red thresholds are very low (&lt;$0.10). This may throttle normal users too aggressively.
                </div>
              )}
            </div>
          );
        })()}
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

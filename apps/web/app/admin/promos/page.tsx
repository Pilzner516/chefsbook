'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@chefsbook/db';
import { useConfirmDialog } from '@/components/useConfirmDialog';

interface PromoRow {
  id: string;
  code: string;
  plan: string;
  discount_percent: number;
  max_uses: number | null;
  use_count: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export default function PromosPage() {
  const [confirmDel, ConfirmDialog] = useConfirmDialog();
  const [promos, setPromos] = useState<PromoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCode, setNewCode] = useState('');
  const [newPlan, setNewPlan] = useState('pro');
  const [newDiscount, setNewDiscount] = useState('100');
  const [newMaxUses, setNewMaxUses] = useState('');
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('promo_codes').select('*').order('created_at', { ascending: false });
    setPromos((data ?? []) as PromoRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createPromo = async () => {
    if (!newCode.trim()) return;
    setCreating(true);
    await supabase.from('promo_codes').insert({
      code: newCode.trim().toLowerCase(),
      plan: newPlan,
      discount_percent: parseInt(newDiscount) || 100,
      max_uses: newMaxUses ? parseInt(newMaxUses) : null,
      is_active: true,
    });
    setNewCode('');
    setNewMaxUses('');
    setCreating(false);
    load();
  };

  const toggleActive = async (promo: PromoRow) => {
    await supabase.from('promo_codes').update({ is_active: !promo.is_active }).eq('id', promo.id);
    load();
  };

  const deletePromo = async (id: string) => {
    const ok = await confirmDel({ icon: '🗑️', title: 'Delete promo code?', body: 'This promo code will be permanently removed.', confirmLabel: 'Delete' });
    if (!ok) return;
    await supabase.from('promo_codes').delete().eq('id', id);
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Promo Codes</h1>

      {/* Create form */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="font-semibold text-gray-900 mb-3">Create Promo Code</h2>
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Code</label>
            <input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="e.g. summer25" className="border border-gray-300 rounded-md px-3 py-2 text-sm w-40" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Plan</label>
            <select value={newPlan} onChange={(e) => setNewPlan(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm">
              {['chef', 'family', 'pro'].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Discount %</label>
            <input value={newDiscount} onChange={(e) => setNewDiscount(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm w-20" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Max uses</label>
            <input value={newMaxUses} onChange={(e) => setNewMaxUses(e.target.value)} placeholder="unlimited" className="border border-gray-300 rounded-md px-3 py-2 text-sm w-28" />
          </div>
          <button onClick={createPromo} disabled={creating || !newCode.trim()} className="bg-cb-primary text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-50">
            {creating ? '...' : 'Create'}
          </button>
        </div>
      </div>

      {loading ? <p className="text-gray-500">Loading...</p> : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Code</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Plan</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Discount</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Uses</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-medium text-gray-900">{p.code}</td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{p.plan}</td>
                  <td className="px-4 py-3 text-gray-600">{p.discount_percent}%</td>
                  <td className="px-4 py-3 text-gray-600">{p.use_count}{p.max_uses ? `/${p.max_uses}` : ''}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => toggleActive(p)} className="text-xs px-2 py-1 rounded bg-gray-50 text-gray-700 hover:bg-gray-100">
                        {p.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button onClick={() => deletePromo(p.id)} className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {promos.length === 0 && <p className="p-8 text-center text-gray-500">No promo codes.</p>}
        </div>
      )}
      <ConfirmDialog />
    </div>
  );
}

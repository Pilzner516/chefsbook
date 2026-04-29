'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PLAN_LIMITS, devChangePlan, supabase } from '@chefsbook/db';
import type { PlanTier } from '@chefsbook/db';

const TIERS: { key: PlanTier; price: string; annual: string; desc: string }[] = [
  { key: 'free', price: '$0', annual: '$0', desc: 'Browse public recipes' },
  { key: 'chef', price: '$4.99', annual: '$3.99', desc: 'Import, scan, AI features' },
  { key: 'family', price: '$9.99', annual: '$7.99', desc: 'Share with family members' },
  { key: 'pro', price: '$14.99', annual: '$11.99', desc: 'Unlimited everything' },
];

const FEATURES: { key: keyof typeof PLAN_LIMITS.free; label: string }[] = [
  { key: 'ownRecipes', label: 'Own recipes' },
  { key: 'shoppingLists', label: 'Shopping lists' },
  { key: 'cookbooks', label: 'Cookbooks' },
  { key: 'imagesPerRecipe', label: 'Images per recipe' },
  { key: 'canAI', label: 'AI features' },
  { key: 'canMealPlan', label: 'Meal planning' },
  { key: 'canPDF', label: 'PDF export' },
  { key: 'canPrintCookbook', label: 'Print My ChefsBook' },
];

export default function PlansPage() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [currentPlan, setCurrentPlan] = useState<PlanTier>('free');
  const [changing, setChanging] = useState<string | null>(null);

  // Load current plan
  useState(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.id) {
        supabase.from('user_profiles').select('plan_tier').eq('id', data.session.user.id).single().then(({ data: p }) => {
          if (p?.plan_tier) setCurrentPlan(p.plan_tier as PlanTier);
        });
      }
    });
  });

  const handleChange = async (plan: PlanTier) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user?.id) return;
    setChanging(plan);
    try {
      await devChangePlan(data.session.user.id, plan);
      setCurrentPlan(plan);
    } catch {}
    setChanging(null);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {reason === 'print' && (
        <div className="bg-amber-50 border border-amber-200 rounded-input px-4 py-3 text-center text-amber-800 text-sm font-medium mb-4">
          Print My ChefsBook is available on Chef, Family, and Pro plans.
        </div>
      )}
      <div className="bg-cb-primary-soft border border-cb-primary/20 rounded-input px-4 py-2 text-center text-cb-primary text-sm font-medium mb-6">
        Dev mode — billing not active
      </div>

      <h1 className="text-2xl font-bold text-cb-text mb-2">Plans</h1>

      {/* Billing toggle */}
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => setBilling('monthly')} className={`px-4 py-1.5 rounded-full text-sm font-semibold ${billing === 'monthly' ? 'bg-cb-primary text-white' : 'bg-cb-base text-cb-secondary'}`}>Monthly</button>
        <button onClick={() => setBilling('annual')} className={`px-4 py-1.5 rounded-full text-sm font-semibold ${billing === 'annual' ? 'bg-cb-primary text-white' : 'bg-cb-base text-cb-secondary'}`}>Annual</button>
        {billing === 'annual' && <span className="text-green-600 text-xs font-semibold">Save 20%</span>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {TIERS.map((tier) => {
          const limits = PLAN_LIMITS[tier.key];
          const isCurrent = currentPlan === tier.key;
          const price = billing === 'annual' ? tier.annual : tier.price;

          return (
            <div key={tier.key} className={`bg-cb-card rounded-card p-5 border-2 ${isCurrent ? 'border-cb-primary' : 'border-cb-border'}`}>
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-lg font-bold text-cb-text">{tier.key.charAt(0).toUpperCase() + tier.key.slice(1)}</h2>
                {isCurrent && <span className="bg-cb-primary-soft text-cb-primary text-[11px] font-bold px-2 py-0.5 rounded">Current</span>}
              </div>
              <div className="text-2xl font-bold text-cb-primary mb-1">
                {price}{tier.key !== 'free' && <span className="text-sm font-normal text-cb-muted">/mo</span>}
              </div>
              <p className="text-cb-secondary text-sm mb-4">{tier.desc}</p>

              <div className="space-y-1 mb-4">
                {FEATURES.map((f) => {
                  const val = limits[f.key];
                  const check = typeof val === 'boolean' ? val : (val as number) > 0;
                  return (
                    <div key={f.key} className="flex items-center gap-2 text-sm">
                      <span className={check ? 'text-green-600' : 'text-cb-muted'}>{check ? '✓' : '✗'}</span>
                      <span className="text-cb-secondary">
                        {f.label}{typeof val === 'number' && val > 0 ? `: ${val === Infinity ? 'Unlimited' : val}` : ''}
                      </span>
                    </div>
                  );
                })}
              </div>

              {!isCurrent && (
                <button
                  onClick={() => handleChange(tier.key)}
                  disabled={!!changing}
                  className={`w-full py-2 rounded-input text-sm font-semibold transition ${
                    TIERS.indexOf(tier) > TIERS.findIndex((t) => t.key === currentPlan)
                      ? 'bg-cb-primary text-white hover:opacity-90'
                      : 'bg-cb-base text-cb-secondary border border-cb-border hover:bg-cb-bg'
                  } disabled:opacity-50`}
                >
                  {changing === tier.key ? '...' : TIERS.indexOf(tier) > TIERS.findIndex((t) => t.key === currentPlan) ? 'Upgrade' : 'Downgrade'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

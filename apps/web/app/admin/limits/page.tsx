import { supabase } from '@chefsbook/db';

export default async function PlanLimitsPage() {
  const { data: limits } = await supabase.from('plan_limits').select('*').order('monthly_price_cents');

  const boolLabel = (v: boolean) => v ? '✓' : '✗';
  const numLabel = (v: number | null) => v === null ? '∞' : String(v);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Plan Limits</h1>
      <p className="text-sm text-gray-500 mb-6">Current plan configuration (read-only). Edit via DB for now.</p>

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Feature</th>
              {(limits ?? []).map((l: any) => (
                <th key={l.plan} className="px-4 py-3 text-center font-medium text-gray-500 capitalize">{l.plan}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { key: 'own_recipes', label: 'Own recipes' },
              { key: 'shopping_lists', label: 'Shopping lists' },
              { key: 'cookbooks', label: 'Cookbooks' },
              { key: 'images_per_recipe', label: 'Images/recipe' },
              { key: 'family_members', label: 'Family members' },
              { key: 'can_import', label: 'Can import' },
              { key: 'can_ai', label: 'AI features' },
              { key: 'can_share', label: 'Can share' },
              { key: 'can_follow', label: 'Can follow' },
              { key: 'can_comment', label: 'Can comment' },
              { key: 'can_pdf', label: 'PDF export' },
              { key: 'can_meal_plan', label: 'Meal planning' },
              { key: 'priority_ai', label: 'Priority AI' },
              { key: 'monthly_price_cents', label: 'Monthly (cents)' },
              { key: 'annual_price_cents', label: 'Annual (cents)' },
            ].map((row) => (
              <tr key={row.key} className="border-b last:border-0">
                <td className="px-4 py-2 text-gray-700">{row.label}</td>
                {(limits ?? []).map((l: any) => {
                  const val = l[row.key];
                  return (
                    <td key={l.plan} className="px-4 py-2 text-center text-gray-600">
                      {typeof val === 'boolean' ? boolLabel(val) : numLabel(val)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

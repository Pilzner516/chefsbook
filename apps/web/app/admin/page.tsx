import { supabase } from '@chefsbook/db';

async function getStats() {
  const [users, recipes, flagged] = await Promise.all([
    supabase.from('user_profiles').select('plan_tier', { count: 'exact' }),
    supabase.from('recipes').select('*', { count: 'exact', head: true }),
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('type', 'comment_flagged').eq('is_read', false),
  ]);

  // Count by plan
  const planCounts: Record<string, number> = {};
  for (const u of users.data ?? []) {
    const plan = (u as any).plan_tier ?? 'free';
    planCounts[plan] = (planCounts[plan] ?? 0) + 1;
  }

  // New signups today
  const today = new Date().toISOString().split('T')[0];
  const { count: newToday } = await supabase
    .from('user_profiles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today);

  return {
    totalUsers: users.count ?? 0,
    planCounts,
    newToday: newToday ?? 0,
    totalRecipes: recipes.count ?? 0,
    flaggedCount: flagged.count ?? 0,
  };
}

export default async function AdminOverview() {
  const stats = await getStats();

  const cards = [
    { label: 'Total Users', value: stats.totalUsers, color: 'text-blue-600' },
    { label: 'New Today', value: stats.newToday, color: 'text-green-600' },
    { label: 'Total Recipes', value: stats.totalRecipes, color: 'text-purple-600' },
    { label: 'Flagged Comments', value: stats.flaggedCount, color: stats.flaggedCount > 0 ? 'text-red-600' : 'text-gray-600' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard Overview</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">{c.label}</p>
            <p className={`text-3xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-3">Users by Plan</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {['free', 'chef', 'family', 'pro'].map((plan) => (
          <div key={plan} className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500 capitalize">{plan}</p>
            <p className="text-2xl font-bold text-gray-900">{stats.planCounts[plan] ?? 0}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

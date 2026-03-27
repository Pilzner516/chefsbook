import Link from 'next/link';

const tiers = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: ['50 recipes', '5 scans/month', '1 shopping list', 'Share via link', 'Import from URL'],
    cta: 'Get Started',
    featured: false,
  },
  {
    name: 'Pro',
    price: '$4.99',
    period: '/month',
    features: ['Unlimited recipes', 'Unlimited scans', '10 shopping lists', 'Public profile', 'Followers & friends', 'Priority support'],
    cta: 'Go Pro',
    featured: true,
  },
  {
    name: 'Family',
    price: '$8.99',
    period: '/month',
    features: ['Everything in Pro', 'Up to 6 family members', 'Shared shopping lists', 'Shared meal plans', 'Family cookbook'],
    cta: 'Start Family Plan',
    featured: false,
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-cb-border">
        <Link href="/" className="text-xl font-bold text-cb-primary">Chefsbook</Link>
        <Link href="/dashboard" className="text-cb-text-secondary hover:text-cb-text text-sm">Dashboard</Link>
      </nav>

      <section className="max-w-5xl mx-auto py-20 px-6">
        <h1 className="text-4xl font-bold text-center mb-4">Simple, honest pricing</h1>
        <p className="text-cb-text-secondary text-center mb-16 text-lg">Start free. Upgrade when you need more.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-xl border p-8 flex flex-col ${
                tier.featured
                  ? 'border-cb-primary bg-cb-surface shadow-lg shadow-cb-primary/10'
                  : 'border-cb-border bg-cb-surface'
              }`}
            >
              <h2 className="text-xl font-bold mb-2">{tier.name}</h2>
              <div className="mb-6">
                <span className="text-3xl font-bold">{tier.price}</span>
                <span className="text-cb-text-secondary text-sm ml-1">{tier.period}</span>
              </div>
              <ul className="flex-1 space-y-3 mb-8">
                {tier.features.map((f) => (
                  <li key={f} className="text-sm text-cb-text-secondary flex items-start gap-2">
                    <span className="text-cb-accent mt-0.5">{'\u2713'}</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/dashboard"
                className={`block text-center py-3 rounded-lg font-semibold text-sm ${
                  tier.featured
                    ? 'bg-cb-primary text-cb-bg hover:opacity-90'
                    : 'border border-cb-border text-cb-text hover:bg-cb-surface-alt'
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

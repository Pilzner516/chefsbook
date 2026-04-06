import Link from 'next/link';

const tiers = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: [
      '50 recipes',
      '5 scans / month',
      '1 shopping list',
      'Share via link',
      'Import from URL',
    ],
    cta: 'Get Started',
    href: '/dashboard',
    featured: false,
  },
  {
    name: 'Pro',
    price: '$4.99',
    period: '/month',
    features: [
      'Unlimited recipes',
      'Unlimited scans',
      '10 shopping lists',
      'Public profile',
      'Followers & friends',
      'Priority support',
    ],
    cta: 'Go Pro',
    href: '#checkout-pro',
    featured: true,
  },
  {
    name: 'Family',
    price: '$8.99',
    period: '/month',
    features: [
      'Everything in Pro',
      'Up to 6 family members',
      'Shared shopping lists',
      'Shared meal plans',
      'Family cookbook',
    ],
    cta: 'Start Family Plan',
    href: '#checkout-family',
    featured: false,
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <Link href="/" className="text-xl font-bold">
          <span className="text-cb-primary">Chefs</span>book
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-cb-secondary hover:text-cb-text text-sm font-medium">
            Dashboard
          </Link>
        </div>
      </nav>

      <section className="max-w-5xl mx-auto py-20 px-6">
        <h1 className="text-4xl font-bold text-center mb-4">Simple, honest pricing</h1>
        <p className="text-cb-secondary text-center mb-16 text-lg">
          Start free. Upgrade when you need more.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-card border p-8 flex flex-col ${
                tier.featured
                  ? 'border-cb-primary bg-cb-card ring-2 ring-cb-primary/20'
                  : 'border-cb-border bg-cb-card'
              }`}
            >
              {tier.featured && (
                <span className="text-xs font-semibold text-cb-primary uppercase tracking-wide mb-2">
                  Most popular
                </span>
              )}
              <h2 className="text-xl font-bold mb-2">{tier.name}</h2>
              <div className="mb-6">
                <span className="text-3xl font-bold">{tier.price}</span>
                <span className="text-cb-secondary text-sm ml-1">{tier.period}</span>
              </div>
              <ul className="flex-1 space-y-3 mb-8">
                {tier.features.map((f) => (
                  <li key={f} className="text-sm text-cb-secondary flex items-start gap-2">
                    <svg
                      className="w-4 h-4 text-cb-green mt-0.5 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={tier.href}
                className={`block text-center py-3 rounded-input font-semibold text-sm transition-opacity hover:opacity-90 ${
                  tier.featured
                    ? 'bg-cb-primary text-white'
                    : 'border border-cb-border text-cb-text hover:bg-gray-50'
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-cb-secondary text-sm mt-12">
          All plans include a 14-day free trial. Cancel anytime. Prices in USD.
        </p>
      </section>
    </main>
  );
}

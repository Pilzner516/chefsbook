import Link from 'next/link';

const features = [
  {
    title: 'Scan recipes',
    desc: 'Point your camera at any recipe — handwritten cards, cookbook pages, magazine clippings. AI extracts every detail instantly.',
    icon: (
      <svg className="w-8 h-8 text-cb-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
      </svg>
    ),
  },
  {
    title: 'Plan meals',
    desc: 'Drag recipes onto your weekly calendar. Scale servings for the whole family, plan ahead, and eat better every day.',
    icon: (
      <svg className="w-8 h-8 text-cb-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
  },
  {
    title: 'Share with friends',
    desc: 'Share any recipe via link — no login required for your friends. Go Pro to publish recipes and build a following.',
    icon: (
      <svg className="w-8 h-8 text-cb-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
      </svg>
    ),
  },
];

const tiers = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: ['50 recipes', '5 scans / month', '1 shopping list', 'Share via link', 'Import from URL'],
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
    features: ['Everything in Pro', 'Up to 6 members', 'Shared shopping lists', 'Shared meal plans', 'Family cookbook'],
    cta: 'Start Family Plan',
    featured: false,
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Header */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <Link href="/" className="text-xl font-bold">
          <span className="text-cb-primary">Chefs</span>book
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/pricing" className="text-cb-muted hover:text-cb-text text-sm font-medium">
            Pricing
          </Link>
          <Link href="/dashboard" className="text-cb-muted hover:text-cb-text text-sm font-medium">
            Dashboard
          </Link>
          <Link
            href="/auth"
            className="bg-cb-primary text-white px-5 py-2 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Sign in
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto text-center py-24 px-6">
        <h1 className="text-5xl font-bold mb-6 leading-tight tracking-tight">
          Your recipes, beautifully organised
        </h1>
        <p className="text-cb-muted text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
          Scan handwritten cards, import from any URL, plan your meals, and generate smart shopping
          lists. Chefsbook is the recipe manager built for real home cooks.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="bg-cb-primary text-white px-8 py-3 rounded-input text-lg font-semibold hover:opacity-90 transition-opacity"
          >
            Start for free
          </Link>
          <Link
            href="#features"
            className="border-2 border-cb-green text-cb-green px-8 py-3 rounded-input text-lg font-semibold hover:bg-cb-green hover:text-white transition-colors"
          >
            See how it works
          </Link>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-cb-card border border-cb-border rounded-card p-6"
            >
              <div className="mb-4">{f.icon}</div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-cb-muted text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <h2 className="text-3xl font-bold text-center mb-4">Simple, honest pricing</h2>
        <p className="text-cb-muted text-center mb-12 text-lg">Start free. Upgrade when you need more.</p>
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
              <h3 className="text-xl font-bold mb-2">{tier.name}</h3>
              <div className="mb-6">
                <span className="text-3xl font-bold">{tier.price}</span>
                <span className="text-cb-muted text-sm ml-1">{tier.period}</span>
              </div>
              <ul className="flex-1 space-y-3 mb-8">
                {tier.features.map((f) => (
                  <li key={f} className="text-sm text-cb-muted flex items-start gap-2">
                    <svg className="w-4 h-4 text-cb-green mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={tier.name === 'Free' ? '/dashboard' : '/pricing'}
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
      </section>

      {/* Footer */}
      <footer className="border-t border-cb-border px-6 py-8 text-center text-cb-muted text-sm">
        Chefsbook &copy; {new Date().getFullYear()}. All rights reserved.
      </footer>
    </main>
  );
}

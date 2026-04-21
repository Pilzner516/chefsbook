'use client';

import { useState } from 'react';
import Link from 'next/link';

const featureGroups = [
  {
    title: 'Import & Capture',
    items: [
      'Scan recipe photos (multi-page, cookbook pages, screenshots)',
      'Import from any URL',
      'Speak a recipe (voice entry)',
      'Import from PDFs, Word docs, and bookmark exports',
      'Identify dishes from photos with AI',
    ],
  },
  {
    title: 'Organise & Plan',
    items: [
      'Recipe versioning (multiple versions of one recipe)',
      'AI meal planner',
      'Smart shopping lists (store-grouped, unit-aware)',
      'Cookbook organisation',
    ],
  },
  {
    title: 'Discover & Share',
    items: [
      'Public recipe discovery',
      'Share recipes via link (chefsbk.app)',
      'Follow chefs, see What\'s New feed',
      'Likes and family-friendly comments',
      'Attribution tracking (original recipe credit)',
    ],
  },
  {
    title: 'AI Powered',
    items: [
      'Auto-tagging',
      'Recipe translation (5 languages)',
      'Dish identification',
      'AI meal plan generation',
      'Content moderation',
    ],
  },
];

const tiers = [
  {
    name: 'Free',
    monthly: 0,
    annual: 0,
    features: ['View public recipes', '1 shopping list', 'Share via link', 'Browse & discover'],
    cta: 'Get started',
    featured: false,
  },
  {
    name: 'Chef',
    monthly: 4.99,
    annual: 3.99,
    features: ['75 own recipes', 'AI features', '5 shopping lists', 'Sharing & social', '10 cookbooks', '1 image per recipe'],
    cta: 'Start free trial',
    featured: true,
  },
  {
    name: 'Family',
    monthly: 9.99,
    annual: 7.99,
    features: ['200 recipes', '3 family members', 'Shared lists & plans', '25 cookbooks', 'Everything in Chef'],
    cta: 'Start free trial',
    featured: false,
  },
  {
    name: 'Pro',
    monthly: 14.99,
    annual: 11.99,
    features: ['Unlimited recipes', '5 images per recipe', 'PDF export', 'Priority AI', 'Unlimited everything'],
    cta: 'Start free trial',
    featured: false,
  },
];

const steps = [
  { num: '1', title: 'Sign up', desc: 'Free, takes 30 seconds.' },
  { num: '2', title: 'Import recipes', desc: 'Scan a photo, paste a URL, speak it, or upload a PDF.' },
  { num: '3', title: 'Organise & plan', desc: 'Meal planner, shopping lists, cookbooks.' },
  { num: '4', title: 'Discover & share', desc: 'Follow chefs, share recipes, build your collection.' },
];

export default function HomePage() {
  const [annual, setAnnual] = useState(false);

  return (
    <main className="min-h-screen bg-cb-bg">
      {/* Header */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <Link href="/" className="text-xl font-bold">
          <span className="text-cb-primary">Chefs</span>book
        </Link>
        <div className="flex items-center gap-6">
          <Link href="#features" className="hidden sm:block text-cb-secondary hover:text-cb-text text-sm font-medium">
            Features
          </Link>
          <Link href="#pricing" className="hidden sm:block text-cb-secondary hover:text-cb-text text-sm font-medium">
            Pricing
          </Link>
          <Link href="/auth" className="text-cb-secondary hover:text-cb-text text-sm font-medium">
            Sign in
          </Link>
          <Link
            href="/auth"
            className="bg-cb-primary text-white px-5 py-2 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto text-center py-20 px-6">
        <div className="flex justify-center mb-6">
          <img
            src="/images/chefs-hat-hd.png"
            srcSet="/images/chefs-hat-hd.png 2x"
            width={128}
            height={128}
            alt="ChefsBook"
            className="object-contain"
            style={{ imageRendering: 'auto' }}
          />
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold mb-6 leading-tight tracking-tight text-cb-text">
          Your recipes. Your community.<br />
          <span className="text-cb-primary">The Chefs Solution</span>
        </h1>
        <p className="text-cb-secondary text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
          Scan, speak, import, and discover recipes. Plan meals, generate smart shopping lists,
          follow your favourite chefs, and share what you cook &mdash; all in one place.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/auth"
            className="w-full sm:w-auto bg-cb-primary text-white px-8 py-3 rounded-input text-lg font-semibold hover:opacity-90 transition-opacity text-center"
          >
            Start for free
          </Link>
          <Link
            href="#how-it-works"
            className="w-full sm:w-auto border-2 border-cb-green text-cb-green px-8 py-3 rounded-input text-lg font-semibold hover:bg-cb-green hover:text-white transition-colors text-center"
          >
            See how it works
          </Link>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-5xl mx-auto px-6 pb-24">
        <h2 className="text-3xl font-bold text-center mb-4 text-cb-text">Everything you need</h2>
        <p className="text-cb-secondary text-center mb-12 text-lg">From capture to kitchen to table.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {featureGroups.map((group) => (
            <div key={group.title} className="bg-cb-card border border-cb-border rounded-card p-6">
              <h3
                className="text-[22px] font-semibold text-cb-text mb-4"
                style={{ borderLeft: '3px solid #ce2b37', paddingLeft: 16 }}
              >
                {group.title}
              </h3>
              <ul className="space-y-2">
                {group.items.map((item) => (
                  <li key={item} className="text-sm text-cb-secondary flex items-start gap-2">
                    <svg className="w-4 h-4 text-cb-green mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-white py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12 text-cb-text">How it works</h2>
          <div className="relative">
            {/* Connector line (desktop only) */}
            <div className="hidden lg:block absolute top-[24px] left-[calc(12.5%+24px)] right-[calc(12.5%+24px)] border-t-2 border-dashed border-gray-200 z-0" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
              {steps.map((step) => (
                <div
                  key={step.num}
                  className="bg-white rounded-xl p-8 text-center"
                  style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}
                >
                  <div className="w-12 h-12 rounded-full bg-cb-primary text-white flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                    {step.num}
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-cb-text">{step.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-24">
        <h2 className="text-3xl font-bold text-center mb-4 text-cb-text">Simple, honest pricing</h2>
        <p className="text-cb-secondary text-center mb-8 text-lg">Start free. Upgrade when you need more.</p>

        {/* Monthly / Annual toggle */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <span className={`text-[15px] font-medium leading-none ${!annual ? 'text-cb-text' : 'text-cb-muted'}`}>Monthly</span>
          <button
            onClick={() => setAnnual(!annual)}
            className={`relative w-12 h-6 rounded-full transition-colors flex items-center ${annual ? 'bg-cb-primary' : 'bg-cb-border'}`}
          >
            <span className={`absolute w-5 h-5 rounded-full bg-white shadow transition-transform ${annual ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
          <span className={`text-[15px] font-medium leading-none flex items-center gap-1.5 ${annual ? 'text-cb-text' : 'text-cb-muted'}`}>
            Annual
            <span className="text-xs font-semibold text-white bg-cb-green px-2 py-0.5 rounded-full leading-snug">
              Save 20%
            </span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {tiers.map((tier) => {
            const price = annual ? tier.annual : tier.monthly;
            return (
              <div
                key={tier.name}
                className={`rounded-card border p-6 flex flex-col ${
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
                <h3 className="text-xl font-bold mb-2 text-cb-text">{tier.name}</h3>
                <div className="mb-6">
                  <span className="text-3xl font-bold text-cb-text">${price === 0 ? '0' : price.toFixed(2)}</span>
                  <span className="text-cb-secondary text-sm ml-1">{price === 0 ? '/forever' : '/mo'}</span>
                </div>
                <ul className="flex-1 space-y-2.5 mb-6">
                  {tier.features.map((f) => (
                    <li key={f} className="text-sm text-cb-secondary flex items-start gap-2">
                      <svg className="w-4 h-4 text-cb-green mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/auth"
                  className={`block text-center py-2.5 rounded-input font-semibold text-sm transition-opacity hover:opacity-90 ${
                    tier.featured
                      ? 'bg-cb-primary text-white'
                      : 'border border-cb-border text-cb-text hover:bg-gray-50'
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            );
          })}
        </div>
        <p className="text-center text-cb-muted text-sm mt-6">
          Have a promo code? Enter it at signup.
        </p>
      </section>

      {/* Footer */}
      <footer className="border-t border-cb-border bg-cb-card">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <img src="/images/chefs-hat-hd.png" alt="" className="w-6 h-6 object-contain" />
              <span className="text-lg font-bold text-cb-text">
                <span className="text-cb-primary">Chefs</span>book
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-cb-secondary">
              <Link href="#features" className="hover:text-cb-text transition-colors">Features</Link>
              <Link href="#pricing" className="hover:text-cb-text transition-colors">Pricing</Link>
              <Link href="/auth" className="hover:text-cb-text transition-colors">Sign In</Link>
              <a href="https://play.google.com/store/apps/details?id=com.chefsbook.app" className="hover:text-cb-text transition-colors">Download App</a>
              <Link href="/privacy" className="hover:text-cb-text transition-colors">Privacy Policy</Link>
            </div>
          </div>
          <div className="text-center text-cb-muted text-xs mt-6">
            chefsbk.app &middot; &copy; {new Date().getFullYear()} ChefsBook
          </div>
        </div>
      </footer>
    </main>
  );
}

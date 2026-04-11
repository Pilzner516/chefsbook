import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-cb-bg">
      <nav className="flex items-center justify-between px-6 py-4 max-w-3xl mx-auto">
        <Link href="/" className="text-xl font-bold">
          <span className="text-cb-primary">Chefs</span>book
        </Link>
        <Link href="/auth" className="text-cb-secondary hover:text-cb-text text-sm font-medium">Sign in</Link>
      </nav>

      <article className="max-w-[720px] mx-auto px-6 py-16">
        <h1 className="text-[32px] font-bold text-cb-text mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: April 2026</p>

        <p className="text-[15px] text-gray-700 leading-[1.8] mb-10">
          At ChefsBook, we believe your recipes and your data are yours. We built this app for people who love cooking — not for advertisers. Here&apos;s exactly what we collect and why.
        </p>

        <Section title="1. What we collect">
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Account information</strong> — your email address, display name, and username</li>
            <li><strong>Recipe data</strong> — recipes you import, scan, speak, or create</li>
            <li><strong>Usage data</strong> — which features you use (we use this to improve the app, never sold)</li>
            <li><strong>Photos</strong> — images you upload to recipes, stored on our own server</li>
            <li><strong>Shopping lists, meal plans, and preferences</strong> you create</li>
            <li><strong>Feedback messages</strong> you submit through the app</li>
          </ul>
        </Section>

        <Section title="2. What we do NOT collect">
          <ul className="list-disc pl-5 space-y-2">
            <li>We do <strong>not</strong> sell your data to anyone — ever</li>
            <li>We do <strong>not</strong> show ads</li>
            <li>We do <strong>not</strong> share your data with third parties except the services listed below</li>
            <li>We do <strong>not</strong> collect payment information directly — if billing is active, it&apos;s handled securely by Stripe</li>
          </ul>
        </Section>

        <Section title="3. Third-party services">
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Supabase</strong> — database and file storage (self-hosted on our own server, not Supabase cloud)</li>
            <li><strong>Anthropic Claude API</strong> — AI features like recipe extraction, translation, and moderation. Recipe content is sent to Claude for processing but is not stored by Anthropic beyond the API call.</li>
            <li><strong>Pexels API</strong> — recipe photo suggestions. Search queries are sent; no personal data is shared.</li>
            <li><strong>Logo.dev</strong> — store logo lookup. Only the store name is sent.</li>
            <li><strong>Cloudflare</strong> — CDN and secure tunnel. Handles web traffic with standard CDN privacy practices.</li>
          </ul>
        </Section>

        <Section title="4. Browser extension">
          <p>The ChefsBook browser extension captures the HTML of pages you explicitly choose to import. This HTML is sent to our servers for recipe extraction only. We do not capture your browsing history or any pages you did not choose to import. The extension stores your ChefsBook login token locally in Chrome storage.</p>
        </Section>

        <Section title="5. Data storage">
          <p>All user data is stored on our self-hosted server (Raspberry Pi 5, located in the United States). Your data is not stored in third-party cloud services — we self-host everything. Backups are stored locally on the same server.</p>
        </Section>

        <Section title="6. Your rights">
          <ul className="list-disc pl-5 space-y-2">
            <li>You can <strong>delete your account</strong> and all associated data at any time from Settings</li>
            <li>You can <strong>export your recipes</strong> in CSV or JSON format from Settings</li>
            <li>You can <strong>contact us</strong> at <a href="mailto:support@chefsbk.app" className="text-cb-primary hover:underline">support@chefsbk.app</a> with any data questions</li>
          </ul>
        </Section>

        <Section title="7. Cookies">
          <p>We use session cookies for authentication only. We do not use tracking cookies, advertising cookies, or any third-party analytics cookies.</p>
        </Section>

        <Section title="8. Children">
          <p>ChefsBook is not directed at children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal data, please contact us and we will delete it.</p>
        </Section>

        <Section title="9. Changes to this policy">
          <p>If we make significant changes to this privacy policy, we will notify registered users by email. Minor wording changes may be made without notification.</p>
        </Section>

        <Section title="10. Contact">
          <p>Questions about your privacy? We&apos;re happy to help.</p>
          <p className="mt-2">
            Email: <a href="mailto:support@chefsbk.app" className="text-cb-primary hover:underline">support@chefsbk.app</a><br />
            Website: <a href="https://chefsbk.app" className="text-cb-primary hover:underline">chefsbk.app</a>
          </p>
        </Section>
      </article>

      <footer className="border-t border-cb-border py-8 text-center text-cb-muted text-xs">
        chefsbk.app &middot; &copy; 2026 ChefsBook
      </footer>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-cb-primary mb-3">{title}</h2>
      <div className="text-[15px] text-gray-700 leading-[1.8]">{children}</div>
    </section>
  );
}

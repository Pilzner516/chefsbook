import Link from 'next/link';

export default function ExtensionPage() {
  return (
    <main className="min-h-screen bg-cb-bg">
      <nav className="flex items-center justify-between px-6 py-4 max-w-4xl mx-auto">
        <Link href="/" className="text-xl font-bold">
          <span className="text-cb-primary">Chefs</span>book
        </Link>
        <Link href="/auth" className="text-cb-secondary hover:text-cb-text text-sm font-medium">Sign in</Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <img src="/images/chefs-hat.png" alt="" className="w-24 h-24 object-contain mx-auto mb-6 opacity-80" />
        <h1 className="text-3xl font-bold text-cb-text mb-3">ChefsBook Browser Extension</h1>
        <p className="text-lg text-cb-secondary mb-8">Save recipes from anywhere with one click</p>

        <a
          href="#manual"
          className="inline-block bg-cb-primary text-white px-8 py-3 rounded-full text-lg font-semibold hover:opacity-90 transition mb-3"
        >
          Add to Chrome — It&apos;s Free →
        </a>
        <p className="text-sm text-cb-muted mb-16">Currently in beta — manual install required</p>

        {/* How it works */}
        <section className="text-left mb-16">
          <h2 className="text-xl font-bold text-cb-text mb-6 text-center">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { num: '1', title: 'Install the extension', desc: 'Add it to Chrome from the button above' },
              { num: '2', title: 'Sign in to ChefsBook', desc: 'Click the extension icon and sign in with your ChefsBook account' },
              { num: '3', title: 'Save any recipe', desc: 'Visit any recipe website and click "Save to ChefsBook" — that\'s it' },
            ].map((step) => (
              <div key={step.num} className="text-center">
                <div className="w-10 h-10 rounded-full bg-cb-primary text-white flex items-center justify-center text-lg font-bold mx-auto mb-3">{step.num}</div>
                <h3 className="font-semibold text-cb-text mb-1">{step.title}</h3>
                <p className="text-sm text-cb-secondary">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Compatible sites */}
        <section className="mb-16">
          <h2 className="text-xl font-bold text-cb-text mb-3">Works on any recipe website</h2>
          <p className="text-cb-secondary">NYT Cooking · Serious Eats · Bon Appétit · Food Network · AllRecipes · and thousands more</p>
        </section>

        {/* Manual install */}
        <section id="manual" className="text-left bg-cb-card border border-cb-border rounded-card p-8">
          <h2 className="text-lg font-bold text-cb-text mb-4">Manual installation (beta)</h2>
          <p className="text-sm text-cb-secondary mb-6">
            While we await Chrome Web Store approval, install manually in 3 steps:
          </p>

          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-cb-text mb-1">1. Download the extension files</h3>
              <a
                href="/extension/download"
                className="inline-block bg-cb-primary text-white px-5 py-2 rounded-full text-sm font-semibold hover:opacity-90 transition mt-1"
              >
                Download extension.zip
              </a>
            </div>
            <div>
              <h3 className="font-semibold text-cb-text mb-1">2. Open Chrome Extensions</h3>
              <p className="text-sm text-cb-secondary">
                Go to <code className="bg-cb-bg px-1.5 py-0.5 rounded text-xs">chrome://extensions</code> and enable &quot;Developer mode&quot; (top right toggle)
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-cb-text mb-1">3. Load the extension</h3>
              <p className="text-sm text-cb-secondary">
                Unzip the downloaded file, click &quot;Load unpacked&quot; and select the unzipped extension folder
              </p>
            </div>
          </div>
        </section>
      </div>

      <footer className="border-t border-cb-border py-8 text-center text-cb-muted text-xs">
        chefsbk.app &middot; &copy; 2026 ChefsBook &middot; <Link href="/privacy" className="hover:text-cb-text">Privacy Policy</Link>
      </footer>
    </main>
  );
}

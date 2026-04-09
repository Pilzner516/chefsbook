import Link from 'next/link';

export default function SuspendedPage() {
  return (
    <div className="min-h-screen bg-cb-bg flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="text-5xl mb-6">🚫</div>
        <h1 className="text-2xl font-bold text-cb-text mb-3">Account Suspended</h1>
        <p className="text-cb-secondary mb-6">
          Your account has been suspended. If you believe this is a mistake, please contact support.
        </p>
        <Link href="mailto:support@chefsbk.app" className="text-cb-primary font-semibold hover:underline">
          Contact Support
        </Link>
      </div>
    </div>
  );
}

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-cb-bg flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-cb-primary mb-4">404</h1>
        <p className="text-cb-secondary text-lg mb-8">This page doesn't exist.</p>
        <Link
          href="/"
          className="bg-cb-primary text-white px-6 py-3 rounded-card font-semibold hover:opacity-90 transition"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

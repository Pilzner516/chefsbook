import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Chefsbook — Your Recipe Library',
  description:
    'Capture, organize, and share your recipes. Scan handwritten cards, import from URLs, plan meals, and generate smart shopping lists.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-cb-bg text-cb-text min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}

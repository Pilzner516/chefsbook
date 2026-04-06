import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ChefsBook — Your Recipe Library',
  description: 'Your recipes, beautifully organized',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
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

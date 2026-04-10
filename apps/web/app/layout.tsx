import type { Metadata } from 'next';
import './globals.css';
import I18nProvider from '@/components/I18nProvider';

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
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}

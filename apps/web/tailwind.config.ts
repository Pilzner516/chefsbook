import type { Config } from 'tailwindcss';

/**
 * Canonical Trattoria colors from @chefsbook/ui TRATTORIA_COLORS.
 * Mapped to cb-* Tailwind tokens.
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        cb: {
          bg: '#faf7f0',
          base: '#f4f0e8',
          card: '#ffffff',
          primary: '#ce2b37',
          'primary-soft': '#fdecea',
          green: '#009246',
          'green-soft': '#e8f5ee',
          text: '#1a1a1a',
          secondary: '#7a6a5a',
          muted: '#9a8a7a',
          border: '#e8e0d0',
          'border-strong': '#d0c8b8',
        },
      },
      borderRadius: {
        card: '12px',
        input: '8px',
      },
    },
  },
  plugins: [],
};

export default config;

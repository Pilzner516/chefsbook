import type { Config } from 'tailwindcss';

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
          card: '#ffffff',
          border: '#e8e0d0',
          primary: '#ce2b37',
          green: '#009246',
          text: '#1a1a1a',
          muted: '#7a6a5a',
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

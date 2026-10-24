import type { Config } from 'tailwindcss';

const v = (name: string) => `var(--${name})`;

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    screens: { sm: '640px', md: '768px', lg: '1024px', xl: '1280px' },
    extend: {
      colors: {
        paper: v('paper'),
        'paper-2': v('paper-2'),
        ink: v('ink'),
        'ink-2': v('ink-2'),
        stone: v('stone'),
        hairline: v('hairline'),
        accent: v('accent'),
        'accent-ink': v('accent-ink'),
        gold: v('gold'),
        q0: v('q0'),
        q1: v('q1'),
        q2: v('q2'),
        idle: v('idle'),
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        caption: ['13px', { lineHeight: '1.4', letterSpacing: '0.08em' }],
        small: ['15px', { lineHeight: '1.5' }],
        body: ['18px', { lineHeight: '1.6' }],
        h3: ['24px', { lineHeight: '1.25' }],
        h2: ['36px', { lineHeight: '1.15' }],
        h1: ['56px', { lineHeight: '1.05' }],
        display: ['88px', { lineHeight: '1' }],
      },
      maxWidth: { page: '1280px' },
      borderRadius: { DEFAULT: '2px', sm: '2px', md: '4px' },
    },
  },
  plugins: [],
};
export default config;

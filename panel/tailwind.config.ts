import type { Config } from 'tailwindcss';

/** Semantic color tokens (CSS variables in globals.css, light + dark). */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        paper: token('paper'),
        surface: token('surface'),
        sunken: token('sunken'),
        line: { DEFAULT: token('line'), strong: token('line-strong') },
        ink: { DEFAULT: token('ink'), 2: token('ink-2'), 3: token('ink-3') },
        accent: { DEFAULT: token('accent'), soft: token('accent-soft'), ink: token('accent-ink') },
        danger: { DEFAULT: token('danger'), soft: token('danger-soft') },
        success: { DEFAULT: token('success'), soft: token('success-soft') },
        warn: { DEFAULT: token('warn'), soft: token('warn-soft') },
      },
      fontFamily: {
        sans: ['"Inter UI"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"SG Roboto Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: { DEFAULT: '3px', md: '4px', lg: '6px', xl: '8px' },
      letterSpacing: { tightest: '-0.03em' },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'sheet-up': { from: { transform: 'translateY(12px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        'slide-in': { from: { transform: 'translateX(-8px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
      },
      animation: {
        'fade-in': 'fade-in 120ms ease-out',
        'sheet-up': 'sheet-up 160ms ease-out',
        'slide-in': 'slide-in 200ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;

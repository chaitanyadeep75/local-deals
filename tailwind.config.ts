import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      boxShadow: {
        'neon-violet': '0 0 20px rgba(139,92,246,0.5), 0 0 60px rgba(139,92,246,0.12)',
        'neon-rose': '0 0 20px rgba(244,63,94,0.5), 0 0 60px rgba(244,63,94,0.12)',
        'neon-emerald': '0 0 16px rgba(52,211,153,0.5), 0 0 40px rgba(52,211,153,0.1)',
        'neon-amber': '0 0 16px rgba(251,191,36,0.5), 0 0 40px rgba(251,191,36,0.1)',
        'neon-fuchsia': '0 0 20px rgba(217,70,239,0.5), 0 0 60px rgba(217,70,239,0.12)',
        'card': '0 4px 24px rgba(0,0,0,0.6), 0 1px 4px rgba(0,0,0,0.4)',
        'card-hover': '0 12px 48px rgba(0,0,0,0.7), 0 0 32px rgba(139,92,246,0.2)',
        'inner-top': 'inset 0 1px 0 rgba(255,255,255,0.08)',
      },
      animation: {
        'float': 'float 5s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2.5s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
        'spin-slow': 'spin-slow 8s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
      },
      backdropBlur: {
        '3xl': '64px',
      },
    },
  },
  plugins: [],
};

export default config;

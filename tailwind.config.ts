import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        satoshi: ['Satoshi', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Light theme colors
        'warm-white': '#FAFAF9',
        'warm-black': '#0D0D0C',
        'warm-brown': '#3d2e1f',
        brass: {
          DEFAULT: '#8B7332',
          hover: '#7A6528',
          light: '#B89B4A',
        },
        forest: '#4A7C59',
        amber: '#D4A574',
        // Semantic colors using CSS variables
        background: 'var(--bg-primary)',
        card: 'var(--bg-card)',
        foreground: 'var(--text-primary)',
        muted: 'var(--text-secondary)',
        border: 'var(--border)',
        accent: 'var(--accent)',
      },
      borderRadius: {
        'card': '12px',
        'button': '8px',
      },
      boxShadow: {
        'warm': '0 4px 12px rgba(26, 26, 24, 0.08)',
        'warm-lg': '0 8px 24px rgba(26, 26, 24, 0.12)',
        'warm-dark': '0 4px 12px rgba(0, 0, 0, 0.3)',
        'warm-dark-lg': '0 8px 24px rgba(0, 0, 0, 0.4)',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}

export default config

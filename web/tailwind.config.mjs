/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        background: 'var(--bg-primary)',
        card: 'var(--bg-card)',
        foreground: 'var(--text-primary)',
        muted: 'var(--text-secondary)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        border: 'var(--border)',
        success: 'var(--success)',
        warning: 'var(--warning)',
      },
      fontFamily: {
        satoshi: ['Satoshi', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
        button: '8px',
      },
      boxShadow: {
        warm: '0 4px 12px rgba(26, 26, 24, 0.08)',
        'warm-lg': '0 8px 24px rgba(26, 26, 24, 0.12)',
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
// Tailwind 3 설정 — CSS 변수(tokens.css)와 매핑.
// extend.colors/spacing/radius/shadow 모두 var() 로 위임 → tokens.css 가 single source of truth.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'bg': 'var(--color-bg)',
        'surface': 'var(--color-surface)',
        'elevated': 'var(--color-elevated)',
        'ink': 'var(--color-ink)',
        'muted': 'var(--color-muted)',
        'divider': 'var(--color-divider)',
        'card-bg': 'var(--color-card-bg)',
        'card-surface': 'var(--color-card-surface)',
        'card-ink': 'var(--color-card-ink)',
        'card-muted': 'var(--color-card-muted)',
        'card-divider': 'var(--color-card-divider)',
        'accent': 'var(--color-accent)',
        'accent-pressed': 'var(--color-accent-pressed)',
        'success': 'var(--color-success)',
        'warning': 'var(--color-warning)',
        'danger': 'var(--color-danger)',
        'info': 'var(--color-info)',
        'stamp-red': 'var(--stamp-red)',
        'stamp-black': 'var(--stamp-black)',
        'stamp-green': 'var(--stamp-green)',
      },
      fontFamily: {
        'body': 'var(--font-body)',
        'display': 'var(--font-display)',
        'mono': 'var(--font-mono)',
        'stencil': 'var(--font-stencil)',
      },
      spacing: {
        '3xs': 'var(--space-3xs)',
        '2xs': 'var(--space-2xs)',
        'xs': 'var(--space-xs)',
        'sm': 'var(--space-sm)',
        'md': 'var(--space-md)',
        'lg': 'var(--space-lg)',
        'xl': 'var(--space-xl)',
        '2xl': 'var(--space-2xl)',
        '3xl': 'var(--space-3xl)',
      },
      borderRadius: {
        'xs': 'var(--radius-xs)',
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'tag': 'var(--radius-tag)',
      },
      boxShadow: {
        'card': 'var(--shadow-card)',
        'elevated': 'var(--shadow-elevated)',
      },
      transitionDuration: {
        'tap': 'var(--duration-tap)',
        'card': 'var(--duration-card)',
        'stamp': 'var(--duration-stamp)',
        'tag': 'var(--duration-tag)',
        'mascot': 'var(--duration-mascot)',
      },
    },
  },
  plugins: [],
};

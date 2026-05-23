import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          base:           'var(--bg-base)',
          surface:        'var(--bg-surface)',
          elevated:       'var(--bg-elevated)',
          hover:          'var(--bg-hover)',
          border:         'var(--bg-border)',
          'border-subtle':'var(--bg-border-subtle)',
        },
        text: {
          primary:   'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary:  'var(--text-tertiary)',
          muted:     'var(--text-muted)',
        },
        accent: {
          DEFAULT:    'var(--accent)',
          hover:      'var(--accent-hover)',
          muted:      'var(--accent-muted)',
        },
        status: {
          done:       'var(--status-done)',
          'done-text': 'var(--status-done-text)',
          active:     'var(--status-active)',
          'active-text': 'var(--status-active-text)',
          blocked:    'var(--status-blocked)',
          'blocked-text': 'var(--status-blocked-text)',
          backlog:    'var(--status-backlog)',
          'backlog-text': 'var(--status-backlog-text)',
        },
        warn: {
          critical: 'var(--warn-critical)',
          high:     'var(--warn-high)',
          medium:   'var(--warn-medium)',
          low:      'var(--warn-low)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
        '3xs': ['0.575rem', { lineHeight: '0.875rem' }],
      },
      borderRadius: {
        DEFAULT: '5px',
        sm:      '3px',
        md:      '6px',
        lg:      '8px',
        xl:      '12px',
      },
      boxShadow: {
        sm:      'var(--shadow-sm)',
        md:      'var(--shadow-md)',
        lg:      'var(--shadow-lg)',
        overlay: 'var(--shadow-overlay)',
      },
      spacing: {
        '4.5': '1.125rem',
        '5.5': '1.375rem',
        '13':  '3.25rem',
        '15':  '3.75rem',
        '18':  '4.5rem',
      },
    },
  },
  plugins: [],
}

export default config

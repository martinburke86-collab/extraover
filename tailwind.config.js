/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      // ── Stitch / Material Design 3 colour system ──────────────────────
      colors: {
        // ── Costline design system ─────────────────────────────────────
        // Surfaces & ground
        'background':                '#f6f7f9',
        'surface':                   '#ffffff',
        'surface-bright':            '#ffffff',
        'surface-dim':               '#eceef1',
        'surface-container-lowest':  '#ffffff',
        'surface-container-low':     '#fbfbfc',
        'surface-container':         '#f6f7f9',
        'surface-container-high':    '#f1f2f5',
        'surface-container-highest': '#eceef1',
        'surface-variant':           '#f1f2f5',
        'inverse-surface':           '#1a1d23',

        // Text
        'on-surface':                '#1a1d23',
        'on-surface-variant':        '#5b626e',
        'on-background':             '#1a1d23',
        'inverse-on-surface':        '#e6e8ed',

        // Primary (Costline accent blue — action/selection/focus only)
        'primary':                   '#1c4ed8',
        'primary-dim':               '#1a45c0',
        'on-primary':                '#ffffff',
        'primary-container':         '#eef2ff',
        'primary-fixed':             '#eef2ff',
        'primary-fixed-dim':         '#d6e0ff',
        'on-primary-container':      '#1a45c0',
        'on-primary-fixed':          '#1a45c0',
        'on-primary-fixed-variant':  '#1c4ed8',
        'surface-tint':              '#1c4ed8',
        'inverse-primary':           '#7aa2ff',

        // Secondary (neutral)
        'secondary':                 '#5b626e',
        'secondary-dim':             '#4c525d',
        'on-secondary':              '#ffffff',
        'secondary-container':       '#f1f2f5',
        'secondary-fixed':           '#f1f2f5',
        'secondary-fixed-dim':       '#e7e9ee',
        'on-secondary-container':    '#1a1d23',
        'on-secondary-fixed':        '#1a1d23',
        'on-secondary-fixed-variant':'#5b626e',

        // Tertiary (green — money-positive only)
        'tertiary':                  '#0a8a54',
        'tertiary-dim':              '#0a6e44',
        'on-tertiary':               '#ffffff',
        'tertiary-container':        '#e7f6ee',
        'tertiary-fixed':            '#e7f6ee',
        'tertiary-fixed-dim':        '#c3e8d3',
        'on-tertiary-container':     '#0a6e44',
        'on-tertiary-fixed':         '#0a6e44',
        'on-tertiary-fixed-variant': '#0a8a54',

        // Error (red — money-negative only)
        'error':                     '#c8412a',
        'error-dim':                 '#a23015',
        'on-error':                  '#ffffff',
        'error-container':           '#fbeae6',
        'on-error-container':        '#a23015',

        // Outline / borders
        'outline':                   '#e7e9ee',
        'outline-variant':           '#dfe2e7',

        // ── CVR semantic colours (Costline mapping) ──────────────────────
        'cvr-value':      '#c8412a',   // Value/CTD section headers
        'cvr-value-lt':   '#fbeae6',   // Value certified cells
        'cvr-profit':     '#b6740a',   // P&L headers
        'cvr-profit-lt':  '#fcf2e2',   // P&L cells
        'cvr-forecast':   '#0a8a54',   // Forecast headers
        'cvr-forecast-lt':'#f3faf6',   // Forecast sub-cells
        'cvr-input':      '#eef2ff',   // Editable input cells (blue = action)
      },

      fontFamily: {
        'headline': ['IBM Plex Sans', 'sans-serif'],
        'body':     ['IBM Plex Sans', 'sans-serif'],
        'label':    ['IBM Plex Mono', 'monospace'],
        'sans':     ['IBM Plex Sans', 'sans-serif'],
        'mono':     ['IBM Plex Mono', 'monospace'],
      },

      borderRadius: {
        DEFAULT: '0.5rem',
        'sm':    '0.4375rem',   // 7px — chips
        'md':    '0.5625rem',   // 9px — buttons
        'lg':    '0.75rem',     // 12px — cards
        'xl':    '0.75rem',
        '2xl':   '1rem',
        'full':  '9999px',
      },
    },
  },
  plugins: [],
}

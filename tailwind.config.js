/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      // ── Stitch / Material Design 3 colour system ──────────────────────
      colors: {
        // Core surface colours
        'background':                '#f6fafe',
        'surface':                   '#f6fafe',
        'surface-bright':            '#f6fafe',
        'surface-dim':               '#cadde9',
        'surface-container-lowest':  '#ffffff',
        'surface-container-low':     '#eef4fa',
        'surface-container':         '#e5eff7',
        'surface-container-high':    '#ddeaf3',
        'surface-container-highest': '#d5e5ef',
        'surface-variant':           '#d5e5ef',
        'inverse-surface':           '#0a0f12',

        // Text / content colours
        'on-surface':                '#26343d',
        'on-surface-variant':        '#52616a',
        'on-background':             '#26343d',
        'inverse-on-surface':        '#999da1',

        // Primary (muted slate-blue)
        'primary':                   '#565e74',
        'primary-dim':               '#4a5268',
        'on-primary':                '#f7f7ff',
        'primary-container':         '#dae2fd',
        'primary-fixed':             '#dae2fd',
        'primary-fixed-dim':         '#ccd4ee',
        'on-primary-container':      '#4a5167',
        'on-primary-fixed':          '#373f54',
        'on-primary-fixed-variant':  '#535b71',
        'surface-tint':              '#565e74',
        'inverse-primary':           '#dae2fd',

        // Secondary
        'secondary':                 '#526075',
        'secondary-dim':             '#465469',
        'on-secondary':              '#f8f8ff',
        'secondary-container':       '#d5e3fd',
        'secondary-fixed':           '#d5e3fd',
        'secondary-fixed-dim':       '#c7d5ee',
        'on-secondary-container':    '#455367',
        'on-secondary-fixed':        '#324054',
        'on-secondary-fixed-variant':'#4e5c71',

        // Tertiary (green — profit/positive)
        'tertiary':                  '#456919',
        'tertiary-dim':              '#3a5c0c',
        'on-tertiary':               '#eeffd4',
        'tertiary-container':        '#d0fc9a',
        'tertiary-fixed':            '#d0fc9a',
        'tertiary-fixed-dim':        '#c2ed8d',
        'on-tertiary-container':     '#3f6212',
        'on-tertiary-fixed':         '#2e4f00',
        'on-tertiary-fixed-variant': '#496d1c',

        // Error (red — losses/overruns)
        'error':                     '#9f403d',
        'error-dim':                 '#4e0309',
        'on-error':                  '#fff7f6',
        'error-container':           '#fe8983',
        'on-error-container':        '#752121',

        // Outline
        'outline':                   '#6e7d86',
        'outline-variant':           '#a4b4be',

        // ── CVR semantic colours (kept for functional meaning) ──────────
        'cvr-value':      '#C00000',   // Value/CTD section headers
        'cvr-value-lt':   '#FFB9B9',   // Value certified cells
        'cvr-profit':     '#FFC000',   // P&L headers
        'cvr-profit-lt':  '#FFEEB9',   // P&L cells
        'cvr-forecast':   '#DEE5B5',   // Forecast headers
        'cvr-forecast-lt':'#F1F4E0',   // Forecast sub-cells
        'cvr-input':      '#FFFFC7',   // Editable input cells
      },

      fontFamily: {
        'headline': ['Inter', 'sans-serif'],
        'body':     ['Inter', 'sans-serif'],
        'label':    ['Inter', 'sans-serif'],
        'sans':     ['Inter', 'sans-serif'],
      },

      borderRadius: {
        DEFAULT: '0.125rem',
        'sm':    '0.125rem',
        'md':    '0.25rem',
        'lg':    '0.25rem',
        'xl':    '0.5rem',
        '2xl':   '0.5rem',
        'full':  '0.75rem',
      },
    },
  },
  plugins: [],
}

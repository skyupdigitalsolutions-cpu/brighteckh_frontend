/** @type {import('tailwindcss').Config} */
// Colours are the Figma "Direction A x Brightech" tokens (00 · Foundations), exposed as CSS vars in src/index.css.
// Radius keys are prefixed `t-` so Tailwind's default rounded-sm/md/lg (used by the engineer screens) keep their values.
const v = (n) => `var(--${n})`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        canvas: v('color-bg-canvas'), surface: v('color-bg-surface'), subtle: v('color-bg-subtle'),
        inverse: v('color-bg-inverse'), 'inverse-raised': v('color-bg-inverse-raised'), disabled: v('color-bg-disabled'),
        glass: { DEFAULT: v('color-surface-glass'), strong: v('color-surface-glass-strong'), border: v('color-surface-glass-border') },
        fg: { DEFAULT: v('color-text-primary'), 2: v('color-text-secondary'), muted: v('color-text-muted'),
              inverse: v('color-text-inverse'), 'inverse-muted': v('color-text-inverse-muted'), disabled: v('color-text-disabled'),
              'on-accent': v('color-text-on-accent') },
        line: { DEFAULT: v('color-border-default'), strong: v('color-border-strong'), focus: v('color-border-focus'), inverse: v('color-border-inverse') },
        accent: { DEFAULT: v('color-accent-fill'), hover: v('color-accent-fill-hover') },
        brand: { logo: v('color-brand-logo'), subtle: v('color-brand-subtle'), text: v('color-brand-text'), gear: v('color-brand-gear'), border: v('color-brand-border') },
        warn: { fill: v('color-warning-fill'), bg: v('color-warning-bg'), fg: v('color-warning-fg'), border: v('color-warning-border') },
        danger: v('color-feedback-danger-fill'), success: v('color-feedback-success-fill'),
        st: {
          'neutral-bg': v('color-status-neutral-bg'), 'neutral-fg': v('color-status-neutral-fg'), 'neutral-bd': v('color-status-neutral-border'),
          'progress-bg': v('color-status-progress-bg'), 'progress-fg': v('color-status-progress-fg'), 'progress-bd': v('color-status-progress-border'),
          'success-bg': v('color-status-success-bg'), 'success-fg': v('color-status-success-fg'), 'success-bd': v('color-status-success-border'),
          'blocked-bg': v('color-status-blocked-bg'), 'blocked-fg': v('color-status-blocked-fg'), 'blocked-bd': v('color-status-blocked-border'),
        },
        company: { accent: v('company-accent'), subtle: v('company-subtle') },
        // Dashboard cards + chart tracks (P0 / SD0), themed in src/index.css.
        dash: {
          card: v('color-dash-card'), pill: v('color-dash-pill'), text: v('color-dash-text'), 'text-2': v('color-dash-text-2'),
          track: v('color-dash-track'), fill: v('color-dash-fill'), skeleton: v('color-dash-skeleton'),
        },
        chart: { track: v('color-chart-track'), 'bar-muted': v('color-chart-bar-muted') },
      },
      borderRadius: {
        't-sm': v('radius-sm'), 't-md': v('radius-md'), 't-lg': v('radius-lg'), 't-field': v('radius-field'),
        't-chip': v('radius-chip'), 't-popover': v('radius-popover'), 't-pill': v('radius-pill'), 't-card': v('radius-card'),
        't-toolbar': v('radius-toolbar'), 't-nav': v('radius-nav'), 't-full': v('radius-full'),
      },
      backgroundImage: { 'brand-gradient': v('gradient-brand') },
      boxShadow: { glass: v('shadow-glass'), menu: v('shadow-menu'), popover: v('shadow-popover') },
    },
  },
  plugins: [],
};

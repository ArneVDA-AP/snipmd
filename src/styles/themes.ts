import type { UIPreset } from '../ui/inspector';

export interface ThemeTokenPalette {
  '--bg-outer': string;
  '--bg-main': string;
  '--bg-bar': string;
  '--bg-tab-active': string;
  '--bg-tab-hover': string;
  '--bg-elevated': string;
  '--bg-code-inline': string;
  '--bg-snip-btn': string;
  '--border-snip-btn': string;
  '--text-snip-btn': string;
  '--bg-widget-frame': string;
  '--border': string;
  '--border-subtle': string;
  '--text-main': string;
  '--text-heading': string;
  '--text-muted': string;
  '--accent': string;
  '--accent-fg': string;
  '--accent-muted': string;
  '--syn-h': string;
  '--syn-code': string;
  '--syn-img': string;
  '--syn-quote': string;
  '--selection-bg': string;
  '--cm-active-line': string;
}

export const THEME_PALETTES: Record<UIPreset, ThemeTokenPalette> = {
  paper: {
    '--bg-outer': '#e5e4e0',
    '--bg-main': '#fafaf9',
    '--bg-bar': '#f0efeb',
    '--bg-tab-active': '#fafaf9',
    '--bg-tab-hover': '#e4e2dd',
    '--bg-elevated': '#ffffff',
    '--bg-code-inline': '#eae8e3',
    '--bg-snip-btn': '#dcfce7',
    '--border-snip-btn': '#16a34a',
    '--text-snip-btn': '#14532d',
    '--bg-widget-frame': '#f4f4f2',
    '--border': '#dcdad3',
    '--border-subtle': '#c4c1b8',
    '--text-main': '#1c1917',
    '--text-heading': '#090807',
    '--text-muted': '#655e57',
    '--accent': '#0f766e',
    '--accent-fg': '#ffffff',
    '--accent-muted': '#ccfbf1',
    '--syn-h': '#be123c',
    '--syn-code': '#0369a1',
    '--syn-img': '#15803d',
    '--syn-quote': '#57534e',
    '--selection-bg': 'rgba(15, 118, 110, 0.18)',
    '--cm-active-line': 'rgba(15, 118, 110, 0.06)'
  },
  latte: {
    '--bg-outer': '#e2dbc8',
    '--bg-main': '#f4efe6',
    '--bg-bar': '#eae2d3',
    '--bg-tab-active': '#f4efe6',
    '--bg-tab-hover': '#ded5c3',
    '--bg-elevated': '#fbf8f1',
    '--bg-code-inline': '#e6dfd0',
    '--bg-snip-btn': '#fef3c7',
    '--border-snip-btn': '#d97706',
    '--text-snip-btn': '#78350f',
    '--bg-widget-frame': '#ede6d8',
    '--border': '#d5ccb8',
    '--border-subtle': '#bfb39c',
    '--text-main': '#2c2520',
    '--text-heading': '#14100d',
    '--text-muted': '#6b5e53',
    '--accent': '#c2410c',
    '--accent-fg': '#ffffff',
    '--accent-muted': '#ffedd5',
    '--syn-h': '#b45309',
    '--syn-code': '#0f766e',
    '--syn-img': '#3f6212',
    '--syn-quote': '#655b53',
    '--selection-bg': 'rgba(194, 65, 12, 0.18)',
    '--cm-active-line': 'rgba(194, 65, 12, 0.06)'
  },
  sage: {
    '--bg-outer': '#d1ded7',
    '--bg-main': '#e8f0ec',
    '--bg-bar': '#dce7e1',
    '--bg-tab-active': '#e8f0ec',
    '--bg-tab-hover': '#cde0d6',
    '--bg-elevated': '#f3f8f5',
    '--bg-code-inline': '#d6e4dd',
    '--bg-snip-btn': '#d1fae5',
    '--border-snip-btn': '#059669',
    '--text-snip-btn': '#064e3b',
    '--bg-widget-frame': '#dfece5',
    '--border': '#c2d5cc',
    '--border-subtle': '#a3bfb2',
    '--text-main': '#16261f',
    '--text-heading': '#08120e',
    '--text-muted': '#496156',
    '--accent': '#047857',
    '--accent-fg': '#ffffff',
    '--accent-muted': '#d1fae5',
    '--syn-h': '#0f766e',
    '--syn-code': '#1d4ed8',
    '--syn-img': '#15803d',
    '--syn-quote': '#3f594e',
    '--selection-bg': 'rgba(4, 120, 87, 0.18)',
    '--cm-active-line': 'rgba(4, 120, 87, 0.06)'
  },
  nordic: {
    '--bg-outer': '#1e222a',
    '--bg-main': '#2e3440',
    '--bg-bar': '#242933',
    '--bg-tab-active': '#2e3440',
    '--bg-tab-hover': '#3b4252',
    '--bg-elevated': '#353c4a',
    '--bg-code-inline': '#3b4252',
    '--bg-snip-btn': '#243b35',
    '--border-snip-btn': '#a3be8c',
    '--text-snip-btn': '#d8f3dc',
    '--bg-widget-frame': '#242933',
    '--border': '#3b4252',
    '--border-subtle': '#4c566a',
    '--text-main': '#d8dee9',
    '--text-heading': '#eceff4',
    '--text-muted': '#9099ab',
    '--accent': '#88c0d0',
    '--accent-fg': '#0f172a',
    '--accent-muted': '#2e4b57',
    '--syn-h': '#81a1c1',
    '--syn-code': '#88c0d0',
    '--syn-img': '#a3be8c',
    '--syn-quote': '#b48ead',
    '--selection-bg': 'rgba(136, 192, 208, 0.24)',
    '--cm-active-line': 'rgba(136, 192, 208, 0.07)'
  },
  tokyo: {
    '--bg-outer': '#13141c',
    '--bg-main': '#1f2335',
    '--bg-bar': '#191b29',
    '--bg-tab-active': '#1f2335',
    '--bg-tab-hover': '#292e42',
    '--bg-elevated': '#24283b',
    '--bg-code-inline': '#292e42',
    '--bg-snip-btn': '#162c28',
    '--border-snip-btn': '#73daca',
    '--text-snip-btn': '#b4f9f8',
    '--bg-widget-frame': '#16161e',
    '--border': '#292e42',
    '--border-subtle': '#3b4261',
    '--text-main': '#c0caf5',
    '--text-heading': '#e0e6ff',
    '--text-muted': '#737aa2',
    '--accent': '#7aa2f7',
    '--accent-fg': '#0f111a',
    '--accent-muted': '#232e4f',
    '--syn-h': '#bb9af7',
    '--syn-code': '#7dcfff',
    '--syn-img': '#9ece6a',
    '--syn-quote': '#ff9e64',
    '--selection-bg': 'rgba(122, 162, 247, 0.24)',
    '--cm-active-line': 'rgba(122, 162, 247, 0.07)'
  },
  linear: {
    '--bg-outer': '#08090d',
    '--bg-main': '#0f1117',
    '--bg-bar': '#0b0c10',
    '--bg-tab-active': '#181b24',
    '--bg-tab-hover': '#141720',
    '--bg-elevated': '#161922',
    '--bg-code-inline': '#1c202b',
    '--bg-snip-btn': '#112233',
    '--border-snip-btn': '#38bdf8',
    '--text-snip-btn': '#bae6fd',
    '--bg-widget-frame': '#0b0c10',
    '--border': '#1e222d',
    '--border-subtle': '#2e3446',
    '--text-main': '#e2e8f0',
    '--text-heading': '#f8fafc',
    '--text-muted': '#64748b',
    '--accent': '#6366f1',
    '--accent-fg': '#ffffff',
    '--accent-muted': '#1e1b4b',
    '--syn-h': '#818cf8',
    '--syn-code': '#38bdf8',
    '--syn-img': '#34d399',
    '--syn-quote': '#94a3b8',
    '--selection-bg': 'rgba(99, 102, 241, 0.25)',
    '--cm-active-line': 'rgba(99, 102, 241, 0.07)'
  },
  stealth: {
    '--bg-outer': '#09090b',
    '--bg-main': '#18181b',
    '--bg-bar': '#121215',
    '--bg-tab-active': '#18181b',
    '--bg-tab-hover': '#222227',
    '--bg-elevated': '#202026',
    '--bg-code-inline': '#27272c',
    '--bg-snip-btn': '#052e16',
    '--border-snip-btn': '#166534',
    '--text-snip-btn': '#86efac',
    '--bg-widget-frame': '#0d0e12',
    '--border': '#27272c',
    '--border-subtle': '#3f3f46',
    '--text-main': '#e4e4e7',
    '--text-heading': '#fafafa',
    '--text-muted': '#71717a',
    '--accent': '#a855f7',
    '--accent-fg': '#ffffff',
    '--accent-muted': '#3b0764',
    '--syn-h': '#f472b6',
    '--syn-code': '#38bdf8',
    '--syn-img': '#4ade80',
    '--syn-quote': '#a1a1aa',
    '--selection-bg': 'rgba(168, 85, 247, 0.24)',
    '--cm-active-line': 'rgba(255, 255, 255, 0.035)'
  },
  oled: {
    '--bg-outer': '#000000',
    '--bg-main': '#050507',
    '--bg-bar': '#020203',
    '--bg-tab-active': '#0c0c10',
    '--bg-tab-hover': '#111116',
    '--bg-elevated': '#0d0d12',
    '--bg-code-inline': '#14141c',
    '--bg-snip-btn': '#271703',
    '--border-snip-btn': '#d97706',
    '--text-snip-btn': '#fde68a',
    '--bg-widget-frame': '#020203',
    '--border': '#181820',
    '--border-subtle': '#282836',
    '--text-main': '#e5e5e5',
    '--text-heading': '#ffffff',
    '--text-muted': '#737373',
    '--accent': '#f59e0b',
    '--accent-fg': '#09090b',
    '--accent-muted': '#3b2104',
    '--syn-h': '#fbbf24',
    '--syn-code': '#34d399',
    '--syn-img': '#10b981',
    '--syn-quote': '#a3a3a3',
    '--selection-bg': 'rgba(245, 158, 11, 0.25)',
    '--cm-active-line': 'rgba(245, 158, 11, 0.06)'
  }
};

export function applyThemeVariablesToDOM(preset: UIPreset): void {
  const palette = THEME_PALETTES[preset] || THEME_PALETTES.stealth;
  const root = document.documentElement;
  const body = document.body;

  root.setAttribute('data-ui-preset', preset);
  if (body) {
    body.setAttribute('data-ui-preset', preset);
  }

  for (const [key, value] of Object.entries(palette)) {
    root.style.setProperty(key, value);
    if (body) {
      body.style.setProperty(key, value);
    }
  }
}

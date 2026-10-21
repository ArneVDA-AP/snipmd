// WCAG AA for every colour pair the app uses for text and for controls, in both themes. Reads the
// tokens straight from main.css, so a palette change that breaks contrast fails here.
import { describe, expect, it } from 'vitest';
import css from './main.css?raw';

function tokens(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)) out[m[1]] = m[2];
  return out;
}
const light = tokens(css.slice(css.indexOf(':root {'), css.indexOf('@media (prefers-color-scheme: dark)')));
const darkBlock = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'));
const dark = { ...light, ...tokens(darkBlock.slice(0, darkBlock.indexOf('\n}\n'))) };

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground, background, minimum]. 4.5: text. 3: large text, icons, focus rings, control borders,
// and the dimmed Markdown marks, which repeat what the styling already shows (WCAG 1.4.11 / 1.4.3).
const PAIRS: [string, string, number][] = [
  ['text', 'bg', 4.5], ['text-strong', 'bg', 4.5], ['text-muted', 'bg', 4.5], ['text', 'chrome', 4.5],
  ['text-muted', 'chrome', 4.5], ['text', 'control', 4.5], ['text-muted', 'control', 4.5],
  ['link', 'bg', 4.5], ['code', 'bg', 4.5], ['on-accent', 'accent', 4.5], ['on-accent', 'accent-hover', 4.5],
  ['text', 'info-bg', 4.5], ['text', 'warn-bg', 4.5], ['text', 'error-bg', 4.5],
  ['text-muted', 'info-bg', 4.5], ['text-muted', 'warn-bg', 4.5], ['text-muted', 'error-bg', 4.5],
  ['error-fg', 'bg', 4.5], ['text', 'match', 4.5], ['text', 'match-current', 4.5], ['syntax', 'bg', 3], ['accent', 'bg', 3],
  ['info-fg', 'info-bg', 3], ['warn-fg', 'warn-bg', 3], ['error-fg', 'error-bg', 3],
  ['focus', 'bg', 3], ['focus', 'chrome', 3], ['focus', 'info-bg', 3], ['focus', 'warn-bg', 3], ['focus', 'error-bg', 3]
];

describe.each([['light', light], ['dark', dark]] as const)('%s theme', (_name, t) => {
  it.each(PAIRS)('%s on %s ≥ %s:1', (fg, bg, min) => {
    expect(t[fg], fg).toBeDefined();
    expect(t[bg], bg).toBeDefined();
    expect(ratio(t[fg], t[bg])).toBeGreaterThanOrEqual(min);
  });
});

// Inline SVG icons drawn on a 16-unit grid (Fluent-like strokes). Built with DOM APIs, so they
// scale crisply at any display scaling and need no icon font.
export const NS = 'http://www.w3.org/2000/svg';

const PATHS = {
  close: 'M3 3l10 10M13 3L3 13',
  plus: 'M8 2v12M2 8h12',
  minimize: 'M2 8.5h12',
  maximize: 'M2.5 2.5h11v11h-11z',
  restore: 'M4.5 4.5h9v9h-9zM2.5 11.5v-9h9',
  info: 'M8 1.5a6.5 6.5 0 1 1 0 13a6.5 6.5 0 1 1 0-13zM8 7v4.5M8 4.6v.1',
  warning: 'M8 1.8l6.7 12H1.3zM8 6.2v3.8M8 11.8v.1',
  error: 'M8 1.5a6.5 6.5 0 1 1 0 13a6.5 6.5 0 1 1 0-13zM5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8',
  book: 'M8 4c-1.6-1.2-3.6-1.5-6-1.2v10c2.4-.3 4.4 0 6 1.2c1.6-1.2 3.6-1.5 6-1.2v-10c-2.4-.3-4.4 0-6 1.2zM8 4v10'
} as const;

type IconName = keyof typeof PATHS;

export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', PATHS[name]);
  path.setAttribute('vector-effect', 'non-scaling-stroke');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(path);
  return svg;
}

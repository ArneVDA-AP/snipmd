// The demo's panel: pick a tab, play one of Snip's moments there. The moments are the ones the app
// raises itself (a pasted image, a change outside SnipMD, a tab back); here a button raises them.
import '../../../src/main';
import { button } from '../../../src/dom';
import { petMoment } from '../../../src/pet';

declare global {
  /** Set by mock.js: moves the demo's clock ahead and runs the long timers it passes. */
  function __demoSkip(ms: number): void;
}

type Play = 'clap' | 'worried' | 'relief';

const css = `
.demo { position: fixed; inset: auto 0 0 0; z-index: 10; display: grid; gap: var(--s3); padding: var(--s4) max(16px, env(safe-area-inset-right, 0px)) calc(var(--s4) + env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px)); background: var(--chrome); border-top: 1px solid var(--line); font: var(--fs-ui)/1.4 var(--font-ui); color: var(--text); }
.demo p { margin: 0; color: var(--text-muted); max-width: 62ch; }
.demo .row { display: flex; flex-wrap: wrap; gap: var(--s2); align-items: center; }
.demo .label { min-width: 4.5em; color: var(--text-muted); font-size: var(--fs-caption); letter-spacing: 0.04em; text-transform: uppercase; }
.demo button { min-height: 36px; padding: 0 var(--s3); border: 1px solid var(--line-strong); border-radius: var(--r-md); background: var(--bg); color: var(--text); font: inherit; cursor: pointer; }
.demo button:hover { background: var(--hover); }
.demo button:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
.demo button[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
@media (max-width: 700px) { .win-controls { display: none; } }
`;

const style = document.createElement('style');
style.textContent = css;
document.head.append(style);

let target: string | undefined;
const panel = document.createElement('section');
panel.className = 'demo';
panel.setAttribute('aria-label', 'Snip demo');

const intro = document.createElement('p');
intro.textContent = 'Kies een tab en speel een moment. Snip loopt erheen, reageert en loopt terug. Bij "Geen tab", een tab buiten beeld of met reduced motion blijft hij staan. Na 10 minuten zonder opslaan slaapt hij; de volgende save brengt een vriendje dat hem wekt.';

const btn = (text: string, run: () => void) => button('', text, text, run);
const tabs = () => [...document.querySelectorAll<HTMLElement>('.tabs [role="tab"]')];

/** A labelled row of buttons; `fill` redraws it. */
function row(label: string, kids: () => HTMLElement[]): HTMLElement & { fill: () => void } {
  const r = Object.assign(document.createElement('div'), { className: 'row' });
  const name = Object.assign(document.createElement('span'), { className: 'label', textContent: label });
  return Object.assign(r, { fill: () => r.replaceChildren(name, ...kids()) });
}

/** One chip per open tab, plus "no tab"; redrawn when the strip changes. */
const tabRow = row('Tab', () => {
  const open = tabs();
  if (target !== undefined && !open.some((t) => t.dataset.id === target)) target = open[0]?.dataset.id;
  const chips = open.map((t) => [t.dataset.id, t.querySelector('.tab-title')?.textContent ?? '?'] as const);
  return [...chips, [undefined, 'Geen tab'] as const].map(([id, name]) => {
    const b = btn(name, () => {
      target = id;
      tabRow.fill();
    });
    b.setAttribute('aria-pressed', String(target === id));
    return b;
  });
});

const play = (m: Play) => () => petMoment(m, target);
const moments = row('Moment', () => [
  btn('Afbeelding geplakt', play('clap')),
  btn('Gewijzigd buiten SnipMD', play('worried')),
  btn('Tab teruggehaald', play('relief')),
  btn('Twee kort na elkaar', () => {
    const ids = tabs().map((t) => t.dataset.id!);
    petMoment('clap', ids[ids.length - 1]);
    setTimeout(() => petMoment('worried', ids[0]), 400);
  })
]);
const nap = row('Dutje', () => [btn('10 minuten later', () => __demoSkip(10 * 60_000)), btn('Opslaan', () => petMoment('saved'))]);
moments.fill();
nap.fill();

panel.append(intro, tabRow, moments, nap);
document.body.append(panel);

// The strip is drawn once the session is restored; follow it from then on.
const watch = () => {
  const strip = document.querySelector('.tabs');
  if (!strip?.querySelector('[role="tab"]')) return void requestAnimationFrame(watch);
  target = tabs().at(-1)?.dataset.id;
  new MutationObserver(tabRow.fill).observe(strip, { childList: true, subtree: true, characterData: true });
  tabRow.fill();
};
watch();

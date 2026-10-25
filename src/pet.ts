// Snip, the crab right of the + button (SPEC §4). It reacts to the app's own moments, never to typing,
// and never asks for anything. The look of each state is in main.css; this module owns which one shows.
export type Moment = 'clap' | 'relief' | 'worried' | 'saved';
export type State = 'idle' | 'clap' | 'relief' | 'worried' | 'sleep';

const CELLS = 11;
/** How long a moment shows before Snip goes back to idle; matches its animation in main.css. */
const PLAY_MS: Record<'clap' | 'relief' | 'worried', number> = { clap: 1200, relief: 2400, worried: 4000 };
const SLEEP_MS = 10 * 60_000;

let svg: SVGSVGElement | null = null;
let state: State = 'idle';
/** Set once the sprites have loaded (petSprite.ts); until then only the state is kept. */
let draw: ((state: State) => void) | null = null;
let backTimer: ReturnType<typeof setTimeout> | undefined;
let sleepTimer: ReturnType<typeof setTimeout> | undefined;

function show(next: State): void {
  state = next;
  svg!.setAttribute('class', `state-${next}`);
  draw?.(next);
}

/** Whole device pixels per cell, so no edge blurs at 125% or 175%: 22 px at 100% and 200%. */
function fit(): void {
  const dpr = window.devicePixelRatio || 1;
  const px = String((CELLS * Math.max(1, Math.floor(2 * dpr))) / dpr);
  svg!.setAttribute('width', px);
  svg!.setAttribute('height', px);
}

function napLater(): void {
  clearTimeout(sleepTimer);
  sleepTimer = setTimeout(() => show('sleep'), SLEEP_MS);
}

/** Fills the tab bar's slot with Snip, idle. */
export function mountPet(slot: HTMLElement): void {
  slot.className = 'pet';
  slot.setAttribute('aria-hidden', 'true');
  slot.setAttribute('data-tauri-drag-region', ''); // the bar still drags the window from here
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('viewBox', `0 0 ${CELLS} ${CELLS}`);
  el.setAttribute('shape-rendering', 'crispEdges');
  slot.append(el);
  svg = el;
  fit();
  window.addEventListener('resize', fit); // a move to a screen with another scale resizes too
  show('idle');
  napLater();
  void import('./petSprite').then(({ drawPet }) => {
    draw = (s) => drawPet(el, s);
    draw(state);
  });
}

export function showPet(on: boolean): void {
  if (svg) (svg.parentElement as HTMLElement).hidden = !on;
}

/** Something happened in the app. A no-op until Snip is mounted. */
export function petMoment(moment: Moment): void {
  if (!svg) return;
  napLater();
  if (moment === 'saved') {
    if (state === 'sleep') show('idle');
    return;
  }
  show(moment);
  clearTimeout(backTimer);
  backTimer = setTimeout(() => show('idle'), PLAY_MS[moment]);
}

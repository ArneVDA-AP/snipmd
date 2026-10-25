// Snip, the crab right of the + button (SPEC §4). It reacts to the app's own moments, never to typing,
// and never asks for anything. A moment before Snip is mounted, or while it is switched off, is no error:
// Snip is optional, so the moments are fire-and-forget.
import { idle } from './dom';
import { NS } from './icons';

export type Moment = 'clap' | 'relief' | 'worried' | 'saved';
export type State = 'idle' | 'clap' | 'relief' | 'worried' | 'sleep';

const CELLS = 11;
/** How long a moment shows: TIMING ms × runs in petSprite.ts (pet.test.ts checks they agree). */
export const PLAY_MS: Record<'clap' | 'relief' | 'worried', number> = { clap: 1200, relief: 2400, worried: 4000 };
const SLEEP_MS = 10 * 60_000;

let slot: HTMLElement | null = null;
let svg: SVGSVGElement;
let state: State = 'idle';
/** Set once the sprites have loaded; until then only the state is kept. */
let play: ((state: State) => void) | null = null;
let backTimer: ReturnType<typeof setTimeout> | undefined;
let lastMoment = 0;

function show(next: State): void {
  state = next;
  play?.(next);
}

/** Whole device pixels per cell, so no edge blurs at 125% or 175%: 22 px at 100% and 200%. Refits on a scale change. */
function fit(): void {
  const dpr = window.devicePixelRatio || 1;
  const px = String((CELLS * Math.max(1, Math.floor(2 * dpr))) / dpr);
  svg.setAttribute('width', px);
  svg.setAttribute('height', px);
  matchMedia(`(resolution: ${dpr}dppx)`).addEventListener('change', fit, { once: true });
}

/** One timer for the nap; a moment only notes the time, so a save every second costs no timer. */
function napCheck(): void {
  const left = lastMoment + SLEEP_MS - Date.now();
  if (left <= 0) show('sleep');
  setTimeout(napCheck, left > 0 ? left : SLEEP_MS);
}

/** Fills the tab bar's slot with Snip, idle, and shows it or not. */
export function mountPet(into: HTMLElement, on: boolean): void {
  slot = into;
  slot.className = 'pet';
  slot.setAttribute('aria-hidden', 'true');
  slot.setAttribute('data-tauri-drag-region', ''); // the bar still drags the window from here
  slot.hidden = !on;
  svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${CELLS} ${CELLS}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  slot.append(svg);
  fit();
  lastMoment = Date.now();
  setTimeout(napCheck, SLEEP_MS);
  // An unfocused window plays nothing: the idle breath and the nap need no frames nobody sees.
  window.addEventListener('blur', () => svg.getAnimations({ subtree: true }).forEach((a) => a.pause()));
  window.addEventListener('focus', () => svg.getAnimations({ subtree: true }).forEach((a) => a.play()));
  idle(() =>
    void import('./petSprite')
      .then(({ drawPet }) => {
        play = drawPet(svg);
        play(state);
      })
      .catch(() => {}) // without its sprites Snip stays an empty slot
  );
}

export function showPet(on: boolean): void {
  slot!.hidden = !on;
}

/** Something happened in the app. */
export function petMoment(moment: Moment): void {
  if (!slot) return;
  lastMoment = Date.now();
  if (moment === 'saved') {
    if (state === 'sleep') show('idle');
    return;
  }
  show(moment);
  clearTimeout(backTimer);
  backTimer = setTimeout(() => show('idle'), PLAY_MS[moment]);
}

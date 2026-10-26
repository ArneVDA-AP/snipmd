// Snip, the crab right of the + button (SPEC §4). It reacts to the app's own moments, never to typing,
// and never asks for anything. A moment that belongs to a tab is played on that tab: Snip walks there
// sideways, plays it, and walks back. A moment before Snip is mounted, or while it is switched off, is no error:
// Snip is optional, so `petMoment` is fire-and-forget.
import { idle } from './dom';
import { NS } from './icons';

type Moment = 'clap' | 'relief' | 'worried' | 'saved';
export type State = 'idle' | 'clap' | 'relief' | 'worried' | 'sleep' | 'walk';

const CELLS = 11;
/** How long one run of each state lasts, and how often it runs (Infinity loops). A moment shows for `ms × runs`. */
export type Timing = Record<State, { ms: number; runs: number }>;
const TIMING: Timing = {
  idle: { ms: 6000, runs: Infinity },
  clap: { ms: 1200, runs: 1 },
  relief: { ms: 2400, runs: 1 },
  worried: { ms: 2000, runs: 2 },
  sleep: { ms: 4000, runs: Infinity },
  walk: { ms: 360, runs: Infinity }
};
const SLEEP_MS = 10 * 60_000;
/** Walking speed in cells per second, and the longest walk: a far tab is reached faster, not later. */
const CELLS_PER_S = 40;
const WALK_MAX_MS = 1400;
/** Where Snip stands over a tab: left of its close button, which stays free. */
const CLOSE_ROOM = 26;

let slot: HTMLElement;
let svg: SVGSVGElement;
let state: State = 'idle';
/** Set once the sprites have loaded; until then only the state is kept. */
let play: ((state: State) => void) | null = null;
let backTimer: ReturnType<typeof setTimeout> | undefined;
let lastSave = 0;
let tabEl: (id: string) => HTMLElement | undefined = () => undefined;
/** How far right of its slot Snip stands, in px. */
let x = 0;
let walker: Animation | undefined;
/** Where the current walk started, and whether it is still under way. */
let start = 0;
let walking = false;
/** Bumped by every moment, so a visit that a newer moment overtook stops where it is. */
let visit = 0;

function show(next: State): void {
  if (next === state && TIMING[next].runs === Infinity) return; // a loop already playing goes on
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

/** One timer for the nap; a save only notes the time, so a save every second costs no timer. */
function napCheck(): void {
  const left = lastSave + SLEEP_MS - Date.now();
  if (left <= 0) {
    clearTimeout(backTimer);
    show('sleep');
  }
  setTimeout(napCheck, left > 0 ? left : SLEEP_MS);
}

/** Fills the tab bar's slot with Snip, idle, and shows it or not. `tab` finds a tab's element in the bar. */
export function mountPet(into: HTMLElement, on: boolean, tab: (id: string) => HTMLElement | undefined): void {
  slot = into;
  tabEl = tab;
  slot.className = 'pet';
  slot.setAttribute('aria-hidden', 'true');
  slot.setAttribute('data-tauri-drag-region', ''); // the bar still drags the window from here
  slot.hidden = !on;
  svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${CELLS} ${CELLS}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  slot.append(svg);
  fit();
  lastSave = Date.now();
  napCheck();
  idle(() =>
    void import('./petSprite')
      .then(({ drawPet }) => {
        play = drawPet(svg, TIMING);
        play(state);
      })
      .catch(() => {}) // without its sprites Snip stays an empty slot
  );
}

export function showPet(on: boolean): void {
  slot.hidden = !on;
}

/**
 * Where Snip stands to play a moment on tab `id`, in px right of its slot, snapped to whole cells.
 * None when it should stay put: switched off, reduced motion, or that spot scrolled out of the strip.
 */
function spot(id: string): number | undefined {
  const el = tabEl(id);
  if (!el || slot.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
  const tab = el.getBoundingClientRect();
  const strip = el.parentElement!.getBoundingClientRect();
  const w = Number(svg.getAttribute('width'));
  const center = Math.max(tab.left + w / 2, tab.right - CLOSE_ROOM - w / 2);
  if (tab.width === 0 || center - w / 2 < strip.left || center + w / 2 > strip.right) return undefined;
  const home = slot.getBoundingClientRect();
  const cell = w / CELLS;
  return Math.round((center - (home.left + home.width / 2)) / cell) * cell;
}

/** Walks sideways to `to`, one cell per step; resolves false when a newer walk took over. */
async function walk(to: number): Promise<boolean> {
  const cell = Number(svg.getAttribute('width')) / CELLS;
  let at = x;
  if (walker && walking) {
    // A cut walk: start from where it got to, then stop it (its promise then resolves false).
    const p = walker.effect?.getComputedTiming().progress;
    if (p != null) at = Math.round((start + (x - start) * p) / cell) * cell;
    walker.cancel();
  }
  const steps = Math.max(1, Math.round(Math.abs(to - at) / cell));
  show('walk');
  const a = svg.animate([{ transform: `translateX(${at}px)` }, { transform: `translateX(${to}px)` }], {
    duration: Math.min(WALK_MAX_MS, (steps / CELLS_PER_S) * 1000),
    easing: `steps(${steps}, end)`,
    fill: 'forwards'
  });
  if (!document.hasFocus()) a.pause(); // like the frames: an unfocused window plays nothing
  walker = a;
  start = at;
  x = to;
  walking = true;
  try {
    await a.finished;
    walking = false;
    return true;
  } catch {
    return false; // cancelled by a newer walk
  }
}

/** Something happened in the app; `tab` is the tab it happened in, if any. */
export function petMoment(moment: Moment, tab?: string): void {
  if (moment === 'saved') {
    lastSave = Date.now();
    if (state === 'sleep') show('idle');
    return;
  }
  void visitTab(moment, tab);
}

async function visitTab(moment: Exclude<Moment, 'saved'>, tab: string | undefined): Promise<void> {
  const me = ++visit;
  clearTimeout(backTimer);
  const to = tab === undefined || !svg ? undefined : spot(tab);
  if (to !== undefined && (to !== x || walking) && !(await walk(to))) return;
  if (me !== visit) return;
  show(moment);
  const { ms, runs } = TIMING[moment];
  backTimer = setTimeout(async () => {
    if (x !== 0 && !(await walk(0))) return;
    if (me === visit) show('idle');
  }, ms * runs);
}

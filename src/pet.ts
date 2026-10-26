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

/** A sprite in the bar and where it stands, in px right of the slot. */
interface Crab {
  svg: SVGSVGElement;
  /** Shows a state; Snip's goes through `show`, which keeps a loop that already plays. */
  set: (state: State) => void;
  x: number;
  walker?: Animation;
  /** Where the current walk started, and whether it is still under way. */
  start: number;
  walking: boolean;
}

let slot: HTMLElement;
let state: State = 'idle';
/** Set once the sprites have loaded; until then only the state is kept. */
let play: ((state: State) => void) | null = null;
let draw: typeof import('./petSprite').drawPet | undefined;
let backTimer: ReturnType<typeof setTimeout> | undefined;
let lastSave = 0;
let tabEl: (id: string) => HTMLElement | undefined = () => undefined;
let snip: Crab;
/** The friend who wakes Snip from a nap; drawn on its first visit, then kept hidden between visits. */
let friend: Crab | undefined;
/** Bumped by every moment, so a visit that a newer moment overtook stops where it is. */
let visit = 0;

function show(next: State): void {
  if (next === state && TIMING[next].runs === Infinity) return; // a loop already playing goes on
  state = next;
  play?.(next);
}

function sprite(): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${CELLS} ${CELLS}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  return svg;
}

/** Whole device pixels per cell, so no edge blurs at 125% or 175%: 22 px at 100% and 200%. Refits on a scale change. */
function fit(): void {
  const dpr = window.devicePixelRatio || 1;
  const px = String((CELLS * Math.max(1, Math.floor(2 * dpr))) / dpr);
  for (const c of [snip, friend]) {
    c?.svg.setAttribute('width', px);
    c?.svg.setAttribute('height', px);
  }
  matchMedia(`(resolution: ${dpr}dppx)`).addEventListener('change', fit, { once: true });
}

const cellPx = () => Number(snip.svg.getAttribute('width')) / CELLS;
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

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
  snip = { svg: sprite(), set: show, x: 0, start: 0, walking: false };
  slot.append(snip.svg);
  fit();
  lastSave = Date.now();
  napCheck();
  idle(() =>
    void import('./petSprite')
      .then(({ drawPet }) => {
        draw = drawPet;
        play = drawPet(snip.svg, TIMING);
        play(state);
      })
      .catch(() => {}) // without its sprites Snip stays an empty slot
  );
}

export function showPet(on: boolean): void {
  slot.hidden = !on;
}

/** For the demo: Snip falls asleep now, as after ten minutes without a save. */
export function petNap(): void {
  lastSave = Date.now() - SLEEP_MS;
  clearTimeout(backTimer);
  show('sleep');
}

/**
 * Where Snip stands to play a moment on tab `id`, in px right of its slot, snapped to whole cells.
 * None when it should stay put: switched off, reduced motion, or that spot scrolled out of the strip.
 */
function spot(id: string): number | undefined {
  const el = tabEl(id);
  if (!el || slot.hidden || still()) return undefined;
  const tab = el.getBoundingClientRect();
  const strip = el.parentElement!.getBoundingClientRect();
  const w = cellPx() * CELLS;
  const center = Math.max(tab.left + w / 2, tab.right - CLOSE_ROOM - w / 2);
  if (tab.width === 0 || center - w / 2 < strip.left || center + w / 2 > strip.right) return undefined;
  const home = slot.getBoundingClientRect();
  return Math.round((center - (home.left + home.width / 2)) / cellPx()) * cellPx();
}

/** Walks `crab` sideways to `to`, one cell per step; resolves false when a newer walk took over. */
async function walk(crab: Crab, to: number): Promise<boolean> {
  const cell = cellPx();
  let at = crab.x;
  if (crab.walker && crab.walking) {
    // A cut walk: start from where it got to, then stop it (its promise then resolves false).
    const p = crab.walker.effect?.getComputedTiming().progress;
    if (p != null) at = Math.round((crab.start + (crab.x - crab.start) * p) / cell) * cell;
    crab.walker.cancel();
  }
  const steps = Math.max(1, Math.round(Math.abs(to - at) / cell));
  crab.set('walk');
  const a = crab.svg.animate([{ transform: `translateX(${at}px)` }, { transform: `translateX(${to}px)` }], {
    duration: Math.min(WALK_MAX_MS, (steps / CELLS_PER_S) * 1000),
    easing: `steps(${steps}, end)`,
    fill: 'forwards'
  });
  if (!document.hasFocus()) a.pause(); // like the frames: an unfocused window plays nothing
  Object.assign(crab, { walker: a, start: at, x: to, walking: true });
  try {
    await a.finished;
    crab.walking = false;
    return true;
  } catch {
    return false; // cancelled by a newer walk
  }
}

/** Something happened in the app; `tab` is the tab it happened in, if any. */
export function petMoment(moment: Moment, tab?: string): void {
  if (moment === 'saved') {
    lastSave = Date.now();
    if (state === 'sleep') void wakeUp();
    return;
  }
  void visitTab(moment, tab);
}

async function visitTab(moment: Exclude<Moment, 'saved'>, tab: string | undefined): Promise<void> {
  const me = ++visit;
  clearTimeout(backTimer);
  const to = tab === undefined || !snip ? undefined : spot(tab);
  if (to !== undefined && (to !== snip.x || snip.walking) && !(await walk(snip, to))) return;
  if (me !== visit) return;
  show(moment);
  const { ms, runs } = TIMING[moment];
  backTimer = setTimeout(async () => {
    if (snip.x !== 0 && !(await walk(snip, 0))) return;
    if (me === visit) show('idle');
  }, ms * runs);
}

/** The friend, drawn on first use in the claw and body colours swapped. None before the sprites load. */
function theFriend(): Crab | undefined {
  if (friend || !draw) return friend;
  const svg = sprite();
  svg.classList.add('friend');
  slot.append(svg);
  const play = draw(svg, TIMING);
  friend = { svg, set: play, x: 0, start: 0, walking: false };
  fit();
  return friend;
}

/**
 * The first save after a nap: a friend walks in from the right edge of the window, taps Snip awake,
 * they clap together, and the friend walks off again. A moment meanwhile takes Snip away; the friend
 * then just leaves. With reduced motion, or before the sprites load, Snip simply wakes.
 */
async function wakeUp(): Promise<void> {
  const me = ++visit;
  clearTimeout(backTimer);
  const f = slot.hidden || still() ? undefined : theFriend();
  if (!f) return show('idle');
  const cell = cellPx();
  const away = Math.ceil((window.innerWidth - slot.getBoundingClientRect().left) / cell) * cell;
  f.walker?.cancel(); // a friend still leaving from the last nap turns round off-screen
  Object.assign(f, { x: away, walking: false });
  f.svg.style.transform = `translateX(${away}px)`;
  f.svg.style.display = '';
  const leave = async () => {
    if (await walk(f, away)) f.svg.style.display = 'none';
  };
  if (!(await walk(f, snip.x + cell * (CELLS + 1))) || me !== visit) return leave();
  f.set('clap'); // the tap
  await wait(500);
  if (me !== visit) return leave();
  show('clap');
  await wait(TIMING.clap.ms);
  if (me !== visit) return leave();
  show('idle');
  f.set('idle');
  await wait(300);
  await leave();
}

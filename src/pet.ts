// Snip, the crab right of the + button (SPEC §4). It reacts to the app's own moments, never to typing,
// and never asks for anything. A moment that belongs to a tab is played on that tab: Snip walks there
// sideways, plays it, and walks back. A moment before Snip is mounted, or while it is switched off, is no error:
// Snip is optional, so `petMoment` is fire-and-forget.
import { idle } from './dom';
import { NS } from './icons';

type Moment = 'clap' | 'relief' | 'worried' | 'saved';
export type State = 'idle' | 'clap' | 'relief' | 'worried' | 'sleep' | 'walk' | 'wave';

const CELLS = 11;
/** How long one run of each state lasts, and how often it runs (Infinity loops). A moment shows for `ms × runs`. */
export type Timing = Record<State, { ms: number; runs: number }>;
const TIMING: Timing = {
  idle: { ms: 6000, runs: Infinity },
  clap: { ms: 1200, runs: 1 },
  relief: { ms: 2400, runs: 1 },
  worried: { ms: 2000, runs: 2 },
  sleep: { ms: 4000, runs: Infinity },
  walk: { ms: 360, runs: Infinity },
  wave: { ms: 500, runs: Infinity }
};
const SLEEP_MS = 10 * 60_000;
/** Walking speed in cells per second, and the longest walk: a far tab is reached faster, not later. */
const CELLS_PER_S = 40;
const WALK_MAX_MS = 1400;
/** Where Snip stands over a tab: left of its close button, which stays free. */
const CLOSE_ROOM = 26;
/** How long Snip looks round at the end of a walk, and the wait between idle glances: 20 to 45 s, never regular. */
const LOOK_MS = 300;
const GLANCE_MS = () => 20_000 + Math.random() * 25_000;

/** A sprite in the bar and where it stands, in px right of the slot. */
interface Crab {
  svg: SVGSVGElement;
  /** Shows a state; Snip's goes through `show`, which keeps a loop that already plays. */
  set: (state: State) => void;
  x: number;
  /** 1 looks left (the drawing), -1 is the drawing mirrored: looking right. */
  face: 1 | -1;
  /** The walk, or the still placement, that holds the crab where it stands. */
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
  snip = { svg: sprite(), set: show, x: 0, face: 1, start: 0, walking: false };
  setTimeout(glance, GLANCE_MS());
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

const pose = (x: number, face: number) => `translateX(${x}px) scaleX(${face})`;

/** Holds `crab` at `x`, looking `face`, with no motion: the mirror flips only the pupils, the rest is symmetric. */
function place(crab: Crab, x: number, face: 1 | -1): void {
  crab.walker?.cancel();
  const at = pose(x, face);
  crab.walker = crab.svg.animate([{ transform: at }, { transform: at }], { duration: 0, fill: 'forwards' });
  Object.assign(crab, { x, face, walking: false });
}

/** Turns a crab that stands still; one that walks keeps looking where it goes. */
function turn(crab: Crab, face: 1 | -1): void {
  if (!crab.walking && crab.face !== face) place(crab, crab.x, face);
}

/**
 * Sine in-out: how far a walk is, `0`–`1`, at time `t`, and when it gets to `p`. A cut walk starts the
 * next one from standing too: a short stop, as if Snip changes its mind, instead of a jolt to full speed.
 */
const ease = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;
const easeAt = (p: number) => Math.acos(1 - 2 * p) / Math.PI;

/**
 * Walks `crab` sideways to `to`, one cell per step, looking where it goes: slow to start, quicker in
 * the middle, slowing to stop. Resolves false when a newer walk took over.
 */
async function walk(crab: Crab, to: number): Promise<boolean> {
  const cell = cellPx();
  let at = crab.x;
  if (crab.walker && crab.walking) {
    // A cut walk: start from the last cell it reached, then stop it (its promise then resolves false).
    // The timing is linear and the keyframes carry the easing, so the cell comes from the eased curve.
    const t = crab.walker.effect?.getComputedTiming().progress;
    const cells = Math.round(Math.abs(crab.x - crab.start) / cell);
    if (t != null) at = crab.start + Math.sign(crab.x - crab.start) * Math.floor(cells * ease(t) + 1e-9) * cell;
  }
  crab.walker?.cancel();
  const steps = Math.max(1, Math.round(Math.abs(to - at) / cell));
  const face = to > at ? -1 : to < at ? 1 : crab.face;
  const step = (to - at) / steps;
  // One keyframe per cell, held until the eased curve reaches the next cell.
  const keys: Keyframe[] = Array.from({ length: steps + 1 }, (_, k) => ({
    offset: easeAt(k / steps),
    easing: 'step-end',
    transform: pose(at + k * step, face)
  }));
  crab.set('walk');
  const a = crab.svg.animate(keys, { duration: Math.min(WALK_MAX_MS, (steps / CELLS_PER_S) * 1000), fill: 'forwards' });
  if (!document.hasFocus()) a.pause(); // like the frames: an unfocused window plays nothing
  Object.assign(crab, { walker: a, start: at, x: to, face, walking: true });
  try {
    await a.finished;
    crab.walking = false;
    return true;
  } catch {
    return false; // cancelled by a newer walk
  }
}

/** Now and then, idle at home, Snip looks right for a moment. Only while the window has focus. */
function glance(): void {
  setTimeout(glance, GLANCE_MS());
  if (state !== 'idle' || snip.x !== 0 || snip.walking || slot.hidden || still() || !document.hasFocus()) return;
  const me = visit;
  turn(snip, -1);
  setTimeout(() => me === visit && turn(snip, 1), 900);
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
  turn(snip, 1);
  show(moment);
  const { ms, runs } = TIMING[moment];
  backTimer = setTimeout(async () => {
    if (snip.x !== 0 && !(await walk(snip, 0))) return;
    if (me !== visit) return;
    show('idle');
    await wait(LOOK_MS); // home, it looks back over the bar before it turns round
    if (me === visit) turn(snip, 1);
  }, ms * runs);
}

/** The friend, drawn on first use in the claw and body colours swapped. None before the sprites load. */
function theFriend(): Crab | undefined {
  if (friend || !draw) return friend;
  const svg = sprite();
  svg.classList.add('friend');
  slot.append(svg);
  const play = draw(svg, TIMING);
  friend = { svg, set: play, x: 0, face: 1, start: 0, walking: false };
  fit();
  return friend;
}

/**
 * The first save after a nap: a friend walks in from the right edge of the window, taps Snip awake,
 * Snip turns to it and they clap together, the friend waves and walks off, and Snip watches it go.
 * A moment meanwhile takes Snip away; the friend then just leaves. With reduced motion, or before the
 * sprites load, Snip simply wakes.
 */
async function wakeUp(): Promise<void> {
  const me = ++visit;
  clearTimeout(backTimer);
  const f = slot.hidden || still() ? undefined : theFriend();
  if (!f) return show('idle');
  const cell = cellPx();
  const away = Math.ceil((window.innerWidth - slot.getBoundingClientRect().left) / cell) * cell;
  place(f, away, 1); // a friend still leaving from the last nap turns round off-screen
  f.svg.classList.remove('gone');
  const leave = async () => {
    if (await walk(f, away)) f.svg.classList.add('gone');
  };
  if (!(await walk(f, snip.x + cell * (CELLS + 1))) || me !== visit) return leave();
  f.set('clap'); // the tap
  await wait(500);
  if (me !== visit) return leave();
  turn(snip, -1);
  show('clap');
  await wait(TIMING.clap.ms);
  if (me !== visit) return leave();
  show('idle');
  f.set('wave');
  await wait(700);
  const gone = leave();
  await wait(700);
  if (me === visit) show('wave'); // and Snip waves back
  await gone;
  await wait(LOOK_MS);
  if (me === visit) {
    show('idle');
    turn(snip, 1);
  }
}

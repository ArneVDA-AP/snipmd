import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// jsdom has neither media queries nor Web Animations: record what Snip asks for.
const played: { el: Element; keys: Keyframe[]; opts: KeyframeAnimationOptions; paused: boolean; done: () => void; cut: () => void }[] = [];
let reduced = false;
let focused = true;

const box = (left: number, width: number) => ({ left, right: left + width, width }) as DOMRect;
/** Two tabs in a strip from 0 to 80 px: `a` in view, `b` scrolled half out. */
const strip = document.createElement('div');
strip.getBoundingClientRect = () => box(0, 80);
const tabs: Record<string, HTMLElement> = {};
for (const [id, left] of [['a', 0], ['b', 60]] as const) {
  tabs[id] = document.createElement('div');
  tabs[id].getBoundingClientRect = () => box(left, 60);
  strip.append(tabs[id]);
}
/** The walks Snip started, as [from, to] px. */
const walks = () => played.filter((p) => p.el.tagName === 'svg').map((p) => p.keys.map((k) => k.transform));

async function mounted(dpr = 1, on = true) {
  vi.resetModules();
  played.length = 0;
  Object.defineProperty(window, 'devicePixelRatio', { value: dpr, configurable: true });
  window.matchMedia = ((q: string) => ({ matches: q.includes('reduce') && reduced, addEventListener: () => {} })) as never;
  vi.spyOn(document, 'hasFocus').mockImplementation(() => focused);
  Element.prototype.animate = function (this: Element, keys: Keyframe[], opts: KeyframeAnimationOptions) {
    let done = () => {};
    let cut = () => {};
    const finished = new Promise<void>((res, rej) => ((done = res), (cut = rej)));
    finished.catch(() => {});
    const a = { el: this, keys, opts, paused: false, done, cut };
    played.push(a);
    return {
      finished,
      pause: () => (a.paused = true),
      cancel: () => cut(),
      effect: { getComputedTiming: () => ({ progress: 0.5 }) }
    } as unknown as Animation;
  } as never;
  Element.prototype.getAnimations = () => [];
  const pet = await import('./pet');
  const slot = document.createElement('span');
  slot.getBoundingClientRect = () => box(100, 22);
  pet.mountPet(slot, on, (id) => tabs[id]);
  vi.advanceTimersByTime(200); // the sprites load when the window is idle
  await vi.dynamicImportSettled();
  const svg = slot.firstElementChild!;
  /** The state whose strip shows. */
  const state = () => ['idle', 'clap', 'relief', 'worried', 'sleep', 'walk'][[...svg.children].findIndex((g) => g.getAttribute('display') === 'inline')];
  return { pet, slot, svg, state };
}

describe('Snip', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    reduced = false;
    focused = true;
  });

  it('starts idle, hidden from screen readers, every state drawn once as paths per part', async () => {
    const { slot, svg, state } = await mounted();
    expect(slot.getAttribute('aria-hidden')).toBe('true');
    expect(state()).toBe('idle');
    expect(svg.children).toHaveLength(6);
    const idleParts = new Set([...svg.children[0].querySelectorAll('path')].map((p) => p.getAttribute('class')));
    expect([...idleParts].sort()).toEqual(['body', 'claw', 'eye', 'pupil']);
  });

  it('claps on a pasted image and goes back to idle when the clap is over', async () => {
    const { pet, state } = await mounted();
    pet.petMoment('clap');
    expect(state()).toBe('clap');
    vi.advanceTimersByTime(1199);
    expect(state()).toBe('clap');
    vi.advanceTimersByTime(1);
    expect(state()).toBe('idle');
  });

  it('a new moment replaces the one playing, with its own length', async () => {
    const { pet, state } = await mounted();
    pet.petMoment('clap');
    vi.advanceTimersByTime(1000);
    pet.petMoment('worried');
    vi.advanceTimersByTime(3999);
    expect(state()).toBe('worried');
    vi.advanceTimersByTime(1);
    expect(state()).toBe('idle');
  });

  it('falls asleep after ten minutes without a save; a save wakes it', async () => {
    const { pet, state } = await mounted();
    vi.advanceTimersByTime(9 * 60_000);
    pet.petMoment('saved');
    vi.advanceTimersByTime(9 * 60_000);
    expect(state()).toBe('idle');
    vi.advanceTimersByTime(60_000);
    expect(state()).toBe('sleep');
    reduced = true; // without the friend's visit (next test) a save wakes it at once
    pet.petMoment('saved');
    expect(state()).toBe('idle');
  });

  it('after a nap a friend walks in from the window edge, taps Snip awake, they clap and it walks off', async () => {
    const { pet, slot, state } = await mounted();
    pet.petNap();
    pet.petMoment('saved');
    const friend = slot.querySelector('svg.friend') as SVGSVGElement;
    expect(walks()).toEqual([['translateX(924px)', 'translateX(24px)']]); // from x = 1024, to one cell right of Snip
    expect(state()).toBe('sleep');
    played.findLast((p) => p.el === friend)!.done();
    await vi.advanceTimersByTimeAsync(500);
    expect(state()).toBe('clap');
    await vi.advanceTimersByTimeAsync(1500);
    expect(state()).toBe('idle');
    expect(walks()[1]).toEqual(['translateX(24px)', 'translateX(924px)']);
    played.findLast((p) => p.el === friend)!.done();
    await vi.advanceTimersByTimeAsync(0);
    expect(friend.style.display).toBe('none');
  });

  it('a moment during the visit takes Snip away, and the friend leaves', async () => {
    const { pet, state } = await mounted();
    pet.petNap();
    pet.petMoment('saved');
    played.at(-1)!.done();
    await vi.advanceTimersByTimeAsync(100);
    pet.petMoment('worried');
    await vi.advanceTimersByTimeAsync(400);
    expect(state()).toBe('worried');
    expect(walks()[1]).toEqual(['translateX(24px)', 'translateX(924px)']);
  });

  it('other moments do not keep it awake, and asleep it does not restart its nap', async () => {
    const { pet, state } = await mounted();
    vi.advanceTimersByTime(9 * 60_000);
    pet.petMoment('clap');
    vi.advanceTimersByTime(60_000);
    expect(state()).toBe('sleep');
    const n = played.length;
    vi.advanceTimersByTime(30 * 60_000);
    expect(played).toHaveLength(n);
  });

  it('an animation that starts while the window has no focus starts paused', async () => {
    const { pet } = await mounted();
    expect(played.at(-1)!.paused).toBe(false);
    focused = false;
    pet.petMoment('worried');
    expect(played.at(-1)!.paused).toBe(true);
    vi.advanceTimersByTime(4000); // back to idle, still unfocused
    expect(played.at(-1)!.paused).toBe(true);
  });

  it('a save while awake does not interrupt a moment', async () => {
    const { pet, state } = await mounted();
    pet.petMoment('relief');
    pet.petMoment('saved');
    expect(state()).toBe('relief');
  });

  it('slides the strip from frame to frame, holding each frame (step-end), and loops idle', async () => {
    const { pet } = await mounted();
    pet.petMoment('relief');
    const relief = played[played.length - 1];
    expect(relief.keys.map((k) => k.transform)).toEqual(['translateX(0px)', 'translateX(-11px)', 'translateX(0px)', 'translateX(0px)']);
    expect(relief.keys.every((k) => k.easing === 'step-end')).toBe(true);
    expect(relief.opts).toEqual({ duration: 2400, iterations: 1 });
    expect(played[0].opts.iterations).toBe(Infinity);
  });

  it('with reduced motion shows still frames and animates nothing', async () => {
    reduced = true;
    const { pet, state } = await mounted();
    pet.petMoment('clap');
    expect(state()).toBe('clap');
    expect(played).toHaveLength(0);
  });

  it('walks to the tab of a moment, plays it there, and walks back', async () => {
    const { pet, state } = await mounted();
    pet.petMoment('clap', 'a');
    expect(state()).toBe('walk');
    // tab a ends at 60: Snip's middle 26 + 11 px left of that, in whole 2 px cells, from its own middle at 111
    expect(walks()).toEqual([['translateX(0px)', 'translateX(-88px)']]);
    played.at(-1)!.done();
    await vi.advanceTimersByTimeAsync(0);
    expect(state()).toBe('clap');
    vi.advanceTimersByTime(1200);
    expect(state()).toBe('walk');
    expect(walks()[1]).toEqual(['translateX(-88px)', 'translateX(0px)']);
    played.at(-1)!.done();
    await vi.advanceTimersByTimeAsync(0);
    expect(state()).toBe('idle');
  });

  it('a newer moment cuts the walk and starts from where Snip got to', async () => {
    const { pet, state } = await mounted();
    pet.petMoment('clap', 'a');
    pet.petMoment('worried', 'a');
    await vi.advanceTimersByTimeAsync(0);
    expect(walks()[1]).toEqual(['translateX(-44px)', 'translateX(-88px)']); // halfway, per the mocked progress
    played.at(-1)!.done();
    await vi.advanceTimersByTimeAsync(0);
    expect(state()).toBe('worried');
  });

  it('plays in place for a tab out of view, without a tab, or with reduced motion', async () => {
    const { pet, state } = await mounted();
    pet.petMoment('clap', 'b');
    pet.petMoment('relief');
    expect(state()).toBe('relief');
    expect(walks()).toEqual([]);
    reduced = true;
    pet.petMoment('clap', 'a');
    expect(walks()).toEqual([]);
  });

  it.each([
    [1, '22'],
    [1.25, '17.6'],
    [1.5, '22'],
    [1.75, '18.857142857142858'],
    [2, '22']
  ])('at scale %s it is %s px: a whole number of device pixels per cell', async (dpr, px) => {
    const { svg } = await mounted(dpr);
    expect(svg.getAttribute('width')).toBe(px);
    expect((Number(px) * dpr) % 11).toBeCloseTo(0);
  });

  it('starts hidden when switched off, and can be shown and hidden', async () => {
    const { pet, slot } = await mounted(1, false);
    expect(slot.hidden).toBe(true);
    pet.showPet(true);
    expect(slot.hidden).toBe(false);
    pet.showPet(false);
    expect(slot.hidden).toBe(true);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// jsdom has neither media queries nor Web Animations: record what Snip asks for.
const played: { keys: Keyframe[]; opts: KeyframeAnimationOptions; paused: boolean }[] = [];
let reduced = false;
let focused = true;

async function mounted(dpr = 1, on = true) {
  vi.resetModules();
  played.length = 0;
  Object.defineProperty(window, 'devicePixelRatio', { value: dpr, configurable: true });
  window.matchMedia = ((q: string) => ({ matches: q.includes('reduce') && reduced, addEventListener: () => {} })) as never;
  vi.spyOn(document, 'hasFocus').mockImplementation(() => focused);
  Element.prototype.animate = function (keys: Keyframe[], opts: KeyframeAnimationOptions) {
    const a = { keys, opts, paused: false };
    played.push(a);
    return { pause: () => (a.paused = true) } as unknown as Animation;
  } as never;
  Element.prototype.getAnimations = () => [];
  const pet = await import('./pet');
  const slot = document.createElement('span');
  pet.mountPet(slot, on);
  vi.advanceTimersByTime(200); // the sprites load when the window is idle
  await vi.dynamicImportSettled();
  const svg = slot.firstElementChild!;
  /** The state whose strip shows. */
  const state = () => ['idle', 'clap', 'relief', 'worried', 'sleep'][[...svg.children].findIndex((g) => g.getAttribute('display') === 'inline')];
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
    expect(svg.children).toHaveLength(5);
    const idleParts = new Set([...svg.children[0].querySelectorAll('path')].map((p) => p.getAttribute('class')));
    expect([...idleParts].sort()).toEqual(['body', 'claw', 'eye']);
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
    pet.petMoment('saved');
    expect(state()).toBe('idle');
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

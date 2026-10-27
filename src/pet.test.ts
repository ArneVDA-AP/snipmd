import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// jsdom has neither media queries nor Web Animations: record what Snip asks for.
const played: { el: Element; keys: Keyframe[]; opts: KeyframeAnimationOptions; paused: boolean; done: () => void; cut: () => void }[] = [];
let reduced = false;
let focused = true;
/** How far, in time, a cut animation got. */
let progress = 0.5;

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
/** The walks the crabs started, as their first and last pose; a still placement (duration 0) is no walk. */
const walks = () => played.filter((p) => p.el.tagName === 'svg' && p.opts.duration).map((p) => [p.keys[0].transform, p.keys.at(-1)!.transform]);

async function mounted(dpr = 1, on = true) {
  vi.resetModules();
  played.length = 0;
  Object.defineProperty(window, 'devicePixelRatio', { value: dpr, configurable: true });
  window.matchMedia = ((q: string) => ({ get matches() { return q.includes('reduce') && reduced; }, addEventListener: () => {} })) as never; // live, like a real query
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
      effect: { getComputedTiming: () => ({ progress }) }
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
  const state = () => ['idle', 'clap', 'relief', 'worried', 'sleep', 'walk', 'wave'][[...svg.children].findIndex((g) => g.getAttribute('display') === 'inline')];
  return { pet, slot, svg, state };
}

describe('Snip', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    reduced = false;
    focused = true;
    progress = 0.5;
  });

  it('starts idle, hidden from screen readers, every state drawn once as paths per part', async () => {
    const { slot, svg, state } = await mounted();
    expect(slot.getAttribute('aria-hidden')).toBe('true');
    expect(state()).toBe('idle');
    expect(svg.children).toHaveLength(7);
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

  it('after a nap a friend walks in from the window edge, taps Snip awake, they clap, wave, and it walks off', async () => {
    const { pet, slot, svg, state } = await mounted();
    vi.advanceTimersByTime(10 * 60_000);
    pet.petMoment('saved');
    const friend = slot.querySelector('svg.friend') as SVGSVGElement;
    const lastOf = (el: Element) => played.filter((p) => p.el === el).at(-1)!;
    // from x = 1024, looking left at Snip, to one cell right of it
    expect(walks()).toEqual([['translateX(924px) scaleX(1)', 'translateX(24px) scaleX(1)']]);
    expect(state()).toBe('sleep');
    lastOf(friend).done();
    await vi.advanceTimersByTimeAsync(500);
    expect(state()).toBe('clap');
    expect(lastOf(svg).keys[0].transform).toBe('translateX(0px) scaleX(-1)'); // Snip turned to its friend
    await vi.advanceTimersByTimeAsync(1200);
    expect(state()).toBe('idle');
    await vi.advanceTimersByTimeAsync(700);
    expect(walks()[1]).toEqual(['translateX(24px) scaleX(-1)', 'translateX(924px) scaleX(-1)']);
    await vi.advanceTimersByTimeAsync(700);
    expect(state()).toBe('wave');
    lastOf(friend).done();
    await vi.advanceTimersByTimeAsync(300);
    expect(friend.classList.contains('gone')).toBe(true);
    expect(state()).toBe('idle');
    expect(lastOf(svg).keys[0].transform).toBe('translateX(0px) scaleX(1)'); // and turned back
  });

  it('a moment during the visit takes Snip away, and the friend leaves', async () => {
    const { pet, state } = await mounted();
    vi.advanceTimersByTime(10 * 60_000);
    pet.petMoment('saved');
    played.at(-1)!.done();
    await vi.advanceTimersByTimeAsync(100);
    pet.petMoment('worried');
    await vi.advanceTimersByTimeAsync(400);
    expect(state()).toBe('worried');
    expect(walks()[1]).toEqual(['translateX(24px) scaleX(-1)', 'translateX(924px) scaleX(-1)']);
  });

  it('idle at home it glances right now and then, at irregular times, and looks back', async () => {
    const { svg } = await mounted();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const poses = () => played.filter((p) => p.el === svg).map((p) => p.keys[0].transform);
    await vi.advanceTimersByTimeAsync(45_000); // the first glance comes within 45 s
    expect(poses()).toContain('translateX(0px) scaleX(-1)');
    await vi.advanceTimersByTimeAsync(900);
    expect(poses().at(-1)).toBe('translateX(0px) scaleX(1)');
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
    // tab a ends at 60: Snip's middle 26 + 11 px left of that, in whole 2 px cells, from its own middle at 111;
    // walking left it looks left, as drawn
    expect(walks()).toEqual([['translateX(0px) scaleX(1)', 'translateX(-88px) scaleX(1)']]);
    // one keyframe per cell, eased: the first and last hops take longer than the middle ones
    const at = played.at(-1)!.keys.map((k) => k.offset as number);
    expect(at).toHaveLength(45);
    const hop = (i: number) => at[i + 1] - at[i];
    expect(hop(0)).toBeGreaterThan(hop(22));
    expect(hop(43)).toBeGreaterThan(hop(22));
    played.at(-1)!.done();
    await vi.advanceTimersByTimeAsync(0);
    expect(state()).toBe('clap');
    vi.advanceTimersByTime(1200);
    expect(state()).toBe('walk');
    expect(walks()[1]).toEqual(['translateX(-88px) scaleX(-1)', 'translateX(0px) scaleX(-1)']); // looking where it goes
    played.at(-1)!.done();
    await vi.advanceTimersByTimeAsync(0);
    expect(state()).toBe('idle');
  });

  it('blur pauses only what runs and focus plays only what it paused, so a finished walk stays put', async () => {
    const { svg } = await mounted();
    const anim = (playState: string) => {
      const a = { playState, pause: vi.fn(() => (a.playState = 'paused')), play: vi.fn() };
      return a;
    };
    const running = anim('running');
    const done = anim('finished');
    svg.getAnimations = () => [running, done] as never;
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new Event('focus'));
    expect(running.pause).toHaveBeenCalled();
    expect(running.play).toHaveBeenCalled();
    expect(done.pause).not.toHaveBeenCalled();
    expect(done.play).not.toHaveBeenCalled(); // play() on a finished walk would walk it again
  });

  it('a newer moment cuts the walk and starts from where Snip got to', async () => {
    const { pet, state } = await mounted();
    pet.petMoment('clap', 'a');
    pet.petMoment('worried', 'a');
    await vi.advanceTimersByTimeAsync(0);
    expect(walks()[1]).toEqual(['translateX(-44px) scaleX(1)', 'translateX(-88px) scaleX(1)']); // halfway in time is halfway on the curve
    played.at(-1)!.done();
    await vi.advanceTimersByTimeAsync(0);
    expect(state()).toBe('worried');
  });

  it('a walk cut early starts from the cell the eased walk reached, not from a straight line', async () => {
    const { pet } = await mounted();
    progress = 0.25; // a quarter of the time: slow to start, so 6 of the 44 cells, where a straight line has 11
    pet.petMoment('clap', 'a');
    pet.petMoment('worried', 'a');
    await vi.advanceTimersByTimeAsync(0);
    expect(walks()[1][0]).toBe('translateX(-12px) scaleX(1)');
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

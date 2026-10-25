import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function mounted(dpr = 1) {
  vi.resetModules();
  Object.defineProperty(window, 'devicePixelRatio', { value: dpr, configurable: true });
  const pet = await import('./pet');
  const slot = document.createElement('span');
  pet.mountPet(slot);
  await vi.dynamicImportSettled();
  const svg = slot.firstElementChild!;
  const state = () => svg.getAttribute('class');
  return { pet, slot, svg, state };
}

describe('Snip', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does nothing before it is mounted', async () => {
    vi.resetModules();
    const { petMoment } = await import('./pet');
    expect(() => petMoment('clap')).not.toThrow();
  });

  it('starts idle, hidden from screen readers, with three frames drawn as paths per part', async () => {
    const { slot, svg, state } = await mounted();
    expect(slot.getAttribute('aria-hidden')).toBe('true');
    expect(state()).toBe('state-idle');
    expect(svg.querySelectorAll('.frame')).toHaveLength(3);
    const parts = [...svg.querySelectorAll('.frame-1 path')].map((p) => p.getAttribute('class'));
    expect(parts.sort()).toEqual(['body', 'claw', 'eye']);
  });

  it('claps on a pasted image and goes back to idle when the clap is over', async () => {
    const { pet, state } = await mounted();
    pet.petMoment('clap');
    expect(state()).toBe('state-clap');
    vi.advanceTimersByTime(1199);
    expect(state()).toBe('state-clap');
    vi.advanceTimersByTime(1);
    expect(state()).toBe('state-idle');
  });

  it('a new moment replaces the one playing, with its own length', async () => {
    const { pet, state } = await mounted();
    pet.petMoment('clap');
    vi.advanceTimersByTime(1000);
    pet.petMoment('worried');
    vi.advanceTimersByTime(3999);
    expect(state()).toBe('state-worried');
    vi.advanceTimersByTime(1);
    expect(state()).toBe('state-idle');
  });

  it('falls asleep after ten quiet minutes; a save wakes it, and any moment keeps it awake', async () => {
    const { pet, state } = await mounted();
    vi.advanceTimersByTime(9 * 60_000);
    pet.petMoment('saved');
    vi.advanceTimersByTime(9 * 60_000);
    expect(state()).toBe('state-idle');
    vi.advanceTimersByTime(60_000);
    expect(state()).toBe('state-sleep');
    pet.petMoment('saved');
    expect(state()).toBe('state-idle');
  });

  it('a save while awake does not interrupt a moment', async () => {
    const { pet, state } = await mounted();
    pet.petMoment('relief');
    pet.petMoment('saved');
    expect(state()).toBe('state-relief');
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

  it('can be hidden and shown', async () => {
    const { pet, slot } = await mounted();
    pet.showPet(false);
    expect(slot.hidden).toBe(true);
    pet.showPet(true);
    expect(slot.hidden).toBe(false);
  });
});

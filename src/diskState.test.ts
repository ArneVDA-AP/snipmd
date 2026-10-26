import { describe, expect, it, vi } from 'vitest';

vi.mock('./pet', () => ({ petMoment: vi.fn() }));

import { petMoment } from './pet';
import { beginWrite, endWrite, inConflict, isWriting, setConflict, writeGeneration } from './diskState';

describe('writes in progress', () => {
  it('a tab is writing until every write that began has ended', () => {
    expect(isWriting('w')).toBe(false);
    beginWrite('w');
    beginWrite('w'); // an autosave and a Save As of the same tab can overlap
    endWrite('w');
    expect(isWriting('w')).toBe(true);
    endWrite('w');
    expect(isWriting('w')).toBe(false);
    expect(isWriting('other')).toBe(false);
  });

  it('the generation changes when a write starts and when it ends, and only then', () => {
    const g0 = writeGeneration('g');
    expect(writeGeneration('g')).toBe(g0);
    beginWrite('g');
    const g1 = writeGeneration('g');
    expect(g1).not.toBe(g0);
    endWrite('g');
    const g2 = writeGeneration('g');
    expect(g2).not.toBe(g1);
    expect(g2).not.toBe(g0);
    expect(writeGeneration('other')).toBe(0);
  });

  it('an unmatched end leaves the tab not writing', () => {
    endWrite('e');
    expect(isWriting('e')).toBe(false);
    beginWrite('e');
    expect(isWriting('e')).toBe(true);
    endWrite('e');
    expect(isWriting('e')).toBe(false);
  });
});

describe('conflicts', () => {
  it('are per tab and can be cleared', () => {
    setConflict('c', true);
    setConflict('c', true);
    expect(petMoment).toHaveBeenCalledTimes(1); // Snip is worried once, when the conflict starts
    expect(petMoment).toHaveBeenCalledWith('worried', 'c');
    expect(inConflict('c')).toBe(true);
    expect(inConflict('d')).toBe(false);
    setConflict('c', false);
    expect(inConflict('c')).toBe(false);
  });
});

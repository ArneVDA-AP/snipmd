import { describe, expect, it, vi } from 'vitest';
import { applyToTab, getState, imageSavesRunning, imageSavesSettled, initRegistry, setState, trackImageSave } from './registry';
import { createEditorState } from './setup';

const deferred = () => {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
};

describe('image saves in flight', () => {
  it('a tab has a save running until it lands or fails', async () => {
    const a = deferred();
    const b = deferred();
    void trackImageSave('t1', a.promise);
    void trackImageSave('t1', b.promise).catch(() => {});
    expect(imageSavesRunning('t1')).toBe(true);
    expect(imageSavesRunning('t2')).toBe(false);
    a.resolve();
    await a.promise;
    expect(imageSavesRunning('t1')).toBe(true);
    b.reject('disk full');
    await b.promise.catch(() => {});
    await Promise.resolve();
    expect(imageSavesRunning('t1')).toBe(false);
  });

  it('settled waits for every save running now, failed ones too', async () => {
    const a = deferred();
    const b = deferred();
    void trackImageSave('x', a.promise);
    void trackImageSave('y', b.promise).catch(() => {});
    let done = false;
    const all = imageSavesSettled().then(() => (done = true));
    await Promise.resolve();
    a.resolve();
    await a.promise;
    expect(done).toBe(false);
    b.reject('no');
    await all;
    expect(done).toBe(true);
  });
});

describe('image saves of one tab', () => {
  it('an earlier save still running keeps the tab busy after a later one landed', async () => {
    const a = deferred();
    const b = deferred();
    void trackImageSave('t3', a.promise);
    void trackImageSave('t3', b.promise);
    b.resolve();
    await b.promise;
    await Promise.resolve();
    expect(imageSavesRunning('t3')).toBe(true);
    a.resolve();
    await a.promise;
    await Promise.resolve();
    expect(imageSavesRunning('t3')).toBe(false);
  });

  it("settled for one tab waits for that tab's saves and not for another tab's", async () => {
    const mine = deferred();
    const other = deferred();
    void trackImageSave('m', mine.promise);
    void trackImageSave('o', other.promise);
    let done = false;
    const all = imageSavesSettled('m').then(() => (done = true));
    await Promise.resolve();
    expect(done).toBe(false);
    mine.resolve();
    await all;
    expect(done).toBe(true); // other is still pending
    let none = false;
    await imageSavesSettled('nothing-running').then(() => (none = true));
    expect(none).toBe(true);
  });
});

describe('applyToTab on a hidden tab', () => {
  it('reports a change only when the document changed', () => {
    const onChange = vi.fn();
    initRegistry({ filePathOf: () => null, onChange });
    setState('h1', createEditorState('h1', 'abc'));
    expect(applyToTab('h1', { selection: { anchor: 1 } })).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
    expect(applyToTab('h1', { changes: { from: 3, insert: 'd' } })).toBe(true);
    expect(onChange).toHaveBeenCalledWith('h1');
    expect(getState('h1')!.doc.toString()).toBe('abcd');
    expect(applyToTab('gone', { changes: { from: 0, insert: 'x' } })).toBe(false);
  });
});

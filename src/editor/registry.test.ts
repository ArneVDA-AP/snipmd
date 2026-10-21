import { describe, expect, it } from 'vitest';
import { imageSavesRunning, imageSavesSettled, trackImageSave } from './registry';

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

import { describe, expect, it, vi } from 'vitest';
import { mountInfobar } from '/home/user/snipmd/src/infobar';
import { toggleCommandMenu } from '/home/user/snipmd/src/commandMenu';
Element.prototype.scrollIntoView ??= function () {};
describe('probe: held Enter on a toggle row', () => {
  it('flips the toggle once per key repeat', () => {
    const top = document.createElement('div'), bottom = document.createElement('div');
    document.body.append(top, bottom);
    mountInfobar(top, bottom, () => {});
    let on = false;
    const run = vi.fn(() => { on = !on; });
    toggleCommandMenu(() => [{ id: 't', title: 'Line breaks in read mode', checked: () => on, run: () => {} }], run);
    const input = top.querySelector('input')!;
    for (const repeat of [false, true, true, true]) input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat, bubbles: true, cancelable: true }));
    console.log('runs for one held Enter (1 press + 3 repeats):', run.mock.calls.length, 'final state', on);
    expect(run).toHaveBeenCalledTimes(1);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearInfo, mountInfobar, showInfo } from './infobar';

let top: HTMLElement;
let bottom: HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  top = document.createElement('div');
  bottom = document.createElement('div');
  mountInfobar(top, bottom);
});
afterEach(() => vi.useRealTimers());

describe('infobar', () => {
  it('the newest message replaces the bar', () => {
    showInfo({ kind: 'info', text: 'one' });
    showInfo({ kind: 'info', text: 'two' });
    expect(top.children.length).toBe(1);
    expect(top.textContent).toContain('two');
    expect(top.textContent).not.toContain('one');
  });

  it('the same kind and text keeps the bar and returns a working dismiss', () => {
    showInfo({ kind: 'error', text: 'x' });
    const bar = top.firstElementChild;
    const dismiss = showInfo({ kind: 'error', text: 'x' });
    expect(top.firstElementChild).toBe(bar);
    dismiss();
    expect(top.children.length).toBe(0);
  });

  it('a different kind with the same text replaces the bar', () => {
    showInfo({ kind: 'info', text: 'x' });
    const bar = top.firstElementChild;
    showInfo({ kind: 'error', text: 'x' });
    expect(top.firstElementChild).not.toBe(bar);
  });

  it('dismiss clears the timeout so a later bar is not removed by it', () => {
    const dismiss = showInfo({ kind: 'info', text: 'a', timeoutMs: 1000 });
    dismiss();
    expect(vi.getTimerCount()).toBe(0);
    showInfo({ kind: 'info', text: 'b' });
    vi.advanceTimersByTime(5000);
    expect(top.textContent).toContain('b');
  });

  it('replacing a bar clears its timeout', () => {
    showInfo({ kind: 'info', text: 'a', timeoutMs: 1000 });
    showInfo({ kind: 'info', text: 'b' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('the timeout dismisses the bar', () => {
    showInfo({ kind: 'info', text: 'a', timeoutMs: 1000 });
    vi.advanceTimersByTime(1000);
    expect(top.children.length).toBe(0);
  });

  it('a stale dismiss does nothing', () => {
    const old = showInfo({ kind: 'info', text: 'a' });
    showInfo({ kind: 'info', text: 'b' });
    old();
    expect(top.textContent).toContain('b');
  });

  it('top and bottom are independent', () => {
    showInfo({ kind: 'info', text: 'a' });
    const d = showInfo({ kind: 'info', text: 'b', position: 'bottom' });
    expect(top.textContent).toContain('a');
    expect(bottom.textContent).toContain('b');
    d();
    expect(top.children.length).toBe(1);
    expect(bottom.children.length).toBe(0);
  });
});

describe('keyed messages', () => {
  it('a keyed error waits under a newer message and comes back when that one goes', () => {
    showInfo({ kind: 'error', text: 'session failed', key: 'session' });
    const dismissInfo = showInfo({ kind: 'info', text: 'saved' });
    expect(top.textContent).toContain('saved');
    dismissInfo();
    expect(top.textContent).toContain('session failed');
    clearInfo('session');
    expect(top.children.length).toBe(0);
  });

  it('showing a key again updates it in place; two keys stay apart', () => {
    showInfo({ kind: 'error', text: 'a: locked', key: 'save:a' });
    showInfo({ kind: 'error', text: 'b: gone', key: 'save:b' });
    showInfo({ kind: 'error', text: 'a: still locked', key: 'save:a' });
    expect(top.textContent).toContain('b: gone');
    clearInfo('save:b');
    expect(top.textContent).toContain('a: still locked');
  });
});

describe('keyboard', () => {
  it('Esc in a bar dismisses it and returns focus; a sticky bar stays', async () => {
    const { bindReturnFocus } = await import('./infobar');
    const back = vi.fn();
    bindReturnFocus(back);
    showInfo({ kind: 'info', text: 'x', actions: [{ label: 'Do', run: () => {} }] });
    top.querySelector('button')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(top.children.length).toBe(0);
    expect(back).toHaveBeenCalledTimes(1);
    showInfo({ kind: 'warning', text: 'y', sticky: true, actions: [{ label: 'Do', run: () => {} }] });
    top.querySelector('button')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(top.children.length).toBe(1);
  });

  it('focusInfobar focuses the newest bar\'s first control, top first, and says when there is none', async () => {
    const { focusInfobar } = await import('./infobar');
    document.body.append(top, bottom);
    expect(focusInfobar()).toBe(false);
    showInfo({ kind: 'info', text: 'b', position: 'bottom', actions: [{ label: 'Restore', run: () => {} }] });
    expect(focusInfobar()).toBe(true);
    expect(document.activeElement?.textContent).toBe('Restore');
    showInfo({ kind: 'info', text: 't', actions: [{ label: 'Top', run: () => {} }] });
    focusInfobar();
    expect(document.activeElement?.textContent).toBe('Top');
    top.remove();
    bottom.remove();
  });

  it('every bar carries an icon for its kind', () => {
    showInfo({ kind: 'error', text: 'e' });
    expect(top.querySelector('.infobar-icon svg')).not.toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { IS_MAC, keys, macKeys } from './platform';

describe('key labels (SPEC §13)', () => {
  it.each([
    ['Ctrl+T', '⌘T'],
    ['Ctrl+Shift+T', '⇧⌘T'],
    ['Ctrl+Alt+F', '⌥⌘F'],
    ['Ctrl+Tab', '⌃Tab'],
    ['Ctrl+Shift+Tab', '⌃⇧Tab'],
    ['Shift+F6', '⇧F6']
  ])('%s reads %s on macOS', (win, mac) => {
    expect(macKeys(win)).toBe(mac);
  });

  it('the test page is not a Mac, so labels stay as written', () => {
    expect(IS_MAC).toBe(false);
    expect(keys('Ctrl+Shift+T')).toBe('Ctrl+Shift+T');
  });
});

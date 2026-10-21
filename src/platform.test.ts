// Key labels on macOS (SPEC §13). The page reads the platform once, at import, from the user agent.
import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', configurable: true });
});

import { IS_MAC, keys } from './platform';

describe('key labels on macOS', () => {
  it("WKWebView's user agent reads as macOS", () => {
    expect(IS_MAC).toBe(true);
  });

  it.each([
    ['Ctrl+T', '⌘T'],
    ['Ctrl+Shift+T', '⇧⌘T'],
    ['Ctrl+Alt+F', '⌥⌘F'],
    ['Ctrl+Tab', '⌃Tab'],
    ['Ctrl+Shift+Tab', '⌃⇧Tab'],
    ['Shift+F6', '⇧F6']
  ])('%s reads %s', (win, mac) => {
    expect(keys(win)).toBe(mac);
  });
});

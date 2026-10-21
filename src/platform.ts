// The system the page runs on (SPEC §13), read once and synchronously so the first paint is right.
// The user agent is the engine's own: WKWebView's says "Mac OS X", WebView2's says "Windows NT".
export const IS_MAC = /Mac OS X/.test(navigator.userAgent);

/** Modifier order and symbols of macOS menus. */
const MAC_MODS: [string, string][] = [['Ctrl', '⌃'], ['Alt', '⌥'], ['Shift', '⇧'], ['Cmd', '⌘']];

/**
 * A Windows combination (`Ctrl+Shift+S`) the way macOS writes it (`⇧⌘S`): Ctrl becomes Cmd,
 * except before Tab, which stays Control as in browsers (SPEC §13).
 */
function macKeys(combo: string): string {
  const parts = combo.split('+');
  const key = parts.pop()!;
  const mods = new Set(parts.map((m) => (m === 'Ctrl' && key !== 'Tab' ? 'Cmd' : m)));
  return MAC_MODS.filter(([m]) => mods.has(m)).map(([, s]) => s).join('') + (key.length === 1 ? key.toUpperCase() : key);
}

/** A combination written the Windows way, as this system shows it. */
export const keys: (combo: string) => string = IS_MAC ? macKeys : (combo) => combo;

// Path helpers. Paths are normalized once where they enter the app (open, save, session restore);
// everything after that compares with samePath.

/** Forward slashes, no duplicate or trailing slash. A leading `//` (UNC share) stays. */
export function normPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/(?!^)\/{2,}/g, '/').replace(/(.)\/$/, '$1');
}

/** Windows paths are case-insensitive. */
export function samePath(a: string, b: string): boolean {
  return normPath(a).toLowerCase() === normPath(b).toLowerCase();
}

export function basename(p: string): string {
  const n = normPath(p);
  return n.slice(n.lastIndexOf('/') + 1) || n;
}

export function dirname(p: string): string {
  const n = normPath(p);
  return n.slice(0, Math.max(0, n.lastIndexOf('/')));
}

/** Hosts the webview serves itself (Windows spelling); a link to one reaches the app or local files. */
const APP_HOSTS = ['asset.localhost', 'tauri.localhost', 'ipc.localhost'];

/** Parsed the way the webview will parse it, so `:80`, `\\` or a newline in the host cannot disguise it. */
function parse(u: string): URL | null {
  try {
    return new URL(u);
  } catch {
    return null;
  }
}

const hostOf = (url: URL): string => url.hostname.toLowerCase().replace(/\.+$/, '');

/**
 * A remote http(s) URL. Never one the app serves: a note must not reach files or the app
 * through one. The prefix test keeps the common case (a relative path) free of a URL parse.
 */
export function isWebUrl(u: string): boolean {
  if (!/^\s*https?:/i.test(u)) return false;
  const url = parse(u);
  return !!url && (url.protocol === 'http:' || url.protocol === 'https:') && !APP_HOSTS.includes(hostOf(url));
}

// Path helpers. Paths are normalized once where they enter the app (open, save, session restore);
// everything after that compares with samePath.

export const MD_EXTENSIONS = ['md', 'markdown'];

/** Forward slashes, no duplicate or trailing slash. */
export function normPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/(.)\/$/, '$1');
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

export function isMarkdownPath(p: string): boolean {
  const ext = p.slice(p.lastIndexOf('.') + 1).toLowerCase();
  return MD_EXTENSIONS.includes(ext);
}

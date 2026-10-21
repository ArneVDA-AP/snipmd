// T16: closing a tab (Ctrl+W, middle-click, ×) and restoring it (Ctrl+Shift+T, the bar's Restore). SPEC §7.
import { clearInfo, clearTabInfo, showInfo } from './infobar';
import { inConflict } from './diskState';
import { resolveConflict } from './external';
import { saveTab } from './saving';
import { closeTab, getTab, reopenClosed, textOf } from './tabs';

const BAR_KEY = 'closed';
const BAR_MS = 8000;

/** `![alt](url)` or `![alt](<url>)`; the url ends at whitespace (a title may follow). */
const IMAGE = /!\[[^\]]*\]\(\s*(?:<([^>]*)>|([^)\s]+))/g;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** Distinct relative image URLs: no scheme, not starting with `/`. */
function screenshotCount(text: string): number {
  const urls = new Set<string>();
  for (const m of text.matchAll(IMAGE)) {
    const url = m[1] ?? m[2];
    if (url && !SCHEME.test(url) && !url.startsWith('/')) urls.add(url);
  }
  return urls.size;
}

function closedText(title: string, n: number): string {
  if (n === 0) return `${title} closed.`;
  return `${title} closed, with ${n} ${n === 1 ? 'screenshot' : 'screenshots'}.`;
}

function shortcut(): HTMLElement {
  const kbd = document.createElement('kbd');
  kbd.textContent = 'Ctrl+Shift+T';
  return kbd;
}

/**
 * Closes a tab at once. A dirty disk tab is written once more first (the write keeps the tab and
 * reads its closed text); a tab in conflict is not written and stays in conflict while closed.
 */
export async function closeTabWithRestore(id: string): Promise<void> {
  const tab = getTab(id);
  if (!tab) return;
  if (tab.dirty && tab.filePath && !inConflict(id)) void saveTab(id);
  const closed = await closeTab(id);
  if (!closed) return;
  clearTabInfo(id);
  showInfo({
    kind: 'info',
    key: BAR_KEY,
    position: 'bottom',
    timeoutMs: BAR_MS,
    text: closedText(closed.title, screenshotCount(textOf(closed))),
    body: shortcut(),
    actions: [{ label: 'Restore', primary: true, run: () => void restoreClosedTab(id) }]
  });
}

/** Reopens a closed tab (the most recent without `id`) and lets the external watch compare it again. */
export async function restoreClosedTab(id?: string): Promise<void> {
  const tab = await reopenClosed(id);
  if (tab) resolveConflict(tab.id);
  clearInfo(BAR_KEY);
}

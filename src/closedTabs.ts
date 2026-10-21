// closing a Tab (Ctrl+W, middle-click, ×) and restoring it (Ctrl+Shift+T, the bar's Restore). SPEC §7.
import { clearInfo, clearTabInfo, showInfo } from './infobar';
import { saveTab } from './saving';
import { closeTab, openTab, reopenClosed, textOf } from './tabs';

const BAR_KEY = 'closed';
const BAR_MS = 8000;

/**
 * `![alt](url)` or `![alt](<url>)`; the url ends at whitespace (a title may follow). Every part is
 * bounded and stays on one line, so a hostile note cannot make the count on Ctrl+W quadratic.
 */
const IMAGE = /!\[[^\]\n]{0,1000}\]\([ \t]*(?:<([^>\n]{0,2048})>|([^)\s]{1,2048}))/g;
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
 * Closes a tab at once. A dirty disk tab is written once more (the write finds the closed entry);
 * a tab in conflict is not written and stays in conflict while closed. Either way, edits that do
 * not reach the disk get a warning bar with Restore.
 */
export async function closeTabWithRestore(id: string): Promise<void> {
  const tab = openTab(id);
  if (!tab) return;
  // saveTab writes no tab in conflict and reports false, like a failed or refused write.
  const written = tab.dirty && tab.filePath ? saveTab(id) : null;
  const closed = await closeTab(id);
  if (!closed) return;
  clearTabInfo(id);
  const restore = { label: 'Restore', primary: true, run: () => void restoreClosedTab(id) };
  showInfo({
    kind: 'info',
    key: BAR_KEY,
    position: 'bottom',
    timeoutMs: BAR_MS,
    text: closedText(closed.title, screenshotCount(textOf(closed))),
    body: shortcut(),
    actions: [restore]
  });
  // Edits the close could not write stay reported until the tab is restored.
  void written?.then((ok) => {
    if (ok || openTab(id)) return; // restored meanwhile
    showInfo({ kind: 'warning', key: `unsaved:${id}`, text: `${closed.title} was closed with changes that are not on disk.`, actions: [restore] });
  });
}

/** Reopens a closed tab (the most recent without `id`) and ends the restore bar. */
export async function restoreClosedTab(id?: string): Promise<void> {
  await reopenClosed(id);
  clearInfo(BAR_KEY);
}

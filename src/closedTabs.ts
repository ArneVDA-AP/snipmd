import { inConflict } from './diskState';
import { resolveConflict } from './external';
import { clearInfo, clearTabInfo, showInfo } from './infobar';
import { saveTab } from './saving';
import { closeTab, getTab, reopenClosed } from './tabs';

const IMAGE = /!\[[^\]]*\]\(\s*<?([^)\s>]+)/g;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** Number of distinct relative image links (no scheme, not starting with `/` or `\`) in the text. */
function screenshotCount(text: string): number {
  const urls = new Set<string>();
  for (const m of text.matchAll(IMAGE)) {
    if (!SCHEME.test(m[1]) && !/^[/\\]/.test(m[1])) urls.add(m[1]);
  }
  return urls.size;
}

/** Closes a tab: a dirty disk tab out of conflict is saved first, then the restore bar shows. */
export async function closeTabWithRestore(id: string): Promise<void> {
  const tab = getTab(id);
  if (!tab) return;
  if (tab.dirty && tab.filePath && !inConflict(id)) void saveTab(id);
  const closed = await closeTab(id);
  clearTabInfo(id);
  if (!closed) return;
  const n = screenshotCount(closed.content);
  const kbd = document.createElement('kbd');
  kbd.textContent = 'Ctrl+Shift+T';
  showInfo({
    kind: 'info',
    key: 'closed',
    position: 'bottom',
    timeoutMs: 8000,
    text: n === 0 ? `${closed.title} closed.` : `${closed.title} closed, with ${n} screenshot${n === 1 ? '' : 's'}.`,
    body: kbd,
    actions: [{ label: 'Restore', primary: true, run: () => void restoreClosedTab(id) }]
  });
}

/** Reopens a closed tab (the newest without id) and re-arms the external watch for it. */
export async function restoreClosedTab(id?: string): Promise<void> {
  const tab = await reopenClosed(id);
  if (tab) resolveConflict(tab.id);
  clearInfo('closed');
}

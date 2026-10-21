// Wiring: DOM skeleton, keyboard, lifecycle. The only place that connects modules.
import { Titlebar } from './titlebar';
import { mountInfobar } from './infobar';
import { bindSessionSource, loadSession } from './session';
import { flushDirty, saveAs, saveTab, scheduleAutosave } from './saving';
import { startExternalWatch } from './external';
import { handleDrop } from './drop';
import { closeTabWithRestore, restoreClosedTab } from './closedTabs';
import { getCliStartupFiles, onCloseRequested, onFilesDropped, onForwardedFiles, pickFileToOpen } from './ipc';
import {
  activate,
  bindEditListener,
  cycle,
  getActiveTab,
  getTabs,
  initTabs,
  newUntitled,
  openPath,
  openPaths,
  restore,
  snapshot,
  toggleMode
} from './tabs';

const SKELETON = `
  <header class="titlebar" id="titlebar"></header>
  <div class="infobar-host" id="infoTop"></div>
  <main class="workspace">
    <div class="editor-pane" id="editorPane"></div>
    <div class="read-pane" id="readPane" hidden></div>
  </main>
  <div class="infobar-host" id="infoBottom"></div>
`;

/** Longest a close waits for note writes. */
const CLOSE_WAIT_MS = 3000;

const DIGIT = /^(?:Digit|Numpad)([1-9])$/;

function registerKeys(): void {
  window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    const active = getActiveTab();
    const nth = DIGIT.exec(e.code)?.[1];
    let handled = true;
    if (key === 'tab') void cycle(e.shiftKey ? -1 : 1);
    else if (nth && !e.shiftKey) {
      const tab = getTabs()[Number(nth) - 1];
      if (tab) void activate(tab.id);
      else handled = false;
    } else if (e.shiftKey && key === 's') void (active && saveAs(active.id));
    else if (e.shiftKey && key === 't') void restoreClosedTab();
    else if (e.shiftKey) handled = false;
    else if (key === 't' || key === 'n') void newUntitled();
    else if (key === 'o') void pickFileToOpen().then((p) => (p ? openPath(p) : undefined));
    else if (key === 's') void (active && saveTab(active.id));
    else if (key === 'w') void (active && closeTabWithRestore(active.id));
    else if (key === 'e') void toggleMode();
    else handled = false;
    if (handled) e.preventDefault();
  });
}

export async function startApp(root: HTMLElement): Promise<void> {
  root.innerHTML = SKELETON;
  const byId = (id: string) => document.getElementById(id)!;

  mountInfobar(byId('infoTop'), byId('infoBottom'));
  const titlebar = new Titlebar(byId('titlebar'), {
    select: (id) => void activate(id),
    close: (id) => void closeTabWithRestore(id),
    newTab: () => void newUntitled()
  });
  initTabs({ editor: byId('editorPane'), read: byId('readPane') }, titlebar);
  bindSessionSource(snapshot);
  bindEditListener(scheduleAutosave);
  registerKeys();
  window.addEventListener('blur', () => void flushDirty());

  const [session, cliFiles] = await Promise.all([
    loadSession().catch(() => null),
    getCliStartupFiles().catch(() => [])
  ]);
  if (session) await restore(session);
  else if (cliFiles.length === 0) await newUntitled();
  await openPaths(cliFiles);
  startExternalWatch(saveTab);

  await Promise.all([
    // A hung note write (drive removed) must not keep the window open; the session was written first.
    onCloseRequested(() => Promise.race([flushDirty(), new Promise<void>((r) => setTimeout(r, CLOSE_WAIT_MS))])),
    onForwardedFiles((paths) => void openPaths(paths)),
    onFilesDropped((d) => void handleDrop(d))
  ]);
}

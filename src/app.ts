// Wiring: DOM skeleton, keyboard, lifecycle. The only place that connects modules.
import { Titlebar } from './titlebar';
import { mountInfobar } from './infobar';
import { bindSessionSource, loadSession } from './session';
import { flushDirty, saveTab } from './saving';
import { getCliStartupFiles, onCloseRequested, onFilesDropped, onForwardedFiles, pickFileToOpen } from './ipc';
import { isMarkdownPath } from './paths';
import {
  activate,
  closeTab,
  cycle,
  getActiveTab,
  getTab,
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

/** Closing a tab never loses its edits: a dirty disk tab is written once more (the closed-tabs list is phase 5). */
function closeAndSave(id: string): Promise<void> {
  const tab = getTab(id);
  if (tab?.dirty && tab.filePath) void saveTab(id);
  return closeTab(id);
}

function registerKeys(): void {
  window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    const active = getActiveTab();
    let handled = true;
    if (key === 'tab') void cycle(e.shiftKey ? -1 : 1);
    else if (e.shiftKey) handled = false;
    else if (key === 't' || key === 'n') void newUntitled();
    else if (key === 'o') void pickFileToOpen().then((p) => (p ? openPath(p) : undefined));
    else if (key === 's') void (active && saveTab(active.id));
    else if (key === 'w') void (active && closeAndSave(active.id));
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
    close: (id) => void closeAndSave(id),
    newTab: () => void newUntitled()
  });
  initTabs({ editor: byId('editorPane'), read: byId('readPane') }, titlebar);
  bindSessionSource(snapshot);
  registerKeys();
  window.addEventListener('blur', () => void flushDirty());

  const [session, cliFiles] = await Promise.all([
    loadSession().catch(() => null),
    getCliStartupFiles().catch(() => [])
  ]);
  if (session) await restore(session);
  else if (cliFiles.length === 0) await newUntitled();
  await openPaths(cliFiles);

  await Promise.all([
    // A hung note write (drive removed) must not keep the window open; the session was written first.
    onCloseRequested(() => Promise.race([flushDirty(), new Promise<void>((r) => setTimeout(r, CLOSE_WAIT_MS))])),
    onForwardedFiles((paths) => void openPaths(paths)),
    // Phase 3 adds dropped images here.
    onFilesDropped((paths) => void openPaths(paths.filter(isMarkdownPath)))
  ]);
}

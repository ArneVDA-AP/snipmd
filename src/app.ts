// Wiring: DOM skeleton, keyboard, lifecycle. The only place that connects modules.
import { Titlebar } from './titlebar';
import { mountInfobar } from './infobar';
import { bindSessionSource, loadSession } from './session';
import { flushDirty, saveTab } from './saving';
import { getCliStartupFiles, onExternalFiles, pickFileToOpen } from './ipc';
import {
  activate,
  closeTab,
  cycle,
  getActiveTab,
  initTabs,
  newUntitled,
  openPath,
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
    else if (key === 'w') void (active && closeTab(active.id));
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
    close: (id) => void closeTab(id),
    newTab: () => void newUntitled(),
    beforeClose: flushDirty
  });
  initTabs({ editor: byId('editorPane'), read: byId('readPane') }, titlebar);
  bindSessionSource(snapshot);
  registerKeys();
  window.addEventListener('blur', () => void flushDirty());

  const session = await loadSession().catch(() => null);
  if (session) await restore(session);
  else await newUntitled();

  for (const path of await getCliStartupFiles().catch(() => [])) await openPath(path);
  await onExternalFiles((paths) => {
    void (async () => {
      for (const p of paths) await openPath(p);
    })();
  });
}

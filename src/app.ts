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

/** Ctrl+1..Ctrl+9 by key position, so AZERTY (where e.key of Ctrl+1 is `&`) works too. */
const DIGIT = /^(?:Digit|Numpad)([1-9])$/;

/** SPEC §10. The command for a Ctrl (or Meta) key, or undefined when it is not ours (Ctrl+F, Ctrl+V: CodeMirror, paste.ts). */
function commandFor(e: KeyboardEvent): (() => unknown) | undefined {
  const digit = DIGIT.exec(e.code);
  if (digit) {
    const tab = getTabs()[Number(digit[1]) - 1];
    return tab && (() => activate(tab.id));
  }
  const key = e.key.toLowerCase();
  const id = getActiveTab()?.id;
  const onActive = (run: (id: string) => unknown) => () => id && run(id);
  if (key === 'tab') return () => cycle(e.shiftKey ? -1 : 1);
  if (e.shiftKey) return key === 's' ? onActive(saveAs) : key === 't' ? () => restoreClosedTab() : undefined;
  switch (key) {
    case 't': case 'n': return newUntitled;
    case 'o': return () => pickFileToOpen().then((p) => (p ? openPath(p) : undefined));
    case 's': return onActive(saveTab);
    case 'w': return onActive(closeTabWithRestore);
    case 'e': return toggleMode;
  }
  return undefined;
}

function registerKeys(): void {
  window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    // A held key acts once (a held Ctrl+W would empty the window); only moving between tabs repeats.
    if (e.repeat && e.key !== 'Tab' && !DIGIT.test(e.code)) return e.preventDefault();
    const run = commandFor(e);
    if (!run) return;
    e.preventDefault();
    void run();
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

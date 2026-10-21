// Wiring: DOM skeleton, keyboard, lifecycle. The only place that connects modules.
import { Titlebar } from './titlebar';
import { focusInfobar, mountInfobar } from './infobar';
import { bindSessionSource, loadSession } from './session';
import { flushDirty, saveAs, saveTab, scheduleAutosave } from './saving';
import { startExternalWatch } from './external';
import { handleDrop } from './drop';
import { markReady, markStep } from './perf';
import { openFind } from './editor/search';
import { getView } from './editor/registry';
import { closeTabWithRestore, restoreClosedTab } from './closedTabs';
import {
  getCliStartupFiles,
  onCloseRequested,
  onFilesDropped,
  onForwardedFiles,
  onMenuCommand,
  onOpenedNotes,
  onQuitRequested,
  pickFileToOpen,
  takeOpenedNotes,
  windowBackdrop
} from './ipc';
import {
  activate,
  bindEditListener,
  cycle,
  focusActive,
  getActiveTab,
  getTabs,
  initTabs,
  newUntitled,
  openPath,
  openPaths,
  preloadReader,
  restore,
  snapshot,
  toggleMode
} from './tabs';

const SKELETON = `
  <header class="titlebar" id="titlebar"></header>
  <div class="infobar-host" id="infoTop"></div>
  <main class="workspace">
    <div class="editor-pane" id="editorPane"></div>
    <div class="read-pane" id="readPane" tabindex="-1" hidden></div>
  </main>
  <div class="infobar-host" id="infoBottom"></div>
`;

/** Longest a close waits for note writes. */
const CLOSE_WAIT_MS = 3000;

/** Ctrl+1..Ctrl+9 by key position, so AZERTY (where e.key of Ctrl+1 is `&`) works too. */
const DIGIT = /^(?:Digit|Numpad)([1-9])$/;

/** Find in read mode goes back to writing first: the panel searches the text you can change. */
async function findInRead(replace: boolean): Promise<void> {
  await toggleMode();
  const view = getView();
  // After the frame in which the editor takes focus, or that focus would pull the cursor out of the panel.
  if (view) requestAnimationFrame(() => openFind(view, replace));
}

function findInEdit(replace: boolean): void {
  const view = getView();
  if (view) openFind(view, replace);
}

const onActive = (run: (id: string) => unknown) => {
  const id = getActiveTab()?.id;
  return id && run(id);
};

const find = (replace: boolean) => (getActiveTab()?.mode === 'read' ? findInRead(replace) : findInEdit(replace));

/** SPEC §10, §13. The page's commands by name: the keys below and the macOS menu bar run them. */
const COMMANDS: Record<string, () => unknown> = {
  'new-tab': () => newUntitled(),
  open: () => pickFileToOpen().then((p) => (p ? openPath(p) : undefined)),
  save: () => onActive(saveTab),
  'save-as': () => onActive(saveAs),
  'close-tab': () => onActive(closeTabWithRestore),
  'reopen-tab': () => restoreClosedTab(),
  'read-mode': () => toggleMode(),
  find: () => find(false),
  replace: () => find(true)
};

/** SPEC §10. The command for a Ctrl (or Meta) key, or undefined when it is not ours (Ctrl+F in the editor, Ctrl+V: CodeMirror, paste.ts). */
function commandFor(e: KeyboardEvent): (() => unknown) | undefined {
  const digit = DIGIT.exec(e.code);
  if (digit) {
    const tab = getTabs()[Number(digit[1]) - 1];
    return tab && (() => activate(tab.id));
  }
  const key = e.key.toLowerCase();
  if (key === 'tab') return () => cycle(e.shiftKey ? -1 : 1);
  if (e.shiftKey) return key === 's' ? COMMANDS['save-as'] : key === 't' ? COMMANDS['reopen-tab'] : undefined;
  switch (key) {
    case 't': case 'n': return COMMANDS['new-tab'];
    case 'o': return COMMANDS.open;
    case 's': return COMMANDS.save;
    case 'w': return COMMANDS['close-tab'];
    case 'e': return COMMANDS['read-mode'];
    case 'f': case 'h':
      // In the note CodeMirror handles the key itself; outside it (tab strip, a bar) and in read mode, open the panel here.
      if (getActiveTab()?.mode !== 'read' && document.activeElement?.closest('.cm-editor')) return undefined;
      return COMMANDS[key === 'h' ? 'replace' : 'find'];
  }
  return undefined;
}

/** F6 / Shift+F6 move focus between the page, the info bar and the tab strip (Windows convention). */
function cycleRegion(titlebar: Titlebar, back: boolean): void {
  const regions: (() => boolean)[] = [() => (focusActive(), true), focusInfobar, () => (titlebar.focus(), true)];
  const at = document.activeElement;
  const current = at?.closest('.titlebar') ? 2 : at?.closest('.infobar-host') ? 1 : 0;
  for (let step = 1; step < regions.length; step++) {
    const i = (current + (back ? -step : step) + regions.length) % regions.length;
    if (regions[i]()) return;
  }
}

/**
 * WebView2's own browser keys: reload (F5, Ctrl+R) would drop undo history and any image still
 * saving; print, history, downloads, source and caret browsing open things SnipMD does not have.
 */
function isBrowserKey(e: KeyboardEvent): boolean {
  const k = e.key.toLowerCase();
  if (k === 'f3' || k === 'f5' || k === 'f7' || k === 'browserback' || k === 'browserforward' || k === 'browserrefresh') return true;
  if (e.altKey && (k === 'arrowleft' || k === 'arrowright')) return true;
  const ctrl = e.ctrlKey || e.metaKey;
  return ctrl && !e.altKey && ['r', 'p', 'j', 'u'].includes(k);
}

/** The browser menu (Back, Reload, Print) only where text is: the note, inputs and selected read-mode text. */
function allowContextMenu(e: MouseEvent): boolean {
  const target = e.target as Element | null;
  if (target?.closest('.cm-content, input, textarea')) return true;
  return !!target?.closest('.read-view') && !!window.getSelection()?.toString();
}

function registerKeys(titlebar: Titlebar): void {
  window.addEventListener('contextmenu', (e) => {
    if (!allowContextMenu(e)) e.preventDefault();
  });
  window.addEventListener('keydown', (e) => {
    if (isBrowserKey(e)) return e.preventDefault();
    if (e.key === 'F6' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      if (!e.repeat) cycleRegion(titlebar, e.shiftKey);
      return;
    }
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

  mountInfobar(byId('infoTop'), byId('infoBottom'), focusActive);
  const titlebar = new Titlebar(byId('titlebar'), {
    select: (id) => void activate(id),
    open: (id) => void activate(id).then(focusActive),
    close: (id) => void closeTabWithRestore(id),
    newTab: () => void newUntitled(),
    toggleMode: () => void toggleMode()
  });
  initTabs({ editor: byId('editorPane'), read: byId('readPane') }, titlebar);
  bindSessionSource(snapshot);
  bindEditListener(scheduleAutosave);
  registerKeys(titlebar);
  window.addEventListener('blur', () => void flushDirty());

  const [session, cliFiles, finderNotes, mica] = await Promise.all([
    loadSession().catch(() => null),
    getCliStartupFiles().catch(() => []),
    takeOpenedNotes().catch(() => []),
    windowBackdrop().catch(() => false)
  ]);
  const startFiles = [...cliFiles, ...finderNotes];
  markStep('session');
  document.documentElement.classList.toggle('mica', mica);
  if (session) await restore(session);
  else if (startFiles.length === 0) await newUntitled();
  await openPaths(startFiles);
  markReady();
  startExternalWatch(saveTab);
  preloadReader();

  // A hung note write (drive removed) must not keep the window open; the session was written first.
  const flushForClose = () => Promise.race([flushDirty(), new Promise<void>((r) => setTimeout(r, CLOSE_WAIT_MS))]);
  await Promise.all([
    onCloseRequested(flushForClose),
    onQuitRequested(flushForClose),
    onForwardedFiles((paths) => void openPaths(paths)),
    onOpenedNotes((paths) => void openPaths(paths)),
    onMenuCommand((name) => void COMMANDS[name]?.()),
    onFilesDropped((d) => void handleDrop(d))
  ]);
}

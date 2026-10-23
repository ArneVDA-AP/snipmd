// Wiring: DOM skeleton, keyboard, lifecycle. The only place that connects modules.
import { Titlebar } from './titlebar';
import { focusInfobar, mountInfobar, showError, showInfo } from './infobar';
import { loadSession, scheduleSessionSave } from './session';
import { initSettings, parseSettings } from './settings';
import { flushDirty, saveAs, saveTab, scheduleAutosave } from './saving';
import { startExternalWatch } from './external';
import { handleDrop } from './drop';
import { markReady, markStep } from './perf';
import { openFind } from './editor/search';
import { getView } from './editor/registry';
import { pastePlainText } from './editor/paste';
import { closeTabWithRestore, restoreClosedTab } from './closedTabs';
import { IS_MAC } from './platform';
import {
  getCliStartupFiles,
  onCloseRequested,
  onFilesDropped,
  onForwardedFiles,
  onMenuCommand,
  onOpenedNotes,
  onPasteText,
  onQuitRequested,
  pickFileToOpen,
  takeOpenedNotes,
  windowBackdrop
} from './ipc';
import {
  activate,
  cycle,
  focusActive,
  getActiveTab,
  getTabs,
  moveTab,
  refreshRead,
  initTabs,
  startSessionWrites,
  newUntitled,
  openPath,
  openPaths,
  preloadReader,
  restore,
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

/**
 * The app's modifier is down. On macOS that is Cmd alone, since Control keeps its text bindings
 * there (Control+E: end of line), except Control+Tab, which cycles tabs as in browsers (SPEC §13).
 */
function commandKey(e: KeyboardEvent): boolean {
  if (!IS_MAC) return e.ctrlKey || e.metaKey;
  return e.key === 'Tab' ? e.ctrlKey && !e.metaKey : e.metaKey && !e.ctrlKey;
}

/** SPEC §10. The command for a Ctrl (or Meta) key, or undefined when it is not ours (Ctrl+F in the editor, Ctrl+V: CodeMirror, paste.ts). */
function commandFor(e: KeyboardEvent): (() => unknown) | undefined {
  const digit = DIGIT.exec(e.code);
  // With NumLock off the numpad digits are End, arrows and Page Down: those stay editor keys.
  if (digit && (e.code.startsWith('Digit') || e.key === digit[1])) {
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
    case 'h':
      // Cmd+H hides the app on macOS; replace is Cmd+Option+F there (SPEC §13).
      if (IS_MAC) return undefined;
    // fall through
    case 'f':
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
  return commandKey(e) && !e.altKey && ['r', 'p', 'j', 'u'].includes(k);
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
    if (!commandKey(e) || e.altKey) return;
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
    toggleMode: () => void toggleMode(),
    move: (id, toIndex) => moveTab(id, toIndex)
  });
  initTabs({ editor: byId('editorPane'), read: byId('readPane') }, titlebar, scheduleAutosave);
  registerKeys(titlebar);

  let sessionUnread: unknown = null;
  const [{ session, setAside }, cliFiles, finderNotes, mica] = await Promise.all([
    loadSession().catch((err: unknown) => {
      sessionUnread = err ?? 'unknown error';
      return { session: null, setAside: null };
    }),
    getCliStartupFiles().catch(() => []),
    takeOpenedNotes().catch(() => []),
    windowBackdrop().catch(() => false)
  ]);
  const startFiles = [...cliFiles, ...finderNotes];
  markStep('session');
  initSettings(session?.settings ?? parseSettings(undefined), () => {
    scheduleSessionSave({ immediate: true });
    void refreshRead();
  });
  document.documentElement.classList.toggle('mica', mica);
  if (session) await restore(session);
  else if (startFiles.length === 0) await newUntitled();
  // Writes start only now: a blur during the restore must not store an empty session over the real one.
  // Everything below is in place before the files from the command line or Finder are read, so a slow
  // or hung read of one never stops the session, the close and quit flush, forwarded files or drops.
  // A session Rust could neither read nor keep aside holds the only copy of the untitled notes:
  // this run must not write over it.
  if (sessionUnread === null) startSessionWrites();
  else showError('read the session, so this run keeps no tabs for the next start', sessionUnread, 'session');
  if (setAside) {
    showInfo({ kind: 'error', key: 'session-aside', text: `The last session could not be read. It is kept as ${setAside}; its untitled notes can be copied out of it.` });
  }
  startExternalWatch(saveTab);
  window.addEventListener('blur', () => void flushDirty());
  preloadReader();
  // A hung note write (drive removed) must not keep the window open; the session was written first.
  const flushForClose = () => Promise.race([flushDirty(), new Promise<void>((r) => setTimeout(r, CLOSE_WAIT_MS))]);
  await Promise.all([
    onCloseRequested(flushForClose),
    onQuitRequested(flushForClose),
    onForwardedFiles((paths) => void openPaths(paths)),
    onOpenedNotes((paths) => void openPaths(paths)),
    onMenuCommand((name) => void COMMANDS[name]?.()),
    onPasteText((text) => pastePlainText(getView(), text)),
    onFilesDropped((d) => void handleDrop(d))
  ]);
  await openPaths(startFiles);
  markReady();
}

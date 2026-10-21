// Wiring: DOM skeleton, keyboard, lifecycle. The only place that connects modules.
import { Titlebar } from './titlebar';
import { focusInfobar, mountInfobar } from './infobar';
import { bindSessionSource, loadSession } from './session';
import { flushDirty, saveAs, saveTab, scheduleAutosave } from './saving';
import { startExternalWatch } from './external';
import { handleDrop } from './drop';
import { markReady } from './perf';
import { openFind } from './editor/search';
import { getView } from './editor/registry';
import { closeTabWithRestore, restoreClosedTab } from './closedTabs';
import { getCliStartupFiles, onCloseRequested, onFilesDropped, onForwardedFiles, pickFileToOpen, windowBackdrop } from './ipc';
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

/** SPEC §10. The command for a Ctrl (or Meta) key, or undefined when it is not ours (Ctrl+F in the editor, Ctrl+V: CodeMirror, paste.ts). */
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
    case 'f': case 'h':
      if (getActiveTab()?.mode === 'read') return () => findInRead(key === 'h');
      // Outside the note (tab strip, a bar) CodeMirror does not see the key; open its panel here.
      return document.activeElement?.closest('.cm-editor') ? undefined : () => findInEdit(key === 'h');
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

  const [session, cliFiles, mica] = await Promise.all([
    loadSession().catch(() => null),
    getCliStartupFiles().catch(() => []),
    windowBackdrop().catch(() => false)
  ]);
  document.documentElement.classList.toggle('mica', mica);
  if (session) await restore(session);
  else if (cliFiles.length === 0) await newUntitled();
  await openPaths(cliFiles);
  markReady();
  startExternalWatch(saveTab);
  preloadReader();

  await Promise.all([
    // A hung note write (drive removed) must not keep the window open; the session was written first.
    onCloseRequested(() => Promise.race([flushDirty(), new Promise<void>((r) => setTimeout(r, CLOSE_WAIT_MS))])),
    onForwardedFiles((paths) => void openPaths(paths)),
    onFilesDropped((d) => void handleDrop(d))
  ]);
}

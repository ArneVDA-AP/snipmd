// Tab list state and the visible workspace (editor or read view).
// The text of a tab lives in its EditorState; TabState.content is only filled when the session is
// written and used to create the editor state on restore. Read it through textOf().
// Open and closed tabs are one list: a closed tab is a tab with `closedAt` and no view, so a paste,
// a link rewrite or a write still running for it lands in it. getTab finds either; the tab strip
// and the keys work on getTabs (open only).
import { EditorView } from '@codemirror/view';
import type { ClosedTab, DiskStamp, SessionFile, TabState } from './types';
import { createEditorState } from './editor/setup';
import type { EditorState } from '@codemirror/state';
import { redrawImages } from './editor/imageWidget';
import {
  applyToTab,
  dropState,
  getState,
  getView,
  setState,
  setView,
  textOf as editorText,
  visibleTabId,
  imageSavesRunning,
  initRegistry
} from './editor/registry';
import { readNote } from './ipc';
import { setConflict } from './diskState';
import { bindSessionSource, scheduleSessionSave } from './session';
import { clearTabInfo, showError } from './infobar';
import { basename, normPath, samePath } from './paths';
import type { Titlebar } from './titlebar';

interface Panes {
  editor: HTMLElement;
  read: HTMLElement;
}

/** Open tabs in strip order, and closed ones (with closedAt) in any order. */
let tabs: TabState[] = [];
let activeId = '';
let untitledCounter = 1;
let lastFolder: string | null = null;
let panes: Panes;
let titlebar: Titlebar;
let editListener: (id: string) => void;

/** `onEdit` runs on every edit of a tab, open or closed (autosave). Cheap: it must not read the text. */
export function initTabs(p: Panes, t: Titlebar, onEdit: (id: string) => void): void {
  panes = p;
  titlebar = t;
  editListener = onEdit;
  initRegistry({ filePathOf: (id) => getTab(id)?.filePath ?? null, onChange: onDocChange });
}

/** Starts writing the session. Called once the startup tabs are in place: a write before that would store an empty list over the real session. */
export function startSessionWrites(): void {
  bindSessionSource(snapshot);
  scheduleSessionSave();
}

/** Every change to the tab list or a tab ends here: redraw the tab strip, persist the session. */
function changed(opts?: { immediate?: boolean }): void {
  titlebar.render(getTabs(), activeId);
  scheduleSessionSave(opts);
}

function onDocChange(id: string): void {
  const tab = getTab(id);
  if (!tab) return;
  editListener(id);
  if (tab.dirty) {
    scheduleSessionSave();
    return;
  }
  tab.dirty = true;
  changed();
}

const isOpen = (t: TabState): boolean => t.closedAt === undefined;
/** Open tabs, in strip order. */
export const getTabs = (): TabState[] => tabs.filter(isOpen);
/** A tab by id, open or closed. */
export const getTab = (id: string): TabState | undefined => tabs.find((t) => t.id === id);
/** A tab by id, only while it is open. */
export const openTab = (id: string): TabState | undefined => {
  const t = getTab(id);
  return t && isOpen(t) ? t : undefined;
};
/** Every tab, open and closed: everything a close flush writes. */
export const allTabs = (): readonly TabState[] => tabs;
export const getActiveTab = (): TabState | undefined => openTab(activeId) ?? getTabs()[0];
/** Current text of a tab. */
export const textOf = (tab: TabState): string => editorText(tab.id) ?? tab.content;

/**
 * Puts text read from its file into a tab: only the changed middle, so cursor, scroll and undo stay.
 * A tab whose editor was never created takes it as its content. The one way file text enters a tab
 * (reload, restore), so the text a tab shows and writes always matches the stamp stored with it.
 */
export function loadText(tab: TabState, text: string): void {
  const old = editorText(tab.id);
  if (old === undefined) {
    tab.content = text;
    return;
  }
  let from = 0;
  const max = Math.min(old.length, text.length);
  while (from < max && old[from] === text[from]) from++;
  let tail = 0;
  while (tail < max - from && old[old.length - 1 - tail] === text[text.length - 1 - tail]) tail++;
  if (from === old.length - tail && from === text.length - tail) return;
  applyToTab(tab.id, { changes: { from, to: old.length - tail, insert: text.slice(from, text.length - tail) } });
}
export const getLastFolder = (): string | null => lastFolder;

/** SPEC §7: the last 20 closed tabs or 14 days, whichever is shorter. */
const CLOSED_MAX = 20;
const CLOSED_MS = 14 * 24 * 60 * 60 * 1000;
/** Edits that are not on disk (a conflict, a failed or refused write) never age out of the list. */
const unwritten = (t: TabState): boolean => t.filePath !== null && t.dirty;

/** Closed tabs, most recent first. */
const closedTabs = (): TabState[] => tabs.filter((t) => !isOpen(t)).sort((a, b) => b.closedAt! - a.closedAt!);

/** Keeps the closed tabs SPEC §7 keeps, plus every one with unwritten edits; the rest and their editor state go. */
function pruneClosed(now: number): void {
  let young = 0;
  const gone = new Set(
    closedTabs().filter((t) => !((now - t.closedAt! < CLOSED_MS && young++ < CLOSED_MAX) || unwritten(t)))
  );
  for (const t of gone) dropState(t.id);
  tabs = tabs.filter((t) => !gone.has(t));
}

/** The open tab, or else the most recently closed one, of the note at `path`. */
const byPath = (path: string, open: boolean): TabState | undefined =>
  (open ? getTabs() : closedTabs()).find((t) => t.filePath !== null && samePath(t.filePath, path));

export function setLastFolder(folder: string): void {
  lastFolder = folder;
}

/**
 * Stores the visible editor's state, cursor and scroll back into its tab, also a closed one: a
 * screenshot that landed in a closed tab the view still held must survive the view moving on.
 */
function captureVisible(): void {
  const view = getView();
  const tab = getTab(visibleTabId() ?? '');
  if (view && tab) {
    setState(tab.id, view.state);
    if (tab.mode === 'edit') {
      tab.cursor = view.state.selection.main.head;
      if (!panes.editor.hidden) tab.scrollTop = view.scrollDOM.scrollTop; // a hidden pane reads 0
    }
  }
  const active = getActiveTab();
  if (active && active.mode === 'read' && !panes.read.hidden) active.scrollTop = panes.read.scrollTop;
}

/** A clean disk tab's text comes from its file: the session stores none, restore reads the file. */
const diskIsSource = (t: TabState): boolean => t.filePath !== null && !t.dirty;

/** Copies of the tabs for the session file; live tabs are left alone. */
export function snapshot(): SessionFile {
  captureVisible();
  const copies = getTabs().map((t) => ({ ...t, content: diskIsSource(t) ? '' : textOf(t) }));
  // Closed tabs keep their text, also when clean: the file may be gone by the time one is restored.
  const closed: ClosedTab[] = closedTabs().map(({ closedAt, ...t }) => ({ tab: { ...t, content: textOf(t) }, closedAt: closedAt! }));
  return { version: 3, activeTabId: activeId, untitledCounter, lastFolder, tabs: copies, closedTabs: closed };
}

export async function restore(s: SessionFile): Promise<void> {
  const reads = await Promise.allSettled(
    s.tabs.map((t) => (diskIsSource(t) ? readNote(t.filePath!) : null))
  );
  const kept: TabState[] = [];
  const failed: string[] = [];
  let reason: unknown;
  s.tabs.forEach((t, i) => {
    const r = reads[i];
    if (r.status === 'rejected') {
      if (failed.length === 0) reason = r.reason;
      failed.push(t.title);
      return;
    }
    if (r.value) Object.assign(t, { content: r.value.text, disk: r.value.stamp, format: r.value.format });
    kept.push(t);
  });
  if (failed.length > 0) showError(`reopen ${failed.join(', ')}`, reason);
  // An id in both lists (an old session) would make two tabs share one editor state: the closed
  // copy gets a new id, so its text is kept and dropping it never touches the open tab.
  const ids = new Set(kept.map((t) => t.id));
  const closed = s.closedTabs.map((c) => ({ ...c.tab, id: ids.has(c.tab.id) ? crypto.randomUUID() : c.tab.id, closedAt: c.closedAt }));
  tabs = [...kept, ...closed];
  untitledCounter = s.untitledCounter;
  lastFolder = s.lastFolder;
  pruneClosed(Date.now());
  if (kept.length === 0) return newUntitled();
  await activate(s.activeTabId);
}

/**
 * A tab's EditorState, created from its content on first use. Every shown tab has one, also in read
 * mode, so a drop, a reload or a link rewrite always has a document to land in.
 */
function ensureState(tab: TabState): EditorState {
  let state = getState(tab.id);
  if (!state) {
    state = createEditorState(tab.id, tab.content);
    setState(tab.id, state);
  }
  return state;
}

function mountEditor(tab: TabState): void {
  const state = ensureState(tab);
  let view = getView();
  if (!view) {
    view = new EditorView({ state, parent: panes.editor });
    setView(view);
  } else if (visibleTabId() !== tab.id) {
    view.setState(state);
  }
  const v = view;
  v.dispatch({ selection: { anchor: Math.min(tab.cursor, v.state.doc.length) } });
  requestAnimationFrame(() => {
    v.scrollDOM.scrollTop = tab.scrollTop;
    if (!stripHasFocus()) v.focus();
  });
}

/** Read mode loads on first use: marked and DOMPurify are not needed for the first paint (SPEC §9). */
const loadReader = () => import('./preview/render');

/** Loads read mode in the background once the window is idle, so the first Ctrl+E does not wait. */
export function preloadReader(): void {
  const idle = window.requestIdleCallback ?? ((fn: () => void) => setTimeout(fn, 200));
  idle(() => void loadReader().catch(() => {}));
}

/** Keys in the tab strip (arrows, Delete) keep focus there; a held Delete must not reach a note. */
const stripHasFocus = (): boolean => !!document.activeElement?.closest('.tabs');

/** Counts read renders; only the latest may fill the read pane. */
let renders = 0;

export async function activate(id: string): Promise<void> {
  const tab = openTab(id) ?? getTabs()[0];
  if (!tab) return;
  captureVisible();
  activeId = tab.id;
  ensureState(tab);
  panes.editor.hidden = tab.mode !== 'edit';
  panes.read.hidden = tab.mode !== 'read';
  changed();
  if (tab.mode === 'edit') {
    mountEditor(tab);
  } else {
    let renderRead: Awaited<ReturnType<typeof loadReader>>['renderRead'];
    try {
      ({ renderRead } = await loadReader());
    } catch (err) {
      showError('open read mode', err);
      return;
    }
    if (activeId !== tab.id || tab.mode !== 'read') return; // another tab or mode was chosen meanwhile
    let article: HTMLElement;
    const render = ++renders;
    try {
      article = await renderRead(tab.id, textOf(tab));
    } catch (err) {
      // A note the renderer cannot handle (very deep nesting) goes back to writing: a read tab that
      // throws on every start would stop the startup.
      showError(`show ${tab.title} in read mode`, err);
      tab.mode = 'edit';
      if (activeId === tab.id) await activate(tab.id);
      return;
    }
    // A slow render must not show in another tab, nor replace a newer render of this one.
    if (render !== renders || activeId !== tab.id || tab.mode !== 'read') return;
    panes.read.replaceChildren(article);
    requestAnimationFrame(() => {
      panes.read.scrollTop = tab.scrollTop;
      if (!stripHasFocus()) panes.read.focus({ preventScroll: true });
    });
  }
}

async function addTab(
  title: string,
  filePath: string | null,
  content: string,
  extra?: Partial<TabState>,
  after?: string
): Promise<void> {
  const tab: TabState = {
    id: crypto.randomUUID(),
    title,
    filePath,
    content,
    dirty: false,
    mode: 'edit',
    cursor: 0,
    scrollTop: 0,
    disk: null,
    format: null,
    ...extra
  };
  const at = after ? tabs.findIndex((t) => t.id === after) : -1;
  if (at === -1) tabs.push(tab);
  else tabs.splice(at + 1, 0, tab);
  await activate(tab.id);
  changed({ immediate: true });
}

export function newUntitled(): Promise<void> {
  return addTab(`Untitled-${untitledCounter++}`, null, '');
}

/** A new untitled tab in read mode holding `text` (the disk version of a note in conflict), next to tab `after`. */
export function openCopy(title: string, text: string, after?: string): Promise<void> {
  return addTab(title, null, text, { mode: 'read' }, after);
}

export async function openPath(path: string): Promise<void> {
  const norm = normPath(path);
  const existing = byPath(norm, true);
  if (existing) return activate(existing.id);
  // A closed note comes back as itself: same id (its writes still match) and its unsaved edits.
  const closed = byPath(norm, false);
  if (closed) return void (await reopenClosed(closed.id));
  try {
    const note = await readNote(norm);
    await addTab(basename(norm), norm, note.text, { disk: note.stamp, format: note.format });
  } catch (err) {
    showError(`open ${basename(norm)}`, err);
  }
}

export async function openPaths(paths: string[]): Promise<void> {
  for (const p of paths) await openPath(p);
}

/**
 * Closes a tab; it keeps its editor state, cursor and scroll (an empty untitled tab is dropped).
 * Returns the closed tab, or undefined when nothing was kept. Saving and the bars are the caller's
 * (closedTabs.ts).
 */
export async function closeTab(id: string): Promise<TabState | undefined> {
  const closing = openTab(id);
  if (!closing) return undefined;
  const idx = getTabs().indexOf(closing);
  captureVisible();
  // An empty untitled tab has nothing to bring back, unless a screenshot is still saving into it.
  const keep = closing.filePath !== null || textOf(closing) !== '' || imageSavesRunning(id);
  if (keep) {
    // Strictly after the last close, so two closes in one millisecond keep their order.
    closing.closedAt = Math.max(Date.now(), (closedTabs()[0]?.closedAt ?? 0) + 1);
    pruneClosed(Date.now());
  } else {
    tabs = tabs.filter((t) => t !== closing);
    dropState(id);
  }
  const open = getTabs();
  if (open.length === 0) await newUntitled();
  else if (activeId === id) await activate(open[Math.min(idx, open.length - 1)].id);
  changed({ immediate: true });
  return keep ? closing : undefined;
}

/**
 * Opens a closed tab again (the most recent without `id`) with its id and editor state, undo history
 * included, so its scratch images and queued work still match. Its conflict flag and bars are cleared,
 * so the external watch compares it with its file again; a clean disk tab is re-read from its file.
 * When its note is open in another tab meanwhile, that tab is activated, and unsaved edits of the
 * closed one open in a read-only copy. Returns the reopened tab, or undefined.
 */
export async function reopenClosed(id?: string): Promise<TabState | undefined> {
  const tab = id === undefined ? closedTabs()[0] : getTab(id);
  if (!tab || isOpen(tab)) return undefined;
  setConflict(tab.id, false);
  clearTabInfo(tab.id); // a warning left from its close
  const open = tab.filePath ? byPath(tab.filePath, true) : undefined;
  if (open) {
    const text = textOf(tab);
    tabs = tabs.filter((t) => t !== tab);
    dropState(tab.id);
    await activate(open.id);
    if (tab.dirty && text !== textOf(open)) await openCopy(`${tab.title} (closed)`, text, open.id);
    changed({ immediate: true });
    return undefined;
  }
  // Open again at once, at the end of the strip, so a second Ctrl+Shift+T during the read below takes the next one.
  const closedAt = tab.closedAt;
  tabs = [...tabs.filter((t) => t !== tab), tab];
  delete tab.closedAt;
  const shown = activeId;
  if (diskIsSource(tab)) {
    try {
      const note = await readNote(tab.filePath!);
      loadText(tab, note.text); // also when the hidden editor view still holds this tab
      Object.assign(tab, { content: note.text, disk: note.stamp, format: note.format, dirty: false });
    } catch (err) {
      // Stays closed, and nothing is written from it: a stale text must never go over the file. Its
      // text opens as a read-only copy, so it can be read or saved elsewhere; Ctrl+Shift+T tries again.
      tab.closedAt = closedAt;
      showError(`reopen ${tab.title}`, err);
      await openCopy(`${tab.title} (closed)`, textOf(tab));
      return undefined;
    }
  }
  // A tab the user went to during the read keeps the focus; a close of the shown tab does not count.
  if (activeId === shown || !openTab(shown)) await activate(tab.id);
  changed({ immediate: true });
  return tab;
}

/** Puts keyboard focus in the active tab's page: the editor, or the read view so it scrolls by keyboard. */
export function focusActive(): void {
  const tab = getActiveTab();
  if (!tab) return;
  if (tab.mode === 'edit') getView()?.focus();
  else panes.read.focus();
}

export async function toggleMode(): Promise<void> {
  const tab = getActiveTab();
  if (!tab) return;
  captureVisible();
  tab.mode = tab.mode === 'edit' ? 'read' : 'edit';
  await activate(tab.id);
}

export async function cycle(delta: 1 | -1): Promise<void> {
  const open = getTabs();
  if (open.length < 2) return;
  const idx = open.findIndex((t) => t.id === activeId);
  await activate(open[(idx + delta + open.length) % open.length].id);
}

/** Marks a tab dirty without an edit (its file is gone), so the session keeps its text. */
export function markDirty(id: string): void {
  const tab = getTab(id);
  if (!tab || tab.dirty) return;
  tab.dirty = true;
  changed({ immediate: true });
}

/**
 * After a write or reload: stores the file's stamp, marks the tab clean if its text still equals
 * `text`, and sets the path after a first save or Save As. Also for a tab closed during the write.
 */
export function markSaved(id: string, written: { text: string; stamp: DiskStamp; path?: string }): void {
  const tab = getTab(id);
  if (!tab) return;
  if (written.path) {
    tab.filePath = normPath(written.path);
    tab.title = basename(written.path);
    redrawImages(id); // image links now resolve against the new folder
  }
  tab.disk = written.stamp;
  if (textOf(tab) === written.text) tab.dirty = false;
  changed({ immediate: true }); // SPEC §7: the session is written right after a save
}

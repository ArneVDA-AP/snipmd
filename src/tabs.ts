// Tab list state and the visible workspace (editor or read view).
// The text of a tab lives in its EditorState; TabState.content is only filled when the session is
// written and used to create the editor state on restore. Read it through textOf().
import { EditorView } from '@codemirror/view';
import type { ClosedTab, DiskStamp, SessionFile, TabState } from './types';
import { createEditorState } from './editor/setup';
import { redrawImages } from './editor/imageWidget';
import {
  bindChangeListener,
  bindFilePathLookup,
  dropState,
  getState,
  getView,
  setState,
  setView,
  textOf as editorText,
  visibleTabId
} from './editor/registry';
import { renderRead } from './preview/render';
import { readNote } from './ipc';
import { setConflict } from './diskState';
import { scheduleSessionSave } from './session';
import { clearTabInfo, showError } from './infobar';
import { basename, normPath, samePath } from './paths';
import type { Titlebar } from './titlebar';

interface Panes {
  editor: HTMLElement;
  read: HTMLElement;
}

let tabs: TabState[] = [];
let activeId = '';
let untitledCounter = 1;
let lastFolder: string | null = null;
/**
 * Most recent first. Entries hold the closed TabState and keep its EditorState, so a closed tab is a
 * tab without a view: a paste, a link rewrite or a write still running for it lands in the entry.
 */
let closedTabs: ClosedTab[] = [];
let panes: Panes;
let titlebar: Titlebar;

let editListener: (id: string) => void = () => {};

/** Called on every edit of a tab (autosave hangs here). Cheap: it must not read the text. */
export function bindEditListener(fn: (id: string) => void): void {
  editListener = fn;
}

export function initTabs(p: Panes, t: Titlebar): void {
  panes = p;
  titlebar = t;
  bindFilePathLookup((id) => getTab(id)?.filePath ?? null);
  bindChangeListener(onDocChange);
}

/** Every change to the tab list or a tab ends here: redraw the tab strip, persist the session. */
function changed(opts?: { immediate?: boolean }): void {
  titlebar.render(tabs, activeId);
  scheduleSessionSave(opts);
}

function onDocChange(id: string): void {
  const tab = findTab(id); // a closed tab keeps its editor state: a paste or link rewrite can still land
  if (!tab) return;
  if (!getTab(id)) tab.content = textOf(tab); // the session reads a closed tab's text from content
  editListener(id);
  if (tab.dirty) {
    scheduleSessionSave();
    return;
  }
  tab.dirty = true;
  changed();
}

export const getTabs = (): readonly TabState[] => tabs;
export const getTab = (id: string): TabState | undefined => tabs.find((t) => t.id === id);
export const getActiveTab = (): TabState | undefined => getTab(activeId) ?? tabs[0];
/** Current text of a tab. */
export const textOf = (tab: TabState): string => editorText(tab.id) ?? tab.content;
export const getLastFolder = (): string | null => lastFolder;

/** SPEC §7: the last 20 closed tabs or 14 days, whichever is shorter. */
const CLOSED_MAX = 20;
const CLOSED_MS = 14 * 24 * 60 * 60 * 1000;
/** Edits that are not on disk (a conflict, a failed or refused write) never age out of the list. */
const unwritten = (t: TabState): boolean => t.filePath !== null && t.dirty;

/** The entries SPEC §7 keeps, plus every entry with unwritten edits; the editor state of the rest goes. */
function recent(list: ClosedTab[], now: number): ClosedTab[] {
  let young = 0;
  return list.filter((c) => {
    const keep = (now - c.closedAt < CLOSED_MS && young++ < CLOSED_MAX) || unwritten(c.tab);
    if (!keep) dropState(c.tab.id);
    return keep;
  });
}

/** The entry in `list` whose tab is the note at `path`. */
function byPath<T>(list: T[], tabOf: (x: T) => TabState, path: string): T | undefined {
  return list.find((x) => {
    const p = tabOf(x).filePath;
    return p !== null && samePath(p, path);
  });
}

/** An open tab, or else a closed one. */
export const findTab = (id: string): TabState | undefined => getTab(id) ?? closedTabs.find((c) => c.tab.id === id)?.tab;

/** Open and closed tabs: everything a close flush writes. */
export const allTabs = (): TabState[] => [...tabs, ...closedTabs.map((c) => c.tab)];

export function setLastFolder(folder: string): void {
  lastFolder = folder;
}

/** Stores the visible editor's state, cursor and scroll back into its tab. */
function captureVisible(): void {
  const view = getView();
  const tab = getTab(visibleTabId() ?? '');
  if (view && tab) {
    setState(tab.id, view.state);
    if (tab.mode === 'edit') {
      tab.cursor = view.state.selection.main.head;
      tab.scrollTop = view.scrollDOM.scrollTop;
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
  const copies = tabs.map((t) => ({ ...t, content: diskIsSource(t) ? '' : textOf(t) }));
  // Closed tabs keep their text, also when clean: the file may be gone by the time one is restored.
  const closed = closedTabs.map((c) => ({ tab: { ...c.tab }, closedAt: c.closedAt }));
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
  tabs = kept;
  untitledCounter = s.untitledCounter;
  lastFolder = s.lastFolder;
  closedTabs = recent([...s.closedTabs].sort((a, b) => b.closedAt - a.closedAt), Date.now());
  if (tabs.length === 0) return newUntitled();
  await activate(s.activeTabId);
}

function mountEditor(tab: TabState): void {
  let state = getState(tab.id);
  if (!state) {
    state = createEditorState(tab.id, tab.content);
    setState(tab.id, state);
  }
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
    v.focus();
  });
}

export async function activate(id: string): Promise<void> {
  if (tabs.length === 0) return;
  captureVisible();
  const tab = getTab(id) ?? tabs[0];
  activeId = tab.id;
  panes.editor.hidden = tab.mode !== 'edit';
  panes.read.hidden = tab.mode !== 'read';
  changed();
  if (tab.mode === 'edit') {
    mountEditor(tab);
  } else {
    await renderRead(panes.read, tab.id, textOf(tab));
    requestAnimationFrame(() => {
      panes.read.scrollTop = tab.scrollTop;
      panes.read.focus({ preventScroll: true });
    });
  }
}

async function addTab(title: string, filePath: string | null, content: string, extra?: Partial<TabState>): Promise<void> {
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
  tabs.push(tab);
  await activate(tab.id);
  changed({ immediate: true });
}

export function newUntitled(): Promise<void> {
  return addTab(`Untitled-${untitledCounter++}`, null, '');
}

/** A new untitled tab in read mode holding `text`: the disk version of a note in conflict. */
export function openCopy(title: string, text: string): Promise<void> {
  return addTab(title, null, text, { mode: 'read' });
}

export async function openPath(path: string): Promise<void> {
  const norm = normPath(path);
  const existing = byPath(tabs, (t) => t, norm);
  if (existing) return activate(existing.id);
  // A closed note comes back as itself: same id (its writes still match) and its unsaved edits.
  const closed = byPath(closedTabs, (c) => c.tab, norm);
  if (closed) return void (await reopenClosed(closed.tab.id));
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
 * Closes a tab and puts it at the front of the closed-tabs list with its editor state, cursor and
 * scroll (an empty untitled tab is dropped). Returns the closed tab, or undefined when nothing was kept. Saving, bars and the restore bar are the caller's (closedTabs.ts).
 */
export async function closeTab(id: string): Promise<TabState | undefined> {
  const idx = tabs.findIndex((t) => t.id === id);
  if (idx === -1) return undefined;
  captureVisible();
  const [closing] = tabs.splice(idx, 1);
  closing.content = textOf(closing);
  const now = Date.now();
  // An empty untitled tab has nothing to bring back.
  const keep = closing.filePath !== null || closing.content !== '';
  if (keep) closedTabs = recent([{ tab: closing, closedAt: now }, ...closedTabs], now);
  else dropState(id);
  if (tabs.length === 0) await newUntitled();
  else if (activeId === id) await activate(tabs[Math.min(idx, tabs.length - 1)].id);
  changed({ immediate: true });
  return keep ? closing : undefined;
}

/**
 * Takes a tab off the closed-tabs list (the most recent without `id`) and opens it again with its
 * id and editor state (undo history included), so its scratch images and queued work still match.
 * Its conflict flag and leftover bars are cleared: the external watch compares it with its file again. A clean disk tab
 * is read from its file;
 * when that fails it keeps the text it closed with and the external watch reports the file. A note
 * that is open meanwhile is activated instead; edits the closed one had open in a read-only copy.
 * Returns the reopened tab, or undefined.
 */
export async function reopenClosed(id?: string): Promise<TabState | undefined> {
  const i = id === undefined ? 0 : closedTabs.findIndex((c) => c.tab.id === id);
  const entry = closedTabs[i];
  if (!entry) return undefined;
  closedTabs = closedTabs.filter((c) => c !== entry);
  const tab = entry.tab;
  setConflict(tab.id, false);
  clearTabInfo(tab.id); // a warning left from its close
  const open = tab.filePath ? byPath(tabs, (t) => t, tab.filePath) : undefined;
  if (open) {
    const text = textOf(tab);
    dropState(tab.id);
    await activate(open.id);
    if (tab.dirty && text !== textOf(open)) await openCopy(`${tab.title} (closed)`, text);
    changed({ immediate: true });
    return undefined;
  }
  if (diskIsSource(tab)) {
    try {
      const note = await readNote(tab.filePath!);
      if (note.text !== textOf(tab)) dropState(tab.id); // the editor is created again from the file
      Object.assign(tab, { content: note.text, disk: note.stamp, format: note.format });
    } catch {
      // Kept as closed; a missing file shows up as the "no longer on disk" bar.
    }
  }
  tabs.push(tab);
  await activate(tab.id);
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
  if (tabs.length < 2) return;
  const idx = tabs.findIndex((t) => t.id === activeId);
  await activate(tabs[(idx + delta + tabs.length) % tabs.length].id);
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
  const tab = findTab(id);
  if (!tab) return;
  if (written.path) {
    tab.filePath = normPath(written.path);
    tab.title = basename(written.path);
    redrawImages(id); // image links now resolve against the new folder
  }
  tab.disk = written.stamp;
  if (textOf(tab) === written.text) tab.dirty = false;
  changed();
}

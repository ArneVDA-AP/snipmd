// Tab list state and the visible workspace (editor or read view).
// The text of a tab lives in its EditorState; TabState.content is only filled when the session is
// written and used to create the editor state on restore. Read it through textOf().
import { EditorView } from '@codemirror/view';
import type { ClosedTab, DiskStamp, SessionFile, TabMode, TabState } from './types';
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
import { scheduleSessionSave } from './session';
import { showError } from './infobar';
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

export const getTabs = (): readonly TabState[] => tabs;
export const getTab = (id: string): TabState | undefined => tabs.find((t) => t.id === id);
export const getActiveTab = (): TabState | undefined => getTab(activeId) ?? tabs[0];
/** Current text of a tab. */
export const textOf = (tab: TabState): string => editorText(tab.id) ?? tab.content;
export const getLastFolder = (): string | null => lastFolder;

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
  return { version: 3, activeTabId: activeId, untitledCounter, lastFolder, tabs: copies, closedTabs };
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
  closedTabs = s.closedTabs;
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
    requestAnimationFrame(() => (panes.read.scrollTop = tab.scrollTop));
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

/** A new untitled tab holding `text`, e.g. the disk version of a note in conflict. */
export function openCopy(title: string, text: string, mode: TabMode): Promise<void> {
  return addTab(title, null, text, { mode });
}

export async function openPath(path: string): Promise<void> {
  const norm = normPath(path);
  const existing = tabs.find((t) => t.filePath && samePath(t.filePath, norm));
  if (existing) return activate(existing.id);
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

export async function closeTab(id: string): Promise<void> {
  const idx = tabs.findIndex((t) => t.id === id);
  if (idx === -1) return;
  captureVisible();
  const [closing] = tabs.splice(idx, 1);
  closing.content = textOf(closing); // a write still queued for this tab reads it from here
  dropState(id);
  if (tabs.length === 0) return newUntitled();
  if (activeId === id) await activate(tabs[Math.min(idx, tabs.length - 1)].id);
  changed({ immediate: true });
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
 * `text`, and sets the path after a first save or Save As.
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
  changed();
}

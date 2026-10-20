// Tab list state and the visible workspace (editor or read view).
// The text of a tab lives in its EditorState; TabState.content is only filled when the session is
// written and used to create the editor state on restore. Read it through textOf().
import { EditorView } from '@codemirror/view';
import type { ClosedTab, SessionFile, TabState } from './types';
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
import { gcScratchAssets, readNote } from './ipc';
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
export const untitledContentsExcept = (id?: string): string[] =>
  tabs.filter((t) => t.filePath === null && t.id !== id).map(textOf);

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

export function snapshot(): SessionFile {
  captureVisible();
  for (const t of tabs) t.content = textOf(t);
  return { version: 3, activeTabId: activeId, untitledCounter, lastFolder, tabs, closedTabs };
}

export async function restore(s: SessionFile): Promise<void> {
  tabs = s.tabs;
  untitledCounter = s.untitledCounter;
  lastFolder = s.lastFolder;
  closedTabs = s.closedTabs;
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

async function addTab(title: string, filePath: string | null, content: string): Promise<void> {
  const tab: TabState = {
    id: crypto.randomUUID(),
    title,
    filePath,
    content,
    dirty: false,
    mode: 'edit',
    cursor: 0,
    scrollTop: 0
  };
  tabs.push(tab);
  await activate(tab.id);
  changed({ immediate: true });
}

export function newUntitled(): Promise<void> {
  return addTab(`Untitled-${untitledCounter++}`, null, '');
}

export async function openPath(path: string): Promise<void> {
  const norm = normPath(path);
  const existing = tabs.find((t) => t.filePath && samePath(t.filePath, norm));
  if (existing) return activate(existing.id);
  try {
    const { text } = await readNote(norm);
    await addTab(basename(norm), norm, text);
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
  dropState(id);
  // Prototype behaviour, replaced in phase 5 by the closed-tabs list and startup-only cleanup.
  if (closing.filePath === null) {
    await gcScratchAssets(untitledContentsExcept()).catch(() => 0);
  }
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

/** Marks a tab clean if its text still equals what was written. Sets the path after a first save. */
export function markSaved(id: string, writtenText: string, newPath?: string): void {
  const tab = getTab(id);
  if (!tab) return;
  if (newPath) {
    tab.filePath = normPath(newPath);
    tab.title = basename(newPath);
    redrawImages(id); // image links now resolve against the new folder
  }
  if (textOf(tab) === writtenText) tab.dirty = false;
  changed();
}

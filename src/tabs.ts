// Tab list state and the visible workspace (editor or read view).
import { EditorView } from '@codemirror/view';
import type { ClosedTab, SessionFile, TabState } from './types';
import { createEditorState } from './editor/setup';
import { assetResolved } from './editor/imageWidget';
import {
  bindChangeListener,
  bindFilePathLookup,
  dropState,
  getState,
  getView,
  setState,
  setView,
  visibleTabId
} from './editor/registry';
import { renderRead } from './preview/render';
import { gcScratchAssets, readNote } from './ipc';
import { scheduleSessionSave } from './session';
import { showInfo } from './infobar';
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

function onDocChange(id: string, doc: string): void {
  const tab = getTab(id);
  if (!tab) return;
  tab.content = doc;
  if (!tab.dirty) {
    tab.dirty = true;
    renderTitlebar();
  }
  scheduleSessionSave();
}

export const getTabs = (): readonly TabState[] => tabs;
export const getTab = (id: string): TabState | undefined => tabs.find((t) => t.id === id);
export const getActiveTab = (): TabState | undefined => getTab(activeId) ?? tabs[0];
export const getLastFolder = (): string | null => lastFolder;
export const untitledContentsExcept = (id?: string): string[] =>
  tabs.filter((t) => t.filePath === null && t.id !== id).map((t) => t.content);

export function setLastFolder(folder: string): void {
  lastFolder = folder;
}

const newId = (): string => `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const basename = (p: string): string => p.replace(/\\/g, '/').split('/').pop() || p;

function renderTitlebar(): void {
  titlebar.render(tabs, activeId);
}

/** Stores the visible editor's state, cursor and scroll back into its tab. */
function captureVisible(): void {
  const view = getView();
  const vid = visibleTabId();
  if (view && vid) {
    const tab = getTab(vid);
    setState(vid, view.state);
    if (tab && tab.mode === 'edit') {
      tab.cursor = view.state.selection.main.head;
      tab.scrollTop = view.scrollDOM.scrollTop;
    }
  }
  const active = getActiveTab();
  if (active && active.mode === 'read' && !panes.read.hidden) active.scrollTop = panes.read.scrollTop;
}

export function snapshot(): SessionFile {
  captureVisible();
  return {
    version: 3,
    activeTabId: activeId,
    untitledCounter,
    lastFolder,
    tabs: tabs.map((t) => ({ ...t })),
    closedTabs
  };
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
  // Redraw images whose URLs resolved while this tab was hidden.
  v.dispatch({
    selection: { anchor: Math.min(tab.cursor, v.state.doc.length) },
    effects: assetResolved.of('activate')
  });
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
  renderTitlebar();
  if (tab.mode === 'edit') {
    mountEditor(tab);
  } else {
    await renderRead(panes.read, tab.id, tab.content);
    requestAnimationFrame(() => (panes.read.scrollTop = tab.scrollTop));
  }
  scheduleSessionSave();
}

export async function newUntitled(): Promise<void> {
  const tab: TabState = {
    id: newId(),
    title: `Untitled-${untitledCounter++}`,
    filePath: null,
    content: '',
    dirty: false,
    mode: 'edit',
    cursor: 0,
    scrollTop: 0
  };
  tabs.push(tab);
  await activate(tab.id);
  scheduleSessionSave({ immediate: true });
}

export async function openPath(path: string): Promise<void> {
  const norm = path.replace(/\\/g, '/');
  const existing = tabs.find((t) => t.filePath?.replace(/\\/g, '/').toLowerCase() === norm.toLowerCase());
  if (existing) return activate(existing.id);
  let text: string;
  try {
    text = (await readNote(norm)).text;
  } catch (err) {
    showInfo({ kind: 'error', text: `Could not open ${basename(norm)}: ${String(err)}` });
    return;
  }
  const tab: TabState = {
    id: newId(),
    title: basename(norm),
    filePath: norm,
    content: text,
    dirty: false,
    mode: 'edit',
    cursor: 0,
    scrollTop: 0
  };
  tabs.push(tab);
  await activate(tab.id);
  scheduleSessionSave({ immediate: true });
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
  if (tabs.length === 0) {
    await newUntitled();
    return;
  }
  if (activeId === id) await activate(tabs[Math.min(idx, tabs.length - 1)].id);
  else renderTitlebar();
  scheduleSessionSave({ immediate: true });
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

/** Marks a tab clean if its content still equals what was written. Sets the path after a first save. */
export function markSaved(id: string, writtenText: string, newPath?: string): void {
  const tab = getTab(id);
  if (!tab) return;
  if (newPath) {
    tab.filePath = newPath;
    tab.title = basename(newPath);
    // Image links now resolve against the new folder.
    if (getState(id)) applyRedraw(id);
  }
  if (tab.content === writtenText) tab.dirty = false;
  renderTitlebar();
}

function applyRedraw(id: string): void {
  const view = getView();
  if (view && visibleTabId() === id) view.dispatch({ effects: assetResolved.of('path-changed') });
}

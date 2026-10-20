// Shared types. contract.shared: changing this file needs the main session.

export type TabMode = 'edit' | 'read';

/** Serializable state of one tab. The CodeMirror EditorState lives in editor/registry.ts. */
export interface TabState {
  id: string;
  title: string;
  /** Absolute path of the note on disk, or null for an untitled tab. */
  filePath: string | null;
  content: string;
  dirty: boolean;
  mode: TabMode;
  cursor: number;
  scrollTop: number;
}

export interface ClosedTab {
  tab: TabState;
  closedAt: number;
}

/** Shape of %APPDATA%/snip-md/session.json. */
export interface SessionFile {
  version: 3;
  activeTabId: string;
  untitledCounter: number;
  lastFolder: string | null;
  tabs: TabState[];
  closedTabs: ClosedTab[];
}

export type InfoKind = 'info' | 'warning' | 'error';

export interface InfoAction {
  label: string;
  run: () => void;
  primary?: boolean;
}

/** A message in the info bar (SPEC §4). The only way the app shows messages or choices. */
export interface InfoMessage {
  kind: InfoKind;
  text: string;
  actions?: InfoAction[];
  /** Auto-dismiss after this many ms. Omitted = stays until dismissed. */
  timeoutMs?: number;
  position?: 'top' | 'bottom';
  /** A keyed message stays until it is dismissed or cleared with clearInfo(key); showing the key again updates it in place. */
  key?: string;
}

export interface SavedImage {
  /** Relative link target to put in the Markdown, e.g. `labo-04.assets/snip-....png`. */
  link: string;
  absPath: string;
}

export interface NoteFile {
  text: string;
}

// Shared types. contract.shared: changing this file needs the main session.

export type TabMode = 'edit' | 'read';

/** Line endings and BOM of a note as found on disk (SPEC §6.1). */
export interface TextFormat {
  crlf: boolean;
  bom: boolean;
}

/** What SnipMD last knew of a note's file; a different stamp means it changed outside SnipMD. */
export interface DiskStamp {
  mtimeMs: number;
  size: number;
}

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
  /** Stamp of the file after the last read or write; null for untitled tabs and unknown ones. */
  disk: DiskStamp | null;
  /** Format the note was read with, sent back on write; null lets Rust read it from the file. */
  format: TextFormat | null;
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
  /** No dismiss button: the bar stays until its choice is made (conflicts). */
  sticky?: boolean;
  /** Controls of the feature that shows the bar (first-save form), placed after the text. Built with DOM APIs, never innerHTML. */
  body?: HTMLElement;
}

export interface SavedImage {
  /** Relative link target to put in the Markdown, e.g. `labo-04.assets/snip-....png`. */
  link: string;
  absPath: string;
}

/** Payload of the `files-dropped` event. x, y: drop point in physical pixels of the window's client area. */
export interface DroppedFiles {
  notes: string[];
  images: string[];
  x: number;
  y: number;
}

export interface NoteFile {
  text: string;
  format: TextFormat;
  stamp: DiskStamp;
}

/** A note write either happened, or was refused because the file changed outside SnipMD (null: it is gone). */
export type WriteOutcome = { written: DiskStamp } | { changed: DiskStamp | null };

/** Images moved or copied to another folder: links that start exactly with `from` now start with `to` (both as written in Markdown, percent-encoded). */
export interface PrefixMove {
  from: string;
  to: string;
}

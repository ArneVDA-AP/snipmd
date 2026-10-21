// Typed wrappers around the Rust commands. No logic here.
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import type { DiskStamp, DroppedFiles, NoteFile, PrefixMove, SavedImage, TextFormat, WriteOutcome } from './types';

/** Headers that tell Rust which tab and note an image belongs to. The path is percent-encoded (headers are ASCII). */
function imageHeaders(tabId: string, notePath: string | null): Record<string, string> {
  return notePath ? { 'x-tab-id': tabId, 'x-note-path': encodeURIComponent(notePath) } : { 'x-tab-id': tabId };
}

/** Saves pasted image bytes (raw IPC body) into the tab's image folder. */
export function saveImage(tabId: string, notePath: string | null, bytes: Uint8Array): Promise<SavedImage> {
  return invoke<SavedImage>('save_image', bytes, { headers: imageHeaders(tabId, notePath) });
}

/** Copies a dropped image file into the tab's image folder. Rust only accepts files that were dropped. */
export function importImage(tabId: string, notePath: string | null, src: string): Promise<SavedImage> {
  return invoke<SavedImage>('import_image', { tabId, notePath, src });
}

/**
 * Writes a note in `format` (null: the format of the file on disk, or the system's for a new one: CRLF on Windows, LF on macOS). With
 * `expected`, Rust refuses when the file's stamp differs (changed or gone outside SnipMD) and says so.
 */
export function writeNote(path: string, text: string, format: TextFormat | null, expected: DiskStamp | null): Promise<WriteOutcome> {
  return invoke<WriteOutcome>('write_markdown_file', { path, content: text, format, expected });
}

/** T4 */
export function readNote(path: string): Promise<NoteFile> {
  return invoke<NoteFile>('read_markdown_file', { path });
}

/** The note's current stamp, or null when the file is gone. */
export function statNote(path: string): Promise<DiskStamp | null> {
  return invoke<DiskStamp | null>('stat_note', { path });
}

/** First save: moves the untitled tab's images next to the new note. Null when it had none. */
export function promoteUntitled(tabId: string, notePath: string): Promise<PrefixMove | null> {
  return invoke<PrefixMove | null>('promote_untitled', { tabId, notePath });
}

/** Save As: copies the note's image folder for the new note; the original stays. Null when there is none. */
export function copyAssets(fromNote: string, toNote: string): Promise<PrefixMove | null> {
  return invoke<PrefixMove | null>('copy_assets', { fromNote, toNote });
}

/** Documents\Notes, created if missing. */
export function defaultNoteFolder(): Promise<string> {
  return invoke<string>('default_note_folder');
}

/** Native folder picker for the first-save bar. */
export function pickFolder(): Promise<string | null> {
  return invoke<string | null>('pick_folder');
}

/** True when `name` is a valid new note name in `folder` and no file has it yet. */
export function noteNameFree(folder: string, name: string): Promise<boolean> {
  return invoke<boolean>('note_name_free', { folder, name });
}

/** Creates `folder/name` as an empty file (never over an existing one) and returns its path. */
export function claimNewNote(folder: string, name: string): Promise<string> {
  return invoke<string>('claim_new_note', { folder, name });
}

/** Absolute path of an image link; for an untitled tab, `untitled.assets/` is its scratch folder. */
export function resolveAssetPath(tabId: string, relPath: string, notePath: string | null): Promise<string> {
  return invoke<string>('resolve_asset_abs_path', { tabId, relPath, currentFilePath: notePath });
}

export function toAssetUrl(absPath: string): string {
  return convertFileSrc(absPath);
}

export function loadSessionRaw(): Promise<string | null> {
  return invoke<string | null>('load_session');
}

/** The session goes as a raw UTF-8 body, not as a JSON string inside JSON. */
export function saveSessionRaw(json: string): Promise<void> {
  return invoke<void>('save_session', new TextEncoder().encode(json));
}

export function getCliStartupFiles(): Promise<string[]> {
  return invoke<string[]>('get_cli_startup_files');
}

/** Notes Finder handed over (macOS) and the page has not taken yet; always empty elsewhere. */
export function takeOpenedNotes(): Promise<string[]> {
  return invoke<string[]>('take_opened_notes');
}

export function pickFileToOpen(): Promise<string | null> {
  return invoke<string | null>('pick_open');
}

export function pickSavePath(defaultName: string): Promise<string | null> {
  return invoke<string | null>('pick_save', { defaultName });
}

/** Opens a web or mailto link in the user's default app. Rust checks the scheme. */
export function openLink(url: string): Promise<void> {
  return invoke<void>('open_link', { url });
}

/** A measurement mark (src/perf.ts); Rust logs it only when SNIPMD_TRACE is set. */
export function perfMark(name: string, ms?: number, epoch?: number): Promise<boolean> {
  return invoke<boolean>('perf_mark', { name, ms: ms ?? null, epoch: epoch ?? null });
}

/** True when Rust gave the window Windows 11 Mica; the top bar may then be transparent. */
export function windowBackdrop(): Promise<boolean> {
  return invoke<boolean>('window_backdrop');
}

export const appWindow = {
  minimize: () => getCurrentWindow().minimize(),
  toggleMaximize: () => getCurrentWindow().toggleMaximize(),
  isMaximized: () => getCurrentWindow().isMaximized(),
  close: () => getCurrentWindow().close()
};

/** Paths forwarded by a second app instance (single-instance plugin). */
export async function onForwardedFiles(callback: (paths: string[]) => void): Promise<void> {
  await listen<string[]>('open-files', (e) => {
    if (Array.isArray(e.payload) && e.payload.length > 0) callback(e.payload);
  });
}

/** Notes Finder hands over while the app runs (macOS). Also takes any that arrived before the listener. */
export async function onOpenedNotes(callback: (paths: string[]) => void): Promise<void> {
  const take = async () => {
    const paths = await takeOpenedNotes();
    if (paths.length > 0) callback(paths);
  };
  await listen('notes-opened', () => void take());
  await take();
}

/** A menu bar item (macOS) asks for the page command with this name. */
export async function onMenuCommand(callback: (name: string) => void): Promise<void> {
  await listen<string>('menu-command', (e) => callback(e.payload));
}

/** macOS Paste as Plain Text: the clipboard's text, read by Rust for that menu item or its key. */
export async function onPasteText(callback: (text: string) => void): Promise<void> {
  await listen<string>('paste-text', (e) => callback(e.payload));
}

/** A quit (macOS: Cmd+Q, the Dock, logout) waits for `beforeQuit`, then Rust lets it go on. */
export async function onQuitRequested(beforeQuit: () => Promise<void>): Promise<void> {
  await listen('quit-requested', async () => {
    await beforeQuit().catch(() => {});
    await invoke('quit_ready');
  });
}

/** Files dropped on the window, sorted by Rust into notes and images. What to do with them is decided by the caller. */
export async function onFilesDropped(callback: (dropped: DroppedFiles) => void): Promise<void> {
  await listen<DroppedFiles>('files-dropped', (e) => callback(e.payload));
}

/** Runs `beforeClose` on every close request (titlebar button, Alt+F4, taskbar, shutdown), then the window closes. */
export async function onCloseRequested(beforeClose: () => Promise<void>): Promise<void> {
  await getCurrentWindow().onCloseRequested(async () => {
    await beforeClose().catch(() => {});
  });
}

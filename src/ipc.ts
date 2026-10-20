// Typed wrappers around the Rust commands. No logic here.
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import type { NoteFile, SavedImage } from './types';
import { MD_EXTENSIONS } from './paths';

interface SaveImageResult {
  markdownRelPath: string;
  absDiskPath: string;
}

/** T3. Saves image bytes for a tab. Phase 3 moves this to a raw binary body and per-note folders. */
export async function saveImage(
  _tabId: string,
  notePath: string | null,
  bytes: Uint8Array
): Promise<SavedImage> {
  const r = await invoke<SaveImageResult>('save_clipboard_image', {
    bytes: Array.from(bytes),
    currentFilePath: notePath
  });
  return { link: r.markdownRelPath, absPath: r.absDiskPath };
}

/** T4 */
export function writeNote(path: string, text: string): Promise<void> {
  return invoke<void>('write_markdown_file', { path, content: text });
}

/** T4 */
export async function readNote(path: string): Promise<NoteFile> {
  const text = await invoke<string>('read_markdown_file', { path });
  return { text };
}

export function resolveAssetPath(relPath: string, notePath: string | null): Promise<string> {
  return invoke<string>('resolve_asset_abs_path', { relPath, currentFilePath: notePath });
}

export function toAssetUrl(absPath: string): string {
  return convertFileSrc(absPath);
}

export function promoteScratchAssets(
  content: string,
  targetMdPath: string,
  remainingUnsavedContents: string[]
): Promise<void> {
  return invoke<void>('promote_scratch_assets', { content, targetMdPath, remainingUnsavedContents });
}

export function gcScratchAssets(liveUnsavedContents: string[]): Promise<number> {
  return invoke<number>('gc_scratch_assets', { liveUnsavedContents });
}

export function loadSessionRaw(): Promise<string | null> {
  return invoke<string | null>('load_session');
}

export function saveSessionRaw(json: string): Promise<void> {
  return invoke<void>('save_session', { json });
}

export function getCliStartupFiles(): Promise<string[]> {
  return invoke<string[]>('get_cli_startup_files');
}

export async function pickFileToOpen(): Promise<string | null> {
  const selected = await openDialog({
    multiple: false,
    filters: [{ name: 'Markdown', extensions: MD_EXTENSIONS }]
  });
  return typeof selected === 'string' ? selected : null;
}

export async function pickSavePath(defaultName: string): Promise<string | null> {
  const selected = await saveDialog({
    defaultPath: defaultName.endsWith('.md') ? defaultName : `${defaultName}.md`,
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  });
  return typeof selected === 'string' ? selected : null;
}

export const appWindow = {
  minimize: () => getCurrentWindow().minimize(),
  toggleMaximize: () => getCurrentWindow().toggleMaximize(),
  close: () => getCurrentWindow().close()
};

/** Paths forwarded by a second app instance (single-instance plugin). */
export async function onForwardedFiles(callback: (paths: string[]) => void): Promise<void> {
  await listen<string[]>('open-files', (e) => {
    if (Array.isArray(e.payload) && e.payload.length > 0) callback(e.payload);
  });
}

/** Files dropped on the window. What to do with them is decided by the caller. */
export async function onFilesDropped(callback: (paths: string[]) => void): Promise<void> {
  await getCurrentWindow().onDragDropEvent((e) => {
    if (e.payload.type === 'drop' && e.payload.paths.length > 0) callback(e.payload.paths);
  });
}

/** Runs `beforeClose` on every close request (titlebar button, Alt+F4, taskbar, shutdown), then the window closes. */
export async function onCloseRequested(beforeClose: () => Promise<void>): Promise<void> {
  await getCurrentWindow().onCloseRequested(async () => {
    await beforeClose().catch(() => {});
  });
}

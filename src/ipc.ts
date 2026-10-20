// Typed wrappers around the Rust commands. No logic here.
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import type { DroppedFiles, NoteFile, SavedImage } from './types';

/** Headers that tell Rust which tab and note an image belongs to. The path is percent-encoded (headers are ASCII). */
function imageHeaders(tabId: string, notePath: string | null): Record<string, string> {
  return notePath ? { 'x-tab-id': tabId, 'x-note-path': encodeURIComponent(notePath) } : { 'x-tab-id': tabId };
}

/** T3. Saves pasted image bytes (raw IPC body) into the tab's image folder. */
export function saveImage(tabId: string, notePath: string | null, bytes: Uint8Array): Promise<SavedImage> {
  return invoke<SavedImage>('save_image', bytes, { headers: imageHeaders(tabId, notePath) });
}

/** T3b. Copies a dropped image file into the tab's image folder. Rust only accepts files that were dropped. */
export function importImage(tabId: string, notePath: string | null, src: string): Promise<SavedImage> {
  return invoke<SavedImage>('import_image', { tabId, notePath, src });
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

/** Absolute path of an image link; for an untitled tab, `untitled.assets/` is its scratch folder. */
export function resolveAssetPath(tabId: string, relPath: string, notePath: string | null): Promise<string> {
  return invoke<string>('resolve_asset_abs_path', { tabId, relPath, currentFilePath: notePath });
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

/** The session goes as a raw UTF-8 body, not as a JSON string inside JSON. */
export function saveSessionRaw(json: string): Promise<void> {
  return invoke<void>('save_session', new TextEncoder().encode(json));
}

export function getCliStartupFiles(): Promise<string[]> {
  return invoke<string[]>('get_cli_startup_files');
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

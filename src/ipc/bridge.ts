import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { open as tauriOpenDialog, save as tauriSaveDialog } from '@tauri-apps/plugin-dialog';

export interface SaveImageResult {
  markdownRelPath: string;
  absDiskPath: string;
}

export interface VirtualStorageStats {
  scratchAssetCount: number;
  localAssetCount: number;
  lastGcDeletedCount: number;
  scratchAssets: string[];
  localAssets: Record<string, string[]>;
}

const VFS_FILES_KEY = 'snipmd_vfs_files_v1';
const VFS_ASSETS_KEY = 'snipmd_vfs_assets_v1';
const VFS_SESSION_KEY = 'snipmd_vfs_session_v1';
const SCRATCHPAD_ROOT = 'C:/Users/Developer/AppData/Roaming/snip-md/scratchpad';

let lastGcDeletedCount = 0;

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+/g, '/');
}

function getParentDir(filePath: string): string {
  const norm = normalizePath(filePath);
  const idx = norm.lastIndexOf('/');
  return idx > 0 ? norm.slice(0, idx) : 'D:/notes';
}

const DEMO_SNIP_SVG_DATA_URL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="780" height="560" viewBox="0 0 780 560">
  <rect width="100%" height="100%" fill="#0d0e12"/>
  <!-- Top Header Banner -->
  <rect x="20" y="20" width="740" height="52" rx="6" fill="#161822" stroke="#3f3f46"/>
  <circle cx="44" cy="46" r="6" fill="#f43f5e"/>
  <circle cx="64" cy="46" r="6" fill="#f59e0b"/>
  <circle cx="84" cy="46" r="6" fill="#10b981"/>
  <text x="110" y="51" fill="#fafafa" font-family="monospace" font-weight="700" font-size="13">SNIPMD SYSTEM ARCHITECTURE — 780×560px HIGH-DPI CAPTURE</text>
  <text x="585" y="51" fill="#a855f7" font-family="monospace" font-weight="600" font-size="11">CLICK IMAGE TO EXPAND</text>

  <!-- Stage 1: Clipboard & Atomic File Creation (Visible within 360px cap) -->
  <rect x="20" y="88" width="355" height="220" rx="6" fill="#14151c" stroke="#38bdf8" stroke-width="1.5"/>
  <text x="38" y="118" fill="#38bdf8" font-family="monospace" font-weight="700" font-size="13">01. CLIPBOARD INTERCEPTOR (CM6)</text>
  <text x="38" y="144" fill="#e4e4e7" font-family="monospace" font-size="11">• Win+Shift+S -> Ctrl+V paste event</text>
  <text x="38" y="168" fill="#e4e4e7" font-family="monospace" font-size="11">• Extracts image/png Blob -> Uint8Array</text>
  <text x="38" y="192" fill="#e4e4e7" font-family="monospace" font-size="11">• Pre-populates sync Map&lt;key, assetUrl&gt;</text>
  <rect x="38" y="212" width="318" height="76" rx="4" fill="#0b0c10" stroke="#27272c"/>
  <text x="52" y="236" fill="#4ade80" font-family="monospace" font-size="11">StateField&lt;DecorationSet&gt;</text>
  <text x="52" y="256" fill="#a1a1aa" font-family="monospace" font-size="10">Decoration.widget({ block: true, side: 1 })</text>
  <text x="52" y="274" fill="#f472b6" font-family="monospace" font-size="10">Capped at 360px height by default</text>

  <rect x="405" y="88" width="355" height="220" rx="6" fill="#14151c" stroke="#a855f7" stroke-width="1.5"/>
  <text x="423" y="118" fill="#a855f7" font-family="monospace" font-weight="700" font-size="13">02. RUST TAURI v2 ATOMIC IPC</text>
  <text x="423" y="144" fill="#e4e4e7" font-family="monospace" font-size="11">• snip-YYYYMMDD-HHMMSS-mmm-XXXX.png</text>
  <text x="423" y="168" fill="#e4e4e7" font-family="monospace" font-size="11">• OpenOptions::new().create_new(true)</text>
  <text x="423" y="192" fill="#e4e4e7" font-family="monospace" font-size="11">• 64-attempt collision retry loop</text>
  <rect x="423" y="212" width="318" height="76" rx="4" fill="#0b0c10" stroke="#27272c"/>
  <text x="437" y="236" fill="#4ade80" font-family="monospace" font-size="11">Cross-Volume Promotion Fallback</text>
  <text x="437" y="256" fill="#a1a1aa" font-family="monospace" font-size="10">fs::rename() -> fs::copy() + remove_file()</text>
  <text x="437" y="274" fill="#38bdf8" font-family="monospace" font-size="10">Handles C:\\ (%APPDATA%) -> D:\\ notes</text>

  <!-- 360px Fold Line Indicator -->
  <line x1="20" y1="334" x2="760" y2="334" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="6,6"/>
  <rect x="230" y="322" width="320" height="24" rx="12" fill="#271a05" stroke="#f59e0b"/>
  <text x="252" y="338" fill="#fbbf24" font-family="monospace" font-weight="700" font-size="11">▼ 360px CAP FOLD — CLICK TO REVEAL BELOW ▼</text>

  <!-- Stage 2: Below the 360px fold (Revealed when clicked/expanded!) -->
  <rect x="20" y="364" width="740" height="176" rx="6" fill="#121916" stroke="#10b981" stroke-width="1.5"/>
  <text x="40" y="396" fill="#4ade80" font-family="monospace" font-weight="700" font-size="14">03. EXPANDED FULL-RESOLUTION VIEW (BELOW 360px FOLD)</text>
  <text x="40" y="424" fill="#e4e4e7" font-family="monospace" font-size="12">You clicked the inline snip! It is now expanded to 100% height (560px).</text>
  <text x="40" y="452" fill="#a1a1aa" font-family="monospace" font-size="11">• Mark-and-Sweep GC (gc_scratch_assets) runs on Ctrl+S, Ctrl+W, and load_session</text>
  <text x="40" y="476" fill="#a1a1aa" font-family="monospace" font-size="11">• Never runs on window.blur so Ctrl+Z undo inside active scratch tabs stays intact</text>
  <rect x="40" y="492" width="700" height="32" rx="4" fill="#09130e" stroke="#059669"/>
  <text x="56" y="513" fill="#6ee7b7" font-family="monospace" font-size="11">Click this image again at any time to re-apply the 360px compact height cap.</text>
</svg>`);

function loadVfsFiles(): Record<string, string> {
  try {
    const raw = localStorage.getItem(VFS_FILES_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore storage read errors
  }

  const initialFiles: Record<string, string> = {
    'D:/projects/notes/architecture-notes.md': `# Work Notes — SnipMD\n\nTake a snip right now with **Win + Shift + S** and press **Ctrl + V** anywhere in this editor (or click **+ Simulate Snip** in the top bar).\n\n- Press \`Ctrl + E\` (or click the top mode button) to switch between **RAW + IMG**, **SPLIT VIEW**, and **RENDERED MD**.\n- **Click the inline screenshot below** to expand past the \`360px\` fold line and reveal Section 03 at the bottom of the diagram.\n- Switch between **8 curated UI themes** (from Alabaster Daylight to Nordic Dusk to OLED Carbon) in the right-hand **Studio & Assets** panel.\n\n![snip](.assets/snip-20261016-223804-419-7f2a.png)\n\n## Core Guardrails Verified\n- Collision-proof \`snip-YYYYMMDD-HHMMSS-mmm-XXXX.png\` naming with \`OpenOptions::create_new(true)\`\n- CodeMirror 6 \`StateField<DecorationSet>\` block widget rendering directly below \`![]()\` lines\n- Cross-volume \`promote_scratch_assets\` & \`gc_scratch_assets\` mark-and-sweep orphan cleanup`,
    'D:/projects/notes/release-checklist.md': `# Release Checklist — v0.1.0\n\n1. Verify frameless 34px titlebar and keyboard shortcuts (\`Ctrl+T\`, \`Ctrl+O\`, \`Ctrl+S\`, \`Ctrl+W\`, \`Ctrl+E\`, \`Ctrl+Tab\`).\n2. Paste a screenshot into an unsaved \`Untitled\` scratch tab and save with \`Ctrl+S\` to promote \`.assets/\`.\n3. Delete a snip line in a scratch tab and close with \`Ctrl+W\` to trigger mark-and-sweep orphan GC.`
  };
  saveVfsFiles(initialFiles);
  return initialFiles;
}

function saveVfsFiles(files: Record<string, string>): void {
  try {
    localStorage.setItem(VFS_FILES_KEY, JSON.stringify(files));
  } catch {
    // Ignore quota errors
  }
}

function loadVfsAssets(): Record<string, string> {
  try {
    const raw = localStorage.getItem(VFS_ASSETS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, string>;
      // Always keep the demo architecture snip upgraded to the 780x560 fold-line SVG
      parsed['D:/projects/notes/.assets/snip-20261016-223804-419-7f2a.png'] =
        DEMO_SNIP_SVG_DATA_URL;
      return parsed;
    }
  } catch {
    // Ignore storage read errors
  }

  const initialAssets: Record<string, string> = {
    'D:/projects/notes/.assets/snip-20261016-223804-419-7f2a.png': DEMO_SNIP_SVG_DATA_URL
  };
  saveVfsAssets(initialAssets);
  return initialAssets;
}

function saveVfsAssets(assets: Record<string, string>): void {
  try {
    localStorage.setItem(VFS_ASSETS_KEY, JSON.stringify(assets));
  } catch {
    // Ignore quota errors
  }
}

function uint8ArrayToDataUrl(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

function formatSnipTimestamp(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  const mmm = String(date.getMilliseconds()).padStart(3, '0');
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}-${mmm}`;
}

function extractReferencedSnipNames(content: string): Set<string> {
  const regex = /\.assets\/(snip-[A-Za-z0-9_-]+\.png)/g;
  const set = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    if (match[1]) {
      set.add(match[1]);
    }
  }
  return set;
}

// 1. save_clipboard_image
export async function saveClipboardImage(
  bytes: Uint8Array,
  currentFilePath: string | null
): Promise<SaveImageResult> {
  if (isTauriRuntime()) {
    return await invoke<SaveImageResult>('save_clipboard_image', {
      bytes: Array.from(bytes),
      currentFilePath
    });
  }

  const assets = loadVfsAssets();
  const baseDir = currentFilePath ? getParentDir(currentFilePath) : SCRATCHPAD_ROOT;
  const assetsDir = `${baseDir}/.assets`;
  const stamp = formatSnipTimestamp(new Date());

  for (let attempt = 0; attempt < 64; attempt++) {
    const hex = Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, '0');
    const filename = `snip-${stamp}-${hex}.png`;
    const absDiskPath = normalizePath(`${assetsDir}/${filename}`);

    // Atomic create_new(true) equivalent: never overwrite if key exists
    if (!(absDiskPath in assets)) {
      assets[absDiskPath] = uint8ArrayToDataUrl(bytes);
      saveVfsAssets(assets);
      return {
        markdownRelPath: `.assets/${filename}`,
        absDiskPath
      };
    }
  }

  throw new Error('Unable to allocate collision-free snip filename');
}

// 2. resolve_asset_abs_path
export async function resolveAssetAbsPath(
  relPath: string,
  currentFilePath: string | null
): Promise<string> {
  if (isTauriRuntime()) {
    return await invoke<string>('resolve_asset_abs_path', {
      relPath,
      currentFilePath
    });
  }

  const cleanRel = relPath.replace(/^\.\/|^\.\\/, '');
  const baseDir = currentFilePath ? getParentDir(currentFilePath) : SCRATCHPAD_ROOT;
  return normalizePath(`${baseDir}/${cleanRel}`);
}

export function toDisplayableAssetSrc(absDiskPath: string): string {
  if (isTauriRuntime()) {
    return convertFileSrc(absDiskPath);
  }
  const assets = loadVfsAssets();
  const norm = normalizePath(absDiskPath);
  return assets[norm] || DEMO_SNIP_SVG_DATA_URL;
}

// 3. promote_scratch_assets
export async function promoteScratchAssets(
  content: string,
  targetMdPath: string,
  remainingUnsavedContents: string[]
): Promise<void> {
  if (isTauriRuntime()) {
    await invoke<void>('promote_scratch_assets', {
      content,
      targetMdPath,
      remainingUnsavedContents
    });
    return;
  }

  const referenced = extractReferencedSnipNames(content);
  if (referenced.size > 0) {
    const assets = loadVfsAssets();
    const targetDir = `${getParentDir(targetMdPath)}/.assets`;
    const scratchDir = `${SCRATCHPAD_ROOT}/.assets`;

    for (const filename of referenced) {
      const srcKey = normalizePath(`${scratchDir}/${filename}`);
      const dstKey = normalizePath(`${targetDir}/${filename}`);
      if (srcKey in assets) {
        assets[dstKey] = assets[srcKey];
        delete assets[srcKey];
      }
    }
    saveVfsAssets(assets);
  }

  await gcScratchAssets(remainingUnsavedContents);
}

// 4. gc_scratch_assets
export async function gcScratchAssets(liveUnsavedContents: string[]): Promise<number> {
  if (isTauriRuntime()) {
    const deleted = await invoke<number>('gc_scratch_assets', {
      liveUnsavedContents
    });
    lastGcDeletedCount = deleted;
    return deleted;
  }

  const liveRefs = new Set<string>();
  for (const content of liveUnsavedContents) {
    for (const snip of extractReferencedSnipNames(content)) {
      liveRefs.add(snip);
    }
  }

  const assets = loadVfsAssets();
  const scratchPrefix = normalizePath(`${SCRATCHPAD_ROOT}/.assets/`);
  let deletedCount = 0;

  for (const key of Object.keys(assets)) {
    if (key.startsWith(scratchPrefix)) {
      const filename = key.slice(scratchPrefix.length);
      if (filename.startsWith('snip-') && filename.endsWith('.png') && !liveRefs.has(filename)) {
        delete assets[key];
        deletedCount++;
      }
    }
  }

  if (deletedCount > 0) {
    saveVfsAssets(assets);
  }
  lastGcDeletedCount = deletedCount;
  return deletedCount;
}

// 5. read_markdown_file & write_markdown_file
export async function readMarkdownFile(path: string): Promise<string> {
  if (isTauriRuntime()) {
    return await invoke<string>('read_markdown_file', { path });
  }
  const files = loadVfsFiles();
  const norm = normalizePath(path);
  if (!(norm in files)) {
    throw new Error(`File not found: ${norm}`);
  }
  return files[norm];
}

export async function writeMarkdownFile(path: string, content: string): Promise<void> {
  if (isTauriRuntime()) {
    await invoke<void>('write_markdown_file', { path, content });
    return;
  }
  const files = loadVfsFiles();
  const norm = normalizePath(path);
  files[norm] = content;
  saveVfsFiles(files);
}

// 6. load_session & save_session
export async function loadSession(): Promise<string | null> {
  if (isTauriRuntime()) {
    return await invoke<string | null>('load_session');
  }
  // Ensure initial demo files/assets exist
  loadVfsFiles();
  loadVfsAssets();

  const raw = localStorage.getItem(VFS_SESSION_KEY);
  if (!raw) {
    await gcScratchAssets([]);
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.tabs)) {
      const unsavedContents: string[] = parsed.tabs
        .filter((t: { filePath: string | null }) => t.filePath === null)
        .map((t: { content: string }) => t.content || '');
      await gcScratchAssets(unsavedContents);
    }
  } catch {
    // Ignore parse errors
  }

  return raw;
}

export async function saveSession(json: string): Promise<void> {
  if (isTauriRuntime()) {
    await invoke<void>('save_session', { json });
    return;
  }
  try {
    localStorage.setItem(VFS_SESSION_KEY, json);
  } catch {
    // Ignore quota errors
  }
}

// 7. get_cli_startup_files
export async function getCliStartupFiles(): Promise<string[]> {
  if (isTauriRuntime()) {
    return await invoke<string[]>('get_cli_startup_files');
  }
  return [];
}

// Window Controls Bridge
export async function minimizeWindow(): Promise<void> {
  if (isTauriRuntime()) {
    await getCurrentWindow().minimize();
  }
}

export async function toggleMaximizeWindow(): Promise<void> {
  if (isTauriRuntime()) {
    await getCurrentWindow().toggleMaximize();
  } else if (document.fullscreenElement) {
    await document.exitFullscreen().catch(() => {});
  } else {
    await document.documentElement.requestFullscreen().catch(() => {});
  }
}

export async function closeWindow(onBeforeClose?: () => Promise<void>): Promise<void> {
  if (onBeforeClose) {
    await onBeforeClose();
  }
  if (isTauriRuntime()) {
    await getCurrentWindow().close();
  }
}

export async function subscribeExternalOpenFiles(
  callback: (paths: string[]) => void
): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  await listen<string[]>('open-files', (event) => {
    if (Array.isArray(event.payload) && event.payload.length > 0) {
      callback(event.payload);
    }
  });

  await getCurrentWindow().onDragDropEvent((event) => {
    if (event.payload.type === 'drop') {
      const mdPaths = event.payload.paths.filter((p) =>
        /\.(md|markdown)$/i.test(p)
      );
      if (mdPaths.length > 0) {
        callback(mdPaths);
      }
    }
  });
}

export async function openNativeFileDialog(): Promise<string | null> {
  if (isTauriRuntime()) {
    const selected = await tauriOpenDialog({
      multiple: false,
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
    });
    return typeof selected === 'string' ? selected : null;
  }
  return null;
}

export async function saveNativeFileDialog(defaultName: string): Promise<string | null> {
  if (isTauriRuntime()) {
    const selected = await tauriSaveDialog({
      defaultPath: defaultName.endsWith('.md') ? defaultName : `${defaultName}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    });
    return typeof selected === 'string' ? selected : null;
  }
  return null;
}

export function listVirtualMarkdownFiles(): string[] {
  return Object.keys(loadVfsFiles()).sort();
}

export function getVirtualStorageStats(): VirtualStorageStats {
  const assets = loadVfsAssets();
  const scratchPrefix = normalizePath(`${SCRATCHPAD_ROOT}/.assets/`);
  const scratchAssets: string[] = [];
  const localAssets: Record<string, string[]> = {};
  let localAssetCount = 0;

  for (const key of Object.keys(assets)) {
    if (key.startsWith(scratchPrefix)) {
      scratchAssets.push(key.slice(scratchPrefix.length));
    } else {
      localAssetCount++;
      const idx = key.indexOf('/.assets/');
      const folder = idx > -1 ? key.slice(0, idx + 8) : '.assets';
      const file = idx > -1 ? key.slice(idx + 9) : key;
      if (!localAssets[folder]) {
        localAssets[folder] = [];
      }
      localAssets[folder].push(file);
    }
  }

  return {
    scratchAssetCount: scratchAssets.length,
    localAssetCount,
    lastGcDeletedCount,
    scratchAssets,
    localAssets
  };
}

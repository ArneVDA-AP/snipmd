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
  <rect width="100%" height="100%" fill="#f5f0e6"/>
  <!-- Outer Archival Frame -->
  <rect x="18" y="18" width="744" height="524" rx="4" fill="#fbf8f2" stroke="#bfb299" stroke-width="1.5"/>
  <rect x="26" y="26" width="728" height="508" rx="2" fill="none" stroke="#d5cbb8" stroke-width="1"/>

  <!-- Header Plate -->
  <rect x="42" y="42" width="696" height="54" rx="4" fill="#eae2d3" stroke="#d5cbb8"/>
  <text x="62" y="67" fill="#120f0c" font-family="Georgia, serif" font-weight="700" font-size="15">FIG. 01 — ARCHITECTURAL PROPORTION &amp; TYPOGRAPHIC GRID</text>
  <text x="62" y="85" fill="#6e6256" font-family="monospace" font-size="11">PLATE IV · SCALE 1:100 · ARCHIVAL VELLUM FOLIO</text>
  <text x="565" y="74" fill="#9a6b26" font-family="monospace" font-weight="600" font-size="11">CLICK PLATE TO EXPAND</text>

  <!-- Left Drafting Study (Visible within 360px cap) -->
  <rect x="42" y="112" width="336" height="200" rx="4" fill="#f5f0e6" stroke="#c8bba4" stroke-width="1.2"/>
  <text x="60" y="140" fill="#9f2b2b" font-family="monospace" font-weight="700" font-size="12">I. SPATIAL HARMONY &amp; CANON</text>
  <line x1="60" y1="152" x2="358" y2="152" stroke="#d5cbb8" stroke-width="1"/>
  <!-- Geometric Golden Section Diagram -->
  <rect x="64" y="166" width="180" height="112" fill="#eae2d3" stroke="#9a6b26" stroke-width="1.5"/>
  <line x1="175" y1="166" x2="175" y2="278" stroke="#9a6b26" stroke-width="1" stroke-dasharray="3,3"/>
  <line x1="175" y1="235" x2="244" y2="235" stroke="#9a6b26" stroke-width="1" stroke-dasharray="3,3"/>
  <circle cx="175" cy="235" r="38" fill="none" stroke="#1f6357" stroke-width="1.5"/>
  <text x="258" y="190" fill="#24201c" font-family="monospace" font-size="11">Ratio 1 : 1.618</text>
  <text x="258" y="212" fill="#6e6256" font-family="monospace" font-size="10">Primary Folio</text>
  <text x="258" y="230" fill="#6e6256" font-family="monospace" font-size="10">Margin 12.5%</text>
  <text x="258" y="254" fill="#1f6357" font-family="monospace" font-size="10">65ch Measure</text>

  <!-- Right Drafting Study -->
  <rect x="402" y="112" width="336" height="200" rx="4" fill="#f5f0e6" stroke="#c8bba4" stroke-width="1.2"/>
  <text x="420" y="140" fill="#1f6357" font-family="monospace" font-weight="700" font-size="12">II. MATERIAL &amp; LIGHT BALANCE</text>
  <line x1="420" y1="152" x2="718" y2="152" stroke="#d5cbb8" stroke-width="1"/>
  <text x="420" y="178" fill="#24201c" font-family="monospace" font-size="11">• Warm Craft Vellum (#F5F0E6)</text>
  <text x="420" y="202" fill="#24201c" font-family="monospace" font-size="11">• Iron-Gall Fountain Ink (#24201C)</text>
  <text x="420" y="226" fill="#24201c" font-family="monospace" font-size="11">• Burnished Brass Accent (#9A6B26)</text>
  <rect x="420" y="244" width="298" height="52" rx="3" fill="#eae2d3" stroke="#d5cbb8"/>
  <text x="434" y="266" fill="#9a6b26" font-family="monospace" font-weight="600" font-size="11">Inline Visual Capture</text>
  <text x="434" y="284" fill="#6e6256" font-family="monospace" font-size="10">Capped at 360px height for comfortable reading</text>

  <!-- 360px Fold Line Indicator -->
  <line x1="42" y1="334" x2="738" y2="334" stroke="#9a6b26" stroke-width="1.5" stroke-dasharray="6,6"/>
  <rect x="235" y="322" width="310" height="24" rx="12" fill="#f3e5cc" stroke="#9a6b26"/>
  <text x="256" y="338" fill="#5c3d0e" font-family="monospace" font-weight="700" font-size="11">▼ 360px FOLD LINE — CLICK TO UNroll ▼</text>

  <!-- Stage 2: Below the 360px fold -->
  <rect x="42" y="364" width="696" height="152" rx="4" fill="#eae2d3" stroke="#9a6b26" stroke-width="1.2"/>
  <text x="64" y="394" fill="#120f0c" font-family="Georgia, serif" font-weight="700" font-size="14">III. FULL-HEIGHT ELEVATION (UNROLLED PLATE VIEW)</text>
  <text x="64" y="420" fill="#24201c" font-family="monospace" font-size="12">Single-clicking any tall image toggles between the compact 360px reading cap and 100% full height.</text>
  <text x="64" y="446" fill="#6e6256" font-family="monospace" font-size="11">• Double-click any image (or click Lightbox) to inspect in the full-resolution viewer.</text>
  <text x="64" y="468" fill="#6e6256" font-family="monospace" font-size="11">• All pasted screenshots (Ctrl+V) and imported images are automatically organized in .assets/.</text>
  <rect x="64" y="480" width="652" height="24" rx="3" fill="#fbf8f2" stroke="#d5cbb8"/>
  <text x="78" y="496" fill="#1f6357" font-family="monospace" font-size="11">Click this plate again at any time to restore the compact 360px reading height.</text>
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
    'D:/projects/notes/architecture-notes.md': `# Architectural Field Notes\n\nWelcome to **SnipMD** — a quiet, tactile studio for Markdown prose and inline visual references.\n\n## Capturing & Inspecting Visuals\n- Paste any screenshot directly from your clipboard with \`Ctrl + V\`, drag and drop an image onto the page, or click **+ Import Image to Note** in the **Studio** drawer.\n- Switch smoothly between **Editor**, **Split**, and **Reading** views in the top bar (or press \`Ctrl + E\`).\n- **Click the architectural plate below** to unroll past the \`360px\` reading cap and inspect the full diagram.\n\n![Architectural Plate](.assets/snip-20261016-223804-419-7f2a.png)\n\n## Studio Atmospheres & Typography\nExplore **14 curated visual themes** in the Studio drawer — starting with our signature **Archival Studio** craft paper and iron-gall ink, through **Kyoto Matcha** and **Nordic Polar Dusk**, to **Velvet Espresso** and **Carbon OLED**.\n\n> "Simplicity is about subtracting the obvious and adding the meaningful."`,
    'D:/projects/notes/editorial-monograph.md': `# On Tactile Digital Instruments\n\nWriting tools shape the thoughts composed within them. When an interface removes diagnostic noise and honors typographic measure, attention returns naturally to structure and clarity.\n\n## Key Keyboard Shortcuts\n1. \`Ctrl + T\` — Create a new draft tab\n2. \`Ctrl + O\` — Open a saved note from your workspace\n3. \`Ctrl + S\` — Save active note and organize inline \`.assets/\`\n4. \`Ctrl + E\` — Cycle between Editor, Split, and Reading views\n5. \`Ctrl + \\\` — Toggle the right-hand Studio drawer`
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

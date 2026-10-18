import {
  getVirtualStorageStats,
  toDisplayableAssetSrc
} from '../ipc/bridge';
import { assetUrlCache, getCacheKey } from '../editor/imageWidget';
import { openSnipLightboxModal } from './modal';
import type { TabItem } from '../state/TabManager';

export type UIPreset =
  | 'paper'
  | 'latte'
  | 'sage'
  | 'nordic'
  | 'tokyo'
  | 'linear'
  | 'stealth'
  | 'oled';

export interface ThemeDefinition {
  id: UIPreset;
  name: string;
  tier: 'Light' | 'In-Between' | 'Dark';
  swatchBg: string;
  swatchAccent: string;
  desc: string;
}

export const SNIPMD_THEMES: ThemeDefinition[] = [
  {
    id: 'paper',
    name: '01. Alabaster Daylight',
    tier: 'Light',
    swatchBg: '#fafaf9',
    swatchAccent: '#0f766e',
    desc: 'Pure architectural paper · deep ink prose · teal & crimson accents'
  },
  {
    id: 'latte',
    name: '02. Warm Parchment',
    tier: 'Light',
    swatchBg: '#f4efe6',
    swatchAccent: '#c2410c',
    desc: 'Archival drafting vellum · espresso ink · terracotta & olive tokens'
  },
  {
    id: 'sage',
    name: '03. Botanical Mist',
    tier: 'In-Between',
    swatchBg: '#e8f0ec',
    swatchAccent: '#047857',
    desc: 'Soft sage drafting surface · deep pine ink · zero daytime glare'
  },
  {
    id: 'nordic',
    name: '04. Nordic Polar Dusk',
    tier: 'In-Between',
    swatchBg: '#2e3440',
    swatchAccent: '#88c0d0',
    desc: 'Mid-tone Arctic slate · frost-blue accents · aurora syntax palette'
  },
  {
    id: 'tokyo',
    name: '05. Tokyo Twilight',
    tier: 'In-Between',
    swatchBg: '#1f2335',
    swatchAccent: '#7aa2f7',
    desc: 'Deep indigo-violet twilight · electric periwinkle & coral tokens'
  },
  {
    id: 'linear',
    name: '06. Linear Spatial',
    tier: 'Dark',
    swatchBg: '#0f1117',
    swatchAccent: '#6366f1',
    desc: 'Floating pill tabs · obsidian-slate canvas · indigo elevation'
  },
  {
    id: 'stealth',
    name: '07. Obsidian Stealth',
    tier: 'Dark',
    swatchBg: '#18181b',
    swatchAccent: '#a855f7',
    desc: 'Classic SnipMD zinc · 1px razor hairlines · neon snip telemetry'
  },
  {
    id: 'oled',
    name: '08. Carbon OLED Terminal',
    tier: 'Dark',
    swatchBg: '#050507',
    swatchAccent: '#f59e0b',
    desc: 'True pitch-black #050507 · phosphor amber & matrix emerald tokens'
  }
];

export interface InspectorCallbacks {
  onJumpToLine: (lineNumber: number, relPath?: string) => void;
  onSelectPreset: (preset: UIPreset) => void;
  onInsertAssetLink: (relPath: string) => void;
  onRunManualGc: () => void;
  onSimulateSnip: () => void;
  onExportNote: (format: 'md' | 'html') => void;
  onOpenWin11Release: () => void;
}

export class WorkspaceInspector {
  constructor(
    private root: HTMLElement,
    private callbacks: InspectorCallbacks
  ) {}

  public render(
    tab: TabItem | undefined,
    activePreset: UIPreset,
    storageBytes: number
  ): void {
    if (!tab) {
      this.root.innerHTML = '';
      return;
    }

    const lines = tab.content.split('\n');
    const headings: Array<{ level: number; text: string; line: number }> = [];
    const activeNoteSnips: Array<{
      alt: string;
      relPath: string;
      line: number;
    }> = [];

    lines.forEach((rawLine, idx) => {
      const hMatch = rawLine.match(/^(#{1,3})\s+(.+)/);
      if (hMatch) {
        headings.push({
          level: hMatch[1].length,
          text: hMatch[2].replace(/`/g, '').trim(),
          line: idx + 1
        });
      }
      const imgMatch = rawLine.match(/!\[([^\]]*)\]\(([^)]+)\)/);
      if (imgMatch) {
        activeNoteSnips.push({
          alt: imgMatch[1] || 'snip',
          relPath: imgMatch[2].trim(),
          line: idx + 1
        });
      }
    });

    const stats = getVirtualStorageStats();
    const kbUsed = (storageBytes / 1024).toFixed(1);

    const allDiskSnips: Array<{
      filename: string;
      folderLabel: string;
      absPath: string;
      isScratch: boolean;
    }> = [];

    for (const filename of stats.scratchAssets) {
      allDiskSnips.push({
        filename,
        folderLabel: '%APPDATA%/snip-md/scratchpad/.assets',
        absPath: `C:/Users/Developer/AppData/Roaming/snip-md/scratchpad/.assets/${filename}`,
        isScratch: true
      });
    }

    for (const [folder, files] of Object.entries(stats.localAssets)) {
      for (const filename of files) {
        allDiskSnips.push({
          filename,
          folderLabel: folder,
          absPath: `${folder}/${filename}`,
          isScratch: false
        });
      }
    }

    const themesHtml = SNIPMD_THEMES.map(
      (t) => `
      <button type="button" class="preset-card ${
        activePreset === t.id ? 'active' : ''
      }" data-preset="${t.id}" title="${t.desc}">
        <div class="preset-card-top">
          <span class="preset-swatch" style="background: ${t.swatchBg}; border-color: ${t.swatchAccent}">
            <span class="preset-swatch-dot" style="background: ${t.swatchAccent}"></span>
          </span>
          <span class="preset-card-title">${t.name}</span>
          <span class="preset-tier-label">${t.tier}</span>
        </div>
        <div class="preset-card-desc">${t.desc}</div>
      </button>
    `
    ).join('');

    const assetsGalleryHtml =
      allDiskSnips.length > 0
        ? allDiskSnips
            .map((item) => {
              const relPath = `.assets/${item.filename}`;
              const previewUrl =
                assetUrlCache.get(getCacheKey(tab.filePath, relPath)) ||
                toDisplayableAssetSrc(item.absPath);
              const matchedLine = activeNoteSnips.find(
                (s) => s.relPath === relPath
              )?.line;

              return `
              <div class="inspector-snip-card" data-card-line="${
                matchedLine || ''
              }" data-card-rel="${relPath}" data-card-src="${previewUrl}">
                <img src="${previewUrl}" alt="${item.filename}" class="inspector-snip-thumb" title="Click to inspect full resolution" />
                <div class="inspector-snip-info">
                  <div class="inspector-snip-name" title="${item.filename}">${item.filename}</div>
                  <div class="inspector-snip-meta">${
                    item.isScratch ? 'Scratchpad .assets/' : item.folderLabel
                  }</div>
                  <div class="inspector-snip-actions">
                    ${
                      matchedLine
                        ? `<button type="button" class="snip-mini-btn" data-jump-line="${matchedLine}" data-jump-rel="${relPath}">Jump & Expand L${matchedLine}</button>`
                        : `<button type="button" class="snip-mini-btn" data-insert-snip="${relPath}">+ Insert in Note</button>`
                    }
                    <button type="button" class="snip-mini-btn" data-lightbox-src="${previewUrl}" data-lightbox-rel="${relPath}">Zoom</button>
                  </div>
                </div>
              </div>
            `;
            })
            .join('')
        : `<div class="inspector-empty">No snips stored yet. Click "+ Capture & Paste New Snip" above.</div>`;

    const headingsHtml =
      headings.length > 0
        ? headings
            .map(
              (h) => `
            <button type="button" class="inspector-outline-item level-${h.level}" data-jump-line="${h.line}">
              <span class="outline-hash">${'#'.repeat(h.level)}</span>
              <span class="outline-text">${h.text}</span>
              <span class="outline-line">L${h.line}</span>
            </button>`
            )
            .join('')
        : `<div class="inspector-empty">No Markdown headings in buffer</div>`;

    this.root.innerHTML = `
      <div class="inspector-section">
        <div class="inspector-header">
          <span>Windows 11 Release (v0.1.0)</span>
          <span class="inspector-meta-tag">x64 NSIS · MSI</span>
        </div>
        <div class="inspector-storage-box">
          <div class="storage-row">
            <span>Installer Targets</span>
            <span class="storage-val ok">-setup.exe & .msi</span>
          </div>
          <div class="storage-row">
            <span>Rust Profile</span>
            <span class="storage-val">LTO + Strip (~3.5 MB)</span>
          </div>
          <a href="/releases/SnipMD-v0.1.0-Win11-x64-Release-Kit.zip" download="SnipMD-v0.1.0-Win11-x64-Release-Kit.zip" class="inspector-action-btn primary-snip" style="text-align:center;text-decoration:none;display:block;">
            ⬇ Download Win11 Release Kit (.zip)
          </a>
          <button type="button" class="inspector-action-btn" id="openReleaseCenterBtn">
            Open Win11 Release Packager Details
          </button>
        </div>
      </div>

      <div class="inspector-section">
        <div class="inspector-header">
          <span>8 Curated Themes (Light → Dark)</span>
          <span class="inspector-meta-tag">${activePreset.toUpperCase()}</span>
        </div>
        <div class="preset-switcher-grid">
          ${themesHtml}
        </div>
      </div>

      <div class="inspector-section">
        <div class="inspector-header">
          <span>Virtual .assets/ Browser</span>
          <span class="inspector-meta-tag">${allDiskSnips.length} files</span>
        </div>
        <button type="button" class="inspector-action-btn primary-snip" id="drawerSimSnipBtn">
          + Capture & Paste New Snip (780×540)
        </button>
        <div class="inspector-snip-list">
          ${assetsGalleryHtml}
        </div>
      </div>

      <div class="inspector-section">
        <div class="inspector-header">
          <span>Export & Daily-Driver Tools</span>
          <span class="inspector-meta-tag">Local Disk</span>
        </div>
        <div class="export-btn-row">
          <button type="button" class="inspector-action-btn" id="exportMdBtn">Download .md</button>
          <button type="button" class="inspector-action-btn" id="exportHtmlBtn">Export Self-Contained .html</button>
        </div>
      </div>

      <div class="inspector-section">
        <div class="inspector-header">
          <span>Storage & Orphan GC</span>
          <span class="inspector-meta-tag">${kbUsed} KB</span>
        </div>
        <div class="inspector-storage-box">
          <div class="storage-row">
            <span>localStorage Persistence</span>
            <span class="storage-val ok">Synced (${kbUsed} KB)</span>
          </div>
          <div class="storage-row">
            <span>Sidecar .assets/ Files</span>
            <span class="storage-val">${stats.localAssetCount} files</span>
          </div>
          <div class="storage-row">
            <span>Scratchpad .assets/ Pool</span>
            <span class="storage-val">${stats.scratchAssetCount} files</span>
          </div>
          <div class="storage-row">
            <span>Last GC Sweep Deleted</span>
            <span class="storage-val">${stats.lastGcDeletedCount} orphans</span>
          </div>
          <button type="button" class="inspector-action-btn" id="manualGcBtn">
            Run Mark-and-Sweep GC Now
          </button>
        </div>
      </div>

      <div class="inspector-section">
        <div class="inspector-header">
          <span>Document Outline</span>
          <span class="inspector-meta-tag">${headings.length}</span>
        </div>
        <div class="inspector-list">
          ${headingsHtml}
        </div>
      </div>
    `;

    this.root
      .querySelectorAll<HTMLButtonElement>('.preset-card[data-preset]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          const preset = btn.dataset.preset as UIPreset;
          this.callbacks.onSelectPreset(preset);
        });
      });

    // Clicking anywhere on an .inspector-snip-card jumps to and expands the snip (or opens lightbox)
    this.root
      .querySelectorAll<HTMLElement>('.inspector-snip-card')
      .forEach((card) => {
        card.addEventListener('click', () => {
          const line = Number(card.dataset.cardLine);
          const relPath = card.dataset.cardRel;
          const src = card.dataset.cardSrc;
          if (line > 0) {
            this.callbacks.onJumpToLine(line, relPath);
          } else if (src && relPath) {
            openSnipLightboxModal(src, relPath, '780×540px');
          }
        });
      });

    this.root
      .querySelectorAll<HTMLElement>('[data-jump-line]')
      .forEach((item) => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const line = Number(item.dataset.jumpLine);
          const rel = item.dataset.jumpRel;
          if (line > 0) {
            this.callbacks.onJumpToLine(line, rel);
          }
        });
      });

    this.root
      .querySelectorAll<HTMLElement>('[data-lightbox-src]')
      .forEach((item) => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const src = item.dataset.lightboxSrc;
          const rel = item.dataset.lightboxRel || 'snip.png';
          if (src) {
            openSnipLightboxModal(src, rel, 'Full Resolution');
          }
        });
      });

    this.root
      .querySelectorAll<HTMLElement>('[data-insert-snip]')
      .forEach((item) => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const relPath = item.dataset.insertSnip;
          if (relPath) {
            this.callbacks.onInsertAssetLink(relPath);
          }
        });
      });

    this.root
      .querySelector<HTMLButtonElement>('#openReleaseCenterBtn')
      ?.addEventListener('click', () => this.callbacks.onOpenWin11Release());

    this.root
      .querySelector<HTMLButtonElement>('#manualGcBtn')
      ?.addEventListener('click', () => this.callbacks.onRunManualGc());

    this.root
      .querySelector<HTMLButtonElement>('#drawerSimSnipBtn')
      ?.addEventListener('click', () => this.callbacks.onSimulateSnip());

    this.root
      .querySelector<HTMLButtonElement>('#exportMdBtn')
      ?.addEventListener('click', () => this.callbacks.onExportNote('md'));

    this.root
      .querySelector<HTMLButtonElement>('#exportHtmlBtn')
      ?.addEventListener('click', () => this.callbacks.onExportNote('html'));
  }
}

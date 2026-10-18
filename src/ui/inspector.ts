import {
  getVirtualStorageStats,
  toDisplayableAssetSrc
} from '../ipc/bridge';
import { assetUrlCache, getCacheKey } from '../editor/imageWidget';
import { openSnipLightboxModal } from './modal';
import type { TabItem } from '../state/TabManager';

export type UIPreset =
  | 'archival'
  | 'paper'
  | 'latte'
  | 'matcha'
  | 'swiss'
  | 'sage'
  | 'terracotta'
  | 'nordic'
  | 'tokyo'
  | 'espresso'
  | 'cyberpunk'
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
    id: 'archival',
    name: '01. Archival Studio',
    tier: 'Light',
    swatchBg: '#f5f0e6',
    swatchAccent: '#9a6b26',
    desc: 'Warm craft paper · iron-gall ink · burnished brass & crimson accents'
  },
  {
    id: 'paper',
    name: '02. Alabaster Daylight',
    tier: 'Light',
    swatchBg: '#fafaf9',
    swatchAccent: '#0f766e',
    desc: 'Pure gallery paper · deep ink prose · teal & crimson accents'
  },
  {
    id: 'latte',
    name: '03. Warm Parchment',
    tier: 'Light',
    swatchBg: '#f4efe6',
    swatchAccent: '#c2410c',
    desc: 'Archival drafting vellum · espresso ink · terracotta & olive tokens'
  },
  {
    id: 'matcha',
    name: '04. Kyoto Matcha',
    tier: 'Light',
    swatchBg: '#f1f4ec',
    swatchAccent: '#3f6212',
    desc: 'Bamboo washi paper · sumi charcoal ink · ceremonial matcha green'
  },
  {
    id: 'swiss',
    name: '05. Swiss Editorial',
    tier: 'Light',
    swatchBg: '#ffffff',
    swatchAccent: '#ea580c',
    desc: 'Stark architectural white · exposed grid hairlines · international orange'
  },
  {
    id: 'sage',
    name: '06. Botanical Mist',
    tier: 'In-Between',
    swatchBg: '#e8f0ec',
    swatchAccent: '#047857',
    desc: 'Soft sage drafting surface · deep pine ink · zero daytime glare'
  },
  {
    id: 'terracotta',
    name: '07. Desert Terracotta',
    tier: 'In-Between',
    swatchBg: '#efe4db',
    swatchAccent: '#b84a27',
    desc: 'Sun-baked sandstone canvas · canyon clay & turquoise patina accents'
  },
  {
    id: 'nordic',
    name: '08. Nordic Polar Dusk',
    tier: 'In-Between',
    swatchBg: '#2e3440',
    swatchAccent: '#88c0d0',
    desc: 'Mid-tone Arctic slate · frost-blue accents · aurora syntax palette'
  },
  {
    id: 'tokyo',
    name: '09. Tokyo Twilight',
    tier: 'In-Between',
    swatchBg: '#1f2335',
    swatchAccent: '#7aa2f7',
    desc: 'Deep indigo-violet twilight · electric periwinkle & coral tokens'
  },
  {
    id: 'espresso',
    name: '10. Velvet Espresso',
    tier: 'Dark',
    swatchBg: '#1c1613',
    swatchAccent: '#d4a359',
    desc: 'Roasted mahogany & dark cocoa study · warm gold & cognac highlights'
  },
  {
    id: 'cyberpunk',
    name: '11. Cyberpunk Solstice',
    tier: 'Dark',
    swatchBg: '#0d0b1e',
    swatchAccent: '#ff2a85',
    desc: 'Deep synthwave night canvas · bioluminescent cyan & magenta tokens'
  },
  {
    id: 'linear',
    name: '12. Linear Spatial',
    tier: 'Dark',
    swatchBg: '#0f1117',
    swatchAccent: '#6366f1',
    desc: 'Floating pill tabs · obsidian-slate canvas · indigo elevation'
  },
  {
    id: 'stealth',
    name: '13. Obsidian Stealth',
    tier: 'Dark',
    swatchBg: '#18181b',
    swatchAccent: '#a855f7',
    desc: 'Matte zinc monochrome · 1px razor hairlines · amethyst accents'
  },
  {
    id: 'oled',
    name: '14. Carbon OLED',
    tier: 'Dark',
    swatchBg: '#050507',
    swatchAccent: '#f59e0b',
    desc: 'True pitch-black #050507 · phosphor amber & emerald tokens'
  }
];

export interface InspectorCallbacks {
  onJumpToLine: (lineNumber: number, relPath?: string) => void;
  onSelectPreset: (preset: UIPreset) => void;
  onInsertAssetLink: (relPath: string) => void;
  onImportImageFile: (file: File) => void;
  onExportNote: (format: 'md' | 'html') => void;
}

export class WorkspaceInspector {
  constructor(
    private root: HTMLElement,
    private callbacks: InspectorCallbacks
  ) {}

  public render(
    tab: TabItem | undefined,
    activePreset: UIPreset
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

    const allDiskSnips: Array<{
      filename: string;
      folderLabel: string;
      absPath: string;
      isScratch: boolean;
    }> = [];

    for (const filename of stats.scratchAssets) {
      allDiskSnips.push({
        filename,
        folderLabel: 'Unsaved Note Assets',
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
                <img src="${previewUrl}" alt="${item.filename}" class="inspector-snip-thumb" referrerpolicy="no-referrer" title="Click to inspect full resolution" />
                <div class="inspector-snip-info">
                  <div class="inspector-snip-name" title="${item.filename}">${item.filename}</div>
                  <div class="inspector-snip-meta">${
                    matchedLine ? `Line ${matchedLine} · Linked` : item.folderLabel
                  }</div>
                  <div class="inspector-snip-actions">
                    ${
                      matchedLine
                        ? `<button type="button" class="snip-mini-btn" data-jump-line="${matchedLine}" data-jump-rel="${relPath}">Jump to L${matchedLine}</button>`
                        : `<button type="button" class="snip-mini-btn" data-insert-snip="${relPath}">Insert in Note</button>`
                    }
                    <button type="button" class="snip-mini-btn" data-lightbox-src="${previewUrl}" data-lightbox-rel="${relPath}">Zoom</button>
                  </div>
                </div>
              </div>
            `;
            })
            .join('')
        : `<div class="inspector-empty">No images in this workspace yet. Paste from clipboard (Ctrl+V), drag and drop an image, or click Import Image above.</div>`;

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
        : `<div class="inspector-empty">Add Markdown headings (#, ##, ###) to build a clickable document outline.</div>`;

    const activeThemeDef =
      SNIPMD_THEMES.find((t) => t.id === activePreset) || SNIPMD_THEMES[0];

    this.root.innerHTML = `
      <div class="inspector-section">
        <div class="inspector-header">
          <span>Document Outline</span>
          <span class="inspector-meta-tag">${headings.length} ${headings.length === 1 ? 'section' : 'sections'}</span>
        </div>
        <div class="inspector-list">
          ${headingsHtml}
        </div>
      </div>

      <div class="inspector-section">
        <div class="inspector-header">
          <span>Note Assets</span>
          <span class="inspector-meta-tag">${allDiskSnips.length} ${allDiskSnips.length === 1 ? 'image' : 'images'}</span>
        </div>
        <input type="file" id="importImageInput" accept="image/*" class="hidden" />
        <button type="button" class="inspector-action-btn primary-snip" id="importImageBtn">
          + Import Image to Note
        </button>
        <div class="inspector-snip-list">
          ${assetsGalleryHtml}
        </div>
      </div>

      <div class="inspector-section">
        <div class="inspector-header">
          <span>Export Manuscript</span>
          <span class="inspector-meta-tag">Local Download</span>
        </div>
        <div class="export-btn-row">
          <button type="button" class="inspector-action-btn" id="exportMdBtn">Export .md</button>
          <button type="button" class="inspector-action-btn" id="exportHtmlBtn">Export .html</button>
        </div>
      </div>

      <div class="inspector-section">
        <div class="inspector-header">
          <span>Theme Studio (14 Atmospheres)</span>
          <span class="inspector-meta-tag">${activeThemeDef.tier}</span>
        </div>
        <div class="preset-switcher-grid">
          ${themesHtml}
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
            openSnipLightboxModal(src, relPath, 'Full Resolution');
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

    const importInput = this.root.querySelector<HTMLInputElement>('#importImageInput');
    const importBtn = this.root.querySelector<HTMLButtonElement>('#importImageBtn');

    importBtn?.addEventListener('click', () => {
      importInput?.click();
    });

    importInput?.addEventListener('change', () => {
      const file = importInput.files?.[0];
      if (file) {
        this.callbacks.onImportImageFile(file);
        importInput.value = '';
      }
    });

    this.root
      .querySelector<HTMLButtonElement>('#exportMdBtn')
      ?.addEventListener('click', () => this.callbacks.onExportNote('md'));

    this.root
      .querySelector<HTMLButtonElement>('#exportHtmlBtn')
      ?.addEventListener('click', () => this.callbacks.onExportNote('html'));
  }
}

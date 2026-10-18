import {
  minimizeWindow,
  toggleMaximizeWindow,
  closeWindow
} from '../ipc/bridge';
import type { TabItem } from '../state/TabManager';
import { SNIPMD_THEMES, type UIPreset } from './inspector';
import type { WorkspaceViewMode } from '../state/storagePersistence';

export interface TitlebarCallbacks {
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
  onOpenFile: () => void;
  onSaveFile: () => void;
  onSimulateSnip: () => void;
  onSetMode: (mode: WorkspaceViewMode) => void;
  onToggleInspector: () => void;
  onSelectPreset: (preset: UIPreset) => void;
  onOpenWin11Release: () => void;
  onBeforeWindowClose: () => Promise<void>;
}

export class TitlebarUI {
  private tabStripEl: HTMLElement;
  private modeBtns: NodeListOf<HTMLButtonElement>;
  private inspectorBtnEl: HTMLElement;
  private saveToastEl: HTMLElement;
  private themeSelectEl: HTMLSelectElement;
  private toastTimeout: number | null = null;

  constructor(root: HTMLElement, private callbacks: TitlebarCallbacks) {
    const themeOptionsHtml = SNIPMD_THEMES.map(
      (t) => `<option value="${t.id}">${t.name} (${t.tier})</option>`
    ).join('');

    root.innerHTML = `
      <div class="brand-mark" data-tauri-drag-region>SnipMD</div>
      <div class="tabs" id="tabStrip"></div>
      <button type="button" class="icon-bar-btn" id="newTabBtn" title="New Scratch Tab (Ctrl+T)">+</button>
      <button type="button" class="icon-bar-btn" id="openFileBtn" title="Open Markdown File (Ctrl+O)">Open</button>
      <button type="button" class="icon-bar-btn" id="saveFileBtn" title="Save Active Tab & Promote Scratch Assets (Ctrl+S)">Save</button>
      <div class="drag-region" data-tauri-drag-region></div>
      <span class="save-toast" id="saveToast">Synced to localStorage</span>
      <select class="theme-select" id="themeSelect" aria-label="Select Theme">
        ${themeOptionsHtml}
      </select>
      <button type="button" class="toolbar-action-btn snip-btn" id="simSnipBtn" title="Simulate Win+Shift+S -> Ctrl+V Clipboard Snip Paste">+ Simulate Snip</button>
      <div class="top-preset-group" role="group" aria-label="View Mode">
        <button type="button" class="top-preset-btn active" data-view-mode="edit" title="Raw Markdown + Inline Image Widgets">RAW + IMG</button>
        <button type="button" class="top-preset-btn" data-view-mode="split" title="Side-by-Side Split Editor + Live Preview">SPLIT</button>
        <button type="button" class="top-preset-btn" data-view-mode="preview" title="Rendered Markdown Preview (Ctrl+E)">RENDERED</button>
      </div>
      <button type="button" class="toolbar-action-btn win11-release-btn" id="win11ReleaseBtn" title="Download Windows 11 Release Kit (.zip) & NSIS/MSI Packager">Win11 Release</button>
      <button type="button" class="toolbar-action-btn active" id="inspectorBtn" title="Toggle .assets/ Browser & UI Studio Drawer">.assets/ & Themes</button>
      <div class="win-controls">
        <button type="button" class="win-btn" id="winMinBtn" title="Minimize">─</button>
        <button type="button" class="win-btn" id="winMaxBtn" title="Toggle Maximize">□</button>
        <button type="button" class="win-btn close" id="winCloseBtn" title="Close">✕</button>
      </div>
    `;

    this.tabStripEl = root.querySelector<HTMLElement>('#tabStrip')!;
    this.inspectorBtnEl = root.querySelector<HTMLElement>('#inspectorBtn')!;
    this.saveToastEl = root.querySelector<HTMLElement>('#saveToast')!;
    this.themeSelectEl = root.querySelector<HTMLSelectElement>('#themeSelect')!;
    this.modeBtns = root.querySelectorAll<HTMLButtonElement>(
      '.top-preset-btn[data-view-mode]'
    );

    this.themeSelectEl.addEventListener('change', () => {
      this.callbacks.onSelectPreset(this.themeSelectEl.value as UIPreset);
    });

    this.modeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.viewMode as WorkspaceViewMode;
        this.callbacks.onSetMode(mode);
      });
    });

    root
      .querySelector<HTMLButtonElement>('#newTabBtn')!
      .addEventListener('click', () => this.callbacks.onNewTab());
    root
      .querySelector<HTMLButtonElement>('#openFileBtn')!
      .addEventListener('click', () => this.callbacks.onOpenFile());
    root
      .querySelector<HTMLButtonElement>('#saveFileBtn')!
      .addEventListener('click', () => this.callbacks.onSaveFile());
    root
      .querySelector<HTMLButtonElement>('#simSnipBtn')!
      .addEventListener('click', () => this.callbacks.onSimulateSnip());
    root
      .querySelector<HTMLButtonElement>('#win11ReleaseBtn')!
      .addEventListener('click', () => this.callbacks.onOpenWin11Release());
    this.inspectorBtnEl.addEventListener('click', () =>
      this.callbacks.onToggleInspector()
    );

    root
      .querySelector<HTMLButtonElement>('#winMinBtn')!
      .addEventListener('click', () => void minimizeWindow());
    root
      .querySelector<HTMLButtonElement>('#winMaxBtn')!
      .addEventListener('click', () => void toggleMaximizeWindow());
    root
      .querySelector<HTMLButtonElement>('#winCloseBtn')!
      .addEventListener('click', () =>
        void closeWindow(this.callbacks.onBeforeWindowClose)
      );
  }

  public renderTabs(tabs: TabItem[], activeTabId: string): void {
    this.tabStripEl.innerHTML = '';

    for (const tab of tabs) {
      const el = document.createElement('div');
      const isActive = tab.id === activeTabId;
      el.className = `tab ${isActive ? 'active' : ''} ${
        tab.dirty ? 'dirty' : ''
      }`;
      el.title = tab.filePath
        ? `${tab.filePath} (Middle-click or Ctrl+W to close)`
        : `${tab.title} — Unsaved Scratchpad Buffer (Middle-click or Ctrl+W to close)`;

      const dot = document.createElement('span');
      dot.className = 'dot';

      const titleSpan = document.createElement('span');
      titleSpan.className = 'tab-title';
      titleSpan.textContent = tab.title;

      const closeSpan = document.createElement('span');
      closeSpan.className = 'tab-close';
      closeSpan.textContent = '×';
      closeSpan.title = 'Close Tab (Ctrl+W)';
      closeSpan.addEventListener('click', (e) => {
        e.stopPropagation();
        this.callbacks.onCloseTab(tab.id);
      });

      el.appendChild(dot);
      el.appendChild(titleSpan);
      el.appendChild(closeSpan);

      el.addEventListener('click', () => {
        this.callbacks.onSelectTab(tab.id);
      });

      el.addEventListener('auxclick', (e) => {
        if (e.button === 1) {
          e.preventDefault();
          e.stopPropagation();
          this.callbacks.onCloseTab(tab.id);
        }
      });

      this.tabStripEl.appendChild(el);
    }
  }

  public updateModeBadge(mode: WorkspaceViewMode): void {
    this.modeBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.viewMode === mode);
    });
  }

  public updateInspectorBadge(open: boolean): void {
    this.inspectorBtnEl.classList.toggle('active', open);
  }

  public updatePresetButtons(activePreset: UIPreset): void {
    this.themeSelectEl.value = activePreset;
  }

  public showToast(message: string): void {
    this.saveToastEl.textContent = message;
    this.saveToastEl.classList.add('visible');
    if (this.toastTimeout !== null) {
      window.clearTimeout(this.toastTimeout);
    }
    this.toastTimeout = window.setTimeout(() => {
      this.saveToastEl.classList.remove('visible');
    }, 2200);
  }
}

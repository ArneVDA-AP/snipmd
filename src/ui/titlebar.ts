import {
  minimizeWindow,
  toggleMaximizeWindow,
  closeWindow,
  isTauriRuntime
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
  onSetMode: (mode: WorkspaceViewMode) => void;
  onToggleInspector: () => void;
  onSelectPreset: (preset: UIPreset) => void;
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
      (t) => `<option value="${t.id}">${t.name}</option>`
    ).join('');

    const showNativeControls = isTauriRuntime();

    root.innerHTML = `
      <div class="titlebar-left">
        <div class="brand-mark" data-tauri-drag-region>SnipMD</div>
        <div class="file-actions-group" role="group" aria-label="Document File Actions">
          <button type="button" class="icon-bar-btn" id="openFileBtn" title="Open Note (Ctrl+O)">Open</button>
          <button type="button" class="icon-bar-btn" id="saveFileBtn" title="Save Note (Ctrl+S)">Save</button>
        </div>
        <div class="tabs-wrapper">
          <div class="tabs" id="tabStrip" role="tablist" aria-label="Open Notes"></div>
          <button type="button" class="new-tab-btn" id="newTabBtn" title="New Note Tab (Ctrl+T)" aria-label="New Note Tab">+</button>
        </div>
      </div>

      <div class="drag-region" data-tauri-drag-region>
        <span class="save-toast" id="saveToast" role="status" aria-live="polite">Saved</span>
      </div>

      <div class="titlebar-right">
        <div class="top-preset-group" role="group" aria-label="View Mode">
          <button type="button" class="top-preset-btn active" data-view-mode="edit" title="Markdown Editor with Inline Images">Editor</button>
          <button type="button" class="top-preset-btn" data-view-mode="split" title="Side-by-Side Editor and Reading View">Split</button>
          <button type="button" class="top-preset-btn" data-view-mode="preview" title="Clean Reading View (Ctrl+E)">Reading</button>
        </div>
        <select class="theme-select" id="themeSelect" aria-label="Select Theme" title="Switch Visual Theme">
          ${themeOptionsHtml}
        </select>
        <button type="button" class="toolbar-action-btn active" id="inspectorBtn" title="Toggle Studio Drawer (Ctrl+\\)">Studio</button>
        ${
          showNativeControls
            ? `<div class="win-controls">
                <button type="button" class="win-btn" id="winMinBtn" title="Minimize">─</button>
                <button type="button" class="win-btn" id="winMaxBtn" title="Toggle Maximize">□</button>
                <button type="button" class="win-btn close" id="winCloseBtn" title="Close">✕</button>
              </div>`
            : ''
        }
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
    this.inspectorBtnEl.addEventListener('click', () =>
      this.callbacks.onToggleInspector()
    );

    if (showNativeControls) {
      root
        .querySelector<HTMLButtonElement>('#winMinBtn')
        ?.addEventListener('click', () => void minimizeWindow());
      root
        .querySelector<HTMLButtonElement>('#winMaxBtn')
        ?.addEventListener('click', () => void toggleMaximizeWindow());
      root
        .querySelector<HTMLButtonElement>('#winCloseBtn')
        ?.addEventListener('click', () =>
          void closeWindow(this.callbacks.onBeforeWindowClose)
        );
    }
  }

  public renderTabs(tabs: TabItem[], activeTabId: string): void {
    this.tabStripEl.innerHTML = '';

    for (const tab of tabs) {
      const el = document.createElement('div');
      const isActive = tab.id === activeTabId;
      el.className = `tab ${isActive ? 'active' : ''} ${
        tab.dirty ? 'dirty' : ''
      }`;
      el.setAttribute('role', 'tab');
      el.setAttribute('aria-selected', String(isActive));
      el.dataset.tabId = tab.id;
      el.title = tab.filePath
        ? `${tab.filePath} (Middle-click or Ctrl+W to close)`
        : `${tab.title} — Unsaved Draft (Middle-click or Ctrl+W to close)`;

      const dot = document.createElement('span');
      dot.className = 'dot';

      const titleSpan = document.createElement('span');
      titleSpan.className = 'tab-title';
      titleSpan.textContent = tab.title;

      const closeSpan = document.createElement('button');
      closeSpan.type = 'button';
      closeSpan.className = 'tab-close';
      closeSpan.textContent = '×';
      closeSpan.title = 'Close Tab (Ctrl+W)';
      closeSpan.setAttribute('aria-label', `Close ${tab.title}`);
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
    this.inspectorBtnEl.setAttribute('aria-expanded', String(open));
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

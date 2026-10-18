import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  readMarkdownFile,
  writeMarkdownFile,
  promoteScratchAssets,
  gcScratchAssets,
  loadSession,
  saveSession,
  getCliStartupFiles,
  subscribeExternalOpenFiles,
  openNativeFileDialog,
  saveNativeFileDialog,
  isTauriRuntime
} from '../ipc/bridge';
import { createEditorState } from '../editor/setup';
import {
  bindImageWidgetContext,
  preloadAllAssetsInContent,
  migrateScratchCacheToFile,
  expandedSnipSet,
  assetResolvedEffect,
  assetUrlCache,
  getCacheKey
} from '../editor/imageWidget';
import { processAndInsertSnipBytes } from '../editor/pasteHandler';
import { renderMarkdownPreview } from '../preview/renderer';
import { TitlebarUI } from '../ui/titlebar';
import {
  promptSaveFileModal,
  promptOpenFileModal
} from '../ui/modal';
import {
  EditorStoragePersistence,
  PersistedWorkspaceSnapshot,
  WorkspaceViewMode,
  VALID_PRESETS
} from './storagePersistence';
import {
  WorkspaceInspector,
  UIPreset,
  SNIPMD_THEMES
} from '../ui/inspector';
import { applyThemeVariablesToDOM, THEME_PALETTES } from '../styles/themes';

export interface TabItem {
  id: string;
  title: string;
  filePath: string | null;
  content: string;
  dirty: boolean;
  mode: WorkspaceViewMode;
  scrollTop: number;
  scrollRatio: number;
  cursorPos: number;
  updatedAt?: number;
  editorState?: EditorState;
}

export class TabManager {
  private tabs: TabItem[] = [];
  private activeTabId = '';
  private untitledCounter = 1;
  private uiPreset: UIPreset = 'archival';
  private inspectorOpen = true;
  private editorView: EditorView | null = null;
  private titlebar: TitlebarUI;
  private inspector: WorkspaceInspector;
  private storagePersistence = new EditorStoragePersistence(120);
  private isSwappingTab = false;

  constructor(
    titlebarRoot: HTMLElement,
    private workspaceRoot: HTMLElement,
    private editorPane: HTMLElement,
    private previewPane: HTMLElement,
    private inspectorRoot: HTMLElement,
    private statusBarEl: HTMLElement
  ) {
    bindImageWidgetContext(
      () => this.getActiveTab()?.filePath ?? null,
      () => this.editorView
    );

    this.titlebar = new TitlebarUI(titlebarRoot, {
      onSelectTab: (id) => void this.activateTab(id),
      onCloseTab: (id) => void this.closeTab(id),
      onNewTab: () => void this.createNewScratchTab(),
      onOpenFile: () => void this.openFileFlow(),
      onSaveFile: () => void this.saveActiveTabFlow(),
      onSetMode: (mode) => void this.setActiveTabMode(mode),
      onToggleInspector: () => this.toggleInspectorDrawer(),
      onSelectPreset: (preset) => this.setUIPreset(preset),
      onBeforeWindowClose: () => this.flushAllOnBlurOrExit(false)
    });

    this.inspector = new WorkspaceInspector(inspectorRoot, {
      onJumpToLine: (lineNumber, relPath) =>
        this.jumpToLineAndExpand(lineNumber, relPath),
      onSelectPreset: (preset) => this.setUIPreset(preset),
      onInsertAssetLink: (relPath) => this.insertAssetLinkAtCursor(relPath),
      onImportImageFile: (file) => void this.importImageFileFlow(file),
      onExportNote: (format) => void this.exportActiveNoteFlow(format)
    });

    this.registerGlobalShortcuts();
    this.registerBlurAndUnloadPersistence();
    this.registerHtml5DragDrop();
  }

  public async initialize(): Promise<void> {
    const localSnapshot = this.storagePersistence.loadSnapshot();
    const rawTauriSession = await loadSession();

    let restoredSnapshot: PersistedWorkspaceSnapshot | null = localSnapshot;
    if (!restoredSnapshot && rawTauriSession) {
      try {
        const parsed = JSON.parse(rawTauriSession);
        if (parsed && Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
          const validPreset =
            parsed.uiPreset && VALID_PRESETS.has(parsed.uiPreset)
              ? (parsed.uiPreset as UIPreset)
              : 'archival';
          restoredSnapshot = {
            version: 2,
            activeTabId: parsed.activeTabId || parsed.tabs[0].id,
            untitledCounter: parsed.untitledCounter || parsed.tabs.length + 1,
            uiPreset: validPreset,
            inspectorOpen:
              typeof parsed.inspectorOpen === 'boolean'
                ? parsed.inspectorOpen
                : true,
            lastSavedAt: Date.now(),
            tabs: parsed.tabs
          };
        }
      } catch {
        restoredSnapshot = null;
      }
    }

    if (restoredSnapshot && restoredSnapshot.tabs.length > 0) {
      this.tabs = restoredSnapshot.tabs.map((t) => ({
        ...t,
        scrollRatio: t.scrollRatio ?? 0,
        updatedAt: t.updatedAt ?? Date.now()
      }));
      this.activeTabId =
        restoredSnapshot.activeTabId || this.tabs[0].id;
      this.untitledCounter =
        restoredSnapshot.untitledCounter || this.tabs.length + 1;
      this.uiPreset = restoredSnapshot.uiPreset || 'archival';
      this.inspectorOpen = restoredSnapshot.inspectorOpen ?? true;
    } else {
      const demoPath = 'D:/projects/notes/architecture-notes.md';
      let demoContent = '';
      try {
        demoContent = await readMarkdownFile(demoPath);
      } catch {
        demoContent = `# Architectural Field Notes\n\nWelcome to **SnipMD** — paste any image from your clipboard with **Ctrl+V** or drag and drop images directly into your manuscript.`;
      }

      this.tabs = [
        {
          id: 'tab-1',
          title: 'architecture-notes.md',
          filePath: demoPath,
          content: demoContent,
          dirty: false,
          mode: 'edit',
          scrollTop: 0,
          scrollRatio: 0,
          cursorPos: 0,
          updatedAt: Date.now()
        },
        {
          id: 'tab-2',
          title: 'Untitled-1',
          filePath: null,
          content: `# Studio Sketchbook\n\nUse this untitled draft to jot down thoughts, outline ideas, and paste visual references (\`Ctrl + V\`).\n\n## Quick Tips\n- Press \`Ctrl + S\` when you are ready to save this draft as a permanent Markdown file.\n- Switch between **Editor**, **Split**, and **Reading** views in the top bar.\n- Click any section heading in the **Document Outline** to jump directly to that line.`,
          dirty: true,
          mode: 'edit',
          scrollTop: 0,
          scrollRatio: 0,
          cursorPos: 0,
          updatedAt: Date.now()
        }
      ];
      this.activeTabId = 'tab-1';
      this.untitledCounter = 2;
      this.uiPreset = 'archival';
      this.inspectorOpen = true;
    }

    this.applyUIPresetDOM();
    this.applyInspectorDOM();

    const cliFiles = await getCliStartupFiles();
    for (const cliPath of cliFiles) {
      await this.openFileByPath(cliPath);
    }

    await subscribeExternalOpenFiles((paths) => {
      void (async () => {
        for (const p of paths) {
          await this.openFileByPath(p);
        }
      })();
    });

    await this.activateTab(this.activeTabId);
    this.storagePersistence.saveImmediately(this.buildWorkspaceSnapshot());
  }

  public getActiveTab(): TabItem | undefined {
    return (
      this.tabs.find((t) => t.id === this.activeTabId) || this.tabs[0]
    );
  }

  private buildWorkspaceSnapshot(): PersistedWorkspaceSnapshot {
    this.captureCurrentScrollAndCursor();
    return {
      version: 2,
      activeTabId: this.activeTabId,
      untitledCounter: this.untitledCounter,
      uiPreset: this.uiPreset,
      inspectorOpen: this.inspectorOpen,
      lastSavedAt: Date.now(),
      tabs: this.tabs.map((t) => ({
        id: t.id,
        title: t.title,
        filePath: t.filePath,
        content: t.content,
        dirty: t.dirty,
        mode: t.mode,
        scrollTop: t.scrollTop,
        scrollRatio: t.scrollRatio,
        cursorPos: t.cursorPos,
        updatedAt: t.updatedAt || Date.now()
      }))
    };
  }

  private getUnsavedTabContentsExcept(excludedTabId?: string): string[] {
    return this.tabs
      .filter((t) => t.filePath === null && t.id !== excludedTabId)
      .map((t) => t.content);
  }

  private captureCurrentScrollAndCursor(): void {
    const tab = this.getActiveTab();
    if (!tab) return;

    if ((tab.mode === 'edit' || tab.mode === 'split') && this.editorView) {
      const scroller = this.editorView.scrollDOM;
      tab.scrollTop = scroller.scrollTop;
      const maxScroll = Math.max(
        1,
        scroller.scrollHeight - scroller.clientHeight
      );
      tab.scrollRatio = scroller.scrollTop / maxScroll;
      tab.cursorPos = this.editorView.state.selection.main.head;
      tab.editorState = this.editorView.state;
    } else if (tab.mode === 'preview') {
      tab.scrollTop = this.previewPane.scrollTop;
      const maxScroll = Math.max(
        1,
        this.previewPane.scrollHeight - this.previewPane.clientHeight
      );
      tab.scrollRatio = this.previewPane.scrollTop / maxScroll;
    }
  }

  public async activateTab(tabId: string): Promise<void> {
    if (this.tabs.length === 0) return;

    if (this.activeTabId && this.activeTabId !== tabId) {
      this.captureCurrentScrollAndCursor();
    }

    const target =
      this.tabs.find((t) => t.id === tabId) || this.tabs[0];
    this.activeTabId = target.id;

    await preloadAllAssetsInContent(target.content, target.filePath);

    this.titlebar.renderTabs(this.tabs, this.activeTabId);
    this.titlebar.updateModeBadge(target.mode);

    await this.renderActiveWorkspace(target);
    this.refreshInspectorAndStatus();
  }

  private async renderActiveWorkspace(tab: TabItem): Promise<void> {
    this.isSwappingTab = true;
    try {
      const showEditor = tab.mode === 'edit' || tab.mode === 'split';
      const showPreview = tab.mode === 'preview' || tab.mode === 'split';

      this.workspaceRoot.classList.toggle('split-mode', tab.mode === 'split');
      this.editorPane.classList.toggle('hidden', !showEditor);
      this.previewPane.classList.toggle('hidden', !showPreview);

      if (showEditor) {
        if (!tab.editorState) {
          tab.editorState = createEditorState({
            initialContent: tab.content,
            getCurrentFilePath: () => this.getActiveTab()?.filePath ?? null,
            onContentChange: (newContent) => {
              if (this.isSwappingTab) return;
              const current = this.getActiveTab();
              if (current) {
                current.content = newContent;
                current.dirty = true;
                current.updatedAt = Date.now();
                this.titlebar.renderTabs(this.tabs, this.activeTabId);
                this.storagePersistence.scheduleSave(() =>
                  this.buildWorkspaceSnapshot()
                );
                if (current.mode === 'split') {
                  void renderMarkdownPreview(
                    this.previewPane,
                    current.content,
                    current.filePath
                  );
                }
                this.refreshInspectorAndStatus();
              }
            },
            onSnipInserted: () => {
              this.storagePersistence.saveImmediately(
                this.buildWorkspaceSnapshot()
              );
              const current = this.getActiveTab();
              if (current && current.mode === 'split') {
                void renderMarkdownPreview(
                  this.previewPane,
                  current.content,
                  current.filePath
                );
              }
              this.titlebar.showToast('Added image to note');
              this.refreshInspectorAndStatus();
            }
          });
        }

        if (!this.editorView) {
          this.editorView = new EditorView({
            state: tab.editorState,
            parent: this.editorPane
          });
        } else {
          this.editorView.setState(tab.editorState);
        }

        const docLen = this.editorView.state.doc.length;
        const safeCursor = Math.min(tab.cursorPos || 0, docLen);
        this.editorView.dispatch({
          selection: { anchor: safeCursor }
        });

        requestAnimationFrame(() => {
          if (this.editorView) {
            const scroller = this.editorView.scrollDOM;
            const maxScroll = Math.max(
              0,
              scroller.scrollHeight - scroller.clientHeight
            );
            scroller.scrollTop =
              tab.scrollRatio > 0 ? tab.scrollRatio * maxScroll : tab.scrollTop;
            this.editorView.focus();
          }
        });
      }

      if (showPreview) {
        await renderMarkdownPreview(
          this.previewPane,
          tab.content,
          tab.filePath
        );

        if (tab.mode === 'preview') {
          requestAnimationFrame(() => {
            const maxScroll = Math.max(
              0,
              this.previewPane.scrollHeight - this.previewPane.clientHeight
            );
            this.previewPane.scrollTop =
              tab.scrollRatio > 0
                ? tab.scrollRatio * maxScroll
                : tab.scrollTop;
          });
        }
      }
    } finally {
      this.isSwappingTab = false;
    }
  }

  public setUIPreset(preset: UIPreset): void {
    this.uiPreset = preset;
    this.applyUIPresetDOM();
    this.storagePersistence.saveImmediately(this.buildWorkspaceSnapshot());
    this.refreshInspectorAndStatus();
    const found = SNIPMD_THEMES.find((t) => t.id === preset);
    this.titlebar.showToast(`Theme: ${found ? found.name.replace(/^\d+\.\s*/, '') : preset}`);
  }

  private applyUIPresetDOM(): void {
    applyThemeVariablesToDOM(this.uiPreset);
    this.titlebar.updatePresetButtons(this.uiPreset);
  }

  public toggleInspectorDrawer(): void {
    this.inspectorOpen = !this.inspectorOpen;
    this.applyInspectorDOM();
    this.storagePersistence.saveImmediately(this.buildWorkspaceSnapshot());
    this.refreshInspectorAndStatus();
  }

  private applyInspectorDOM(): void {
    this.inspectorRoot.classList.toggle('hidden', !this.inspectorOpen);
    this.titlebar.updateInspectorBadge(this.inspectorOpen);
  }

  private jumpToLineAndExpand(lineNumber: number, relPath?: string): void {
    const tab = this.getActiveTab();
    if (!tab) return;

    if (relPath) {
      const nextExpanded = !expandedSnipSet.has(relPath);
      if (nextExpanded) {
        expandedSnipSet.add(relPath);
        this.titlebar.showToast(`Expanded image to full height`);
      } else {
        expandedSnipSet.delete(relPath);
        this.titlebar.showToast(`Restored 360px reading cap`);
      }
    }

    if (tab.mode === 'preview') {
      void renderMarkdownPreview(this.previewPane, tab.content, tab.filePath);
      return;
    }

    this.scrollEditorToLine(lineNumber, relPath);
  }

  private scrollEditorToLine(lineNumber: number, relPath?: string): void {
    if (!this.editorView) return;
    const doc = this.editorView.state.doc;
    const clampedLine = Math.max(1, Math.min(lineNumber, doc.lines));
    const lineInfo = doc.line(clampedLine);
    this.editorView.dispatch({
      selection: { anchor: lineInfo.from },
      effects: relPath ? assetResolvedEffect.of(relPath) : [],
      scrollIntoView: true
    });
    this.editorView.focus();
  }

  private insertAssetLinkAtCursor(relPath: string): void {
    const tab = this.getActiveTab();
    if (!tab) return;

    if (tab.mode === 'preview') {
      void this.setActiveTabMode('edit').then(() => {
        this.insertAssetLinkAtCursor(relPath);
      });
      return;
    }

    if (!this.editorView) return;
    const pos = this.editorView.state.selection.main.head;
    const insertText = `\n![Image](${relPath})\n`;
    this.editorView.dispatch({
      changes: { from: pos, to: pos, insert: insertText },
      selection: { anchor: pos + insertText.length },
      scrollIntoView: true
    });
    this.editorView.focus();
    this.titlebar.showToast('Inserted image into note');
  }

  private async importImageFileFlow(file: File): Promise<void> {
    const tab = this.getActiveTab();
    if (!tab) return;

    if (tab.mode === 'preview') {
      await this.setActiveTabMode('edit');
    }

    if (!this.editorView) return;

    const buf = await file.arrayBuffer();
    await processAndInsertSnipBytes(
      this.editorView,
      new Uint8Array(buf),
      tab.filePath,
      () => {
        this.storagePersistence.saveImmediately(this.buildWorkspaceSnapshot());
        if (tab.mode === 'split') {
          void renderMarkdownPreview(
            this.previewPane,
            tab.content,
            tab.filePath
          );
        }
        this.titlebar.showToast(`Imported ${file.name}`);
        this.refreshInspectorAndStatus();
      }
    );
  }

  private async exportActiveNoteFlow(format: 'md' | 'html'): Promise<void> {
    const tab = this.getActiveTab();
    if (!tab) return;

    const baseName = tab.title.replace(/\.(md|markdown)$/i, '') || 'note';
    let blob: Blob;
    let downloadName: string;

    if (format === 'md') {
      blob = new Blob([tab.content], { type: 'text/markdown;charset=utf-8' });
      downloadName = `${baseName}.md`;
    } else {
      const palette = THEME_PALETTES[this.uiPreset] || THEME_PALETTES.archival;
      const tempContainer = document.createElement('div');
      await renderMarkdownPreview(tempContainer, tab.content, tab.filePath);
      const htmlDoc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${tab.title} — SnipMD Manuscript</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600;0,9..144,700;1,9..144,400&family=JetBrains+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  body { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 780px; margin: 48px auto; padding: 0 24px; background: ${palette['--bg-main']}; color: ${palette['--text-main']}; line-height: 1.75; }
  h1, h2, h3, h4 { font-family: 'Fraunces', Georgia, serif; color: ${palette['--text-heading']}; letter-spacing: -0.015em; }
  h1 { border-bottom: 1px solid ${palette['--border']}; padding-bottom: 10px; }
  code { font-family: 'JetBrains Mono', monospace; background: ${palette['--bg-code-inline']}; color: ${palette['--syn-code']}; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
  pre { background: ${palette['--bg-bar']}; border: 1px solid ${palette['--border']}; padding: 14px 16px; border-radius: 6px; overflow-x: auto; }
  pre code { background: transparent; padding: 0; color: ${palette['--text-main']}; }
  blockquote { background: ${palette['--bg-elevated']}; border: 1px solid ${palette['--border']}; border-radius: 6px; padding: 10px 16px; color: ${palette['--syn-quote']}; font-style: italic; margin: 16px 0; }
  img { max-width: 100%; border-radius: 6px; border: 1px solid ${palette['--border-subtle']}; margin: 14px 0; }
  .img-meta, .snip-cap-indicator { display: none; }
</style>
</head>
<body>
${tempContainer.innerHTML}
</body>
</html>`;
      blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
      downloadName = `${baseName}.html`;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    this.titlebar.showToast(`Exported ${downloadName}`);
  }

  public async createNewScratchTab(): Promise<void> {
    this.captureCurrentScrollAndCursor();
    const num = this.untitledCounter++;
    const newTab: TabItem = {
      id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: `Untitled-${num}`,
      filePath: null,
      content: `# Untitled-${num}\n\nBegin writing here, or paste an image from your clipboard with **Ctrl + V**.\n`,
      dirty: true,
      mode: 'edit',
      scrollTop: 0,
      scrollRatio: 0,
      cursorPos: 0,
      updatedAt: Date.now()
    };
    this.tabs.push(newTab);
    await this.activateTab(newTab.id);
    await this.persistSessionState();
  }

  public async openFileByPath(filePath: string): Promise<void> {
    const norm = filePath.replace(/\\/g, '/');
    const existing = this.tabs.find(
      (t) => t.filePath && t.filePath.replace(/\\/g, '/') === norm
    );
    if (existing) {
      await this.activateTab(existing.id);
      return;
    }

    const content = await readMarkdownFile(norm);
    const parts = norm.split('/');
    const title = parts[parts.length - 1] || 'note.md';

    const newTab: TabItem = {
      id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      filePath: norm,
      content,
      dirty: false,
      mode: 'edit',
      scrollTop: 0,
      scrollRatio: 0,
      cursorPos: 0,
      updatedAt: Date.now()
    };
    this.tabs.push(newTab);
    await this.activateTab(newTab.id);
    await this.persistSessionState();
  }

  public async openFileFlow(): Promise<void> {
    if (isTauriRuntime()) {
      const selected = await openNativeFileDialog();
      if (selected) {
        await this.openFileByPath(selected);
      }
      return;
    }

    const chosen = await promptOpenFileModal();
    if (chosen) {
      await this.openFileByPath(chosen);
    }
  }

  public async saveActiveTabFlow(): Promise<void> {
    const tab = this.getActiveTab();
    if (!tab) return;

    this.captureCurrentScrollAndCursor();

    if (tab.filePath !== null) {
      await writeMarkdownFile(tab.filePath, tab.content);
      tab.dirty = false;
      this.titlebar.renderTabs(this.tabs, this.activeTabId);
      this.titlebar.showToast(`Saved ${tab.title}`);
      await this.persistSessionState();
      this.refreshInspectorAndStatus();
      return;
    }

    let targetPath: string | null = null;
    if (isTauriRuntime()) {
      targetPath = await saveNativeFileDialog(tab.title);
    } else {
      targetPath = await promptSaveFileModal(tab.title);
    }

    if (!targetPath) return;

    const normTarget = targetPath.replace(/\\/g, '/');
    const remainingUnsaved = this.getUnsavedTabContentsExcept(tab.id);

    await promoteScratchAssets(tab.content, normTarget, remainingUnsaved);
    await writeMarkdownFile(normTarget, tab.content);

    migrateScratchCacheToFile(tab.content, normTarget);

    const parts = normTarget.split('/');
    tab.filePath = normTarget;
    tab.title = parts[parts.length - 1] || tab.title;
    tab.dirty = false;
    tab.editorState = undefined;

    await this.activateTab(tab.id);
    this.titlebar.showToast(`Saved ${tab.title}`);
    await this.persistSessionState();
    this.refreshInspectorAndStatus();
  }

  public async closeTab(tabId: string): Promise<void> {
    const idx = this.tabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return;

    const closingTab = this.tabs[idx];
    const wasUnsaved = closingTab.filePath === null;

    this.tabs.splice(idx, 1);

    if (wasUnsaved) {
      const remainingUnsaved = this.getUnsavedTabContentsExcept();
      await gcScratchAssets(remainingUnsaved);
    }

    if (this.tabs.length === 0) {
      await this.createNewScratchTab();
      return;
    }

    if (this.activeTabId === tabId) {
      const nextIdx = Math.min(idx, this.tabs.length - 1);
      await this.activateTab(this.tabs[nextIdx].id);
    } else {
      this.titlebar.renderTabs(this.tabs, this.activeTabId);
      this.refreshInspectorAndStatus();
    }

    await this.persistSessionState();
  }

  public async setActiveTabMode(mode: WorkspaceViewMode): Promise<void> {
    const tab = this.getActiveTab();
    if (!tab) return;

    this.captureCurrentScrollAndCursor();
    tab.mode = mode;
    this.titlebar.updateModeBadge(tab.mode);
    await this.renderActiveWorkspace(tab);
    this.storagePersistence.saveImmediately(this.buildWorkspaceSnapshot());
    this.refreshInspectorAndStatus();
  }

  public async toggleActiveTabMode(): Promise<void> {
    const tab = this.getActiveTab();
    if (!tab) return;
    const nextMode: WorkspaceViewMode =
      tab.mode === 'edit'
        ? 'preview'
        : tab.mode === 'preview'
        ? 'split'
        : 'edit';
    await this.setActiveTabMode(nextMode);
  }

  public async cycleNextTab(): Promise<void> {
    if (this.tabs.length <= 1) return;
    const idx = this.tabs.findIndex((t) => t.id === this.activeTabId);
    const nextIdx = (idx + 1) % this.tabs.length;
    await this.activateTab(this.tabs[nextIdx].id);
  }

  private async persistSessionState(): Promise<void> {
    const snapshot = this.buildWorkspaceSnapshot();
    this.storagePersistence.saveImmediately(snapshot);
    await saveSession(JSON.stringify(snapshot));
  }

  private async flushAllOnBlurOrExit(showToast = false): Promise<void> {
    let savedAnyDiskTab = false;
    for (const tab of this.tabs) {
      if (tab.dirty && tab.filePath !== null) {
        await writeMarkdownFile(tab.filePath, tab.content);
        tab.dirty = false;
        savedAnyDiskTab = true;
      }
    }

    this.titlebar.renderTabs(this.tabs, this.activeTabId);
    await this.persistSessionState();

    if (showToast && savedAnyDiskTab) {
      this.titlebar.showToast('Saved changes');
    }
    this.refreshInspectorAndStatus();
  }

  private registerGlobalShortcuts(): void {
    window.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      const key = e.key.toLowerCase();
      if (key === 't') {
        e.preventDefault();
        void this.createNewScratchTab();
      } else if (key === 'o') {
        e.preventDefault();
        void this.openFileFlow();
      } else if (key === 's') {
        e.preventDefault();
        void this.saveActiveTabFlow();
      } else if (key === 'w') {
        e.preventDefault();
        const active = this.getActiveTab();
        if (active) {
          void this.closeTab(active.id);
        }
      } else if (key === 'e') {
        e.preventDefault();
        void this.toggleActiveTabMode();
      } else if (key === '\\') {
        e.preventDefault();
        this.toggleInspectorDrawer();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        void this.cycleNextTab();
      }
    });
  }

  private registerBlurAndUnloadPersistence(): void {
    window.addEventListener('blur', () => {
      void this.flushAllOnBlurOrExit(false);
    });

    window.addEventListener('beforeunload', () => {
      this.storagePersistence.saveImmediately(this.buildWorkspaceSnapshot());
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.storagePersistence.saveImmediately(this.buildWorkspaceSnapshot());
      }
    });
  }

  private registerHtml5DragDrop(): void {
    this.workspaceRoot.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.workspaceRoot.classList.add('drag-over');
    });

    this.workspaceRoot.addEventListener('dragleave', (e) => {
      if (e.target === this.workspaceRoot) {
        this.workspaceRoot.classList.remove('drag-over');
      }
    });

    this.workspaceRoot.addEventListener('drop', (e) => {
      e.preventDefault();
      this.workspaceRoot.classList.remove('drag-over');

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (/\.(md|markdown|txt)$/i.test(file.name)) {
          void file.text().then(async (text) => {
            const vfsPath = `D:/projects/dropped/${file.name}`;
            await writeMarkdownFile(vfsPath, text);
            await this.openFileByPath(vfsPath);
          });
        } else if (file.type.startsWith('image/')) {
          void this.importImageFileFlow(file);
        }
      }
    });
  }

  private refreshInspectorAndStatus(): void {
    const tab = this.getActiveTab();
    if (!tab) return;

    for (const m of tab.content.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
      const rel = m[2].trim();
      const key = getCacheKey(tab.filePath, rel);
      if (rel === '.assets/snip-20261016-223804-419-7f2a.png') {
        assetUrlCache.delete(key);
      }
    }

    if (this.inspectorOpen) {
      this.inspector.render(tab, this.uiPreset);
    }

    const strippedText = tab.content
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
      .replace(/[#*`~>_|-]/g, ' ')
      .trim();
    const wordCount = strippedText
      ? strippedText.split(/\s+/).filter(Boolean).length
      : 0;
    const charCount = tab.content.length;
    const readMinutes = Math.max(1, Math.ceil(wordCount / 200));

    const imageCount = (
      tab.content.match(/!\[([^\]]*)\]\(([^)]+)\)/g) || []
    ).length;

    const docStatus = tab.filePath
      ? tab.dirty
        ? `${tab.title} · Edited`
        : `${tab.title} · Saved`
      : `${tab.title} · Draft`;

    const modeLabel =
      tab.mode === 'edit'
        ? 'Editor'
        : tab.mode === 'split'
        ? 'Split View'
        : 'Reading View';

    const activeTheme =
      SNIPMD_THEMES.find((t) => t.id === this.uiPreset)?.name.replace(
        /^\d+\.\s*/,
        ''
      ) || 'Archival Studio';

    this.statusBarEl.innerHTML = `
      <div class="statusbar-group">
        <span class="statusbar-item"><strong>${docStatus}</strong></span>
        <span class="statusbar-sep">·</span>
        <span class="statusbar-item">${wordCount} ${wordCount === 1 ? 'word' : 'words'}</span>
        <span class="statusbar-sep">·</span>
        <span class="statusbar-item">${charCount} chars</span>
        <span class="statusbar-sep">·</span>
        <span class="statusbar-item">${readMinutes} min read</span>
        ${
          imageCount > 0
            ? `<span class="statusbar-sep">·</span><span class="statusbar-item">${imageCount} ${imageCount === 1 ? 'image' : 'images'}</span>`
            : ''
        }
      </div>
      <div class="statusbar-group">
        <span class="statusbar-item">${activeTheme}</span>
        <span class="statusbar-sep">·</span>
        <span class="statusbar-item"><strong>${modeLabel}</strong></span>
      </div>
    `;
  }
}

import type { UIPreset } from '../ui/inspector';

export type WorkspaceViewMode = 'edit' | 'split' | 'preview';

export interface PersistedTabSnapshot {
  id: string;
  title: string;
  filePath: string | null;
  content: string;
  dirty: boolean;
  mode: WorkspaceViewMode;
  scrollTop: number;
  scrollRatio: number;
  cursorPos: number;
  updatedAt: number;
}

export interface PersistedWorkspaceSnapshot {
  version: 2;
  activeTabId: string;
  untitledCounter: number;
  uiPreset: UIPreset;
  inspectorOpen: boolean;
  lastSavedAt: number;
  tabs: PersistedTabSnapshot[];
}

export const WORKSPACE_STORAGE_KEY = 'snipmd_workspace_persistence_v2';
export const LEGACY_SESSION_KEY = 'snipmd_vfs_session_v1';

export const VALID_PRESETS = new Set<UIPreset>([
  'archival',
  'paper',
  'latte',
  'matcha',
  'swiss',
  'sage',
  'terracotta',
  'nordic',
  'tokyo',
  'espresso',
  'cyberpunk',
  'linear',
  'stealth',
  'oled'
]);

export class EditorStoragePersistence {
  private debounceTimer: number | null = null;
  private listeners: Array<(snapshot: PersistedWorkspaceSnapshot) => void> = [];

  constructor(private readonly debounceMs = 120) {}

  public saveImmediately(snapshot: PersistedWorkspaceSnapshot): boolean {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    try {
      const serialized = JSON.stringify(snapshot);
      localStorage.setItem(WORKSPACE_STORAGE_KEY, serialized);
      localStorage.setItem(LEGACY_SESSION_KEY, serialized);
      for (const listener of this.listeners) {
        listener(snapshot);
      }
      return true;
    } catch {
      return false;
    }
  }

  public scheduleSave(buildSnapshot: () => PersistedWorkspaceSnapshot): void {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null;
      this.saveImmediately(buildSnapshot());
    }, this.debounceMs);
  }

  public loadSnapshot(): PersistedWorkspaceSnapshot | null {
    try {
      const raw =
        localStorage.getItem(WORKSPACE_STORAGE_KEY) ||
        localStorage.getItem(LEGACY_SESSION_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as Partial<PersistedWorkspaceSnapshot>;
      if (!parsed || !Array.isArray(parsed.tabs) || parsed.tabs.length === 0) {
        return null;
      }

      const preset =
        parsed.uiPreset && VALID_PRESETS.has(parsed.uiPreset)
          ? parsed.uiPreset
          : 'archival';

      return {
        version: 2,
        activeTabId: parsed.activeTabId || parsed.tabs[0].id,
        untitledCounter: parsed.untitledCounter || parsed.tabs.length + 1,
        uiPreset: preset,
        inspectorOpen:
          typeof parsed.inspectorOpen === 'boolean'
            ? parsed.inspectorOpen
            : true,
        lastSavedAt: parsed.lastSavedAt || Date.now(),
        tabs: parsed.tabs.map((t) => ({
          id: String(t.id),
          title: String(t.title || 'Untitled'),
          filePath: t.filePath ?? null,
          content: typeof t.content === 'string' ? t.content : '',
          dirty: Boolean(t.dirty),
          mode:
            t.mode === 'preview' || t.mode === 'split' ? t.mode : 'edit',
          scrollTop: Number(t.scrollTop) || 0,
          scrollRatio: Number(t.scrollRatio) || 0,
          cursorPos: Number(t.cursorPos) || 0,
          updatedAt: Number(t.updatedAt) || Date.now()
        }))
      };
    } catch {
      return null;
    }
  }

  public onPersist(
    callback: (snapshot: PersistedWorkspaceSnapshot) => void
  ): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  public getStorageUsageBytes(): number {
    try {
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('snipmd_')) {
          const val = localStorage.getItem(k) || '';
          total += (k.length + val.length) * 2;
        }
      }
      return total;
    } catch {
      return 0;
    }
  }
}

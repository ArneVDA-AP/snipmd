// The 34px top bar: tabs, +, drag region, read-mode chip, window controls (SPEC §4). On macOS the
// system draws the window buttons at the left of the bar (SPEC §13).
// Tabs are kept per id and updated in place, so focus and hover survive a redraw.
import { appWindow } from './ipc';
import { button } from './dom';
import { icon } from './icons';
import { IS_MAC, keys } from './platform';
import type { TabState } from './types';

export interface TitlebarHandlers {
  select: (id: string) => void;
  /** Enter in the strip: show the tab and move focus into it. */
  open: (id: string) => void;
  close: (id: string) => void;
  newTab: () => void;
  toggleMode: () => void;
  /** A tab dragged to position `toIndex` among the open tabs. */
  move: (id: string, toIndex: number) => void;
}

interface TabEl {
  el: HTMLElement;
  title: HTMLElement;
  close: HTMLButtonElement;
}

const CLOSE_KEY = keys('Ctrl+W');

function setMaximized(maxBtn: HTMLButtonElement, max: boolean): void {
  const label = max ? 'Restore' : 'Maximize';
  if (maxBtn.title === label) return;
  maxBtn.title = label;
  maxBtn.setAttribute('aria-label', label);
  maxBtn.replaceChildren(icon(max ? 'restore' : 'maximize'));
}

/** Minimize, maximize/restore and close, drawn by SnipMD on Windows. */
function windowControls(): HTMLElement {
  // Window buttons are not tab stops: Windows reaches them with Alt+Space and Alt+F4.
  const winBtn = (cls: string, label: string, name: Parameters<typeof icon>[0], run: () => void) => {
    const b = button(`win-btn ${cls}`, '', label, run);
    b.tabIndex = -1;
    b.append(icon(name));
    return b;
  };
  const maxBtn = winBtn('max', 'Maximize', 'maximize', () => void appWindow.toggleMaximize());
  const controls = document.createElement('div');
  controls.className = 'win-controls';
  controls.append(
    winBtn('min', 'Minimize', 'minimize', () => void appWindow.minimize()),
    maxBtn,
    // Goes through the window's close-requested handler (app.ts), like Alt+F4.
    winBtn('close', 'Close', 'close', () => void appWindow.close())
  );
  let pending = false;
  window.addEventListener('resize', () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      void appWindow.isMaximized().then((max) => setMaximized(maxBtn, max), () => {});
    });
  });
  return controls;
}

export class Titlebar {
  private strip: HTMLElement;
  private chip: HTMLButtonElement;
  private els = new Map<string, TabEl>();
  private order: string[] = [];
  private activeId = '';

  constructor(root: HTMLElement, private h: TitlebarHandlers) {
    this.strip = document.createElement('div');
    this.strip.className = 'tabs';
    this.strip.setAttribute('role', 'tablist');
    this.strip.setAttribute('aria-label', 'Notes');
    this.strip.addEventListener('keydown', (e) => this.onKey(e));
    // A mouse wheel scrolls a full strip sideways.
    this.strip.addEventListener(
      'wheel',
      (e) => {
        if (e.deltaY === 0 || this.strip.scrollWidth <= this.strip.clientWidth) return;
        e.preventDefault();
        this.strip.scrollLeft += e.deltaY;
      },
      { passive: false }
    );

    const newTab = button('new-tab', '', `New tab (${keys('Ctrl+T')})`, () => this.h.newTab());
    newTab.append(icon('plus'));

    const drag = document.createElement('div');
    drag.className = 'drag-region';
    drag.setAttribute('data-tauri-drag-region', '');

    this.chip = button('mode-chip', '', `Back to writing (${keys('Ctrl+E')})`, () => this.h.toggleMode());
    this.chip.append(icon('book'), document.createTextNode('Reading'));
    this.chip.hidden = true;

    if (IS_MAC) {
      // Room for the system's close, minimize and zoom buttons; the window drags from there too.
      const lights = document.createElement('div');
      lights.className = 'traffic-lights';
      lights.setAttribute('data-tauri-drag-region', '');
      root.replaceChildren(lights, this.strip, newTab, drag, this.chip);
    } else {
      root.replaceChildren(this.strip, newTab, drag, this.chip, windowControls());
    }
  }

  private create(id: string): TabEl {
    const el = document.createElement('div');
    el.setAttribute('role', 'tab');
    el.dataset.id = id;
    const mode = icon('book');
    mode.classList.add('tab-mode');
    const title = document.createElement('span');
    title.className = 'tab-title';
    const close = button('tab-close', '', 'Close', () => this.h.close(id));
    close.tabIndex = -1;
    close.append(icon('close'));
    close.addEventListener('click', (e) => e.stopPropagation());
    el.append(mode, title, close);
    el.addEventListener('click', () => this.h.select(id));
    // A click never puts focus on the tab (the note keeps it); middle-click shows no autoscroll cursor.
    el.addEventListener('mousedown', (e) => e.preventDefault());
    el.addEventListener('auxclick', (e) => {
      if (e.button === 1) {
        e.preventDefault();
        this.h.close(id);
      }
    });
    return { el, title, close };
  }

  render(tabs: readonly TabState[], activeId: string): void {
    const focusedId = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('.tab')?.dataset.id;
    const live = new Set<string>();
    const list = tabs.map((tab) => {
      live.add(tab.id);
      let t = this.els.get(tab.id);
      if (!t) {
        t = this.create(tab.id);
        this.els.set(tab.id, t);
      }
      const active = tab.id === activeId;
      const cls = `tab${active ? ' active' : ''}${tab.dirty ? ' dirty' : ''}${tab.mode === 'read' ? ' read' : ''}`;
      if (t.el.className !== cls) t.el.className = cls;
      if (t.title.textContent !== tab.title) t.title.textContent = tab.title;
      const tip = tab.filePath ?? `${tab.title} (not saved yet)`;
      if (t.el.title !== tip) t.el.title = tip;
      t.el.setAttribute('aria-selected', String(active));
      t.close.title = `Close ${tab.title} (${CLOSE_KEY})`;
      t.close.setAttribute('aria-label', `Close ${tab.title}${tab.dirty ? ', unsaved changes' : ''}`);
      return t.el;
    });
    for (const id of [...this.els.keys()]) if (!live.has(id)) this.els.delete(id);
    const ids = tabs.map((t) => t.id);
    if (ids.join('\n') !== this.order.join('\n')) {
      this.strip.replaceChildren(...list);
      this.order = ids;
      if (focusedId && live.has(focusedId)) this.els.get(focusedId)?.el.focus(); // a move drops focus
    }
    const moved = this.activeId !== activeId;
    this.activeId = activeId;
    // Roving focus: one tab stop for the strip, on the focused tab or else the active one.
    const stop = focusedId && live.has(focusedId) ? focusedId : activeId;
    for (const [id, t] of this.els) t.el.tabIndex = id === stop ? 0 : -1;
    if (focusedId && !live.has(focusedId)) this.els.get(activeId)?.el.focus();

    const activeTab = tabs.find((t) => t.id === activeId);
    this.chip.hidden = activeTab?.mode !== 'read';
    if (moved) this.els.get(activeId)?.el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  /** Arrows, Home and End move focus along the strip; Enter or Space opens; Delete closes. */
  private onKey(e: KeyboardEvent): void {
    const id = (e.target as HTMLElement).closest<HTMLElement>('.tab')?.dataset.id;
    if (!id || e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.repeat && (e.key === 'Delete' || e.key === 'Enter' || e.key === ' ')) return e.preventDefault(); // a held key acts once
    const i = this.order.indexOf(id);
    const move = (j: number): void => {
      const next = this.els.get(this.order[(j + this.order.length) % this.order.length]);
      if (!next) return;
      for (const t of this.els.values()) t.el.tabIndex = -1;
      next.el.tabIndex = 0;
      next.el.focus();
    };
    switch (e.key) {
      case 'ArrowRight': move(i + 1); break;
      case 'ArrowLeft': move(i - 1); break;
      case 'Home': move(0); break;
      case 'End': move(this.order.length - 1); break;
      case 'Enter': case ' ': this.h.open(id); break;
      case 'Delete': this.h.close(id); break;
      default: return;
    }
    e.preventDefault();
  }

  /** F6 lands here: the focused or active tab. */
  focus(): void {
    const t = [...this.els.values()].find((x) => x.el.tabIndex === 0) ?? this.els.get(this.activeId);
    t?.el.focus();
  }
}

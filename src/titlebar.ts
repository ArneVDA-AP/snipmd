// The 34px top bar: tabs, +, drag region, window controls (SPEC §4).
import { appWindow } from './ipc';
import { button } from './dom';
import type { TabState } from './types';

export interface TitlebarHandlers {
  select: (id: string) => void;
  close: (id: string) => void;
  newTab: () => void;
}

export class Titlebar {
  private strip: HTMLElement;

  constructor(root: HTMLElement, private h: TitlebarHandlers) {
    this.strip = document.createElement('div');
    this.strip.className = 'tabs';
    this.strip.setAttribute('role', 'tablist');

    const drag = document.createElement('div');
    drag.className = 'drag-region';
    drag.setAttribute('data-tauri-drag-region', '');

    const controls = document.createElement('div');
    controls.className = 'win-controls';
    controls.append(
      button('win-btn', '─', 'Minimize', () => void appWindow.minimize()),
      button('win-btn', '□', 'Maximize', () => void appWindow.toggleMaximize()),
      // Goes through the window's close-requested handler (app.ts), like Alt+F4.
      button('win-btn close', '✕', 'Close', () => void appWindow.close())
    );

    root.replaceChildren(this.strip, button('new-tab', '+', 'New tab (Ctrl+T)', () => this.h.newTab()), drag, controls);
  }

  render(tabs: readonly TabState[], activeId: string): void {
    const els = tabs.map((tab) => {
      const el = document.createElement('div');
      el.className = `tab${tab.id === activeId ? ' active' : ''}${tab.dirty ? ' dirty' : ''}`;
      el.setAttribute('role', 'tab');
      el.setAttribute('aria-selected', String(tab.id === activeId));
      el.title = tab.filePath ?? tab.title;

      const dot = document.createElement('span');
      dot.className = 'dot';
      const title = document.createElement('span');
      title.className = 'tab-title';
      title.textContent = tab.title;
      const close = button('tab-close', '×', `Close ${tab.title}`, () => this.h.close(tab.id));
      close.addEventListener('click', (e) => e.stopPropagation());

      el.append(dot, title, close);
      el.addEventListener('click', () => this.h.select(tab.id));
      el.addEventListener('auxclick', (e) => {
        if (e.button === 1) {
          e.preventDefault();
          this.h.close(tab.id);
        }
      });
      return el;
    });
    this.strip.replaceChildren(...els);
    this.strip.querySelector('.tab.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

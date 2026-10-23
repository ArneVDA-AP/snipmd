import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TabState } from './types';

vi.mock('./ipc', () => ({ appWindow: { minimize: vi.fn(), toggleMaximize: vi.fn(), close: vi.fn(), isMaximized: async () => false } }));

import { Titlebar } from './titlebar';

const h = { select: vi.fn(), open: vi.fn(), close: vi.fn(), newTab: vi.fn(), toggleMode: vi.fn(), move: vi.fn() };
const tab = (id: string, extra: Partial<TabState> = {}): TabState => ({
  id, title: `${id}.md`, filePath: `C:/n/${id}.md`, content: '', dirty: false, mode: 'edit', cursor: 0, scrollTop: 0, disk: null, format: null, ...extra
});

Element.prototype.scrollIntoView ??= function () {}; // not in jsdom

let root: HTMLElement;
let bar: Titlebar;
const tabEl = (id: string) => root.querySelector<HTMLElement>(`.tab[data-id="${id}"]`)!;
const key = (el: HTMLElement, k: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

beforeEach(() => {
  vi.clearAllMocks();
  document.body.replaceChildren();
  root = document.createElement('header');
  document.body.append(root);
  bar = new Titlebar(root, h);
});

describe('tab strip', () => {
  it('keeps each tab element across renders and updates it in place', () => {
    bar.render([tab('a'), tab('b')], 'a');
    const a = tabEl('a');
    bar.render([tab('a', { title: 'renamed.md', dirty: true }), tab('b')], 'b');
    expect(tabEl('a')).toBe(a);
    expect(a.textContent).toBe('renamed.md');
    expect(a.className).toBe('tab dirty');
    expect(tabEl('b').getAttribute('aria-selected')).toBe('true');
  });

  it('drops the element of a closed tab and keeps order', () => {
    bar.render([tab('a'), tab('b'), tab('c')], 'a');
    bar.render([tab('c'), tab('a')], 'a');
    expect([...root.querySelectorAll<HTMLElement>('.tab')].map((e) => e.dataset.id)).toEqual(['c', 'a']);
  });

  it('has one tab stop: the active tab', () => {
    bar.render([tab('a'), tab('b'), tab('c')], 'b');
    expect([...root.querySelectorAll<HTMLElement>('.tab')].map((e) => e.tabIndex)).toEqual([-1, 0, -1]);
  });

  it('arrows move focus without opening; Enter opens; Delete closes', () => {
    bar.render([tab('a'), tab('b'), tab('c')], 'a');
    tabEl('a').focus();
    key(tabEl('a'), 'ArrowLeft');
    expect(document.activeElement).toBe(tabEl('c'));
    expect(h.select).not.toHaveBeenCalled();
    key(tabEl('c'), 'Home');
    key(tabEl('a'), 'ArrowRight');
    expect(document.activeElement).toBe(tabEl('b'));
    key(tabEl('b'), 'Enter');
    expect(h.open).toHaveBeenCalledWith('b');
    key(tabEl('b'), 'Delete');
    expect(h.close).toHaveBeenCalledWith('b');
  });

  it('a held Delete closes one tab', () => {
    bar.render([tab('a'), tab('b')], 'a');
    tabEl('a').focus();
    key(tabEl('a'), 'Delete');
    tabEl('a').dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', repeat: true, bubbles: true, cancelable: true }));
    expect(h.close).toHaveBeenCalledTimes(1);
  });

  it('keeps focus on the focused tab when the order changes', () => {
    bar.render([tab('a'), tab('b')], 'a');
    tabEl('a').focus();
    bar.render([tab('b'), tab('a')], 'a');
    expect(document.activeElement).toBe(tabEl('a'));
  });

  it('a mouse press does not take focus from the note', () => {
    bar.render([tab('a')], 'a');
    const down = new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true });
    tabEl('a').dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
  });

  it('the focused tab keeps the tab stop through a render', () => {
    bar.render([tab('a'), tab('b')], 'a');
    tabEl('a').focus();
    key(tabEl('a'), 'ArrowRight');
    bar.render([tab('a'), tab('b', { dirty: true })], 'a');
    expect(tabEl('b').tabIndex).toBe(0);
    expect(document.activeElement).toBe(tabEl('b'));
  });

  it('middle-click and the close button close without selecting', () => {
    bar.render([tab('a')], 'a');
    tabEl('a').dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true }));
    root.querySelector<HTMLButtonElement>('.tab-close')!.click();
    expect(h.close).toHaveBeenCalledTimes(2);
    expect(h.select).not.toHaveBeenCalled();
  });

  it('names unsaved changes on the close button for screen readers', () => {
    bar.render([tab('a', { dirty: true })], 'a');
    expect(root.querySelector('.tab-close')!.getAttribute('aria-label')).toBe('Close a.md, unsaved changes');
  });

  it('shows the reading chip only for a tab in read mode; it toggles back', () => {
    bar.render([tab('a', { mode: 'read' }), tab('b')], 'a');
    const chip = root.querySelector<HTMLButtonElement>('.mode-chip')!;
    expect(chip.hidden).toBe(false);
    expect(tabEl('a').classList.contains('read')).toBe(true);
    chip.click();
    expect(h.toggleMode).toHaveBeenCalledTimes(1);
    bar.render([tab('a', { mode: 'read' }), tab('b')], 'b');
    expect(chip.hidden).toBe(true);
  });

  it('focus() puts focus on the tab stop', () => {
    bar.render([tab('a'), tab('b')], 'b');
    bar.focus();
    expect(document.activeElement).toBe(tabEl('b'));
  });

  it('window buttons are not tab stops', () => {
    expect([...root.querySelectorAll<HTMLElement>('.win-btn')].every((b) => b.tabIndex === -1)).toBe(true);
  });
});

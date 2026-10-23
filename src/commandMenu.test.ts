import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toggleCommandMenu, type Command } from './commandMenu';
import { mountInfobar } from './infobar';

let top: HTMLElement;
let on: boolean;
let run: ReturnType<typeof vi.fn<(id: string) => void>>;
let list: Command[];

const noop = () => {};
const input = () => top.querySelector<HTMLInputElement>('input')!;
const rows = () => [...top.querySelectorAll<HTMLElement>('[role=option]')];
const press = (key: string) =>
  input().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
const type = (v: string) => {
  input().value = v;
  input().dispatchEvent(new Event('input', { bubbles: true }));
};
const open = () => toggleCommandMenu(() => list);

beforeEach(() => {
  top = document.createElement('div');
  document.body.replaceChildren(top);
  mountInfobar(top, document.createElement('div'), noop);
  on = false;
  run = vi.fn<(id: string) => void>((id) => {
    if (id === 'wrap') on = !on;
  });
  list = [
    { id: 'save', title: 'Save note', keys: 'Ctrl+S', run: () => run('save') },
    { id: 'save-as', title: 'Save note as', run: () => run('save-as') },
    { id: 'wrap', title: 'Toggle word wrap', run: () => run('wrap'), checked: () => on },
  ];
});

describe('command menu', () => {
  it('toggle opens and closes the bar', () => {
    open();
    expect(top.querySelector('[role=listbox]')).not.toBeNull();
    expect(document.activeElement).toBe(input());
    open();
    expect(top.children.length).toBe(0);
    open();
    expect(rows().length).toBe(3);
  });

  it('every word must be in the title', () => {
    open();
    type('SAVE as');
    expect(rows().map((r) => r.textContent)).toEqual([expect.stringContaining('Save note as')]);
    type('wrap save');
    expect(rows().length).toBe(0);
  });

  it('arrows and Enter run a command once and remove the bar', () => {
    open();
    press('ArrowDown');
    press('ArrowDown');
    press('ArrowDown');
    press('ArrowUp');
    press('ArrowUp');
    press('ArrowUp');
    press('ArrowDown');
    expect(rows()[1].getAttribute('aria-selected')).toBe('true');
    press('Enter');
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith('save-as');
    expect(top.children.length).toBe(0);
  });

  it('a held Enter flips a toggle once', () => {
    open();
    type('wrap');
    press('Enter');
    for (let i = 0; i < 3; i++) input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true, cancelable: true }));
    expect(run).toHaveBeenCalledTimes(1);
    expect(on).toBe(true);
  });

  it('a toggle keeps the bar open and flips aria-checked', () => {
    open();
    type('wrap');
    expect(rows()[0].getAttribute('aria-checked')).toBe('false');
    press('Enter');
    expect(run).toHaveBeenCalledWith('wrap');
    expect(top.children.length).toBe(1);
    expect(input().value).toBe('wrap');
    expect(rows()[0].getAttribute('aria-checked')).toBe('true');
    expect(rows()[0].textContent).toContain('✓');
  });

  it('mousedown on a row is prevented and click runs it', () => {
    open();
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    rows()[0].dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    rows()[0].click();
    expect(run).toHaveBeenCalledWith('save');
    expect(top.children.length).toBe(0);
  });

  it('Esc removes the bar', () => {
    open();
    press('Escape');
    expect(top.children.length).toBe(0);
    open();
    expect(top.children.length).toBe(1);
  });
});

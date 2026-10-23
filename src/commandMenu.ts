// Command menu (SPEC §4): a filter field and a short list, shown as the keyed top info bar.
import { plainField } from './dom';
import { showInfo } from './infobar';
import { keys } from './platform';

const KEY = 'command-menu';

export interface Command {
  /** Also the name the macOS menu bar sends (SPEC §13). */
  id: string;
  title: string;
  /** Written the Windows way (`Ctrl+Shift+S`) and shown through `keys()`; app.ts binds the key from it. */
  keys?: string;
  run: () => unknown;
  /** Present on a toggle: the row shows a check mark and the menu stays open. */
  checked?: () => boolean;
}

/** Closes the open menu; null while none is open. The info bar owns the bar, this only its close. */
let close: (() => void) | null = null;

export function toggleCommandMenu(source: () => readonly Command[]): void {
  if (close) return close();

  const body = document.createElement('div');
  body.className = 'cmdmenu';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'cmdmenu-input';
  input.placeholder = 'Type a command';
  input.setAttribute('aria-label', 'Command');
  plainField(input);
  const list = document.createElement('div');
  list.className = 'cmdmenu-list';
  list.setAttribute('role', 'listbox');
  body.append(input, list);

  let shown: Command[] = [];
  let selected = 0;

  const paint = (): void => {
    list.querySelectorAll('.cmdmenu-row').forEach((row, i) => {
      const on = i === selected;
      row.classList.toggle('selected', on);
      row.setAttribute('aria-selected', String(on));
      if (on) row.scrollIntoView?.({ block: 'nearest' });
    });
  };

  const rebuild = (): void => {
    const words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
    shown = source().filter((c) => words.every((w) => c.title.toLowerCase().includes(w)));
    selected = Math.min(selected, Math.max(0, shown.length - 1));
    list.replaceChildren(...shown.map(rowFor));
    paint();
  };

  const rowFor = (c: Command, i: number): HTMLElement => {
    const row = document.createElement('div');
    row.className = 'cmdmenu-row';
    row.setAttribute('role', 'option');
    if (c.checked) {
      const on = c.checked();
      row.setAttribute('aria-checked', String(on));
      const mark = document.createElement('span');
      mark.className = 'cmdmenu-check';
      mark.textContent = on ? '✓' : '';
      row.append(mark);
    }
    const title = document.createElement('span');
    title.className = 'cmdmenu-title';
    title.textContent = c.title;
    row.append(title);
    if (c.keys) {
      const k = document.createElement('kbd');
      k.textContent = keys(c.keys);
      row.append(k);
    }
    // Focus stays in the field while the mouse picks a row.
    row.addEventListener('mousedown', (e) => e.preventDefault());
    row.addEventListener('click', () => {
      selected = i;
      choose();
    });
    return row;
  };

  const choose = (): void => {
    const c = shown[selected];
    if (!c) return;
    if (!c.checked) close!();
    void c.run();
    if (c.checked) rebuild();
  };

  input.addEventListener('input', () => {
    selected = 0;
    rebuild();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      selected = Math.max(0, Math.min(shown.length - 1, selected + (e.key === 'ArrowDown' ? 1 : -1)));
      paint();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!e.repeat) choose(); // a held Enter acts once (SPEC §10): a toggle would flip back and forth
    }
  });

  rebuild();
  close = showInfo({ kind: 'info', key: KEY, text: '', body, onClose: () => (close = null) });
  input.focus();
}

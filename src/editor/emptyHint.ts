// Empty state (goal: teach the core loop). Shown by CodeMirror's placeholder in an empty tab.
import { placeholder } from '@codemirror/view';

function hint(): HTMLElement {
  const el = (tag: string, cls: string, text?: string): HTMLElement => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  };
  const root = el('span', 'empty-hint');
  const steps = el('span', 'empty-hint-steps');
  for (const [keys, what] of [
    ['Win+Shift+S', 'snip part of the screen'],
    ['Ctrl+V', 'paste it here, saved at once'],
    ['Ctrl+S', 'name the note when you like']
  ]) {
    const k = el('span', '');
    k.append(el('kbd', '', keys));
    steps.append(k, el('span', '', what));
  }
  root.append(
    el('span', 'empty-hint-title', 'Paste, type, keep going.'),
    steps,
    el('span', 'empty-hint-note', 'Untitled notes and their screenshots survive a restart. Ctrl+E reads, Ctrl+F finds.')
  );
  return root;
}

export const emptyHint = placeholder(hint);

// Empty state (goal: teach the core loop, SPEC §2 and §13). Shown by CodeMirror's placeholder in an empty tab.
import { placeholder } from '@codemirror/view';
import { IS_MAC, keys } from '../platform';

const SNIP = IS_MAC ? '⌃⇧⌘4' : 'Win+Shift+S';
// macOS has a second way in: the floating thumbnail of ⇧⌘4, dragged onto the note.
const MORE = IS_MAC ? 'Or press ⇧⌘4 and drag its thumbnail here. ' : '';

function hint(): HTMLElement {
  const el = (tag: string, cls: string, text?: string): HTMLElement => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  };
  const root = el('span', 'empty-hint');
  const steps = el('span', 'empty-hint-steps');
  for (const [k, what] of [[SNIP, 'snip part of the screen'], [keys('Ctrl+V'), 'paste it here, saved at once'], [keys('Ctrl+S'), 'name the note when you like']]) {
    const step = el('span', '');
    step.append(el('kbd', '', k));
    steps.append(step, el('span', '', what));
  }
  root.append(
    el('span', 'empty-hint-title', 'Paste, type, keep going.'),
    steps,
    el(
      'span',
      'empty-hint-note',
      `${MORE}Untitled notes and their screenshots survive a restart. ${keys('Ctrl+E')} reads, ${keys('Ctrl+F')} finds.`
    )
  );
  return root;
}

export const emptyHint = placeholder(hint);

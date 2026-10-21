import { afterEach, describe, expect, it } from 'vitest';
import { undo } from '@codemirror/commands';
import { createEditorState } from './setup';
import { dropState, getState, setState } from './registry';
import { rewriteImagePrefix } from './links';

const MOVE = { from: 'untitled.assets/', to: 'note.assets/' };
const text = (id: string) => getState(id)!.doc.toString();
function open(id: string, doc: string) {
  setState(id, createEditorState(id, doc));
}
afterEach(() => ['t1', 't2', 't3', 't4'].forEach(dropState));

describe('rewriteImagePrefix', () => {
  it('changes only links with the exact prefix; code and other prefixes stay', () => {
    const doc = [
      '![a](untitled.assets/one.png)',
      '![b](untitled.assets-old/two.png)',
      '[c](untitled.assets/link.png)',
      '`![d](untitled.assets/code.png)`',
      '```',
      '![e](untitled.assets/block.png)',
      '```'
    ].join('\n');
    open('t1', doc);
    expect(rewriteImagePrefix('t1', MOVE)).toBe(1);
    expect(text('t1')).toBe(doc.replace('![a](untitled.assets/', '![a](note.assets/'));
  });

  it('changes several links on one line', () => {
    open('t2', '![a](untitled.assets/1.png) ![b](untitled.assets/2.png)');
    expect(rewriteImagePrefix('t2', MOVE)).toBe(2);
    expect(text('t2')).toBe('![a](note.assets/1.png) ![b](note.assets/2.png)');
  });

  it('one undo restores all links', () => {
    const doc = '![a](untitled.assets/1.png)\n\n![b](untitled.assets/2.png)';
    open('t3', doc);
    rewriteImagePrefix('t3', MOVE);
    let state = getState('t3')!;
    undo({ state, dispatch: (tr) => (state = tr.state) });
    expect(state.doc.toString()).toBe(doc);
  });

  it('rewrites a tab that is not visible, and a long note fully', () => {
    const doc = 'x\n\n'.repeat(3000) + '![a](untitled.assets/last.png)';
    open('t4', doc);
    expect(rewriteImagePrefix('t4', MOVE)).toBe(1);
    expect(text('t4').endsWith('![a](note.assets/last.png)')).toBe(true);
  });

  it('returns 0 for an unknown tab', () => {
    expect(rewriteImagePrefix('nope', MOVE)).toBe(0);
  });
});

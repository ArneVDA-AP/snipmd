import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { ensureSyntaxTree } from '@codemirror/language';
import { markdownLanguage } from '@codemirror/lang-markdown';
import { imageTarget } from './imageUrl';

function target(doc: string): string | null {
  const state = EditorState.create({ doc, extensions: [markdownLanguage] });
  const tree = ensureSyntaxTree(state, state.doc.length, 1000)!;
  let out: string | null = 'no image';
  tree.iterate({
    enter: (n) => {
      if (n.name !== 'Image') return;
      const url = imageTarget(state.doc, n.node);
      out = url ? state.sliceDoc(url.from, url.to) : null;
      return false;
    }
  });
  return out;
}

describe('imageTarget', () => {
  it('is the link target, also when the alt text holds a URL or a mail address (GFM autolinks)', () => {
    expect(target('![snip](a.assets/b.png)')).toBe('a.assets/b.png');
    expect(target('![see https://a.com/x.png](snip.assets/b.png)')).toBe('snip.assets/b.png');
    expect(target('![mail me@x.org](untitled.assets/c.png "t")')).toBe('untitled.assets/c.png');
  });
  it('is null for an image without a target', () => {
    expect(target('![only https://a.com/alt]()')).toBeNull();
  });
});

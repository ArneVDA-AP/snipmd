// Where an Image node's target sits. GFM turns URLs in alt text into URL nodes of their own, so the
// target is the URL after the `(` mark, never simply the first URL child.
import type { Text } from '@codemirror/state';
import type { SyntaxNode } from '@lezer/common';

export function imageTarget(doc: Text, image: SyntaxNode): SyntaxNode | null {
  const open = image.getChildren('LinkMark').find((m) => doc.sliceString(m.from, m.to) === '(');
  if (!open) return null;
  return image.getChildren('URL').find((u) => u.from >= open.to) ?? null;
}

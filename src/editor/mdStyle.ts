// Light Markdown styling (SPEC §5) for what a highlight style cannot reach: whole lines of fenced
// code and quotes. Only the visible ranges are walked, and only when the doc, viewport or tree changed.
import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';

const line = (cls: string) => Decoration.line({ class: cls });
// Code, its fence and its language name are not prose: no spelling squiggles under `js` or `const`.
const codeLine = (cls: string) => Decoration.line({ class: cls, attributes: { spellcheck: 'false' } });
const CODE = codeLine('md-code-line');
const CODE_FIRST = codeLine('md-code-line md-code-first');
const CODE_LAST = codeLine('md-code-line md-code-last');
const CODE_ONLY = codeLine('md-code-line md-code-first md-code-last');
const QUOTE = line('md-quote-line');

function build(view: EditorView): DecorationSet {
  const { doc } = view.state;
  const lines = new Map<number, Decoration>();
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        const code = node.name === 'FencedCode' || node.name === 'CodeBlock';
        if (!code && node.name !== 'Blockquote') return;
        const first = doc.lineAt(node.from).number;
        const last = doc.lineAt(node.to).number;
        for (let n = Math.max(first, doc.lineAt(from).number); n <= Math.min(last, doc.lineAt(to).number); n++) {
          const deco = !code ? QUOTE : first === last ? CODE_ONLY : n === first ? CODE_FIRST : n === last ? CODE_LAST : CODE;
          lines.set(doc.line(n).from, deco);
        }
        return false; // nothing inside a code block or quote needs a line class of its own
      }
    });
  }
  const builder = new RangeSetBuilder<Decoration>();
  for (const pos of [...lines.keys()].sort((a, b) => a - b)) builder.add(pos, pos, lines.get(pos)!);
  return builder.finish();
}

export const markdownLines = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = build(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged || syntaxTree(u.state) !== syntaxTree(u.startState)) {
        this.decorations = build(u.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);

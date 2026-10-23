// Code-block languages (SPEC §5): which names are known and how each parser loads. Every language is
// a dynamic import, so none of them lands in the startup chunk (SPEC §9).
import { LanguageDescription, LanguageSupport, LRLanguage, ParseContext, StreamLanguage } from '@codemirror/language';
import type { LRParser } from '@lezer/lr';
import type { Parser } from '@lezer/common';
import { classHighlighter, highlightCode as lezerHighlight } from '@lezer/highlight';

/** A grammar as a language; its highlighting comes with the grammar's own style tags. */
const lr = (name: string, parser: LRParser) => new LanguageSupport(LRLanguage.define({ name, parser }));

const lang = (name: string, alias: string[], load: () => Promise<LanguageSupport>) => LanguageDescription.of({ name, alias, load });

/** The languages SPEC §5 lists, each loaded by a dynamic import on first use. */
export const CODE_LANGUAGES: readonly LanguageDescription[] = [
  // The bare Lezer grammars, not @codemirror/lang-javascript, -css or -html: lang-markdown imports
  // those statically, so a dynamic import of them would end up in the startup files.
  lang('JavaScript', ['js', 'jsx', 'mjs', 'cjs'], () => import('@lezer/javascript').then((m) => lr('javascript', m.parser.configure({ dialect: 'jsx' })))),
  lang('TypeScript', ['ts', 'tsx'], () => import('@lezer/javascript').then((m) => lr('typescript', m.parser.configure({ dialect: 'ts jsx' })))),
  lang('JSON', [], () => import('@codemirror/lang-json').then((m) => m.json())),
  lang('CSS', [], () => import('@lezer/css').then((m) => lr('css', m.parser))),
  lang('HTML', ['htm'], () => import('@lezer/html').then((m) => lr('html', m.parser))),
  lang('Python', ['py'], () => import('@codemirror/lang-python').then((m) => m.python())),
  lang('Rust', ['rs'], () => import('@codemirror/lang-rust').then((m) => m.rust())),
  lang('SQL', [], () => import('@codemirror/lang-sql').then((m) => m.sql())),
  lang('Shell', ['sh', 'bash', 'zsh', 'shell'], () =>
    import('@codemirror/legacy-modes/mode/shell').then((m) => new LanguageSupport(StreamLanguage.define(m.shell)))
  ),
  lang('YAML', ['yml'], () => import('@codemirror/lang-yaml').then((m) => m.yaml()))
];

/** For `parseCode` in the editor: the parser of a loaded language, a skipping parser that loads it, or null for an unknown name. */
export function codeParser(info: string): Parser | null {
  const desc = LanguageDescription.matchLanguageName(CODE_LANGUAGES, info, true);
  if (!desc) return null;
  return desc.support ? desc.support.language.parser : ParseContext.getSkippingParser(desc.load());
}

/**
 * Read mode: fills `target` with `code` as spans with `tok-*` classes (textContent only) once the
 * language named by `info` has loaded. Resolves false, leaving `target` as it was, for an unknown
 * name or a failed load.
 */
export async function highlightCode(target: HTMLElement, code: string, info: string): Promise<boolean> {
  const desc = LanguageDescription.matchLanguageName(CODE_LANGUAGES, info, true);
  if (!desc) return false;
  let support: LanguageSupport;
  try {
    support = await desc.load();
  } catch {
    return false;
  }
  const tree = support.language.parser.parse(code);
  const doc = target.ownerDocument;
  const nodes: Node[] = [];
  lezerHighlight(
    code,
    tree,
    classHighlighter,
    (text, classes) => {
      if (!classes) return void nodes.push(doc.createTextNode(text));
      const span = doc.createElement('span');
      span.className = classes;
      span.textContent = text;
      nodes.push(span);
    },
    () => nodes.push(doc.createTextNode('\n'))
  );
  target.replaceChildren(...nodes);
  return true;
}

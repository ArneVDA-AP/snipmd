// Inline images below their Markdown line.
// Block widgets must come from a StateField (CM6 throws for block widgets from a ViewPlugin).
// StateField.update is synchronous, so resolved URLs live in a cache; resolution is async and
// redraws every tab that waited for it.
import type { SyntaxNode } from '@lezer/common';
import { StateField, StateEffect, type EditorState, type Range } from '@codemirror/state';
import { EditorView, Decoration, type DecorationSet, WidgetType } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { resolveAssetPath, toAssetUrl } from '../ipc';
import { applyToTab, filePathFor, tabIdFacet } from './registry';
import { isWebUrl } from '../paths';

/**
 * One entry per cache key: the URL, a lookup in flight (with the tabs to redraw when it ends), or a failure.
 * A failure is final for the session, so nothing looks it up again (no retry loop); primeAssetCache replaces it.
 */
type Entry = { kind: 'ok'; url: string } | { kind: 'pending'; tabs: Set<string> } | { kind: 'failed' };
const images = new Map<string, Entry>();
/** Cache keys of images the user expanded to full height. */
const expanded = new Set<string>();

const redraw = StateEffect.define<null>();

/** Rebuilds a tab's image widgets, visible or not. Use after the note path changed. */
export function redrawImages(tabId: string): void {
  applyToTab(tabId, { effects: redraw.of(null) });
}

/** A link resolves against the note's folder, or for an untitled tab against that tab's scratch folder. */
function cacheKey(tabId: string, relPath: string): string {
  const filePath = filePathFor(tabId);
  return filePath ? `${filePath}::${relPath}` : `untitled:${tabId}::${relPath}`;
}

function urlOf(entry: Entry | undefined): string | undefined {
  return entry?.kind === 'ok' ? entry.url : undefined;
}

export function cachedUrl(tabId: string, relPath: string): string | undefined {
  return isWebUrl(relPath) ? relPath : urlOf(images.get(cacheKey(tabId, relPath)));
}

export function primeAssetCache(tabId: string, relPath: string, absPath: string): void {
  images.set(cacheKey(tabId, relPath), { kind: 'ok', url: toAssetUrl(absPath) });
}

/**
 * Resolves a link for a tab; '' while a shared lookup runs or after it failed. When a lookup ends,
 * every tab that waited is redrawn once, so the image or the placeholder shows.
 */
export async function ensureResolved(tabId: string, relPath: string): Promise<string> {
  if (isWebUrl(relPath)) return relPath;
  return resolveKey(tabId, relPath, cacheKey(tabId, relPath));
}

async function resolveKey(tabId: string, relPath: string, key: string): Promise<string> {
  const entry = images.get(key);
  if (entry?.kind === 'ok') return entry.url;
  if (entry?.kind === 'failed') return '';
  if (entry?.kind === 'pending') {
    entry.tabs.add(tabId);
    return '';
  }
  const tabs = new Set([tabId]);
  images.set(key, { kind: 'pending', tabs });
  let next: Entry = { kind: 'failed' };
  try {
    next = { kind: 'ok', url: toAssetUrl(await resolveAssetPath(tabId, relPath, filePathFor(tabId))) };
  } catch {
    // The placeholder shows the failure; there is nothing else to report.
  }
  // A prime during the lookup wins over its result.
  if (images.get(key)?.kind === 'pending') images.set(key, next);
  for (const id of tabs) redrawImages(id);
  return urlOf(images.get(key)) ?? '';
}

class ImageWidget extends WidgetType {
  constructor(
    readonly alt: string,
    readonly relPath: string,
    readonly url: string,
    readonly key: string,
    readonly missing: boolean
  ) {
    super();
  }

  override eq(other: ImageWidget): boolean {
    return other.alt === this.alt && other.key === this.key && other.url === this.url && other.missing === this.missing;
  }

  override toDOM(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'inline-img-widget';
    wrap.contentEditable = 'false';
    if (!this.url) {
      wrap.appendChild(placeholder(`${this.missing ? 'Image not found' : 'Loading image'}: ${this.relPath}`));
      return wrap;
    }
    const img = document.createElement('img');
    img.src = this.url;
    img.alt = this.alt;
    img.classList.toggle('expanded', expanded.has(this.key));
    img.addEventListener('mousedown', (e) => e.preventDefault());
    img.addEventListener('click', () => {
      const on = !expanded.has(this.key);
      if (on) expanded.add(this.key);
      else expanded.delete(this.key);
      img.classList.toggle('expanded', on);
    });
    img.addEventListener('error', () => img.replaceWith(placeholder(`Image not found: ${this.relPath}`)));
    wrap.appendChild(img);
    return wrap;
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

function placeholder(text: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'img-placeholder';
  el.textContent = text;
  return el;
}

/** Link target of an Image node: its URL child without <...> brackets. */
function imageLink(state: EditorState, node: SyntaxNode): string | null {
  const url = node.getChild('URL');
  if (!url) return null;
  let rel = state.sliceDoc(url.from, url.to).trim();
  if (rel.startsWith('<') && rel.endsWith('>')) rel = rel.slice(1, -1).trim();
  return rel || null;
}

/** Alt text: what sits between the opening `![` and its closing `]`. */
function imageAlt(state: EditorState, node: SyntaxNode): string {
  const marks = node.getChildren('LinkMark');
  if (marks.length < 2) return '';
  return state.sliceDoc(marks[0].to, marks[1].from).trim();
}

function build(state: EditorState): DecorationSet {
  const tabId = state.facet(tabIdFacet);
  const widgets: Range<Decoration>[] = [];
  syntaxTree(state).iterate({
    enter(ref) {
      if (ref.name !== 'Image') return;
      const rel = imageLink(state, ref.node);
      if (!rel) return false;
      const key = cacheKey(tabId, rel);
      const entry = images.get(key);
      const url = isWebUrl(rel) ? rel : (urlOf(entry) ?? '');
      const missing = entry?.kind === 'failed';
      if (!url && !entry && tabId) void resolveKey(tabId, rel, key);
      widgets.push(
        Decoration.widget({
          widget: new ImageWidget(imageAlt(state, ref.node), rel, url, key, missing),
          block: true,
          side: 1
        }).range(state.doc.lineAt(ref.to).to)
      );
      return false;
    }
  });
  return Decoration.set(widgets, true);
}

export const imageWidgetField = StateField.define<DecorationSet>({
  create: build,
  update(deco, tr) {
    if (tr.docChanged || tr.effects.some((e) => e.is(redraw)) || syntaxTree(tr.state) !== syntaxTree(tr.startState)) return build(tr.state);
    return deco.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f)
});

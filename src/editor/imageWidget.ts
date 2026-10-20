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

/** cacheKey -> displayable URL */
const urlCache = new Map<string, string>();
/** Cache keys whose lookup failed. build() never looks these up again. */
const failed = new Set<string>();
/** Cache key -> tabs waiting for it. */
const pending = new Map<string, Set<string>>();
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

export function cachedUrl(tabId: string, relPath: string): string | undefined {
  if (isWebUrl(relPath)) return relPath;
  return urlCache.get(cacheKey(tabId, relPath));
}

export function primeAssetCache(tabId: string, relPath: string, absPath: string): void {
  const key = cacheKey(tabId, relPath);
  failed.delete(key);
  urlCache.set(key, toAssetUrl(absPath));
}

/** Resolves a link for a tab. Concurrent callers share one lookup; every waiting tab is redrawn when it is done. */
export async function ensureResolved(tabId: string, relPath: string): Promise<string> {
  const filePath = filePathFor(tabId);
  const hit = cachedUrl(tabId, relPath);
  if (hit) return hit;
  const key = cacheKey(tabId, relPath);
  const waiting = pending.get(key);
  if (waiting) {
    waiting.add(tabId);
    return '';
  }
  const tabs = new Set([tabId]);
  pending.set(key, tabs);
  try {
    const url = toAssetUrl(await resolveAssetPath(tabId, relPath, filePath));
    urlCache.set(key, url);
    failed.delete(key);
    pending.delete(key);
    for (const id of tabs) redrawImages(id);
    return url;
  } catch (err) {
    // Remember the failure before the one redraw, so build() shows the placeholder and does not retry.
    failed.add(key);
    pending.delete(key);
    for (const id of tabs) redrawImages(id);
    throw err;
  }
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
      const url = cachedUrl(tabId, rel) ?? '';
      const missing = !url && failed.has(key);
      if (!url && !missing && tabId) ensureResolved(tabId, rel).catch(() => {});
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

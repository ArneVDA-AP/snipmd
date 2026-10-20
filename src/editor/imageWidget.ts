// Inline images below their Markdown line.
// Block widgets must come from a StateField (CM6 throws for block widgets from a ViewPlugin).
// StateField.update is synchronous, so resolved URLs live in a cache; resolution is async and
// dispatches assetResolved to the owning tab when done.
import { StateField, StateEffect, type EditorState, type Range } from '@codemirror/state';
import { EditorView, Decoration, type DecorationSet, WidgetType } from '@codemirror/view';
import { resolveAssetPath, toAssetUrl } from '../ipc';
import { applyToTab, filePathFor, tabIdFacet } from './registry';

const IMAGE_LINK = /!\[([^\]]*)\]\(([^)]+)\)/;
const REMOTE_OR_INLINE = /^(data:|blob:|https?:)/i;

/** `${filePath ?? '__scratch__'}::${relPath}` -> displayable URL */
const urlCache = new Map<string, string>();
const pending = new Set<string>();
/** Cache keys of images the user expanded to full height. */
export const expanded = new Set<string>();

export const assetResolved = StateEffect.define<string>();

export function cacheKey(filePath: string | null, relPath: string): string {
  return `${filePath ?? '__scratch__'}::${relPath}`;
}

export function cachedUrl(filePath: string | null, relPath: string): string | undefined {
  if (REMOTE_OR_INLINE.test(relPath)) return relPath;
  return urlCache.get(cacheKey(filePath, relPath));
}

export function primeAssetCache(filePath: string | null, relPath: string, absPath: string): void {
  urlCache.set(cacheKey(filePath, relPath), toAssetUrl(absPath));
}

/** Resolves a link for a tab; when done, tells that tab's editor to redraw. */
export async function ensureResolved(tabId: string, relPath: string): Promise<string> {
  const filePath = filePathFor(tabId);
  const hit = cachedUrl(filePath, relPath);
  if (hit) return hit;
  const key = cacheKey(filePath, relPath);
  if (pending.has(key)) return '';
  pending.add(key);
  try {
    const abs = await resolveAssetPath(relPath, filePath);
    const url = toAssetUrl(abs);
    urlCache.set(key, url);
    applyToTab(tabId, { effects: assetResolved.of(key) });
    return url;
  } finally {
    pending.delete(key);
  }
}

export function imageLinksIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(new RegExp(IMAGE_LINK.source, 'g'))) {
    const rel = m[2].trim();
    if (rel) out.push(rel);
  }
  return out;
}

class ImageWidget extends WidgetType {
  constructor(
    readonly alt: string,
    readonly relPath: string,
    readonly url: string,
    readonly key: string
  ) {
    super();
  }

  override eq(other: ImageWidget): boolean {
    return other.alt === this.alt && other.relPath === this.relPath && other.url === this.url;
  }

  override toDOM(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'inline-img-widget';
    wrap.contentEditable = 'false';
    if (!this.url) {
      wrap.appendChild(placeholder(`Loading image: ${this.relPath}`));
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

function build(state: EditorState): DecorationSet {
  const tabId = state.facet(tabIdFacet);
  const filePath = filePathFor(tabId);
  const widgets: Range<Decoration>[] = [];
  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i);
    const m = line.text.match(IMAGE_LINK);
    if (!m) continue;
    const rel = m[2].trim();
    if (!rel) continue;
    const url = cachedUrl(filePath, rel) ?? '';
    if (!url && tabId) void ensureResolved(tabId, rel);
    widgets.push(
      Decoration.widget({
        widget: new ImageWidget(m[1].trim(), rel, url, cacheKey(filePath, rel)),
        block: true,
        side: 1
      }).range(line.to)
    );
  }
  return Decoration.set(widgets, true);
}

export const imageWidgetField = StateField.define<DecorationSet>({
  create: build,
  update(deco, tr) {
    if (tr.docChanged || tr.effects.some((e) => e.is(assetResolved))) return build(tr.state);
    return deco.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f)
});

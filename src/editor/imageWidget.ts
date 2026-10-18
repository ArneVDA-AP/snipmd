import {
  StateField,
  StateEffect,
  EditorState,
  Range
} from '@codemirror/state';
import {
  EditorView,
  Decoration,
  DecorationSet,
  WidgetType
} from '@codemirror/view';
import { resolveAssetAbsPath, toDisplayableAssetSrc } from '../ipc/bridge';
import { openSnipLightboxModal } from '../ui/modal';

// Module-level synchronous cache: `${currentFilePath ?? '__scratch__'}::${relPath}` -> displayable URL
export const assetUrlCache = new Map<string, string>();
// Persist expanded state across CM6 StateField updates so typing never collapses expanded snips
export const expandedSnipSet = new Set<string>();
const pendingResolutions = new Set<string>();

export const assetResolvedEffect = StateEffect.define<string>();

let activeFilePathGetter: () => string | null = () => null;
let activeEditorViewGetter: () => EditorView | null = () => null;

export function bindImageWidgetContext(
  getFilePath: () => string | null,
  getView: () => EditorView | null
): void {
  activeFilePathGetter = getFilePath;
  activeEditorViewGetter = getView;
}

export function getCacheKey(filePath: string | null, relPath: string): string {
  return `${filePath ?? '__scratch__'}::${relPath}`;
}

export function primeAssetCache(
  filePath: string | null,
  relPath: string,
  absDiskPath: string
): string {
  const url = toDisplayableAssetSrc(absDiskPath);
  assetUrlCache.set(getCacheKey(filePath, relPath), url);
  return url;
}

export function migrateScratchCacheToFile(
  content: string,
  newFilePath: string
): void {
  const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const relPath = match[2].trim();
    const oldKey = getCacheKey(null, relPath);
    const existingUrl = assetUrlCache.get(oldKey);
    if (existingUrl) {
      assetUrlCache.set(getCacheKey(newFilePath, relPath), existingUrl);
    }
  }
}

export async function ensureAssetResolved(
  relPath: string,
  filePath: string | null
): Promise<string> {
  if (/^(data:|blob:|https?:|asset:)/i.test(relPath)) {
    return relPath;
  }

  const key = getCacheKey(filePath, relPath);
  const cached = assetUrlCache.get(key);
  if (cached) {
    return cached;
  }

  if (!pendingResolutions.has(key)) {
    pendingResolutions.add(key);
    try {
      const absPath = await resolveAssetAbsPath(relPath, filePath);
      const url = toDisplayableAssetSrc(absPath);
      assetUrlCache.set(key, url);
      const view = activeEditorViewGetter();
      if (view) {
        view.dispatch({ effects: assetResolvedEffect.of(key) });
      }
      return url;
    } finally {
      pendingResolutions.delete(key);
    }
  }

  return '';
}

export async function preloadAllAssetsInContent(
  content: string,
  filePath: string | null
): Promise<void> {
  const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const promises: Promise<string>[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const relPath = match[2].trim();
    if (relPath) {
      promises.push(ensureAssetResolved(relPath, filePath));
    }
  }
  await Promise.all(promises);
}

class InlineSnipWidget extends WidgetType {
  constructor(
    readonly altText: string,
    readonly relPath: string,
    readonly resolvedUrl: string
  ) {
    super();
  }

  override eq(other: InlineSnipWidget): boolean {
    return (
      other.altText === this.altText &&
      other.relPath === this.relPath &&
      other.resolvedUrl === this.resolvedUrl
    );
  }

  override toDOM(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'inline-img-widget';
    wrapper.contentEditable = 'false';
    wrapper.dataset.snipPath = this.relPath;

    // Prevent CodeMirror from stealing mousedown/pointerdown events on the widget
    wrapper.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
    wrapper.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
    });

    if (this.resolvedUrl) {
      const isInitiallyExpanded = expandedSnipSet.has(this.relPath);

      const frame = document.createElement('div');
      frame.className = `snip-img-frame ${isInitiallyExpanded ? 'expanded' : ''}`;

      const img = document.createElement('img');
      img.src = this.resolvedUrl;
      img.alt = this.altText || 'snip';
      img.referrerPolicy = 'no-referrer';
      if (isInitiallyExpanded) {
        img.classList.add('expanded');
      }
      img.title =
        'Single-click to toggle 360px cap / 100% full height • Double-click for Lightbox';

      const pillOverlay = document.createElement('div');
      pillOverlay.className = 'snip-cap-indicator';
      pillOverlay.textContent = isInitiallyExpanded
        ? 'Expanded 100% • Click to Cap at 360px'
        : 'Capped at 360px • Click Image to Expand 100%';

      frame.appendChild(img);
      frame.appendChild(pillOverlay);

      const meta = document.createElement('div');
      meta.className = 'img-meta';

      const pathLabel = document.createElement('span');
      pathLabel.className = 'img-meta-path';
      pathLabel.textContent = `↳ ${this.relPath}`;

      const dimLabel = document.createElement('span');
      dimLabel.className = 'img-meta-dims';
      dimLabel.textContent = isInitiallyExpanded
        ? 'Expanded 100%'
        : '360px height cap';

      const actions = document.createElement('div');
      actions.className = 'img-meta-actions';

      const toggleSizeBtn = document.createElement('button');
      toggleSizeBtn.type = 'button';
      toggleSizeBtn.className = 'img-widget-btn';
      toggleSizeBtn.textContent = isInitiallyExpanded
        ? 'Cap 360px'
        : 'Expand 100%';

      const lightboxBtn = document.createElement('button');
      lightboxBtn.type = 'button';
      lightboxBtn.className = 'img-widget-btn';
      lightboxBtn.textContent = 'Lightbox';

      const copyMdBtn = document.createElement('button');
      copyMdBtn.type = 'button';
      copyMdBtn.className = 'img-widget-btn';
      copyMdBtn.textContent = 'Copy MD';

      let naturalDimsText = '';
      let isTallImage = true;

      const applyExpandedState = (expanded: boolean) => {
        if (expanded) {
          expandedSnipSet.add(this.relPath);
        } else {
          expandedSnipSet.delete(this.relPath);
        }
        img.classList.toggle('expanded', expanded);
        frame.classList.toggle('expanded', expanded);
        wrapper.classList.toggle('expanded', expanded);

        toggleSizeBtn.textContent = expanded ? 'Collapse' : 'Expand';

        if (isTallImage) {
          pillOverlay.textContent = expanded
            ? `Expanded 100% (${naturalDimsText || 'Full'}) • Click to Cap 360px`
            : `Capped at 360px (${naturalDimsText || 'Click to Expand'})`;
          dimLabel.textContent = naturalDimsText
            ? `${naturalDimsText} · ${expanded ? 'Expanded 100%' : '360px cap'}`
            : expanded
            ? 'Expanded 100%'
            : '360px cap';
        } else {
          pillOverlay.textContent = expanded
            ? `Zoomed 100% (${naturalDimsText}) • Click to Reset`
            : `${naturalDimsText || 'Inline Snip'} • Click to Zoom / Expand`;
          dimLabel.textContent = `${naturalDimsText} · ${
            expanded ? 'Zoomed' : 'Inline'
          }`;
        }
      };

      const toggleExpand = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        const nextExpanded = !img.classList.contains('expanded');
        applyExpandedState(nextExpanded);
      };

      frame.addEventListener('click', toggleExpand);
      toggleSizeBtn.addEventListener('click', toggleExpand);

      frame.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openSnipLightboxModal(this.resolvedUrl, this.relPath, naturalDimsText);
      });

      lightboxBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openSnipLightboxModal(this.resolvedUrl, this.relPath, naturalDimsText);
      });

      img.addEventListener('load', () => {
        if (img.naturalWidth && img.naturalHeight) {
          naturalDimsText = `${img.naturalWidth}×${img.naturalHeight}px`;
          isTallImage = img.naturalHeight > 360;
          frame.classList.toggle('short-snip', !isTallImage);
          applyExpandedState(img.classList.contains('expanded'));
        }
      });

      copyMdBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        void navigator.clipboard
          ?.writeText(`![${this.altText}](${this.relPath})`)
          .then(() => {
            copyMdBtn.textContent = 'Copied!';
            window.setTimeout(() => {
              copyMdBtn.textContent = 'Copy MD';
            }, 1200);
          });
      });

      img.addEventListener('error', () => {
        frame.replaceWith(this.createFallbackNode());
      });

      actions.appendChild(toggleSizeBtn);
      actions.appendChild(lightboxBtn);
      actions.appendChild(copyMdBtn);

      meta.appendChild(pathLabel);
      meta.appendChild(dimLabel);
      meta.appendChild(actions);

      wrapper.appendChild(frame);
      wrapper.appendChild(meta);
    } else {
      wrapper.appendChild(this.createFallbackNode());
    }

    return wrapper;
  }

  private createFallbackNode(): HTMLElement {
    const fb = document.createElement('div');
    fb.className = 'img-fallback';
    fb.textContent = `Resolving inline image asset: ${this.relPath}...`;
    return fb;
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

function buildImageDecorations(state: EditorState): DecorationSet {
  const widgets: Range<Decoration>[] = [];
  const doc = state.doc;
  const currentFilePath = activeFilePathGetter();
  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/;

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const match = line.text.match(imgRegex);
    if (match) {
      const altText = match[1].trim() || 'snip';
      const relPath = match[2].trim();
      if (!relPath) continue;

      let resolvedUrl = '';
      if (/^(data:|blob:|https?:|asset:)/i.test(relPath)) {
        resolvedUrl = relPath;
      } else {
        const key = getCacheKey(currentFilePath, relPath);
        resolvedUrl = assetUrlCache.get(key) || '';
        if (!resolvedUrl) {
          void ensureAssetResolved(relPath, currentFilePath);
        }
      }

      const deco = Decoration.widget({
        widget: new InlineSnipWidget(altText, relPath, resolvedUrl),
        block: true,
        side: 1
      });
      widgets.push(deco.range(line.to));
    }
  }

  return Decoration.set(widgets, true);
}

// Guardrail #2: Block widgets MUST use StateField, never ViewPlugin
export const imageWidgetField = StateField.define<DecorationSet>({
  create(state) {
    return buildImageDecorations(state);
  },
  update(decorations, tr) {
    if (
      tr.docChanged ||
      tr.effects.some((e) => e.is(assetResolvedEffect))
    ) {
      return buildImageDecorations(tr.state);
    }
    return decorations.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f)
});

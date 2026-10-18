import { Marked } from 'marked';
import {
  assetUrlCache,
  getCacheKey,
  ensureAssetResolved,
  expandedSnipSet
} from '../editor/imageWidget';
import { openSnipLightboxModal } from '../ui/modal';

export async function renderMarkdownPreview(
  container: HTMLElement,
  markdownContent: string,
  currentFilePath: string | null
): Promise<void> {
  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const tasks: Promise<string>[] = [];
  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(markdownContent)) !== null) {
    const relPath = match[2].trim();
    if (relPath) {
      tasks.push(ensureAssetResolved(relPath, currentFilePath));
    }
  }
  await Promise.all(tasks);

  const markedInstance = new Marked();
  markedInstance.use({
    renderer: {
      image({ href, title, text }) {
        const cleanHref = (href || '').trim();
        let resolvedSrc = cleanHref;
        if (!/^(data:|blob:|https?:|asset:)/i.test(cleanHref)) {
          resolvedSrc =
            assetUrlCache.get(getCacheKey(currentFilePath, cleanHref)) || cleanHref;
        }
        const isExpanded = expandedSnipSet.has(cleanHref);
        const safeAlt = (text || 'snip').replace(/"/g, '&quot;');
        const safeTitle = (
          title || 'Click to toggle 360px cap / 100% full size'
        ).replace(/"/g, '&quot;');

        return `
          <div class="inline-img-widget" data-preview-snip="${cleanHref}">
            <div class="snip-img-frame ${isExpanded ? 'expanded' : ''}">
              <img src="${resolvedSrc}" alt="${safeAlt}" title="${safeTitle}" referrerpolicy="no-referrer" class="${
          isExpanded ? 'expanded' : ''
        }" data-snip-expandable="true" data-snip-rel="${cleanHref}" />
              <div class="snip-cap-indicator">${
                isExpanded
                  ? 'Expanded 100% • Click to Cap at 360px'
                  : 'Capped at 360px • Click Image to Expand 100%'
              }</div>
            </div>
            <div class="img-meta">
              <span class="img-meta-path">↳ ${cleanHref}</span>
              <div class="img-meta-actions">
                <button type="button" class="img-widget-btn" data-preview-toggle="${cleanHref}">${
          isExpanded ? 'Cap 360px' : 'Expand 100%'
        }</button>
                <button type="button" class="img-widget-btn" data-preview-lightbox="${resolvedSrc}" data-preview-rel="${cleanHref}">Lightbox</button>
              </div>
            </div>
          </div>
        `;
      }
    }
  });

  const renderedHtml = await markedInstance.parse(markdownContent);
  container.innerHTML = `<div class="rendered-view">${renderedHtml}</div>`;

  container
    .querySelectorAll<HTMLElement>('.inline-img-widget[data-preview-snip]')
    .forEach((widget) => {
      const relPath = widget.dataset.previewSnip || '';
      const frame = widget.querySelector<HTMLElement>('.snip-img-frame');
      const img = widget.querySelector<HTMLImageElement>('img');
      const indicator = widget.querySelector<HTMLElement>('.snip-cap-indicator');
      const toggleBtn = widget.querySelector<HTMLButtonElement>(
        '[data-preview-toggle]'
      );
      const lightboxBtn = widget.querySelector<HTMLButtonElement>(
        '[data-preview-lightbox]'
      );

      if (!frame || !img) return;

      const toggle = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        const nextExpanded = !img.classList.contains('expanded');
        if (nextExpanded) {
          expandedSnipSet.add(relPath);
        } else {
          expandedSnipSet.delete(relPath);
        }
        img.classList.toggle('expanded', nextExpanded);
        frame.classList.toggle('expanded', nextExpanded);
        if (indicator) {
          indicator.textContent = nextExpanded
            ? 'Expanded 100% • Click to Cap at 360px'
            : 'Capped at 360px • Click Image to Expand 100%';
        }
        if (toggleBtn) {
          toggleBtn.textContent = nextExpanded ? 'Cap 360px' : 'Expand 100%';
        }
      };

      frame.addEventListener('click', toggle);
      toggleBtn?.addEventListener('click', toggle);

      lightboxBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        openSnipLightboxModal(img.src, relPath, 'Full Resolution');
      });
    });
}

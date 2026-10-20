// Read mode (Ctrl+E). Phase 1 adds sanitizing; raw HTML in a note still passes through here.
import { Marked } from 'marked';
import { cachedUrl, ensureResolved } from '../editor/imageWidget';
import { filePathFor } from '../editor/registry';

const escapeAttr = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function renderRead(container: HTMLElement, tabId: string, content: string): Promise<void> {
  const filePath = filePathFor(tabId);
  const marked = new Marked({
    async: true,
    // Resolve exactly the images marked will render (not ones inside code blocks).
    walkTokens: async (token) => {
      if (token.type === 'image') await ensureResolved(tabId, token.href.trim()).catch(() => '');
    },
    renderer: {
      // Own renderer: marked's default would encodeURI the asset URL a second time.
      image({ href, text }) {
        const url = cachedUrl(filePath, (href || '').trim()) ?? '';
        return `<img class="read-img" src="${escapeAttr(url)}" alt="${escapeAttr(text || '')}">`;
      }
    }
  });
  container.innerHTML = `<article class="read-view">${await marked.parse(content)}</article>`;
  container.querySelectorAll<HTMLImageElement>('img.read-img').forEach((img) => {
    img.addEventListener('click', () => img.classList.toggle('expanded'));
  });
}

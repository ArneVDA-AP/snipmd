// Read mode (Ctrl+E). Phase 1 adds sanitizing; raw HTML in a note still passes through here.
import { Marked } from 'marked';
import { cachedUrl, ensureResolved, imageLinksIn } from '../editor/imageWidget';
import { filePathFor } from '../editor/registry';

const escapeAttr = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function renderRead(container: HTMLElement, tabId: string, content: string): Promise<void> {
  await Promise.all(imageLinksIn(content).map((rel) => ensureResolved(tabId, rel)));
  const filePath = filePathFor(tabId);
  const marked = new Marked({
    renderer: {
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

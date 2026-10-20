// Read mode (Ctrl+E). Every note is untrusted: marked's output is sanitized before it reaches innerHTML (SPEC §8).
import { Marked } from 'marked';
import DOMPurify, { type Config } from 'dompurify';
import { cachedUrl, ensureResolved } from '../editor/imageWidget';
import { filePathFor } from '../editor/registry';
import { isWebUrl } from '../paths';
import { openLink } from '../ipc';
import { showError } from '../infobar';

const escapeAttr = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const SAFE_LINK = /^(?:mailto:|#)/i;

const purify = DOMPurify(window);
purify.addHook('afterSanitizeAttributes', (node) => {
  // Only web images survive here; the note's own images get their src after sanitizing.
  if (node.tagName === 'IMG') {
    if (!isWebUrl(node.getAttribute('src') ?? '') && !node.hasAttribute('data-own')) node.remove();
    return;
  }
  node.removeAttribute('src');
  const href = node.getAttribute('href')?.trim();
  if (href !== undefined && !isWebUrl(href) && !SAFE_LINK.test(href)) node.removeAttribute('href');
});

const SANITIZE: Config & { RETURN_DOM_FRAGMENT: true } = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['style', 'form'],
  FORBID_ATTR: ['style', 'id', 'srcset', 'poster', 'background', 'action', 'formaction'],
  RETURN_DOM_FRAGMENT: true
};

/**
 * Renders a note into `container`. Images the app resolved through Rust are emitted without a
 * src and filled in after sanitizing, so no URL a note wrote itself can pass as one of them.
 */
export async function renderRead(container: HTMLElement, tabId: string, content: string): Promise<void> {
  const filePath = filePathFor(tabId);
  const own: string[] = [];
  const marked = new Marked({
    async: true,
    // Resolve exactly the images marked will render (not ones inside code blocks).
    walkTokens: async (token) => {
      if (token.type === 'image') await ensureResolved(tabId, token.href.trim()).catch(() => '');
    },
    renderer: {
      // Own renderer: marked's default would encodeURI the asset URL a second time.
      image({ href, text }) {
        const url = cachedUrl(filePath, (href || '').trim());
        const alt = escapeAttr(text || '');
        if (!url) return '';
        if (isWebUrl(url)) return `<img class="read-img" src="${escapeAttr(url)}" alt="${alt}">`;
        own.push(url);
        return `<img class="read-img" data-own="${own.length - 1}" alt="${alt}">`;
      }
    }
  });
  const article = document.createElement('article');
  article.className = 'read-view';
  article.append(purify.sanitize(await marked.parse(content), SANITIZE));
  article.querySelectorAll<HTMLImageElement>('img[data-own]').forEach((img) => {
    const url = own[Number(img.dataset.own)];
    if (url === undefined) img.remove();
    else img.src = url;
  });
  // One listener per render. The webview never navigates away (Rust guards that); web and mail
  // links open outside the app.
  article.addEventListener('click', (e) => {
    const target = e.target as Element;
    const img = target.closest('img.read-img');
    if (img) img.classList.toggle('expanded');
    const href = target.closest('a[href]')?.getAttribute('href');
    if (!href || href.startsWith('#')) return;
    e.preventDefault();
    openLink(href).catch((err) => showError('Open link', err));
  });
  container.replaceChildren(article);
}

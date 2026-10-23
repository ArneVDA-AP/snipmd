// Read mode (Ctrl+E). Every note is untrusted: marked's output is sanitized before it reaches innerHTML (SPEC §8).
import { Marked } from 'marked';
import DOMPurify, { type Config } from 'dompurify';
import { cachedUrl, ensureResolved } from '../editor/imageWidget';
import { isWebUrl } from '../paths';
import { openLink } from '../ipc';
import { showError, showInfo } from '../infobar';
import { button } from '../dom';
import { applyToTab, getState } from '../editor/registry';
import { highlightCode } from '../editor/codeLanguages';
import { taskChange } from './tasks';
import type { Settings } from '../types';
import type { Text } from '@codemirror/state';

const escapeAttr = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const SAFE_LINK = /^(?:mailto:|#)/i;

const purify = DOMPurify(window);
purify.addHook('afterSanitizeAttributes', (node) => {
  // Only web images survive here; the note's own images get their src after sanitizing.
  // A note keeps no classes: the app's CSS is not scoped, so a class could draw a fake info bar.
  // The only class kept is the one the app's own image renderer sets.
  if (node.hasAttribute('class') && !(node.tagName === 'IMG' && node.getAttribute('class') === 'read-img')) {
    node.removeAttribute('class');
  }
  if (node.tagName === 'IMG') {
    // A data-own image never keeps a src from the note: it gets one only from own[] after sanitizing.
    if (node.hasAttribute('data-own')) node.removeAttribute('src');
    else if (!isWebUrl(node.getAttribute('src') ?? '')) node.remove();
    return;
  }
  node.removeAttribute('src');
  const href = node.getAttribute('href')?.trim();
  if (href !== undefined && !isWebUrl(href) && !SAFE_LINK.test(href)) node.removeAttribute('href');
});

const SANITIZE: Config & { RETURN_DOM_FRAGMENT: true } = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['style', 'form'],
  FORBID_ATTR: ['style', 'id', 'srcset', 'poster', 'background', 'action', 'formaction', 'role'],
  // No data-* from a note: data-tauri-drag-region would turn read-mode text into a window drag area.
  ALLOW_DATA_ATTR: false,
  // No role or aria-* from a note: it could make a screen reader announce its text as an app alert.
  ALLOW_ARIA_ATTR: false,
  // The app's own marks: images it resolves (filled in after sanitizing), and code blocks and task boxes
  // it renders, which carry a per-render token (a note's own copy of the attribute is removed afterwards).
  ADD_ATTR: ['data-own', 'data-code', 'data-task'],
  RETURN_DOM_FRAGMENT: true
};

/**
 * The elements the app rendered itself: their attribute starts with this render's token, which a note
 * cannot know. The attribute is removed from every other element.
 */
function appElements<T extends HTMLElement>(root: HTMLElement, attr: string, token: string): { el: T; index: number }[] {
  const mine: { el: T; index: number }[] = [];
  root.querySelectorAll<T>(`[${attr}]`).forEach((el) => {
    const v = el.getAttribute(attr) ?? '';
    const index = v.startsWith(`${token}-`) ? Number(v.slice(token.length + 1)) : NaN;
    if (Number.isInteger(index)) mine.push({ el, index });
    else el.removeAttribute(attr);
  });
  return mine;
}

function copyButton(text: string): HTMLButtonElement {
  const b = button('code-copy', 'Copy', 'Copy code', () => {
    navigator.clipboard.writeText(text).then(
      () => {
        b.textContent = 'Copied';
        setTimeout(() => (b.textContent = 'Copy'), 1500);
      },
      (err) => showError('copy the code', err)
    );
  });
  return b;
}

/**
 * A click on a task box: write the change into the note of this tab, or put the box back. `shown`
 * holds the document the boxes were rendered from: a note that changed since (a reload from disk
 * the pane has not shown yet) may have its tasks in another order, so it is never written from
 * these boxes. Every edit makes a new document, so comparing the two is one check.
 */
function toggleTask(tabId: string, box: HTMLInputElement, index: number, rendered: number, shown: { doc: Text | undefined }): void {
  const before = !box.checked; // the click has already flipped it
  const state = getState(tabId);
  const changes = state && state.doc === shown.doc ? taskChange(state, index, rendered, !before) : null;
  if (changes && applyToTab(tabId, { changes, userEvent: 'input' })) {
    shown.doc = getState(tabId)?.doc;
    return;
  }
  box.checked = before;
  showInfo({
    kind: 'warning',
    key: `task:${tabId}`,
    text: 'This checkbox did not match a task in the note, so nothing changed. Edit it in writing (Ctrl+E).'
  });
}

/**
 * Renders a note as an `<article>` for the read pane. Images the app resolved through Rust are
 * emitted without a src and filled in after sanitizing, so no URL a note wrote itself can pass as one of them.
 */
export async function renderRead(tabId: string, content: string, opts: Readonly<Settings>): Promise<HTMLElement> {
  // The document `content` was taken from, read before the first await: task clicks check it.
  const doc = getState(tabId)?.doc;
  const own: string[] = [];
  const token = crypto.randomUUID();
  const codes: { lang: string; text: string }[] = [];
  let tasks = 0;
  const marked = new Marked({
    async: true,
    breaks: opts.lineBreaks, // a single line break as a break (SPEC §4 toggle); off is CommonMark
    // Resolve exactly the images marked will render (not ones inside code blocks).
    walkTokens: async (token) => {
      if (token.type === 'image') await ensureResolved(tabId, token.href.trim());
    },
    renderer: {
      code({ text, lang }) {
        const info = (lang ?? '').trim().split(/\s+/)[0];
        codes.push({ lang: info, text });
        return `<pre><code data-code="${token}-${codes.length - 1}">${escapeAttr(text)}</code></pre>\n`;
      },
      checkbox({ checked }) {
        return `<input type="checkbox" data-task="${token}-${tasks++}" disabled${checked ? ' checked' : ''}> `;
      },
      // Own renderer: marked's default would encodeURI the asset URL a second time.
      image({ href, text }) {
        const url = cachedUrl(tabId, (href || '').trim());
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
  const appCode = appElements<HTMLElement>(article, 'data-code', token);
  const appTasks = appElements<HTMLInputElement>(article, 'data-task', token);
  appCode.forEach(({ el: code, index }) => {
    const { lang, text } = codes[index];
    // Highlighting is cosmetic: a failure leaves the block plain.
    if (lang) highlightCode(code, text, lang).catch(() => {});
    if (opts.copyCode) code.parentElement?.append(copyButton(text));
  });
  if (opts.taskClicks) {
    const shown = { doc };
    appTasks.forEach(({ el: box, index }) => {
      box.disabled = false;
      // `tasks` is how many boxes marked rendered; a box the sanitizer dropped makes the count differ, so a click refuses.
      box.addEventListener('click', () => toggleTask(tabId, box, index, tasks, shown));
    });
  }
  // One listener per render. The webview never navigates away (Rust guards that); web and mail
  // links open outside the app.
  article.addEventListener('click', (e) => {
    const target = e.target as Element;
    if (target.closest('.code-copy, input')) return; // the app's own controls, also inside a note's link
    const img = target.closest('img.read-img');
    if (img) img.classList.toggle('expanded');
    const href = target.closest('a[href]')?.getAttribute('href');
    if (!href || href.startsWith('#')) return;
    e.preventDefault();
    openLink(href).catch((err) => showError('open the link', err));
  });
  // A middle-click on a link would ask the webview for a new window; links only open through openLink.
  article.addEventListener('auxclick', (e) => {
    if ((e.target as Element).closest('a')) e.preventDefault();
  });
  return article;
}

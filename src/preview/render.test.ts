import { describe, it, expect, vi } from 'vitest';

const OWN_URL = vi.hoisted(() => 'http://asset.localhost/C%3A%2Fnotes%2Fa.assets%2Fown.png');

// Same policy as the real cachedUrl: web URLs pass, own.png stands for an image Rust resolved.
vi.mock('../editor/imageWidget', async () => {
  const { isWebUrl } = await vi.importActual<typeof import('../paths')>('../paths');
  return {
    ensureResolved: vi.fn(async () => ''),
    cachedUrl: (_f: string | null, href: string) => (href === 'own.png' ? OWN_URL : isWebUrl(href) ? href : undefined)
  };
});
const reg = vi.hoisted(() => ({ state: undefined as unknown, applyToTab: vi.fn(() => true) }));
vi.mock('../editor/registry', async (importActual) => ({
  ...(await importActual<typeof import('../editor/registry')>()),
  filePathFor: () => 'C:/notes/a.md',
  getState: () => reg.state,
  applyToTab: reg.applyToTab
}));
const highlightCode = vi.hoisted(() => vi.fn(async () => true));
vi.mock('../editor/codeLanguages', () => ({ highlightCode, codeParser: () => null, CODE_LANGUAGES: [] }));
const info = vi.hoisted(() => ({ showInfo: vi.fn(), showError: vi.fn() }));
vi.mock('../infobar', () => info);
const openLink = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../ipc', () => ({ openLink }));

import { renderRead } from './render';
import { ensureResolved } from '../editor/imageWidget';
import { parseSettings } from '../settings';
import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';

// The registry's states carry the Markdown language; the full editor setup is not needed for a task lookup.
const createEditorState = (_tab: string, doc: string): EditorState => EditorState.create({ doc, extensions: [markdown({ base: markdownLanguage })] });

async function render(md: string, settings: Record<string, boolean> = {}): Promise<HTMLElement> {
  const el = document.createElement('div');
  el.append(await renderRead('t1', md, parseSettings(settings)));
  return el;
}

describe('line breaks', () => {
  it('joins the lines of a paragraph by default, as CommonMark does', async () => {
    const el = await render('een\ntwee');
    expect(el.querySelector('br')).toBeNull();
  });

  it('shows a single line break as a break with the toggle on', async () => {
    const el = await render('een\ntwee', { lineBreaks: true });
    expect(el.querySelector('p br')).not.toBeNull();
  });
});

describe('renderRead sanitizing', () => {
  it('drops data-* attributes a note writes (no drag regions, no borrowed state)', async () => {
    const el = await render('<div data-tauri-drag-region class="x" data-foo="1">y</div>');
    expect(el.querySelector('[data-tauri-drag-region]')).toBeNull();
    expect(el.innerHTML).not.toContain('data-foo');
    expect(el.textContent).toContain('y');
  });

  it('drops classes a note writes, so it cannot draw a fake info bar', async () => {
    const el = await render('<p class="infobar error">fake</p>\n\n```js\nx\n```');
    expect(el.querySelector('[class*="infobar"]')).toBeNull();
    expect(el.querySelector('code')!.hasAttribute('class')).toBe(false);
  });

  it('drops role and aria-* a note writes', async () => {
    const el = await render('<div role="alert" aria-label="Error">r</div>');
    expect(el.querySelector('[role], [aria-label]')).toBeNull();
    expect(el.textContent).toContain('r');
  });

  it('a middle-click on a link does nothing in the webview', async () => {
    const el = await render('[x](https://example.org)');
    const e = new MouseEvent('auxclick', { button: 1, bubbles: true, cancelable: true });
    el.querySelector('a')!.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });

  it('drops onerror handlers', async () => {
    const el = await render('<img src=x onerror=alert(1)>');
    expect(el.innerHTML).not.toContain('onerror');
    expect(el.querySelector('img')).toBeNull();
  });
  it('removes script', async () => {
    const el = await render('<script>alert(1)</script>\n\ntext');
    expect(el.querySelector('script')).toBeNull();
    expect(el.innerHTML).not.toContain('alert(1)');
  });
  it('removes iframe', async () => {
    const el = await render('<iframe src="https://example.com"></iframe>');
    expect(el.querySelector('iframe')).toBeNull();
  });
  it('strips javascript: hrefs', async () => {
    const el = await render('<a href="javascript:alert(1)">x</a>\n\n[y](javascript:alert(2))');
    expect(el.innerHTML).not.toContain('javascript:');
  });
  it('removes svg with onload', async () => {
    const el = await render('<svg onload=alert(1)></svg>');
    expect(el.querySelector('svg')).toBeNull();
    expect(el.innerHTML).not.toContain('onload');
  });
  it('drops data: images', async () => {
    const el = await render('![x](data:image/png;base64,AAAA)');
    expect(el.querySelector('img')).toBeNull();
  });
  it('drops file: images', async () => {
    const el = await render('<img src="file:///C:/Windows/win.ini">');
    expect(el.querySelector('img')).toBeNull();
  });
  it('drops style attributes', async () => {
    const el = await render('<p style="position:fixed">x</p>');
    expect(el.innerHTML).not.toContain('style=');
  });
  it('keeps heading, https link and https image', async () => {
    const el = await render('# Title\n\n[ok](https://example.com)\n\n![pic](https://example.com/a.png)');
    expect(el.querySelector('h1')?.textContent).toBe('Title');
    expect(el.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
    expect(el.querySelector('img')?.getAttribute('src')).toBe('https://example.com/a.png');
  });
  it('keeps mailto and fragment links', async () => {
    const el = await render('[m](mailto:a@b.c) [f](#top)');
    const hrefs = [...el.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['mailto:a@b.c', '#top']);
  });

  it('keeps an image the app resolved, drops asset URLs the note wrote itself', async () => {
    const el = await render(
      '![own](own.png)\n\n' +
        '<img src="http://asset.localhost/C%3A%2FUsers%2Fme%2Fsecret.png">\n\n' +
        '<img src="http://asset.localhost:80/C%3A%2FUsers%2Fme%2Fsecret.png">\n\n' +
        '<img data-own="7" src="http://asset.localhost/C%3A%2Fx.png">\n\n' +
        '![x](asset://localhost/%2Fetc%2Fpasswd)\n\n' +
        '[open](http://asset.localhost/C%3A%2Fx.html)'
    );
    const srcs = [...el.querySelectorAll('img')].map((i) => i.getAttribute('src'));
    expect(srcs).toEqual([OWN_URL]);
    expect(el.querySelector('a')?.hasAttribute('href')).toBe(false);
  });
  it('drops srcset and background, which would load a file past the src check', async () => {
    const el = await render('<img src="https://e.com/a.png" srcset="http://asset.localhost/C%3A%2Fsecret.png 1x">\n\n<table background="http://asset.localhost/C%3A%2Fx.png"><tr><td>t</td></tr></table>');
    expect(el.querySelector('img')?.getAttribute('src')).toBe('https://e.com/a.png');
    expect(el.innerHTML).not.toContain('srcset');
    expect(el.innerHTML).not.toContain('background');
  });

  it('drops style elements and forms: the app\'s CSS is not scoped and nothing is submitted', async () => {
    const el = await render('<style>body{display:none}</style>\n\n<form action="https://e.com"><input name="x"></form>\n\ntext');
    expect(el.querySelector('style, form')).toBeNull();
    expect(el.innerHTML).not.toContain('display:none');
    expect(el.textContent).toContain('text');
  });

  it('keeps only mailto and fragment links among the non-web schemes', async () => {
    const el = await render('[t](tel:123#x) [m](mailto:a@b.c#x) [f](#top)');
    const hrefs = [...el.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual([null, 'mailto:a@b.c#x', '#top']);
  });

  it('keeps its own image class and puts the alt text in as written', async () => {
    const el = await render('![a "quoted" <b>](own.png) ![](https://e.com/a.png)');
    const imgs = [...el.querySelectorAll('img')];
    expect(imgs.map((i) => i.className)).toEqual(['read-img', 'read-img']);
    expect(imgs[0].alt).toBe('a "quoted" <b>');
    expect(imgs[0].getAttribute('onerror')).toBeNull();
    expect(ensureResolved).toHaveBeenCalledWith('t1', 'own.png');
  });

  it('removes src from non-image elements and drops ids', async () => {
    const el = await render('<video src="https://e.com/v.mp4" poster="https://e.com/p.png"></video>\n\n<div id="titlebar">x</div>');
    expect(el.innerHTML).not.toContain('src=');
    expect(el.innerHTML).not.toContain('poster=');
    expect(el.innerHTML).not.toContain('id=');
  });
});

describe('renderRead keeps normal Markdown', () => {
  it('keeps task-list checkboxes, table alignment and list start', async () => {
    const el = await render('- [x] done\n\n| a |\n|:-:|\n| b |\n\n3. three\n4. four');
    expect(el.querySelector('input')?.getAttribute('type')).toBe('checkbox');
    expect(el.querySelector('th')?.getAttribute('align')).toBe('center');
    expect(el.querySelector('ol')?.getAttribute('start')).toBe('3');
  });
});

describe('renderRead links', () => {
  it('opens web links outside the app and leaves fragments alone', async () => {
    const el = await render('[web](https://example.com) [top](#top)');
    const [web, top] = [...el.querySelectorAll('a')];
    const webClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    web.dispatchEvent(webClick);
    expect(webClick.defaultPrevented).toBe(true);
    expect(openLink).toHaveBeenCalledWith('https://example.com');
    const topClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    top.dispatchEvent(topClick);
    expect(topClick.defaultPrevented).toBe(false);
    expect(openLink).toHaveBeenCalledTimes(1);
  });
});

describe('app controls only on app elements', () => {
  it('a note cannot forge a Copy button, a live box or the attributes', async () => {
    const el = await render(
      '<pre><code data-code="forged-0">x</code></pre>\n\n<input type="checkbox" data-task="forged-0">',
      { copyCode: true, taskClicks: true }
    );
    expect(el.querySelector('.code-copy')).toBeNull();
    expect(el.querySelector('[data-code], [data-task]')).toBeNull();
    const box = el.querySelector<HTMLInputElement>('input')!;
    box.click();
    expect(reg.applyToTab).not.toHaveBeenCalled();
  });
});

describe('code blocks', () => {
  it('has a Copy button with copyCode and none without', async () => {
    const md = '```js\nlet a = 1;\n```';
    expect((await render(md, { copyCode: true })).querySelectorAll('pre .code-copy')).toHaveLength(1);
    expect((await render(md, { copyCode: false })).querySelector('.code-copy')).toBeNull();
  });

  it('copies the raw text and says Copied', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const el = await render('```\na < b\n```', { copyCode: true });
    const b = el.querySelector<HTMLButtonElement>('.code-copy')!;
    b.click();
    expect(writeText).toHaveBeenCalledWith('a < b');
    await vi.waitFor(() => expect(b.textContent).toBe('Copied'));
  });

  it('reports a failed copy through the info bar', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => Promise.reject(new Error('no')) }, configurable: true });
    const el = await render('```\nx\n```', { copyCode: true });
    el.querySelector<HTMLButtonElement>('.code-copy')!.click();
    await vi.waitFor(() => expect(info.showError).toHaveBeenCalledWith('copy the code', expect.any(Error)));
  });

  it('highlights each fenced block with a language once, and leaves one without alone', async () => {
    highlightCode.mockClear();
    const el = await render('```js\nlet a;\n```\n\n```py\nb = 1\n```\n\n```\nplain\n```');
    expect(highlightCode).toHaveBeenCalledTimes(2);
    expect(highlightCode.mock.calls.map((c) => [(c as unknown[])[1], (c as unknown[])[2]])).toEqual([
      ['let a;', 'js'],
      ['b = 1', 'py']
    ]);
    expect(el.querySelectorAll('pre')).toHaveLength(3);
  });

  it('keeps the block plain when highlighting rejects', async () => {
    highlightCode.mockRejectedValueOnce(new Error('x'));
    const el = await render('```js\nlet a;\n```');
    expect(el.querySelector('code')!.textContent).toBe('let a;');
  });
});

describe('task boxes', () => {
  const md = '- [ ] a\n- [x] b';

  it('are enabled only with taskClicks', async () => {
    expect([...(await render(md, { taskClicks: true })).querySelectorAll('input')].map((i) => i.disabled)).toEqual([false, false]);
    expect([...(await render(md, { taskClicks: false })).querySelectorAll('input')].map((i) => i.disabled)).toEqual([true, true]);
  });

  it('a click on a matching task changes the note of its tab', async () => {
    reg.state = createEditorState('t1', md);
    reg.applyToTab.mockClear();
    const el = await render(md, { taskClicks: true });
    el.querySelectorAll<HTMLInputElement>('input')[0].click();
    await vi.waitFor(() => expect(reg.applyToTab).toHaveBeenCalledWith('t1', { changes: { from: 3, to: 4, insert: 'x' }, userEvent: 'input' }));
  });

  it('puts the box back and shows a warning when the note no longer matches', async () => {
    reg.state = createEditorState('t1', '- [ ] a');
    reg.applyToTab.mockClear();
    info.showInfo.mockClear();
    const el = await render(md, { taskClicks: true });
    const box = el.querySelectorAll<HTMLInputElement>('input')[1];
    box.click();
    await vi.waitFor(() => expect(info.showInfo).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning', key: 'task:t1' })));
    expect(box.checked).toBe(true);
    expect(reg.applyToTab).not.toHaveBeenCalled();
  });
  it('writes nothing when the note changed since it was rendered, even with the same tasks reordered', async () => {
    reg.state = createEditorState('t1', '- [ ] pay rent\n- [ ] buy milk'); // reloaded from disk meanwhile
    reg.applyToTab.mockClear();
    info.showInfo.mockClear();
    const el = await render('- [ ] buy milk\n- [ ] pay rent', { taskClicks: true });
    el.querySelectorAll<HTMLInputElement>('input')[0].click();
    await vi.waitFor(() => expect(info.showInfo).toHaveBeenCalledWith(expect.objectContaining({ kind: 'warning' })));
    expect(reg.applyToTab).not.toHaveBeenCalled();
  });

  it('a second click after a written one still matches the note', async () => {
    reg.state = createEditorState('t1', md);
    reg.applyToTab.mockClear();
    reg.applyToTab.mockImplementation(((_id: string, spec: { changes: never }) => {
      reg.state = (reg.state as EditorState).update(spec).state;
      return true;
    }) as never);
    const el = await render(md, { taskClicks: true });
    const boxes = el.querySelectorAll<HTMLInputElement>('input');
    boxes[0].click();
    await vi.waitFor(() => expect(reg.applyToTab).toHaveBeenCalledTimes(1));
    boxes[1].click();
    await vi.waitFor(() => expect(reg.applyToTab).toHaveBeenCalledTimes(2));
    expect((reg.state as EditorState).doc.toString()).toBe('- [x] a\n- [ ] b');
    reg.applyToTab.mockImplementation(() => true);
  });
});

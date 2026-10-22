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
vi.mock('../editor/registry', () => ({ filePathFor: () => 'C:/notes/a.md' }));
const openLink = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../ipc', () => ({ openLink }));

import { renderRead } from './render';
import { ensureResolved } from '../editor/imageWidget';

async function render(md: string): Promise<HTMLElement> {
  const el = document.createElement('div');
  el.append(await renderRead('t1', md));
  return el;
}

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

import { describe, expect, it, vi } from 'vitest';
const S = '/home/user/snipmd/src';
vi.mock('/home/user/snipmd/src/editor/imageWidget', () => ({ ensureResolved: vi.fn(async () => ''), cachedUrl: () => undefined }));
const reg = vi.hoisted(() => ({ state: undefined as unknown, applyToTab: vi.fn(() => true) }));
vi.mock('/home/user/snipmd/src/editor/registry', async (a) => ({ ...(await a<any>()), getState: () => reg.state, applyToTab: reg.applyToTab }));
vi.mock('/home/user/snipmd/src/editor/codeLanguages', () => ({ highlightCode: async () => true, codeParser: () => null, CODE_LANGUAGES: [] }));
const info = vi.hoisted(() => ({ showInfo: vi.fn(), showError: vi.fn() }));
vi.mock('/home/user/snipmd/src/infobar', () => info);
vi.mock('/home/user/snipmd/src/ipc', () => ({ openLink: vi.fn() }));
import { renderRead } from '/home/user/snipmd/src/preview/render';
import { parseSettings } from '/home/user/snipmd/src/settings';
import { EditorState } from '/home/user/snipmd/node_modules/@codemirror/state/dist/index.js';
import { markdown, markdownLanguage } from '/home/user/snipmd/node_modules/@codemirror/lang-markdown/dist/index.js';
const st = (doc: string) => EditorState.create({ doc, extensions: [markdown({ base: markdownLanguage })] });

describe('probe: read pane rendered before an external reload reordered the tasks', () => {
  it('a click on "buy milk" writes [x] into "pay rent"', async () => {
    const el = await renderRead('t1', '- [ ] buy milk\n- [ ] pay rent', parseSettings({ taskClicks: true }));
    document.body.append(el);
    reg.state = st('- [ ] pay rent\n- [ ] buy milk'); // loadText applied the file; the read pane was not redrawn
    const box = el.querySelectorAll('input')[0];
    console.log('clicked box label:', box.parentElement!.textContent!.trim());
    box.click();
    await vi.waitFor(() => expect(reg.applyToTab).toHaveBeenCalled());
    const spec = (reg.applyToTab.mock.calls[0] as any)[1];
    const after = (reg.state as EditorState).update(spec).state.doc.toString();
    console.log('note after the click:', JSON.stringify(after));
    expect(info.showInfo).not.toHaveBeenCalled();
  });
  it('a note can hide an app checkbox, and the remaining boxes keep their position index, not their render index', async () => {
    const el = await renderRead('t1', '- [ ] a\n\n<textarea>\n\n- [ ] b\n\n</textarea>\n\n- [ ] c', parseSettings({ taskClicks: true }));
    console.log('live boxes:', el.querySelectorAll('input[type=checkbox]').length, 'html:', el.innerHTML.replace(/\s+/g,' ').slice(0,400));
  });
});

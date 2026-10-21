import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TabState } from './types';

vi.mock('./ipc', () => ({
  defaultNoteFolder: vi.fn(),
  pickFolder: vi.fn(),
  noteNameFree: vi.fn(),
}));
vi.mock('./tabs', () => ({ getLastFolder: vi.fn(), getTab: (id: string) => ({ id }) }));

import { askFirstSave, type FirstSaveChoice } from './firstSaveBar';
import { mountInfobar } from './infobar';
import { defaultNoteFolder, noteNameFree, pickFolder } from './ipc';
import { getLastFolder } from './tabs';

const tab = { id: 't1' } as TabState;
let top: HTMLElement;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};
const input = (): HTMLInputElement => top.querySelector('input') as HTMLInputElement;
const btn = (label: string): HTMLButtonElement => top.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;
const type = async (v: string): Promise<void> => {
  input().value = v;
  input().dispatchEvent(new Event('input'));
  await flush();
};
const key = (k: string): void => {
  input().dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
};

async function open(text: string): Promise<{ p: Promise<FirstSaveChoice> }> {
  const p = askFirstSave(tab, text);
  await flush();
  return { p };
}

beforeEach(() => {
  top = document.createElement('div');
  mountInfobar(top, document.createElement('div'), () => {});
  vi.mocked(getLastFolder).mockReturnValue('C:/Notes/Work');
  vi.mocked(defaultNoteFolder).mockResolvedValue('C:/Users/me/Documents/SnipMD');
  vi.mocked(noteNameFree).mockResolvedValue(true);
  vi.mocked(pickFolder).mockResolvedValue(null);
});
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('first-save bar', () => {
  it('slugifies the first heading', async () => {
    await open('intro\n# DHCP-probleem lokaal B\n');
    expect(input().value).toBe('dhcp-probleem-lokaal-b.md');
  });

  it('skips # comments inside fenced code', async () => {
    await open('```sh\n# install\napt install x\n```\n## Real title\n');
    expect(input().value).toBe('real-title.md');
    await open('~~~\n# not this\n');
    expect(input().value).toMatch(/^note-\d{8}\.md$/);
  });

  it('adds .md to a name typed without it', async () => {
    const { p } = await open('# Plan');
    await type('meeting');
    expect(noteNameFree).toHaveBeenLastCalledWith('C:/Notes/Work', 'meeting.md');
    key('Enter');
    await expect(p).resolves.toEqual({ folder: 'C:/Notes/Work', name: 'meeting.md' });
  });

  it('removes accents', async () => {
    await open('# Café ölçü');
    expect(input().value).toBe('cafe-olcu.md');
  });

  it('falls back to a dated name', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 2, 5, 10, 0, 0));
    await open('no heading here');
    expect(input().value).toBe('note-20260305.md');
  });

  it('uses the last folder, else the default one', async () => {
    await open('x');
    expect(btn('Choose folder').textContent).toBe('Work ›');
    expect(defaultNoteFolder).not.toHaveBeenCalled();
    vi.mocked(getLastFolder).mockReturnValue(null);
    await open('x');
    expect(btn('Choose folder').textContent).toBe('SnipMD ›');
  });

  it('marks a taken name and disables Save', async () => {
    vi.mocked(noteNameFree).mockResolvedValue(false);
    await open('# A');
    expect(input().classList.contains('taken')).toBe(true);
    expect(btn('Save').disabled).toBe(true);
  });

  it('ignores an older answer that arrives late', async () => {
    await open('# A');
    const resolvers: Array<(v: boolean) => void> = [];
    vi.mocked(noteNameFree).mockImplementation(() => new Promise((r) => resolvers.push(r)));
    await type('first.md');
    await type('second.md');
    resolvers[1](true);
    await flush();
    resolvers[0](false);
    await flush();
    expect(input().classList.contains('taken')).toBe(false);
    expect(btn('Save').disabled).toBe(false);
  });

  it('Enter resolves folder and name, and the bar is gone', async () => {
    const { p } = await open('# Plan');
    key('Enter');
    await expect(p).resolves.toEqual({ folder: 'C:/Notes/Work', name: 'plan.md' });
    expect(top.children.length).toBe(0);
  });

  it('Enter does nothing while the name is taken', async () => {
    vi.mocked(noteNameFree).mockResolvedValue(false);
    const { p } = await open('# Plan');
    key('Enter');
    key('Escape');
    await expect(p).resolves.toBeNull();
  });

  it('Esc resolves null', async () => {
    const { p } = await open('# Plan');
    key('Escape');
    await expect(p).resolves.toBeNull();
    expect(top.children.length).toBe(0);
  });

  it('the dismiss button resolves null', async () => {
    const { p } = await open('# Plan');
    btn('Dismiss').click();
    await expect(p).resolves.toBeNull();
    expect(top.children.length).toBe(0);
  });

  it('Other folder… resolves other', async () => {
    const { p } = await open('# Plan');
    btn('Other folder').click();
    await expect(p).resolves.toBe('other');
    expect(top.children.length).toBe(0);
  });

  it('a picked folder updates the button and re-checks the name', async () => {
    const { p } = await open('# Plan');
    vi.mocked(pickFolder).mockResolvedValue('D:/Other/Docs');
    vi.mocked(noteNameFree).mockClear();
    btn('Choose folder').click();
    await flush();
    expect(btn('Choose folder').textContent).toBe('Docs ›');
    expect(noteNameFree).toHaveBeenCalledWith('D:/Other/Docs', 'plan.md');
    key('Enter');
    await expect(p).resolves.toEqual({ folder: 'D:/Other/Docs', name: 'plan.md' });
  });

  it('keeps the old folder when the picker is cancelled', async () => {
    await open('# Plan');
    btn('Choose folder').click();
    await flush();
    expect(btn('Choose folder').textContent).toBe('Work ›');
  });
});

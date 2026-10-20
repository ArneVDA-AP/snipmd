import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  importImage: vi.fn(),
  insertSnip: vi.fn(),
  openPaths: vi.fn(),
  visible: { id: 'a' as string | null },
  posAtCoords: vi.fn(),
  mode: { v: 'edit' },
  showError: vi.fn(),
  save: vi.fn()
}));
vi.mock('./ipc', () => ({ importImage: m.importImage }));
vi.mock('./tabs', () => ({
  getTab: () => ({ mode: m.mode.v }),
  openPaths: m.openPaths
}));
vi.mock('./editor/paste', () => ({ insertSnip: m.insertSnip }));
vi.mock('./editor/registry', () => ({
  visibleTabId: () => m.visible.id,
  getView: () => ({ posAtCoords: m.posAtCoords }),
  filePathFor: () => 'C:/n/x.md'
}));
vi.mock('./session', () => ({ scheduleSessionSave: m.save }));
vi.mock('./infobar', () => ({ showError: m.showError }));

import { handleDrop } from './drop';

const drop = (images: string[], notes: string[] = []) => ({ notes, images, x: 300, y: 150 });

beforeEach(() => {
  vi.clearAllMocks();
  m.visible.id = 'a';
  m.mode.v = 'edit';
  m.posAtCoords.mockReturnValue(42);
  m.importImage.mockImplementation(async (_t, _p, src: string) => ({ link: `l/${src}`, absPath: src }));
  vi.stubGlobal('devicePixelRatio', 1.5);
});

describe('handleDrop', () => {
  it('sends notes to openPaths', async () => {
    await handleDrop(drop([], ['C:/a.md']));
    expect(m.openPaths).toHaveBeenCalledWith(['C:/a.md']);
    expect(m.importImage).not.toHaveBeenCalled();
  });

  it('inserts into the tab visible at drop time even when openPaths switches tabs', async () => {
    m.openPaths.mockImplementation(async () => void (m.visible.id = 'b'));
    await handleDrop(drop(['C:/p.png'], ['C:/a.md']));
    expect(m.importImage).toHaveBeenCalledWith('a', 'C:/n/x.md', 'C:/p.png');
    expect(m.insertSnip).toHaveBeenCalledWith('a', 'l/C:/p.png', 42);
  });

  it('first link uses the point divided by devicePixelRatio, each next one the end of the previous link', async () => {
    m.insertSnip.mockReturnValueOnce(60).mockReturnValueOnce(80);
    await handleDrop(drop(['1.png', '2.png', '3.png']));
    expect(m.posAtCoords).toHaveBeenCalledWith({ x: 200, y: 100 });
    expect(m.insertSnip.mock.calls).toEqual([
      ['a', 'l/1.png', 42],
      ['a', 'l/2.png', 60],
      ['a', 'l/3.png', 80]
    ]);
    expect(m.save).toHaveBeenCalledWith({ immediate: true });
  });

  it('uses the cursor in read mode', async () => {
    m.mode.v = 'read';
    await handleDrop(drop(['1.png']));
    expect(m.insertSnip).toHaveBeenCalledWith('a', 'l/1.png', undefined);
  });

  it('uses the cursor when the point is outside the text', async () => {
    m.posAtCoords.mockReturnValue(null);
    await handleDrop(drop(['1.png']));
    expect(m.insertSnip).toHaveBeenCalledWith('a', 'l/1.png', undefined);
  });

  it('one failed import inserts the others in order and shows one error naming the file', async () => {
    m.importImage.mockImplementation(async (_t, _p, src: string) => {
      if (src.endsWith('2.png')) throw new Error('disk full');
      return { link: `l/${src}`, absPath: src };
    });
    await handleDrop(drop(['C:/x/1.png', 'C:/x/2.png', 'C:/x/3.png']));
    expect(m.insertSnip.mock.calls.map((c) => c[1])).toEqual(['l/C:/x/1.png', 'l/C:/x/3.png']);
    expect(m.showError).toHaveBeenCalledTimes(1);
    expect(m.showError.mock.calls[0][0]).toBe('add 2.png');
    expect(String(m.showError.mock.calls[0][1])).toContain('disk full');
  });

  it('no images means no insert and no session save', async () => {
    await handleDrop(drop([], ['C:/a.md']));
    expect(m.insertSnip).not.toHaveBeenCalled();
    expect(m.save).not.toHaveBeenCalled();
  });
});

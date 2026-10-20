import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  importImage: vi.fn(),
  placeImages: vi.fn(),
  openPaths: vi.fn(),
  visible: { id: 'a' as string | null },
  posAtCoords: vi.fn(),
  mode: { v: 'edit' },
  showError: vi.fn()
}));
vi.mock('./ipc', () => ({ importImage: m.importImage }));
vi.mock('./tabs', () => ({
  getTab: () => ({ mode: m.mode.v }),
  openPaths: m.openPaths
}));
vi.mock('./editor/paste', () => ({ placeImages: m.placeImages }));
vi.mock('./editor/registry', () => ({
  visibleTabId: () => m.visible.id,
  getView: () => ({ posAtCoords: m.posAtCoords }),
  filePathFor: () => 'C:/n/x.md'
}));
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
    expect(m.placeImages).toHaveBeenCalledWith('a', [{ link: 'l/C:/p.png', absPath: 'C:/p.png' }], 42);
  });

  it('places all images in drop order at the point divided by devicePixelRatio', async () => {
    await handleDrop(drop(['1.png', '2.png', '3.png']));
    expect(m.posAtCoords).toHaveBeenCalledWith({ x: 200, y: 100 });
    expect(m.placeImages).toHaveBeenCalledTimes(1);
    expect(m.placeImages.mock.calls[0][1].map((i: { link: string }) => i.link)).toEqual(['l/1.png', 'l/2.png', 'l/3.png']);
    expect(m.placeImages.mock.calls[0][2]).toBe(42);
  });

  it('uses the cursor in read mode', async () => {
    m.mode.v = 'read';
    await handleDrop(drop(['1.png']));
    expect(m.placeImages.mock.calls[0][2]).toBeUndefined();
  });

  it('uses the cursor when the point is outside the text', async () => {
    m.posAtCoords.mockReturnValue(null);
    await handleDrop(drop(['1.png']));
    expect(m.placeImages.mock.calls[0][2]).toBeUndefined();
  });

  it('one failed import inserts the others in order and shows one error naming the file', async () => {
    m.importImage.mockImplementation(async (_t, _p, src: string) => {
      if (src.endsWith('2.png')) throw new Error('disk full');
      return { link: `l/${src}`, absPath: src };
    });
    await handleDrop(drop(['C:/x/1.png', 'C:/x/2.png', 'C:/x/3.png']));
    expect(m.placeImages.mock.calls[0][1].map((i: { link: string }) => i.link)).toEqual(['l/C:/x/1.png', 'l/C:/x/3.png']);
    expect(m.showError).toHaveBeenCalledTimes(1);
    expect(m.showError.mock.calls[0][0]).toBe('add 2.png');
    expect(String(m.showError.mock.calls[0][1])).toContain('disk full');
  });

  it('no images means nothing is placed', async () => {
    await handleDrop(drop([], ['C:/a.md']));
    expect(m.placeImages).not.toHaveBeenCalled();
  });
});

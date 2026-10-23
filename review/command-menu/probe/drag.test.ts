import { describe, expect, it, vi } from 'vitest';
vi.mock('/home/user/snipmd/src/ipc', () => ({ appWindow: { minimize: vi.fn(), toggleMaximize: vi.fn(), close: vi.fn(), isMaximized: async () => false } }));
import { Titlebar } from '/home/user/snipmd/src/titlebar';
Element.prototype.scrollIntoView ??= function () {};
const h = { select: vi.fn(), open: vi.fn(), close: vi.fn(), newTab: vi.fn(), toggleMode: vi.fn(), move: vi.fn() };
const tab = (id: string) => ({ id, title: `${id}.md`, filePath: `C:/n/${id}.md`, content: '', dirty: false, mode: 'edit', cursor: 0, scrollTop: 0, disk: null, format: null }) as any;
const ptr = (el: EventTarget, type: string, x: number) => {
  const e = new MouseEvent(type, { clientX: x, button: 0, bubbles: true, cancelable: true }) as PointerEvent;
  Object.defineProperties(e, { pointerId: { value: 1 }, isPrimary: { value: true } });
  el.dispatchEvent(e);
};
describe('probe: press on a tab, release outside it without a horizontal move', () => {
  it('leaves the drag armed, so the next real drag of another tab does nothing', () => {
    const root = document.createElement('header'); document.body.append(root);
    const bar = new Titlebar(root, h);
    bar.render([tab('a'), tab('b'), tab('c')], 'a');
    const el = (id: string) => root.querySelector<HTMLElement>(`.tab[data-id="${id}"]`)!;
    ['a', 'b', 'c'].forEach((id, i) => {
      const e = el(id); e.setPointerCapture = vi.fn(); e.releasePointerCapture = vi.fn(); e.hasPointerCapture = () => true;
      e.getBoundingClientRect = () => ({ left: i * 100, right: i * 100 + 100, width: 100, top: 0, bottom: 28, height: 28, x: i * 100, y: 0, toJSON() {} });
    });
    ptr(el('a'), 'pointerdown', 50);
    ptr(document.body, 'pointerup', 50); // released over the editor: the tab never sees it
    ptr(el('c'), 'pointerdown', 250);
    ptr(el('c'), 'pointermove', 20);
    ptr(el('c'), 'pointerup', 20);
    console.log('move calls after dragging c to the left:', h.move.mock.calls.length);
    // hovering tab a later, no button pressed, starts a "drag"
    ptr(el('a'), 'pointermove', 80);
    console.log('a has dragging class on a buttonless hover:', el('a').classList.contains('dragging'));
    ptr(el('a'), 'pointerup', 80); h.select.mockClear();
    el('a').click();
    console.log('select calls for the click that ends it:', h.select.mock.calls.length);
    expect(h.move).not.toHaveBeenCalled();
  });
});

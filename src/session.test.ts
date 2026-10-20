import { describe, expect, it } from 'vitest';
import { parseSession } from './session';

describe('parseSession', () => {
  it('round-trips a v3 session', () => {
    const s = {
      version: 3,
      activeTabId: 'b',
      untitledCounter: 4,
      lastFolder: 'C:/Users/x/Documents/Notes',
      tabs: [
        { id: 'a', title: 'a.md', filePath: 'C:/n/a.md', content: '# a', dirty: false, mode: 'edit', cursor: 2, scrollTop: 10 },
        { id: 'b', title: 'Untitled-3', filePath: null, content: 'x', dirty: true, mode: 'read', cursor: 0, scrollTop: 0 }
      ],
      closedTabs: []
    };
    expect(parseSession(JSON.stringify(s))).toEqual(s);
  });

  it('reads the prototype format', () => {
    const old = {
      version: 2,
      activeTabId: 'missing',
      tabs: [{ id: 't1', title: 'Untitled-1', filePath: null, content: 'hi', dirty: true, mode: 'split', cursorPos: 5 }]
    };
    const s = parseSession(JSON.stringify(old))!;
    expect(s.activeTabId).toBe('t1');
    expect(s.tabs[0]).toMatchObject({ mode: 'edit', cursor: 5, scrollTop: 0 });
    expect(s.untitledCounter).toBe(2);
  });

  it('drops malformed tabs and rejects a session without usable tabs', () => {
    expect(parseSession(null)).toBeNull();
    expect(parseSession('not json')).toBeNull();
    expect(parseSession(JSON.stringify({ tabs: [{ title: 'no id' }, 7, null] }))).toBeNull();
    const s = parseSession(JSON.stringify({ tabs: [{ id: 'ok' }, { title: 'no id' }] }))!;
    expect(s.tabs.map((t) => t.id)).toEqual(['ok']);
  });
});

import { describe, expect, it, vi } from 'vitest';

describe('command registry', () => {
  it('runs a command by id, ignores an unknown id and lists in registration order', async () => {
    vi.resetModules();
    const m = await import('./commands');
    const save = vi.fn();
    m.initCommands([{ id: 'save', title: 'Save', run: save }, { id: 'open', title: 'Open…', run: () => 1 }]);
    m.runCommand('save');
    expect(save).toHaveBeenCalledTimes(1);
    expect(() => m.runCommand('gone')).not.toThrow();
    expect(m.listCommands().map((c) => c.id)).toEqual(['save', 'open']);
  });

  it('throws when used before it is wired, or wired twice', async () => {
    vi.resetModules();
    const m = await import('./commands');
    expect(() => m.runCommand('save')).toThrow();
    m.initCommands([]);
    expect(() => m.initCommands([])).toThrow();
  });
});

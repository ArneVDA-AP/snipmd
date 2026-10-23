import { describe, expect, it, vi } from 'vitest';

describe('settings', () => {
  it('an older session without toggles gets the defaults', async () => {
    const { parseSettings } = await import('./settings');
    expect(parseSettings(undefined)).toEqual({ lineBreaks: false, taskClicks: true, copyCode: true, findCount: true });
  });

  it('keeps known booleans and drops anything else', async () => {
    const { parseSettings } = await import('./settings');
    expect(parseSettings({ lineBreaks: true, taskClicks: 'yes', other: true })).toEqual({ lineBreaks: true, taskClicks: true, copyCode: true, findCount: true });
  });

  it('a toggle flips the value and reports each change', async () => {
    vi.resetModules();
    const m = await import('./settings');
    const onChange = vi.fn();
    m.initSettings(m.parseSettings(undefined), onChange);
    m.toggleSetting('lineBreaks');
    expect(m.getSetting('lineBreaks')).toBe(true);
    expect(m.settingsSnapshot().lineBreaks).toBe(true);
    m.toggleSetting('lineBreaks');
    expect(m.getSetting('lineBreaks')).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('a toggle before the app wired the module throws', async () => {
    vi.resetModules();
    const m = await import('./settings');
    expect(() => m.toggleSetting('copyCode')).toThrow();
  });
});

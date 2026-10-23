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

  it('a change is reported once, and setting the same value reports nothing', async () => {
    vi.resetModules();
    const m = await import('./settings');
    const onChange = vi.fn();
    m.initSettings(m.parseSettings(undefined), onChange);
    m.setSetting('lineBreaks', true);
    m.setSetting('lineBreaks', true);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('lineBreaks');
    expect(m.getSetting('lineBreaks')).toBe(true);
    expect(m.settingsSnapshot().lineBreaks).toBe(true);
  });

  it('setting a value before the app wired the module throws', async () => {
    vi.resetModules();
    const m = await import('./settings');
    expect(() => m.setSetting('copyCode', false)).toThrow();
  });
});

// The command menu's toggles (SPEC §4): their names, defaults and current values. The values
// live in session.json (SPEC §7); this module is their only owner.
import type { SettingKey, Settings } from './types';

export const SETTINGS: Readonly<Record<SettingKey, { title: string; default: boolean }>> = {
  lineBreaks: { title: 'Line breaks in read mode', default: false },
  taskClicks: { title: 'Clickable tasks in read mode', default: true },
  copyCode: { title: 'Copy button on code blocks', default: true },
  findCount: { title: 'Match count in find', default: true },
  pet: { title: 'Show Snip', default: true }
};

const KEYS = Object.keys(SETTINGS) as SettingKey[];

/** Each known key that holds a boolean; the default for anything else (an older session has none). */
export function parseSettings(raw: unknown): Settings {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(KEYS.map((k) => [k, typeof r[k] === 'boolean' ? r[k] : SETTINGS[k].default])) as Settings;
}

let values: Settings = parseSettings(undefined);
let changed: (() => void) | null = null;

/** Wired once from app.ts with the session's values; `onChange` runs after every change. */
export function initSettings(initial: Settings, onChange: () => void): void {
  values = { ...initial };
  changed = onChange;
}

export const getSetting = (key: SettingKey): boolean => values[key];

export const settingsSnapshot = (): Settings => ({ ...values });

export function toggleSetting(key: SettingKey): void {
  if (!changed) throw new Error('settings: initSettings was not called');
  values[key] = !values[key];
  changed();
}

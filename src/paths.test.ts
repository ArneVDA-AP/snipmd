import { describe, it, expect } from 'vitest';
import { isWebUrl, normPath } from './paths';

describe('isWebUrl', () => {
  it('accepts remote http(s) URLs', () => {
    expect(isWebUrl('https://example.com/a.png')).toBe(true);
    expect(isWebUrl('http://example.com')).toBe(true);
  });
  it('refuses app-served hosts however they are spelled', () => {
    for (const u of [
      'http://asset.localhost/C%3A%5Cx.png',
      'http://asset.localhost:80/C%3A%5Cx.png',
      'http://ASSET.localhost./C%3A%5Cx.png',
      'http:\\\\asset.localhost\\C%3A%5Cx.png',
      'http://asset.local\nhost/C%3A%5Cx.png',
      'https://tauri.localhost/',
      'http://ipc.localhost/cmd',
      'asset://localhost/%2Fetc%2Fpasswd',
      'javascript:alert(1)',
      'not a url'
    ]) {
      expect(isWebUrl(u), u).toBe(false);
    }
  });
});

describe('normPath', () => {
  it('keeps a UNC prefix and collapses other duplicate slashes', () => {
    expect(normPath('\\\\srv\\share\\\\n.md')).toBe('//srv/share/n.md');
    expect(normPath('C:\\a\\\\b\\')).toBe('C:/a/b');
  });
});

// The release build's style nonce reaches CodeMirror only through an inline <style> in index.html
// (src/editor/setup.ts). Removing that style would strip the editor's styling in release builds only.
import { describe, expect, it } from 'vitest';
import html from '../index.html?raw';

describe('index.html', () => {
  it('keeps an inline <style>, which carries the style nonce CodeMirror reuses', () => {
    expect(html).toMatch(/<style>[^<]+<\/style>/);
  });
});

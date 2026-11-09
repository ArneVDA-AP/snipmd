// Probe (review of the 1.1.0 RC): how normPath treats path spellings that the RC tests do not try.
// Each expectation records what the RC code does now, so a pass documents the behaviour.
import { describe, expect, it } from 'vitest';
import { normPath, samePath } from '../rc/src/paths';

describe('probe normPath', () => {
  it('drive-relative C:foo\\..\\x.md keeps foo (Windows resolves it to C:x.md)', () => {
    expect(normPath('C:foo\\..\\x.md')).toBe('C:foo/x.md');
  });
  it('a relative path keeps a leading dot segment as its root', () => {
    expect(normPath('./x.md')).toBe('./x.md');
    expect(normPath('notes/../x.md')).toBe('notes/x.md');
  });
  it('extended-length UNC prefix: .. climbs above the share (Windows does not resolve .. under \\\\?\\)', () => {
    expect(normPath('\\\\?\\UNC\\srv\\share\\..\\x.md')).toBe('//?/UNC/srv/x.md');
  });
  it('UNC share clamp: the frontend keeps the share; Rust paths::normalize pops it', () => {
    expect(normPath('\\\\srv\\share\\..\\x.md')).toBe('//srv/share/x.md');
  });
  it('a trailing-dot spelling of the same file is a different path for samePath', () => {
    expect(samePath('C:/n/x.md', 'C:/n/x.md.')).toBe(false);
  });
});

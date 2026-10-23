// Code-block languages (SPEC §5): which names are known and how each parser loads. Stub for the
// command-menu build: unit B2 replaces the bodies, keeping these signatures.
import type { LanguageDescription } from '@codemirror/language';
import type { Parser } from '@lezer/common';

/** The languages SPEC §5 lists, each loaded by a dynamic import on first use. */
export const CODE_LANGUAGES: readonly LanguageDescription[] = [];

/** For `parseCode` in the editor: the parser of a loaded language, a skipping parser that loads it, or null for an unknown name. */
export function codeParser(_info: string): Parser | null {
  return null;
}

/**
 * Read mode: fills `target` with `code` as spans with `tok-*` classes (textContent only) once the
 * language named by `info` has loaded. Resolves false, leaving `target` as it was, for an unknown
 * name or a failed load.
 */
export async function highlightCode(_target: HTMLElement, _code: string, _info: string): Promise<boolean> {
  return false;
}

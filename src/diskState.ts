// Per-tab disk state shared by saving and the external-change watch, so neither imports the other.
// Transient: nothing here goes into the session.

const writing = new Map<string, number>();
/** Bumped at the start and end of every write, so a stat that overlapped one can tell. */
const generation = new Map<string, number>();
const conflicts = new Set<string>();

const bump = (id: string): void => void generation.set(id, (generation.get(id) ?? 0) + 1);

/** Around every note write: a stat taken meanwhile may already see our own write. */
export function beginWrite(id: string): void {
  writing.set(id, (writing.get(id) ?? 0) + 1);
  bump(id);
}

export function endWrite(id: string): void {
  const n = (writing.get(id) ?? 1) - 1;
  if (n > 0) writing.set(id, n);
  else writing.delete(id);
  bump(id);
}

export const isWriting = (id: string): boolean => writing.has(id);

/** Changes whenever a write of the tab starts or ends. */
export const writeGeneration = (id: string): number => generation.get(id) ?? 0;

/** A tab whose file changed outside SnipMD while it had changes: autosave pauses until the user chooses (SPEC §6.1). */
export function setConflict(id: string, on: boolean): void {
  if (on) conflicts.add(id);
  else conflicts.delete(id);
}

export const inConflict = (id: string): boolean => conflicts.has(id);

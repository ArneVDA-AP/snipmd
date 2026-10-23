// The app's commands by id (SPEC §4, §10, §13): keys, the macOS menu bar and the command menu
// all run them through here, so one action has one path.

export interface Command {
  id: string;
  /** The name in the command menu. */
  title: string;
  /** Written the Windows way (`Ctrl+Shift+S`); shown through `keys()`. */
  keys?: string;
  run: () => unknown;
  /** Present on a toggle: the menu shows a check mark and stays open after it runs. */
  checked?: () => boolean;
}

let commands: ReadonlyMap<string, Command> | null = null;

/** Wired once from app.ts. */
export function initCommands(list: readonly Command[]): void {
  if (commands) throw new Error('commands: initCommands was called twice');
  commands = new Map(list.map((c) => [c.id, c]));
}

function registry(): ReadonlyMap<string, Command> {
  if (!commands) throw new Error('commands: initCommands was not called');
  return commands;
}

/** Runs a command; an unknown id (an old menu item) does nothing. */
export function runCommand(id: string): unknown {
  return registry().get(id)?.run();
}

/** Every command, in the order app.ts registered them. */
export const listCommands = (): readonly Command[] => [...registry().values()];

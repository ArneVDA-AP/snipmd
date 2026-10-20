// Info bar (SPEC §4): one bar per position. It shows the newest message; keyed messages (an
// error that lasts until its cause is fixed) wait underneath and come back when the one on top goes.
import type { InfoMessage } from './types';
import { button } from './dom';

type Pos = NonNullable<InfoMessage['position']>;

interface Entry {
  msg: InfoMessage;
  el: HTMLElement | null;
  timer: ReturnType<typeof setTimeout> | null;
}

const hosts: Record<Pos, HTMLElement | null> = { top: null, bottom: null };
const stacks: Record<Pos, Entry[]> = { top: [], bottom: [] };

export function mountInfobar(top: HTMLElement, bottom: HTMLElement): void {
  hosts.top = top;
  hosts.bottom = bottom;
  for (const stack of Object.values(stacks)) {
    for (const e of stack) if (e.timer) clearTimeout(e.timer);
    stack.length = 0;
  }
}

function render(pos: Pos): void {
  const entry = stacks[pos].at(-1);
  if (!entry) {
    hosts[pos]?.replaceChildren();
    return;
  }
  entry.el ??= barFor(pos, entry);
  if (hosts[pos]?.firstElementChild !== entry.el) hosts[pos]?.replaceChildren(entry.el);
}

function remove(pos: Pos, entry: Entry): void {
  const i = stacks[pos].indexOf(entry);
  if (i === -1) return; // already replaced or dismissed
  if (entry.timer) clearTimeout(entry.timer);
  stacks[pos].splice(i, 1);
  render(pos);
}

function barFor(pos: Pos, entry: Entry): HTMLElement {
  const { msg } = entry;
  const dismiss = () => remove(pos, entry);
  const bar = document.createElement('div');
  bar.className = `infobar ${msg.kind}`;
  bar.setAttribute('role', msg.kind === 'error' ? 'alert' : 'status');
  const text = document.createElement('span');
  text.className = 'infobar-text';
  text.textContent = msg.text;
  bar.appendChild(text);
  if (msg.body) bar.appendChild(msg.body);
  for (const action of msg.actions ?? []) {
    bar.appendChild(
      button(action.primary ? 'primary' : '', action.label, action.label, () => {
        dismiss();
        action.run();
      })
    );
  }
  bar.appendChild(button('infobar-close', '×', 'Dismiss', dismiss));
  return bar;
}

/** A message without actions or controls that reads the same can keep its bar (no flicker). */
const same = (a: InfoMessage, b: InfoMessage): boolean =>
  a.kind === b.kind && a.text === b.text && !a.actions?.length && !b.actions?.length && !a.body && !b.body;

/**
 * T1. Shows a message. An unkeyed message replaces the previous unkeyed one in its position;
 * a keyed one replaces its own earlier version in place. Returns dismiss.
 */
export function showInfo(msg: InfoMessage): () => void {
  const pos: Pos = msg.position ?? 'top';
  if (!hosts[pos]) {
    console.warn(msg.text);
    return () => {};
  }
  const stack = stacks[pos];
  const i = stack.findIndex((e) => e.msg.key === msg.key);
  const prev = i === -1 ? null : stack[i];
  let entry: Entry;
  if (prev && same(prev.msg, msg)) {
    entry = prev;
  } else {
    entry = { msg, el: null, timer: null };
    if (prev) {
      if (prev.timer) clearTimeout(prev.timer);
      // A keyed update keeps its place; an unkeyed message is always the newest.
      if (msg.key !== undefined) stack[i] = entry;
      else stack.splice(i, 1);
    }
    if (!prev || msg.key === undefined) stack.push(entry);
    if (msg.timeoutMs) entry.timer = setTimeout(() => remove(pos, entry), msg.timeoutMs);
  }
  render(pos);
  return () => remove(pos, entry);
}

/** Removes the keyed message, wherever it is. */
export function clearInfo(key: string): void {
  for (const pos of ['top', 'bottom'] as const) {
    const entry = stacks[pos].find((e) => e.msg.key === key);
    if (entry) remove(pos, entry);
  }
}

/** Readable text for anything thrown or rejected; Rust commands reject with strings. */
export function errorText(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/** T1. Error bar for a failed action: "Could not <what>: <reason>". With a key it lasts until clearInfo(key). */
export function showError(what: string, err: unknown, key?: string): () => void {
  return showInfo({ kind: 'error', text: `Could not ${what}: ${errorText(err)}`, key });
}

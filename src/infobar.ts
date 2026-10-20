// Info bar (SPEC §4).
import type { InfoMessage } from './types';
import { button } from './dom';

interface Shown {
  bar: HTMLElement;
  kind: string;
  text: string;
  timer: ReturnType<typeof setTimeout> | null;
}

let topHost: HTMLElement | null = null;
let bottomHost: HTMLElement | null = null;
const shown: Record<'top' | 'bottom', Shown | null> = { top: null, bottom: null };

export function mountInfobar(top: HTMLElement, bottom: HTMLElement): void {
  topHost = top;
  bottomHost = bottom;
  shown.top = null;
  shown.bottom = null;
}

/** Removes `cur` if it is still the visible bar of its position; a stale call does nothing. */
function remove(pos: 'top' | 'bottom', cur: Shown): void {
  if (shown[pos] !== cur) return;
  if (cur.timer) clearTimeout(cur.timer);
  cur.bar.remove();
  shown[pos] = null;
}

/** T1. Shows a message; the newest message replaces the one in the same position. Returns dismiss. */
export function showInfo(msg: InfoMessage): () => void {
  const pos = msg.position === 'bottom' ? 'bottom' : 'top';
  const host = pos === 'bottom' ? bottomHost : topHost;
  if (!host) {
    console.warn(msg.text);
    return () => {};
  }
  const prev = shown[pos];
  if (prev && prev.kind === msg.kind && prev.text === msg.text) {
    return () => remove(pos, prev);
  }
  if (prev) remove(pos, prev);

  const bar = document.createElement('div');
  bar.className = `infobar ${msg.kind}`;
  bar.setAttribute('role', msg.kind === 'error' ? 'alert' : 'status');
  const cur: Shown = { bar, kind: msg.kind, text: msg.text, timer: null };
  const dismiss = () => remove(pos, cur);

  const text = document.createElement('span');
  text.className = 'infobar-text';
  text.textContent = msg.text;
  bar.appendChild(text);
  for (const action of msg.actions ?? []) {
    bar.appendChild(
      button(action.primary ? 'primary' : '', action.label, action.label, () => {
        dismiss();
        action.run();
      })
    );
  }
  bar.appendChild(button('infobar-close', '×', 'Dismiss', dismiss));

  host.replaceChildren(bar);
  shown[pos] = cur;
  if (msg.timeoutMs) cur.timer = setTimeout(dismiss, msg.timeoutMs);
  return dismiss;
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

/** T1. Error bar for a failed action: "Could not <what>: <reason>". */
export function showError(what: string, err: unknown): () => void {
  return showInfo({ kind: 'error', text: `Could not ${what}: ${errorText(err)}` });
}

// Info bar (SPEC §4). Minimal version; phase 2 completes it.
import type { InfoMessage } from './types';
import { button } from './dom';

let topHost: HTMLElement | null = null;
let bottomHost: HTMLElement | null = null;

export function mountInfobar(top: HTMLElement, bottom: HTMLElement): void {
  topHost = top;
  bottomHost = bottom;
}

/** T1. Shows a message; the newest message replaces the one in the same position. Returns dismiss. */
export function showInfo(msg: InfoMessage): () => void {
  const host = msg.position === 'bottom' ? bottomHost : topHost;
  if (!host) {
    console.warn(msg.text);
    return () => {};
  }
  const bar = document.createElement('div');
  bar.className = `infobar ${msg.kind}`;
  bar.setAttribute('role', msg.kind === 'error' ? 'alert' : 'status');
  const dismiss = () => bar.remove();

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
  if (msg.timeoutMs) setTimeout(dismiss, msg.timeoutMs);
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

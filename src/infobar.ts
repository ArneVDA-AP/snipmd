// Info bar (SPEC §4). Minimal version; phase 2 completes it.
import type { InfoMessage } from './types';

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

  const text = document.createElement('span');
  text.className = 'infobar-text';
  text.textContent = msg.text;
  bar.appendChild(text);

  const dismiss = () => bar.remove();
  for (const action of msg.actions ?? []) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = action.primary ? 'primary' : '';
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      dismiss();
      action.run();
    });
    bar.appendChild(btn);
  }
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'infobar-close';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Dismiss');
  close.addEventListener('click', dismiss);
  bar.appendChild(close);

  host.replaceChildren(bar);
  if (msg.timeoutMs) setTimeout(dismiss, msg.timeoutMs);
  return dismiss;
}

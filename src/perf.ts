// Marks for the SPEC §9 budgets. Rust writes them to perf.log only when SNIPMD_TRACE is set
// (src-tauri/src/perf.rs). The 'ready' mark tells the page whether tracing is on; when it is off,
// the page measures nothing more. Never on the typing path.
import { perfMark, toAssetUrl } from './ipc';

let tracing = false;

/** Double-click to typing: called once the first tab can take keys; marks after that frame is painted. */
export function markReady(): void {
  requestAnimationFrame(() =>
    setTimeout(() => void perfMark('ready').then((on) => (tracing = on), () => {}), 0)
  );
}

/** Longest a paste is followed; a slower one is logged with this time, so it reads as a failed budget. */
const PASTE_LIMIT_MS = 10_000;

/** Ctrl+V to screenshot visible: from the paste event to the frame after the image is decoded. Only when tracing. */
export function markPasteVisible(absPath: string, start: number): void {
  if (!tracing) return;
  const url = toAssetUrl(absPath);
  const send = (ms: number) => void perfMark('paste', ms).catch(() => {});
  const look = (): void => {
    const img = [...document.querySelectorAll<HTMLImageElement>('.inline-img-widget img')].find((i) => i.src === url);
    if (!img) {
      if (performance.now() - start < PASTE_LIMIT_MS) requestAnimationFrame(look);
      else send(PASTE_LIMIT_MS);
      return;
    }
    // The frame after decode is the first one that can show the image.
    img.decode().then(
      () => requestAnimationFrame(() => requestAnimationFrame(() => send(performance.now() - start))),
      () => {}
    );
  };
  requestAnimationFrame(look);
}

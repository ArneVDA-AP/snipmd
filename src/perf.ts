// Marks for the SPEC §9 budgets. Rust writes them to perf.log only when SNIPMD_TRACE is set
// (src-tauri/src/perf.rs); a mark is otherwise one cheap IPC call. Never on the typing path.
import { perfMark, toAssetUrl } from './ipc';

const send = (name: string, ms?: number): void => void perfMark(name, ms).catch(() => {});

/** Double-click to typing: called once the first tab can take keys; marks after that frame is painted. */
export function markReady(): void {
  requestAnimationFrame(() => setTimeout(() => send('ready'), 0));
}

/** Ctrl+V to screenshot visible: from the paste event to the frame after the image is decoded. */
export function markPasteVisible(absPath: string, start: number): void {
  const url = toAssetUrl(absPath);
  const until = start + 2000;
  const look = (): void => {
    const img = [...document.querySelectorAll<HTMLImageElement>('.inline-img-widget img')].find((i) => i.src === url);
    if (!img) {
      if (performance.now() < until) requestAnimationFrame(look);
      return;
    }
    img.decode().then(
      () => requestAnimationFrame(() => send('paste', performance.now() - start)),
      () => {}
    );
  };
  requestAnimationFrame(look);
}

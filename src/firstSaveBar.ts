// First-save bar (SPEC §6.2): folder, name and "Other folder…" for a note that has no file yet.
import type { TabState } from './types';
import { button } from './dom';
import { clearInfo, showError, showInfo } from './infobar';
import { defaultNoteFolder, noteNameFree, pickFolder } from './ipc';
import { basename } from './paths';
import { getLastFolder } from './tabs';

export type FirstSaveChoice = { folder: string; name: string } | 'other' | null;

const pad = (n: number): string => String(n).padStart(2, '0');

function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function proposeName(text: string): string {
  const heading = /^#{1,6}[ \t]+(.+)$/m.exec(text)?.[1] ?? '';
  const s = slug(heading);
  if (s) return `${s}.md`;
  const d = new Date();
  return `note-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.md`;
}

const folderLabel = (folder: string): string => `${basename(folder)} ›`;

export async function askFirstSave(tab: TabState, text: string): Promise<FirstSaveChoice> {
  const key = `firstsave:${tab.id}`;
  let folder: string;
  try {
    folder = getLastFolder() ?? (await defaultNoteFolder());
  } catch (err) {
    showError('find the notes folder', err);
    return null;
  }

  return new Promise<FirstSaveChoice>((resolve) => {
    let done = false;
    let seq = 0;
    const finish = (choice: FirstSaveChoice): void => {
      if (done) return;
      done = true;
      clearInfo(key);
      resolve(choice);
    };

    const folderBtn = button('firstsave-folder', folderLabel(folder), 'Choose folder', () => {
      void pickFolder().then(
        (picked) => {
          if (done || !picked) return;
          folder = picked;
          folderBtn.textContent = folderLabel(folder);
          check();
        },
        (err) => showError('pick a folder', err)
      );
    });
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'firstsave-name';
    input.value = proposeName(text);
    input.spellcheck = false;
    input.setAttribute('aria-label', 'File name');
    const save = button('primary', 'Save', 'Save', () => submit());
    save.disabled = true;
    const other = button('', 'Other folder…', 'Other folder', () => finish('other'));

    function submit(): void {
      if (!save.disabled) finish({ folder, name: input.value.trim() });
    }

    function check(): void {
      const mine = ++seq;
      const name = input.value.trim();
      const set = (ok: boolean): void => {
        if (mine !== seq || done) return;
        input.classList.toggle('taken', !ok);
        save.disabled = !ok;
      };
      set(false); // not allowed until the latest check says so
      if (!name) return;
      noteNameFree(folder, name).then(set, () => set(false));
    }

    input.addEventListener('input', check);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finish(null);
      }
    });

    const body = document.createElement('span');
    body.className = 'firstsave-body';
    body.append(folderBtn, input, save, other);
    // However the bar goes (dismissed, cleared, replaced), the save is cancelled unless it already chose.
    showInfo({ kind: 'info', text: 'Save as', key, body, onClose: () => finish(null) });

    input.focus();
    input.setSelectionRange(0, Math.max(0, input.value.length - '.md'.length));
    check();
  });
}

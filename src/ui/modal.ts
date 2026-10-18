import { listVirtualMarkdownFiles } from '../ipc/bridge';

export function openSnipLightboxModal(
  src: string,
  relPath: string,
  naturalDims: string
): void {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop lightbox-backdrop';

  backdrop.innerHTML = `
    <div class="lightbox-card" role="dialog" aria-modal="true" aria-label="Image Full Resolution View">
      <div class="lightbox-header">
        <div class="lightbox-meta">
          <span class="lightbox-title">${relPath}</span>
          <span class="lightbox-dims">${naturalDims || 'Full Resolution'}</span>
        </div>
        <div class="lightbox-actions">
          <a href="${src}" download="${relPath.replace('.assets/', '')}" class="modal-btn">Download Image</a>
          <button type="button" class="modal-btn primary" id="closeLightboxBtn">Close (Esc)</button>
        </div>
      </div>
      <div class="lightbox-body">
        <img src="${src}" alt="${relPath}" class="lightbox-img" referrerpolicy="no-referrer" />
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  const cleanup = () => {
    window.removeEventListener('keydown', onKey);
    backdrop.remove();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cleanup();
    }
  };
  window.addEventListener('keydown', onKey);

  backdrop
    .querySelector<HTMLButtonElement>('#closeLightboxBtn')!
    .addEventListener('click', cleanup);

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      cleanup();
    }
  });
}

export function promptSaveFileModal(defaultFilename: string): Promise<string | null> {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    const defaultPath = `D:/projects/notes/${
      defaultFilename.endsWith('.md') ? defaultFilename : `${defaultFilename}.md`
    }`;

    backdrop.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true" aria-label="Save Markdown Note">
        <div class="modal-header">
          <span class="modal-title">Save Markdown Note</span>
        </div>
        <p class="modal-subtitle">
          Choose a file path for your note. Any inline images captured in this draft will be saved alongside your document in its <code>.assets/</code> folder.
        </p>
        <input type="text" class="modal-input" id="savePathInput" value="${defaultPath}" spellcheck="false" />
        <div class="modal-actions">
          <button type="button" class="modal-btn" id="cancelSaveBtn">Cancel</button>
          <button type="button" class="modal-btn primary" id="confirmSaveBtn">Save Note</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    const input = backdrop.querySelector<HTMLInputElement>('#savePathInput')!;
    const cancelBtn = backdrop.querySelector<HTMLButtonElement>('#cancelSaveBtn')!;
    const confirmBtn = backdrop.querySelector<HTMLButtonElement>('#confirmSaveBtn')!;

    input.focus();
    input.select();

    const cleanup = (val: string | null) => {
      backdrop.remove();
      resolve(val);
    };

    cancelBtn.onclick = () => cleanup(null);
    confirmBtn.onclick = () => {
      const trimmed = input.value.trim();
      cleanup(trimmed ? (trimmed.endsWith('.md') ? trimmed : `${trimmed}.md`) : null);
    };

    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmBtn.click();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cleanup(null);
      }
    };

    backdrop.onclick = (e) => {
      if (e.target === backdrop) {
        cleanup(null);
      }
    };
  });
}

export function promptOpenFileModal(): Promise<string | null> {
  return new Promise((resolve) => {
    const files = listVirtualMarkdownFiles();

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    const listItemsHtml =
      files.length > 0
        ? files
            .map(
              (f) => `
          <div class="modal-file-item" data-path="${f}">
            <span>${f}</span>
            <span style="color: var(--accent)">Open →</span>
          </div>`
            )
            .join('')
        : `<div class="modal-file-item"><span>No saved notes found</span></div>`;

    backdrop.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true" aria-label="Open Markdown Note">
        <div class="modal-header">
          <span class="modal-title">Open Note</span>
        </div>
        <p class="modal-subtitle">
          Select a Markdown manuscript from your workspace to open in a tab.
        </p>
        <div class="modal-file-list" id="openFileList">
          ${listItemsHtml}
        </div>
        <div class="modal-actions">
          <button type="button" class="modal-btn" id="closeOpenModalBtn">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    const cleanup = (val: string | null) => {
      window.removeEventListener('keydown', onKey);
      backdrop.remove();
      resolve(val);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cleanup(null);
      }
    };
    window.addEventListener('keydown', onKey);

    backdrop.querySelectorAll<HTMLElement>('.modal-file-item[data-path]').forEach((item) => {
      item.onclick = () => {
        cleanup(item.dataset.path || null);
      };
    });

    backdrop.querySelector<HTMLButtonElement>('#closeOpenModalBtn')!.onclick = () =>
      cleanup(null);

    backdrop.onclick = (e) => {
      if (e.target === backdrop) {
        cleanup(null);
      }
    };
  });
}

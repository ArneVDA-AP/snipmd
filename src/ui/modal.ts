import { listVirtualMarkdownFiles, getVirtualStorageStats } from '../ipc/bridge';

const WORKFLOW_YAML = `name: Release Windows 11 (x64 NSIS, MSI & Portable)

on:
  workflow_dispatch:
  push:
    branches:
      - main
      - master
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  build-windows-11:
    runs-on: windows-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js 22 (no lockfile cache requirement)
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install Rust stable (x86_64-pc-windows-msvc)
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: x86_64-pc-windows-msvc

      - name: Rust Cargo cache
        uses: swatinem/rust-cache@v2
        with:
          workspaces: './src-tauri -> target'

      - name: Install frontend dependencies & Tauri CLI v2
        run: |
          npm install --legacy-peer-deps
          npm install --no-save --legacy-peer-deps @tauri-apps/cli@^2.0.0

      - name: Build Tauri v2 Windows 11 Release (NSIS .exe + WiX .msi + Portable .exe)
        run: npx tauri build --bundles nsis,msi

      - name: Stage Windows 11 Release Executables
        shell: pwsh
        run: |
          New-Item -ItemType Directory -Force -Path release-win11 | Out-Null
          Copy-Item "src-tauri/target/release/snip-md.exe" "release-win11/SnipMD_0.1.0_x64_Portable.exe"
          Copy-Item "src-tauri/target/release/bundle/nsis/*.exe" "release-win11/"
          Copy-Item "src-tauri/target/release/bundle/msi/*.msi" "release-win11/"
          Get-ChildItem release-win11

      - name: Upload Windows 11 Installers to Workflow Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: SnipMD-v0.1.0-Win11-x64-Installers
          path: |
            release-win11/*.exe
            release-win11/*.msi

      - name: Publish GitHub Release (v0.1.0)
        uses: softprops/action-gh-release@v2
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: v0.1.0
          name: 'SnipMD v0.1.0 — Windows 11 Release (x64)'
          draft: false
          prerelease: false
          files: |
            release-win11/*.exe
            release-win11/*.msi
`;

export function openWin11ReleaseModal(onToast?: (msg: string) => void): void {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const psCommand = `.\\build-win11-release.ps1`;

  backdrop.innerHTML = `
    <div class="modal-card release-modal-card" role="dialog" aria-modal="true" aria-label="Windows 11 Release Packager">
      <div class="modal-header">
        <div>
          <span class="modal-title">SnipMD v0.1.0 — Windows 11 Release Package (x64)</span>
          <div class="release-badge-row">
            <span class="release-pill ok">Tauri v2 + Rust LTO</span>
            <span class="release-pill">NSIS .exe + WiX .msi</span>
            <span class="release-pill">.md File Association</span>
            <span class="release-pill">Node 22 + No Lockfile Trap</span>
          </div>
        </div>
        <button type="button" class="modal-btn" id="closeReleaseTopBtn">✕</button>
      </div>

      <p class="modal-subtitle">
        SnipMD is packaged for <strong>Windows 11 (x86_64-pc-windows-msvc)</strong> with prebuilt frontend assets (<code>dist/</code>), optimized Rust LTO release profile (<code>strip = true</code>, <code>opt-level = "s"</code>), Windows 11 <code>.ico</code>/PNG icon suite, and single-instance <code>.md</code> File Explorer integration.
      </p>

      <div class="release-artifact-grid">
        <div class="release-artifact-card primary-artifact">
          <div class="release-artifact-head">
            <span class="release-artifact-name">SnipMD-v0.1.0-Win11-x64-Release-Kit.zip</span>
            <span class="release-artifact-tag">Updated CI + Local Kit</span>
          </div>
          <p class="release-artifact-desc">
            Includes compiled production <code>dist/</code> bundle, full <code>src-tauri/</code> Rust crate, <code>package-lock.json</code>, 1-click <code>build-win11-release.bat</code> / <code>.ps1</code> packager, and fixed <code>.github/workflows/release-win11.yml</code>.
          </p>
          <div class="release-artifact-actions">
            <a href="/releases/SnipMD-v0.1.0-Win11-x64-Release-Kit.zip" download="SnipMD-v0.1.0-Win11-x64-Release-Kit.zip" class="modal-btn primary" id="downloadZipKitBtn">
              ⬇ Download Win11 Release Kit (.zip)
            </a>
            <button type="button" class="modal-btn" id="copyWorkflowYamlBtn">Copy Fixed GitHub Workflow YAML</button>
            <button type="button" class="modal-btn" id="copyPsCmdBtn">Copy PowerShell Cmd</button>
          </div>
        </div>

        <div class="release-targets-box">
          <div class="release-targets-title">Configured Windows 11 Installer & Binary Targets (<code>tauri.conf.json</code>)</div>
          <div class="release-target-row">
            <span class="target-kind">NSIS Setup</span>
            <code class="target-file">SnipMD_0.1.0_x64-setup.exe</code>
            <span class="target-note">Per-user install · registers .md & .markdown in Explorer</span>
          </div>
          <div class="release-target-row">
            <span class="target-kind">WiX MSI</span>
            <code class="target-file">SnipMD_0.1.0_x64_en-US.msi</code>
            <span class="target-note">Standard Windows 11 MSI installer package</span>
          </div>
          <div class="release-target-row">
            <span class="target-kind">Portable EXE</span>
            <code class="target-file">SnipMD_0.1.0_x64_Portable.exe</code>
            <span class="target-note">Zero-install ~3.5 MB standalone native executable</span>
          </div>
        </div>

        <div class="release-steps-box">
          <div class="release-targets-title">Build Native .exe / .msi on Windows 11 (Local or GitHub Cloud)</div>
          <ol class="release-steps-list">
            <li><strong>GitHub Actions Cloud Build (Fixed):</strong> Click <em>"Copy Fixed GitHub Workflow YAML"</em> above and paste it into <code>.github/workflows/release-win11.yml</code> in your repo (or push the updated Release Kit). It removes <code>cache: 'npm'</code>, uses Node 22, installs <code>@tauri-apps/cli@^2.0.0</code>, and uploads all 3 Windows 11 executables to Workflow Artifacts & GitHub Releases.</li>
            <li><strong>Local 1-Click Build:</strong> Extract <code>SnipMD-v0.1.0-Win11-x64-Release-Kit.zip</code> on Windows 11 and double-click <code>build-win11-release.bat</code>.</li>
          </ol>
        </div>
      </div>

      <div class="modal-actions">
        <button type="button" class="modal-btn" id="closeReleaseModalBtn">Done</button>
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
    .querySelector<HTMLButtonElement>('#closeReleaseTopBtn')!
    .addEventListener('click', cleanup);
  backdrop
    .querySelector<HTMLButtonElement>('#closeReleaseModalBtn')!
    .addEventListener('click', cleanup);

  backdrop
    .querySelector<HTMLAnchorElement>('#downloadZipKitBtn')!
    .addEventListener('click', () => {
      onToast?.('Downloading SnipMD-v0.1.0-Win11-x64-Release-Kit.zip');
    });

  backdrop
    .querySelector<HTMLButtonElement>('#copyWorkflowYamlBtn')!
    .addEventListener('click', () => {
      void navigator.clipboard?.writeText(WORKFLOW_YAML);
      onToast?.('Copied fixed .github/workflows/release-win11.yml to clipboard');
    });

  backdrop
    .querySelector<HTMLButtonElement>('#copyPsCmdBtn')!
    .addEventListener('click', () => {
      void navigator.clipboard?.writeText(psCommand);
      onToast?.('Copied .\\build-win11-release.ps1 to clipboard');
    });

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      cleanup();
    }
  });
}

export function openSnipLightboxModal(
  src: string,
  relPath: string,
  naturalDims: string
): void {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop lightbox-backdrop';

  backdrop.innerHTML = `
    <div class="lightbox-card" role="dialog" aria-modal="true" aria-label="Snip Full Resolution Inspector">
      <div class="lightbox-header">
        <div class="lightbox-meta">
          <span class="lightbox-title">${relPath}</span>
          <span class="lightbox-dims">${naturalDims || 'Full Resolution'}</span>
        </div>
        <div class="lightbox-actions">
          <a href="${src}" download="${relPath.replace('.assets/', '')}" class="modal-btn">Download PNG</a>
          <button type="button" class="modal-btn primary" id="closeLightboxBtn">Close (Esc)</button>
        </div>
      </div>
      <div class="lightbox-body">
        <img src="${src}" alt="${relPath}" class="lightbox-img" />
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
      <div class="modal-card" role="dialog" aria-modal="true" aria-label="Save Markdown File">
        <div class="modal-header">
          <span class="modal-title">Save Markdown Note & Promote Scratchpad Assets</span>
        </div>
        <p class="modal-subtitle">
          Saving an unsaved scratch tab invokes <code>promote_scratch_assets</code> to move referenced <code>.assets/snip-*.png</code> files from <code>%APPDATA%/snip-md/scratchpad/.assets/</code> into the target folder's sidecar <code>.assets/</code> directory, then runs <code>gc_scratch_assets</code>.
        </p>
        <input type="text" class="modal-input" id="savePathInput" value="${defaultPath}" spellcheck="false" />
        <div class="modal-actions">
          <button type="button" class="modal-btn" id="cancelSaveBtn">Cancel</button>
          <button type="button" class="modal-btn primary" id="confirmSaveBtn">Save & Promote Assets</button>
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
    const stats = getVirtualStorageStats();

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
        : `<div class="modal-file-item"><span>No saved files found</span></div>`;

    backdrop.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true" aria-label="Open Markdown File">
        <div class="modal-header">
          <span class="modal-title">Open Markdown File (Ctrl+O)</span>
        </div>
        <p class="modal-subtitle">
          Select a disk-backed Markdown file below, or inspect live <code>.assets/</code> storage (${stats.localAssetCount} promoted sidecar snips · ${stats.scratchAssetCount} scratchpad snips · ${stats.lastGcDeletedCount} swept in last GC).
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
      backdrop.remove();
      resolve(val);
    };

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

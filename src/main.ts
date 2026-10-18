import './styles/main.css';
import { TabManager } from './state/TabManager';

function bootstrapSnipMD(): void {
  const appRoot = document.getElementById('app') || document.body;
  appRoot.innerHTML = `
    <div class="snipmd-shell">
      <header class="titlebar" id="titlebarRoot"></header>
      <div class="workspace-body">
        <main class="workspace-container" id="workspaceRoot">
          <div class="editor-pane" id="editorPane"></div>
          <div class="preview-pane hidden" id="previewPane"></div>
        </main>
        <aside class="inspector-drawer" id="inspectorRoot" aria-label="Studio & Assets Inspector"></aside>
      </div>
      <footer class="statusbar" id="statusBarRoot"></footer>
    </div>
  `;

  const titlebarRoot = document.getElementById('titlebarRoot')!;
  const workspaceRoot = document.getElementById('workspaceRoot')!;
  const editorPane = document.getElementById('editorPane')!;
  const previewPane = document.getElementById('previewPane')!;
  const inspectorRoot = document.getElementById('inspectorRoot')!;
  const statusBarRoot = document.getElementById('statusBarRoot')!;

  const manager = new TabManager(
    titlebarRoot,
    workspaceRoot,
    editorPane,
    previewPane,
    inspectorRoot,
    statusBarRoot
  );
  void manager.initialize();
}

bootstrapSnipMD();

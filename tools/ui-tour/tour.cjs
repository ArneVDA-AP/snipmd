// UI tour: drives the frontend in Chromium with a mocked Tauri backend and writes one screenshot per
// scene, theme and scale. A quick visual check between Windows runs; it does not replace them.
// Usage: npx vite (port 3000), then
//   NODE_PATH=<dir with playwright-core> node tools/ui-tour/tour.cjs <out dir> [scene ...]
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const out = process.argv[2] || 'findings/ui/shots';
const only = process.argv.slice(3);
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = process.env.URL || 'http://localhost:3000';

const NOTE = `# Labo 04: DHCP lokaal B

Client krijgt geen adres. **Stap 1**: kabel en switchpoort gecontroleerd, _link up_.

## ipconfig op de client

![snip](labo-04.assets/snip-20261020-142211-087-3fa9.png)

- APIPA-adres \`169.254.12.7\`: de DHCP-server antwoordt niet.
- Scope op [de server](https://learn.microsoft.com/windows-server/networking/technologies/dhcp/dhcp-top) staat op *inactive*.

> Na activeren van de scope: adres binnen 2 s.

\`\`\`powershell
Get-DhcpServerv4Scope | Set-DhcpServerv4Scope -State Active
\`\`\`
`;

const tab = (id, title, filePath, extra = {}) => ({
  id, title, filePath, content: '', dirty: false, mode: 'edit', cursor: 0, scrollTop: 0,
  disk: filePath ? { mtimeMs: 1, size: 1 } : null, format: null, ...extra
});
const session = (tabs, active, extra = {}) => ({
  version: 3, activeTabId: active, untitledCounter: 3, lastFolder: null, tabs, closedTabs: [], ...extra
});
const base = () => [
  tab('t1', 'labo-04.md', 'C:/Users/arne/Documents/Notes/labo-04.md'),
  tab('t2', 'Untitled-2', null, { content: '# Vergadering netwerkteam\n\nActiepunten:\n', dirty: true }),
  tab('t3', 'meeting-notes.md', 'C:/Users/arne/Documents/Notes/meeting-notes.md', { content: '# Meeting\n\nNotes typed here.\n', dirty: true })
];

// Each scene: session to restore, backend behaviour, then steps in the page.
const SCENES = {
  empty: { session: null },
  write: { session: session(base(), 't1') },
  read: { session: session(base(), 't1'), steps: async (p) => { await p.keyboard.press('Control+e'); await p.waitForSelector('.read-view img'); } },
  tabs: {
    session: session([...base(), ...['analyse-logboek-week-42.md', 'todo.md', 'Untitled-3', 'projectplan-migratie-servers.md', 'labo-05.md', 'x.md']
      .map((t, i) => tab(`m${i}`, t, t.startsWith('Untitled') ? null : `C:/n/${t}`, { dirty: i % 2 === 0, content: t.startsWith('Untitled') ? 'x' : '' }))], 't1')
  },
  firstsave: { session: session(base(), 't2'), steps: async (p) => { await p.click('.cm-content'); await p.keyboard.press('Control+s'); await p.waitForSelector('.firstsave-name'); await p.waitForTimeout(100); } },
  closed: { session: session(base(), 't3'), steps: async (p) => { await p.click('.cm-content'); await p.keyboard.press('Control+w'); await p.waitForSelector('#infoBottom .infobar'); } },
  conflict: { session: session(base(), 't3'), backend: { statChanged: true }, steps: async (p) => { await p.waitForSelector('.infobar.warning', { timeout: 5000 }); } },
  find: { session: session(base(), 't1'), steps: async (p) => { await p.click('.cm-content'); await p.keyboard.press('Control+h'); await p.keyboard.type('scope'); await p.waitForSelector('.cm-search'); } },
  focus: { session: session(base(), 't1'), steps: async (p) => { await p.click('.cm-content'); await p.keyboard.press('F6'); await p.keyboard.press('ArrowRight'); } },
  error: { session: session(base(), 't1'), backend: { writeFails: true }, steps: async (p) => { await p.click('.cm-content'); await p.keyboard.press('End'); await p.keyboard.type(' x'); await p.keyboard.press('Control+s'); await p.waitForSelector('.infobar.error'); } }
};

async function fakeScreenshot(browser) {
  const p = await browser.newPage({ viewport: { width: 760, height: 300 } });
  await p.setContent(`<body style="margin:0;background:#0c0c0c;color:#cccccc;font:14px/1.45 Consolas,monospace;padding:14px 18px">
<div style="color:#8ab4f8">PS C:\\Users\\student&gt; ipconfig</div><br>Windows IP Configuration<br><br>
Ethernet adapter Ethernet:<br><br>&nbsp;&nbsp; Connection-specific DNS Suffix&nbsp; . :<br>
&nbsp;&nbsp; Autoconfiguration IPv4 Address. . : <span style="color:#f28b82">169.254.12.7</span><br>
&nbsp;&nbsp; Subnet Mask . . . . . . . . . . . : 255.255.0.0<br>&nbsp;&nbsp; Default Gateway . . . . . . . . . :<br><br>
<div style="color:#8ab4f8">PS C:\\Users\\student&gt; _</div></body>`);
  const png = (await p.screenshot()).toString('base64');
  await p.close();
  return png;
}

async function run(browser, png, name, scene, theme, scale) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 720 }, deviceScaleFactor: scale, colorScheme: theme });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(({ png, session, backend, note }) => {
    let cb = 0;
    window.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
      transformCallback: () => ++cb,
      convertFileSrc: () => 'data:image/png;base64,' + png,
      invoke: async (cmd, args) => {
        switch (cmd) {
          case 'load_session': return session ? JSON.stringify(session) : null;
          case 'save_session': return null;
          case 'get_cli_startup_files': return [];
          case 'read_markdown_file': return { text: args.path.endsWith('labo-04.md') ? note : '# Meeting\n\nOn disk.\n', format: { crlf: true, bom: false }, stamp: { mtimeMs: 1, size: 1 } };
          case 'stat_note': return backend.statChanged && args.path.endsWith('meeting-notes.md') ? { mtimeMs: 2, size: 2 } : { mtimeMs: 1, size: 1 };
          case 'write_markdown_file':
            if (backend.writeFails) throw 'Access is denied. (os error 5)';
            return { written: { mtimeMs: 3, size: 3 } };
          case 'resolve_asset_abs_path': return 'C:/abs/' + args.relPath;
          case 'default_note_folder': return 'C:/Users/arne/Documents/Notes';
          case 'note_name_free': return true;
          default: return 0;
        }
      }
    };
  }, { png, session: scene.session, backend: scene.backend || {}, note: NOTE });
  await page.goto(URL);
  await page.waitForSelector('.cm-content');
  await page.waitForTimeout(150);
  if (scene.steps) await scene.steps(page);
  await page.waitForTimeout(250);
  const file = path.join(out, `${name}-${theme}${scale === 1 ? '' : `-${scale * 100}`}.png`);
  await page.screenshot({ path: file });
  await ctx.close();
  return errors.length ? `${file}: ${errors.join('; ')}` : null;
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME });
  const png = await fakeScreenshot(browser);
  const problems = [];
  for (const [name, scene] of Object.entries(SCENES)) {
    if (only.length && !only.includes(name)) continue;
    for (const theme of ['light', 'dark']) {
      const p = await run(browser, png, name, scene, theme, 1);
      if (p) problems.push(p);
    }
  }
  if (!only.length || only.includes('write')) {
    for (const scale of [1.5, 2]) await run(browser, png, 'write', SCENES.write, 'light', scale);
  }
  await browser.close();
  console.log(problems.length ? problems.join('\n') : 'ok');
})();

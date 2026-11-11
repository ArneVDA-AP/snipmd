// A stand-in for Tauri, set before the app loads: four notes, writes that succeed, no files on disk.
(function () {
  var dir = 'C:/Users/demo/Documents/Notes/';
  function tab(id, title, file, content) {
    return { id: id, title: title, filePath: file ? dir + file : null, content: content, dirty: false, mode: 'edit', cursor: 0, scrollTop: 0, disk: file ? { mtimeMs: 1, size: 1 } : null, format: null };
  }
  var notes = {
    'labo-04.md': '# Labo 04: DHCP\n\nDe client krijgt geen adres.\n\n- APIPA-adres `169.254.12.7`: de DHCP-server antwoordt niet.\n- Scope staat op *inactive*.\n\n> Na activeren van de scope: adres binnen 2 s.\n',
    'meeting-notes.md': '# Vergadering netwerkteam\n\nActiepunten:\n\n- [ ] VLAN 30 documenteren\n- [x] Switch in lokaal B vervangen\n',
    'todo.md': '# Todo\n\n- Verslag labo 04 afwerken\n- Screenshots RADIUS-test\n'
  };
  var session = {
    version: 3, activeTabId: 't1', lastFolder: dir, closedTabs: [],
    tabs: [
      tab('t1', 'labo-04.md', 'labo-04.md', notes['labo-04.md']),
      tab('t2', 'Untitled-2', null, '# Ideeën\n\nSnip loopt naar de tab waar iets gebeurt.\n'),
      tab('t3', 'meeting-notes.md', 'meeting-notes.md', notes['meeting-notes.md']),
      tab('t4', 'todo.md', 'todo.md', notes['todo.md'])
    ]
  };
  // The demo's clock can jump ahead: timers of five minutes or more (the nap) are kept, so a jump runs
  // the ones it passes at once.
  var offset = 0, realNow = Date.now.bind(Date), realSet = window.setTimeout.bind(window), longOnes = [];
  Date.now = function () { return realNow() + offset; };
  window.setTimeout = function (f, ms) {
    var id = realSet.apply(window, arguments);
    if (ms >= 300000) longOnes.push({ id: id, f: f, at: Date.now() + ms, args: [].slice.call(arguments, 2) });
    return id;
  };
  window.__demoSkip = function (ms) {
    offset += ms;
    var due = longOnes.filter(function (t) { return t.at <= Date.now(); });
    longOnes = longOnes.filter(function (t) { return t.at > Date.now(); });
    due.forEach(function (t) { clearTimeout(t.id); t.f.apply(window, t.args); });
  };
  var cb = 0;
  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
    transformCallback: function () { return ++cb; },
    convertFileSrc: function (p) { return p; },
    invoke: function (cmd, args) {
      switch (cmd) {
        case 'load_session': return Promise.resolve({ raw: JSON.stringify(session), setAside: null });
        case 'get_cli_startup_files':
        case 'take_opened_notes': return Promise.resolve([]);
        case 'read_markdown_file':
          var name = args.path.split('/').pop();
          return Promise.resolve({ text: notes[name] || '', format: { crlf: false, bom: false }, stamp: { mtimeMs: 1, size: 1 } });
        case 'stat_note': return Promise.resolve({ mtimeMs: 1, size: 1 });
        case 'write_markdown_file': return Promise.resolve({ written: { mtimeMs: 1, size: 1 } });
        case 'default_note_folder': return Promise.resolve(dir);
        case 'note_name_free': return Promise.resolve(true);
        default: return Promise.resolve(null);
      }
    }
  };
})();

let snipSequence = 1;

export async function generateSimulatedSnipPngBytes(
  contextTitle: string,
  isScratchpad: boolean
): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  // 780x540 so every simulated snip is naturally taller than the 360px cap!
  canvas.width = 780;
  canvas.height = 540;
  const ctx = canvas.getContext('2d')!;

  // Dark background canvas
  ctx.fillStyle = '#0d0e12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle blueprint grid lines
  ctx.strokeStyle = '#181a24';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Outer card frame
  ctx.fillStyle = '#13151c';
  ctx.strokeStyle = isScratchpad ? '#a855f7' : '#10b981';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(18, 18, canvas.width - 36, canvas.height - 36, 8);
  ctx.fill();
  ctx.stroke();

  // Header strip
  ctx.fillStyle = '#1a1d27';
  ctx.fillRect(20, 20, canvas.width - 40, 42);

  const seq = snipSequence++;
  ctx.font = '700 13px "JetBrains Mono", monospace';
  ctx.fillStyle = isScratchpad ? '#e9d5ff' : '#86efac';
  const routingLabel = isScratchpad
    ? 'ROUTED TO: %APPDATA%/snip-md/scratchpad/.assets/'
    : 'ROUTED TO: <md_parent_dir>/.assets/';
  ctx.fillText(`WIN+SHIFT+S CAPTURE #${seq}  •  ${routingLabel}`, 34, 46);

  // Top half (Visible inside 360px cap)
  ctx.font = '600 14px "JetBrains Mono", monospace';
  ctx.fillStyle = '#f472b6';
  ctx.fillText(`Active Buffer: ${contextTitle} (780×540px PNG)`, 34, 92);

  ctx.font = '12px "JetBrains Mono", monospace';
  ctx.fillStyle = '#e4e4e7';
  ctx.fillText(
    `Timestamp  : ${new Date().toISOString()} (OpenOptions::create_new(true))`,
    34,
    124
  );
  ctx.fillText(
    `Pipeline   : Clipboard image/png -> Uint8Array -> save_clipboard_image IPC`,
    34,
    152
  );
  ctx.fillText(
    `Widget     : CodeMirror 6 StateField<DecorationSet> (block: true, side: 1)`,
    34,
    180
  );

  // SimulatedFlamegraph / Architecture Boxes in upper section
  const bars = [
    { label: 'IPC serialization (Uint8Array)', w: 540, color: '#38bdf8', y: 210 },
    { label: 'Atomic file create_new(true)', w: 410, color: '#a855f7', y: 244 },
    { label: 'CM6 StateField decoration map', w: 620, color: '#4ade80', y: 278 }
  ];
  for (const b of bars) {
    ctx.fillStyle = '#1e2230';
    ctx.fillRect(34, b.y, 680, 24);
    ctx.fillStyle = b.color;
    ctx.fillRect(34, b.y, b.w, 24);
    ctx.fillStyle = '#09090b';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.fillText(b.label, 44, b.y + 16);
  }

  // 360px Fold Indicator Line
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(22, 332);
  ctx.lineTo(canvas.width - 22, 332);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#271a05';
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.5;
  ctx.fillRect(210, 318, 360, 26);
  ctx.strokeRect(210, 318, 360, 26);
  ctx.fillStyle = '#fbbf24';
  ctx.font = '700 11px "JetBrains Mono", monospace';
  ctx.fillText('▼ 360px CAPPED FOLD — CLICK IMAGE TO EXPAND ▼', 228, 335);

  // Lower half (Below 360px fold — revealed when user clicks the image!)
  ctx.fillStyle = '#0f291e';
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 1.5;
  ctx.fillRect(34, 364, 712, 138);
  ctx.strokeRect(34, 364, 712, 138);

  ctx.fillStyle = '#6ee7b7';
  ctx.font = '700 14px "JetBrains Mono", monospace';
  ctx.fillText(
    `✓ FULL 540px HEIGHT UNLOCKED (CAPTURE #${seq} LOWER TELEMETRY PANEL)`,
    52,
    396
  );

  ctx.fillStyle = '#d1fae5';
  ctx.font = '12px "JetBrains Mono", monospace';
  ctx.fillText(
    '• Clicking any snip toggles .expanded (max-height: 360px <-> max-height: none)',
    52,
    426
  );
  ctx.fillText(
    '• Double-click any snip (or click "Lightbox") for full-window zoom inspection',
    52,
    452
  );
  ctx.fillText(
    '• Click the image again to fold back to the compact 360px height cap.',
    52,
    478
  );

  return new Promise<Uint8Array>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to encode simulated snip PNG'));
        return;
      }
      blob
        .arrayBuffer()
        .then((buf) => resolve(new Uint8Array(buf)))
        .catch(reject);
    }, 'image/png');
  });
}

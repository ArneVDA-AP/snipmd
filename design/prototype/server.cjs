const http=require('http');
const NONCE='n0nce';
const base="default-src 'self'; script-src 'self'; style-src 'self' 'nonce-"+NONCE+"'; img-src 'self' https: http:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";
const variants={ cur: base+"; frame-src 'none'", worker: base+"; frame-src 'none'; worker-src blob:", iframe: base+"; frame-src 'self'" };
const plugin = `self.onmessage=e=>{ if(e.data.t==='busy'){const t=Date.now();while(Date.now()-t<1500){}} if(e.data.t==='self'){fetch(e.data.url).then(r=>r.text()).then(x=>postMessage({t:'self',r:x}),x=>postMessage({t:'self',r:'blocked'}))} if(e.data.t==='ping') postMessage({t:'pong',id:e.data.id}); if(e.data.t==='probe'){ const r={}; Promise.allSettled([fetch('https://example.com/').then(()=>r.https='ok',x=>r.https='blocked'), fetch('/ipc-probe').then(()=>r.self='ok',x=>r.self='blocked')]).then(()=>{ try{importScripts('https://example.com/x.js');r.imp='ok'}catch(x){r.imp='blocked'} try{new Worker(URL.createObjectURL(new Blob([''])));r.nested='ok'}catch(x){r.nested='blocked:'+x.name} r.hasTauri=typeof self.__TAURI_INTERNALS__; postMessage({t:'probe',r}); }); } };
// simulate a real plugin's code size: path-completion-ish work
const big=[];for(let i=0;i<2000;i++)big.push('entry-'+i);`;
const frameHtml = `<!doctype html><meta charset=utf-8><script src="/frame.js"></script>`;
const frameJs = `addEventListener('message',e=>{ if(e.data.t==='busy'){const t=Date.now();while(Date.now()-t<1500){}} if(e.data.t==='ping') parent.postMessage({t:'pong',id:e.data.id},'*'); if(e.data.t==='probe'){const r={};fetch('https://example.com/').then(()=>r.https='ok',()=>r.https='blocked').then(()=>{try{r.parentDoc=typeof parent.document}catch(x){r.parentDoc='blocked'} r.origin=self.origin; parent.postMessage({t:'probe',r},'*')});} });`;
const page = `<!doctype html><meta charset=utf-8><style nonce="${NONCE}">body{font:14px sans-serif}</style><body><div id=info class=infobar>INFO BAR</div><script src="/main.js"></script>`;
const mainJs = `
window.PLUGIN_SRC=${JSON.stringify(plugin)};
window.spawnWorker=()=>new Promise(res=>{const t=performance.now();const w=new Worker(URL.createObjectURL(new Blob([PLUGIN_SRC],{type:'text/javascript'})));w.onmessage=e=>{if(e.data.t==='pong')res({ms:performance.now()-t});};w.onerror=e=>res({err:String(e.message)});w.postMessage({t:'ping',id:1});(window.W=window.W||[]).push(w);});
window.probeWorker=()=>new Promise(res=>{const w=window.W[0];w.onmessage=e=>{if(e.data.t==='probe')res(e.data.r)};w.postMessage({t:'probe'});});
window.spawnFrame=(mode)=>new Promise(res=>{const t=performance.now();const f=document.createElement('iframe');f.setAttribute('sandbox','allow-scripts');f.style.display='none';
 if(mode==='src') f.src='/frame.html'; else f.srcdoc='<script src="'+location.origin+'/frame.js"><\\/script>';
 const h=e=>{if(e.source===f.contentWindow&&e.data.t==='pong'){removeEventListener('message',h);res({ms:performance.now()-t});}};addEventListener('message',h);
 f.onload=()=>f.contentWindow.postMessage({t:'ping',id:1},'*');document.body.appendChild(f);(window.F=window.F||[]).push(f);setTimeout(()=>res({err:'timeout'}),3000);});
window.probeFrame=()=>new Promise(res=>{const f=window.F[0];const h=e=>{if(e.data.t==='probe'){removeEventListener('message',h);res(e.data.r)}};addEventListener('message',h);f.contentWindow.postMessage({t:'probe'},'*');setTimeout(()=>res('timeout'),3000)});
window.themeTest=(css)=>{const s=new CSSStyleSheet();s.replaceSync(css);document.adoptedStyleSheets=[...document.adoptedStyleSheets,s];return {rules:[...s.cssRules].map(r=>r.cssText),color:getComputedStyle(document.getElementById('info')).color,display:getComputedStyle(document.getElementById('info')).display};};
window.inlineStyleTest=()=>{const s=document.createElement('style');s.textContent='#info{color:rgb(1,2,3)}';document.head.appendChild(s);return getComputedStyle(document.getElementById('info')).color;};
`;
http.createServer((q,r)=>{const u=new URL(q.url,'http://x');const v=u.searchParams.get('csp')||'cur';
 if(u.pathname==='/'){r.writeHead(200,{'content-type':'text/html','content-security-policy':variants[v]});return r.end(page);}
 if(u.pathname==='/main.js'){r.writeHead(200,{'content-type':'text/javascript'});return r.end(mainJs);}
 if(u.pathname==='/frame.html'){r.writeHead(200,{'content-type':'text/html','content-security-policy':"default-src 'none'; script-src 'self'"});return r.end(frameHtml);}
 if(u.pathname==='/frame.js'){r.writeHead(200,{'content-type':'text/javascript','access-control-allow-origin':'*'});return r.end(frameJs);}
 r.writeHead(200,{'content-type':'text/plain'});r.end('ipc-ok');}).listen(4791);

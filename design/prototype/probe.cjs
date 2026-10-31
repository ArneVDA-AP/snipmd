const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const out={};
 // reach probes; the iframe busy-loop here is blocked by the CSP (inline script), see busy.cjs for the valid one
 for(const [csp,kind] of [['worker','w'],['iframe','fd'],['iframe','fs'],['cur','w']]){
  const pg=await b.newPage(); const errs=[]; pg.on('console',m=>errs.push(m.text().slice(0,140)));
  await pg.goto('http://localhost:4791/?csp='+csp);
  const sp=await pg.evaluate(k=>k==='w'?spawnWorker():spawnFrame(k==='fs'?'src':'doc'),kind);
  let reach=null; if(!sp.err) reach=await pg.evaluate(k=>k==='w'?probeWorker():probeFrame(),kind);
  out[csp+'/'+kind]={spawn:sp,reach,console:errs.filter(e=>/Content Security|Refused/.test(e)).slice(0,3)};
  await pg.close();}
 // theme: constructable stylesheet under nonce CSP; @import and url() handling; protected rule via layers
 const pg=await b.newPage(); const csp=[]; pg.on('console',m=>csp.push(m.text().slice(0,120)));
 await pg.goto('http://localhost:4791/?csp=cur');
 out.inlineStyleBlocked=await pg.evaluate(()=>inlineStyleTest());
 out.theme=await pg.evaluate(()=>themeTest('@import url(https://example.com/x.css); #info{color:rgb(9,9,9); background:url(https://example.com/beacon.png)} '));
 out.layerGuard=await pg.evaluate(()=>{const core=new CSSStyleSheet();core.replaceSync('@layer core, theme; @layer core{ #info{display:block !important; visibility:visible !important; opacity:1 !important} }');
   const th=new CSSStyleSheet();th.replaceSync('@layer theme{ #info{display:none !important; opacity:0 !important} }');document.adoptedStyleSheets=[core,th];const s=getComputedStyle(document.getElementById('info'));return {display:s.display,opacity:s.opacity};});
 out.cspConsole=csp.slice(0,4);
 console.log(JSON.stringify(out,null,1));await b.close();})();

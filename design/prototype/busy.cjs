const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const out={};
 for(const [csp,kind] of [['worker','w'],['iframe','fd'],['iframe','fs']]){
  const pg=await b.newPage(); await pg.goto('http://localhost:4791/?csp='+csp);
  await pg.evaluate(k=>k==='w'?spawnWorker():spawnFrame(k==='fs'?'src':'doc'),kind);
  out[csp+'/'+kind]=await pg.evaluate(k=>new Promise(res=>{let last=performance.now(),max=0;const iv=setInterval(()=>{const n=performance.now();max=Math.max(max,n-last);last=n;},10);
    if(k==='w') window.W[0].postMessage({t:'busy'}); else window.F[0].contentWindow.postMessage({t:'busy'},'*');
    setTimeout(()=>{clearInterval(iv);res(Math.round(max));},2500);}),kind);
  if(kind==='w') out.workerSelfFetch=await pg.evaluate(()=>new Promise(res=>{const w=window.W[0];w.onmessage=e=>{if(e.data.t==='self')res(e.data.r)};w.postMessage({t:'self',url:location.origin+'/ipc-probe'});}));
  await pg.close();}
 console.log(JSON.stringify(out));await b.close();})();

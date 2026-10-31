const {chromium}=require('playwright');const fs=require('fs');const {execSync}=require('child_process');
function procs(rootPid){ // all descendant pids with RSS (kB) and type
  const out=execSync('ps -eo pid,ppid,rss,args --no-headers').toString().trim().split('\n').map(l=>{const m=l.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/);return {pid:+m[1],ppid:+m[2],rss:+m[3],args:m[4]}});
  const set=new Set([rootPid]);let grew=true;while(grew){grew=false;for(const p of out)if(set.has(p.ppid)&&!set.has(p.pid)){set.add(p.pid);grew=true;}}
  const mine=out.filter(p=>set.has(p.pid));const r=mine.filter(p=>/--type=renderer/.test(p.args));
  return {total:mine.reduce((a,p)=>a+p.rss,0),renderers:r.length,rendererRss:r.reduce((a,p)=>a+p.rss,0)};
}
// PSS is fairer than RSS for shared pages; use smaps_rollup when available
function pss(rootPid){const out=execSync('ps -eo pid,ppid --no-headers').toString().trim().split('\n').map(l=>l.trim().split(/\s+/).map(Number));const set=new Set([rootPid]);let g=true;while(g){g=false;for(const [p,pp] of out)if(set.has(pp)&&!set.has(p)){set.add(p);g=true;}}
 let t=0;for(const p of set){try{const s=fs.readFileSync(`/proc/${p}/smaps_rollup`,'utf8');t+=+s.match(/^Pss:\s+(\d+)/m)[1];}catch{}}return t;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const results=[];
 for(const scen of [['baseline','cur',null,0],['worker x1','worker','w',1],['worker x3','worker','w',3],['worker x5','worker','w',5],['iframe srcdoc x1','iframe','fd',1],['iframe srcdoc x3','iframe','fd',3],['iframe src x1','iframe','fs',1],['iframe src x3','iframe','fs',3]]){
  const [name,csp,kind,n]=scen; const runs=[];
  for(let rep=0;rep<3;rep++){
   const srv=await chromium.launchServer(); const pid=srv.process().pid; const b=await chromium.connect(srv.wsEndpoint()); const ctx=await b.newContext(); const pg=await ctx.newPage();
   await pg.goto('http://localhost:4791/?csp='+csp); await sleep(800);
   const before=pss(pid); const lat=[];
   for(let i=0;i<n;i++){ lat.push(await pg.evaluate(k=>k==='w'?spawnWorker():spawnFrame(k==='fs'?'src':'doc'),kind)); }
   await sleep(1500); const cdp=await ctx.newCDPSession(pg); await cdp.send('Performance.enable'); const m=(await cdp.send('Performance.getMetrics')).metrics;
   const after=pss(pid); const pr=procs(pid);
   runs.push({deltaPssKB:after-before,renderers:pr.renderers,lat:lat.map(x=>x.ms?+x.ms.toFixed(1):x.err),heapMB:+(m.find(x=>x.name==='JSHeapUsedSize').value/1048576).toFixed(2)});
   await b.close(); await srv.close();
  }
  results.push({name,runs});
  console.log(name, JSON.stringify(runs));
 }
 fs.writeFileSync('results.json',JSON.stringify(results,null,1));
})();

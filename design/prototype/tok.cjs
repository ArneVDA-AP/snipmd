const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const pg=await b.newPage();const logs=[];pg.on('console',m=>logs.push(m.text().slice(0,90)));
await pg.goto('http://localhost:4791/?csp=cur');
const r=await pg.evaluate(()=>{const s=document.createElement('style');s.textContent='#info{color:var(--text,rgb(0,0,0))}';
 const el=document.getElementById('info');document.documentElement.style.setProperty('--text','rgb(7,8,9)');
 const a=getComputedStyle(document.documentElement).getPropertyValue('--text');
 document.documentElement.setAttribute('style','--x: rgb(1,1,1)');const b2=getComputedStyle(document.documentElement).getPropertyValue('--x');return {cssomSetProperty:a,setAttribute:b2};});
console.log(JSON.stringify(r),logs.filter(l=>/style/i.test(l)));await b.close();})();

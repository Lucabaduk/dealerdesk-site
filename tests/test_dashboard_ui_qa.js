// QA: dashboard pipeline prototype pollution, odd-status stock value, Upcoming time/customer columns.
const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),R=path.join(__dirname,'..');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('FAIL',m))};
const D=require('../modules/dashboard.js');
const p=D.pipeline([{status:'__proto__',price_cents:100},{status:'hasOwnProperty',price_cents:5}],[{status:'constructor',total_cents:7}]);
ok(({}).count===undefined&&Object.count===undefined,'no Object.prototype pollution');
ok(p.stages['__proto__']&&p.stages['__proto__'].count===1&&p.stages.constructor.count===1&&p.stages.hasownproperty.count===1,'odd stage names counted');
const iv=D.inventoryStats([{status:'available',price_cents:100},{status:'by_make',price_cents:999}],0);
ok(iv.stock_value_cents===100&&iv.avg_price_cents===100,'unknown status not in stock value');
const html=fs.readFileSync(R+'/app.html','utf8'),data=JSON.parse(fs.readFileSync(R+'/src/sample-data.json','utf8'));
const t=new Date(Date.now()+3*864e5);t.setHours(10,5,0,0);const X='<img src=x onerror="window.__xss=1">';
const w=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/app.html',beforeParse(w){
 w.localStorage.setItem('dealerdesk.v2',JSON.stringify({schema:2,test_drives:[{id:'t1',status:'requested',at:t.toISOString(),customer:{name:X}}],deals:[{id:'d',status:'__proto__',price_cents:1}]}));
 w.fetch=u=>String(u).startsWith('version')?new Promise(()=>{}):Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(JSON.stringify(data)))})}}).window;
setTimeout(()=>{const d=w.document;d.querySelector('[data-view=dashboard]').click();
 const row=[...d.querySelectorAll('table tr')].find(r=>/Test drive/.test(r.textContent));const c=row?row.children:[];
 ok(row&&/^\d{4}-\d\d-\d\d 10:05$/.test(c[0].textContent),'Upcoming shows local date/time, not epoch ms: '+(row&&c[0].textContent));
 ok(row&&c[2].textContent===X&&!row.querySelector('img')&&!w.__xss,'Upcoming customer shown escaped');
 ok(w.eval('({}).count')===undefined,'no pollution in page');
 console.log('dashboard ui qa: '+pass+' passed, '+fail+' failed');process.exit(fail?1:0)},1200);

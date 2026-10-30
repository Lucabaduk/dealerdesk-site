// QA: pipeline moves when several deals share a car, sold-elsewhere guard, bad stored stages, reload consistency.
const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),R=path.join(__dirname,'..');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('FAIL',m))};
const html=fs.readFileSync(R+'/app.html','utf8'),data=JSON.parse(fs.readFileSync(R+'/src/sample-data.json','utf8'));
const cid=data.cars.find(c=>c.status==='available').id;
data.leads.push({id:'ld-a',name:'Ann',status:'new',email:'a@example.com',interest_car_id:cid,source:'website'},{id:'ld-b',name:'Bob',status:'new',email:'b@example.com',interest_car_id:cid,source:'website'},{id:'ld-c',name:'Cy',status:'new',email:'c@example.com',interest_car_id:cid,source:'website'});
function boot(ls){return new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/app.html',beforeParse(w){if(ls)for(const k in ls)w.localStorage.setItem(k,ls[k]);w.confirm=()=>true;w.onerror=(m)=>{w.__err=m};w.fetch=u=>String(u).startsWith('version')?new Promise(()=>{}):Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(JSON.stringify(data)))})}}).window}
const w=boot();
setTimeout(()=>{const d=w.document,DD=w.DealerDesk;d.querySelector('[data-view=pipeline]').click();
 const move=(id,sg)=>{const s=d.querySelector('select[data-act=pstage][data-id="'+id+'"]');s.value=sg;s.dispatchEvent(new w.Event('change',{bubbles:true}))};
 const dl=l=>DD.state.deals.find(x=>x.lead_id===l);
 move('ld-a','negotiating');move('ld-b','test_drive');ok(dl('ld-a')&&dl('ld-b')&&DD.car(cid).status==='hold','two deals hold one car');
 move(dl('ld-a').id,'lost');ok(DD.car(cid).status==='hold','Lost on one deal keeps the hold of the other deal');
 move(dl('ld-b').id,'sold');ok(DD.car(cid).status==='sold','sold');
 move(dl('ld-a').id,'negotiating');ok(dl('ld-a').status==='lost'&&DD.car(cid).status==='sold'&&/already sold/.test(d.getElementById('toast').textContent),'cannot reopen a deal on a car another deal sold');
 const n=DD.state.deals.length;move('ld-c','negotiating');ok(DD.state.deals.length===n&&!dl('ld-c'),'lead on a sold car makes no orphan deal');
 move(dl('ld-a').id,'lost');ok(DD.car(cid).status==='sold','Lost on other deal does not unsell the car');
 // reload consistency
 const raw=w.localStorage.getItem('dealerdesk.v2'),j=JSON.parse(raw);j.deals.push({id:'dl-p',car_id:cid,buyer:'P',price_cents:1,status:'pending',stage:'__proto__',date:'2026-10-30'},{id:'dl-q',car_id:cid,buyer:'Q',price_cents:1,status:'pending',stage:'constructor',date:'2026-10-30'});
 const w2=boot({'dealerdesk.v2':JSON.stringify(j)});setTimeout(()=>{const d2=w2.document;d2.querySelector('[data-view=pipeline]').click();
  ok(d2.querySelector('.pcol[data-stage=negotiating] .pcard[data-id="dl-p"]')&&d2.querySelector('.pcol[data-stage=negotiating] .pcard[data-id="dl-q"]'),'__proto__/constructor stages fall back to Negotiating');
  ok(w2.DealerDesk.car(cid).status==='sold','car stays sold after reload');ok(!w2.__err,'no errors: '+w2.__err);
  const w3=boot({'dealerdesk.v2':'{"deals":"x","leads":{"__proto__":1}'});setTimeout(()=>{let e=null;try{w3.document.querySelector('[data-view=pipeline]').click()}catch(x){e=x}ok(!e&&w3.document.querySelector('.board'),'malformed storage still renders board');
   console.log('pipeline qa: '+pass+' passed, '+fail+' failed');process.exit(fail?1:0)},900)},900)},1200);

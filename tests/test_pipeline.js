// Deals pipeline board: columns, moves via stage menu, Sold marks car sold, Lost frees it, escaping, lead -> deal.
const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),R=path.join(__dirname,'..');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('FAIL',m))};
const html=fs.readFileSync(R+'/app.html','utf8'),data=JSON.parse(fs.readFileSync(R+'/src/sample-data.json','utf8'));
const bad='<img src=x onerror="window.__xss=1">';data.leads.push({id:'ld-x',name:bad,status:'new',email:'x@example.com',interest_car_id:data.cars[1].id,source:'website'},{id:'ld-n',name:'No Car',status:'contacted',phone:'313-555-0100',source:'phone'});
function boot(ls){return new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/app.html',beforeParse(w){if(ls)for(const k in ls)w.localStorage.setItem(k,ls[k]);w.confirm=()=>true;w.fetch=u=>String(u).startsWith('version')?new Promise(()=>{}):Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(JSON.stringify(data)))})}}).window}
const w=boot();
setTimeout(()=>{const d=w.document,DD=w.DealerDesk;const nav=v=>d.querySelector('[data-view="'+v+'"]').click();
 nav('pipeline');const cols=[...d.querySelectorAll('.pcol')].map(c=>c.querySelector('h3').firstChild.textContent.trim());
 ok(cols.join('|')==='Lead|Test drive|Negotiating|Reserved/Ordered|Sold|Lost','six columns: '+cols.join('|'));
 const xc=d.querySelector('.pcard[data-id="ld-x"]');ok(xc&&!xc.querySelector('img')&&xc.textContent.includes(bad)&&!w.__xss,'escaped text only');
 const move=(id,sg)=>{const s=d.querySelector('select[data-act=pstage][data-id="'+id+'"]');s.value=sg;s.dispatchEvent(new w.Event('change',{bubbles:true}))};
 move('ld-x','test_drive');const deal=DD.state.deals.find(x=>x.lead_id==='ld-x');
 ok(deal&&deal.stage==='test_drive'&&deal.status==='pending'&&DD.car(deal.car_id).status==='hold','lead -> deal in Test drive, car on hold');
 ok(d.querySelector('.pcol[data-stage=test_drive] .pcard[data-id="'+deal.id+'"]'),'card in Test drive column');ok(!d.querySelector('.pcard[data-id="ld-x"]'),'lead card replaced by deal card');
 move(deal.id,'reserved');ok(DD.state.deals.find(x=>x.id===deal.id).stage==='reserved','moved to Reserved');
 move(deal.id,'sold');let dd=DD.state.deals.find(x=>x.id===deal.id);ok(dd.status==='closed'&&DD.car(dd.car_id).status==='sold','Sold closes deal and marks car sold');
 ok(DD.state.leads.find(l=>l.id==='ld-x').status==='won','lead won');
 move(deal.id,'lost');dd=DD.state.deals.find(x=>x.id===deal.id);ok(dd.status==='lost'&&DD.car(dd.car_id).status==='available','Lost frees the car');
 move(deal.id,'lead');ok(/Lead/.test(d.getElementById('toast').textContent)&&DD.state.deals.find(x=>x.id===deal.id).status==='lost','deal cannot go back to Lead');
 move('ld-n','negotiating');ok(!DD.state.deals.some(x=>x.lead_id==='ld-n')&&/pick a car/i.test(d.getElementById('toast').textContent),'lead without car asks for a car');
 move('ld-n','lost');ok(DD.state.leads.find(l=>l.id==='ld-n').status==='lost'&&d.querySelector('.pcol[data-stage=lost] .pcard[data-id="ld-n"]'),'lead to Lost');
 const sel=d.querySelector('select[data-act=pstage]');sel.innerHTML+='<option value="__proto__">x</option>';sel.value='__proto__';sel.dispatchEvent(new w.Event('change',{bubbles:true}));ok(/stage/i.test(d.getElementById('toast').textContent),'unknown stage rejected');
 // persisted
 const w2=boot({'dealerdesk.v2':w.localStorage.getItem('dealerdesk.v2')});setTimeout(()=>{const x=w2.DealerDesk.state.deals.find(q=>q.id===deal.id);ok(x&&x.lead_id==='ld-x','deal stage data persists');
  // old deals without stage still appear (pending -> Negotiating)
  w2.document.querySelector('[data-view=deals]').click();const f=w2.document.querySelector('[data-form=deal]');const av=w2.DealerDesk.cars().find(c=>c.status==='available');f.elements.car_id.value=av.id;f.elements.buyer.value='Pat';f.elements.price.value='1000';f.dispatchEvent(new w2.Event('submit',{bubbles:true,cancelable:true}));
  w2.document.querySelector('[data-view=pipeline]').click();ok([...w2.document.querySelectorAll('.pcol[data-stage=negotiating] .pcard b')].some(b=>b.textContent==='Pat'),'classic deal shows in Negotiating');
  console.log('pipeline: '+pass+' passed, '+fail+' failed');process.exit(fail?1:0)},800)},1200);

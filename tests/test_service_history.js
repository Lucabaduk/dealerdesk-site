// Customer service history: grouping by phone/email/name, timeline, search, escaping, bad saved data, app tab.
const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),R=path.join(__dirname,'..');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('FAIL',m))};
const H=require(R+'/modules/service-history.js');
const bad='<img src=x onerror="window.__xss=1">';
const cars=[{id:'car-1',stock_no:'S100',year:2022,make:'Ford',model:'F-150'},{id:'car-2',stock_no:'S200',year:2021,make:'Honda',model:'Civic'}];
const state={service_bookings:[{id:'sv1',customer:{name:'Priya Shah',phone:'313-555-0199'},car_id:'car-1',service_type:'oil_change',at:'2026-10-01T08:00',status:'done',cost_cents:8999},null,'junk',{id:'sv2',customer:{name:bad,phone:'(248) 555-0101'},vehicle:{year:2019,make:'Kia',model:'Soul'},service_type:'brakes',at:'2026-09-01',status:'booked'}],
 test_drives:[{id:'td1',customer:{name:'priya  SHAH',phone:'+1 313 555 0199'},car_id:'car-2',at:'2026-10-05T10:00',status:'confirmed'}],
 leads:[{id:'l1',name:'Taylor Kim',email:'Taylor@Example.com',interest_car_id:'car-2',status:'new'}],deals:[{id:'d1',buyer:'Nobody Contact',car_id:'car-1',price_cents:3000000,status:'closed',date:'2026-08-01'}]};
const ls={dealerdesk_booking:JSON.stringify({v:1,services:[{id:'b1',customer:'Taylor Kim',phone:'734-555-0123',email:'taylor@example.com',date:'2026-10-10',time:'09:00',type:'tires',stock:'S200',status:'booked'},5],testDrives:'nope',requests:null}),
 dealerdesk_orders:JSON.stringify({v:1,orders:[{id:'o1',name:'P. Shah',phone:'3135550199',stock:'S100',carLabel:'2022 Ford F-150',price:41000,status:'new',createdAt:Date.parse('2026-10-20T12:00'),kind:'reserve',code:'DD-1'},{}]})};
const get=k=>ls[k]||null;
const list=H.collect({state,cars,getItem:get});
const priya=list.find(g=>g.phones.some(p=>p.replace(/\D/g,'').endsWith('3135550199')));
ok(priya&&priya.events.length===3,'Priya: service + test drive + order merged by phone ('+(priya&&priya.events.length)+')');
ok(priya&&priya.events[0].kind==='Order'&&priya.events[2].kind==='Service','timeline newest first');
ok(priya&&priya.spent===8999&&priya.services===1,'service spend counted');
ok(priya&&priya.events.find(e=>e.kind==='Service').stock==='S100'&&/F-150/.test(priya.events[0].model),'stock and model resolved');
const tk=list.filter(g=>/taylor/i.test(g.name));ok(tk.length===1&&tk[0].events.length===2,'Taylor lead + booking merged by email');
ok(list.some(g=>g.name==='Nobody Contact'),'deal buyer by name');
ok(H.search(list,'555-0199').length===1&&H.search(list,'S200').length>=2&&H.search(list,'zzz').length===0,'search phone/stock');
ok(Array.isArray(H.collect({getItem:()=>'{bad json'}))&&H.collect({state:{service_bookings:'x',leads:{}},getItem:()=>'[]'}).length===0,'bad saved data ignored');
ok(H.collect().length===0,'no input ok');
// UI escaping
const dom=new JSDOM('<div id=e></div>',{runScripts:'outside-only'});const w=dom.window;w.eval(fs.readFileSync(R+'/modules/service-history.js','utf8'));
const el=w.document.getElementById('e');w.DDServiceHistory.open('248');w.DDServiceHistory.mount(el,{state,cars,getItem:get});
ok(!el.querySelector('img')&&el.textContent.includes(bad)&&!w.__xss,'user text escaped');
ok(el.querySelectorAll('.sh-c').length===1,'search filter applied in UI');
const q=el.querySelector('[data-sh-q]');q.value='';q.dispatchEvent(new w.Event('input',{bubbles:true}));ok(el.querySelectorAll('.sh-c').length===list.length,'clearing search shows all');
const b=[...el.querySelectorAll('.sh-c')].find(x=>/Taylor/.test(x.textContent));b.click();ok(/Tires/.test(el.querySelector('.sh-tl').textContent)&&el.querySelector('.sh-c.on').textContent.includes('Taylor'),'select customer shows timeline');
ok(el.querySelector('a[href="mailto:taylor@example.com"]'),'contact links');
// staff app tab
const html=fs.readFileSync(R+'/app.html','utf8'),data=JSON.parse(fs.readFileSync(R+'/src/sample-data.json','utf8'));
ok(html.includes('modules/service-history.js'),'app loads module');
const aw=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/app.html',beforeParse(x){for(const k in ls)x.localStorage.setItem(k,ls[k]);x.fetch=u=>String(u).startsWith('version')?new Promise(()=>{}):Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(JSON.stringify(data)))})}}).window;
// inject module directly (no server): emulate script load
aw.document.addEventListener('DOMContentLoaded',()=>{});
setTimeout(()=>{if(!aw.DDServiceHistory)aw.eval(fs.readFileSync(R+'/modules/service-history.js','utf8'));const d=aw.document,btn=d.querySelector('[data-view=customers]');ok(btn&&/Customers/.test(btn.textContent),'Customers tab in nav');
 btn.click();const sh=d.getElementById('svchist');ok(sh&&sh.querySelectorAll('.sh-c').length>=3,'tab lists customers from app + booking + orders ('+(sh&&sh.querySelectorAll('.sh-c').length)+')');
 aw.DealerDesk.openHistory('Taylor');ok(d.querySelectorAll('#svchist .sh-c').length===1,'openHistory pre-filters');
 console.log('service-history: '+pass+' passed, '+fail+' failed');process.exit(fail?1:0)},1500);

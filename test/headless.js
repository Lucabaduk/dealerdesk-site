const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path');
const R=path.join(__dirname,'..'),html=fs.readFileSync(R+'/app.html','utf8'),carsJson=JSON.parse(fs.readFileSync(R+'/cars.json','utf8'));
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('FAIL',m))};
const tick=()=>new Promise(r=>setTimeout(r,30));
function boot(o={}){const d=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/app.html'+(o.q||'')+(o.hash||''),beforeParse(w){if(o.v2)w.localStorage.setItem('dealerdesk.v2',o.v2);if(o.v1)w.localStorage.setItem('dealerdesk.v1',o.v1);w.confirm=()=>true;
 w.fetch=(u)=>{(w.__f=w.__f||[]).push(u);return u.startsWith('version')?new Promise(()=>{}):Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(JSON.stringify(o.data||carsJson)))})}}});return d.window}
(async()=>{
let w=boot();await tick();let doc=w.document,DD=w.DealerDesk;const nav=v=>doc.querySelector('[data-view="'+v+'"]').click();
function submit(k,vals){const f=doc.querySelector('[data-form="'+k+'"]');for(const n in vals){f.elements[n].value=vals[n]}f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}))}
ok(DD.cars().length===carsJson.cars.length,'cars loaded from cars.json');ok(DD.state.leads.length===carsJson.leads.length,'leads seeded');
ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(html),'no emoji');ok(!w.__f.some(u=>u.startsWith('version')),'no poll without watch');
nav('inventory');const imgs=[...doc.querySelectorAll('img.thumb')];ok(imgs.length===Math.min(50,carsJson.cars.length)&&imgs.every(i=>i.getAttribute('loading')==='lazy'),'lazy thumbs, paged');
ok(imgs.every(i=>/^assets\//.test(i.getAttribute('src'))),'photos or no-photo.webp');
// big list paging
const big=JSON.parse(JSON.stringify(carsJson));const t=big.cars[0];big.cars=[];big.test_drives=[];big.leads=[];for(let i=0;i<1200;i++)big.cars.push({...t,id:'b'+i,stock_no:'S'+i,photos:i%3?t.photos:[]});
let wb=boot({data:big});await tick();wb.document.querySelector('[data-view=inventory]').click();ok(wb.document.querySelectorAll('tr[data-car]').length===50,'50 per page of 1200');
ok(wb.document.querySelector('[data-act=pg][data-id="1"]'),'next page');ok(wb.document.querySelector('img[src="assets/site/no-photo.webp"]'),'no-photo fallback');
// search/filter
const mk=carsJson.cars[0].make;const sel=doc.querySelector('[data-inv=make]');sel.value=mk;sel.dispatchEvent(new w.Event('change',{bubbles:true}));
ok([...doc.querySelectorAll('tr[data-car]')].length===carsJson.cars.filter(c=>c.make===mk).length,'make filter');
// add car via schema
doc.querySelector('[data-form=car]')&&submit('car',{stock_no:'T1',vin:'1HGCM82633A004352',year:2020,make:'Testa',model:'One',price:15000,mileage:1000,photo:'javascript:alert(1)'});
let c=DD.cars().find(x=>x.stock_no==='T1');ok(c&&c.price_cents===1500000&&c.photos.length===0,'add car normalized, bad photo dropped');
submit('car',{stock_no:'T2',vin:'BADVIN',year:2020,make:'x',model:'y',price:1});ok(!DD.cars().some(x=>x.stock_no==='T2')&&/Vin/i.test(doc.getElementById('toast').textContent),'schema error shown');
submit('car',{stock_no:'T3',vin:'1HGCM82633A004353',year:2020,make:'<b>x',model:'y',price:1});ok(!doc.querySelector('main td b'),'escaped');
// deals
nav('deals');submit('deal',{car_id:c.id,buyer:'Pat',price:14500,staff_id:'st-2'});let d=DD.state.deals[0];ok(d.status==='pending'&&DD.car(c.id).status==='hold','deal pending holds car');
doc.querySelector('[data-act=closedeal][data-id="'+d.id+'"]').click();ok(DD.car(c.id).status==='sold'&&doc.querySelector('.pill.closed'),'close -> sold');
nav('dashboard');ok(doc.querySelector('[data-kpi="Cars sold"] b').textContent==='1','dashboard sold');
// leads + bookings through schema
nav('leads');submit('lead',{name:'Q',phone:'12'});ok(DD.state.leads.length===carsJson.leads.length,'bad phone rejected');
submit('lead',{name:'Q',phone:'(313) 555-0100'});ok(DD.state.leads.length===carsJson.leads.length+1,'lead added');
let ev=0;DD.on('booking',()=>ev++);DD.addServiceBooking({customer:{name:'Z',phone:'3135550100'},vehicle:{year:2018,make:'A',model:'B'},service_type:'tires',at:'2026-11-03T09:00'});ok(ev===1,'booking hook');
let threw=false;try{DD.addTestDrive({customer:{name:'Z'},car_id:c.id,at:'2026-11-03T09:00'})}catch(e){threw=!!e.field}ok(threw,'testdrive validates');
nav('staff');submit('staff',{name:'New Rep',role:'Finance'});ok(DD.state.staff.length===4,'staff');
nav('settings');submit('settings',{dealer_name:'Lakeview Auto',currency:'EUR',tax_rate:7});ok(doc.querySelector('nav h1').textContent==='Lakeview Auto','settings');
// persistence (only overrides stored)
const saved=w.localStorage.getItem('dealerdesk.v2');ok(saved.length<20000,'stores only edits');let w2=boot({v2:saved});await tick();ok(w2.DealerDesk.state.settings.tax_rate===7&&w2.DealerDesk.car(c.id).status==='sold','persist');
w2.DealerDesk.registerView('qr',{label:'QR',render:()=>'<h2>QR</h2>'});ok(w2.document.querySelector('[data-view=qr]'),'registerView');
w2.document.querySelector('[data-view=settings]').click();w2.document.querySelector('[data-act=reset]').click();ok(w2.DealerDesk.state.deals.length===0&&w2.DealerDesk.cars().length===carsJson.cars.length,'reset');
// v1 migration
const v1=JSON.stringify({cars:[{id:'c1',vin:'x'},{id:'cx',vin:'1HGCM82633A004352',make:'Old',model:'Car',year:2015,price:9000,mileage:5,status:'Sold'}],leads:[{id:'l9',name:'Mig',phone:'313-555-0101',carId:'cx',source:'QR',status:'Closed'}],deals:[{id:'d9',carId:'cx',buyer:'B',price:8800,staffId:'s1',status:'Closed'}],staff:[{id:'s1',name:'Dana',role:'Sales'}],settings:{dealer:'Old Lot',taxRate:5}});
let w3=boot({v1});await tick();const S3=w3.DealerDesk.state;ok(S3.settings.dealer_name==='Old Lot'&&S3.cars_added.length===1&&S3.cars_added[0].status==='sold'&&S3.leads[0].status==='won'&&S3.deals[0].price_cents===880000,'v1 migrated');
let w4=boot({v2:'{bad'});await tick();ok(w4.DealerDesk.cars().length===carsJson.cars.length,'corrupt storage recovers');
// QR deep link
let w5=boot({hash:'#lead?car='+carsJson.cars[1].id});await tick();ok(w5.document.querySelector('[name=interest_car_id]').value===carsJson.cars[1].id,'QR preselect');
// watch poll
let w6=boot({q:'?watch=1'});await tick();ok(w6.__f.some(u=>u.startsWith('version.json?t=')),'watch polls version.json');
const idx=fs.readFileSync(R+'/index.html','utf8');ok(/app\.html/.test(idx)&&/watch=1/.test(idx)&&!/TableTop/i.test(idx+html),'site ok, no TableTop');
console.log(pass+' passed, '+fail+' failed');process.exit(fail?1:0)})();

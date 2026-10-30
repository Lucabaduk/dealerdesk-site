const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','app.html'),'utf8');let pass=0,fail=0;
function ok(c,m){c?pass++:(fail++,console.log('FAIL',m))}
function boot(store){const d=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/app.html',beforeParse(w){if(store)w.localStorage.setItem('dealerdesk.v1',store);w.confirm=()=>true}});return d.window}
let w=boot(),doc=w.document,DD=w.DealerDesk;
ok(DD.db.cars.length===4,'sample cars');ok(doc.querySelector('[data-kpi="Cars sold"] b').textContent==='1','sold kpi');
ok(!/[\u{1F300}-\u{1FAFF}]/u.test(html),'no emoji');ok(doc.querySelectorAll('.nophoto').length===0,'dash');
function nav(v){doc.querySelector('[data-view="'+v+'"]').click()}
function submit(k,vals){const f=doc.querySelector('[data-form="'+k+'"]');for(const n in vals){f.elements[n].value=vals[n]}f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}))}
nav('inventory');ok(doc.querySelectorAll('.nophoto').length===4,'no-photo placeholders');
submit('car',{vin:'jt2bf22k1w0123456',make:'Toyota',model:'Camry',year:2019,price:18000,mileage:50000,photo:'javascript:x'});
let c=DD.db.cars.at(-1);ok(c.vin==='JT2BF22K1W0123456'&&c.photo==='','car add + photo sanitized');
submit('car',{vin:'X',make:'<b>',model:'m',year:2020,price:1,mileage:1,photo:''});ok(!doc.querySelector('main b'),'escaped');
nav('deals');submit('deal',{carId:c.id,buyer:'Pat',price:17500,staffId:'s2'});ok(DD.db.deals.at(-1).status==='Pending'&&c.status==='Pending','deal pending');
doc.querySelector('[data-act="closedeal"][data-id="'+DD.db.deals.at(-1).id+'"]').click();ok(DD.db.cars.find(x=>x.id===c.id).status==='Sold','close marks sold');
nav('leads');submit('lead',{name:'Q',phone:'1',source:'QR'});ok(DD.db.leads.length===3,'lead');
let ev=0;DD.on('booking',()=>ev++);DD.addBooking({type:'Service',name:'Z',when:'2026-11-01T09:00'});ok(ev===1&&DD.db.bookings.length===3,'booking hook');
nav('staff');submit('staff',{name:'New Rep',role:'Finance'});ok(DD.db.staff.length===4,'staff');
nav('settings');submit('settings',{dealer:'Lakeview Auto',currency:'EUR',taxRate:7});ok(doc.querySelector('nav h1').textContent==='Lakeview Auto','settings');
const saved=w.localStorage.getItem('dealerdesk.v1');let w2=boot(saved);ok(w2.DealerDesk.db.settings.taxRate===7&&w2.DealerDesk.db.cars.length===6,'persist');
w2.DealerDesk.registerView('qr',{label:'QR',render:()=>'<h2>QR</h2>'});ok(w2.document.querySelector('[data-view="qr"]'),'registerView');
w2.document.querySelector('[data-view="settings"]').click();w2.document.querySelector('[data-act="reset"]').click();ok(w2.DealerDesk.db.cars.length===4,'reset');
let w3=boot('{bad');ok(w3.DealerDesk.db.cars.length===4,'corrupt storage recovers');
console.log(pass+' passed, '+fail+' failed');process.exit(fail?1:0);

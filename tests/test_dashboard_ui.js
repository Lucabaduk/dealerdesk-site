// Dashboard tab uses Helper's DealerDeskDashboard (inlined in app.html); needs-attention is escaped text only.
const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),R=path.join(__dirname,'..');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('FAIL',m))};
const html=fs.readFileSync(R+'/app.html','utf8'),data=JSON.parse(fs.readFileSync(R+'/src/sample-data.json','utf8'));
const bad='<img src=x onerror="window.__xss=1">';
const w=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/app.html',beforeParse(w){
 w.localStorage.setItem('dealerdesk.leads.v1',JSON.stringify([{id:'w1',name:bad,status:'new',createdAt:Date.now()-3*864e5,vin:'1HGCM82633A004352'}]));
 w.fetch=u=>String(u).startsWith('version')?new Promise(()=>{}):Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(JSON.stringify(data)))})}}).window;
setTimeout(()=>{const d=w.document;ok(w.DealerDeskDashboard&&typeof w.DealerDeskDashboard.summary==='function','DealerDeskDashboard loaded');
 d.querySelector('[data-view=dashboard]').click();const box=d.getElementById('needs-attention');
 ok(box&&box.querySelectorAll('li').length>=1,'needs-attention list shown');ok(box&&!box.querySelector('img'),'no HTML injected');ok(box&&box.textContent.includes(bad),'name shown as text');ok(!w.__xss,'no script ran');
 ok(d.querySelector('[data-kpi="Average age"]'),'average age KPI');
 {d.querySelector('[data-view=inventory]').click();const g=d.querySelector('[data-form=car]');const v={stock_no:'LA1',vin:'1HGCM82633A004352',year:2021,make:'Honda',model:'Civic',price:20000,mileage:100};for(const k in v)g.elements[k].value=v[k];if(g.elements.condition)g.elements.condition.value='used';g.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));}
 const added=w.DealerDesk.state.cars_added.find(c=>c.stock_no==='LA1');ok(added&&/^\d{4}-\d\d-\d\dT/.test(added.listed_at),'new car gets listed_at');
 if(added){w.DealerDesk.setCar(added.id,{status:'hold'});ok(w.DealerDesk.state.cars_added.find(c=>c.stock_no==='LA1').listed_at===added.listed_at,'listed_at kept on edit')}
 console.log('dashboard ui: '+pass+' passed, '+fail+' failed');process.exit(fail?1:0)},1200);

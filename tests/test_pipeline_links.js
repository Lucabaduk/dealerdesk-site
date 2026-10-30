// Pipeline cards link to the lead drawer only when DDLeads has the same id and linkFor() returns a safe staff-inventory link; href escaped.
const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),R=path.join(__dirname,'..');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('FAIL',m))};
const html=fs.readFileSync(R+'/app.html','utf8'),data=JSON.parse(fs.readFileSync(R+'/src/sample-data.json','utf8'));
const mods=['store.js','leads.js'].map(f=>fs.readFileSync(R+'/modules/'+f,'utf8'));
data.leads=[{id:'ld-match',name:'Match',email:'m@example.com',status:'new',source:'website',interest_car_id:data.cars[1].id},{id:'ld-other',name:'Other',email:'o@example.com',status:'new',source:'website'}];data.test_drives=[];data.service_bookings=[];
const web=[{id:'ld-match',status:'new',name:'Match',email:'m@example.com',vin:'1HGCM82633A004352',createdAt:1.7e12}];
const w=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/app.html',beforeParse(w){w.localStorage.setItem('dealerdesk.leads.v1',JSON.stringify(web));mods.forEach(m=>w.eval(m));w.fetch=u=>String(u).startsWith('version')?new Promise(()=>{}):Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(JSON.stringify(data)))})}}).window;
setTimeout(()=>{const d=w.document,nav=v=>d.querySelector('[data-view='+v+']').click();ok(typeof w.DDLeads.linkFor==='function','DDLeads loaded');nav('pipeline');
 const card=id=>[...d.querySelectorAll('.pcard')].find(c=>c.getAttribute('data-id')===id);
 let a=card('ld-match')&&card('ld-match').querySelector('a.plink');ok(a&&a.getAttribute('href')==='staff-inventory.html?lead=ld-match'&&a.textContent==='Open lead','matching lead links to drawer');
 ok(card('ld-other')&&!card('ld-other').querySelector('a.plink'),'no link when DDLeads has no such id');
 const s=d.querySelector('select[data-act=pstage][data-id="ld-match"]');s.value='negotiating';s.dispatchEvent(new w.Event('change',{bubbles:true}));
 const deal=w.DealerDesk.state.deals.find(x=>x.lead_id==='ld-match');a=deal&&card(deal.id)&&card(deal.id).querySelector('a.plink');ok(a&&a.getAttribute('href')==='staff-inventory.html?lead=ld-match','deal card links to its lead');
 const real=w.DDLeads.linkFor;w.DDLeads.linkFor=()=>'';nav('dashboard');nav('pipeline');ok(!d.querySelector('a.plink'),'empty linkFor -> no link');
 w.DDLeads.linkFor=()=>'javascript:alert(1)';nav('dashboard');nav('pipeline');ok(!d.querySelector('a.plink'),'unsafe link refused');
 w.DDLeads.linkFor=()=>'staff-inventory.html?lead="><img src=x onerror=alert(1)>';nav('dashboard');nav('pipeline');ok(!d.querySelector('.pcard img')&&d.querySelector('a.plink')&&d.querySelector('a.plink').getAttribute('href').includes('"><img'),'href escaped, no markup');
 w.DDLeads.linkFor=real;ok(w.DDLeads.linkFor('bad id<>')==='','linkFor rejects unsafe id');
 console.log('pipeline links: '+pass+' passed, '+fail+' failed');process.exit(fail?1:0)},1200);

// Pipeline cards link to the lead drawer only when DDLeads has the same id and linkFor() gives a safe link; href escaped.
const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),R=path.join(__dirname,'..');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('FAIL',m))};
const html=fs.readFileSync(R+'/app.html','utf8'),data=JSON.parse(fs.readFileSync(R+'/src/sample-data.json','utf8'));
const mods=['store.js','leads.js'].map(f=>fs.readFileSync(R+'/modules/'+f,'utf8'));
data.leads=[{id:'ld-match',name:'Match',email:'m@example.com',status:'new',source:'website'},{id:'ld-other',name:'Other',email:'o@example.com',status:'new',source:'website'},{id:'ld-x"><b>',name:'Quote',email:'q@example.com',status:'new',source:'website'}];data.test_drives=[];data.service_bookings=[];
const web=[{id:'ld-match',status:'new',name:'Match',email:'m@example.com',vin:'1HGCM82633A004352',createdAt:1.7e12},{id:'ld-x"><b>',status:'new',name:'Quote',email:'q@example.com',vin:'1HGCM82633A004352',createdAt:1.7e12}];
const w=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/app.html',beforeParse(w){w.localStorage.setItem('dealerdesk.leads.v1',JSON.stringify(web));mods.forEach(m=>w.eval(m));w.fetch=u=>String(u).startsWith('version')?new Promise(()=>{}):Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(JSON.stringify(data)))})}}).window;
setTimeout(()=>{const d=w.document;ok(typeof w.DDLeads.linkFor==='function','DDLeads loaded');d.querySelector('[data-view=pipeline]').click();console.log(d.getElementById('toast').textContent,[...d.querySelectorAll('.pcard')].map(c=>c.getAttribute('data-id')));
 const card=id=>[...d.querySelectorAll('.pcard')].find(c=>c.getAttribute('data-id')===id);
 const a=card('ld-match')&&card('ld-match').querySelector('a.plink');ok(a&&a.getAttribute('href')==='staff-inventory.html?lead=ld-match','matching lead links to drawer');
 ok(card('ld-other')&&!card('ld-other').querySelector('a.plink'),'no link when DDLeads has no such id');
 const q=card('ld-x"><b>');ok(q&&!q.querySelector('b b')&&!(q.querySelector('a.plink')&&/["<>]/.test(decodeURIComponent(q.querySelector('a.plink').getAttribute('href')).replace('staff-inventory.html?lead=','')&&!/%22|%3C/.test(q.querySelector('a.plink').getAttribute('href')))),'odd id: no raw HTML, link empty or encoded');
 ok(!d.querySelector('.pcard b b'),'no injected markup');
 console.log('pipeline links: '+pass+' passed, '+fail+' failed');process.exit(fail?1:0)},1200);

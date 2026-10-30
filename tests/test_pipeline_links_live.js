// Pipeline 'Open lead' links pick up leads added/removed in another tab (storage event) or on focus, without reload; no re-render while a stage menu is focused.
const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),R=path.join(__dirname,'..');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('FAIL',m))};
const html=fs.readFileSync(R+'/app.html','utf8'),data=JSON.parse(fs.readFileSync(R+'/src/sample-data.json','utf8'));
const mods=['store.js','leads.js'].map(f=>fs.readFileSync(R+'/modules/'+f,'utf8'));
data.leads=[{id:'ld-a',name:'A',email:'a@example.com',status:'new',source:'website'}];data.test_drives=[];data.service_bookings=[];
const webA=[{id:'ld-a',status:'new',name:'A',email:'a@example.com',vin:'1HGCM82633A004352',createdAt:1.7e12}];
const w=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/app.html',beforeParse(w){mods.forEach(m=>w.eval(m));w.fetch=u=>String(u).startsWith('version')?new Promise(()=>{}):Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(JSON.stringify(data)))})}}).window;
setTimeout(()=>{const d=w.document;d.querySelector('[data-view=pipeline]').click();const link=()=>d.querySelector('.pcard[data-id="ld-a"] a.plink');
 ok(!link(),'no link before the lead exists');
 w.localStorage.setItem('dealerdesk.leads.v1',JSON.stringify(webA));w.dispatchEvent(new w.StorageEvent('storage',{key:'dealerdesk.leads.v1'}));ok(link(),'link appears after storage event');
 w.localStorage.setItem('dealerdesk.leads.v1','[]');w.dispatchEvent(new w.Event('focus'));ok(!link(),'link removed on focus after delete');
 w.localStorage.setItem('dealerdesk.leads.v1',JSON.stringify(webA));const sel=d.querySelector('select[data-act=pstage]');sel.focus();w.dispatchEvent(new w.Event('focus'));ok(d.activeElement===sel&&!link(),'no re-render while stage menu focused');
 sel.blur();w.dispatchEvent(new w.Event('focus'));ok(link(),'refreshes once menu not focused');
 console.log('pipeline links live: '+pass+' passed, '+fail+' failed');process.exit(fail?1:0)},1200);

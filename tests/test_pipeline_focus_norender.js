// Pipeline only re-renders on focus/storage when the stored leads string actually changed; a change skipped while a menu is focused is applied on the next focus.
const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),R=path.join(__dirname,'..');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('FAIL',m))};
const html=fs.readFileSync(R+'/app.html','utf8'),data=JSON.parse(fs.readFileSync(R+'/src/sample-data.json','utf8'));
data.leads=[{id:'ld-a',name:'A',email:'a@example.com',status:'new',source:'website'}];data.test_drives=[];data.service_bookings=[];
const webA=JSON.stringify([{id:'ld-a',status:'new',name:'A',email:'a@example.com',vin:'1HGCM82633A004352',createdAt:1.7e12}]);
const w=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/app.html',beforeParse(w){['store.js','leads.js'].forEach(f=>w.eval(fs.readFileSync(R+'/modules/'+f,'utf8')));w.fetch=u=>String(u).startsWith('version')?new Promise(()=>{}):Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(JSON.stringify(data)))})}}).window;
setTimeout(()=>{const d=w.document,n=()=>w.__plRenders||0,link=()=>d.querySelector('.pcard[data-id="ld-a"] a.plink');d.querySelector('[data-view=pipeline]').click();
 const mark=d.querySelector('.pcol');for(let i=0;i<5;i++)w.dispatchEvent(new w.Event('focus'));ok(n()===0&&d.querySelector('.pcol')===mark,'5 focuses, no change: no redraw (DOM node kept)');
 w.dispatchEvent(new w.StorageEvent('storage',{key:'dealerdesk.leads.v1'}));ok(n()===0,'storage event with same data: no redraw');
 w.localStorage.setItem('dealerdesk.leads.v1',webA);w.dispatchEvent(new w.Event('focus'));ok(n()===1&&link(),'changed data: exactly one redraw, link shown');
 w.dispatchEvent(new w.Event('focus'));w.dispatchEvent(new w.Event('focus'));ok(n()===1,'no further redraws after it');
 w.localStorage.setItem('dealerdesk.leads.v1','[]');const sel=d.querySelector('select[data-act=pstage]');sel.focus();w.dispatchEvent(new w.Event('focus'));ok(n()===1&&link(),'change while menu focused: deferred');
 sel.blur();w.dispatchEvent(new w.Event('focus'));ok(n()===2&&!link(),'deferred change applied on next focus');
 w.dispatchEvent(new w.Event('focus'));ok(n()===2,'then quiet again');
 console.log('pipeline focus no-redraw: '+pass+' passed, '+fail+' failed');process.exit(fail?1:0)},1200);

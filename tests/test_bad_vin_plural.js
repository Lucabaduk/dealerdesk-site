// One bad car in the inventory file is skipped (with a count), not the whole file; counts use proper plurals.
const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),R=path.join(__dirname,'..');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('FAIL',m))};
const html=fs.readFileSync(R+'/app.html','utf8'),data=JSON.parse(fs.readFileSync(R+'/src/sample-data.json','utf8'));
function boot(d){const warns=[];const w=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/app.html',beforeParse(w){w.console.warn=m=>warns.push(String(m));w.fetch=u=>String(u).startsWith('version')?new Promise(()=>{}):Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(JSON.stringify(d)))})}}).window;w.__warns=warns;return w}
const bad=JSON.parse(JSON.stringify(data));bad.cars[2].vin='NOT-A-VIN';bad.leads=[];bad.test_drives=[];bad.service_bookings=[];
const w=boot(bad);
const one=JSON.parse(JSON.stringify(data));one.cars=[one.cars[0]];one.leads=[];one.test_drives=[];one.service_bookings=[];
const w1=boot(one);
setTimeout(()=>{ok(w.DealerDesk.cars().length===data.cars.length-1,'bad VIN car skipped, rest loaded ('+w.DealerDesk.cars().length+')');
 ok(w.DealerDesk.skippedCars===1,'skip count');ok(w.__warns.some(m=>/skipped 1 car with invalid/.test(m)),'warning logged');
 ok(/Skipped 1 car with invalid data/.test(w.document.getElementById('toast').textContent),'toast shows count');
 w.document.querySelector('[data-view=inventory]').click();ok(/^11 cars/.test(w.document.getElementById('invcount').textContent),'plural cars');
 w1.document.querySelector('[data-view=inventory]').click();ok(/^1 car$/.test(w1.document.getElementById('invcount').textContent.trim()),'singular car: '+w1.document.getElementById('invcount').textContent);
 console.log('bad vin + plural: '+pass+' passed, '+fail+' failed');process.exit(fail?1:0)},1500);

// App-side: bundled schema matches src/schema.js (20,000-car limit throws, not truncates), and error toast has one label only.
const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),R=path.join(__dirname,'..');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('FAIL',m))};
const html=fs.readFileSync(R+'/app.html','utf8'),schema=fs.readFileSync(R+'/src/schema.js','utf8');
ok(html.includes(schema.trim().slice(0,2000))&&html.includes(schema.trim().slice(-2000)),'app.html bundles current src/schema.js');
const S=require(R+'/src/schema.js');let thrown=null;try{S.normalizeDealership({cars:Array.from({length:20001},(_,i)=>({id:'c'+i}))})}catch(e){thrown=e}
ok(thrown&&thrown.field==='cars'&&/too many cars/.test(thrown.message),'schema throws on >20,000 cars');
function boot(data){return new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/app.html',beforeParse(w){w.fetch=u=>String(u).startsWith('version')?new Promise(()=>{}):Promise.resolve({ok:true,json:()=>Promise.resolve(data)})}}).window}
const t=JSON.parse(fs.readFileSync(R+'/src/sample-data.json','utf8')).cars[0];
const big={cars:Array.from({length:20001},(_,i)=>Object.assign({},t,{id:'b'+i,stock_no:'S'+i}))};
const w=boot(big);
setTimeout(()=>{const msg=w.document.getElementById('toast').textContent;
 ok(/too many cars/i.test(msg),'too-many-cars error shown: '+msg);
 ok(!/cars:\s*cars:/i.test(msg)&&/^Inventory file problem: Cars: too many/.test(msg),'no duplicate label: '+msg);
 ok(w.DealerDesk.cars().length<20001,'cars not silently truncated into the app');
 console.log('app errors: '+pass+' passed, '+fail+' failed');process.exit(fail?1:0)},1500);

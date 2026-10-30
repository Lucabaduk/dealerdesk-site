// QA: staff app (app.html) maps keyed by car make/model/id must not pollute Object.prototype or lose/merge cars.
const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),R=path.join(__dirname,'..');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('FAIL',m))};
const html=fs.readFileSync(R+'/app.html','utf8'),data=JSON.parse(fs.readFileSync(R+'/src/sample-data.json','utf8'));
const NAMES=['__proto__','constructor','toString','hasOwnProperty','valueOf','prototype'],A='ABCDEFGHJKLMNPRST';
const base=data.cars[0];NAMES.forEach((n,i)=>data.cars.push(Object.assign({},base,{id:n,stock_no:'P'+i,vin:'1PRXTEABCDEFGHJK'+i,make:n,model:NAMES[(i+1)%6],trim:n,color:n,status:'available'})));
const errs=[];const w=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/app.html',beforeParse(w){
 w.localStorage.setItem('dealerdesk.v2',JSON.stringify({schema:2,car_overrides:{},cars_removed:['valueOf']}));
 w.addEventListener('error',e=>errs.push(e.message));
 w.fetch=u=>String(u).startsWith('version')?new Promise(()=>{}):Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(JSON.stringify(data)))})}}).window;
setTimeout(()=>{const d=w.document;const ev=s=>w.eval(s);
 ok(ev('({}).status')===undefined&&ev('({}).price_cents')===undefined,'no Object.prototype pollution after load');
 d.querySelector('[data-view=inventory]').click();
 const ta=q=>{const i=d.querySelector('[data-inv=q]');i.value=q;i.dispatchEvent(new w.Event('input',{bubbles:true}));return[...d.querySelectorAll('#ta .ta-item')].map(x=>x.getAttribute('data-make')+'/'+x.getAttribute('data-model')+'='+x.textContent)};
 const a=ta('__pro');ok(a.some(x=>x.startsWith('__proto__/')),'suggest lists make __proto__: '+a);
 ok(ev('typeof ({}).constructor')==='function'&&ev('({}).constructor===Object')&&ev('typeof Object.prototype.toString==="function"'),'builtins intact after suggest');
 ok(ev('Object.keys(Object.prototype).length')===0&&ev('Object.keys(Object).length')===0,'nothing added to Object/Object.prototype');
 const b=ta('constructor');ok(b.some(x=>x.startsWith('constructor/')),'suggest lists make constructor: '+b);
 ok(!b.concat(ta('to')).some(x=>/function|native/.test(x)),'counts not function strings');
 const opts=[...d.querySelectorAll('select[data-inv=make] option')].map(o=>o.value);
 ok(opts.includes('__proto__')&&opts.includes('constructor'),'make filter has __proto__ and constructor: '+opts.filter(o=>/_|con/.test(o)));
 ok(!opts.includes('valueOf'),'removed car valueOf gone from filter');
 d.querySelector('[data-inv=q]').value='';
 const sel=d.querySelector('select[data-inv=make]');sel.value='constructor';sel.dispatchEvent(new w.Event('change',{bubbles:true}));
 ok(/P1|constructor/.test(d.body.textContent),'filter by make constructor shows car');
 ok(!errs.length,'no page errors: '+errs.join('|'));
 console.log('proto app: '+pass+' passed, '+fail+' failed');process.exit(fail?1:0)},1500);

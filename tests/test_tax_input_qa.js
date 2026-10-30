// QA: decimal-rate tax input — clear rejection, saved sub-1% rate not re-converted on untouched resave, escaping.
const { t, eq, ok, done } = require('./_h.js');
const fs=require('fs'),path=require('path'),dir=path.join(__dirname,'..');
let JSDOM=null;for(const p of ['/tmp/qrdev/node_modules/jsdom','jsdom']){try{JSDOM=require(p).JSDOM;break}catch(e){}}
const data=JSON.parse(fs.readFileSync(path.join(dir,'src/sample-data.json'),'utf8'));
const inline=f=>fs.readFileSync(path.join(dir,f),'utf8').replace(/<script src="([^"]+)"><\/script>/g,(m,s)=>'<script>'+fs.readFileSync(path.join(dir,s),'utf8')+'<\/script>');
function boot(seed){const errors=[];const w=new JSDOM(inline('app.html'),{url:'https://x.test/app.html',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(win){for(const k in seed||{})win.localStorage.setItem(k,seed[k]);win.confirm=()=>true;win.scrollTo=()=>{};win.fetch=u=>String(u).startsWith('version')?new Promise(()=>{}):Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(JSON.stringify(data)))});win.addEventListener('error',e=>errors.push(e.message))}}).window;w.__e=errors;return w}
const tick=()=>new Promise(r=>setTimeout(r,80));
(async()=>{if(!JSDOM){console.log('  (jsdom not found, skipped)');return done('tax input qa')}
 let w=boot();await tick();let d=w.document;const go=()=>d.querySelector('[data-view=settings]').click();
 const sub=(form,vals)=>{const f=d.querySelector('[data-form='+form+']');for(const n in vals)f.elements[n].value=vals[n];f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}))};
 t('0.5 rejected with a message naming the 50% conversion (both forms)',()=>{go();sub('settings',{tax_rate:'0.5'});ok(/read as 50%/.test(d.getElementById('toast').textContent));go();sub('ordersettings',{taxRate:'0.5'});ok(/read as 50%/.test(d.getElementById('toast').textContent))});
 go();sub('settings',{tax_rate:'0.06'});const seed={};for(let k=0;k<w.localStorage.length;k++){const key=w.localStorage.key(k);seed[key]=w.localStorage.getItem(key)}
 const o=JSON.parse(seed.dealerdesk_orders);o.settings.taxRate=0.5;seed.dealerdesk_orders=JSON.stringify(o);
 const w2=boot(seed);await tick();const d2=w2.document;d2.querySelector('[data-view=settings]').click();
 t('saved 0.5% Orders tax: untouched resave keeps 0.5 and saves',()=>{d2.querySelector('[data-form=ordersettings]').dispatchEvent(new w2.Event('submit',{bubbles:true,cancelable:true}));eq(w2.DDOrders.settings().taxRate,0.5);eq(d2.getElementById('toast').textContent,'Saved')});
 t('no hint for the unchanged saved value',()=>{d2.querySelector('[data-view=settings]').click();const i=d2.querySelector('[data-form=ordersettings] [name=taxRate]');i.dispatchEvent(new w2.Event('input',{bubbles:true}));eq(i.parentNode.querySelector('[data-tax-hint]').textContent,'')});
 t('no JS errors',()=>{eq(w.__e,[]);eq(w2.__e,[])});
 done('tax input qa')})();

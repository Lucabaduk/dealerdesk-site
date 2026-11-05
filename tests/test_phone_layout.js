/* iPhone-width layout locks for inventory list, lead drawer, and car.html. */
const { t, ok, eq, done } = require('./_h.js');
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const dir = path.join(__dirname, '..');
const staff = fs.readFileSync(path.join(dir, 'staff-inventory.html'), 'utf8');
const car = fs.readFileSync(path.join(dir, 'car.html'), 'utf8');
const js = fs.readFileSync(path.join(dir, 'modules/staff-inventory.js'), 'utf8');

t('inventory rows are phone cards with 44px select + wrapping actions', () => {
  ok(/c-pick/.test(js) && /c-act/.test(js), 'row classes');
  ok(/@media \(max-width:640px\)\{[\s\S]*#rows tr\{[^}]*display:grid/.test(staff), 'card grid');
  ok(/#rows \.c-pick label\{[^}]*height:44px/.test(staff), '44px checkbox hit area');
  ok(/#rows \.c-act\{[^}]*flex-wrap:wrap/.test(staff), 'actions wrap');
  ok(/@media \(max-width:420px\)\{\.bar>\*\{flex:1 1 100%\}/.test(staff), 'filters still stack');
});

t('lead drawer fills the screen, pads safe area, wraps contact', () => {
  ok(/dialog\.drawer\{[^}]*width:min\(480px,100vw\)/.test(staff));
  ok(/dialog\.drawer\{[^}]*max-width:100%/.test(staff));
  ok(/dialog\.drawer\{[^}]*safe-area-inset-top/.test(staff));
  ok(/dialog\.drawer\{[^}]*overflow-x:hidden/.test(staff));
  ok(/\.ld-contact a\{[^}]*min-height:44px/.test(staff));
  ok(/\.ld-contact a\{[^}]*overflow-wrap:anywhere/.test(staff));
  ok(/\.lcard\{[^}]*overflow-wrap:anywhere/.test(staff));
});

t('car.html: viewport-fit, safe-area, stacked chips, gallery cannot widen the page', () => {
  ok(/viewport-fit=cover/.test(car));
  ok(/env\(safe-area-inset-right\)/.test(car) && /env\(safe-area-inset-left\)/.test(car));
  ok(/overflow-x:clip/.test(car));
  ok(/@media \(max-width:420px\)\{[^}]*\.chips\{flex-direction:column/.test(car));
  ok(/\.chips label\{[^}]*min-height:44px/.test(car));
  ok(/\.gallery\{[^}]*overflow-x:auto/.test(car));
  ok(/\.gallery img\{[^}]*min-width:0/.test(car));
  ok(/\.staff-sticker\{[^}]*min-height:44px/.test(car));
});

function chromeBin() {
  const c = ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'];
  return c.find(p => { try { fs.accessSync(p); return true; } catch (e) { return false; } });
}

function measure() {
  const bin = chromeBin();
  if (!bin) { console.log('  (chrome not found, overflow check skipped)'); return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    const srv = spawn(process.execPath, ['-e', `const http=require('http'),fs=require('fs'),path=require('path');const root=${JSON.stringify(dir)};http.createServer((q,s)=>{const u=q.url.split('?')[0];const rel=decodeURIComponent(u).replace(/^\\/+/,'').replace(/\\.\\./g,'');const f=path.join(root,rel);if(!f.startsWith(root)){s.writeHead(403);return s.end()}fs.readFile(f,(e,b)=>{if(e){s.writeHead(404);return s.end('no')}s.writeHead(200);s.end(b)})}).listen(0,'127.0.0.1',function(){process.stdout.write(String(this.address().port))})`], { stdio: ['ignore', 'pipe', 'pipe'] });
    let port = '', started = false;
    const fail = (e) => { try { srv.kill(); } catch (x) {} reject(e); };
    const timer = setTimeout(() => fail(new Error('server timeout')), 20000);
    srv.stdout.on('data', d => { port += d; if (started || !port.trim()) return; started = true; clearTimeout(timer); run(port.trim()).then(resolve, fail); });
    srv.stderr.on('data', d => process.stderr.write(d));
    async function run(p) {
      const chrome = spawn(bin, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=0', '--user-data-dir=/tmp/dd-phone-test-' + process.pid, 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
      let log = '';
      chrome.stderr.on('data', d => { log += d; });
      chrome.stdout.on('data', d => { log += d; });
      const t0 = Date.now();
      while (!/DevTools listening on (ws:\/\/\S+)/.test(log)) {
        if (Date.now() - t0 > 15000) throw new Error('chrome timeout ' + log.slice(-300));
        await new Promise(r => setTimeout(r, 40));
      }
      try {
        const out = await layout(log.match(/DevTools listening on (ws:\/\/\S+)/)[1], 'http://127.0.0.1:' + p);
        t('390px: inventory, leads drawer, car page do not overflow', () => {
          eq(out.inv.scrollW <= out.inv.clientW, true, 'inv page ' + JSON.stringify(out.inv));
          eq(out.inv.wrapScroll <= out.inv.wrapClient + 1, true, 'inv list ' + out.inv.wrapScroll + '>' + out.inv.wrapClient);
          eq(out.inv.actRight <= out.inv.clientW + 1, true, 'actions offscreen ' + out.inv.actRight);
          eq(out.inv.pick >= 44 && out.inv.btn >= 44, true, 'taps pick ' + out.inv.pick + ' btn ' + out.inv.btn);
          eq(out.leads.scrollW <= out.leads.clientW && out.leads.cards === 1 && out.leads.open, true, 'leads ' + JSON.stringify(out.leads));
          eq(out.drawer.emailRight <= out.drawer.right + 1, true, 'email ' + out.drawer.emailRight + '>' + out.drawer.right);
          eq(out.drawer.w >= out.drawer.clientW - 1, true, 'drawer width ' + out.drawer.w);
          eq(out.car.scrollW <= out.car.clientW, true, 'car page ' + JSON.stringify(out.car));
          eq(out.car.chipH >= 44, true, 'chip ' + out.car.chipH);
          eq(out.dark.scrollW <= out.dark.clientW && out.dark.actRight <= out.dark.clientW + 1, true, 'dark inv ' + JSON.stringify(out.dark));
        });
      } finally { try { chrome.kill(); } catch (e) {} try { srv.kill(); } catch (e) {} }
    }
  });
}

async function layout(browserWs, origin) {
  const ws = new WebSocket(browserWs);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } };
  const send = (method, params, sessionId) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); const payload = { id: i, method, params: params || {} }; if (sessionId) payload.sessionId = sessionId; ws.send(JSON.stringify(payload)); });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }, sessionId);
  await send('Page.enable', {}, sessionId);
  async function go(url, expr) {
    await send('Page.navigate', { url }, sessionId);
    await new Promise(r => setTimeout(r, 700));
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }, sessionId);
    return r.result.value;
  }
  const invExpr = `(() => { const d=document.documentElement, w=document.querySelector('#pane-inv .wrap'), tr=document.querySelector('#rows tr'), act=tr&&tr.querySelector('.c-act'), pick=tr&&tr.querySelector('.c-pick label'), pr=pick&&pick.getBoundingClientRect(), ar=act&&act.getBoundingClientRect(), btns=[...((act&&act.querySelectorAll('button'))||[])].map(b=>Math.round(b.getBoundingClientRect().height)); return { scrollW:d.scrollWidth, clientW:d.clientWidth, wrapScroll:w.scrollWidth, wrapClient:w.clientWidth, actRight: ar?Math.round(ar.right):0, pick: pr?Math.round(Math.min(pr.width,pr.height)):0, btn: btns.length?Math.min.apply(null,btns):0 }; })()`;
  const inv = await go(origin + '/staff-inventory.html', invExpr);
  await send('Runtime.evaluate', { expression: `localStorage.setItem('dealerdesk.leads.v1', JSON.stringify([{id:'L1',status:'new',createdAt:Date.now()-3600000,updatedAt:Date.now(),vin:'1UP3JKMB3RF100000',name:'Alexandria Longername',phone:'3135550100',email:'alexandra.longername.customer@dealership-example.com',interest:'test_drive',source:'website',via:'qr',notes:'Need it Saturday morning please',notesLog:[],history:[],followUpAt:Date.now()-86400000}]));`, returnByValue: true }, sessionId);
  const leadExpr = `(() => { document.getElementById('tab-leads').click(); const card=document.querySelector('#lrows .lcard'); if(card) card.click(); const d=document.getElementById('ldrawer'), r=d.getBoundingClientRect(), a=[...d.querySelectorAll('#ld-contact a')].pop(), ar=a?a.getBoundingClientRect():r; return { scrollW:document.documentElement.scrollWidth, clientW:document.documentElement.clientWidth, cards:document.querySelectorAll('#lrows .lcard').length, drawer:{ w:Math.round(r.width), right:Math.round(r.right), clientW:document.documentElement.clientWidth, emailRight:Math.round(ar.right), open:!!d.open } }; })()`;
  await send('Page.reload', { ignoreCache: true }, sessionId);
  await new Promise(r => setTimeout(r, 900));
  const leadsRes = await send('Runtime.evaluate', { expression: leadExpr, returnByValue: true }, sessionId);
  const leads = leadsRes.result.value;
  const carExpr = `(() => { const chip=document.querySelector('.chips label'), cr=chip&&chip.getBoundingClientRect(); return { scrollW:document.documentElement.scrollWidth, clientW:document.documentElement.clientWidth, chipH: cr?Math.round(cr.height):0 }; })()`;
  const carM = await go(origin + '/car.html?vin=1UP3JKMB3RF100000', carExpr);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] }, sessionId);
  const dark = await go(origin + '/staff-inventory.html', invExpr);
  ws.close();
  return { inv, leads: { scrollW: leads.scrollW, clientW: leads.clientW, cards: leads.cards, open: leads.drawer && leads.drawer.open }, drawer: leads.drawer, car: carM, dark };
}

measure().then(() => done('phone layout'), e => { console.log('FAIL phone', e); process.exit(1); });

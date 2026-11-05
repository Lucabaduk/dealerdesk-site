/* Phone nits: search/typeahead min-width wins under 700px, nav fade padding + scroll clamp, missing lead interest is blank. */
const { t, ok, done } = require('./_h.js');
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(dir, 'src/app.src.html'), 'utf8');
const app = fs.readFileSync(path.join(dir, 'app.html'), 'utf8');
const staff = fs.readFileSync(path.join(dir, 'modules/staff-inventory.js'), 'utf8');

function checks(html, name) {
  t(name + ': late phone min-width:0 follows the 240px rules', () => {
    const baseSearch = html.indexOf('.row input[type=search]{min-width:240px');
    const baseTa = html.indexOf('.ta{position:relative;flex:1;min-width:240px');
    const late = html.indexOf('@media(max-width:700px){.row input[type=search],.ta{min-width:0}}');
    ok(baseSearch > 0 && baseTa > baseSearch && late > baseTa, 'order');
    const earlyEnd = html.indexOf('@media(prefers-color-scheme:dark)');
    ok(!html.slice(0, earlyEnd).includes('input[type=search]{min-width:0}'), 'dead early rule gone');
  });
  t(name + ': phone nav keeps a 12% pad so the fade does not cover the last tab', () => {
    ok(html.includes('nav{width:100%;display:flex;overflow-x:auto;padding:8px;padding-right:calc(8px + 12%)}'), 'padding');
    ok(html.includes('nav::before{content:"";flex:0 0 0;width:0;margin-left:-8px;scroll-snap-align:start}'), 'start snap');
  });
  t(name + ': active tab scroll clamps into the opaque zone and pins the first tab', () => {
    ok(html.includes('pad=Math.round(nvo.clientWidth*0.12)'), '12% mask');
    ok(html.includes('if(left<=8)sl=0;nvo.scrollLeft=sl;if(left<=8)requestAnimationFrame(function(){nvo.scrollLeft=0})'), 'first tab');
  });
}

checks(src, 'src');
checks(app, 'app.html');
t('app.html is the rebuilt source', () => {
  ok(app.includes(fs.readFileSync(path.join(dir, 'src/schema.js'), 'utf8').slice(0, 80)), 'schema inlined');
  ok(!app.includes('/*@SCHEMA@*/') && !app.includes('/*@DASH@*/'), 'placeholders gone');
});
t('lead drawer does not print the string undefined for a missing interest', () => {
  ok(!/String\(l\.interest\)/.test(staff), 'no String(l.interest)');
  ok(staff.includes("(l.interest||'').replace('_', ' ')"), 'blank fallback');
  ok((undefined || '').replace('_', ' ') === '', 'missing');
  ok(('test_drive' || '').replace('_', ' ') === 'test drive', 'present');
});
done('phone nits');

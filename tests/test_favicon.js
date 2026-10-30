// Every page ships an inline SVG favicon (no /favicon.ico request -> no console 404), monogram text, no emoji.
const fs=require('fs'),path=require('path'),R=path.join(__dirname,'..');let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('FAIL',m))};
const pages=fs.readdirSync(R).filter(f=>f.endsWith('.html'));ok(pages.length>=9,'pages found '+pages.length);
for(const f of pages){const h=fs.readFileSync(path.join(R,f),'utf8');const m=/<link rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml,([^"]+)">/.exec(h);
 ok(m,f+' has inline SVG icon');if(m){const svg=decodeURIComponent(m[1]);ok(/>DD<\/text>/.test(svg)&&!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(svg),f+' monogram, no emoji')}
 const csp=/Content-Security-Policy" content="([^"]+)"/.exec(h);if(csp&&/img-src/.test(csp[1]))ok(/img-src[^;]*data:/.test(csp[1]),f+' CSP allows data: icon')}
console.log('favicon: '+pass+' passed, '+fail+' failed');process.exit(fail?1:0);

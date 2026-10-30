#!/bin/sh
# Pulls Grok Master Helper's data layer + car list from /workspace/dealership, inlines schema.js into app.html
set -e; cd "$(dirname "$0")"; H=${DD_DATA:-/workspace/dealership}
cp ${H_SCHEMA:-$H/schema.js} src/schema.js; cp $H/test_schema.js $H/sample-data.json src/; [ -f $H/models.json ] && cp $H/models.json data/models.json 2>/dev/null || { mkdir -p data; cp $H/models.json data/models.json; }; [ -f $H/CREDITS.md ] && cp $H/CREDITS.md .
if [ -f $H/inventory-5000.json ]; then cp $H/inventory-5000.json cars.json; elif [ -f $H/cars.json ]; then cp $H/cars.json cars.json; else cp $H/sample-data.json cars.json; fi
mkdir -p data && cp cars.json data/cars.json
rm -rf assets && mkdir assets && cp -r $H/assets/* assets/
node -e 'const fs=require("fs");let s=fs.readFileSync("src/app.src.html","utf8");s=s.replace("/*@SCHEMA@*/",()=>fs.readFileSync("src/schema.js","utf8"));fs.writeFileSync("app.html",s)'
node -e 'const fs=require("fs");for(const f of ["cars.json","data/cars.json"]){const d=JSON.parse(fs.readFileSync(f));(d.cars||[]).forEach(c=>{const k="assets/cars/"+(c.make+"-"+c.model).toLowerCase().replace(/[^a-z0-9]+/g,"-")+".webp";c.photos=(c.photos||[]).filter(p=>!/^assets\//.test(p)||fs.existsSync(p));if(!c.photos.length&&fs.existsSync(k))c.photos=[k]});fs.writeFileSync(f,JSON.stringify(d))}'
printf '{"v":"%s"}\n' "$(date +%s)" > version.json

#!/bin/sh
# Pulls Grok Master Helper's data layer + car list from /workspace/dealership, inlines schema.js into app.html
set -e; cd "$(dirname "$0")"; H=/workspace/dealership
cp ${H_SCHEMA:-$H/schema.js} src/schema.js; cp $H/test_schema.js $H/sample-data.json src/; [ -f $H/CREDITS.md ] && cp $H/CREDITS.md .
if [ -f $H/cars.json ]; then cp $H/cars.json cars.json; else cp $H/sample-data.json cars.json; fi
rm -rf assets && mkdir assets && cp -r $H/assets/* assets/
node -e 'const fs=require("fs");let s=fs.readFileSync("src/app.src.html","utf8");s=s.replace("/*@SCHEMA@*/",()=>fs.readFileSync("src/schema.js","utf8"));fs.writeFileSync("app.html",s)'
printf '{"v":"%s"}\n' "$(date +%s)" > version.json

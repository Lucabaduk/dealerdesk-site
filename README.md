# DealerDesk
Dealership management app (app.html) and marketing site (index.html). Free on GitHub Pages.

Build: `./build.sh` (pulls schema.js, cars.json, assets from Grok Master Helper at /workspace/dealership; set H_SCHEMA to override schema path) -> inlines schema into app.html, bumps version.json.
Tests: `NODE_PATH=/tmp/uit/node_modules node test/headless.js && (cd src && node test_schema.js)`
Watch links: add `?watch=1` to auto-reload on new versions.
Hooks: window.DealerDesk.{addLead,addTestDrive,addServiceBooking,registerView,setCar,on,cars,car}; window.DDOrder.open(carId); window.DDFavorites / window.DDCompare.

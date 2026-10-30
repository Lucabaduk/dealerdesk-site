# DealerDesk — inventory & QR leads (coder 3)

Plain browser JS, no build step, no CDN, works on GitHub Pages. Each module works in Node (`require`) and the browser (globals).

| file | global | what |
|---|---|---|
| modules/store.js | `DDStore` | localStorage with in-memory fallback, `cleanText`, `esc` |
| modules/inventory.js | `DDInventory` | cars: add/edit/remove/status, indexed search, filters, sort, paging, export/import JSON |
| modules/leads.js | `DDLeads` | QR leads: submit (validated, honeypot, 30s dedupe), staff list/status/notes, CSV/JSON export |
| modules/qr.js | `DDQR` | original QR encoder (byte mode, ECC M, v1–10, ≤213 bytes). `DDQR.toSVG(url)` |
| modules/qr-label.js | `DDQRLabel` | `render(container, vin, baseUrl)` → printable QR `<img>` for a car |
| car.html + modules/car-page.js | — | guest page `car.html?vin=…` opened from the QR: car + lead form |

## Schema
Matches Grok Master Helper's `/workspace/dealership/SCHEMA.md` (`schema.js`, also at `src/schema.js` in the DealerDesk repo).
Cars are stored in the schema *input* shape (`price` in dollars): `id, stock_no, vin, year, make, model, trim, price, mileage, color, condition, status, photos[], features[]`.
`inv.toSchema(vin)` returns `normalizeCar()` output (`price_cents`) when `DealerDeskSchema` is loaded. Missing `id` → `car-<vin>`, missing `stock_no` → `S<last 6 of VIN>`, missing `condition` → new if <500 mi.
Leads: `id, vin, interest_car_id, name, phone, email, interest (question|test_drive|price), source:'website', via:'qr', status (new|contacted|qualified|won|lost = schema leadStatus), notes, staffNote, createdAt, updatedAt`. Every lead passes `normalizeLead`.

## Inventory API (5,000+ cars)
```js
const inv = DDInventory.create();            // reads localStorage 'dealerdesk.inventory.v2'
inv.load(await (await fetch('data/cars.json')).json());  // Helper's {cars:[...]} file
inv.query({ text:'silver sport', make:'Velora', model, color, status, condition, year,
            minYear, maxYear, minPrice, maxPrice, minMileage, maxMileage,
            sort:'price|year|mileage|make|model|stock', dir:'asc|desc', page:1, pageSize:24 })
// -> { total, page, pages, pageSize, items:[24 cars] }   (filters accept arrays: make:['A','B'])
inv.facets('make'); inv.facets('model', {make:'Velora'})  // dropdown values + counts
inv.add(car) / inv.update(vinOrId, patch) / inv.setStatus(vin,'sold') / inv.remove(vin)
inv.exportJSON(); inv.importJSON(text, 'merge'|'replace'); inv.carUrl(location.href, vin)
```
Value indexes + precomputed search text + cached sort orders. Test: 5,000 cars filter+sort+page well under 50 ms; load+index ≈ 40–70 ms in Node.
Render 24 per page (or append next page on scroll) — never render all 5,000.

## Notes
- All writes return `{ok:true, car|lead}` or `{ok:false, errors:[field…]}`. Render user data with `textContent` (or `DDStore.esc`).
- Photos: only `https://` or relative image paths; empty → `assets/site/no-photo.webp` on car.html.
- Leads are stored on the device that submits them. For staff to see guest leads from phones, add `<meta name="dd-leads-endpoint" content="https://…">` to car.html; the page POSTs the validated lead JSON there (server must re-validate with `normalizeLead`).
- car.html reads `data/cars.json` (then falls back to this device's localStorage).

Tests: `node tests/test_inventory.js && node tests/test_leads.js`

## Favorites & compare
- `modules/favorites.js` (`DDFavorites`): `const fav = DDFavorites.create()` → `add/remove/toggle/has/list/count/clear`, `onChange(fn)` (returns unsubscribe; event `{type, vin, count, vins}`), syncs across tabs. VINs only, max 200, stored at `dealerdesk.favorites.v1`.
  DOM helpers: `DDFavorites.heart(fav, vin)` → heart `<button>` (aria-pressed), `DDFavorites.badge(fav, el)` → keeps a count badge updated.
- `modules/compare.js` (`DDCompare`): `build(cars)` (2–4) → `{cars, rows:[{label, cells:[{text, best, missing}], differs}], features:[{name, has[], differs}]}`; `parseVins(location.search)`, `shareUrl(base, vins)`.
- `compare.html?vins=A,B,C` (+ `modules/compare-page.js`): side-by-side table, sticky labels, horizontal scroll on phones, dark mode, differences highlighted, best value ✓, "Differences only" toggle, Share (native share / copy). With no `vins` it uses the last 4 favorites. Reads `data/cars.json`, falls back to local inventory.
- Rows: price, year, mileage, body, engine, hp, MPG (city/hwy) or EV range, seats, drivetrain, transmission, color, condition, status, features.
  Spec fields are optional on cars (`body|body_type, engine, transmission, drivetrain, hp, seats, mpg_city, mpg_hwy, range_mi`); inventory keeps them when valid. Helper's cars.json doesn't have them yet → those rows show "—".

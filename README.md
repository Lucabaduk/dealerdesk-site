# DealerDesk
Dealership management app (app.html) and marketing site (index.html). Free on GitHub Pages.

Build: `./build.sh` (pulls schema.js, cars.json, assets from Grok Master Helper at /workspace/dealership; set H_SCHEMA to override schema path) -> inlines schema into app.html, bumps version.json.
Tests: `NODE_PATH=/tmp/uit/node_modules node test/headless.js && (cd src && node test_schema.js)`
Watch links: add `?watch=1` to auto-reload on new versions.
Hooks: window.DealerDesk.{addLead,addTestDrive,addServiceBooking,registerView,setCar,on,cars,car}; window.DDOrder.open(carId); window.DDFavorites / window.DDCompare.

---
# DealerDesk Booking module

Test drives + service appointments + a public booking page. Plain JS, no dependencies, no build step.

## Files
- `modules/booking.js` - data + rules + staff UI. Global `window.DDBooking`. localStorage key `dealerdesk_booking`.
- `modules/booking.css` - styles (all classes prefixed `ddb-` staff / `ddp-` public; light + dark, mobile first).
- `modules/booking-public.js` + `booking.html` - customer page. Query params: `?type=service`, `?vehicle=STOCK_OR_VIN` (for a QR on a car), `?name=Dealer+Name`.
- `demo.html` - staff screen demo. `tests/booking.test.js` - headless tests.
- `docs/SERVER_PROPOSAL.md` - proposed endpoints for a new DealerDesk server (not built, not deployed).

## Integrate into DealerDesk
1. Copy `modules/booking.*` and `booking.html` into the app.
2. `<link rel="stylesheet" href="modules/booking.css"><script src="modules/booking.js"></script>`
3. Add a "Bookings" tab with `<div id="booking"></div>` and call `DDBooking.mount(el)` when it opens.
4. Vehicles use Grok Master Helper's schema (/workspace/dealership, `cars[]` with `id, stock_no, vin, year, make, model, trim, status`). Call `DDBooking.setInventory(dataset or cars)` from the core app, or store the dataset at localStorage `dealerdesk_data` and it is read read-only. Picker = search box (stock, VIN, make, model, year, multi-word), max 8 results, exact stock/VIN first; sold cars can't be booked. Tested with 5,000 cars.
   `DDBooking.toSchema()` returns `{test_drives, service_bookings}` that pass `normalizeDealership` (status mapping: booked->requested, no-show->no_show, scheduled->booked, checked-in/in-progress->in_progress, ready/picked-up->done).
5. Link the website / car QR codes to `booking.html?vehicle=<stock>`.
6. `DDBooking.onChange(fn)` fires after any save; `DDBooking.newRequests()` gives unseen online requests for a badge.

## Rules
- Test drive statuses: booked, confirmed, completed, no-show, cancelled. Only booked/confirmed block time.
- No overlapping drive for the same car (VIN or stock) or the same salesperson.
- Service statuses: scheduled -> checked-in -> in-progress -> ready -> picked-up. Auto bay or chosen bay; rejects busy bay / all bays full; picked-up frees the bay.
- Public requests: lead time, max days ahead, business hours, 5 requests/hour per phone, on/off switch.

## Limit
Without a server, online requests only reach staff on the SAME browser/device. See docs/SERVER_PROPOSAL.md.

## Test
`node tests/booking.test.js` (UI tests need jsdom; set `DD_DEV_MODULES=/path/to/node_modules`).

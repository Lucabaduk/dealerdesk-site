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

# DealerDesk Orders module (reserve / buy requests)

- `order.html?vehicle=STOCK` (+ `modules/order-public.js`): car summary (photo, price, specs, features), Reserve (refundable deposit from settings) or Buy, optional trade-in estimate, payment calculator, request form -> confirmation code `DO-XXXX123`. Unknown/sold cars show a message; "hold" cars show a note.
- `modules/order.js`: global `DDOrders`. localStorage `dealerdesk_orders`. Cars from `/workspace/dealership` schema via `DDOrders.setInventory(data)` or localStorage `dealerdesk_data`. `modules/order.css` extends `booking.css` (load both).
- Staff list: `DDOrders.mount(el)` - status tabs (new, contacted, deposit, sold, cancelled), search, status dropdown (history kept), tel/mailto links, "Book test drive" -> `booking.html?vehicle=STOCK`. Demo: `orders-demo.html`.
- **No payments.** No card/bank fields anywhere (a test checks). The page says a dealer will contact the customer.
- Limits: 5 requests per phone per hour; name + 10-digit phone required; email required only if "Email" is the contact preference.

Trade-in formula (shown on the page; tune in settings `tradeBase`, `tradeDepreciation`, `tradeMilesPerYear`, `tradeMileAdj`):
`estimate = tradeBase x (1 - depreciation)^age x clamp(1 - mileAdj x (miles - milesPerYear x age)/10,000, 0.5, 1.15) x condition (1.00/0.90/0.75/0.55)`, min $250, shown as +/-10% range. Rough guide, not an offer.

Payment: tax = taxRate x (price - trade) (trade credit, setting `taxTradeCredit`), financed = price + tax - down - trade, standard amortisation (0% APR = financed/term), term 36-84. Shows monthly, interest, total of payments, total cost.

Settings: `DDOrders.updateSettings({ depositAmount, taxRate, defaultApr, defaultTerm, tradeBase, ..., bookingUrl, photoBase })`. `photoBase` prefixes relative photo paths (e.g. where `/workspace/dealership/assets` is served).

Test: `node tests/order.test.js`

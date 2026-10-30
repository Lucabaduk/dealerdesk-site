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
4. Vehicle picker reads `dealerdesk_v1.vehicles` (fields `id, stock|stock_number, vin, year, make, model, trim, status`) read-only. If the core app uses another key/shape, change `INV_KEY` / `vehicles()` in booking.js.
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

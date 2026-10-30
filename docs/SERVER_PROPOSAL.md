# Proposal: DealerDesk booking endpoints (new DealerDesk server - NOT built, NOT deployed)

A separate DealerDesk service (e.g. its own Cloudflare Worker + D1). Not related to any TableTop server.

## Public (no auth, rate limited per IP + phone, CORS for the dealer's site)
- `GET  /v1/:dealer/booking/config` -> hours, slotMin, testDriveMin, leadTimeMin, maxDaysAhead, publicRequests
- `GET  /v1/:dealer/booking/slots?kind=test-drive|service&date=YYYY-MM-DD&vehicle=&type=` -> `{ times: ["09:30", ...] }`
- `POST /v1/:dealer/booking/requests` body = same shape as `DDBooking.submitRequest(kind, p)` -> `{ code, id, date, time }`
  Server re-runs every rule (hours, lead time, conflicts, bay capacity) inside one transaction.

## Staff (Authorization: Bearer <per-dealer staff token>, token never stored in localStorage)
- `GET /v1/:dealer/booking/requests?since=<seq>` -> new requests to import into local state
- `POST /v1/:dealer/booking/requests/:id/ack`
- `PUT /v1/:dealer/booking/settings`

## Tables
`bookings(id, dealer_id, kind, payload_json, date, start_min, dur_min, vehicle_key, salesperson, bay, status, source, created_at)`
with indexes on `(dealer_id, date)`; `requests(seq, dealer_id, booking_id, phone_hash, created_at, acked_at)`.

Client change once approved: in booking-public.js, call `/slots` and `/requests` when a server URL is configured, else fall back to localStorage (today's behaviour).

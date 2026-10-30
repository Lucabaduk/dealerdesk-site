// DealerDesk data schema — standalone, no dependencies.
// Every normalize* function returns a clean object or throws SchemaError.
'use strict';

class SchemaError extends Error {
  constructor(field, message) { super(field + ': ' + message); this.field = field; }
}

const ENUMS = {
  condition: ['new', 'used'],
  carStatus: ['available', 'hold', 'sold'],
  testDriveStatus: ['requested', 'confirmed', 'completed', 'cancelled', 'no_show'],
  serviceType: ['oil_change', 'tires', 'brakes', 'inspection', 'detailing', 'diagnostic', 'other'],
  serviceStatus: ['booked', 'in_progress', 'done', 'cancelled'],
  leadSource: ['website', 'walk_in', 'phone', 'referral', 'social', 'other'],
  leadStatus: ['new', 'contacted', 'qualified', 'won', 'lost'],
  bodyType: ['sedan', 'coupe', 'hatchback', 'wagon', 'convertible', 'suv', 'pickup', 'minivan', 'van'],
  fuelType: ['gasoline', 'diesel', 'hybrid', 'plug-in hybrid', 'electric'],
  drivetrain: ['FWD', 'RWD', 'AWD', '4WD'],
};

const text = (v, max) => (typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v)))
  ? String(v).replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';

function req(field, v, max) { const t = text(v, max); if (!t) throw new SchemaError(field, 'is required'); return t; }
function oneOf(field, v, list, dflt) {
  if (v == null || v === '') { if (dflt !== undefined) return dflt; throw new SchemaError(field, 'is required'); }
  const t = String(v).toLowerCase();
  if (!list.includes(t)) throw new SchemaError(field, 'must be one of ' + list.join(', '));
  return t;
}
function id(field, v) {
  const t = String(v == null ? '' : v);
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(t)) throw new SchemaError(field, 'must be 1-40 letters, digits, - or _');
  return t;
}
function num(field, v, min, max, int) {
  const n = Number(v);
  if (typeof v === 'boolean' || (typeof v === 'string' && !v.trim()) || v == null || !Number.isFinite(n) || n < min || n > max || (int && !Number.isInteger(n)))
    throw new SchemaError(field, 'must be a ' + (int ? 'whole ' : '') + 'number from ' + min + ' to ' + max);
  return n;
}
function vin(v) {
  const t = text(v, 17).toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(t)) throw new SchemaError('vin', 'must be 17 characters (no I, O or Q)');
  return t;
}
function phone(field, v, optional) {
  const t = text(v, 30);
  if (!t && optional) return '';
  const digits = t.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15 || !/^[+0-9 ().-]+$/.test(t)) throw new SchemaError(field, 'is not a valid phone number');
  return t;
}
function email(field, v, optional) {
  const t = text(v, 120).toLowerCase();
  if (!t && optional) return '';
  if (!/^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/.test(t)) throw new SchemaError(field, 'is not a valid email');
  return t;
}
// ISO local date-time "YYYY-MM-DDTHH:MM"
function when(field, v) {
  const t = text(v, 16);
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(t);
  if (!m) throw new SchemaError(field, 'must look like 2026-11-02T14:30');
  const d = new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5]);
  if (d.getMonth() !== m[2] - 1 || d.getDate() !== +m[3] || +m[4] > 23 || +m[5] > 59) throw new SchemaError(field, 'is not a real date/time');
  return t;
}
// Photos: https URLs or relative paths to image files inside the site. Nothing else.
function safeUrl(v) {
  if (typeof v !== 'string') return '';
  const u = v.trim();
  if (!u || u.length > 500 || /[\s"'<>\\`]/.test(u) || u.includes('..')) return '';
  if (/^https:\/\/[A-Za-z0-9.-]+(\/[A-Za-z0-9_\/.%~+-]*)?(\?[A-Za-z0-9_=&.%-]*)?$/.test(u)) return u;
  if (/^(\.\/)?[A-Za-z0-9_-][A-Za-z0-9_\/.-]*\.(webp|jpe?g|png|avif)$/i.test(u)) return u;
  return '';
}
function list(v, max, itemMax) {
  const out = [], seen = new Set();
  for (const x of Array.isArray(v) ? v : []) {
    const t = text(x, itemMax);
    if (t && !seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); out.push(t); }
  }
  return out.slice(0, max);
}
function obj(v, what) { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new SchemaError(what, 'must be an object'); return v; }

function normalizeCustomer(c, field) {
  obj(c, field);
  const out = { name: req(field + '.name', c.name, 80), phone: phone(field + '.phone', c.phone, true), email: email(field + '.email', c.email, true) };
  if (!out.phone && !out.email) throw new SchemaError(field, 'needs a phone or an email');
  return out;
}

// Optional spec fields: only included when present and valid; a bad value throws.
function optNum(c, k, min, max) { return c[k] == null || c[k] === '' ? {} : { [k]: num(k, c[k], min, max, true) }; }
function optText(c, k, max) { const t = text(c[k], max); return t ? { [k]: t } : {}; }
function optSpecs(c) {
  const o = {
    ...optText(c, 'description', 600),
    ...(c.body_type ? { body_type: oneOf('body_type', c.body_type, ENUMS.bodyType) } : {}),
    ...optText(c, 'engine', 60), ...optText(c, 'transmission', 40),
    ...(c.drivetrain ? { drivetrain: oneOf('drivetrain', String(c.drivetrain).toLowerCase(), ENUMS.drivetrain.map(x => x.toLowerCase())).toUpperCase() } : {}),
    ...(c.fuel_type ? { fuel_type: oneOf('fuel_type', c.fuel_type, ENUMS.fuelType) } : {}),
    ...optNum(c, 'horsepower', 40, 2000),
    ...optNum(c, 'mpg_city', 5, 150), ...optNum(c, 'mpg_highway', 5, 150), ...optNum(c, 'mpg_combined', 5, 150),
    ...optNum(c, 'mpge', 20, 200), ...optNum(c, 'range_miles', 30, 700),
    ...optNum(c, 'doors', 2, 5), ...optNum(c, 'seats', 1, 15),
    ...optText(c, 'interior_color', 30),
  };
  if (o.fuel_type === 'electric' && (o.mpg_city || o.mpg_highway)) throw new SchemaError('mpg_city', 'electric cars use range_miles, not MPG');
  return o;
}
const optionalSpecs = optSpecs;

const YEAR_MAX = new Date().getFullYear() + 2;

function normalizeCar(c) {
  obj(c, 'car');
  const condition = oneOf('condition', c.condition, ENUMS.condition);
  const mileage = c.mileage == null || c.mileage === '' ? 0 : num('mileage', c.mileage, 0, 2000000, true);
  return {
    id: id('id', c.id),
    stock_no: req('stock_no', c.stock_no, 20),
    vin: vin(c.vin),
    year: num('year', c.year, 1900, YEAR_MAX, true),
    make: req('make', c.make, 40),
    model: req('model', c.model, 60),
    trim: text(c.trim, 60),
    price_cents: (c.price == null && c.price_cents != null) ? num('price_cents', c.price_cents, 0, 1000000000, true) : Math.round(num('price', c.price, 0, 10000000) * 100),
    mileage,
    color: text(c.color, 30),
    condition,
    status: oneOf('status', c.status, ENUMS.carStatus, 'available'),
    photos: (Array.isArray(c.photos) ? c.photos : []).map(safeUrl).filter(Boolean).slice(0, 30),
    features: list(c.features, 40, 60),
    ...optionalSpecs(c),
  };
}

function normalizeTestDrive(t, cars) {
  obj(t, 'test_drive');
  const out = {
    id: id('id', t.id),
    customer: normalizeCustomer(t.customer, 'customer'),
    car_id: id('car_id', t.car_id),
    at: when('at', t.at),
    status: oneOf('status', t.status, ENUMS.testDriveStatus, 'requested'),
    notes: text(t.notes, 300),
  };
  if (cars) {
    const car = cars.find(c => c.id === out.car_id);
    if (!car) throw new SchemaError('car_id', 'no car with that id');
    if (car.status === 'sold' && out.status !== 'cancelled') throw new SchemaError('car_id', 'that car is sold');
  }
  return out;
}

function normalizeServiceBooking(s) {
  obj(s, 'service_booking');
  const v = obj(s.vehicle, 'vehicle');
  return {
    id: id('id', s.id),
    customer: normalizeCustomer(s.customer, 'customer'),
    vehicle: {
      year: num('vehicle.year', v.year, 1900, YEAR_MAX, true),
      make: req('vehicle.make', v.make, 40),
      model: req('vehicle.model', v.model, 60),
      vin: v.vin ? vin(v.vin) : '',
      plate: text(v.plate, 12).toUpperCase(),
    },
    service_type: oneOf('service_type', s.service_type, ENUMS.serviceType),
    at: when('at', s.at),
    status: oneOf('status', s.status, ENUMS.serviceStatus, 'booked'),
    notes: text(s.notes, 300),
  };
}

function normalizeLead(l, cars) {
  obj(l, 'lead');
  const out = {
    id: id('id', l.id),
    name: req('name', l.name, 80),
    phone: phone('phone', l.phone, true),
    email: email('email', l.email, true),
    interest_car_id: l.interest_car_id ? id('interest_car_id', l.interest_car_id) : null,
    source: oneOf('source', l.source, ENUMS.leadSource, 'website'),
    status: oneOf('status', l.status, ENUMS.leadStatus, 'new'),
    notes: text(l.notes, 1000),
  };
  if (!out.phone && !out.email) throw new SchemaError('lead', 'needs a phone or an email');
  if (cars && out.interest_car_id && !cars.some(c => c.id === out.interest_car_id)) throw new SchemaError('interest_car_id', 'no car with that id');
  return out;
}

// Whole dealership dataset. Unique ids per collection, cross-references checked.
function normalizeDealership(d) {
  obj(d, 'dealership');
  const arr = (v, name) => { if (v == null) return []; if (!Array.isArray(v)) throw new SchemaError(name, 'must be a list'); return v; };
  const uniq = (arr, name) => { const s = new Set(); for (const x of arr) { if (s.has(x.id)) throw new SchemaError(name, 'duplicate id ' + x.id); s.add(x.id); } return arr; };
  const cars = uniq(arr(d.cars, 'cars').slice(0, 20000).map(normalizeCar), 'cars');
  const stock = new Set(); for (const c of cars) { if (stock.has(c.stock_no)) throw new SchemaError('cars', 'duplicate stock_no ' + c.stock_no); stock.add(c.stock_no); }
  return {
    dealer_name: text(d.dealer_name, 80) || 'Our dealership',
    cars,
    test_drives: uniq(arr(d.test_drives, 'test_drives').map(t => normalizeTestDrive(t, cars)), 'test_drives'),
    service_bookings: uniq(arr(d.service_bookings, 'service_bookings').map(normalizeServiceBooking), 'service_bookings'),
    leads: uniq(arr(d.leads, 'leads').map(l => normalizeLead(l, cars)), 'leads'),
  };
}

const api = { SchemaError, ENUMS, safeUrl, normalizeCar, normalizeTestDrive, normalizeServiceBooking, normalizeLead, normalizeDealership };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else if (typeof window !== 'undefined') window.DealerDeskSchema = api;

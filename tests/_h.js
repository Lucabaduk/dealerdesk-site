let pass = 0, fail = 0;
exports.t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; console.log('FAIL', name, '-', e.message); } };
exports.eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b)); };
exports.ok = (v, m) => { if (!v) throw new Error(m || 'not ok'); };
exports.done = (label) => { console.log(label + ': ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0); };
exports.schema = () => { for (const p of ['../src/schema.js', '/workspace/dealership/schema.js']) { try { return require(require('path').resolve(__dirname, p)); } catch (e) {} } return null; };
// deterministic fake fleet
exports.genCars = (n) => { const makes = { Velora: ['Aster', 'Lumen', 'Brisa'], Northfield: ['Ridge', 'Summit', 'Trail'], Kestrel: ['Volt', 'Glide'], Halden: ['Haul', 'Crew', 'Tow'], Marisco: ['Bay', 'Coast'] };
  const colors = ['Silver', 'Black', 'White', 'Deep Blue', 'Red', 'Gray', 'Green'], st = ['available', 'available', 'available', 'hold', 'sold'], A = '0123456789ABCDEFGHJKLMNPRSTUVWXYZ';
  const mk = Object.keys(makes), out = []; let seed = 7; const r = (m) => (seed = (seed * 1103515245 + 12345) % 2147483648) % m;
  for (let i = 0; i < n; i++) { const make = mk[r(mk.length)], model = makes[make][r(makes[make].length)], year = 2012 + r(15), mileage = year >= 2025 ? r(50) : r(150000);
    let vin = '1DD' + String(i).padStart(6, '0'); while (vin.length < 17) vin += A[r(A.length)];
    out.push({ id: 'car-' + (i + 1), stock_no: 'DD' + (10000 + i), vin, year, make, model, trim: ['LX', 'EX', 'Sport', 'Limited'][r(4)], price: 9000 + r(60000), mileage, color: colors[r(colors.length)],
      condition: mileage < 500 ? 'new' : 'used', status: st[r(st.length)], photos: ['assets/cars/' + model.toLowerCase() + '.webp'], features: ['Bluetooth', 'Backup camera'] }); }
  return out; };

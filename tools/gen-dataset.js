// Membangkitkan dataset contoh aplikasi PB Trisula dari logika seed asli aplikasi.
// Pemakaian:  node gen-dataset.js  >  firestore-data.json
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const sandbox = {
  console, setTimeout, clearTimeout, setInterval, clearInterval, Promise, Date, Math, JSON,
  Object, Array, String, Number, Boolean, RegExp, Error, isNaN, parseInt, parseFloat,
  encodeURIComponent, decodeURIComponent, Uint8Array, TextEncoder, TextDecoder
};
sandbox.window = sandbox;
sandbox.crypto = globalThis.crypto;
sandbox.document = {
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  createElement: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, setAttribute() {}, addEventListener() {} }),
  addEventListener() {}, body: { classList: { add() {}, remove() {} }, appendChild() {} }
};
sandbox.localStorage = {
  _d: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
  setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; }
};
sandbox.navigator = { userAgent: 'node' };
sandbox.addEventListener = () => {};
sandbox.removeEventListener = () => {};
sandbox.location = { hash: '', href: 'http://localhost/', host: 'localhost', origin: 'http://localhost' };
sandbox.history = { length: 1 };
sandbox.scrollTo = () => {};
sandbox.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} });
sandbox.Image = function () { return {}; };
sandbox.FileReader = function () { return {}; };
sandbox.App = { register() {}, setDirty() {}, isDirty: () => false, subscribe: () => () => {}, user: () => ({ id: 'u1', role: 'pelatih_kepala' }) };
sandbox.UI = sandbox.UI || {};

vm.createContext(sandbox);
function load(rel) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
}
['js/config.js', 'js/utils.js', 'js/store.js', 'js/auth.js', 'js/ui.js', 'js/shared.js', 'js/landing-store.js', 'js/pages-monitoring.js'].forEach(load);
sandbox.Utils.toast = () => {};
sandbox.UI.toast = () => {};
if (sandbox.UI && !sandbox.UI.icon) sandbox.UI.icon = () => '';
if (sandbox.UI && !sandbox.UI.emptyState) sandbox.UI.emptyState = () => '';

async function utama() {
  // 1) seed bawaan aplikasi: users, athletes, log_parameters, test_types,
  //    attendance, logbook_entries, physical_tests, matches
  await sandbox.Auth.seed();

  // 2) data contoh Monitoring (per atlet, memakai id_parameter asli)
  const coach = sandbox.Store.all('users').filter(u => u.role === 'pelatih_kepala')[0];
  sandbox.Store.all('athletes').filter(a => a.status !== 'nonaktif').forEach(a => {
    sandbox.PagesMonitoring.isiDataContoh(coach ? coach.id : '', a.id_atlet);
  });

  // 3) konfigurasi landing page (gabungan default + tersimpan)
  sandbox.LandingStore.simpan(sandbox.LandingStore.get());

  const keluaran = {
    _meta: {
      dibuat: new Date().toISOString(),
      sumber: 'PB Trisula Surabaya - logika seed aplikasi (js/auth.js + js/pages-monitoring.js + js/landing-store.js)',
      keterangan: 'Koleksi Firestore memakai nama yang sama dengan key localStorage aplikasi (tanpa prefix pbts_).'
    }
  };
  const peta = {
    users: 'users',
    athletes: 'athletes',
    log_parameters: 'log_parameters',
    test_types: 'test_types',
    attendance: 'attendance',
    logbook_entries: 'logbook_entries',
    physical_tests: 'physical_tests',
    matches: 'matches',
    monitoring: 'monitoring',
    landing: 'landing'
  };
  Object.keys(peta).forEach(k => {
    const mentah = sandbox.localStorage.getItem('pbts_' + k);
    let data = null;
    try { data = mentah ? JSON.parse(mentah) : null; } catch (e) { data = null; }
    if (k === 'landing') {
      keluaran[peta[k]] = data || sandbox.LandingStore.get();
    } else {
      keluaran[peta[k]] = Array.isArray(data) ? data : [];
    }
  });

  const keluaranPath = process.argv[2] || path.join(__dirname, 'firestore-data.json');
  fs.writeFileSync(keluaranPath, JSON.stringify(keluaran, null, 2), 'utf8');
  const ringkas = Object.keys(peta).map(k => {
    const v = keluaran[peta[k]];
    return peta[k] + '=' + (Array.isArray(v) ? v.length : 'obj');
  }).join(' ');
  process.stderr.write('Dataset ditulis ke ' + keluaranPath + '\n' + ringkas + '\n');
}

utama().catch(e => {
  console.error(e);
  process.exit(1);
});

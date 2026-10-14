var LandingStore = (function () {
  var KEY = CONFIG.PREFIX + 'landing';
  var DB_FOTO = CONFIG.PREFIX + 'foto';
  var TOKOH = 'idb:';
  var listeners = [];

  // Foto disimpan di IndexedDB; konfigurasi cukup menyimpan referensi
  // "idb:xxx" (atau URL https bila diunggah ke cloud) sehingga kuota
  // localStorage tidak terlampaui oleh base64 foto.
  var cacheFoto = {};
  var janjiDb = null;

  function idbTersedia() {
    try {
      return typeof indexedDB !== 'undefined' && indexedDB !== null;
    } catch (e) {
      return false;
    }
  }

  function bukaDb() {
    if (!idbTersedia()) return Promise.resolve(null);
    if (janjiDb) return janjiDb;
    janjiDb = new Promise(function (resolve) {
      var req;
      try {
        req = indexedDB.open(DB_FOTO, 1);
      } catch (e) {
        resolve(null);
        return;
      }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('foto')) db.createObjectStore('foto', { keyPath: 'id' });
      };
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        resolve(null);
      };
    });
    return janjiDb;
  }

  function fotoSemua() {
    return bukaDb().then(function (db) {
      if (!db) return [];
      return new Promise(function (resolve) {
        try {
          var req = db.transaction('foto', 'readonly').objectStore('foto').getAll();
          req.onsuccess = function () {
            resolve(req.result || []);
          };
          req.onerror = function () {
            resolve([]);
          };
        } catch (e) {
          resolve([]);
        }
      });
    });
  }

  function fotoTulis(id, data) {
    return bukaDb().then(function (db) {
      if (!db) return false;
      return new Promise(function (resolve) {
        try {
          var req = db.transaction('foto', 'readwrite').objectStore('foto').put({ id: id, data: data });
          req.onsuccess = function () {
            resolve(true);
          };
          req.onerror = function () {
            resolve(false);
          };
        } catch (e) {
          resolve(false);
        }
      });
    });
  }

  function fotoBuang(id) {
    return bukaDb().then(function (db) {
      if (!db) return false;
      return new Promise(function (resolve) {
        try {
          var req = db.transaction('foto', 'readwrite').objectStore('foto').delete(id);
          req.onsuccess = function () {
            resolve(true);
          };
          req.onerror = function () {
            resolve(false);
          };
        } catch (e) {
          resolve(false);
        }
      });
    });
  }

  // Ubah nilai foto di konfigurasi menjadi sumber yang bisa dipakai <img src>.
  // Referensi "idb:xxx" diubah menjadi data URL dari cache; URL/path diteruskan.
  function urlFoto(v) {
    var s = String(v || '');
    if (s.indexOf(TOKOH) !== 0) return s;
    return cacheFoto[s.slice(TOKOH.length)] || '';
  }

  // Simpan data URL foto ke IndexedDB dan kembalikan referensinya.
  // Bila IndexedDB tidak tersedia/gagal, kembalikan data URL apa adanya.
  function simpanFoto(dataUrl) {
    var s = String(dataUrl || '');
    if (s.indexOf('data:') !== 0) return Promise.resolve(s);
    if (!idbTersedia()) return Promise.resolve(s);
    var id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    return fotoTulis(id, s).then(function (ok) {
      if (!ok) return s;
      cacheFoto[id] = s;
      return TOKOH + id;
    });
  }

  // Hapus foto lokal (bila nilainya referensi IndexedDB) dari penyimpanan.
  function hapusFotoRef(v) {
    var s = String(v || '');
    if (s.indexOf(TOKOH) !== 0) return Promise.resolve(false);
    var id = s.slice(TOKOH.length);
    delete cacheFoto[id];
    return fotoBuang(id);
  }

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function defaults() {
    return clone(CONFIG.LANDING_DEFAULT || {});
  }

  function bacaMentah() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      // Perbaiki bentuk rusak hasil sinkron cloud lama: { id: 'config', isi: {...} }
      if (parsed && typeof parsed === 'object' && parsed.isi && typeof parsed.isi === 'object' &&
        !parsed.kolase && !parsed.merek && !parsed.galeri) {
        return parsed.isi;
      }
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function gabung(base, extra) {
    if (!extra || typeof extra !== 'object') return base;
    Object.keys(extra).forEach(function (k) {
      var v = extra[k];
      if (v === undefined || v === null) return;
      if (Array.isArray(v)) base[k] = clone(v);
      else if (typeof v === 'object') {
        if (!base[k] || typeof base[k] !== 'object' || Array.isArray(base[k])) base[k] = {};
        gabung(base[k], v);
      } else base[k] = v;
    });
    return base;
  }

  function get() {
    var hasil = defaults();
    var simpanan = bacaMentah();
    if (simpanan) gabung(hasil, simpanan);
    return hasil;
  }

  function notify() {
    listeners.forEach(function (fn) {
      try {
        fn(get());
      } catch (e) {
        console.error(e);
      }
    });
  }

  function simpan(obj) {
    try {
      localStorage.setItem(KEY, JSON.stringify(obj));
    } catch (e) {
      throw new Error('Penyimpanan penuh, kecilkan foto atau hapus foto lama.');
    }
    notify();
  }

  function saveBagian(nama, nilai) {
    var semua = get();
    semua[nama] = clone(nilai);
    simpan(semua);
    return semua;
  }

  function resetBagian(nama) {
    var semua = get();
    var def = defaults();
    semua[nama] = clone(def[nama]);
    simpan(semua);
    return semua;
  }

  function resetAll() {
    localStorage.removeItem(KEY);
    notify();
  }

  function subscribe(fn) {
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (f) {
        return f !== fn;
      });
    };
  }

  window.addEventListener('storage', function (e) {
    if (e.key === KEY) notify();
  });

  function validasiEmail(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim());
  }

  function validasiUrl(s) {
    var v = String(s || '').trim();
    if (!v) return true;
    return /^https?:\/\/[^\s]+\.[^\s]{2,}/i.test(v);
  }

  function validasiTelepon(s) {
    return /^[0-9+\-() .]{6,25}$/.test(String(s || '').trim());
  }

  function bacaFoto(file, opts) {
    opts = opts || {};
    var maksUkuran = opts.maksUkuran || 2 * 1024 * 1024;
    var maksLebar = opts.maksLebar || 1600;
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error('Pilih file foto terlebih dahulu.'));
        return;
      }
      var tipeOk = /^image\/(jpeg|jpg|png|webp)$/i.test(file.type || '');
      var extOk = /\.(jpe?g|png|webp)$/i.test(file.name || '');
      if (!tipeOk && !extOk) {
        reject(new Error('Format foto harus JPG, JPEG, PNG, atau WEBP.'));
        return;
      }
      if (file.size > maksUkuran) {
        reject(new Error('Ukuran foto maksimal 2 MB.'));
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () {
        reject(new Error('Gagal membaca file foto.'));
      };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () {
          reject(new Error('File foto tidak dapat dibuka.'));
        };
        img.onload = function () {
          var lebar = img.width;
          var tinggi = img.height;
          if (lebar > maksLebar) {
            tinggi = Math.round(tinggi * (maksLebar / lebar));
            lebar = maksLebar;
          }
          var canvas = document.createElement('canvas');
          canvas.width = lebar;
          canvas.height = tinggi;
          var ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({
              nama: file.name,
              tipe: file.type || 'image/jpeg',
              ukuran: file.size,
              data: reader.result
            });
            return;
          }
          ctx.drawImage(img, 0, 0, lebar, tinggi);
          var png = /png/i.test(file.type || '') || /\.png$/i.test(file.name || '');
          var out;
          try {
            out = canvas.toDataURL(png ? 'image/png' : 'image/jpeg', 0.8);
          } catch (e) {
            out = reader.result;
          }
          // Jaga agar ukuran hasil tidak meledak (terutama saat foto masih
          // disimpan sebagai base64): perkecil ulang bila terlalu besar.
          if (!png && out && out.length > 450000 && lebar > 1200) {
            try {
              var lebar2 = 1200;
              var tinggi2 = Math.round(tinggi * (lebar2 / lebar));
              var canvas2 = document.createElement('canvas');
              canvas2.width = lebar2;
              canvas2.height = tinggi2;
              var ctx2 = canvas2.getContext('2d');
              if (ctx2) {
                ctx2.drawImage(img, 0, 0, lebar2, tinggi2);
                out = canvas2.toDataURL('image/jpeg', 0.75);
              }
            } catch (e2) {}
          }
          resolve({
            nama: file.name,
            tipe: png ? 'image/png' : 'image/jpeg',
            ukuran: Math.round(out.length * 0.75),
            data: out
          });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Semua isian landing page bersifat OPSIONAL.
  // Validasi hanya dijalankan bila field terisi (format email/URL/telepon).
  // Field kosong tidak menyebabkan error dan tidak menolak penyimpanan.
  function validasiBagian(nama, nilai) {
    var errors = [];
    var k = (nilai || {});
    if (nama === 'kontak') {
      if (k.phone && !validasiTelepon(k.phone)) errors.push('Nomor telepon hanya boleh angka dan tanda + - ( ) .');
      if (k.email && !validasiEmail(k.email)) errors.push('Format email tidak benar.');
      (k.sosmedList || []).forEach(function (s) {
        if (s.url && !validasiUrl(s.url)) errors.push('Tautan ' + (s.nama || 'media sosial') + ' harus diawali http:// atau https://');
      });
    }
    return errors;
  }

  // Muat semua foto dari IndexedDB ke cache, lalu pindahkan foto lama yang
  // masih berupa base64 di konfigurasi menjadi referensi IndexedDB.
  // Aman diulang; foto yang sudah tersimpan tidak pernah dihapus.
  function hidupkan() {
    return fotoSemua().then(function (rows) {
      (rows || []).forEach(function (row) {
        if (row && row.id && row.data) cacheFoto[row.id] = row.data;
      });
      return migrasiPenyimpanan();
    }).then(function (n) {
      // Beri tahu halaman yang sudah terlanjur render dengan referensi
      // yang belum terpecahkan agar gambar dimuat ulang.
      notify();
      return n;
    }, function () {
      notify();
      return 0;
    });
  }

  function migrasiPenyimpanan() {
    var mentah = bacaMentah();
    if (!mentah) return Promise.resolve(0);
    function base64(v) {
      return typeof v === 'string' && v.indexOf('data:') === 0;
    }
    // Path placeholder lama (assets/galeri/...) bukan foto unggahan dan
    // filenya tidak ada -> dikosongkan agar slot tampil "Belum ada foto".
    function placeholder(v) {
      return typeof v === 'string' && v.indexOf('assets/galeri/') === 0;
    }
    var perlu = [];
    var berubah = false;
    (mentah.kolase || []).forEach(function (k, i) {
      if (!k) return;
      if (base64(k.file)) perlu.push({ jalan: ['kolase', i, 'file'], data: k.file });
      else if (placeholder(k.file)) {
        k.file = '';
        berubah = true;
      }
    });
    (mentah.galeri || []).forEach(function (g, i) {
      if (!g) return;
      if (base64(g.src)) perlu.push({ jalan: ['galeri', i, 'src'], data: g.src });
      else if (base64(g.file)) perlu.push({ jalan: ['galeri', i, 'file'], data: g.file });
      else if (placeholder(g.src)) {
        g.src = '';
        berubah = true;
      } else if (placeholder(g.file)) {
        g.file = '';
        berubah = true;
      }
    });
    if (mentah.merek && base64(mentah.merek.logo)) perlu.push({ jalan: ['merek', 'logo'], data: mentah.merek.logo });
    if (!perlu.length) {
      if (!berubah) return Promise.resolve(0);
      try {
        localStorage.setItem(KEY, JSON.stringify(mentah));
      } catch (e) {}
      notify();
      return Promise.resolve(0);
    }
    if (!idbTersedia()) return Promise.resolve(0);
    var janji = Promise.resolve();
    perlu.forEach(function (p) {
      janji = janji.then(function () {
        return simpanFoto(p.data).then(function (ref) {
          var obj = mentah;
          for (var i = 0; i < p.jalan.length - 1; i++) obj = obj[p.jalan[i]];
          obj[p.jalan[p.jalan.length - 1]] = ref;
        });
      });
    });
    return janji.then(function () {
      try {
        localStorage.setItem(KEY, JSON.stringify(mentah));
      } catch (e) {}
      notify();
      return perlu.length;
    });
  }

  // Terima konfigurasi hasil muat dari cloud. Foto lokal yang hilang dari
  // data cloud (mis. terpotong karena terlalu besar saat sinkron) tetap
  // dipertahankan; nilai kosong eksplisit dari cloud tetap dihormati
  // (berarti foto dihapus di perangkat lain).
  function simpanDariCloud(isi) {
    if (!isi || typeof isi !== 'object') return;
    var lokal = bacaMentah() || {};
    var hasil = clone(isi);
    function pertahankan(jalan) {
      var obj = hasil;
      var asal = lokal;
      for (var i = 0; i < jalan.length - 1; i++) {
        if (!obj[jalan[i]]) return;
        obj = obj[jalan[i]];
        asal = asal ? asal[jalan[i]] : null;
      }
      var kunci = jalan[jalan.length - 1];
      if (!asal) return;
      if (obj[kunci] === undefined && asal[kunci]) obj[kunci] = asal[kunci];
    }
    (lokal.kolase || []).forEach(function (k, i) {
      if (k) pertahankan(['kolase', i, 'file']);
    });
    (lokal.galeri || []).forEach(function (g, i) {
      if (!g) return;
      pertahankan(['galeri', i, 'src']);
      pertahankan(['galeri', i, 'file']);
    });
    pertahankan(['merek', 'logo']);
    simpan(hasil);
  }

  return {
    defaults: defaults,
    get: get,
    simpan: simpan,
    saveBagian: saveBagian,
    resetBagian: resetBagian,
    resetAll: resetAll,
    subscribe: subscribe,
    bacaFoto: bacaFoto,
    urlFoto: urlFoto,
    simpanFoto: simpanFoto,
    hapusFotoRef: hapusFotoRef,
    hidupkan: hidupkan,
    simpanDariCloud: simpanDariCloud,
    validasiEmail: validasiEmail,
    validasiUrl: validasiUrl,
    validasiTelepon: validasiTelepon,
    validasiBagian: validasiBagian
  };
})();

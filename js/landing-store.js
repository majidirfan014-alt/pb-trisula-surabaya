var LandingStore = (function () {
  var KEY = CONFIG.PREFIX + 'landing';
  var DB_FOTO = CONFIG.PREFIX + 'foto';
  var TOKOH = 'idb:';
  var listeners = [];

  // Foto disimpan sebagai Blob di IndexedDB; konfigurasi cukup menyimpan
  // referensi "idb:xxx" (atau URL https bila diunggah ke cloud) sehingga
  // kuota localStorage tidak terlampaui dan unggah tetap ringan.
  var cacheFoto = {};   // id -> Blob (atau data URL untuk data lama)
  var cacheUrl = {};    // id -> object URL yang sedang dipakai
  var janjiDb = null;

  var MAKS_ASLI = 10 * 1024 * 1024;    // file asli yang diterima
  var MAKS_HASIL = 2 * 1024 * 1024;    // batas ukuran hasil kompresi
  var MAKS_LEBAR = 1600;               // lebar maksimum hasil

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

  // Simpan satu record foto ({ id, blob } untuk data baru, atau
  // { id, data } untuk data lama) — hanya record ini yang ditulis.
  function fotoTulis(id, isi) {
    return bukaDb().then(function (db) {
      if (!db) return false;
      return new Promise(function (resolve) {
        try {
          var req = db.transaction('foto', 'readwrite').objectStore('foto').put({ id: id, blob: isi.blob, data: isi.data });
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

  function buatObjectUrl(blob) {
    try {
      if (typeof URL !== 'undefined' && URL.createObjectURL) return URL.createObjectURL(blob);
    } catch (e) {}
    return '';
  }

  function buangObjectUrl(id) {
    var u = cacheUrl[id];
    if (u) {
      try {
        if (typeof URL !== 'undefined' && URL.revokeObjectURL) URL.revokeObjectURL(u);
      } catch (e) {}
      delete cacheUrl[id];
    }
  }

  // Ubah nilai foto di konfigurasi menjadi sumber yang bisa dipakai <img src>.
  // Referensi "idb:xxx" diubah menjadi object URL (cepat, tanpa base64);
  // URL/path diteruskan apa adanya.
  function urlFoto(v) {
    var s = String(v || '');
    if (s.indexOf(TOKOH) !== 0) return s;
    var id = s.slice(TOKOH.length);
    if (cacheUrl[id]) return cacheUrl[id];
    var isi = cacheFoto[id];
    if (!isi) return '';
    if (typeof isi === 'string') return isi;       // data lama (data URL)
    var url = buatObjectUrl(isi);
    if (url) cacheUrl[id] = url;
    return url;
  }

  // Ubah data URL lama menjadi Blob (dipakai migrasi; bukan jalur unggah).
  function dataUrlKeBlob(dataUrl) {
    var potongan = String(dataUrl).split(',');
    var meta = potongan[0] || '';
    var isi = potongan[1] || '';
    var tipe = /data:([^;]+)/.exec(meta);
    var biner = atob(isi);
    var arr = new Uint8Array(biner.length);
    for (var i = 0; i < biner.length; i++) arr[i] = biner.charCodeAt(i);
    return new Blob([arr], { type: (tipe && tipe[1]) || 'image/jpeg' });
  }

  // Simpan foto ke IndexedDB (sebagai Blob) dan kembalikan referensinya.
  // Menerima Blob (jalur baru) atau data URL (jalur lama). URL https tidak
  // disimpan ulang, langsung dikembalikan apa adanya.
  function simpanFoto(sumber) {
    if (!sumber) return Promise.resolve('');
    if (typeof sumber === 'string') {
      if (sumber.indexOf('data:') !== 0) return Promise.resolve(sumber);
      if (!idbTersedia()) return Promise.resolve(sumber);
      try {
        sumber = dataUrlKeBlob(sumber);
      } catch (e) {
        return Promise.resolve(sumber);
      }
    }
    if (!idbTersedia()) {
      // Tanpa IndexedDB, tampilkan langsung sebagai object URL bila memungkinkan.
      var urlDarat = buatObjectUrl(sumber);
      return Promise.resolve(urlDarat || '');
    }
    var id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    return fotoTulis(id, { blob: sumber }).then(function (ok) {
      if (!ok) {
        var cadangan = buatObjectUrl(sumber);
        return cadangan || '';
      }
      cacheFoto[id] = sumber;
      return TOKOH + id;
    });
  }

  // Hapus foto lokal (bila nilainya referensi IndexedDB) dari penyimpanan.
  function hapusFotoRef(v) {
    var s = String(v || '');
    if (s.indexOf(TOKOH) !== 0) return Promise.resolve(false);
    var id = s.slice(TOKOH.length);
    buangObjectUrl(id);
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

  // ---- Pengolahan foto yang cepat -------------------------------------------
  // 1. Validasi ringan (format + ukuran asli) dilakukan lebih dulu.
  // 2. Decode memakai createImageBitmap (fallback: Image + object URL,
  //    tanpa base64 sama sekali).
  // 3. Perkecil sekali ke lebar maksimal 1600px (rasio tetap) lalu kompres
  //    sekali lewat canvas.toBlob / OffscreenCanvas.convertToBlob.
  //    Bila hasil masih > 2 MB, kualitas diturunkan maksimal dua kali lagi.
  // Hasil akhir berupa Blob (bukan data URL) agar penyimpanan & pratinjau
  // tidak memakai base64 yang berat.
  function decodeGambar(file) {
    function lewatGambar() {
      return new Promise(function (resolve, reject) {
        var url = '';
        try {
          url = URL.createObjectURL(file);
        } catch (e) {
          reject(new Error('File foto tidak dapat dibuka.'));
          return;
        }
        var img = new Image();
        img.onerror = function () {
          try {
            URL.revokeObjectURL(url);
          } catch (e2) {}
          reject(new Error('File foto tidak dapat dibuka.'));
        };
        img.onload = function () {
          resolve({
            sumber: img,
            lebar: img.naturalWidth || img.width,
            tinggi: img.naturalHeight || img.height,
            bersihkan: function () {
              try {
                URL.revokeObjectURL(url);
              } catch (e2) {}
            }
          });
        };
        img.src = url;
      });
    }
    if (typeof createImageBitmap === 'function') {
      return Promise.resolve().then(function () {
        return createImageBitmap(file);
      }).then(function (bitmap) {
        return {
          sumber: bitmap,
          lebar: bitmap.width,
          tinggi: bitmap.height,
          bersihkan: function () {
            try {
              if (bitmap.close) bitmap.close();
            } catch (e) {}
          }
        };
      }).catch(function () {
        return lewatGambar();
      });
    }
    return lewatGambar();
  }

  function buatKanvas(lebar, tinggi) {
    if (typeof OffscreenCanvas !== 'undefined') {
      try {
        return { kanvas: new OffscreenCanvas(lebar, tinggi), luring: true };
      } catch (e) {}
    }
    var kanvas = document.createElement('canvas');
    kanvas.width = lebar;
    kanvas.height = tinggi;
    return { kanvas: kanvas, luring: false };
  }

  function kanvasKeBlob(wadah, tipe, kualitas) {
    return new Promise(function (resolve, reject) {
      var kanvas = wadah.kanvas;
      if (wadah.luring && kanvas.convertToBlob) {
        kanvas.convertToBlob({ type: tipe, quality: kualitas }).then(resolve, function () {
          reject(new Error('Gagal mengolah foto.'));
        });
        return;
      }
      if (!kanvas.toBlob) {
        // Browser sangat lama: cadangan terakhir memakai data URL.
        try {
          resolve(dataUrlKeBlob(kanvas.toDataURL(tipe, kualitas)));
        } catch (e) {
          reject(new Error('Gagal mengolah foto.'));
        }
        return;
      }
      kanvas.toBlob(function (blob) {
        if (!blob) reject(new Error('Gagal mengolah foto.'));
        else resolve(blob);
      }, tipe, kualitas);
    });
  }

  // Kompres sekali; bila hasil masih melebihi batas, turunkan kualitas
  // maksimal dua kali (total maksimal tiga kali encode, bukan loop).
  function kompres(sumber, lebar, tinggi, png, maksHasil) {
    var wadah = buatKanvas(lebar, tinggi);
    var ctx = wadah.kanvas.getContext && wadah.kanvas.getContext('2d');
    if (!ctx) {
      // Canvas tidak tersedia (browser lama) — pakai file apa adanya.
      return Promise.resolve(null);
    }
    try {
      ctx.drawImage(sumber, 0, 0, lebar, tinggi);
    } catch (e) {
      return Promise.reject(new Error('Gagal mengolah foto.'));
    }
    var percobaan = [
      { tipe: png ? 'image/png' : 'image/jpeg', q: 0.8, lebar: lebar, tinggi: tinggi },
      { tipe: 'image/jpeg', q: 0.75, lebar: lebar, tinggi: tinggi },
      { tipe: 'image/jpeg', q: 0.7, lebar: Math.round(lebar * 0.8), tinggi: Math.round(tinggi * 0.8) }
    ];
    var janji = Promise.resolve(null);
    percobaan.forEach(function (p, i) {
      janji = janji.then(function (hasil) {
        if (hasil && hasil.size <= maksHasil) return hasil;
        if (i > 0) {
          // gambar ulang dimensi baru hanya bila perlu
          var w = buatKanvas(p.lebar, p.tinggi);
          var c2 = w.kanvas.getContext && w.kanvas.getContext('2d');
          if (!c2) return hasil;
          try {
            c2.drawImage(sumber, 0, 0, p.lebar, p.tinggi);
          } catch (e) {
            return hasil;
          }
          wadah = w;
        }
        return kanvasKeBlob(wadah, p.tipe, p.q);
      });
    });
    return janji.then(function (hasil) {
      if (!hasil) return null;
      if (hasil.size > maksHasil) {
        throw new Error('Ukuran foto tetap di atas 2 MB setelah dikompresi. Coba foto lain.');
      }
      return hasil;
    });
  }

  // opts: { maksUkuran, maksLebar, maksHasil, onTahap(teks) }
  function bacaFoto(file, opts) {
    opts = opts || {};
    var maksUkuran = opts.maksUkuran || MAKS_ASLI;
    var maksLebar = opts.maksLebar || MAKS_LEBAR;
    var maksHasil = opts.maksHasil || MAKS_HASIL;
    var tahap = typeof opts.onTahap === 'function' ? opts.onTahap : function () {};

    // Validasi ringan dulu (sebelum operasi berat apa pun).
    if (!file) return Promise.reject(new Error('Pilih file foto terlebih dahulu.'));
    var tipeOk = /^image\/(jpeg|jpg|png|webp)$/i.test(file.type || '');
    var extOk = /\.(jpe?g|png|webp)$/i.test(file.name || '');
    if (!tipeOk && !extOk) {
      return Promise.reject(new Error('Format foto harus JPG, JPEG, PNG, atau WEBP.'));
    }
    if (file.size > maksUkuran) {
      return Promise.reject(new Error('Ukuran file asli maksimal 10 MB.'));
    }
    if (!file.size) {
      return Promise.reject(new Error('File foto kosong atau rusak.'));
    }

    tahap('Membaca foto...');
    return decodeGambar(file).then(function (hasil) {
      if (!hasil.lebar || !hasil.tinggi) {
        hasil.bersihkan();
        throw new Error('File foto tidak dapat dibuka.');
      }
      tahap('Mengecilkan...');
      var rasio = hasil.lebar > maksLebar ? maksLebar / hasil.lebar : 1;
      var lebar = Math.max(1, Math.round(hasil.lebar * rasio));
      var tinggi = Math.max(1, Math.round(hasil.tinggi * rasio));
      var png = /png/i.test(file.type || '') || /\.png$/i.test(file.name || '');
      return kompres(hasil.sumber, lebar, tinggi, png, maksHasil).then(function (blob) {
        hasil.bersihkan();
        return {
          nama: file.name,
          tipe: (blob && blob.type) || 'image/jpeg',
          ukuran: (blob && blob.size) || file.size,
          blob: blob || file
        };
      }, function (err) {
        hasil.bersihkan();
        throw err;
      });
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

  // Muat semua foto dari IndexedDB ke cache, migrasi record lama (data URL)
  // menjadi Blob, lalu pindahkan foto base64 yang masih di konfigurasi
  // menjadi referensi IndexedDB. Aman diulang; foto tidak pernah dihapus.
  function hidupkan() {
    return fotoSemua().then(function (rows) {
      var perluUbah = [];
      (rows || []).forEach(function (row) {
        if (!row || !row.id) return;
        if (row.blob) {
          cacheFoto[row.id] = row.blob;
        } else if (row.data) {
          cacheFoto[row.id] = row.data;
          perluUbah.push(row);
        }
      });
      // Migrasi record lama -> Blob, ID tetap sama agar referensi lama
      // di konfigurasi tidak rusak.
      var janji = Promise.resolve();
      perluUbah.forEach(function (row) {
        janji = janji.then(function () {
          try {
            var blob = dataUrlKeBlob(row.data);
            return fotoTulis(row.id, { blob: blob }).then(function (ok) {
              if (ok) cacheFoto[row.id] = blob;
            });
          } catch (e) {
            return null;
          }
        });
      });
      return janji;
    }).then(function () {
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

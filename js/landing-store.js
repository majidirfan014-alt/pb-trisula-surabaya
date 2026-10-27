var LandingStore = (function () {
  var KEY = CONFIG.PREFIX + 'landing';
  var DB_FOTO = CONFIG.PREFIX + 'foto';
  var TOKOH = 'idb:';            // referensi foto di IndexedDB (lokal)
  var TOKOH_FIRE = 'firestore:'; // referensi foto di Firestore (cloud, gratis)
  var listeners = [];

  // Foto disimpan di "cloud" (Firestore -> URL publik Storage bila tersedia),
  // cadangan lokal di IndexedDB. Konfigurasi hanya menyimpan REFERENSI
  // (firestore:xxx / idb:xxx / https://...) — hemat kuota & sinkron antar
  // perangkat karena koleksi foto Firestore bisa dibaca publik.
  var cacheFoto = {};   // referensi lengkap -> data URL / Blob (data lama)
  var cacheUrl = {};    // referensi lengkap -> object URL yang sedang dipakai
  var janjiDb = null;

  var MAKS_ASLI = 10 * 1024 * 1024;    // file asli yang diterima
  var MAKS_HASIL = 2 * 1024 * 1024;    // batas ukuran hasil kompresi
  var MAKS_LEBAR = 1600;               // lebar maksimum hasil
  var MAKS_FIRE = 650 * 1024;          // ~870KB base64 — aman di bawah 1 MB dokumen Firestore

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

  function buangObjectUrl(kunci) {
    var u = cacheUrl[kunci];
    if (u) {
      try {
        if (typeof URL !== 'undefined' && URL.revokeObjectURL) URL.revokeObjectURL(u);
      } catch (e) {}
      delete cacheUrl[kunci];
    }
  }

  function kunciLokal(id) {
    return TOKOH + id;
  }

  function refDariNilai(v) {
    var s = String(v || '');
    if (s.indexOf(TOKOH) === 0 || s.indexOf(TOKOH_FIRE) === 0) return s;
    return '';
  }

  // Ubah nilai foto di konfigurasi menjadi sumber yang bisa dipakai <img src>.
  // Referensi firestore:/idb: diubah menjadi data URL / object URL dari cache
  // (cache diisi dari Firestore sehingga tampil di perangkat mana pun);
  // URL/path diteruskan apa adanya.
  function urlFoto(v) {
    var s = String(v || '');
    if (!refDariNilai(s)) return s;
    if (cacheUrl[s]) return cacheUrl[s];
    var isi = cacheFoto[s];
    if (!isi) return '';
    if (typeof isi === 'string') return isi;       // data URL (cloud / data lama)
    var url = buatObjectUrl(isi);
    if (url) cacheUrl[s] = url;
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

  // Simpan foto ke PENYIMPANAN TERPUSAT (Firebase Storage) dan kembalikan
  // URL publiknya; bila cloud tidak tersedia, fallback ke IndexedDB lokal,
  // lalu data URL. TIDAK PERNAH menyimpan blob URL (mati setelah refresh).
  function cloudSiap() {
    try {
      return typeof Cloud !== 'undefined' && Cloud && typeof Cloud.siap === 'function' && Cloud.siap();
    } catch (e) {
      return false;
    }
  }

  // Tunggu layanan cloud siap (SDK Firebase dimuat) maksimal `budget` ms.
  function tungguCloudSiap(budget) {
    if (cloudSiap()) return Promise.resolve(true);
    try {
      if (typeof Cloud === 'undefined' || !Cloud || typeof Cloud.init !== 'function') return Promise.resolve(false);
    } catch (e) {
      return Promise.resolve(false);
    }
    return new Promise(function (resolve) {
      var selesai = false;
      function akhir(v) {
        if (selesai) return;
        selesai = true;
        resolve(!!v);
      }
      setTimeout(function () {
        akhir(cloudSiap());
      }, budget || 8000);
      try {
        Promise.resolve(Cloud.init()).then(function () {
          akhir(cloudSiap());
        }, function () {
          akhir(false);
        });
      } catch (e) {
        akhir(false);
      }
    });
  }

  // Unggah Blob ke Firebase Storage -> URL publik (bisa dibuka tanpa login).
  // Mengembalikan { url, galat } — galat berisi pesan asli bila gagal.
  function unggahKeCloud(blob, folder, nama) {
    return tungguCloudSiap(5000).then(function (ok) {
      if (!ok || !cloudSiap()) {
        return {
          url: '',
          galat: 'Cloud tidak aktif: ' + (
            (typeof Cloud !== 'undefined' && Cloud && Cloud.diagnosa && Cloud.diagnosa().galatMuat) ||
            'SDK Firebase tidak tersedia / konfigurasi belum diisi.'
          )
        };
      }
      if (typeof Cloud === 'undefined' || !Cloud || typeof Cloud.unggahPublik !== 'function') {
        return { url: '', galat: 'Modul cloud tidak memuat fungsi unggah.' };
      }
      var berkas;
      try {
        berkas = typeof File === 'function'
          ? new File([blob], nama || 'foto.jpg', { type: blob.type || 'image/jpeg' })
          : blob;
      } catch (e) {
        berkas = blob;
      }
      var unggahan;
      try {
        unggahan = Promise.resolve(Cloud.unggahPublik(berkas, folder || 'foto/landing', nama || 'foto.jpg'));
      } catch (e) {
        return Promise.resolve({ url: '', galat: (e && e.message) || 'Gagal memulai unggah.' });
      }
      // Batasi waktu unggah jaringan agar proses tidak menggantung.
      return new Promise(function (resolve) {
        var selesai = false;
        function akhir(v) {
          if (selesai) return;
          selesai = true;
          resolve(v);
        }
        setTimeout(function () {
          akhir({ url: '', galat: 'Batas waktu unggah ke cloud terlampaui (jaringan lambat).' });
        }, 7000);
        unggahan.then(function (url) {
          akhir({ url: url || '', galat: url ? '' : 'Cloud tidak mengembalikan URL unggahan.' });
        }, function (e) {
          akhir({ url: '', galat: (e && e.message) || 'Gagal unggah ke cloud.' });
        });
      });
    });
  }

  // Kecilkan ulang foto yang terlalu besar untuk dokumen Firestore (1 MB).
  function perkecilUntukFirestore(blob) {
    if (!blob || blob.size <= MAKS_FIRE) return Promise.resolve(blob);
    return decodeGambar(blob).then(function (hasil) {
      var lebar = Math.min(1200, hasil.lebar);
      var tinggi = Math.max(1, Math.round(hasil.tinggi * (lebar / hasil.lebar)));
      return kompres(hasil.sumber, lebar, tinggi, false, MAKS_FIRE).then(function (b) {
        hasil.bersihkan();
        return b || blob;
      }, function () {
        hasil.bersihkan();
        return blob;
      });
    }, function () {
      return blob;
    });
  }

  // Simpan ke cloud gratis (Firestore) lebih dulu; bila tidak bisa, coba
  // Firebase Storage (butuh plan Blaze), lalu kembalikan galat bila keduanya
  // gagal agar pemanggil menampilkan penyebab + tombol Coba Lagi.
  function simpanKeFirestore(blob, opts) {
    if (typeof Cloud === 'undefined' || !Cloud || typeof Cloud.fotoDbSimpan !== 'function') {
      return Promise.resolve({ url: '', galat: 'Modul cloud tidak memuat penyimpanan foto.' });
    }
    var dataUrl = '';
    return perkecilUntukFirestore(blob).then(function (b) {
      return blobKeDataUrl(b);
    }).then(function (d) {
      dataUrl = d;
      if (!dataUrl) throw new Error('Gagal mengolah foto.');
      return Cloud.fotoDbSimpan(dataUrl);
    }).then(function (id) {
      var ref = TOKOH_FIRE + id;
      // Simpan ke cache agar pratinjau langsung tampil tanpa menunggu muat ulang.
      cacheFoto[ref] = dataUrl;
      return { url: ref, galat: '' };
    }, function (e) {
      return { url: '', galat: (e && e.message) || 'Gagal menyimpan foto ke cloud.' };
    });
  }

  function simpanKeCloud(blob, opts) {
    opts = opts || {};
    return simpanKeFirestore(blob, opts).then(function (hasil) {
      if (hasil.url) return hasil;
      // Cadangan: Firebase Storage (tersedia bila proyek sudah plan Blaze).
      return unggahKeCloud(blob, opts.folder, opts.nama);
    });
  }

  function simpanLokal(blob) {
    if (!idbTersedia()) return Promise.resolve('');
    var id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    return fotoTulis(id, { blob: blob }).then(function (ok) {
      if (!ok) return '';
      var ref = TOKOH + id;
      cacheFoto[ref] = blob;
      return ref;
    });
  }

  function blobKeDataUrl(blob) {
    return new Promise(function (resolve) {
      try {
        var reader = new FileReader();
        reader.onerror = function () {
          resolve('');
        };
        reader.onload = function () {
          resolve(String(reader.result || ''));
        };
        reader.readAsDataURL(blob);
      } catch (e) {
        resolve('');
      }
    });
  }

  // Simpan foto: UTAMAKAN cloud (URL publik), fallback lokal bila gagal.
  // Mengembalikan { nilai, lokal, galat } — galat berisi penyebab asli bila
  // foto tidak berhasil diunggah ke cloud (pemanggil menampilkannya + retry).
  function simpanFoto(sumber, opts) {
    opts = opts || {};
    var janjiBlob;
    if (typeof sumber === 'string') {
      if (sumber.indexOf('data:') !== 0) {
        // URL https / path — tidak perlu disimpan ulang
        return Promise.resolve({ nilai: sumber, lokal: false, galat: '' });
      }
      try {
        janjiBlob = Promise.resolve(dataUrlKeBlob(sumber));
      } catch (e) {
        return Promise.reject(new Error('Gagal membaca foto.'));
      }
    } else {
      janjiBlob = Promise.resolve(sumber);
    }
    return janjiBlob.then(function (blob) {
      if (!blob) throw new Error('Gagal menyimpan foto.');
      return simpanKeCloud(blob, opts).then(function (hasil) {
        if (hasil.url) return { nilai: hasil.url, lokal: false, galat: '' };
        return simpanLokal(blob).then(function (ref) {
          if (ref) return { nilai: ref, lokal: true, galat: hasil.galat };
          return blobKeDataUrl(blob).then(function (dataUrl) {
            return { nilai: dataUrl || '', lokal: true, galat: hasil.galat };
          });
        });
      });
    });
  }

  // Ambil Blob/data URL di balik sebuah nilai foto (idb: / firestore: / data:).
  function blobDariNilai(nilai) {
    var s = String(nilai || '');
    var ref = refDariNilai(s);
    if (ref) {
      var isi = cacheFoto[ref];
      if (!isi) return Promise.resolve(null);
      if (typeof isi !== 'string') return Promise.resolve(isi);
      try {
        return Promise.resolve(dataUrlKeBlob(isi));
      } catch (e) {
        return Promise.resolve(null);
      }
    }
    if (s.indexOf('data:') === 0) {
      try {
        return Promise.resolve(dataUrlKeBlob(s));
      } catch (e) {
        return Promise.resolve(null);
      }
    }
    return Promise.resolve(null);
  }

  // Unggah ulang foto lokal ke cloud (untuk tombol "Sinkronkan ke Cloud"
  // dan migrasi otomatis). Mengembalikan { nilai, lokal, galat }.
  function sinkronkanKeCloud(nilai, opts) {
    opts = opts || {};
    return blobDariNilai(nilai).then(function (blob) {
      if (!blob) return { nilai: nilai, lokal: true, galat: 'File foto tidak ditemukan di perangkat ini — silakan unggah ulang.' };
      return simpanKeCloud(blob, opts).then(function (hasil) {
        if (hasil.url) return { nilai: hasil.url, lokal: false, galat: '' };
        return { nilai: nilai, lokal: true, galat: hasil.galat };
      });
    });
  }

  // Lepas foto dari TAMPILAN & cache lokal (tombol Hapus / ganti foto).
  // Sengaja TIDAK menghapus file dari penyimpanan cloud/IndexedDB —
  // foto yang sudah tersimpan tidak boleh hilang (bisa dipakai lagi /
  // dipulihkan), sesuai aturan data tidak boleh terhapus.
  function hapusFotoRef(v) {
    var s = String(v || '');
    if (!refDariNilai(s)) return Promise.resolve(false);
    buangObjectUrl(s);
    delete cacheFoto[s];
    return Promise.resolve(true);
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

  // Normalisasi nomor tampil (mis. 0812-3456-7890) menjadi format tautan
  // internasional +62... untuk tel:/wa.me.
  function normalisasiTautan(tampil) {
    var v = String(tampil || '').trim();
    if (!v) return '';
    var digits = v.replace(/[^\d]/g, '');
    if (!digits) return '';
    if (digits.slice(0, 2) === '62') return '+' + digits;
    if (digits.slice(0, 1) === '0') return '+62' + digits.slice(1);
    return '+' + digits;
  }

  // Migrasi data lama (satu nomor: kontak.phone/phoneLink) menjadi daftar
  // nomor (kontak.nomor). Aman diulang; data lama tidak dihapus.
  function migrasiNomor(kontak) {
    if (!kontak) return kontak;
    if (!Array.isArray(kontak.nomor)) {
      kontak.nomor = [];
      if (kontak.phone) {
        kontak.nomor.push({
          label: '',
          tampil: String(kontak.phone),
          tautan: kontak.phoneLink || normalisasiTautan(kontak.phone)
        });
      }
    }
    return kontak;
  }
  function get() {
    var hasil = defaults();
    var simpanan = bacaMentah();
    if (simpanan) gabung(hasil, simpanan);
    // Migrasi nomor telepon: pakai daftar yang tersimpan bila ada; selain itu
    // bangun dari data lama (phone/phoneLink) — bukan dari nilai default —
    // agar nomor lama pengguna tidak tertimpa oleh nomor contoh.
    var simpananNomor = simpanan && simpanan.kontak && Array.isArray(simpanan.kontak.nomor);
    if (!simpananNomor) {
      var kontakSimpan = (simpanan && simpanan.kontak) || {};
      var phone = kontakSimpan.phone || hasil.kontak.phone;
      var link = kontakSimpan.phoneLink || hasil.kontak.phoneLink;
      hasil.kontak.nomor = phone
        ? [{ label: '', tampil: String(phone), tautan: link || normalisasiTautan(phone) }]
        : [];
    }
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
      (k.nomorList || []).forEach(function (n, i) {
        if (n && n.tampil && !validasiTelepon(n.tampil)) {
          errors.push('Nomor telepon ke-' + (i + 1) + ' hanya boleh angka dan tanda + - ( ) .');
        }
        if (n && n.tautan && !validasiTelepon(n.tautan)) {
          errors.push('Nomor untuk tautan ke-' + (i + 1) + ' hanya boleh angka dan tanda + - ( ) .');
        }
      });
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
  // Muat foto dari Firestore (semua perangkat) + IndexedDB (perangkat ini)
  // ke cache, migrasi record lama menjadi Blob, lalu perbaiki data lama di
  // konfigurasi. Aman diulang; foto tidak pernah dihapus.
  function hidupkan() {
    return fotoSemua().then(function (rows) {
      var perluUbah = [];
      (rows || []).forEach(function (row) {
        if (!row || !row.id) return;
        var ref = kunciLokal(row.id);
        if (row.blob) {
          cacheFoto[ref] = row.blob;
        } else if (row.data) {
          cacheFoto[ref] = row.data;
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
              if (ok) cacheFoto[kunciLokal(row.id)] = blob;
            });
          } catch (e) {
            return null;
          }
        });
      });
      return janji;
    }).then(function () {
      // Foto di Firestore bersifat publik -> tampil di perangkat mana pun,
      // bahkan bila perangkat ini belum pernah mengunggahnya.
      if (typeof Cloud === 'undefined' || !Cloud || typeof Cloud.fotoDbSemua !== 'function') {
        return null;
      }
      return Cloud.fotoDbSemua().then(function (rows) {
        (rows || []).forEach(function (row) {
          if (row && row.id && row.data) {
            var ref = TOKOH_FIRE + row.id;
            if (!cacheFoto[ref]) cacheFoto[ref] = row.data;
          }
        });
      }, function () {});
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

  // Migrasi otomatis & perbaikan data foto lama (aman diulang, foto tidak
  // pernah dihapus):
  //  - nilai blob: URL (mati setelah refresh) dibersihkan -> slot kosong rapi;
  //  - foto base64 lama dipindahkan ke cloud/IndexedDB;
  //  - foto lokal (idb:) yang BLOB-nya ada di perangkat ini diunggah ulang ke
  //    cloud sehingga tampil juga di perangkat lain (URL publik di konfigurasi).
  function migrasiPenyimpanan() {
    var mentah = bacaMentah();
    if (!mentah) return Promise.resolve(0);
    function base64(v) {
      return typeof v === 'string' && v.indexOf('data:') === 0;
    }
    function placeholder(v) {
      return typeof v === 'string' && v.indexOf('assets/galeri/') === 0;
    }
    function blobUrl(v) {
      return typeof v === 'string' && v.indexOf('blob:') === 0;
    }
    var perlu = [];   // { jalan, data }  -> data URL lama
    var unggahUlang = [];  // { jalan, blob } -> foto lokal yang bisa dipublikasikan
    var berubah = false;

    function tangani(obj, kunci, jalan) {
      var v = obj[kunci];
      if (base64(v)) {
        perlu.push({ jalan: jalan, data: v });
      } else if (placeholder(v) || blobUrl(v) || v === 'undefined' || v === 'null') {
        // nilai rusak/basi -> kosongkan agar tampil placeholder bersih
        obj[kunci] = '';
        berubah = true;
      } else if (typeof v === 'string' && v.indexOf(TOKOH) === 0 && cloudSiap()) {
        var blob = cacheFoto[v];
        if (blob && typeof blob !== 'string') unggahUlang.push({ jalan: jalan, blob: blob });
      }
      // nilai firestore:/https: sudah di cloud -> biarkan
    }

    (mentah.kolase || []).forEach(function (k, i) {
      if (k) tangani(k, 'file', ['kolase', i, 'file']);
    });
    (mentah.galeri || []).forEach(function (g, i) {
      if (!g) return;
      tangani(g, 'src', ['galeri', i, 'src']);
      tangani(g, 'file', ['galeri', i, 'file']);
    });
    if (mentah.merek) tangani(mentah.merek, 'logo', ['merek', 'logo']);

    function setNilai(jalan, nilai) {
      var obj = mentah;
      for (var i = 0; i < jalan.length - 1; i++) obj = obj[jalan[i]];
      obj[jalan[jalan.length - 1]] = nilai;
    }

    var janji = Promise.resolve(0);
    var total = 0;

    // 1) publikasikan foto lokal ke cloud (agar tampil di perangkat lain)
    unggahUlang.forEach(function (u) {
      janji = janji.then(function () {
        return simpanKeCloud(u.blob, { folder: 'foto/landing', nama: 'foto-lama.jpg' }).then(function (hasil) {
          if (!hasil.url) return;
          setNilai(u.jalan, hasil.url);
          berubah = true;
          total++;
        });
      });
    });

    // 2) pindahkan foto base64 lama (cloud dahulu, lalu IndexedDB)
    perlu.forEach(function (p) {
      janji = janji.then(function () {
        return simpanFoto(p.data, { folder: 'foto/landing', nama: 'foto-lama.jpg' }).then(function (hasil) {
          if (!hasil || !hasil.nilai) return;
          setNilai(p.jalan, hasil.nilai);
          berubah = true;
          total++;
        }, function () {});
      });
    });

    return janji.then(function () {
      if (!berubah) return 0;
      try {
        localStorage.setItem(KEY, JSON.stringify(mentah));
      } catch (e) {}
      notify();
      return total;
    });
  }

  // Sinkronkan SEMUA foto lokal (idb:/data:) ke cloud lalu simpan URL-nya.
  // Dipakai tombol "Sinkronkan ke Cloud" — mengembalikan { sukses, gagal, pesan }.
  function sinkronkanSemuaLokal(folder) {
    var mentah = bacaMentah();
    if (!mentah) return Promise.resolve({ sukses: 0, gagal: 0, pesan: 'Belum ada data foto.' });
    var daftar = [];
    function tampung(obj, kunci, jalan) {
      var v = obj[kunci];
      if (typeof v === 'string' && (v.indexOf(TOKOH) === 0 || v.indexOf('data:') === 0)) {
        daftar.push({ jalan: jalan, nilai: v });
      }
    }
    (mentah.kolase || []).forEach(function (k, i) {
      if (k) tampung(k, 'file', ['kolase', i, 'file']);
    });
    (mentah.galeri || []).forEach(function (g, i) {
      if (!g) return;
      tampung(g, 'src', ['galeri', i, 'src']);
      tampung(g, 'file', ['galeri', i, 'file']);
    });
    if (mentah.merek) tampung(mentah.merek, 'logo', ['merek', 'logo']);
    if (!daftar.length) return Promise.resolve({ sukses: 0, gagal: 0, pesan: 'Semua foto sudah tersinkron.', semua: true });

    var sukses = 0;
    var gagal = 0;
    var galatTerakhir = '';
    var janji = Promise.resolve();
    daftar.forEach(function (d) {
      janji = janji.then(function () {
        return sinkronkanKeCloud(d.nilai, { folder: folder || 'foto/landing' }).then(function (hasil) {
          if (hasil.lokal) {
            gagal++;
            galatTerakhir = hasil.galat || galatTerakhir;
            return;
          }
          var obj = mentah;
          for (var i = 0; i < d.jalan.length - 1; i++) obj = obj[d.jalan[i]];
          obj[d.jalan[d.jalan.length - 1]] = hasil.nilai;
          sukses++;
        });
      });
    });
    return janji.then(function () {
      if (sukses) {
        try {
          localStorage.setItem(KEY, JSON.stringify(mentah));
        } catch (e) {}
        notify();
      }
      return {
        sukses: sukses,
        gagal: gagal,
        pesan: sukses
          ? sukses + ' foto berhasil disinkronkan ke cloud.'
          : ('Gagal sinkron ke cloud: ' + (galatTerakhir || 'tidak diketahui'))
      };
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
    function nilaiMati(v) {
      return typeof v === 'string' && (v.indexOf('blob:') === 0 || v === 'undefined' || v === 'null');
    }
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
      // Pertahankan foto lokal bila cloud tidak membawanya ATAU membawa
      // nilai rusak (blob URL basi / referensi yang tidak berarti).
      if ((obj[kunci] === undefined || nilaiMati(obj[kunci])) && asal[kunci] && !nilaiMati(asal[kunci])) {
        obj[kunci] = asal[kunci];
      } else if (nilaiMati(obj[kunci])) {
        obj[kunci] = '';
      }
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

  /* ---------- ringkasan publik (jumlah atlet & asisten) ----------
     Landing page hanya boleh menampilkan JUMLAH (bukan data pribadi), dan
     pengunjung publik tidak perlu membaca koleksi users. Hitungan disimpan
     sebagai dokumen publik "landing/ringkasan" + salinan lokal, diperbarui
     otomatis oleh dashboard saat data pengguna berubah. */

  var KEY_RINGKASAN = CONFIG.PREFIX + 'ringkasan';

  function simpanRingkasan(isi) {
    var data = {
      jumlahAtlet: Number(isi && isi.jumlahAtlet) || 0,
      jumlahAsisten: Number(isi && isi.jumlahAsisten) || 0,
      diperbarui: new Date().toISOString()
    };
    try {
      localStorage.setItem(KEY_RINGKASAN, JSON.stringify(data));
    } catch (e) {}
    try {
      if (typeof Cloud !== 'undefined' && Cloud && typeof Cloud.ringkasanTulis === 'function') {
        Promise.resolve(Cloud.ringkasanTulis(data)).then(function () {}, function () {});
      }
    } catch (e) {}
    notify();
    return data;
  }

  function ambilRingkasan() {
    try {
      var raw = localStorage.getItem(KEY_RINGKASAN);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  // Muat ringkasan dari Firestore (publik) -> simpan lokal -> beri tahu
  // halaman agar render ulang. Dipanggil saat boot landing page.
  function muatRingkasan() {
    if (typeof Cloud === 'undefined' || !Cloud || typeof Cloud.ringkasanBaca !== 'function') {
      return Promise.resolve(ambilRingkasan());
    }
    return Promise.resolve(Cloud.ringkasanBaca()).then(function (data) {
      if (data && (data.jumlahAtlet !== undefined || data.jumlahAsisten !== undefined)) {
        try {
          localStorage.setItem(KEY_RINGKASAN, JSON.stringify(data));
        } catch (e) {}
        notify();
      }
      return ambilRingkasan();
    }, function () {
      return ambilRingkasan();
    });
  }

  // Hitung ringkasan dari data pengguna lokal (dipakai dashboard untuk
  // memperbarui angka publik setiap kali pengguna berubah).
  function hitungRingkasanDariPengguna() {
    var users = [];
    try {
      users = Store.all('users');
    } catch (e) {}
    var atlet = 0;
    var asisten = 0;
    users.forEach(function (u) {
      if (!u || u.status === 'nonaktif') return;
      if (u.role === 'atlet') {
        // Hanya atlet berstatus aktif yang dihitung untuk angka publik;
        // atlet cuti/nonaktif/berhenti tidak muncul di landing.
        var rec = Store.findOne('athletes', function (a) {
          return a.user_id === u.id || a.id_atlet === u.id_atlet;
        });
        if (!rec || (rec.status || 'aktif') === 'aktif') atlet++;
      } else if (u.role === 'asisten') asisten++;
    });
    return simpanRingkasan({ jumlahAtlet: atlet, jumlahAsisten: asisten });
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
    sinkronkanKeCloud: sinkronkanKeCloud,
    sinkronkanSemuaLokal: sinkronkanSemuaLokal,
    hapusFotoRef: hapusFotoRef,
    hidupkan: hidupkan,
    simpanDariCloud: simpanDariCloud,
    simpanRingkasan: simpanRingkasan,
    ambilRingkasan: ambilRingkasan,
    muatRingkasan: muatRingkasan,
    hitungRingkasanDariPengguna: hitungRingkasanDariPengguna,
    validasiEmail: validasiEmail,
    validasiUrl: validasiUrl,
    validasiTelepon: validasiTelepon,
    validasiBagian: validasiBagian
  };
})();

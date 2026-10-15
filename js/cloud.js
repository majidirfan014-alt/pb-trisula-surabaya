/* ======================================================================
   Cloud - penyimpanan foto terpusat + sinkronisasi data antar perangkat

   Penyebab bug "foto tidak muncul di perangkat lain":
   foto diubah menjadi data URL base64 (canvas.toDataURL / FileReader)
   lalu disimpan di localStorage browser. localStorage hanya hidup di satu
   perangkat + satu browser, sehingga perangkat lain tidak pernah melihatnya.

   Solusi:
   1. Setiap file diunggah ke Firebase Storage -> dapat URL permanen.
   2. URL tersebut yang disimpan ke data (bukan file/base64).
   3. Koleksi yang memuat foto (users, athletes, landing) disinkronkan ke
      Cloud Firestore, sehingga perangkat lain membaca data yang sama.

   Bila Firebase tidak tersedia / gagal dimuat, aplikasi tetap berjalan
   seperti semula (foto disimpan lokal) supaya tidak memutus fitur.
   ====================================================================== */
var Cloud = (function () {

  var KONFIG = {
    apiKey: 'AIzaSyDzYnBoTWUFaO2CY0M5QmoPk8U6Q5X7JFo',
    authDomain: 'pb-trisula-surabaya.firebaseapp.com',
    projectId: 'pb-trisula-surabaya',
    storageBucket: 'pb-trisula-surabaya.firebasestorage.app',
    messagingSenderId: '188409307425',
    appId: '1:188409307425:web:07981a80fab623f33e9e60',
    measurementId: 'G-DNT8VPXVXV'
  };

  var VERSI_SDK = '10.12.2';
  var MAKS_FOTO = 2 * 1024 * 1024;
  var MAKS_LISENSI = 2 * 1024 * 1024;
  var status = 'idle';      // idle | memuat | siap | gagal
  var janjiSiap = null;
  var sudahSinkron = false;
  var sudahMigrasi = false;
  var galatMuat = '';       // penyebab SDK/init gagal (asli)
  var galatAuth = '';       // penyebab auth anonim gagal (asli)

  // Error dengan pesan jelas + kode/status asli (untuk ditampilkan & di-log).
  function galat(kode, pesan, detail) {
    var e = new Error(pesan);
    e.kode = kode || 'unknown';
    e.detail = detail || '';
    try {
      console.error('[Cloud]', e.kode, pesan, detail || '');
    } catch (e2) {}
    return e;
  }

  function terjemahkanGalatStorage(err, konteks) {
    var kode = String((err && (err.code || err.name)) || '').replace(/^storage\//, '');
    var asli = String((err && err.message) || err || '');
    var pesan;
    if (/unauthorized|not-authorized/i.test(kode) || /unauthorized/i.test(asli)) {
      pesan = 'Tidak punya izin upload ke Firebase Storage (atur Storage Rules agar mengizinkan tulis).';
    } else if (/bucket-not-found|no-default-bucket|invalid-bucket/i.test(kode) || /bucket/i.test(asli) && /not found/i.test(asli)) {
      pesan = 'Bucket Firebase Storage tidak ditemukan — periksa nama bucket di js/cloud.js atau buat bucket-nya.';
    } else if (/object-not-found/i.test(kode)) {
      pesan = 'Objek tidak ditemukan di Firebase Storage.';
    } else if (/retry-limit|network|unavailable|deadline/i.test(kode) || /network/i.test(asli)) {
      pesan = 'Koneksi ke cloud gagal (jaringan/CORS) — coba lagi beberapa saat.';
    } else if (/quota/i.test(kode) || /quota/i.test(asli)) {
      pesan = 'Kuota Firebase Storage terlampaui.';
    } else if (/canceled/i.test(kode)) {
      pesan = 'Unggah dibatalkan.';
    } else if (/invalid-argument|unsupported|cannot-slice/i.test(kode)) {
      pesan = 'File tidak didukung untuk diunggah.';
    } else {
      pesan = 'Gagal unggah ke cloud' + (konteks ? ' (' + konteks + ')' : '') + '.';
    }
    return galat('storage/' + (kode || 'unknown'), pesan + ' [kode: ' + (kode || 'unknown') + ']', asli);
  }

  function sdkTersedia() {
    return typeof window.firebase !== 'undefined' &&
      window.firebase.storage && window.firebase.firestore;
  }

  function validasiKONFIG() {
    var kurang = [];
    ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'appId'].forEach(function (k) {
      if (!KONFIG[k] || !String(KONFIG[k]).trim()) kurang.push(k);
    });
    return kurang;
  }

  function muatSdk() {
    if (sdkTersedia()) {
      status = 'siap';
      return Promise.resolve(true);
    }
    if (janjiSiap) return janjiSiap;
    status = 'memuat';
    janjiSiap = new Promise(function (resolve) {
      var selesai = false;
      function akhir(ok) {
        if (selesai) return;
        selesai = true;
        resolve(ok);
      }
      // batas waktu: bila CDN Firebase tidak terjangkau, kembali ke mode lokal
      setTimeout(function () {
        if (status === 'memuat') {
          status = 'gagal';
          galatMuat = galatMuat || 'Batas waktu memuat SDK Firebase (CDN tidak terjangkau).';
        }
        akhir(status === 'siap');
      }, 15000);
      var kurang = validasiKONFIG();
      if (kurang.length) {
        status = 'gagal';
        galatMuat = 'Konfigurasi Firebase belum lengkap: ' + kurang.join(', ') + ' (lihat js/cloud.js).';
        akhir(false);
        return;
      }
      var berkas = ['firebase-app-compat', 'firebase-auth-compat', 'firebase-storage-compat', 'firebase-firestore-compat'];
      var indeks = 0;
      function berikutnya() {
        if (indeks >= berkas.length) {
          try {
            if (!window.firebase.apps || !window.firebase.apps.length) {
              window.firebase.initializeApp(KONFIG);
            }
            status = 'siap';
            akhir(true);
          } catch (e) {
            status = 'gagal';
            galatMuat = 'initializeApp gagal: ' + ((e && e.message) || e);
            akhir(false);
          }
          return;
        }
        var nama = berkas[indeks++];
        var skrip = document.createElement('script');
        skrip.src = 'https://www.gstatic.com/firebasejs/' + VERSI_SDK + '/' + nama + '.js';
        skrip.onload = berikutnya;
        skrip.onerror = function () {
          status = 'gagal';
          galatMuat = 'Gagal memuat ' + nama + '.js dari CDN gstatic (diblokir jaringan/CORS?).';
          akhir(false);
        };
        document.head.appendChild(skrip);
      }
      berikutnya();
    });
    return janjiSiap;
  }

  // Auth anonim membantu bila Storage Rules meminta request.auth != null.
  // Gagalnya auth TIDAK menggagalkan unggah — hasilnya dicatat untuk laporan.
  function siapkanAuth() {
    try {
      if (typeof window.firebase === 'undefined' || !window.firebase || !window.firebase.auth) {
        return Promise.resolve(false);
      }
      if (window.firebase.auth().currentUser) return Promise.resolve(true);
      return Promise.resolve(window.firebase.auth().signInAnonymously()).then(function () {
        return true;
      }, function (e) {
        galatAuth = String((e && (e.code || e.message)) || e);
        return false;
      });
    } catch (e) {
      galatAuth = String((e && e.message) || e);
      return Promise.resolve(false);
    }
  }

  // Laporan koneksi cloud untuk keperluan diagnosis (ditampilkan/di-log).
  function diagnosa() {
    return {
      status: status,
      sdkTersedia: sdkTersedia(),
      konfigKurang: validasiKONFIG(),
      proyek: KONFIG.projectId || '',
      bucket: KONFIG.storageBucket || '',
      galatMuat: galatMuat,
      galatAuth: galatAuth
    };
  }

  function init() {
    return muatSdk().then(function (ok) {
      if (ok && !sudahSinkron) {
        sudahSinkron = true;
        mulaiSinkron();
      }
      return ok;
    });
  }

  /* ---------- validasi berkas ---------- */
  function validasiGambar(file, maks) {
    if (!file) return 'Pilih file terlebih dahulu.';
    var tipe = String(file.type || '');
    var nama = String(file.name || '');
    if (!/^image\//.test(tipe) && !/\.(jpe?g|png|webp)$/i.test(nama)) {
      return 'File harus berupa gambar JPG, PNG, atau WEBP.';
    }
    if (file.size > (maks || MAKS_FOTO)) {
      return 'Ukuran file maksimal ' + Math.round((maks || MAKS_FOTO) / 1024 / 1024) + ' MB.';
    }
    return '';
  }

  function validasiBerkas(file, maks) {
    if (!file) return 'Pilih file terlebih dahulu.';
    var tipe = String(file.type || '');
    var nama = String(file.name || '');
    if (!/^image\//.test(tipe) && !/pdf/i.test(tipe) && !/\.(pdf|jpe?g|png|webp)$/i.test(nama)) {
      return 'Format file harus PDF, JPG, PNG, atau WEBP.';
    }
    if (file.size > (maks || MAKS_LISENSI)) {
      return 'Ukuran file maksimal ' + Math.round((maks || MAKS_LISENSI) / 1024 / 1024) + ' MB.';
    }
    return '';
  }

  /* ---------- unggah foto / berkas ke Firebase Storage ---------- */
  function unggah(file, folder, validasi) {
    var pesan = validasi ? validasi(file) : '';
    if (pesan) return Promise.reject(galat('validasi', pesan, file && file.name));
    return muatSdk().then(function (ok) {
      if (!ok) {
        throw galat('sdk', 'Layanan cloud tidak tersedia: ' + (galatMuat || 'SDK Firebase gagal dimuat.'), JSON.stringify(diagnosa()));
      }
      return siapkanAuth().then(function () {
        var aman = String(file.name || 'berkas').replace(/[^\w.\-]+/g, '-').slice(-60);
        var namaFile = Date.now().toString(36) + '-' + aman;
        var ref;
        try {
          ref = window.firebase.storage().ref(folder + '/' + namaFile);
        } catch (e) {
          throw galat('storage/no-default-bucket',
            'Bucket Firebase Storage tidak ditemukan — periksa nama bucket di js/cloud.js atau buat bucket-nya. [kode: no-default-bucket]',
            String(e && e.message));
        }
        return ref.put(file, { contentType: file.type || undefined }).then(function (snap) {
          return snap.ref.getDownloadURL();
        }).then(function (url) {
          return {
            url: url,
            nama: file.name || namaFile,
            tipe: file.type || '',
            ukuran: file.size || 0
          };
        }).catch(function (e) {
          throw terjemahkanGalatStorage(e, folder);
        });
      });
    });
  }

  // Unggah foto ke Storage dan kembalikan URL publiknya (bisa dibuka tanpa
  // login). Melempar Error dengan pesan jelas + kode asli bila gagal —
  // TIDAK menyimpan lokal diam-diam.
  function unggahPublik(sumber, folder, nama) {
    var janjiBerkas;
    if (typeof sumber === 'string' && sumber.indexOf('data:') === 0) {
      janjiBerkas = Promise.resolve().then(function () {
        return dataUrlKeBerkas(sumber, nama);
      });
    } else {
      janjiBerkas = Promise.resolve(sumber);
    }
    return janjiBerkas.then(function (berkas) {
      return unggah(berkas, folder, null).then(function (hasil) {
        return hasil.url;
      });
    });
  }

  function dataUrlKeBerkas(dataUrl, nama) {
    var blob = dataUrlKeBlob(dataUrl);
    try {
      return new File([blob], nama || 'foto.jpg', { type: blob.type || 'image/jpeg' });
    } catch (e) {
      return blob;
    }
  }

  /* ---------- penyimpanan foto lewat Firestore (gratis, tanpa billing) ----------
     Cloud Storage untuk Firebase butuh plan Blaze, sedangkan Firestore jalan di
     plan Spark. Foto disimpan sebagai dokumen di koleksi "foto_landing" dan
     dibaca publik (lihat firestore.rules) — tampil di semua perangkat. */

  var KOLEKSI_FOTO = 'foto_landing';
  var MAKS_DATA_URL = 900 * 1024;   // batas aman di bawah 1 MB dokumen Firestore

  function dbFoto() {
    return muatSdk().then(function (ok) {
      if (!ok || typeof window.firebase === 'undefined' || !window.firebase || !window.firebase.firestore) {
        throw galat('sdk', 'Layanan cloud tidak tersedia: ' + (galatMuat || 'SDK Firebase tidak termuat.'));
      }
      return window.firebase.firestore().collection(KOLEKSI_FOTO);
    });
  }

  function terjemahkanGalatFirestore(err) {
    var kode = String((err && (err.code || err.name)) || '');
    var asli = String((err && err.message) || err || '');
    var pesan;
    if (/resource-exhausted|quota/i.test(kode) || /quota/i.test(asli)) {
      pesan = 'Kuota Firestore gratis terlampaui — coba lagi nanti atau hapus foto lama.';
    } else if (/permission-denied/i.test(kode)) {
      pesan = 'Tidak punya izin menulis ke Firestore (periksa firestore.rules).';
    } else if (/invalid-argument|too large|1 mib|maximum/i.test(kode + ' ' + asli)) {
      pesan = 'Ukuran foto terlalu besar untuk dokumen Firestore (> 1 MB).';
    } else if (/unavailable|deadline|network/i.test(kode + ' ' + asli)) {
      pesan = 'Koneksi ke Firestore gagal (jaringan).';
    } else {
      pesan = 'Gagal menyimpan foto ke cloud.';
    }
    return galat('firestore/' + (kode || 'unknown'), pesan + ' [kode: ' + (kode || 'unknown') + ']', asli);
  }

  // Simpan data URL foto -> ID dokumen Firestore.
  function fotoDbSimpan(dataUrl) {
    if (!dataUrl || String(dataUrl).indexOf('data:') !== 0 || String(dataUrl).length > MAKS_DATA_URL) {
      return Promise.reject(galat('firestore/ukuran',
        'Ukuran foto terlalu besar untuk dokumen Firestore (> 1 MB).',
        String(dataUrl || '').length + ' karakter'));
    }
    return dbFoto().then(function (col) {
      return col.add({
        data: String(dataUrl),
        dibuat_pada: new Date().toISOString()
      });
    }).then(function (ref) {
      return ref.id;
    }).catch(function (e) {
      throw terjemahkanGalatFirestore(e);
    });
  }

  // Muat semua foto publik dari Firestore -> [{ id, data }].
  function fotoDbSemua() {
    return dbFoto().then(function (col) {
      return col.get();
    }).then(function (snap) {
      var out = [];
      snap.forEach(function (d) {
        var data = d.data() || {};
        if (data.data) out.push({ id: d.id, data: data.data });
      });
      return out;
    }).catch(function () {
      return [];
    });
  }

  function fotoDbHapus(id) {
    if (!id) return Promise.resolve(false);
    return dbFoto().then(function (col) {
      return col.doc(String(id)).delete();
    }).then(function () {
      return true;
    }).catch(function () {
      return false;
    });
  }

  function unggahFoto(file, folder) {
    return unggah(file, folder || 'foto', function (f) {
      return validasiGambar(f, MAKS_FOTO);
    });
  }

  function unggahBerkas(file, folder) {
    return unggah(file, folder || 'berkas', function (f) {
      return validasiBerkas(f, MAKS_LISENSI);
    });
  }

  // Unggah data URL ke cloud. Bila gagal, MELEMPAR error dengan pesan jelas
  // (pemanggil yang menentukan fallback — tidak lagi diam-diam memakai lokal).
  function unggahAtauLokal(dataUrl, folder, nama) {
    return unggahPublik(dataUrl, folder, nama || 'foto.jpg');
  }

  function hapusFile(url) {
    if (!url || typeof url !== 'string' || url.indexOf('firebasestorage') === -1) {
      return Promise.resolve(false);
    }
    return muatSdk().then(function (ok) {
      if (!ok) return false;
      try {
        return window.firebase.storage().refFromURL(url).delete().then(function () {
          return true;
        }, function () {
          return false;
        });
      } catch (e) {
        return Promise.resolve(false);
      }
    });
  }

  /* ---------- Firestore: muat / tulis koleksi ---------- */
  function bersih(obj) {
    if (obj === null || obj === undefined) return null;
    if (Array.isArray(obj)) return obj.map(bersih);
    if (typeof obj !== 'object') return obj;
    var out = {};
    Object.keys(obj).forEach(function (k) {
      var v = obj[k];
      if (v === undefined) return;
      if (typeof v === 'string' && v.length > 400000) return; // hindari dokumen > 1 MB
      out[k] = bersih(v);
    });
    return out;
  }

  function koleksiMuat(nama) {
    return muatSdk().then(function (ok) {
      if (!ok) return [];
      return window.firebase.firestore().collection(nama).get().then(function (snap) {
        var out = [];
        snap.forEach(function (d) {
          var data = d.data() || {};
          if (!data.id) data.id = d.id;
          out.push(data);
        });
        return out;
      }, function () {
        return [];
      });
    });
  }

  function koleksiTulis(nama, items) {
    if (!items) return Promise.resolve(false);
    return muatSdk().then(function (ok) {
      if (!ok) return false;
      var db = window.firebase.firestore();
      var daftar = Array.isArray(items) ? items : [items];
      var ref = db.collection(nama);
      // dokumen yang sudah ada di cloud tapi tidak ada lagi secara lokal ikut
      // dihapus agar penghapusan juga tersinkron antar perangkat
      return ref.get().then(function (snap) {
        var batch = db.batch();
        var lokal = {};
        daftar.forEach(function (it) {
          if (it) lokal[String(it.id || 'config')] = true;
        });
        snap.forEach(function (d) {
          if (!lokal[d.id]) batch.delete(ref.doc(d.id));
        });
        daftar.forEach(function (it) {
          if (!it) return;
          batch.set(ref.doc(String(it.id || 'config')), bersih(it));
        });
        return batch.commit();
      }).then(function () {
        return true;
      }, function () {
        return false;
      });
    });
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments;
      var ctx = this;
      clearTimeout(t);
      t = setTimeout(function () {
        fn.apply(ctx, args);
      }, ms);
    };
  }

  /* ---------- sinkronisasi koleksi yang memuat foto ---------- */
  var KOLEKSI_SINKRON = ['users', 'athletes', 'matches', 'logbook_entries'];

  function muatDariCloud() {
    KOLEKSI_SINKRON.forEach(function (nama) {
      koleksiMuat(nama).then(function (rows) {
        if (!rows || !rows.length) return;
        try {
          localStorage.setItem(CONFIG.PREFIX + nama, JSON.stringify(rows));
        } catch (e) {}
        // Data cloud bisa saja masih memuat akun admin lama atau sisa data
        // contoh; jalankan lagi migrasi & pembersihan agar hasilnya tersimpan
        // lokal dan tersinkron kembali ke cloud.
        if (nama === 'users' && typeof Auth !== 'undefined' && Auth) {
          try {
            var janji = Promise.resolve();
            if (typeof Auth.migrasiAkunAdmin === 'function') janji = janji.then(function () { return Auth.migrasiAkunAdmin(); });
            if (typeof Auth.hapusDataContoh === 'function') janji = janji.then(function () { return Auth.hapusDataContoh(); });
            janji.then(function () {
              if (typeof App !== 'undefined' && App && typeof App.render === 'function') App.render();
            }, function () {});
          } catch (e) {}
        }
        if (typeof App !== 'undefined' && App && typeof App.render === 'function') App.render();
      });
    });
    koleksiMuat('landing').then(function (rows) {
      if (!rows || !rows.length) return;
      try {
        // Dokumen cloud berbentuk { id: 'config', isi: {...} }; yang dipakai
        // aplikasi adalah objek di dalamnya. Jangan simpan bungkusnya —
        // dulu kesalahan ini membuat foto & pengaturan landing hilang.
        var isi = rows[0] && rows[0].isi ? rows[0].isi : rows[0];
        if (typeof LandingStore !== 'undefined' && LandingStore && LandingStore.simpanDariCloud) {
          LandingStore.simpanDariCloud(isi);
        } else {
          localStorage.setItem(CONFIG.PREFIX + 'landing', JSON.stringify(isi));
        }
      } catch (e) {}
      if (typeof PagesPublic !== 'undefined' && PagesPublic && typeof PagesPublic.init === 'function') {
        try { PagesPublic.init(); } catch (e) {}
      }
    });
  }

  function mulaiSinkron() {
    muatDariCloud();
    KOLEKSI_SINKRON.forEach(function (nama) {
      Store.subscribe(nama, debounce(function () {
        koleksiTulis(nama, Store.all(nama));
      }, 900));
    });
    if (typeof LandingStore !== 'undefined' && LandingStore && LandingStore.subscribe) {
      LandingStore.subscribe(debounce(function () {
        koleksiTulis('landing', [{ id: 'config', isi: LandingStore.get() }]);
      }, 900));
    }
  }

  /* ---------- migrasi foto lama (data URL) ke cloud ---------- */
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

  // Mengunggah data URL (hasil kompresi lokal) ke cloud.
  // Mengembalikan URL permanen, atau null bila gagal (pemanggil memakai
  // data URL sebagai cadangan agar fitur tetap berjalan).
  function unggahDataUrl(dataUrl, folder, nama) {
    if (!dataUrl || typeof dataUrl !== 'string' || dataUrl.indexOf('data:') !== 0) {
      return Promise.resolve(null);
    }
    try {
      var blob = dataUrlKeBlob(dataUrl);
      var file = new File([blob], nama || 'foto.jpg', { type: blob.type || 'image/jpeg' });
      return unggah(file, folder, null).then(function (hasil) {
        return hasil.url;
      }, function () {
        return null;
      });
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  // Mengubah foto lama yang masih berupa data URL menjadi URL cloud.
  // Aman diulang (yang sudah URL tidak disentuh) dan hanya berjalan sekali
  // per sesi agar tidak memboroskan kuota upload.
  function migrasiFotoLama(paksa) {
    if (sudahMigrasi && !paksa) return Promise.resolve({ total: 0, pesan: 'Sudah dimigrasi.' });
    sudahMigrasi = true;
    return muatSdk().then(function (ok) {
      if (!ok) return { total: 0, pesan: 'Layanan cloud tidak tersedia.' };
      var total = 0;
      var janji = Promise.resolve();

      function proses(value, simpan, folder) {
        if (!value || typeof value !== 'string' || value.indexOf('data:') !== 0) return;
        janji = janji.then(function () {
          return unggahDataUrl(value, folder, 'foto-lama.jpg').then(function (url) {
            if (url) {
              simpan(url);
              total++;
            }
          }, function () {});
        });
      }

      Store.all('users').forEach(function (u) {
        proses(u.foto, function (url) {
          Store.update('users', u.id, { foto: url });
        }, 'foto/profil');
      });
      Store.all('athletes').forEach(function (a) {
        proses(a.foto, function (url) {
          Store.update('athletes', a.id, { foto: url });
        }, 'foto/atlet');
      });

      var landing = LandingStore.get();
      var perluSimpan = false;
      (landing.galeri || []).forEach(function (g, i) {
        proses(g.src || g.file, function (url) {
          var list = LandingStore.get();
          if (list.galeri && list.galeri[i]) {
            list.galeri[i].src = url;
            LandingStore.saveBagian('galeri', list.galeri);
            perluSimpan = true;
          }
        }, 'foto/galeri');
      });

      return janji.then(function () {
        return { total: total, pesan: total ? total + ' foto berhasil dipindahkan ke cloud.' : 'Tidak ada foto lama yang perlu dimigrasi.' };
      });
    });
  }

  return {
    KONFIG: KONFIG,
    init: init,
    siap: function () { return status === 'siap'; },
    status: function () { return status; },
    diagnosa: diagnosa,
    unggahPublik: unggahPublik,
    fotoDbSimpan: fotoDbSimpan,
    fotoDbSemua: fotoDbSemua,
    fotoDbHapus: fotoDbHapus,
    validasiGambar: validasiGambar,
    validasiBerkas: validasiBerkas,
    unggahFoto: unggahFoto,
    unggahBerkas: unggahBerkas,
    unggahDataUrl: unggahDataUrl,
    unggahAtauLokal: unggahAtauLokal,
    hapusFile: hapusFile,
    koleksiMuat: koleksiMuat,
    koleksiTulis: koleksiTulis,
    mulaiSinkron: mulaiSinkron,
    migrasiFotoLama: migrasiFotoLama
  };
})();

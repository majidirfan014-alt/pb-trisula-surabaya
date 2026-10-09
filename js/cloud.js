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

  function sdkTersedia() {
    return typeof window.firebase !== 'undefined' &&
      window.firebase.storage && window.firebase.firestore;
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
        status = 'gagal';
        akhir(false);
      }, 15000);
      var berkas = ['firebase-app-compat', 'firebase-storage-compat', 'firebase-firestore-compat'];
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
          akhir(false);
        };
        document.head.appendChild(skrip);
      }
      berikutnya();
    });
    return janjiSiap;
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
    if (pesan) return Promise.reject(new Error(pesan));
    return muatSdk().then(function (ok) {
      if (!ok) throw new Error('Layanan cloud tidak tersedia. Foto disimpan secara lokal.');
      var aman = String(file.name || 'berkas').replace(/[^\w.\-]+/g, '-').slice(-60);
      var namaFile = Date.now().toString(36) + '-' + aman;
      var ref = window.firebase.storage().ref(folder + '/' + namaFile);
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
        throw new Error('Gagal mengunggah ke cloud: ' + (e && e.message ? e.message : 'kesalahan jaringan'));
      });
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

  // Unggah data URL ke cloud; bila gagal / cloud tidak tersedia,
  // kembalikan data URL lokal agar fitur tetap berjalan.
  function unggahAtauLokal(dataUrl, folder, nama) {
    return unggahDataUrl(dataUrl, folder, nama).then(function (url) {
      return url || dataUrl;
    });
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
      var batch = db.batch();
      var daftar = Array.isArray(items) ? items : [items];
      daftar.forEach(function (it) {
        if (!it) return;
        var id = it.id || 'config';
        batch.set(db.collection(nama).doc(String(id)), bersih(it));
      });
      return batch.commit().then(function () {
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
  var KOLEKSI_SINKRON = ['users', 'athletes'];

  function muatDariCloud() {
    KOLEKSI_SINKRON.forEach(function (nama) {
      koleksiMuat(nama).then(function (rows) {
        if (!rows || !rows.length) return;
        try {
          localStorage.setItem(CONFIG.PREFIX + nama, JSON.stringify(rows));
        } catch (e) {}
        if (typeof App !== 'undefined' && App && typeof App.render === 'function') App.render();
      });
    });
    koleksiMuat('landing').then(function (rows) {
      if (!rows || !rows.length) return;
      try {
        localStorage.setItem(CONFIG.PREFIX + 'landing', JSON.stringify(rows[0]));
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

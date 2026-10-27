/* FileStore — penyimpanan berkas sementara sebagai Blob di IndexedDB.
   Dipakai pendaftaran (lisensi, foto, dokumen) dan modul Keuangan (bukti
   transfer) agar tidak membanjiri localStorage dengan base64. Record data
   hanya menyimpan referensi fid, bukan isi berkasnya.

   Satu koneksi DB dipakai selama halaman hidup (tidak ditutup tiap operasi
   agar koneksi yang sama bisa dipakai berulang). */
var FileStore = (function () {
  var DB_NAME = 'pbts_files';
  var DB_VER = 1;
  var STORE = 'files';
  var janjiDb = null;
  var rusak = false;

  function idBaru() {
    return 'f_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function buka() {
    if (janjiDb) return janjiDb;
    janjiDb = new Promise(function (resolve, reject) {
      if (rusak || typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB tidak tersedia di peramban ini.'));
        return;
      }
      var req;
      try {
        req = indexedDB.open(DB_NAME, DB_VER);
      } catch (e) {
        reject(new Error('Gagal membuka penyimpanan berkas.'));
        return;
      }
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          var os = db.createObjectStore(STORE, { keyPath: 'fid' });
          os.createIndex('dibuat_pada', 'dibuat_pada');
        }
      };
      req.onsuccess = function () {
        var db = req.result;
        db.onversionchange = function () {
          try { db.close(); } catch (e) {}
          janjiDb = null;
        };
        resolve(db);
      };
      req.onerror = function () {
        janjiDb = null;
        rusak = true;
        reject(new Error('Penyimpanan berkas lokal tidak dapat diakses.'));
      };
      req.onblocked = function () {
        janjiDb = null;
        reject(new Error('Penyimpanan berkas terblokir tab lain.'));
      };
    });
    return janjiDb;
  }

  function sebab(req) {
    var e = req && req.error;
    return e ? (e.name + ': ' + e.message) : 'tidak diketahui';
  }

  function simpan(blob, meta) {
    meta = meta || {};
    var fid = idBaru();
    return buka().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx;
        try {
          tx = db.transaction(STORE, 'readwrite');
        } catch (e) {
          janjiDb = null;
          reject(new Error('Gagal menulis berkas ke penyimpanan lokal. (' + e.message + ')'));
          return;
        }
        var data = {
          fid: fid,
          blob: blob,
          nama: meta.nama || (blob && blob.name) || 'berkas',
          tipe: meta.tipe || (blob && blob.type) || '',
          ukuran: meta.ukuran || (blob && blob.size) || 0,
          dibuat_pada: meta.dibuat_pada || new Date().toISOString()
        };
        var req = tx.objectStore(STORE).put(data);
        req.onsuccess = function () {
          resolve({ fid: fid, nama: data.nama, tipe: data.tipe, ukuran: data.ukuran });
        };
        req.onerror = function () {
          reject(new Error('Gagal menyimpan berkas (' + sebab(req) + ').'));
        };
        tx.onerror = function () {
          reject(new Error('Gagal menyimpan berkas ke penyimpanan lokal.'));
        };
      });
    });
  }

  function ambil(fid) {
    if (!fid) return Promise.resolve(null);
    return buka().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx;
        try {
          tx = db.transaction(STORE, 'readonly');
        } catch (e) {
          reject(new Error('Gagal membaca berkas. (' + e.message + ')'));
          return;
        }
        var req = tx.objectStore(STORE).get(fid);
        req.onsuccess = function () {
          resolve(req.result ? req.result.blob : null);
        };
        req.onerror = function () {
          reject(new Error('Gagal membaca berkas dari penyimpanan.'));
        };
      });
    });
  }

  function meta(fid) {
    if (!fid) return Promise.resolve(null);
    return buka().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction(STORE, 'readonly');
        var req = tx.objectStore(STORE).get(fid);
        req.onsuccess = function () {
          var row = req.result || null;
          resolve(row ? { fid: row.fid, nama: row.nama, tipe: row.tipe, ukuran: row.ukuran, dibuat_pada: row.dibuat_pada } : null);
        };
        req.onerror = function () { resolve(null); };
      });
    });
  }

  // URL objek sementara — wajib direvoke oleh pemanggil setelah dipakai.
  function url(fid) {
    return ambil(fid).then(function (blob) {
      if (!blob) return '';
      try {
        return URL.createObjectURL(blob);
      } catch (e) {
        return '';
      }
    });
  }

  function hapus(fid) {
    if (!fid) return Promise.resolve();
    return buka().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(fid);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { resolve(); };
        tx.onabort = function () { resolve(); };
      });
    }).catch(function () {});
  }

  // Jadikan referensi lama (dataURL/base64) tetap bisa dilihat: jika berkas
  // sudah berupa data URL langsung kembalikan apa adanya.
  function resolveData(ref) {
    if (!ref) return Promise.resolve('');
    if (typeof ref === 'string') return Promise.resolve(ref);
    if (ref.data) return Promise.resolve(ref.data);
    if (ref.fid) {
      return url(ref.fid).then(function (u) {
        if (u) return u;
        return ref.data || '';
      });
    }
    return Promise.resolve(ref.data || '');
  }

  return {
    simpan: simpan,
    ambil: ambil,
    meta: meta,
    url: url,
    hapus: hapus,
    resolveData: resolveData
  };
})();

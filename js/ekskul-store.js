/* ==========================================================================
   EKSTRAKURIKULER — konfigurasi, penyimpanan lokal, dan autentikasi.
   Namespace penyimpanan: ekskul_* (terpisah penuh dari pbts_* milik PB Trisula).
   ========================================================================== */

var EkskulConfig = {
  APP_NAME: 'EKSTRAKURIKULER',
  SUB_NAME: 'Bulutangkis Sekolah',
  PREFIX: 'ekskul_',
  SESSION_HOURS: 168,
  SESSION_KEY: 'ekskul_session',
  // Username yang tidak boleh dipakai sekolah/guru (milik sistem).
  RESERVED_USERNAMES: ['superadmin', 'admin'],
  STATUS_SEKOLAH: ['menunggu', 'aktif', 'ditolak'],
  STATUS_UMUM: ['aktif', 'nonaktif'],
  STATUS_KEHADIRAN: ['Hadir', 'Izin', 'Sakit', 'Tidak Hadir'],
  GENDER: ['Laki-laki', 'Perempuan'],
  HASIL: ['Menang', 'Kalah'],
  KATEGORI_DEFAULT: ['Tunggal Putra', 'Tunggal Putri', 'Ganda Putra', 'Ganda Putri', 'Ganda Campuran'],
  KATEGORI_PARAM: {
    teknik: 'Teknik',
    fisik: 'Fisik',
    kedisiplinan: 'Kedisiplinan'
  },
  // Parameter bawaan. Disimpan dengan ID tetap sehingga perubahan nama
  // tidak memutus data penilaian lama.
  PARAM_DEFAULT: [
    { id: 'prm_tek_lob', nama: 'Lob', kategori: 'teknik', aktif: true },
    { id: 'prm_tek_netting', nama: 'Netting', kategori: 'teknik', aktif: true },
    { id: 'prm_tek_dropshot', nama: 'Dropshot', kategori: 'teknik', aktif: true },
    { id: 'prm_tek_smash', nama: 'Smash', kategori: 'teknik', aktif: true },
    { id: 'prm_tek_backhand', nama: 'Backhand', kategori: 'teknik', aktif: true },
    { id: 'prm_tek_forehand', nama: 'Forehand', kategori: 'teknik', aktif: true },
    { id: 'prm_fis_kelincahan', nama: 'Kelincahan', kategori: 'fisik', aktif: true },
    { id: 'prm_fis_kecepatan', nama: 'Kecepatan', kategori: 'fisik', aktif: true },
    { id: 'prm_fis_kekuatan', nama: 'Kekuatan', kategori: 'fisik', aktif: true },
    { id: 'prm_fis_dayatahan', nama: 'Daya Tahan', kategori: 'fisik', aktif: true }
  ],
  // ID sintetis nilai kedisiplinan (bukan parameter teknik/fisik).
  KEDISIPLINAN_ID: '__kedisiplinan',
  USIA_MIN: 5,
  USIA_MAX: 25
};

/* --------------------------------------------------------------------------
   Hash kata sandi: SHA-256 (Web Crypto) dengan salt, format sama dengan
   PB Trisula (salt + '::' + kata sandi). Kata sandi tidak pernah disimpan
   atau ditampilkan dalam bentuk polos.
   -------------------------------------------------------------------------- */
var EkskulHash = (function () {
  function makeSalt() {
    var bytes = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(bytes);
    } else {
      for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    var out = '';
    for (var j = 0; j < bytes.length; j++) out += ('0' + bytes[j].toString(16)).slice(-2);
    return out;
  }

  function fallbackHash(text) {
    var h1 = 0x811c9dc5;
    var h2 = 0x01000193;
    for (var round = 0; round < 64; round++) {
      for (var i = 0; i < text.length; i++) {
        var c = text.charCodeAt(i) + round;
        h1 ^= c;
        h1 = (h1 * 0x01000193) >>> 0;
        h2 = (h2 + h1 + i) >>> 0;
        h2 = ((h2 << 13) | (h2 >>> 19)) >>> 0;
      }
    }
    return ('00000000' + h1.toString(16)).slice(-8) + ('00000000' + h2.toString(16)).slice(-8) +
      ('00000000' + ((h1 ^ h2) >>> 0).toString(16)).slice(-8) + ('00000000' + ((h1 + h2) >>> 0).toString(16)).slice(-8);
  }

  function hash(password, salt) {
    var payload = salt + '::' + password;
    if (window.crypto && window.crypto.subtle && window.crypto.subtle.digest && window.TextEncoder) {
      return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload)).then(function (buf) {
        var view = new Uint8Array(buf);
        var hex = '';
        for (var i = 0; i < view.length; i++) hex += ('0' + view[i].toString(16)).slice(-2);
        return hex;
      }).catch(function () {
        return fallbackHash(payload);
      });
    }
    return Promise.resolve(fallbackHash(payload));
  }

  return { makeSalt: makeSalt, hash: hash };
})();

/* --------------------------------------------------------------------------
   Penyimpanan lokal modul ekskul (namespace ekskul_*).
   -------------------------------------------------------------------------- */
var EkskulStore = (function () {
  var PREFIX = EkskulConfig.PREFIX;
  var listeners = {};

  function key(collection) {
    return PREFIX + collection;
  }

  function read(collection) {
    try {
      var raw = localStorage.getItem(key(collection));
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function notify(collection) {
    var subs = listeners[collection] || [];
    for (var i = 0; i < subs.length; i++) {
      try {
        subs[i](collection);
      } catch (e) {
        console.error(e);
      }
    }
  }

  // Perubahan dari tab lain langsung menghidupkan ulang tampilan.
  window.addEventListener('storage', function (event) {
    if (!event.key || event.key.indexOf(PREFIX) !== 0) return;
    var collection = event.key.slice(PREFIX.length);
    notify(collection);
    notify('*');
  });

  // Penulisan data hanya untuk Superadmin (dan proses publik saat belum ada
  // sesi ekskul). Sekolah / Guru Sekolah ditolak di tingkat logika.
  function canWrite() {
    if (typeof EkskulAuth === 'undefined' || !EkskulAuth) return true;
    return EkskulAuth.canWrite();
  }

  function assertWrite() {
    if (!canWrite()) {
      throw new Error('Anda tidak memiliki izin untuk mengubah data.');
    }
  }

  function write(collection, items) {
    assertWrite();
    try {
      localStorage.setItem(key(collection), JSON.stringify(items));
    } catch (e) {
      if (typeof Utils !== 'undefined' && Utils.toast) {
        Utils.toast('Penyimpanan browser penuh. Hapus sebagian data atau perkecil ukuran file.', 'danger');
      }
      throw e;
    }
    notify(collection);
  }

  function all(collection) {
    return read(collection);
  }

  function where(collection, predicate) {
    return read(collection).filter(predicate);
  }

  function find(collection, id) {
    var items = read(collection);
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) return items[i];
    }
    return null;
  }

  function findOne(collection, predicate) {
    var items = read(collection);
    for (var i = 0; i < items.length; i++) {
      if (predicate(items[i])) return items[i];
    }
    return null;
  }

  function insert(collection, item) {
    assertWrite();
    var items = read(collection);
    if (!item.id) item.id = (typeof Utils !== 'undefined' ? Utils.uid(PREFIX + collection) : PREFIX + collection + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7));
    if (!item.dibuat_pada) item.dibuat_pada = new Date().toISOString();
    items.push(item);
    write(collection, items);
    return item;
  }

  function update(collection, id, patch) {
    assertWrite();
    var items = read(collection);
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) {
        for (var k in patch) {
          if (Object.prototype.hasOwnProperty.call(patch, k)) items[i][k] = patch[k];
        }
        items[i].diperbarui_pada = new Date().toISOString();
        write(collection, items);
        return items[i];
      }
    }
    return null;
  }

  function remove(collection, id) {
    assertWrite();
    var items = read(collection);
    var next = items.filter(function (it) {
      return it.id !== id;
    });
    write(collection, next);
    return next.length !== items.length;
  }

  function removeWhere(collection, predicate) {
    assertWrite();
    var items = read(collection);
    var next = items.filter(function (it) {
      return !predicate(it);
    });
    write(collection, next);
    return items.length - next.length;
  }

  function subscribe(collection, handler) {
    if (!listeners[collection]) listeners[collection] = [];
    listeners[collection].push(handler);
    return function () {
      listeners[collection] = (listeners[collection] || []).filter(function (h) {
        return h !== handler;
      });
    };
  }

  function nextSeq(name) {
    var raw = localStorage.getItem(key('seq'));
    var seq = {};
    try {
      seq = raw ? JSON.parse(raw) : {};
    } catch (e) {
      seq = {};
    }
    seq[name] = (seq[name] || 0) + 1;
    localStorage.setItem(key('seq'), JSON.stringify(seq));
    return seq[name];
  }

  function nextSiswaId() {
    var n = nextSeq('siswa');
    return 'EKS-' + String(n).padStart(3, '0');
  }

  // Catatan: init TIDAK memakai assertWrite agar parameter & kategori bawaan
  // bisa dibuat saat pertama kali (sebelum ada sesi siapa pun).
  function rawWrite(collection, items) {
    try {
      localStorage.setItem(key(collection), JSON.stringify(items));
    } catch (e) {
      return false;
    }
    notify(collection);
    return true;
  }

  function init() {
    var params = read('parameters');
    if (!params.length) {
      rawWrite('parameters', EkskulConfig.PARAM_DEFAULT.map(function (p) {
        return { id: p.id, nama: p.nama, kategori: p.kategori, aktif: true, dibuat_pada: new Date().toISOString() };
      }));
    }
    var kats = read('categories');
    if (!kats.length) {
      rawWrite('categories', EkskulConfig.KATEGORI_DEFAULT.map(function (nama, i) {
        return { id: 'kat_' + (i + 1), nama: nama, aktif: true, dibuat_pada: new Date().toISOString() };
      }));
    }
    return Promise.resolve(true);
  }

  return {
    all: all,
    where: where,
    find: find,
    findOne: findOne,
    insert: insert,
    update: update,
    remove: remove,
    removeWhere: removeWhere,
    subscribe: subscribe,
    nextSiswaId: nextSiswaId,
    init: init,
    canWrite: canWrite
  };
})();

/* --------------------------------------------------------------------------
   Autentikasi modul ekskul (sesi terpisah dari PB Trisula).
   Role: superadmin (akun superadmin PB Trisula yang sudah ada), sekolah, guru.
   -------------------------------------------------------------------------- */
var EkskulAuth = (function () {
  var KEY = EkskulConfig.SESSION_KEY;

  function normalizeUsername(value) {
    return String(value || '').trim().toLowerCase();
  }

  function saveSession(session) {
    session.exp = Date.now() + EkskulConfig.SESSION_HOURS * 3600 * 1000;
    localStorage.setItem(KEY, JSON.stringify(session));
    return session;
  }

  function getSession() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var session = JSON.parse(raw);
      if (!session || !session.exp || session.exp < Date.now()) {
        localStorage.removeItem(KEY);
        return null;
      }
      return session;
    } catch (e) {
      return null;
    }
  }

  function current() {
    return getSession();
  }

  function isSuperadmin() {
    var s = getSession();
    return !!s && s.role === 'superadmin';
  }

  function isViewer() {
    var s = getSession();
    return !!s && (s.role === 'sekolah' || s.role === 'guru' || s.role === 'siswa');
  }

  function isSiswa() {
    var s = getSession();
    return !!s && s.role === 'siswa';
  }

  // true bila penulisan data diizinkan: belum ada sesi (proses publik:
  // pendaftaran) atau sesi Superadmin.
  function canWrite() {
    var s = getSession();
    if (!s) return true;
    return s.role === 'superadmin';
  }

  function logout() {
    localStorage.removeItem(KEY);
  }

  function verifyHash(password, salt, expectedHash) {
    return EkskulHash.hash(password, salt).then(function (hash) {
      return hash === expectedHash;
    });
  }

  // Siswa/siswi mengganti kata sandi akunnya sendiri. Menulis langsung ke
  // penyimpanan (bukan lewat EkskulStore.update yang menolak role viewer),
  // namun hanya untuk record milik sesi yang sedang aktif.
  function gantiPasswordSendiri(passwordLama, passwordBaru) {
    var s = getSession();
    if (!s || s.role !== 'siswa') {
      return Promise.reject(new Error('Hanya siswa/siswi yang dapat mengganti kata sandi di sini.'));
    }
    if (String(passwordBaru || '').length < 6) {
      return Promise.reject(new Error('Kata sandi baru minimal 6 karakter.'));
    }
    var key = EkskulConfig.PREFIX + 'students';
    var items = [];
    try {
      items = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(items)) items = [];
    } catch (e) {
      return Promise.reject(new Error('Gagal membaca data siswa.'));
    }
    var me = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === s.siswa_id) { me = items[i]; break; }
    }
    if (!me || !me.password_hash) {
      return Promise.reject(new Error('Akun siswa tidak ditemukan.'));
    }
    return verifyHash(passwordLama, me.password_salt, me.password_hash).then(function (ok) {
      if (!ok) throw new Error('Kata sandi lama salah.');
      var salt = EkskulHash.makeSalt();
      return EkskulHash.hash(passwordBaru, salt).then(function (hash) {
        me.password_hash = hash;
        me.password_salt = salt;
        me.diperbarui_pada = new Date().toISOString();
        localStorage.setItem(key, JSON.stringify(items));
        return true;
      });
    });
  }

  // Verifikasi terhadap akun superadmin PB Trisula yang SUDAH ADA.
  // Tidak membuat kredensial baru dan tidak pernah menampilkan kata sandi.
  function cekSuperadminPbts(username, password) {
    if (typeof Store === 'undefined' || typeof Auth === 'undefined') {
      return Promise.resolve(null);
    }
    return Store.init().then(function () {
      return Auth.migrasiAkunAdmin ? Auth.migrasiAkunAdmin() : null;
    }).then(function () {
      var user = Store.findOne('users', function (u) {
        return normalizeUsername(u.username) === normalizeUsername(username) && u.role === 'pelatih_kepala';
      });
      if (!user || user.status === 'nonaktif') return null;
      return verifyHash(password, user.password_salt, user.password_hash).then(function (ok) {
        if (!ok) return null;
        return {
          role: 'superadmin',
          userId: user.id,
          nama: user.nama,
          username: user.username,
          sekolah_id: null,
          sekolah_nama: ''
        };
      });
    }, function () {
      return null;
    });
  }

  function login(username, password) {
    var uname = normalizeUsername(username);
    if (!uname || !password) {
      return Promise.reject(new Error('Nama pengguna dan kata sandi wajib diisi.'));
    }
    return EkskulStore.init().then(function () {
      var sekolah = EkskulStore.findOne('schools', function (s) {
        return normalizeUsername(s.username) === uname;
      });
      if (sekolah) {
        if (sekolah.status === 'menunggu') {
          throw new Error('Akun menunggu persetujuan. Silakan tunggu Superadmin menyetujui pendaftaran Anda.');
        }
        if (sekolah.status === 'ditolak') {
          throw new Error('Akun Anda ditolak. Hubungi Superadmin untuk informasi lebih lanjut.');
        }
        if (sekolah.status === 'nonaktif') {
          throw new Error('Akun Anda dinonaktifkan. Hubungi Superadmin.');
        }
        return verifyHash(password, sekolah.password_salt, sekolah.password_hash).then(function (ok) {
          if (!ok) throw new Error('Nama pengguna atau kata sandi salah.');
          return saveSession({
            role: 'sekolah',
            userId: sekolah.id,
            nama: sekolah.nama,
            username: sekolah.username,
            sekolah_id: sekolah.id,
            sekolah_nama: sekolah.nama
          });
        });
      }

      var guru = EkskulStore.findOne('teachers', function (t) {
        return normalizeUsername(t.username) === uname;
      });
      if (guru) {
        if (guru.status === 'nonaktif') {
          throw new Error('Akun Anda dinonaktifkan. Hubungi Superadmin.');
        }
        return verifyHash(password, guru.password_salt, guru.password_hash).then(function (ok) {
          if (!ok) throw new Error('Nama pengguna atau kata sandi salah.');
          var sekolahGuru = EkskulStore.find('schools', guru.sekolah_id);
          return saveSession({
            role: 'guru',
            userId: guru.id,
            nama: guru.nama,
            username: guru.username,
            sekolah_id: guru.sekolah_id,
            sekolah_nama: sekolahGuru ? sekolahGuru.nama : ''
          });
        });
      }

      // Siswa/siswi: login lewat nama pengguna ATAU ID siswa (contoh: EKS-001).
      var siswa = EkskulStore.findOne('students', function (st) {
        if (!st.username && !st.password_hash) return false;
        if (st.username && normalizeUsername(st.username) === uname) return true;
        return normalizeUsername(st.id_siswa) === uname;
      });
      if (siswa) {
        if (!siswa.password_hash) {
          throw new Error('Akun siswa ini belum memiliki kata sandi. Hubungi Superadmin untuk membuat akun.');
        }
        if (siswa.status === 'nonaktif') {
          throw new Error('Akun Anda dinonaktifkan. Hubungi Superadmin.');
        }
        return verifyHash(password, siswa.password_salt, siswa.password_hash).then(function (ok) {
          if (!ok) throw new Error('Nama pengguna atau kata sandi salah.');
          var sekolahSiswa = EkskulStore.find('schools', siswa.sekolah_id);
          return saveSession({
            role: 'siswa',
            userId: siswa.id,
            siswa_id: siswa.id,
            nama: siswa.nama,
            username: siswa.username || siswa.id_siswa,
            sekolah_id: siswa.sekolah_id,
            sekolah_nama: sekolahSiswa ? sekolahSiswa.nama : ''
          });
        });
      }

      // Akun superadmin memakai kredensial PB Trisula yang sudah ada.
      return cekSuperadminPbts(uname, password).then(function (session) {
        if (!session) throw new Error('Nama pengguna atau kata sandi salah.');
        return saveSession(session);
      });
    });
  }

  // Dipakai halaman dashboard: bila sesi tidak ada, pindah ke halaman login.
  function requireRole() {
    var session = getSession();
    if (!session) {
      window.location.replace('ekskul-login.html');
      return null;
    }
    return session;
  }

  return {
    login: login,
    logout: logout,
    current: current,
    getSession: getSession,
    isSuperadmin: isSuperadmin,
    isViewer: isViewer,
    isSiswa: isSiswa,
    canWrite: canWrite,
    requireRole: requireRole,
    normalizeUsername: normalizeUsername,
    verifyHash: verifyHash,
    gantiPasswordSendiri: gantiPasswordSendiri,
    makeSalt: EkskulHash.makeSalt,
    hash: EkskulHash.hash
  };
})();

/* --------------------------------------------------------------------------
   Operasi data domain modul ekskul (pendaftaran, penilaian, absensi, dsb).
   -------------------------------------------------------------------------- */
var EkskulData = (function () {
  function sekolahAktif() {
    return EkskulStore.where('schools', function (s) {
      return s.status === 'aktif';
    });
  }

  function semuaSekolah() {
    return EkskulStore.all('schools');
  }

  function siswaOfSchools(sekolahIds) {
    var set = {};
    (sekolahIds || []).forEach(function (id) {
      set[id] = true;
    });
    return EkskulStore.where('students', function (s) {
      return set[s.sekolah_id];
    });
  }

  function sekolahById(id) {
    return EkskulStore.find('schools', id);
  }

  function namaSekolah(id) {
    var s = sekolahById(id);
    return s ? s.nama : '-';
  }

  function siswaById(id) {
    return EkskulStore.find('students', id);
  }

  function usernameTaken(username) {
    var uname = EkskulAuth.normalizeUsername(username);
    if (EkskulConfig.RESERVED_USERNAMES.indexOf(uname) !== -1) return true;
    var bySekolah = EkskulStore.findOne('schools', function (s) {
      return EkskulAuth.normalizeUsername(s.username) === uname;
    });
    if (bySekolah) return true;
    var byGuru = EkskulStore.findOne('teachers', function (t) {
      return EkskulAuth.normalizeUsername(t.username) === uname;
    });
    if (byGuru) return true;
    var bySiswa = EkskulStore.findOne('students', function (st) {
      if (st.username && EkskulAuth.normalizeUsername(st.username) === uname) return true;
      // ID siswa (EKS-001) juga bisa dipakai login, jadi jangan sampai bentrok.
      return st.id_siswa && EkskulAuth.normalizeUsername(st.id_siswa) === uname;
    });
    return !!bySiswa;
  }

  // Pendaftaran sekolah oleh tamu: status "menunggu" sampai disetujui.
  function daftarSekolah(payload) {
    if (usernameTaken(payload.username)) {
      return Promise.reject(new Error('Nama pengguna sudah dipakai atau tidak boleh dipakai.'));
    }
    if (String(payload.password || '').length < 6) {
      return Promise.reject(new Error('Kata sandi minimal 6 karakter.'));
    }
    var salt = EkskulHash.makeSalt();
    return EkskulHash.hash(payload.password, salt).then(function (hash) {
      return EkskulStore.insert('schools', {
        nama: String(payload.nama || '').trim(),
        alamat: String(payload.alamat || '').trim(),
        username: EkskulAuth.normalizeUsername(payload.username),
        password_hash: hash,
        password_salt: salt,
        status: 'menunggu'
      });
    });
  }

  // Pendaftaran siswa/siswi oleh tamu: mendapat ID otomatis EKS-XXX dan
  // akun login (nama pengguna + kata sandi) untuk melihat hasilnya sendiri.
  function daftarSiswa(payload) {
    var sekolah = sekolahById(payload.sekolah_id);
    if (!sekolah || sekolah.status !== 'aktif') {
      return Promise.reject(new Error('Asal sekolah tidak valid. Pilih sekolah yang sudah disetujui.'));
    }
    var usia = Number(payload.usia);
    if (!isFinite(usia) || Math.floor(usia) !== usia || usia < EkskulConfig.USIA_MIN || usia > EkskulConfig.USIA_MAX) {
      return Promise.reject(new Error('Usia harus bilangan bulat antara ' + EkskulConfig.USIA_MIN + ' dan ' + EkskulConfig.USIA_MAX + '.'));
    }
    var uname = String(payload.username || '').trim();
    if (!uname) {
      return Promise.reject(new Error('Nama pengguna wajib diisi.'));
    }
    if (usernameTaken(uname)) {
      return Promise.reject(new Error('Nama pengguna sudah dipakai atau tidak boleh dipakai.'));
    }
    if (String(payload.password || '').length < 6) {
      return Promise.reject(new Error('Kata sandi minimal 6 karakter.'));
    }
    var salt = EkskulHash.makeSalt();
    return EkskulHash.hash(payload.password, salt).then(function (hash) {
      return EkskulStore.insert('students', {
        id_siswa: EkskulStore.nextSiswaId(),
        nama: String(payload.nama || '').trim(),
        kelas: String(payload.kelas || '').trim(),
        sekolah_id: sekolah.id,
        jk: payload.jk,
        usia: usia,
        username: EkskulAuth.normalizeUsername(uname),
        password_hash: hash,
        password_salt: salt,
        status: 'aktif'
      });
    });
  }

  function duplikatSiswa(payload, kecualiId) {
    return EkskulStore.findOne('students', function (s) {
      return s.id !== kecualiId &&
        String(s.nama).trim().toLowerCase() === String(payload.nama || '').trim().toLowerCase() &&
        String(s.kelas).trim().toLowerCase() === String(payload.kelas || '').trim().toLowerCase() &&
        s.sekolah_id === payload.sekolah_id;
    });
  }

  function parameters(kategori, hanyaAktif) {
    return EkskulStore.where('parameters', function (p) {
      if (kategori && p.kategori !== kategori) return false;
      if (hanyaAktif && !p.aktif) return false;
      return true;
    });
  }

  function kategoriParam() {
    var list = EkskulStore.all('parameters');
    var out = [];
    ['teknik', 'fisik'].forEach(function (k) {
      var items = list.filter(function (p) {
        return p.kategori === k;
      });
      if (items.length) out.push({ id: k, nama: EkskulConfig.KATEGORI_PARAM[k], parameters: items });
    });
    return out;
  }

  function categories() {
    return EkskulStore.where('categories', function (c) {
      return c.aktif !== false;
    });
  }

  function penilaianSiswa(siswaId, dari, sampai) {
    return EkskulStore.where('assessments', function (a) {
      if (a.siswa_id !== siswaId) return false;
      if (dari && a.tanggal < dari) return false;
      if (sampai && a.tanggal > sampai) return false;
      return true;
    }).sort(function (a, b) {
      return a.tanggal < b.tanggal ? -1 : a.tanggal > b.tanggal ? 1 : 0;
    });
  }

  function absensiSiswa(siswaId, dari, sampai) {
    return EkskulStore.where('attendance', function (a) {
      if (a.siswa_id !== siswaId) return false;
      if (dari && a.tanggal < dari) return false;
      if (sampai && a.tanggal > sampai) return false;
      return true;
    }).sort(function (a, b) {
      return a.tanggal < b.tanggal ? -1 : a.tanggal > b.tanggal ? 1 : 0;
    });
  }

  function pertandinganSiswa(siswaIds, dari, sampai) {
    var set = {};
    (siswaIds || []).forEach(function (id) {
      set[id] = true;
    });
    return EkskulStore.where('matches', function (m) {
      if (dari && m.tanggal < dari) return false;
      if (sampai && m.tanggal > sampai) return false;
      return (m.siswa_ids || []).some(function (id) {
        return set[id];
      });
    }).sort(function (a, b) {
      return a.tanggal < b.tanggal ? -1 : a.tanggal > b.tanggal ? 1 : 0;
    });
  }

  function hapusDataSiswa(siswaId) {
    EkskulStore.removeWhere('assessments', function (a) {
      return a.siswa_id === siswaId;
    });
    EkskulStore.removeWhere('attendance', function (a) {
      return a.siswa_id === siswaId;
    });
  }

  return {
    sekolahAktif: sekolahAktif,
    semuaSekolah: semuaSekolah,
    siswaOfSchools: siswaOfSchools,
    sekolahById: sekolahById,
    namaSekolah: namaSekolah,
    siswaById: siswaById,
    usernameTaken: usernameTaken,
    daftarSekolah: daftarSekolah,
    daftarSiswa: daftarSiswa,
    duplikatSiswa: duplikatSiswa,
    parameters: parameters,
    kategoriParam: kategoriParam,
    categories: categories,
    penilaianSiswa: penilaianSiswa,
    absensiSiswa: absensiSiswa,
    pertandinganSiswa: pertandinganSiswa,
    hapusDataSiswa: hapusDataSiswa
  };
})();

/* --------------------------------------------------------------------------
   Perhitungan persentase — SEMUanya dihitung dari data, bukan ditulis manual.
   Skala nilai: 1..10  ->  persentase = (nilai / 10) × 100
   -------------------------------------------------------------------------- */
var EkskulHitung = (function () {
  function pctNilai(nilai) {
    var n = Number(nilai);
    if (!isFinite(n)) return null;
    return Math.max(0, Math.min(100, (n / 10) * 100));
  }

  function rata(list) {
    if (!list.length) return null;
    var sum = 0;
    for (var i = 0; i < list.length; i++) sum += list[i];
    return sum / list.length;
  }

  function bulat(v, digit) {
    if (v === null || v === undefined || !isFinite(v)) return null;
    var f = Math.pow(10, digit === undefined ? 0 : digit);
    return Math.round(v * f) / f;
  }

  // Minggu ISO (Senin) untuk grafik tren per minggu.
  function weekStart(iso) {
    var parts = String(iso).slice(0, 10).split('-');
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    var day = d.getDay();
    var diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    var m = d.getMonth() + 1;
    var dd = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd;
  }

  function weekLabel(isoWeek) {
    if (typeof Utils !== 'undefined') return Utils.fmtDate(isoWeek);
    return isoWeek;
  }

  // Ringkasan penilaian untuk sekumpulan siswa pada rentang tanggal.
  // Mengembalikan: per parameter (%), per kategori (%), keseluruhan (%),
  // serta tren per minggu (%).
  function ringkasanPenilaian(listSiswa, dari, sampai) {
    var siswaIds = {};
    (listSiswa || []).forEach(function (s) {
      siswaIds[s.id] = true;
    });
    var assessments = EkskulStore.where('assessments', function (a) {
      if (!siswaIds[a.siswa_id]) return false;
      if (dari && a.tanggal < dari) return false;
      if (sampai && a.tanggal > sampai) return false;
      return true;
    });

    var params = EkskulStore.all('parameters');
    var paramById = {};
    params.forEach(function (p) {
      paramById[p.id] = p;
    });

    // Kumpulkan nilai mentah per parameter ID.
    var nilaiPerParam = {};
    var kedisiplinan = [];
    assessments.forEach(function (a) {
      var values = a.values || {};
      Object.keys(values).forEach(function (pid) {
        var v = Number(values[pid]);
        if (!isFinite(v)) return;
        if (!nilaiPerParam[pid]) nilaiPerParam[pid] = [];
        nilaiPerParam[pid].push(v);
      });
      if (a.kedisiplinan !== undefined && a.kedisiplinan !== null && a.kedisiplinan !== '') {
        var k = Number(a.kedisiplinan);
        if (isFinite(k)) kedisiplinan.push(k);
      }
    });

    // Nilai rata-rata (skala 1-10) per parameter -> dikonversi ke persen.
    var perParameter = [];
    params.forEach(function (p) {
      var values = nilaiPerParam[p.id] || [];
      var avg = rata(values);
      perParameter.push({
        id: p.id,
        nama: p.nama,
        kategori: p.kategori,
        aktif: !!p.aktif,
        jumlah: values.length,
        rata_nilai: avg === null ? null : bulat(avg, 2),
        persen: avg === null ? null : bulat(pctNilai(avg), 1)
      });
    });

    // Parameter lama yang sudah tidak ada di master tetap ditampilkan
    // (nilainya tidak hilang) agar riwayat tetap utuh.
    Object.keys(nilaiPerParam).forEach(function (pid) {
      if (paramById[pid]) return;
      var avg = rata(nilaiPerParam[pid]);
      perParameter.push({
        id: pid,
        nama: 'Parameter lama',
        kategori: 'lain',
        aktif: false,
        jumlah: nilaiPerParam[pid].length,
        rata_nilai: bulat(avg, 2),
        persen: bulat(pctNilai(avg), 1)
      });
    });

    var avgKedis = rata(kedisiplinan);
    perParameter.push({
      id: EkskulConfig.KEDISIPLINAN_ID,
      nama: 'Kedisiplinan',
      kategori: 'kedisiplinan',
      aktif: true,
      jumlah: kedisiplinan.length,
      rata_nilai: avgKedis === null ? null : bulat(avgKedis, 2),
      persen: avgKedis === null ? null : bulat(pctNilai(avgKedis), 1)
    });

    // Persentase kategori = rata-rata persentase parameter dalam kategori itu.
    var perKategori = [];
    ['teknik', 'fisik', 'kedisiplinan'].forEach(function (k) {
      var persens = perParameter.filter(function (p) {
        return p.kategori === k && p.persen !== null;
      }).map(function (p) {
        return p.persen;
      });
      var avg = rata(persens);
      perKategori.push({
        id: k,
        nama: EkskulConfig.KATEGORI_PARAM[k],
        persen: avg === null ? null : bulat(avg, 1),
        jumlah_parameter: persens.length
      });
    });

    // Keseluruhan = rata-rata ketiga kategori (kategori tanpa data diabaikan).
    var kategoriPersens = perKategori.filter(function (k) {
      return k.persen !== null;
    }).map(function (k) {
      return k.persen;
    });
    var keseluruhan = rata(kategoriPersens);

    // Tren per minggu: rata-rata persentase seluruh parameter tiap minggu.
    var perMinggu = {};
    assessments.forEach(function (a) {
      var wk = weekStart(a.tanggal);
      if (!perMinggu[wk]) perMinggu[wk] = [];
      var values = a.values || {};
      var persens = [];
      Object.keys(values).forEach(function (pid) {
        var v = Number(values[pid]);
        if (isFinite(v)) persens.push(pctNilai(v));
      });
      if (a.kedisiplinan !== undefined && a.kedisiplinan !== null && a.kedisiplinan !== '') {
        var kv = Number(a.kedisiplinan);
        if (isFinite(kv)) persens.push(pctNilai(kv));
      }
      var avg = rata(persens);
      if (avg !== null) perMinggu[wk].push(avg);
    });
    var mingguKeys = Object.keys(perMinggu).sort();
    var tren = mingguKeys.map(function (wk) {
      return { minggu: wk, label: weekLabel(wk), persen: bulat(rata(perMinggu[wk]), 1) };
    });

    return {
      jumlah_penilaian: assessments.length,
      per_parameter: perParameter,
      per_kategori: perKategori,
      keseluruhan: keseluruhan === null ? null : bulat(keseluruhan, 1),
      tren_mingguan: tren
    };
  }

  // Kehadiran: persentase = Hadir / total pertemuan × 100
  function ringkasanAbsensi(listSiswa, dari, sampai) {
    var siswaIds = {};
    (listSiswa || []).forEach(function (s) {
      siswaIds[s.id] = true;
    });
    var rows = EkskulStore.where('attendance', function (a) {
      if (!siswaIds[a.siswa_id]) return false;
      if (dari && a.tanggal < dari) return false;
      if (sampai && a.tanggal > sampai) return false;
      return true;
    });

    var rekap = { Hadir: 0, Izin: 0, Sakit: 0, 'Tidak Hadir': 0 };
    var perSiswa = {};
    rows.forEach(function (r) {
      var st = rekap[r.status] === undefined ? r.status : r.status;
      if (rekap[st] === undefined) rekap[st] = 0;
      rekap[st]++;
      if (!perSiswa[r.siswa_id]) perSiswa[r.siswa_id] = { total: 0, Hadir: 0, Izin: 0, Sakit: 0, 'Tidak Hadir': 0 };
      var p = perSiswa[r.siswa_id];
      p.total++;
      if (p[st] === undefined) p[st] = 0;
      p[st]++;
    });

    var daftar = (listSiswa || []).map(function (s) {
      var p = perSiswa[s.id] || { total: 0, Hadir: 0, Izin: 0, Sakit: 0, 'Tidak Hadir': 0 };
      return {
        siswa: s,
        total: p.total,
        Hadir: p.Hadir,
        Izin: p.Izin,
        Sakit: p.Sakit,
        'Tidak Hadir': p['Tidak Hadir'],
        persen: p.total ? bulat((p.Hadir / p.total) * 100, 1) : null
      };
    });

    var total = rows.length;
    var keseluruhan = total ? bulat((rekap.Hadir / total) * 100, 1) : null;

    return {
      jumlah_pertemuan: total,
      rekap: rekap,
      per_siswa: daftar,
      keseluruhan: keseluruhan
    };
  }

  // Pertandingan: rasio menang = Menang / total × 100
  function ringkasanPertandingan(listSiswa, dari, sampai) {
    var siswaIds = {};
    (listSiswa || []).forEach(function (s) {
      siswaIds[s.id] = true;
    });
    var rows = EkskulStore.where('matches', function (m) {
      if (dari && m.tanggal < dari) return false;
      if (sampai && m.tanggal > sampai) return false;
      if (!siswaIds || !Object.keys(siswaIds).length) return true;
      return (m.siswa_ids || []).some(function (id) {
        return siswaIds[id];
      });
    }).sort(function (a, b) {
      return a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : 0;
    });

    var menang = 0;
    var kalah = 0;
    rows.forEach(function (m) {
      if (m.hasil === 'Menang') menang++;
      else if (m.hasil === 'Kalah') kalah++;
    });

    return {
      jumlah: rows.length,
      menang: menang,
      kalah: kalah,
      rasio_menang: rows.length ? bulat((menang / rows.length) * 100, 1) : null,
      daftar: rows
    };
  }

  return {
    pctNilai: pctNilai,
    rata: rata,
    bulat: bulat,
    weekStart: weekStart,
    weekLabel: weekLabel,
    ringkasanPenilaian: ringkasanPenilaian,
    ringkasanAbsensi: ringkasanAbsensi,
    ringkasanPertandingan: ringkasanPertandingan
  };
})();

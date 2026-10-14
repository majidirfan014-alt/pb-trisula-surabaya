var Auth = (function () {
  var SESSION_KEY = CONFIG.PREFIX + 'session';

  // Kredensial awal akun Pelatih Kepala (dipakai untuk pembuatan data awal
  // dan migrasi akun lama). Yang tersimpan di penyimpanan selalu berupa
  // hash + salt, bukan kata sandi polos.
  var AKUN_ADMIN = { username: 'superadmin', password: 'galohganteng123' };

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

  function hashPassword(password, salt) {
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

  function normalizeUsername(value) {
    return String(value || '').trim().toLowerCase();
  }

  function saveSession(user) {
    var session = {
      userId: user.id,
      role: user.role,
      nama: user.nama,
      username: user.username,
      id_atlet: user.id_atlet || null,
      exp: Date.now() + CONFIG.SESSION_HOURS * 3600 * 1000
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  function getSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var session = JSON.parse(raw);
      if (!session || !session.exp || session.exp < Date.now()) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return session;
    } catch (e) {
      return null;
    }
  }

  function current() {
    var session = getSession();
    if (!session) return null;
    var user = Store.find('users', session.userId);
    if (!user || user.status === 'nonaktif') {
      logout();
      return null;
    }
    return user;
  }

  function login(username, password) {
    return Store.init().then(function () {
      // Migrasi akun admin lama dijalankan dulu agar login superadmin
      // langsung berhasil pada data penyimpanan lama.
      return migrasiAkunAdmin();
    }).then(function () {
      var uname = normalizeUsername(username);
      if (!uname || !password) {
        throw new Error('Nama pengguna dan kata sandi wajib diisi.');
      }
      var user = Store.findOne('users', function (u) {
        return normalizeUsername(u.username) === uname;
      });
      if (!user) {
        throw new Error('ID/nama pengguna atau kata sandi salah.');
      }
      if (user.status === 'nonaktif') {
        throw new Error('Akun Anda dinonaktifkan. Hubungi pelatih kepala.');
      }
      return hashPassword(password, user.password_salt).then(function (hash) {
        if (hash !== user.password_hash) {
          throw new Error('ID/nama pengguna atau kata sandi salah.');
        }
        saveSession(user);
        return user;
      });
    });
  }

  // Migrasi otomatis akun Pelatih Kepala lama (admin) menjadi superadmin
  // dengan kata sandi baru. Record akun tidak diganti/dihapus sehingga data
  // yang mencatat "diinput oleh" akun lama tetap tersambung. Idempoten:
  // aman dijalankan berulang (mis. setelah data dimuat ulang dari cloud).
  function migrasiAkunAdmin() {
    var lama = Store.findOne('users', function (u) {
      return normalizeUsername(u.username) === 'admin' && u.role === 'pelatih_kepala';
    });
    if (!lama) return Promise.resolve(0);
    var sudahAda = Store.findOne('users', function (u) {
      return u.id !== lama.id && normalizeUsername(u.username) === AKUN_ADMIN.username;
    });
    if (sudahAda) {
      // Jangan sampai ada dua akun admin: akun lama cukup dinonaktifkan
      // (tidak bisa login) tanpa dihapus agar referensi data tetap utuh.
      Store.update('users', lama.id, { status: 'nonaktif' });
      return Promise.resolve(0);
    }
    var salt = makeSalt();
    return hashPassword(AKUN_ADMIN.password, salt).then(function (hash) {
      Store.update('users', lama.id, {
        username: AKUN_ADMIN.username,
        password_hash: hash,
        password_salt: salt
      });
      return 1;
    });
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
  }

  function require(roles) {
    var user = current();
    if (!user) {
      window.location.replace('login.html');
      return null;
    }
    if (roles && roles.length && roles.indexOf(user.role) === -1) {
      window.location.replace('app.html#/beranda');
      return null;
    }
    return user;
  }

  function changePassword(userId, oldPassword, newPassword) {
    var user = Store.find('users', userId);
    if (!user) return Promise.reject(new Error('Pengguna tidak ditemukan.'));
    return hashPassword(oldPassword, user.password_salt).then(function (hash) {
      if (hash !== user.password_hash) throw new Error('Kata sandi lama salah.');
      return hashPassword(newPassword, user.password_salt).then(function (newHash) {
        Store.update('users', userId, { password_hash: newHash });
        return true;
      });
    });
  }

  function resetPassword(userId, newPassword) {
    var user = Store.find('users', userId);
    if (!user) return Promise.reject(new Error('Pengguna tidak ditemukan.'));
    return hashPassword(newPassword, user.password_salt).then(function (hash) {
      Store.update('users', userId, { password_hash: hash });
      return true;
    });
  }

  function createUser(payload) {
    return Store.init().then(function () {
      var uname = normalizeUsername(payload.username);
      if (!uname) throw new Error('Nama pengguna wajib diisi.');
      if (String(payload.password || '').length < 6) throw new Error('Kata sandi minimal 6 karakter.');
      var exists = Store.findOne('users', function (u) {
        return normalizeUsername(u.username) === uname;
      });
      if (exists) throw new Error('Nama pengguna sudah dipakai.');
      var salt = makeSalt();
      return hashPassword(payload.password, salt).then(function (hash) {
        return Store.insert('users', {
          nama: payload.nama,
          username: uname,
          role: payload.role,
          id_atlet: payload.id_atlet || null,
          password_hash: hash,
          password_salt: salt,
          status: payload.status || 'aktif',
          no_hp: payload.no_hp || '',
          foto: payload.foto || ''
        });
      });
    });
  }

  function registerAthlete(payload) {
    return createUser({
      nama: payload.nama,
      username: payload.username,
      password: payload.password,
      role: 'atlet',
      status: 'aktif',
      no_hp: payload.no_hp,
      foto: payload.foto
    }).then(function (user) {
      var bmi = Utils.bmi(payload.tinggi, payload.berat);
      var athlete = Store.insert('athletes', {
        id_atlet: Store.nextAthleteId(),
        user_id: user.id,
        nama: payload.nama,
        nisn: String(payload.nisn || '').trim(),
        tgl_lahir: payload.tgl_lahir,
        jk: payload.jk,
        tinggi: Number(payload.tinggi),
        berat: Number(payload.berat),
        bmi: bmi.value,
        kategori_bmi: bmi.category.label,
        sekolah: payload.sekolah,
        asal_pb: payload.asal_pb || '',
        alamat: payload.alamat || '',
        agama: payload.agama || '',
        no_hp: payload.no_hp,
        foto: payload.foto || '',
        dokumen: payload.dokumen || {},
        status: 'aktif'
      });
      Store.update('users', user.id, {
        id_atlet: athlete.id_atlet,
        athlete_id: athlete.id,
        foto: athlete.foto
      });
      return athlete;
    });
  }

  // Pendaftaran asisten pelatih: membuat akun login + menyimpan profil
  // (tanggal lahir, usia dihitung saat dibaca, foto, dan berkas lisensi pelatih).
  function registerAsisten(payload) {
    return createUser({
      nama: payload.nama,
      username: payload.username,
      password: payload.password,
      role: 'asisten',
      status: 'aktif',
      no_hp: payload.no_hp || '',
      foto: payload.foto || ''
    }).then(function (user) {
      return Store.update('users', user.id, {
        tgl_lahir: payload.tgl_lahir || '',
        lisensi: payload.lisensi || null
      });
    });
  }

  // Membuat data awal saat penyimpanan masih kosong: hanya akun Pelatih
  // Kepala + data master (parameter logbook & jenis tes). Tidak ada lagi
  // data contoh/demo (akun, atlet, kehadiran, logbook, pertandingan, dsb).
  function seed() {
    var defaults = {
      log_parameters: CONFIG.LOG_PARAMETERS.map(function (p) {
        return Object.assign({}, p);
      }),
      test_types: CONFIG.TEST_TYPES.map(function (t) {
        return Object.assign({}, t);
      })
    };
    localStorage.setItem(CONFIG.PREFIX + 'log_parameters', JSON.stringify(defaults.log_parameters));
    localStorage.setItem(CONFIG.PREFIX + 'test_types', JSON.stringify(defaults.test_types));

    var salt = makeSalt();
    return hashPassword(AKUN_ADMIN.password, salt).then(function (hash) {
      Store.insert('users', {
        nama: 'Ahmad Fauzi',
        username: AKUN_ADMIN.username,
        role: 'pelatih_kepala',
        id_atlet: null,
        athlete_id: null,
        password_hash: hash,
        password_salt: salt,
        status: 'aktif',
        no_hp: '081211112222',
        foto: ''
      });
      return true;
    });
  }

  // Akun contoh dari versi sebelumnya. Dipakai HANYA untuk verifikasi saat
  // pembersihan data contoh (dicocokkan lewat hash kata sandinya, bukan teks).
  var DATA_CONTOH = [
    { nama: 'Raka Wijaya', username: 'asisten', password: 'asisten123', role: 'asisten' },
    { nama: 'Budi Santoso', username: 'budi', password: 'atlet123', role: 'atlet' },
    { nama: 'Siti Rahma', username: 'siti', password: 'atlet123', role: 'atlet' },
    { nama: 'Andi Pratama', username: 'andi', password: 'atlet123', role: 'atlet' }
  ];

  // Menghapus sisa data contoh dari penyimpanan lama (lokal maupun yang
  // dikembalikan dari cloud). Idempoten dan aman: sebuah akun hanya dihapus
  // bila username, peran, nama, DAN hash kata sandinya persis sama dengan
  // akun contoh lama; data asli pengguna tidak pernah disentuh.
  function hapusDataContoh() {
    var kandidat = [];
    DATA_CONTOH.forEach(function (d) {
      var u = Store.findOne('users', function (x) {
        return normalizeUsername(x.username) === d.username &&
          x.role === d.role && String(x.nama || '').trim() === d.nama;
      });
      if (u) kandidat.push({ def: d, user: u });
    });
    if (!kandidat.length) {
      bersihkanPenandaContoh();
      return Promise.resolve(0);
    }
    return Promise.all(kandidat.map(function (k) {
      return hashPassword(k.def.password, k.user.password_salt).then(function (hash) {
        return hash === k.user.password_hash ? k.user : null;
      });
    })).then(function (hasil) {
      var userIds = hasil.filter(Boolean).map(function (u) {
        return u.id;
      });
      if (userIds.length) {
        var idAtlet = {};
        Store.where('athletes', function (a) {
          return userIds.indexOf(a.user_id) !== -1;
        }).forEach(function (a) {
          if (a.id_atlet) idAtlet[a.id_atlet] = true;
        });
        var milikContoh = function (v) {
          return !!v && !!idAtlet[v];
        };
        Store.removeWhere('attendance', function (r) {
          return userIds.indexOf(r.id_pengguna) !== -1 || milikContoh(r.id_atlet);
        });
        Store.removeWhere('logbook_entries', function (e) {
          return milikContoh(e.id_atlet);
        });
        Store.removeWhere('physical_tests', function (t) {
          return milikContoh(t.id_atlet);
        });
        Store.removeWhere('matches', function (m) {
          return milikContoh(m.id_atlet) || milikContoh(m.id_atlet_2);
        });
        Store.removeWhere('monitoring', function (m) {
          return milikContoh(m.idAtlet);
        });
        Store.removeWhere('pembayaran', function (p) {
          return milikContoh(p.id_atlet);
        });
        Store.removeWhere('absensi_asisten', function (r) {
          return userIds.indexOf(r.id_asisten) !== -1;
        });
        Store.removeWhere('athletes', function (a) {
          return userIds.indexOf(a.user_id) !== -1;
        });
        Store.removeWhere('users', function (u) {
          return userIds.indexOf(u.id) !== -1;
        });
        if (!Store.all('athletes').length) {
          Store.resetSeq('atlet', 0);
        }
      }
      bersihkanPenandaContoh();
      return userIds.length;
    });
  }

  function bersihkanPenandaContoh() {
    try {
      var hapus = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && (k.indexOf('kemajuan_demo') !== -1 || k === CONFIG.PREFIX + 'mon_demo')) hapus.push(k);
      }
      hapus.forEach(function (k) {
        localStorage.removeItem(k);
      });
    } catch (e) {}
  }

  return {
    hashPassword: hashPassword,
    makeSalt: makeSalt,
    login: login,
    logout: logout,
    current: current,
    require: require,
    changePassword: changePassword,
    resetPassword: resetPassword,
    createUser: createUser,
    registerAthlete: registerAthlete,
    registerAsisten: registerAsisten,
    migrasiAkunAdmin: migrasiAkunAdmin,
    hapusDataContoh: hapusDataContoh,
    seed: seed
  };
})();

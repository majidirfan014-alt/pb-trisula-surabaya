var Auth = (function () {
  var SESSION_KEY = CONFIG.PREFIX + 'session';

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
      var uname = normalizeUsername(username);
      if (!uname || !password) {
        throw new Error('Nama pengguna dan kata sandi wajib diisi.');
      }
      var user = Store.findOne('users', function (u) {
        return normalizeUsername(u.username) === uname;
      });
      if (!user) {
        throw new Error('Nama pengguna tidak ditemukan.');
      }
      if (user.status === 'nonaktif') {
        throw new Error('Akun Anda dinonaktifkan. Hubungi pelatih kepala.');
      }
      return hashPassword(password, user.password_salt).then(function (hash) {
        if (hash !== user.password_hash) {
          throw new Error('Kata sandi salah.');
        }
        saveSession(user);
        return user;
      });
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

  function seed() {
    var defaults = {
      log_parameters: CONFIG.LOG_PARAMETERS.map(function (p) {
        return Object.assign({}, p);
      }),
      test_types: CONFIG.TEST_TYPES.map(function (t) {
        return Object.assign({}, t);
      })
    };
    Store.all('log_parameters');
    localStorage.setItem(CONFIG.PREFIX + 'log_parameters', JSON.stringify(defaults.log_parameters));
    localStorage.setItem(CONFIG.PREFIX + 'test_types', JSON.stringify(defaults.test_types));

    var accounts = [
      { nama: 'Ahmad Fauzi', username: 'admin', password: 'admin123', role: 'pelatih_kepala', no_hp: '081211112222' },
      { nama: 'Raka Wijaya', username: 'asisten', password: 'asisten123', role: 'asisten', no_hp: '081333334444' },
      { nama: 'Budi Santoso', username: 'budi', password: 'atlet123', role: 'atlet', no_hp: '081355556666' },
      { nama: 'Siti Rahma', username: 'siti', password: 'atlet123', role: 'atlet', no_hp: '081377778888' },
      { nama: 'Andi Pratama', username: 'andi', password: 'atlet123', role: 'atlet', no_hp: '081399990000' }
    ];

    var athleteProfiles = [
      { tgl_lahir: '2008-04-12', jk: 'Laki-laki', tinggi: 168, berat: 58, sekolah: 'SMA Negeri 5 Surabaya', asal_pb: 'PB Angkasa' },
      { tgl_lahir: '2009-09-03', jk: 'Perempuan', tinggi: 160, berat: 52, sekolah: 'SMA Negeri 1 Surabaya', asal_pb: '' },
      { tgl_lahir: '2007-01-25', jk: 'Laki-laki', tinggi: 175, berat: 68, sekolah: 'SMA Negeri 3 Surabaya', asal_pb: 'PB Delta' }
    ];

    var chain = Promise.resolve();
    var createdUsers = [];
    var createdAthletes = [];

    accounts.forEach(function (acc, index) {
      chain = chain.then(function () {
        var salt = makeSalt();
        return hashPassword(acc.password, salt).then(function (hash) {
          var user = Store.insert('users', {
            nama: acc.nama,
            username: acc.username,
            role: acc.role,
            id_atlet: null,
            athlete_id: null,
            password_hash: hash,
            password_salt: salt,
            status: 'aktif',
            no_hp: acc.no_hp,
            foto: ''
          });
          createdUsers.push(user);
          if (acc.role === 'atlet') {
            var profile = athleteProfiles[index - 2] || athleteProfiles[0];
            var bmi = Utils.bmi(profile.tinggi, profile.berat);
            var athlete = Store.insert('athletes', {
              id_atlet: Store.nextAthleteId(),
              user_id: user.id,
              nama: acc.nama,
              tgl_lahir: profile.tgl_lahir,
              jk: profile.jk,
              tinggi: profile.tinggi,
              berat: profile.berat,
              bmi: bmi.value,
              kategori_bmi: bmi.category.label,
              sekolah: profile.sekolah,
              asal_pb: profile.asal_pb,
              no_hp: acc.no_hp,
              foto: '',
              status: 'aktif'
            });
            Store.update('users', user.id, { id_atlet: athlete.id_atlet, athlete_id: athlete.id });
            createdAthletes.push(athlete);
          }
        });
      });
    });

    return chain.then(function () {
      var assistant = createdUsers[1];
      var coach = createdUsers[0];
      var start = 13;
      for (var d = start; d >= 0; d--) {
        var tanggal = Utils.daysAgoISO(d);
        var dow = Utils.parseISO(tanggal).getDay();
        if (dow === 0 || dow === 6) continue;
        createdAthletes.forEach(function (athlete, ai) {
          var status = ((d + ai) % 7 === 0) ? 'Izin' : (((d + ai) % 11 === 0) ? 'Sakit' : 'Hadir');
          Store.insert('attendance', {
            tanggal: tanggal,
            id_pengguna: athlete.user_id,
            id_atlet: athlete.id_atlet,
            tipe: 'atlet',
            status: status,
            catatan: status === 'Hadir' ? '' : 'Kabari pelatih sebelum latihan.',
            jam_masuk: '',
            jam_pulang: '',
            input_oleh: assistant.id
          });
          if (d % 3 === 0) {
            var params = Store.all('log_parameters');
            params.forEach(function (p, pi) {
              var base = p.kategori === 'fisik' ? 7 : 7;
              var nilai = Math.max(1, Math.min(10, base + ((d + pi + ai) % 4) - 1));
              Store.insert('logbook_entries', {
                id_atlet: athlete.id_atlet,
                tanggal: tanggal,
                id_parameter: p.id,
                nama_parameter: p.nama,
                kategori: p.kategori,
                nilai: nilai,
                catatan: pi === 0 ? 'Latihan rutin, fokus konsistensi.' : '',
                input_oleh: assistant.id
              });
            });
          }
        });
        if (d === 13 || d === 7 || d === 1) {
          Store.insert('attendance', {
            tanggal: tanggal,
            id_pengguna: assistant.id,
            id_atlet: null,
            tipe: 'asisten',
            status: 'Hadir',
            catatan: '',
            jam_masuk: '15.45',
            jam_pulang: '18.10',
            input_oleh: assistant.id
          });
        }
      }

      var testTypes = Store.all('test_types');
      createdAthletes.forEach(function (athlete, ai) {
        [10, 2].forEach(function (ago, round) {
          testTypes.forEach(function (tt, ti) {
            var value;
            if (tt.lebih_baik === 'rendah') {
              value = Math.round((9.2 - ai * 0.3 - round * 0.2 + (ti % 3) * 0.15) * 10) / 10;
            } else {
              value = Math.round(28 + ai * 3 + round * 4 + (ti % 4) * 2.5);
            }
            Store.insert('physical_tests', {
              id_atlet: athlete.id_atlet,
              tanggal: Utils.daysAgoISO(ago),
              id_tes: tt.id,
              jenis_tes: tt.nama,
              hasil: value,
              satuan: tt.satuan,
              lebih_baik: tt.lebih_baik,
              input_oleh: coach.id
            });
          });
        });
      });

      Store.insert('matches', {
        id_atlet: createdAthletes[0].id_atlet,
        tanggal: Utils.daysAgoISO(6),
        turnamen: 'Surabaya Open 2026',
        lawan: 'PB Djarum Kudus',
        skor_set: ['21-18', '17-21', '21-15'],
        hasil: 'Menang',
        catatan: 'Bermain sabar di set penentu.',
        input_oleh: assistant.id
      });
      Store.insert('matches', {
        id_atlet: createdAthletes[1].id_atlet,
        tanggal: Utils.daysAgoISO(6),
        turnamen: 'Surabaya Open 2026',
        lawan: 'PB Jaya Raya',
        skor_set: ['19-21', '21-19', '16-21'],
        hasil: 'Kalah',
        catatan: 'Perlu perbaikan pukulan backhand.',
        input_oleh: assistant.id
      });
      Store.insert('matches', {
        id_atlet: createdAthletes[2].id_atlet,
        tanggal: Utils.daysAgoISO(2),
        turnamen: 'Liga Pelajar Jawa Timur',
        lawan: 'PB Mutiara Bandung',
        skor_set: ['21-12', '21-16'],
        hasil: 'Menang',
        catatan: 'Servis konsisten.',
        input_oleh: coach.id
      });

      return true;
    });
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
    seed: seed
  };
})();

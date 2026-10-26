/* ==========================================================================
   EKSTRAKURIKULER — pemuat data contoh (demo) untuk mencoba hasil dashboard.
   Versi 2: 3 sekolah aktif + akun, 3 guru sekolah + akun, 2 pelatih,
   15 siswa/siswi (EKS-001..EKS-015) dengan akun login, serta penilaian,
   absensi, dan pertandingan contoh. Seluruh nama bersifat fiktif.
   Tidak menimpa data nyata: sekolah/siswa dengan nama pengguna "demo.*"
   milik seed versi lama dibersihkan lebih dulu, data lain tetap utuh.
   ========================================================================== */

var EkskulSeed = (function () {
  var PREFIX = EkskulConfig.PREFIX;
  var FLAG_VERSI = PREFIX + 'seed_v2';

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

  // Penulisan langsung ke localStorage: utilitas demo dipakai dari halaman
  // publik tanpa sesi, namun tetap aman bila browser menyimpan sesi viewer.
  function write(collection, items) {
    localStorage.setItem(key(collection), JSON.stringify(items));
  }

  function uid(nama) {
    return PREFIX + nama + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function iso(date) {
    var m = date.getMonth() + 1;
    var d = date.getDate();
    return date.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d;
  }

  function hariLalu(n) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    return iso(d);
  }

  function buatAkun(password) {
    var salt = EkskulHash.makeSalt();
    return EkskulHash.hash(password, salt).then(function (hash) {
      return { password_salt: salt, password_hash: hash };
    });
  }

  // Hapus hanya data yang dibuat seed (username demo.*/guru.* milik seed dan
  // record berlabel diinput_oleh 'seed'). Data nyata pengguna tetap utuh.
  function bersihkanSeedLama() {
    write('schools', read('schools').filter(function (s) {
      return String(s.username || '').indexOf('demo.') !== 0;
    }));
    write('students', read('students').filter(function (s) {
      return String(s.username || '').indexOf('demo.') !== 0;
    }));
    write('teachers', read('teachers').filter(function (t) {
      return t.diinput_oleh !== 'seed';
    }));
    write('coaches', read('coaches').filter(function (c) {
      return c.diinput_oleh !== 'seed';
    }));
    write('assessments', read('assessments').filter(function (a) {
      return a.diinput_oleh !== 'seed';
    }));
    write('attendance', read('attendance').filter(function (a) {
      return a.diinput_oleh !== 'seed';
    }));
    write('matches', read('matches').filter(function (m) {
      return m.diinput_oleh !== 'seed';
    }));
  }

  // Nilai contoh per sesi: dasar + tren (naik/turun/stabil) + variasi kecil.
  function nilaiSesi(dasar, trend, sesi) {
    var values = {};
    var params = EkskulStore.all('parameters');
    params.forEach(function (p, i) {
      var v = dasar + trend * sesi + ((i + sesi) % 3) - 1;
      if (v < 4) v = 4;
      if (v > 10) v = 10;
      values[p.id] = v;
    });
    var kedis = dasar + trend * sesi + (sesi % 2);
    if (kedis < 4) kedis = 4;
    if (kedis > 10) kedis = 10;
    return { values: values, kedisiplinan: kedis };
  }

  // Penanda ID siswa tertinggi (termasuk data nyata yang tidak disentuh seed).
  function sinkronkanSeqSiswa() {
    var max = 0;
    read('students').forEach(function (s) {
      var m = /^EKS-(\d+)$/.exec(String(s.id_siswa || ''));
      if (m) max = Math.max(max, Number(m[1]));
    });
    var seqKey = key('seq');
    var seq = {};
    try {
      seq = JSON.parse(localStorage.getItem(seqKey) || '{}') || {};
    } catch (e) {
      seq = {};
    }
    seq.siswa = max;
    localStorage.setItem(seqKey, JSON.stringify(seq));
    return 'EKS-' + String(max).padStart(3, '0');
  }

  function nextIdSiswa(counter) {
    return 'EKS-' + String(counter).padStart(3, '0');
  }

  /* --- Definisi data contoh (semua nama fiktif) --------------------------- */

  var SEKOLAH = [
    { key: 'cendekia', nama: 'SMP Cendekia Nusantara', alamat: 'Jl. Melati Raya No. 21, Sawahan, Surabaya', username: 'demo.cendekia' },
    { key: 'bahagia', nama: 'SMA Bahagia Selatan', alamat: 'Jl. Kenanga Indah No. 8, Wonocolo, Surabaya', username: 'demo.bahagia' },
    { key: 'harapan', nama: 'SMP Tunas Harapan', alamat: 'Jl. Anggrek Permai No. 15, Sukolilo, Surabaya', username: 'demo.harapan' }
  ];

  var GURU = [
    { nama: 'Wulandari Anjani', username: 'guru.wulandari', sekolah: 'cendekia' },
    { nama: 'Bagus Prasetyo', username: 'guru.bagus', sekolah: 'bahagia' },
    { nama: 'Lestari Handayani', username: 'guru.lestari', sekolah: 'harapan' }
  ];

  var PELATIH = [
    { nama: 'Hendra Gunawan', kontak: '0812-0000-0001', sekolah: ['cendekia', 'bahagia'] },
    { nama: 'Siska Ramadhani', kontak: 'siska.ramadhani@example.test', sekolah: ['bahagia', 'harapan'] }
  ];

  var SISWA = [
    { nama: 'Budi Santoso', kelas: '8A', jk: 'Laki-laki', usia: 13, username: 'demo.budi', sekolah: 'cendekia', dasar: 8, trend: 1 },
    { nama: 'Siti Aminah', kelas: '8B', jk: 'Perempuan', usia: 13, username: 'demo.siti', sekolah: 'cendekia', dasar: 7, trend: 0 },
    { nama: 'Andi Wijaya', kelas: '7A', jk: 'Laki-laki', usia: 12, username: 'demo.andi', sekolah: 'cendekia', dasar: 6, trend: 1 },
    { nama: 'Rina Amelia', kelas: '9A', jk: 'Perempuan', usia: 14, username: 'demo.rina', sekolah: 'cendekia', dasar: 9, trend: 0 },
    { nama: 'Doni Kurniawan', kelas: '10A', jk: 'Laki-laki', usia: 15, username: 'demo.doni', sekolah: 'cendekia', dasar: 5, trend: -1 },
    { nama: 'Maya Puspita', kelas: '7B', jk: 'Perempuan', usia: 12, username: 'demo.maya', sekolah: 'bahagia', dasar: 8, trend: 0 },
    { nama: 'Rizky Ramadhan', kelas: '9B', jk: 'Laki-laki', usia: 14, username: 'demo.rizky', sekolah: 'bahagia', dasar: 7, trend: 1 },
    { nama: 'Nabila Putri', kelas: '11A', jk: 'Perempuan', usia: 16, username: 'demo.nabila', sekolah: 'bahagia', dasar: 6, trend: 0 },
    { nama: 'Fajar Nugroho', kelas: '12A', jk: 'Laki-laki', usia: 17, username: 'demo.fajar', sekolah: 'bahagia', dasar: 8, trend: -1 },
    { nama: 'Intan Permata', kelas: '10B', jk: 'Perempuan', usia: 15, username: 'demo.intan', sekolah: 'bahagia', dasar: 9, trend: 1 },
    { nama: 'Galih Pratama', kelas: '7C', jk: 'Laki-laki', usia: 12, username: 'demo.galih', sekolah: 'harapan', dasar: 5, trend: 1 },
    { nama: 'Dewi Larasati', kelas: '8C', jk: 'Perempuan', usia: 13, username: 'demo.dewi', sekolah: 'harapan', dasar: 7, trend: 0 },
    { nama: 'Bayu Saputra', kelas: '11B', jk: 'Laki-laki', usia: 16, username: 'demo.bayu', sekolah: 'harapan', dasar: 6, trend: -1 },
    { nama: 'Citra Ayu', kelas: '12B', jk: 'Perempuan', usia: 17, username: 'demo.citra', sekolah: 'harapan', dasar: 8, trend: 0 },
    { nama: 'Yoga Permana', kelas: '9C', jk: 'Laki-laki', usia: 14, username: 'demo.yoga', sekolah: 'harapan', dasar: 7, trend: 1 }
  ];

  // 5 sesi latihan mingguan (28, 21, 14, 7, 2 hari lalu) untuk tren.
  var TANGGAL_SESI = [28, 21, 14, 7, 2];
  // 8 pertemuan absensi (2x seminggu selama 4 minggu).
  var TANGGAL_ABSEN = [2, 4, 7, 9, 11, 14, 16, 18];

  var muatSedang = null;

  function muat() {
    if (muatSedang) return muatSedang;
    muatSedang = jalankanMuat();
    var bersihkan = function () { muatSedang = null; };
    muatSedang.then(bersihkan, bersihkan);
    return muatSedang;
  }

  function jalankanMuat() {
    if (localStorage.getItem(FLAG_VERSI) === '1') {
      return Promise.resolve({ sudah: true, akun: daftarAkun() });
    }

    return EkskulStore.init().then(function () {
      return Promise.all([
        buatAkun('demo1234'),
        buatAkun('siswa1234')
      ]);
    }).then(function (hashes) {
      var hashDemo = hashes[0];
      var hashSiswa = hashes[1];
      var waktu = new Date().toISOString();

      bersihkanSeedLama();

      /* --- 3 sekolah aktif + akun --- */
      var sekolahByKey = {};
      var schools = read('schools');
      SEKOLAH.forEach(function (row) {
        var s = {
          id: uid('schools'), nama: row.nama, alamat: row.alamat,
          username: row.username,
          password_hash: hashDemo.password_hash, password_salt: hashDemo.password_salt,
          status: 'aktif', diinput_oleh: 'seed', dibuat_pada: waktu
        };
        schools.push(s);
        sekolahByKey[row.key] = s;
      });
      write('schools', schools);

      /* --- 3 guru sekolah + akun (satu per sekolah) --- */
      var teachers = read('teachers');
      GURU.forEach(function (row) {
        teachers.push({
          id: uid('teachers'), nama: row.nama,
          sekolah_id: sekolahByKey[row.sekolah].id,
          username: row.username,
          password_hash: hashDemo.password_hash, password_salt: hashDemo.password_salt,
          status: 'aktif', diinput_oleh: 'seed', dibuat_pada: waktu
        });
      });
      write('teachers', teachers);

      /* --- 2 pelatih ekskul (data, tanpa akun login) --- */
      var coaches = read('coaches');
      PELATIH.forEach(function (row) {
        coaches.push({
          id: uid('coaches'), nama: row.nama, kontak: row.kontak,
          sekolah_ids: row.sekolah.map(function (k) { return sekolahByKey[k].id; }),
          diinput_oleh: 'seed', dibuat_pada: waktu
        });
      });
      write('coaches', coaches);

      /* --- 15 siswa/siswi dengan akun login, ID EKS-001..EKS-015 --- */
      var students = read('students');
      var assessments = read('assessments');
      var attendance = read('attendance');
      var byName = {};

      var maxLama = 0;
      students.forEach(function (s) {
        var m = /^EKS-(\d+)$/.exec(String(s.id_siswa || ''));
        if (m) maxLama = Math.max(maxLama, Number(m[1]));
      });

      SISWA.forEach(function (row, idx) {
        var siswa = {
          id: uid('students'),
          id_siswa: nextIdSiswa(maxLama + idx + 1),
          nama: row.nama, kelas: row.kelas, jk: row.jk, usia: row.usia,
          sekolah_id: sekolahByKey[row.sekolah].id,
          username: row.username,
          password_hash: hashSiswa.password_hash, password_salt: hashSiswa.password_salt,
          status: 'aktif', diinput_oleh: 'seed', dibuat_pada: waktu
        };
        students.push(siswa);
        byName[row.nama] = siswa;

        // Penilaian 5 sesi mingguan (tren naik/turun/stabil).
        TANGGAL_SESI.forEach(function (mundur, sesi) {
          var nilai = nilaiSesi(row.dasar, row.trend, sesi);
          assessments.push({
            id: uid('assessments'), siswa_id: siswa.id, tanggal: hariLalu(mundur),
            values: nilai.values, kedisiplinan: nilai.kedisiplinan,
            catatan: 'Latihan rutin (data contoh)', diinput_oleh: 'seed',
            dibuat_pada: waktu
          });
        });

        // Absensi 8 pertemuan, mayoritas Hadir dengan variasi ringan.
        TANGGAL_ABSEN.forEach(function (mundur, i) {
          var status = 'Hadir';
          var code = (idx + 1) * 13 + i * 7;
          if (code % 17 === 0) status = 'Tidak Hadir';
          else if (code % 13 === 0) status = 'Sakit';
          else if (code % 11 === 0) status = 'Izin';
          attendance.push({
            id: uid('attendance'), siswa_id: siswa.id, tanggal: hariLalu(mundur),
            status: status, jam_mulai: '16:00', jam_selesai: '18:00',
            alasan: status === 'Hadir' ? '' : status + ' (contoh)',
            diinput_oleh: 'seed', dibuat_pada: waktu
          });
        });
      });
      write('students', students);
      write('assessments', assessments);
      write('attendance', attendance);
      sinkronkanSeqSiswa();

      /* --- 7 pertandingan contoh --- */
      var matches = read('matches');
      var lomba = [
        {
          nomor: 'TP-D1', mundur: 5, turnamen: 'Kejuaraan Pelajar Surabaya', kategori: 'Tunggal Putra',
          lawan: 'SMP Harapan Jaya', hasil: 'Menang', peserta: ['Budi Santoso'], skor: ['21-17', '21-15']
        },
        {
          nomor: 'TP-D2', mundur: 4, turnamen: 'Kejuaraan Pelajar Surabaya', kategori: 'Tunggal Putri',
          lawan: 'SMP Melati', hasil: 'Kalah', peserta: ['Siti Aminah'], skor: ['19-21', '18-21']
        },
        {
          nomor: 'GP-D3', mundur: 2, turnamen: 'Liga Bulutangkis Jatim', kategori: 'Ganda Campuran',
          lawan: 'SMP Melati', hasil: 'Menang', peserta: ['Rina Amelia', 'Doni Kurniawan'], skor: ['21-18', '17-21', '21-19']
        },
        {
          nomor: 'TP-D4', mundur: 9, turnamen: 'Kejuaraan Pelajar Surabaya', kategori: 'Tunggal Putra',
          lawan: 'SMP Cempaka', hasil: 'Menang', peserta: ['Rizky Ramadhan'], skor: ['21-12', '21-19']
        },
        {
          nomor: 'GP-D5', mundur: 7, turnamen: 'Turnamen Persahabatan Surabaya', kategori: 'Ganda Putri',
          lawan: 'SMP Cempaka', hasil: 'Kalah', peserta: ['Maya Puspita', 'Nabila Putri'], skor: ['18-21', '21-19', '19-21']
        },
        {
          nomor: 'TP-D6', mundur: 12, turnamen: 'Kejuaraan Kota Surabaya', kategori: 'Tunggal Putri',
          lawan: 'SMP Harapan Jaya', hasil: 'Menang', peserta: ['Dewi Larasati'], skor: ['21-14', '21-16']
        },
        {
          nomor: 'GP-D7', mundur: 10, turnamen: 'Turnamen Persahabatan Surabaya', kategori: 'Ganda Putra',
          lawan: 'SMP Melati', hasil: 'Menang', peserta: ['Fajar Nugroho', 'Yoga Permana'], skor: ['21-15', '21-18']
        }
      ];
      lomba.forEach(function (row) {
        matches.push({
          id: uid('matches'), nomor: row.nomor, tanggal: hariLalu(row.mundur),
          turnamen: row.turnamen, kategori: row.kategori, lawan: row.lawan,
          hasil: row.hasil,
          siswa_ids: row.peserta.map(function (n) { return byName[n].id; }),
          skor_sets: row.skor, catatan: 'Data contoh', diinput_oleh: 'seed',
          dibuat_pada: waktu
        });
      });
      write('matches', matches);

      localStorage.setItem(FLAG_VERSI, '1');
      return { sudah: false, akun: daftarAkun() };
    });
  }

  function daftarAkun() {
    var akun = [];
    SEKOLAH.forEach(function (s) {
      akun.push({ peran: 'Sekolah', nama: s.nama, username: s.username, password: 'demo1234' });
    });
    GURU.forEach(function (g) {
      akun.push({ peran: 'Guru', nama: g.nama, username: g.username, password: 'demo1234' });
    });
    SISWA.forEach(function (s) {
      akun.push({ peran: 'Siswa', nama: s.nama, username: s.username, password: 'siswa1234' });
    });
    return akun;
  }

  return { muat: muat, daftarAkun: daftarAkun };
})();

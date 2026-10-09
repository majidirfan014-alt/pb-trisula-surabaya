var Kemajuan = (function () {

  /* ======================================================================
     Panil "Perkembangan Teknik" & "Perkembangan Fisik"

     - Nilai input pelatih tetap skala 1-10.
     - Persentase = (nilai / 10) * 100, dibulatkan ke bilangan bulat.
     - Persentase per minggu = rata-rata persentase harian dalam minggu itu.
     - Persentase per bulan = rata-rata persentase mingguan dalam bulan itu.
     - Periode tanpa data ditampilkan "-" (bukan 0%).
     - Tidak ada grafik garis/batang/radar sama sekali.
     ====================================================================== */

  var ASPEK = {
    teknik: {
      judul: 'Perkembangan Teknik',
      ikon: 'star',
      labelKosong: 'teknik'
    },
    fisik: {
      judul: 'Perkembangan Fisik',
      ikon: 'target',
      labelKosong: 'fisik'
    }
  };

  // Daftar aspek diambil dari master parameter (id_parameter) supaya penambahan,
  // penggantian nama, penonaktifan, dan penghapusan parameter langsung terlihat.
  // Parameter nonaktif / terhapus tetap tampil bila masih punya data lama.
  function daftarAspek(entri, jenis) {
    var punyaData = {};
    (entri || []).forEach(function (e) {
      if (!e) return;
      if (e.kategori !== jenis) return;
      var k = e.id_parameter || e.nama_parameter;
      if (!k) return;
      punyaData[k] = e.nama_parameter || k;
    });
    var out = [];
    var terpakai = {};
    Store.all('log_parameters').forEach(function (p) {
      if (p.kategori !== jenis) return;
      var k = p.id || p.nama;
      if (!k) return;
      if (!p.aktif && punyaData[k] === undefined) return;
      out.push({ id: k, nama: p.nama || k, satuan: p.satuan || 'skala 1-10', aktif: !!p.aktif });
      terpakai[k] = true;
    });
    Object.keys(punyaData).forEach(function (k) {
      if (terpakai[k]) return;
      out.push({ id: k, nama: punyaData[k], satuan: 'skala 1-10', aktif: false });
    });
    return out;
  }

  var FISIK_NAMA = ['Kecepatan', 'Kekuatan', 'Daya Tahan', 'Fleksibilitas'];

  var PERIODE = [
    { id: 'harian', label: 'Harian', pembanding: 'dari kemarin', satuan: 'hari ini', maks: 10, labelKolom: 'Tanggal' },
    { id: 'mingguan', label: 'Mingguan', pembanding: 'dari minggu lalu', satuan: 'minggu ini', maks: 8, labelKolom: 'Minggu' },
    { id: 'bulanan', label: 'Bulanan', pembanding: 'dari bulan lalu', satuan: 'bulan ini', maks: 6, labelKolom: 'Bulan' }
  ];

  var NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var HARI_PENDEK = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  /* ============================ perhitungan ============================ */

  // Skala 1-10 -> persen bulat (0-100). Nilai kosong/tidak valid -> null.
  function persen(nilai) {
    if (nilai === null || nilai === undefined || nilai === '') return null;
    var n = Number(nilai);
    if (isNaN(n)) return null;
    return Math.round((n / 10) * 100);
  }

  // Rata-rata nilai mentah (tanpa pembulatan) -> dipakai sebelum konversi ke %.
  function rataNilai(list) {
    var isi = [];
    (list || []).forEach(function (v) {
      var n = Number(v);
      if (!isNaN(n)) isi.push(n);
    });
    if (!isi.length) return null;
    var jumlah = 0;
    isi.forEach(function (v) {
      jumlah += v;
    });
    return jumlah / isi.length;
  }

  // Rata-rata daftar persen -> bilangan bulat, atau null bila kosong.
  function rataRata(list) {
    var isi = [];
    (list || []).forEach(function (v) {
      if (typeof v === 'number' && !isNaN(v)) isi.push(v);
    });
    if (!isi.length) return null;
    var jumlah = 0;
    isi.forEach(function (v) {
      jumlah += v;
    });
    return Math.round(jumlah / isi.length);
  }

  function seninDari(iso) {
    var d = Utils.parseISO(iso);
    var hari = d.getDay();
    d.setDate(d.getDate() + (hari === 0 ? -6 : 1 - hari));
    return Utils.toISODate(d);
  }

  function kunciBulan(iso) {
    return String(iso).slice(0, 7);
  }

  // 1) Persentase harian per aspek: { tanggal: { idParameter: persen } }
  //    Kunci memakai id_parameter (bukan nama) supaya data tetap tersambung
  //    walau nama parameter diganti oleh pelatih kepala.
  function hitungHarian(entri) {
    var kumpul = {};
    (entri || []).forEach(function (e) {
      if (!e || !e.tanggal) return;
      var aspek = e.id_parameter || e.nama_parameter;
      if (!aspek) return;
      var n = Number(e.nilai);
      if (isNaN(n)) return;
      var k = e.tanggal + '|' + aspek;
      if (!kumpul[k]) kumpul[k] = [];
      kumpul[k].push(n);
    });
    var hasil = {};
    Object.keys(kumpul).forEach(function (k) {
      var potong = k.split('|');
      var tgl = potong[0];
      var aspek = potong.slice(1).join('|');
      if (!hasil[tgl]) hasil[tgl] = {};
      hasil[tgl][aspek] = persen(rataNilai(kumpul[k]));
    });
    return hasil;
  }

  // 2) Persentase mingguan: rata-rata persentase harian dalam minggu (Senin-Minggu).
  function hitungMingguan(harian) {
    var kumpul = {};
    Object.keys(harian || {}).forEach(function (tgl) {
      var senin = seninDari(tgl);
      if (!kumpul[senin]) kumpul[senin] = {};
      var isi = harian[tgl];
      Object.keys(isi).forEach(function (aspek) {
        if (!kumpul[senin][aspek]) kumpul[senin][aspek] = [];
        kumpul[senin][aspek].push(isi[aspek]);
      });
    });
    var hasil = {};
    Object.keys(kumpul).forEach(function (senin) {
      hasil[senin] = {};
      Object.keys(kumpul[senin]).forEach(function (aspek) {
        hasil[senin][aspek] = rataRata(kumpul[senin][aspek]);
      });
    });
    return hasil;
  }

  // 3) Persentase bulanan: rata-rata persentase mingguan dalam bulan itu.
  function hitungBulanan(mingguan) {
    var kumpul = {};
    Object.keys(mingguan || {}).forEach(function (senin) {
      var bulan = kunciBulan(senin);
      if (!kumpul[bulan]) kumpul[bulan] = {};
      var isi = mingguan[senin];
      Object.keys(isi).forEach(function (aspek) {
        if (!kumpul[bulan][aspek]) kumpul[bulan][aspek] = [];
        kumpul[bulan][aspek].push(isi[aspek]);
      });
    });
    var hasil = {};
    Object.keys(kumpul).forEach(function (bulan) {
      hasil[bulan] = {};
      Object.keys(kumpul[bulan]).forEach(function (aspek) {
        hasil[bulan][aspek] = rataRata(kumpul[bulan][aspek]);
      });
    });
    return hasil;
  }

  // Kategori warna + label untuk orang tua.
  function kategori(persenNilai) {
    if (persenNilai === null || persenNilai === undefined) return null;
    if (persenNilai >= 80) return { label: 'Sangat Baik', kelas: 'kat-hijau' };
    if (persenNilai >= 60) return { label: 'Baik', kelas: 'kat-biru' };
    if (persenNilai >= 40) return { label: 'Cukup', kelas: 'kat-kuning' };
    return { label: 'Perlu Ditingkatkan', kelas: 'kat-merah' };
  }

  // Model siap tampil untuk satu jenis aspek + satu mode periode.
  function bangunModel(entri, jenis, modePeriode) {
    var daftar = daftarAspek(entri, jenis);
    var harian = hitungHarian(entri);
    var mingguan = hitungMingguan(harian);
    var bulanan = hitungBulanan(mingguan);

    var sumber, kunciList;
    if (modePeriode === 'harian') {
      sumber = harian;
      kunciList = Object.keys(harian).sort();
    } else if (modePeriode === 'bulanan') {
      sumber = bulanan;
      kunciList = Object.keys(bulanan).sort();
    } else {
      sumber = mingguan;
      kunciList = Object.keys(mingguan).sort();
    }

    var info = PERIODE.filter(function (p) {
      return p.id === (modePeriode || 'mingguan');
    })[0] || PERIODE[1];

    var tampil = kunciList.slice(Math.max(0, kunciList.length - info.maks));
    var kunciKini = kunciList.length ? kunciList[kunciList.length - 1] : null;
    var kunciLalu = kunciList.length > 1 ? kunciList[kunciList.length - 2] : null;

    function nilaiPada(kunci, aspek) {
      if (!kunci || !sumber[kunci]) return null;
      var v = sumber[kunci][aspek];
      return (typeof v === 'number') ? v : null;
    }

    var baris = daftar.map(function (aspek) {
      var kini = nilaiPada(kunciKini, aspek.id);
      var lalu = nilaiPada(kunciLalu, aspek.id);
      var delta = (kini === null || lalu === null) ? null : kini - lalu;
      return {
        id: aspek.id,
        aspek: aspek.nama,
        satuan: aspek.satuan,
        aktif: aspek.aktif,
        nilai: kini,
        sebelum: lalu,
        delta: delta,
        kategori: kategori(kini)
      };
    });

    var nilaiKini = baris.map(function (b) {
      return b.nilai;
    });
    var nilaiLalu = baris.map(function (b) {
      return b.sebelum;
    });
    var rataKini = rataRata(nilaiKini);
    var rataLalu = rataRata(nilaiLalu);

    return {
      jenis: jenis,
      mode: info.id,
      labelPeriode: info.label,
      pembanding: info.pembanding,
      satuanPeriode: info.satuan,
      labelKolom: info.labelKolom,
      kunciKini: kunciKini,
      kunciLalu: kunciLalu,
      daftarKunci: tampil,
      sumber: sumber,
      baris: baris,
      rataKini: rataKini,
      rataLalu: rataLalu,
      delta: (rataKini === null || rataLalu === null) ? null : rataKini - rataLalu,
      kategoriRata: kategori(rataKini),
      harian: harian,
      mingguan: mingguan,
      bulanan: bulanan
    };
  }

  function labelKunci(kunci, mode) {
    if (!kunci) return '-';
    if (mode === 'harian') {
      var d = Utils.parseISO(kunci);
      return HARI_PENDEK[d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth() + 1);
    }
    if (mode === 'bulanan') {
      var bagian = kunci.split('-');
      return NAMA_BULAN[Number(bagian[1]) - 1] + ' ' + bagian[0];
    }
    var awal = Utils.parseISO(kunci);
    return 'Mgg ' + awal.getDate() + '/' + (awal.getMonth() + 1);
  }

  function labelKunciPanjang(kunci, mode) {
    if (!kunci) return '-';
    if (mode === 'harian') return Utils.fmtDate(kunci, true);
    if (mode === 'bulanan') {
      var bagian = kunci.split('-');
      return NAMA_BULAN[Number(bagian[1]) - 1] + ' ' + bagian[0];
    }
    var akhir = Utils.addDaysISO(kunci, 6);
    return Utils.fmtDate(kunci) + ' s.d. ' + Utils.fmtDate(akhir);
  }

  /* ============================ tampilan ============================ */

  function teksDelta(delta, pembanding, panjang) {
    if (delta === null || delta === undefined) {
      return { kelas: 'ku-tetap', teks: '&#9679; belum ada pembanding' };
    }
    if (delta > 0) {
      return { kelas: 'ku-naik', teks: '&#9650; +' + delta + '%' + (panjang ? ' ' + pembanding : '') };
    }
    if (delta < 0) {
      return { kelas: 'ku-turun', teks: '&#9660; ' + delta + '%' + (panjang ? ' ' + pembanding : '') };
    }
    return { kelas: 'ku-tetap', teks: '&#9679; tetap' + (panjang ? ' ' + pembanding : '') };
  }

  function kalimatRingkas(m) {
    var ada = m.baris.filter(function (b) {
      return b.nilai !== null;
    });
    if (!ada.length) {
      return 'Belum ada data ' + m.satuanPeriode + '. Nilai akan muncul setelah pelatih mengisi penilaian.';
    }
    var kuat = ada[0];
    var lemah = ada[0];
    ada.forEach(function (b) {
      if (b.nilai > kuat.nilai) kuat = b;
      if (b.nilai < lemah.nilai) lemah = b;
    });
    var kalimat = ['Aspek terkuat ' + m.satuanPeriode + ': ' + kuat.aspek + ' (' + kuat.nilai + '%).'];
    if (lemah.aspek !== kuat.aspek) {
      var kat = kategori(lemah.nilai);
      var perlu = kat && (kat.label === 'Cukup' || kat.label === 'Perlu Ditingkatkan');
      kalimat.push('Aspek yang perlu ditingkatkan: ' + lemah.aspek + ' (' + lemah.nilai + '%).');
      if (!perlu) kalimat[kalimat.length - 1] = 'Aspek terendah ' + m.satuanPeriode + ': ' + lemah.aspek + ' (' + lemah.nilai + '%).';
    }
    return kalimat.join(' ');
  }

  function barisHtml(b) {
    var kat = b.kategori;
    var d = teksDelta(b.delta, '', false);
    var lebar = b.nilai === null ? 0 : Math.max(0, Math.min(100, b.nilai));
    return '<div class="ku-baris">' +
      '<div class="ku-baris-atas">' +
      '<span class="ku-nama">' + Utils.esc(b.aspek) +
      '<span class="ku-satuan">' + Utils.esc(b.satuan || 'skala 1-10') + '</span></span>' +
      '<span class="ku-kanan">' +
      (kat ? '<span class="ku-kat-badge ' + kat.kelas + '">' + Utils.esc(kat.label) + '</span>' : '') +
      '<span class="ku-persen ' + (kat ? kat.kelas : '') + '">' + (b.nilai === null ? '-' : b.nilai + '%') + '</span>' +
      '</span></div>' +
      '<div class="ku-track" role="img" aria-label="' + Utils.esc(b.aspek) + ' ' + (b.nilai === null ? 'belum ada data' : b.nilai + ' persen') + '">' +
      '<div class="ku-isi ' + (kat ? kat.kelas : '') + '" style="width:' + lebar + '%"></div>' +
      '</div>' +
      '<div class="ku-baris-bawah"><span class="ku-delta ' + d.kelas + '">' + d.teks + '</span></div>' +
      '</div>';
  }

  function tabelHtml(m) {
    if (!m.daftarKunci.length) {
      return UI.emptyState('Belum ada data logbook untuk ditampilkan.', 'clipboard');
    }
    var kepala = '<tr><th>Aspek</th>' + m.daftarKunci.map(function (k) {
      return '<th>' + Utils.esc(labelKunci(k, m.mode)) + '</th>';
    }).join('') + '</tr>';
    var isi = (m.baris || []).map(function (b) {
      return '<tr><th class="ku-th-nama">' + Utils.esc(b.aspek) +
        '<div class="small muted">skala 1-10</div></th>' + m.daftarKunci.map(function (k) {
          var v = (m.sumber[k] || {})[b.id];
          var kat = kategori(v);
          return '<td class="align-center">' + (v === null || v === undefined
            ? '<span class="ku-kosong">-</span>'
            : '<span class="ku-sel ' + kat.kelas + '">' + v + '%</span>') + '</td>';
        }).join('') + '</tr>';
    }).join('');
    return '<div class="table-wrap"><table class="table ku-tabel"><thead>' + kepala + '</thead><tbody>' + isi + '</tbody></table></div>' +
      '<p class="small muted mt-2">Satuan asli penilaian: <b>skala 1-10</b>. ' +
      'Persentase = nilai / 10 x 100. Rata-rata mingguan = rata-rata persentase harian dalam minggu (Senin-Minggu).</p>';
  }

  function kartuIsiHtml(m) {
    var d = teksDelta(m.delta, m.pembanding, true);
    return '<div class="ku-ringkas">' +
      '<div class="ku-angka ' + (m.kategoriRata ? m.kategoriRata.kelas : '') + '">' +
      (m.rataKini === null ? '-' : m.rataKini + '%') + '</div>' +
      '<div class="ku-ringkas-isi">' +
      '<div class="ku-kat-baris">' +
      (m.kategoriRata ? '<span class="ku-kat-badge ' + m.kategoriRata.kelas + '">' + Utils.esc(m.kategoriRata.label) + '</span>' : '<span class="ku-kat-badge">Belum dinilai</span>') +
      '<span class="ku-delta ' + d.kelas + '">' + d.teks + '</span>' +
      '</div>' +
      '<div class="ku-kecil">Rata-rata seluruh aspek, ' + Utils.esc(m.satuanPeriode) + '</div>' +
      '</div></div>' +
      '<p class="ku-kalimat">' + Utils.esc(kalimatRingkas(m)) + '</p>' +
      '<div class="ku-daftar">' + (m.baris.length ? m.baris.map(barisHtml).join('') : UI.emptyState('Belum ada aspek yang dinilai.', 'info')) + '</div>' +
      '<h4 class="mt-3">Riwayat Persentase</h4>' +
      '<p class="small muted">Kolom = ' + Utils.esc(m.labelPeriode.toLowerCase()) + '. Tanda "-" berarti belum ada penilaian.</p>' +
      tabelHtml(m);
  }

  function tabHtml(jenis, mode) {
    return '<div class="tabs" role="tablist">' + PERIODE.map(function (p) {
      return '<button type="button" class="tab' + (p.id === mode ? ' active' : '') +
        '" data-ku-tab="' + jenis + '" data-periode="' + p.id + '" role="tab">' +
        Utils.esc(p.label) + '</button>';
    }).join('') + '</div>';
  }

  function kosongHtml(jenis) {
    var nama = (ASPEK[jenis] || {}).labelKosong || jenis;
    return '<div class="empty-state">' + UI.icon('info', 36) +
      '<p class="fw-bold">Belum ada data logbook</p>' +
      '<p class="small">Penilaian ' + Utils.esc(nama) + ' akan muncul di sini setelah pelatih mengisi logbook latihan.</p></div>';
  }

  /* ============================ render utama ============================ */

  // opts: { idAtlet, data (opsional, dipakai untuk pratinjau/demo), jenis (opsional) }
  function render(host, opts) {
    opts = opts || {};
    if (!host) return null;
    if (!host.__ku) {
      host.__ku = { mode: { teknik: 'mingguan', fisik: 'mingguan' }, terikat: false };
    }
    var mode = host.__ku.mode;
    var jenisTampil = opts.jenis ? [opts.jenis] : ['teknik', 'fisik'];
    var data = [];

    function muat() {
      if (!opts.data && opts.skipSeed !== true && opts.idAtlet) {
        try {
          var u = (typeof App !== 'undefined' && App && App.user) ? App.user() : null;
          isiDataContoh(u ? u.id : '', opts.idAtlet);
        } catch (e) {}
      }
      data = opts.data ? opts.data.slice() : ambilData(opts.idAtlet);
      return data;
    }

    host.innerHTML = jenisTampil.map(function (j) {
      return '<div class="card" data-ku-kartu="' + j + '">' +
        '<div class="card-title">' + UI.icon(ASPEK[j].ikon, 20) + Utils.esc(ASPEK[j].judul) + '</div>' +
        '<div data-ku-isi="' + j + '"></div>' +
        '</div>';
    }).join('');

    function segarkan(j) {
      var target = host.querySelector('[data-ku-isi="' + j + '"]');
      if (!target) return;
      var m = bangunModel(data, j, mode[j]);
      target.innerHTML = tabHtml(j, mode[j]) +
        (m.daftarKunci.length ? kartuIsiHtml(m) : kosongHtml(j));
    }

    function segarkanSemua() {
      muat();
      jenisTampil.forEach(segarkan);
    }

    if (!host.__ku.terikat) {
      host.__ku.terikat = true;
      host.addEventListener('click', function (e) {
        var tab = e.target.closest ? e.target.closest('[data-ku-tab]') : null;
        if (!tab) return;
        var j = tab.getAttribute('data-ku-tab');
        var p = tab.getAttribute('data-periode');
        if (!j || !p || !mode[j] || mode[j] === p) return;
        mode[j] = p;
        segarkan(j);
      });
    }

    segarkanSemua();
    return {
      segarkan: segarkanSemua,
      segarkanSatu: segarkan
    };
  }

  function ambilData(idAtlet) {
    return Shared.entriesFor(idAtlet || '').map(function (e) {
      return {
        tanggal: e.tanggal,
        id_parameter: e.id_parameter,
        nama_parameter: Shared.namaParameter(e),
        kategori: e.kategori,
        satuan: Shared.satuanParameter(e),
        nilai: e.nilai
      };
    });
  }

  /* ============================ data contoh ============================ */

  var CONTOH_FLAG = 'kemajuan_demo';
  var CONTOH_NILAI = {
    // [nilai awal, kenaikan per minggu] supaya terlihat tren naik
    'Footwork': [6, 4], 'Forehand': [7, 3], 'Backhand': [5, 3], 'Serve': [6, 4],
    'Dropshot': [5, 4], 'Smash': [8, 2], 'Netting': [6, 3],
    'Kecepatan': [6, 3], 'Kekuatan': [7, 2], 'Daya Tahan': [5, 4], 'Fleksibilitas': [6, 2]
  };

  function sudahContoh(idAtlet) {
    try {
      return localStorage.getItem(CONFIG.PREFIX + CONTOH_FLAG + '_' + (idAtlet || 'umum')) === '1';
    } catch (e) {
      return true;
    }
  }

  function tandaiContoh(idAtlet) {
    try {
      localStorage.setItem(CONFIG.PREFIX + CONTOH_FLAG + '_' + (idAtlet || 'umum'), '1');
    } catch (e) {}
  }

  // Mengisi data contoh sekali jalan per atlet supaya panil langsung bisa dicoba.
  // Hanya mengisi tanggal/aspek yang belum punya penilaian (tidak menimpa data asli)
  // dan selalu memakai id_parameter asli dari master, agar tidak membuat aspek ganda.
  function isiDataContoh(userId, idAtlet) {
    if (!idAtlet || sudahContoh(idAtlet)) return false;
    var master = {};
    Store.all('log_parameters').forEach(function (p) {
      if (p && p.id && p.nama) master[p.nama] = p;
    });
    var sudah = {};
    Store.all('logbook_entries').forEach(function (e) {
      sudah[e.id_atlet + '|' + e.tanggal + '|' + (e.id_parameter || e.nama_parameter)] = true;
    });

    var seninIni = seninDari(Utils.todayISO());
    var jumlahMinggu = 6;
    var n = 0;
    for (var w = jumlahMinggu - 1; w >= 0; w--) {
      var senin = Utils.addDaysISO(seninIni, -7 * w);
      [0, 2, 4].forEach(function (geser, si) {
        var tgl = Utils.addDaysISO(senin, geser);
        Object.keys(CONTOH_NILAI).forEach(function (nama, ki) {
          var p = master[nama];
          if (!p) return;
          if (sudah[idAtlet + '|' + tgl + '|' + p.id]) return;
          var dasar = CONTOH_NILAI[nama][0];
          var naik = CONTOH_NILAI[nama][1];
          var tahap = jumlahMinggu - 1 - w;
          var nilai = dasar + Math.round(tahap * naik / 2) + ((ki + si) % 2);
          if (nilai < 1) nilai = 1;
          if (nilai > 10) nilai = 10;
          Store.insert('logbook_entries', {
            id_atlet: idAtlet,
            tanggal: tgl,
            id_parameter: p.id,
            nama_parameter: p.nama,
            satuan: p.satuan,
            kategori: p.kategori,
            nilai: nilai,
            catatan: '',
            input_oleh: userId || '',
            input_peran: ''
          });
          n++;
        });
      });
    }

    tandaiContoh(idAtlet);
    return n > 0;
  }

  return {
    render: render,
    ASPEK: ASPEK,
    PERIODE: PERIODE,
    persen: persen,
    rataRata: rataRata,
    seninDari: seninDari,
    hitungHarian: hitungHarian,
    hitungMingguan: hitungMingguan,
    hitungBulanan: hitungBulanan,
    kategori: kategori,
    daftarAspek: daftarAspek,
    bangunModel: bangunModel,
    kalimatRingkas: kalimatRingkas,
    ambilData: ambilData,
    isiDataContoh: isiDataContoh
  };
})();

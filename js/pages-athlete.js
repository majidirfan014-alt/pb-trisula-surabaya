var PagesAthlete = (function () {

  /* ======================================================================
     Util minggu & grafik (khusus tampilan role Atlet)

     Aturan sumbu yang berlaku untuk SEMUA grafik role Atlet:
     - Sumbu Y: angka, selalu mulai dari 0, batas atas dibulatkan ke angka
       rapi dengan langkah yang sesuai satuan, disertai judul + satuan.
     - Sumbu X: per minggu ("Minggu 1", "Minggu 2", ... / "Mgg 1" di layar
       sempit). Rentang tanggal Senin-Minggu tampil di tooltip.
     - Beberapa data dalam satu minggu digabung (rata-rata / jumlah) dan
       cara penggabungannya disebutkan di keterangan grafik.
     - Minggu tanpa data dilewati (null + spanGaps), tidak digambar sebagai 0.
     ====================================================================== */

  function seninDari(iso) {
    var d = Utils.parseISO(iso);
    var hari = d.getDay();
    d.setDate(d.getDate() + (hari === 0 ? -6 : 1 - hari));
    return Utils.toISODate(d);
  }

  // Peta minggu dari daftar tanggal. Minggu kosong di antara minggu berdata
  // tetap disertakan supaya sumbu X berurutan dan titiknya bisa dikosongkan.
  function buatPetaMinggu(tanggalList) {
    var kumpul = {};
    (tanggalList || []).forEach(function (t) {
      if (!t) return;
      kumpul[seninDari(t)] = true;
    });
    var seninList = Object.keys(kumpul).sort();
    var peta = {};
    if (seninList.length) {
      var isi = seninList.slice();
      var kurir = isi[0];
      while (kurir < isi[isi.length - 1]) {
        kurir = Utils.addDaysISO(kurir, 7);
        if (kurir <= isi[isi.length - 1] && isi.indexOf(kurir) === -1) isi.push(kurir);
      }
      isi.sort();
      isi.forEach(function (s, i) {
        var akhir = Utils.addDaysISO(s, 6);
        peta[s] = {
          nomor: i + 1,
          mulai: s,
          akhir: akhir,
          label: 'Minggu ' + (i + 1),
          judul: 'Minggu ke-' + (i + 1) + ' (' + Utils.fmtDate(s) + ' s.d. ' + Utils.fmtDate(akhir) + ')'
        };
      });
    }
    return peta;
  }

  // Gabungkan { tanggal, nilai } per minggu. reduksi: 'rata' | 'jumlah' | 'max'
  function seriMingguan(items, peta, opsi) {
    opsi = opsi || {};
    var reduksi = opsi.reduksi || 'rata';
    var kelompok = {};
    (items || []).forEach(function (it) {
      if (!it || !it.tanggal) return;
      var v = Number(it.nilai);
      if (isNaN(v)) return;
      var s = seninDari(it.tanggal);
      if (!kelompok[s]) kelompok[s] = [];
      kelompok[s].push(v);
    });
    var labels = [], judul = [], data = [], minggu = [];
    Object.keys(peta).sort().forEach(function (s) {
      var info = peta[s];
      labels.push(info.label);
      judul.push(info.judul);
      minggu.push(s);
      var nilai = kelompok[s];
      if (!nilai || !nilai.length) {
        data.push(null);
        return;
      }
      var total = nilai.reduce(function (a, b) {
        return a + b;
      }, 0);
      data.push(reduksi === 'jumlah' ? total
        : reduksi === 'max' ? Math.max.apply(null, nilai)
          : Math.round((total / nilai.length) * 10) / 10);
    });
    return { labels: labels, judul: judul, data: data, minggu: minggu };
  }

  // Hitung item per minggu untuk beberapa kelompok sekaligus.
  // opsi.grup: { nama: fn(item) -> boolean }. Minggu tanpa item = null.
  function seriMingguanKelompok(items, peta, opsi) {
    opsi = opsi || {};
    var grup = opsi.grup || {};
    var hitung = {};
    (items || []).forEach(function (it) {
      if (!it || !it.tanggal) return;
      var s = seninDari(it.tanggal);
      if (!hitung[s]) hitung[s] = { ada: false };
      hitung[s].ada = true;
      Object.keys(grup).forEach(function (k) {
        if (grup[k](it)) hitung[s][k] = (hitung[s][k] || 0) + 1;
      });
    });
    var labels = [], judul = [], minggu = [], seri = {};
    Object.keys(grup).forEach(function (k) {
      seri[k] = [];
    });
    Object.keys(peta).sort().forEach(function (s) {
      var info = peta[s];
      labels.push(info.label);
      judul.push(info.judul);
      minggu.push(s);
      var baris = hitung[s];
      Object.keys(grup).forEach(function (k) {
        seri[k].push(baris && baris.ada ? (baris[k] || 0) : null);
      });
    });
    return { labels: labels, judul: judul, minggu: minggu, seri: seri };
  }

  // Batas atas sumbu Y dibulatkan ke angka rapi, selalu mulai dari 0.
  function skalaY(data, opsi) {
    opsi = opsi || {};
    var nilai = [];
    (data || []).forEach(function (v) {
      if (typeof v === 'number' && !isNaN(v)) nilai.push(v);
    });
    var terbesar = nilai.length ? Math.max.apply(null, nilai) : 0;
    var step = opsi.langkah;
    if (!step) {
      if (terbesar <= 5) step = 1;
      else if (terbesar <= 20) step = 2;
      else if (terbesar <= 50) step = 5;
      else if (terbesar <= 120) step = 10;
      else step = 20;
    }
    var maks = opsi.maks;
    if (maks === undefined || maks === null) {
      var ruang = terbesar > 0 ? terbesar + step : step * 5;
      maks = Math.ceil(ruang / step) * step;
    }
    return { min: 0, max: maks, step: step };
  }

  function semuaNilai(list) {
    return (list || []).reduce(function (acc, arr) {
      return acc.concat(arr || []);
    }, []);
  }

  function fmtAngka(v) {
    return Utils.fmtNumber(v, Math.abs(v % 1) > 0 ? 1 : 0);
  }

  function opsiSumbu(labels, judul, satuan, skala) {
    return {
      min: 0,
      max: skala.max,
      yStep: skala.step,
      yTitle: satuan ? satuan : 'Nilai',
      legendPosition: 'top',
      legendAlign: 'start',
      tickCallback: function (value, index) {
        var lbl = (this && this.getLabelForValue) ? this.getLabelForValue(value) : (labels[index] || '');
        var lebar = (this && this.chart && this.chart.width) ? this.chart.width : 1000;
        return lebar < 420 ? String(lbl).replace('Minggu', 'Mgg') : lbl;
      },
      tooltipCallbacks: {
        title: function (items) {
          if (!items.length) return '';
          return judul[items[0].dataIndex] || '';
        },
        label: function (ctx) {
          var v = ctx.parsed && ctx.parsed.y;
          return ctx.dataset.label + ': ' + (v === null || v === undefined ? 'belum ada data' : fmtAngka(v));
        }
      }
    };
  }

  // Penjelasan singkat otomatis: nilai tertinggi, nilai terbaru, dan tren.
  function penjelasanSeri(nama, data, labels, satuan) {
    var punya = [];
    for (var i = 0; i < data.length; i++) {
      if (typeof data[i] === 'number' && !isNaN(data[i])) punya.push({ i: i, v: data[i] });
    }
    if (!punya.length) return (nama ? nama + ': ' : '') + 'belum ada data untuk dirangkum.';
    var tertinggi = punya[0];
    var terendah = punya[0];
    punya.forEach(function (p) {
      if (p.v > tertinggi.v) tertinggi = p;
      if (p.v < terendah.v) terendah = p;
    });
    var terbaru = punya[punya.length - 1];
    var akhiran = satuan ? ' ' + satuan : '';
    function namaMinggu(i) {
      return (labels && labels[i]) ? labels[i] : 'minggu ke-' + (i + 1);
    }

    var potong = [];
    potong.push('tertinggi ' + fmtAngka(tertinggi.v) + akhiran + ' (' + namaMinggu(tertinggi.i) + ')');
    if (punya.length > 1 && terendah.i !== tertinggi.i) {
      potong.push('terendah ' + fmtAngka(terendah.v) + akhiran + ' (' + namaMinggu(terendah.i) + ')');
    }
    if (terbaru.i !== tertinggi.i) {
      potong.push('terbaru ' + fmtAngka(terbaru.v) + akhiran + ' (' + namaMinggu(terbaru.i) + ')');
    }
    var ambil = punya.slice(-4);
    if (ambil.length >= 2) {
      var delta = Math.round((ambil[ambil.length - 1].v - ambil[0].v) * 10) / 10;
      var arah = delta > 0 ? 'naik' : delta < 0 ? 'turun' : 'stabil';
      potong.push('tren ' + ambil.length + ' minggu terakhir ' + arah + ' (' +
        (delta > 0 ? '+' : '') + fmtAngka(delta) + akhiran + ')');
    }
    return (nama ? nama + ': ' : '') + potong.join(', ') + '.';
  }

  function kotakPenjelasan(teks, keterangan) {
    return '<div class="notice mt-2">' + UI.icon('info', 20) +
      '<div>' + Utils.esc(teks) +
      (keterangan ? '<div class="small muted mt-1">' + Utils.esc(keterangan) + '</div>' : '') +
      '</div></div>';
  }

  function grafikKosong(canvas) {
    Charts.destroy(canvas);
    if (canvas) canvas.style.display = 'none';
    var host = canvas && canvas.parentElement;
    if (!host) return;
    var fb = host.querySelector('.chart-fallback');
    if (!fb) {
      fb = document.createElement('div');
      fb.className = 'chart-fallback';
      host.appendChild(fb);
    }
    fb.textContent = 'Grafik tidak dapat dimuat.';
  }

  function gambarGaris(canvas, model, datasets, opsi) {
    return Charts.line(canvas, model.labels, datasets, opsi).catch(function () {
      grafikKosong(canvas);
    });
  }

  function gambarBatang(canvas, model, datasets, opsi) {
    return Charts.bar(canvas, model.labels, datasets, opsi).catch(function () {
      grafikKosong(canvas);
    });
  }

  function lebarScroll(host, jumlahMinggu) {
    if (!host) return;
    host.style.minWidth = jumlahMinggu > 8 ? Math.max(520, jumlahMinggu * 72) + 'px' : '';
  }

  function myAthlete(user) {
    return Store.findOne('athletes', function (a) {
      return a.id_atlet === user.id_atlet || a.user_id === user.id;
    });
  }

  /* ======================================================================
     1. Perkembangan (Beranda atlet)
     ====================================================================== */

  function home(root, user, app) {
    var athlete = myAthlete(user);
    if (!athlete) {
      root.innerHTML = '<div class="page">' + UI.emptyState('Data atlet tidak ditemukan. Hubungi pelatih kepala.', 'alert') + '</div>';
      return;
    }

    root.innerHTML =
      '<div class="page">' +
      UI.pageHeader('Perkembangan Saya', 'Halo, ' + athlete.nama + '. Berikut perkembangan latihan Anda.') +
      '<div class="stat-grid" id="at-stats"></div>' +
      '<div id="at-kemajuan"></div>' +
      '<div class="card mt-2">' +
      '<div class="card-title">' + UI.icon('clipboard', 20) + 'Program Latihan</div>' +
      '<p class="small muted">Program yang dijalankan pada tiap sesi latihan (baca-saja).</p>' +
      '<div id="at-program"></div>' +
      '</div>' +
      '<div class="card mt-2">' +
      '<div class="card-title">' + UI.icon('clipboard', 20) + 'Catatan dari Pelatih</div>' +
      '<div id="at-notes"></div>' +
      '</div></div>';

    var page = root.querySelector('.page');
    var panel = Kemajuan.render(page.querySelector('#at-kemajuan'), { idAtlet: athlete.id_atlet });

    function refresh() {
      var rate = Shared.attendanceRate(athlete.id_atlet, 30);
      var t = Shared.trend(athlete.id_atlet, 30);
      var matches = Shared.matchesFor(athlete.id_atlet);
      var menang = matches.filter(function (m) {
        return m.hasil === 'Menang';
      }).length;

      page.querySelector('#at-stats').innerHTML =
        UI.statCard('Kehadiran 30 Hari', rate === null ? '-' : rate + '%', rate !== null && rate < 75 ? 'perlu ditingkatkan' : 'bagus, pertahankan', 'calendar', rate !== null && rate < 75 ? 'warn' : 'ok') +
        UI.statCard('Tren Latihan', t ? t.label : '-', t ? 'dibanding periode sebelumnya' : 'belum cukup data', 'activity', t && t.tone === 'ok' ? 'ok' : t && t.tone === 'danger' ? 'danger' : 'primary') +
        UI.statCard('Total Pertandingan', matches.length, menang + ' menang / ' + (matches.length - menang) + ' kalah', 'trophy', 'blue') +
        UI.statCard('Tes Fisik', Shared.latestTests(athlete.id_atlet).length + ' jenis', 'hasil terakhir tercatat', 'target', 'primary');

      var programHost = page.querySelector('#at-program');
      if (programHost) {
        var sesi = Shared.programAtlet(athlete.id_atlet).slice(0, 10);
        programHost.innerHTML = sesi.length
          ? '<div class="list-rows">' + sesi.map(function (s) {
            return '<div class="list-row"><div class="grow">' +
              '<b>' + Utils.esc(s.program) + '</b>' +
              '<span>' + Utils.esc(s.kategori === 'fisik' ? 'Fisik' : s.kategori === 'teknik' ? 'Teknik' : 'Umum') + '</span>' +
              '<div class="small muted">' + Utils.fmtDate(s.tanggal, true) +
              (s.catatan ? ' / ' + Utils.esc(s.catatan) : '') +
              ' / dari ' + Utils.esc(s.penginput) + '</div></div></div>';
          }).join('') + '</div>'
          : UI.emptyState('Belum ada program latihan yang tercatat.', 'clipboard');
      }

      var notes = Shared.catatanAtlet(athlete.id_atlet).slice(0, 8);
      var noteHost = page.querySelector('#at-notes');
      noteHost.innerHTML = notes.length ? '<div class="list-rows">' + notes.map(function (n) {
        return '<div class="list-row"><div class="grow"><b>' + Utils.esc(Shared.namaParameter(n)) + ' / ' + Utils.esc(n.nilai) + '</b>' +
          '<span>' + Utils.esc(n.catatan) + '</span>' +
          '<div class="small muted">' + Utils.fmtDate(n.tanggal, true) + ' / dari ' + Utils.esc(Shared.labelPenginput(n)) + '</div></div></div>';
      }).join('') + '</div>' : UI.emptyState('Belum ada catatan dari pelatih.', 'clipboard');

      if (panel && panel.segarkan) panel.segarkan();
    }

    refresh();

    // Sinkronisasi realtime: perubahan dari tab lain / fokus kembali ke halaman.
    function saatFokus() {
      if (document.hidden) return;
      if (!document.body || !document.body.contains(page)) return;
      refresh();
    }
    document.addEventListener('visibilitychange', saatFokus);
    window.addEventListener('focus', saatFokus);

    app.subscribe('logbook_entries', refresh);
    app.subscribe('attendance', refresh);
    app.subscribe('matches', refresh);
    app.subscribe('physical_tests', refresh);
    app.subscribe('log_parameters', refresh);
  }

  function tesSaya(root, user, app) {
    var athlete = myAthlete(user);
    if (!athlete) {
      root.innerHTML = '<div class="page">' + UI.emptyState('Data atlet tidak ditemukan.', 'alert') + '</div>';
      return;
    }

    root.innerHTML =
      '<div class="page">' +
      UI.pageHeader('Hasil Tes Kondisi Fisik', 'Perbandingan hasil tes antar periode untuk ' + athlete.nama + '.') +
      '<div id="ts-latest"></div>' +
      '<div class="card mt-2">' +
      '<div class="card-title">' + UI.icon('chart', 20) + 'Grafik Hasil Tes Mingguan</div>' +
      '<p class="small muted">Hasil tes dalam satu minggu digabung memakai <b>rata-rata</b>.</p>' +
      '<div class="filter-bar">' +
      '<select class="input" id="ts-jenis" style="max-width:280px" aria-label="Pilih jenis tes"></select></div>' +
      '<div class="mon-scroll"><div class="chart-box tall"><canvas id="chart-tes-saya"></canvas></div></div>' +
      '<div id="ts-jelaskan"></div>' +
      '</div>' +
      '<div class="card mt-2">' +
      '<div class="card-title">' + UI.icon('clipboard', 20) + 'Riwayat Hasil Terbaru</div>' +
      '<div id="ts-riwayat"></div>' +
      '</div></div>';

    var page = root.querySelector('.page');

    function isiJenisTerpilih() {
      var select = page.querySelector('#ts-jenis');
      if (!select) return '';
      var jenis = select.value;
      var daftar = Shared.testTypes();
      if (!daftar.length) {
        select.innerHTML = '<option value="">Belum ada jenis tes</option>';
        return '';
      }
      if (!jenis || !daftar.some(function (t) {
        return t.id === jenis;
      })) jenis = daftar[0].id;
      select.innerHTML = daftar.map(function (t) {
        return '<option value="' + Utils.esc(t.id) + '"' + (t.id === jenis ? ' selected' : '') + '>' +
          Utils.esc(t.nama) + ' (' + Utils.esc(t.satuan) + ')</option>';
      }).join('');
      select.value = jenis;
      return jenis;
    }

    function refresh() {
      var jenis = isiJenisTerpilih();
      var hist = Shared.testHistory(athlete.id_atlet, jenis || null);

      /* --- kartu ringkasan: nilai terbaru + selisih vs minggu sebelumnya --- */
      var latest = Shared.latestTests(athlete.id_atlet).filter(function (t) {
        return !jenis || t.id_tes === jenis;
      });
      var host = page.querySelector('#ts-latest');
      if (!latest.length) {
        host.innerHTML = '<div class="card">' + UI.emptyState('Belum ada hasil tes fisik yang tercatat.', 'activity') + '</div>';
      } else {
        host.innerHTML = '<div class="stat-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">' +
          latest.map(function (t) {
            var deret = Shared.testHistory(athlete.id_atlet, t.id_tes).map(function (h) {
              return { tanggal: h.tanggal, nilai: h.hasil };
            });
            var petaT = buatPetaMinggu(deret.map(function (d) {
              return d.tanggal;
            }));
            var seri = seriMingguan(deret, petaT, { reduksi: 'rata' });
            var punya = seri.data.filter(function (v) {
              return typeof v === 'number';
            });
            var terbaru = punya.length ? punya[punya.length - 1] : null;
            var sebelum = punya.length > 1 ? punya[punya.length - 2] : null;
            var delta = (terbaru === null || sebelum === null) ? null : Math.round((terbaru - sebelum) * 10) / 10;
            var lebihBaik = t.lebih_baik === 'rendah' ? (delta !== null && delta < 0) : (delta !== null && delta > 0);
            var arah = delta === null || delta === 0 ? 'tetap' : delta > 0 ? 'naik' : 'turun';
            var warnaKartu = delta === null ? 'primary' : (lebihBaik ? 'ok' : 'danger');
            return '<div class="stat-card tone-' + warnaKartu + '">' +
              '<div class="stat-icon">' + UI.icon('target', 24) + '</div>' +
              '<div class="stat-body"><div class="stat-value">' + Utils.esc(terbaru === null ? t.hasil : fmtAngka(terbaru)) + '</div>' +
              '<div class="stat-label">' + Utils.esc(t.jenis_tes) + ' (' + Utils.esc(t.satuan) + ')</div>' +
              '<div class="stat-sub">' + (delta === null
                ? 'nilai minggu terakhir'
                : (delta > 0 ? '+' : '') + fmtAngka(delta) + ' ' + Utils.esc(t.satuan) + ' vs minggu sebelumnya') + '</div>' +
              '</div></div>';
          }).join('') + '</div>';
      }

      /* --- grafik mingguan per jenis tes --- */
      var canvas = page.querySelector('#chart-tes-saya');
      var hostJelaskan = page.querySelector('#ts-jelaskan');
      var tipeTerpilih = Shared.testTypes().filter(function (t) {
        return t.id === jenis;
      })[0];

      if (!hist.length || !tipeTerpilih) {
        Charts.destroy(canvas);
        canvas.style.display = 'none';
        if (hostJelaskan) hostJelaskan.innerHTML = kotakPenjelasan('Belum ada data tes untuk jenis ini.');
        page.querySelector('#ts-riwayat').innerHTML = UI.emptyState('Belum ada riwayat tes.', 'activity');
        return;
      }
      canvas.style.display = '';

      var satuan = tipeTerpilih.satuan;
      var items = hist.filter(function (h) {
        return h.id_tes === tipeTerpilih.id;
      }).map(function (h) {
        return { tanggal: h.tanggal, nilai: h.hasil };
      });

      var petaM = buatPetaMinggu(items.map(function (d) {
        return d.tanggal;
      }));
      var seri = seriMingguan(items, petaM, { reduksi: 'rata' });

      var skala = skalaY(seri.data, {});
      lebarScroll(canvas.parentElement, seri.labels.length);
      gambarGaris(canvas, { labels: seri.labels },
        [{ label: tipeTerpilih.nama, data: seri.data }],
        opsiSumbu(seri.labels, seri.judul, satuan, skala));

      if (hostJelaskan) {
        var adaNilai = seri.data.some(function (v) {
          return typeof v === 'number';
        });
        hostJelaskan.innerHTML = kotakPenjelasan(
          adaNilai
            ? penjelasanSeri(tipeTerpilih.nama, seri.data, seri.labels, satuan)
            : 'Belum ada data ' + tipeTerpilih.nama + ' untuk dirangkum.',
          'Hasil tes dalam satu minggu digabung memakai rata-rata. Minggu tanpa data dilewati. Satuan: ' + satuan + '.'
        );
      }

      /* --- daftar ringkas (bukan tabel lebar) --- */
      var riwayat = page.querySelector('#ts-riwayat');
      var urut = Utils.sortBy(hist, 'tanggal', 'desc').slice(0, 12);
      riwayat.innerHTML = '<div class="list-rows">' + urut.map(function (h) {
        return '<div class="list-row"><div class="grow"><b>' + Utils.esc(h.jenis_tes) + '</b>' +
          '<span>' + Utils.fmtDate(h.tanggal, true) + '</span></div>' +
          '<div class="fw-bold">' + Utils.esc(h.hasil) + ' <span class="small muted">' + Utils.esc(h.satuan) + '</span></div></div>';
      }).join('') + '</div>' +
        (hist.length > 12 ? '<p class="small muted mt-2">Menampilkan 12 hasil terbaru dari ' + hist.length + ' hasil.</p>' : '');
    }

    refresh();
    page.addEventListener('change', function (e) {
      if (e.target.id === 'ts-jenis') refresh();
    });
    app.subscribe('physical_tests', refresh);
    app.subscribe('test_types', refresh);
  }

  /* ======================================================================
     3. Hasil Pertandingan
     ====================================================================== */

  function hasilPertandingan(root, user, app) {
    var athlete = myAthlete(user);
    if (!athlete) {
      root.innerHTML = '<div class="page">' + UI.emptyState('Data atlet tidak ditemukan.', 'alert') + '</div>';
      return;
    }

    root.innerHTML =
      '<div class="page">' +
      UI.pageHeader('Hasil Pertandingan', 'Daftar pertandingan yang sudah dicatat oleh pelatih.') +
      '<div id="hp-stats" class="stat-grid"></div>' +
      '<div class="card mt-2">' +
      '<div class="card-title">' + UI.icon('trophy', 20) + 'Grafik Pertandingan Mingguan</div>' +
      '<p class="small muted">Jumlah pertandingan, menang, dan kalah dihitung <b>per minggu</b>.</p>' +
      '<div class="mon-scroll"><div class="chart-box tall"><canvas id="chart-pertandingan"></canvas></div></div>' +
      '<div id="hp-jelaskan"></div>' +
      '</div>' +
      '<div class="card mt-2">' +
      '<div class="card-title">' + UI.icon('clipboard', 20) + 'Daftar Pertandingan</div>' +
      '<div id="hp-list"></div>' +
      '</div>' +
      '</div>';

    var page = root.querySelector('.page');

    function refresh() {
      var rows = Shared.matchesFor(athlete.id_atlet);
      var menang = rows.filter(function (m) {
        return m.hasil === 'Menang';
      }).length;

      page.querySelector('#hp-stats').innerHTML =
        UI.statCard('Total Pertandingan', rows.length, 'tercatat', 'trophy', 'primary') +
        UI.statCard('Menang', menang, rows.length ? Math.round((menang / rows.length) * 100) + '% kemenangan' : '-', 'star', 'ok') +
        UI.statCard('Kalah', rows.length - menang, 'terus berlatih', 'activity', 'warn');

      /* --- grafik per minggu: total / menang / kalah --- */
      var canvas = page.querySelector('#chart-pertandingan');
      var hostJelaskan = page.querySelector('#hp-jelaskan');
      var petaM = buatPetaMinggu(rows.map(function (m) {
        return m.tanggal;
      }));

      if (!rows.length) {
        Charts.destroy(canvas);
        canvas.style.display = 'none';
        if (hostJelaskan) hostJelaskan.innerHTML = kotakPenjelasan('Belum ada data pertandingan untuk dirangkum.');
      } else {
        canvas.style.display = '';
        var seri = seriMingguanKelompok(rows, petaM, {
          grup: {
            total: function () { return true; },
            menang: function (m) { return m.hasil === 'Menang'; },
            kalah: function (m) { return m.hasil === 'Kalah'; }
          }
        });

        // detail pertandingan per minggu untuk tooltip
        var detail = {};
        rows.forEach(function (m) {
          var s = seninDari(m.tanggal);
          if (!detail[s]) detail[s] = [];
          detail[s].push('vs ' + (m.lawan || '-') + ' / ' + (m.turnamen || '-') + ' (' +
            (m.skor_set || []).join(', ') + ')');
        });

        var skala = skalaY(semuaNilai([seri.seri.total, seri.seri.menang, seri.seri.kalah]), { langkah: 1 });
        lebarScroll(canvas.parentElement, seri.labels.length);

        var opsi = opsiSumbu(seri.labels, seri.judul, 'Jumlah', skala);
        opsi.tooltipCallbacks = {
          title: function (items) {
            if (!items.length) return '';
            return seri.judul[items[0].dataIndex] || '';
          },
          label: function (ctx) {
            var v = ctx.parsed && ctx.parsed.y;
            return ctx.dataset.label + ': ' + (v === null || v === undefined ? 'tidak ada' : fmtAngka(v));
          },
          afterBody: function (items) {
            if (!items.length) return '';
            var s = seri.minggu[items[0].dataIndex];
            var daftar = detail[s];
            if (!daftar || !daftar.length) return ['Tidak ada pertandingan minggu ini.'];
            return daftar.map(function (d) {
              return '- ' + d;
            });
          }
        };

        gambarBatang(canvas, { labels: seri.labels }, [
          { label: 'Pertandingan', data: seri.seri.total, color: '#0b3d91' },
          { label: 'Menang', data: seri.seri.menang, color: '#43A047' },
          { label: 'Kalah', data: seri.seri.kalah, color: '#E53935' }
        ], opsi);

        if (hostJelaskan) {
          hostJelaskan.innerHTML = kotakPenjelasan(
            penjelasanSeri('pertandingan', seri.seri.total, seri.labels, 'pertandingan'),
            'Jumlah pertandingan, menang, dan kalah dihitung per minggu. Minggu tanpa pertandingan dikosongkan.'
          );
        }
      }

      /* --- daftar ringkas + tombol Lihat Detail --- */
      var host = page.querySelector('#hp-list');
      if (!rows.length) {
        host.innerHTML = UI.emptyState('Belum ada hasil pertandingan.', 'trophy');
        return;
      }
      host.innerHTML = '<div class="list-rows">' + rows.map(function (m) {
        return '<div class="list-row">' +
          '<div class="grow"><b>' + Utils.esc(m.turnamen) + '</b> ' + Shared.badgeKategori(m.kategori) +
          '<span>vs ' + Utils.esc(m.lawan) + ' / ' + Utils.fmtDate(m.tanggal, true) + '</span>' +
          '<div class="small muted">' + (m.skor_set || []).map(function (s) {
            return Utils.esc(s);
          }).join(' &middot; ') + '</div></div>' +
          UI.statusBadge(m.hasil) +
          '<button type="button" class="btn btn-sm btn-secondary" data-detail-match="' + Utils.esc(m.id) + '">Lihat Detail</button>' +
          '</div>';
      }).join('') + '</div>';
    }

    refresh();

    page.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-detail-match]');
      if (!btn) return;
      var m = Store.find('matches', btn.getAttribute('data-detail-match'));
      if (!m) return;
      var a = UI.athleteById(m.id_atlet);
      var body =
        UI.backButton({ closeModal: 'm-detail-match' }) +
        '<div class="detail-grid">' +
        '<div class="detail-item"><div class="k">Tanggal</div><div class="v">' + Utils.fmtDate(m.tanggal, true) + '</div></div>' +
        '<div class="detail-item"><div class="k">Atlet</div><div class="v">' + Utils.esc(a ? a.nama : '-') + '</div></div>' +
        '<div class="detail-item"><div class="k">Turnamen</div><div class="v">' + Utils.esc(m.turnamen) + '</div></div>' +
        '<div class="detail-item"><div class="k">Kategori</div><div class="v">' + Shared.badgeKategori(m.kategori) + '</div></div>' +
        '<div class="detail-item"><div class="k">Lawan</div><div class="v">' + Utils.esc(m.lawan) + '</div></div>' +
        '<div class="detail-item"><div class="k">Hasil</div><div class="v">' + UI.statusBadge(m.hasil) + '</div></div>' +
        '<div class="detail-item"><div class="k">Skor per Set</div><div class="v"><div class="score-pills">' +
        (m.skor_set || []).map(function (s) {
          return '<span class="score-pill">' + Utils.esc(s) + '</span>';
        }).join('') + '</div></div></div>' +
        '</div>' +
        (m.catatan ? '<h4 class="mt-2">Catatan Pelatih</h4><p class="muted">' + Utils.esc(m.catatan) + '</p>' : '') +
        '<div class="small muted mt-2">Diinput oleh ' + Utils.esc(UI.userName(m.input_oleh)) + '</div>';
      document.getElementById('modal-host').innerHTML = UI.modalShell('m-detail-match', 'Detail Pertandingan', body,
        '<button type="button" class="btn btn-ghost" data-back-close="m-detail-match">Tutup</button>');
      UI.openModal('m-detail-match');
    });

    app.subscribe('matches', refresh);
  }

  function profil(root, user, app) {
    var athlete = myAthlete(user);
    if (!athlete) {
      root.innerHTML = '<div class="page">' + UI.emptyState('Data atlet tidak ditemukan.', 'alert') + '</div>';
      return;
    }

    root.innerHTML =
      '<div class="page">' +
      UI.pageHeader('Profil Atlet', 'Biodata dan pengaturan akun Anda.') +
      '<div class="grid-2 equal">' +
      '<div class="card">' +
      '<div class="flex items-center gap-2 mb-2">' + UI.avatar(athlete, 84) +
      '<div><h3 class="mt-0 mb-0">' + Utils.esc(athlete.nama) + '</h3>' +
      '<div class="flex items-center gap-1 mt-1">' + UI.badge(athlete.id_atlet, 'primary') + UI.statusBadge(athlete.status) + '</div></div></div>' +
      '<div class="detail-grid">' +
      '<div class="detail-item"><div class="k">Tanggal Lahir</div><div class="v">' + Utils.fmtDate(athlete.tgl_lahir, true) + '</div></div>' +
      '<div class="detail-item"><div class="k">Usia</div><div class="v">' + Utils.age(athlete.tgl_lahir) + ' tahun</div></div>' +
      '<div class="detail-item"><div class="k">Jenis Kelamin</div><div class="v">' + Utils.esc(athlete.jk) + '</div></div>' +
      '<div class="detail-item"><div class="k">Tinggi Badan</div><div class="v">' + Utils.esc(athlete.tinggi) + ' cm</div></div>' +
      '<div class="detail-item"><div class="k">Berat Badan</div><div class="v">' + Utils.esc(athlete.berat) + ' kg</div></div>' +
      '<div class="detail-item"><div class="k">BMI</div><div class="v">' + Utils.esc(athlete.bmi) + ' (' + Utils.esc(athlete.kategori_bmi) + ')</div></div>' +
      '<div class="detail-item"><div class="k">Asal Sekolah</div><div class="v">' + Utils.esc(athlete.sekolah) + '</div></div>' +
      '<div class="detail-item"><div class="k">Asal PB</div><div class="v">' + Utils.esc(athlete.asal_pb || '-') + '</div></div>' +
      '<div class="detail-item"><div class="k">No. HP</div><div class="v">' + Utils.esc(athlete.no_hp) + '</div></div>' +
      '<div class="detail-item"><div class="k">ID Login</div><div class="v">' + Utils.esc(user.username) + '</div></div>' +
      '</div>' +
      '<h4 class="mt-3">Dokumen Pendaftaran</h4>' +
      Docs.viewerHtml(athlete.dokumen || {}) +
      '</div>' +
      '<div class="card">' +
      '<div class="card-title">' + UI.icon('settings', 20) + 'Ubah Kata Sandi</div>' +
      '<form id="form-pw">' +
      UI.field({ name: 'old', label: 'Kata Sandi Lama', type: 'password', required: true }) +
      UI.field({ name: 'baru', label: 'Kata Sandi Baru', type: 'password', required: true, help: 'Minimal 6 karakter.' }) +
      UI.field({ name: 'ulangi', label: 'Ulangi Kata Sandi Baru', type: 'password', required: true }) +
      '<button class="btn" type="submit">Simpan Kata Sandi</button>' +
      '</form>' +
      '<div class="notice mt-3">' + UI.icon('info', 20) +
      '<div>Perubahan data diri (tinggi, berat, sekolah) dilakukan oleh pelatih kepala. Hubungi pelatih bila ada data yang perlu diperbarui.</div></div>' +
      '</div></div>' +
      '<div class="card mt-2">' +
      '<div class="card-title">' + UI.icon('user', 20) + 'Kartu Atlet</div>' +
      '<div id="kartu-atlet-host"></div>' +
      '</div></div>';

    var page = root.querySelector('.page');
    Docs.bindViewer(page, athlete.dokumen || {});
    if (typeof KartuAtlet !== 'undefined' && KartuAtlet && KartuAtlet.render) {
      KartuAtlet.render(page.querySelector('#kartu-atlet-host'), athlete);
    }
    var form = page.querySelector('#form-pw');
    UI.bindSubmit(form, function () {
      Utils.clearErrors(form);
      var d = Utils.formData(form);
      var errors = {};
      if (!d.old) errors.old = 'Kata sandi lama wajib diisi.';
      if (!d.baru || d.baru.length < 6) errors.baru = 'Kata sandi baru minimal 6 karakter.';
      if (d.baru !== d.ulangi) errors.ulangi = 'Konfirmasi kata sandi tidak sama.';
      if (Object.keys(errors).length) {
        Utils.showErrors(form, errors);
        Utils.toast('Periksa kembali isian yang ditandai.', 'danger');
        return;
      }
      return Auth.changePassword(user.id, d.old, d.baru).then(function () {
        Utils.toast('Kata sandi berhasil diubah.', 'success');
        form.reset();
      }).catch(function (err) {
        Utils.showErrors(form, { old: err.message });
        Utils.toast(err.message, 'danger');
      });
    });
  }

  // Riwayat pembayaran milik atlet yang sedang login (read-only).
  function riwayatPembayaran(root, user, app) {
    var athlete = myAthlete(user);
    if (!athlete) {
      root.innerHTML = '<div class="page">' + UI.emptyState('Data atlet tidak ditemukan.', 'alert') + '</div>';
      return;
    }

    root.innerHTML =
      '<div class="page">' +
      UI.pageHeader('Riwayat Pembayaran', 'Rekap pembayaran yang telah dicatat oleh pelatih.') +
      '<div class="card">' +
      '<div class="filter-bar">' +
      '<select class="input" id="rp-kategori" style="max-width:240px" aria-label="Filter kategori">' +
      '<option value="">Semua kategori</option>' +
      CONFIG.KATEGORI_PEMBAYARAN.map(function (k) {
        return '<option value="' + Utils.esc(k) + '">' + Utils.esc(k) + '</option>';
      }).join('') +
      '</select>' +
      '</div>' +
      '<div id="rp-ringkas"></div>' +
      '<div id="rp-list"></div>' +
      '</div></div>';

    var page = root.querySelector('.page');

    function render() {
      var filter = page.querySelector('#rp-kategori').value;
      var rows = Store.where('pembayaran', function (r) {
        if (r.id_atlet !== athlete.id_atlet) return false;
        if (filter && r.kategori !== filter) return false;
        return true;
      });
      rows = Utils.sortBy(rows, 'tanggal', 'desc');

      var lunas = 0, belum = 0, perKategori = {};
      CONFIG.KATEGORI_PEMBAYARAN.forEach(function (k) {
        perKategori[k] = 0;
      });
      rows.forEach(function (r) {
        var n = Number(r.nominal) || 0;
        if (r.status === 'lunas') lunas += n;
        else belum += n;
        if (perKategori[r.kategori] !== undefined) perKategori[r.kategori] += n;
      });

      page.querySelector('#rp-ringkas').innerHTML =
        '<div class="stat-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">' +
        UI.statCard('Total Entri', rows.length, filter ? 'kategori ' + filter : 'semua kategori', 'clipboard', 'primary') +
        UI.statCard('Sudah Lunas', 'Rp ' + Utils.fmtNumber(lunas, 0), 'pembayaran lunas', 'check', 'ok') +
        UI.statCard('Belum Lunas', 'Rp ' + Utils.fmtNumber(belum, 0), belum ? 'segera lakukan pembayaran' : 'semua lunas', 'alert', belum ? 'warn' : 'ok') +
        '</div>' +
        '<div class="chip-row mt-2">' + CONFIG.KATEGORI_PEMBAYARAN.map(function (k) {
          return '<span class="score-pill">' + Utils.esc(k) + ': Rp ' + Utils.fmtNumber(perKategori[k], 0) + '</span>';
        }).join('') + '</div>';

      var host = page.querySelector('#rp-list');
      if (!rows.length) {
        host.innerHTML = UI.emptyState('Belum ada riwayat pembayaran.', 'save');
        return;
      }
      host.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr>' +
        '<th>Tanggal</th><th>Kategori</th><th class="align-right">Nominal</th><th>Keterangan</th><th>Status</th>' +
        '</tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr>' +
            '<td>' + Utils.fmtDate(r.tanggal, true) + '</td>' +
            '<td>' + UI.badge(r.kategori, 'primary') + '</td>' +
            '<td class="align-right fw-bold">Rp ' + Utils.fmtNumber(Number(r.nominal) || 0, 0) + '</td>' +
            '<td class="small">' + Utils.esc(r.keterangan || '-') + '</td>' +
            '<td>' + (r.status === 'lunas' ? UI.badge('Lunas', 'ok') : UI.badge('Belum Lunas', 'warn')) + '</td>' +
            '</tr>';
        }).join('') + '</tbody></table></div>';
    }

    render();

    page.addEventListener('change', function (e) {
      if (e.target.id === 'rp-kategori') render();
    });

    app.subscribe('pembayaran', render);
  }

  // Kehadiran milik atlet yang sedang login (read-only).
  // Data diinput asisten pelatih / pelatih kepala, tampil otomatis di sini.
  function kehadiranSaya(root, user, app) {
    var athlete = myAthlete(user);
    if (!athlete) {
      root.innerHTML = '<div class="page">' + UI.emptyState('Data atlet tidak ditemukan.', 'alert') + '</div>';
      return;
    }

    root.innerHTML =
      '<div class="page">' +
      UI.pageHeader('Kehadiran Saya', 'Rekap kehadiran latihan Anda. Data diinput oleh pelatih.') +
      '<div class="card">' +
      '<div class="filter-bar">' +
      '<select class="input" id="kh-bulan" style="max-width:220px" aria-label="Filter bulan">' +
      '<option value="">Semua bulan</option></select>' +
      '<select class="input" id="kh-status" style="max-width:200px" aria-label="Filter status kehadiran">' +
      '<option value="">Semua status</option>' +
      CONFIG.STATUS_KEHADIRAN.map(function (s) {
        return '<option value="' + Utils.esc(s) + '">' + Utils.esc(s === 'Tidak Hadir' ? 'Alpa' : s) + '</option>';
      }).join('') +
      '</select>' +
      '</div>' +
      '<div id="kh-ringkas"></div>' +
      '<div id="kh-list"></div>' +
      '</div></div>';

    var page = root.querySelector('.page');

    function labelStatus(s) {
      return s === 'Tidak Hadir' ? 'Alpa' : s;
    }

    function fillBulan() {
      var select = page.querySelector('#kh-bulan');
      var map = {};
      Store.all('attendance').forEach(function (r) {
        if (r.id_atlet === athlete.id_atlet && r.tipe === 'atlet') map[Utils.monthKey(r.tanggal)] = true;
      });
      var current = select.value;
      select.innerHTML = '<option value="">Semua bulan</option>' +
        Object.keys(map).sort().reverse().map(function (m) {
          return '<option value="' + m + '">' + Utils.esc(Utils.fmtDate(m + '-01', true)) + '</option>';
        }).join('');
      if (current && map[current]) select.value = current;
    }

    function render() {
      var bulan = page.querySelector('#kh-bulan').value;
      var status = page.querySelector('#kh-status').value;

      var rows = Store.where('attendance', function (r) {
        if (r.id_atlet !== athlete.id_atlet) return false;
        if (r.tipe && r.tipe !== 'atlet') return false;
        if (bulan && Utils.monthKey(r.tanggal) !== bulan) return false;
        if (status && r.status !== status) return false;
        return true;
      });
      rows = Utils.sortBy(rows, 'tanggal', 'desc');

      // lokasi & program berasal dari absensi asisten yang mencantumkan atlet ini
      var lokasiProgram = {};
      Store.all('absensi_asisten').forEach(function (r) {
        if (!r || (r.atlet || []).indexOf(athlete.id_atlet) === -1) return;
        lokasiProgram[r.tanggal] = { lokasi: r.lokasi || '', program: r.program || '' };
      });

      var total = rows.length;
      var c = { Hadir: 0, Izin: 0, Sakit: 0, 'Tidak Hadir': 0 };
      rows.forEach(function (r) {
        if (c[r.status] !== undefined) c[r.status]++;
      });
      var persen = Utils.pct(c.Hadir, total);

      page.querySelector('#kh-ringkas').innerHTML =
        '<div class="stat-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr))">' +
        UI.statCard('Total Latihan', total, bulan ? 'bulan terpilih' : 'seluruh periode', 'clipboard', 'primary') +
        UI.statCard('Hadir', c.Hadir, persen + '% kehadiran', 'check', 'ok') +
        UI.statCard('Izin', c.Izin, 'tidak hadir dengan izin', 'info', 'blue') +
        UI.statCard('Sakit', c.Sakit, 'tidak hadir karena sakit', 'alert', 'warn') +
        UI.statCard('Alpa', c['Tidak Hadir'], 'tidak hadir tanpa keterangan', 'alert', 'danger') +
        '</div>';

      var host = page.querySelector('#kh-list');
      if (!rows.length) {
        host.innerHTML = UI.emptyState('Belum ada data kehadiran.', 'calendar');
        return;
      }
      host.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr>' +
        '<th>Tanggal</th><th>Lokasi Latihan</th><th>Program</th><th>Status</th><th>Keterangan</th>' +
        '</tr></thead><tbody>' +
        rows.map(function (r) {
          var lp = lokasiProgram[r.tanggal] || {};
          return '<tr>' +
            '<td>' + Utils.fmtDate(r.tanggal, true) + '</td>' +
            '<td class="small">' + Utils.esc(lp.lokasi || '-') + '</td>' +
            '<td class="small">' + Utils.esc(lp.program || '-') + '</td>' +
            '<td>' + UI.statusBadge(r.status === 'Tidak Hadir' ? 'Tidak Hadir' : r.status) +
            (r.status === 'Tidak Hadir' ? ' <span class="small muted">(Alpa)</span>' : '') + '</td>' +
            '<td class="small">' + Utils.esc(r.catatan || '-') + '</td>' +
            '</tr>';
        }).join('') + '</tbody></table></div>' +
        '<p class="small muted mt-2">Data kehadiran diinput oleh asisten pelatih dan pelatih kepala. ' +
        'Halaman ini bersifat baca-saja.</p>';
    }

    fillBulan();
    render();

    page.addEventListener('change', function (e) {
      if (e.target.id === 'kh-bulan' || e.target.id === 'kh-status') render();
    });

    app.subscribe('attendance', function () {
      fillBulan();
      render();
    });
    app.subscribe('absensi_asisten', render);
  }

  function register() {
    App.register('tes-saya', {
      title: 'Hasil Tes Kondisi Fisik',
      subtitle: 'Perbandingan hasil tes antar periode',
      render: tesSaya
    });
    App.register('kehadiran-saya', {
      title: 'Kehadiran Saya',
      subtitle: 'Rekap kehadiran latihan Anda',
      render: kehadiranSaya
    });
    App.register('hasil-pertandingan', {
      title: 'Hasil Pertandingan',
      subtitle: 'Riwayat pertandingan Anda',
      render: hasilPertandingan
    });
    App.register('riwayat-pembayaran', {
      title: 'Riwayat Pembayaran',
      subtitle: 'Rekap pembayaran Anda',
      render: riwayatPembayaran
    });
    App.register('profil', {
      title: 'Profil Atlet',
      subtitle: 'Biodata & pengaturan akun',
      render: profil
    });
  }

  return {
    register: register,
    home: home
  };
})();

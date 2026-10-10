var PagesMonitoring = (function () {

  var ASPESK = [
    {
      key: 'fisik', label: 'Fisik', judul: 'Program Latihan Fisik', warna: '#E53935',
      contoh: 'daya tahan, kekuatan, kecepatan, kelincahan',
      slider: 'Slider intensitas latihan fisik'
    },
    {
      key: 'teknik', label: 'Teknik', judul: 'Program Latihan Teknik', warna: '#43A047',
      contoh: 'footwork, smash, drop shot, servis, netting',
      slider: 'Slider intensitas latihan teknik'
    },
    {
      key: 'taktik', label: 'Taktik', judul: 'Program Latihan Taktik / Pola Permainan', warna: '#FB8C00',
      contoh: 'pola serangan, pola bertahan, rotasi ganda, pola tunggal',
      slider: 'Slider intensitas latihan taktik'
    },
    {
      key: 'mental', label: 'Mental', judul: 'Program Mental', warna: '#EC407A',
      contoh: 'fokus, percaya diri, mengelola tekanan, visualisasi',
      slider: 'Slider intensitas latihan mental'
    }
  ];

  var KOLEKSI = 'monitoring';

  /* ============================ util minggu ============================ */

  function seninDari(iso) {
    var d = Utils.parseISO(iso);
    var hari = d.getDay();
    var geser = hari === 0 ? -6 : 1 - hari;
    d.setDate(d.getDate() + geser);
    return Utils.toISODate(d);
  }

  function tglAkhir(isoSenin) {
    return Utils.addDaysISO(isoSenin, 6);
  }

  function rentangTeks(isoSenin) {
    return Utils.fmtDate(isoSenin) + ' s.d. ' + Utils.fmtDate(tglAkhir(isoSenin));
  }

  function petaMinggu(rows, tanggalExtra) {
    var min = null;
    function cek(t) {
      if (t && (!min || t < min)) min = t;
    }
    (rows || []).forEach(function (r) {
      cek(r.tanggalMulai);
    });
    cek(tanggalExtra);
    if (!min) return {};
    function hitung(t) {
      var selisih = Math.round((Utils.parseISO(t) - Utils.parseISO(min)) / 86400000);
      return Math.floor(selisih / 7) + 1;
    }
    var map = {};
    (rows || []).forEach(function (r) {
      map[r.tanggalMulai] = hitung(r.tanggalMulai);
    });
    if (tanggalExtra) map[tanggalExtra] = hitung(tanggalExtra);
    return map;
  }

  function nomorMinggu(tanggalMulai, rows) {
    return petaMinggu(rows, tanggalMulai)[tanggalMulai] || 1;
  }

  /* ============================ akses data ============================ */

  function semuaRow() {
    return Store.all(KOLEKSI);
  }

  function rowUntuk(idAtlet, tgl) {
    return Store.findOne(KOLEKSI, function (m) {
      return m.idAtlet === idAtlet && m.tanggalMulai === tgl;
    });
  }

  function rowsUntukAtlet(idAtlet) {
    return Utils.sortBy(Store.where(KOLEKSI, function (m) {
      return m.idAtlet === idAtlet;
    }), 'tanggalMulai', 'asc');
  }

  // Migrasi data lama: field `nilai` (skala 0-100) dipetakan menjadi
  // `intensitas` (skala 1-10) lalu ditandai `konversi: true` supaya Pelatih
  // Kepala dapat memeriksa dan mengubahnya. Data asli tidak dihapus.
  function migrasiIntensitas() {
    var berubah = 0;
    Store.all(KOLEKSI).forEach(function (r) {
      var patch = null;
      ASPESK.forEach(function (a) {
        var s = r[a.key];
        if (!s || typeof s !== 'object') return;
        var sudah = s.intensitas;
        if (sudah !== undefined && sudah !== null && sudah !== '') return;
        if (s.nilai === undefined || s.nilai === null || s.nilai === '') return;
        if (!patch) patch = {};
        patch[a.key] = {
          program: s.program || '',
          durasi: s.durasi || '',
          intensitas: Math.max(1, Math.round(Number(s.nilai) / 10)),
          konversi: true,
          catatan: s.catatan || '',
          nilai: s.nilai
        };
      });
      if (patch) {
        Store.update(KOLEKSI, r.id, patch);
        berubah++;
      }
    });
    return berubah;
  }

  var sudahMigrasiIntensitas = false;
  function migrasiIntensitasSekali() {
    if (sudahMigrasiIntensitas) return 0;
    sudahMigrasiIntensitas = true;
    try {
      return migrasiIntensitas();
    } catch (e) {
      return 0;
    }
  }

  function rowsUntukMinggu(tgl) {
    return Store.where(KOLEKSI, function (m) {
      return m.tanggalMulai === tgl;
    });
  }

  // Tingkat intensitas latihan (skala 1-10) beserta label & warna badge-nya.
  function tingkatIntensitas(nilai) {
    var n = Number(nilai);
    if (nilai === null || nilai === undefined || nilai === '' || isNaN(n)) return null;
    n = Math.round(n);
    if (n >= 9) return { label: 'Sangat Tinggi', kelas: 'int-sangat' };
    if (n >= 7) return { label: 'Tinggi', kelas: 'int-tinggi' };
    if (n >= 4) return { label: 'Sedang', kelas: 'int-sedang' };
    return { label: 'Rendah', kelas: 'int-rendah' };
  }

  // Memperbarui label badge tingkat di bawah slider saat nilai berubah.
  function perbaruiTingkat(form, namaField) {
    if (!form || !namaField) return;
    var key = namaField.replace(/_intensitas$/, '');
    var badge = form.querySelector('[data-tingkat="' + key + '"]');
    if (!badge) return;
    var num = form.querySelector('[name="' + namaField + '"]');
    var t = tingkatIntensitas(num ? num.value : '');
    badge.className = 'int-badge ' + (t ? t.kelas : 'int-kosong');
    badge.textContent = t ? t.label : 'Belum diisi';
  }

  // Normalisasi satu bagian program: memakai field `intensitas` (1-10).
  // Data lama yang masih menyimpan `nilai` (0-100) otomatis dibaca sebagai
  // intensitas agar tidak hilang, dan ditandai `konversi`.
  function bacaAspek(row, key) {
    var s = (row && row[key]) || {};
    var intensitas = s.intensitas;
    var konversi = false;
    if (intensitas === null || intensitas === undefined || intensitas === '' || isNaN(Number(intensitas))) {
      if (s.nilai !== null && s.nilai !== undefined && s.nilai !== '' && !isNaN(Number(s.nilai))) {
        intensitas = Math.max(1, Math.round(Number(s.nilai) / 10));
        konversi = true;
      } else {
        intensitas = null;
      }
    } else {
      intensitas = Number(intensitas);
      konversi = !!s.konversi;
    }
    return {
      program: s.program || '',
      durasi: s.durasi || '',
      intensitas: intensitas,
      konversi: konversi,
      catatan: s.catatan || ''
    };
  }

  function aspekKosong() {
    var o = {};
    ASPESK.forEach(function (a) {
      o[a.key] = { program: '', durasi: '', intensitas: null, catatan: '' };
    });
    return o;
  }

  function intensitasDari(row, key) {
    return bacaAspek(row, key).intensitas;
  }

  function namaAtlet(idAtlet) {
    var a = UI.athleteById(idAtlet);
    return a ? a.nama : idAtlet;
  }

  /* ============================ model grafik ============================ */

  function bangunModel(filter) {
    filter = filter || {};
    var semua = semuaRow();
    var setMinggu = {};
    semua.forEach(function (r) {
      setMinggu[r.tanggalMulai] = true;
    });
    var minggu = Object.keys(setMinggu).sort();
    if (filter.rentang && filter.rentang !== 'all') {
      var n = Number(filter.rentang);
      if (n > 0 && minggu.length > n) minggu = minggu.slice(minggu.length - n);
    }

    var peta = petaMinggu(semua);
    var idAtlet = filter.idAtlet || '';

    var model = {
      idAtlet: idAtlet,
      rata: !idAtlet || idAtlet === '*',
      satuanPeriode: 'minggu ini',
      minggu: minggu,
      labels: [],
      judul: [],
      rentang: [],
      seri: {},
      program: {},
      catatan: [],
      rowId: [],
      jumlahAtlet: [],
      sumber: {}
    };

    ASPESK.forEach(function (a) {
      model.seri[a.key] = [];
      model.program[a.key] = [];
    });

    minggu.forEach(function (tgl) {
      model.labels.push('Minggu ' + (peta[tgl] || 1));
      model.judul.push('Minggu ke-' + (peta[tgl] || 1) + ' - ' + rentangTeks(tgl));
      model.rentang.push(rentangTeks(tgl));
      model.sumber[tgl] = null;

      if (!model.rata) {
        var target = rowUntuk(idAtlet, tgl);
        model.sumber[tgl] = target || null;
        model.rowId.push(target ? target.id : '');
        model.catatan.push(target ? (target.catatanPelatih || '') : '');
        model.jumlahAtlet.push(target ? 1 : 0);
        ASPESK.forEach(function (a) {
          var info = bacaAspek(target, a.key);
          model.seri[a.key].push(info.intensitas);
          model.program[a.key].push(info.program);
        });
        return;
      }

      var rows = rowsUntukMinggu(tgl);
      model.rowId.push('');
      model.jumlahAtlet.push(rows.length);
      var catatanAda = rows.map(function (r) {
        return r.catatanPelatih || '';
      }).filter(Boolean);
      model.catatan.push(catatanAda.length ? catatanAda[0] : '');
      ASPESK.forEach(function (a) {
      var nilai = rows.map(function (r) {
        return intensitasDari(r, a.key);
      }).filter(function (v) {
          return v !== null;
        });
        if (nilai.length) {
          var jumlah = nilai.reduce(function (s, v) {
            return s + v;
          }, 0);
          model.seri[a.key].push(Math.round((jumlah / nilai.length) * 10) / 10);
        } else {
          model.seri[a.key].push(null);
        }
        var prog = rows.map(function (r) {
          return bacaAspek(r, a.key).program;
        }).filter(Boolean);
        model.program[a.key].push(prog.length ? prog[0] : '');
      });
    });

    return model;
  }

  function nilaiTerakhir(arr) {
    for (var i = arr.length - 1; i >= 0; i--) {
      if (arr[i] !== null && arr[i] !== undefined) return arr[i];
    }
    return null;
  }

  function nilaiSebelumnya(arr) {
    var ketemu = false;
    for (var i = arr.length - 1; i >= 0; i--) {
      if (arr[i] === null || arr[i] === undefined) continue;
      if (!ketemu) {
        ketemu = true;
        continue;
      }
      return arr[i];
    }
    return null;
  }

  function potong(teks, n) {
    if (!teks) return '';
    return teks.length > n ? teks.slice(0, n - 3) + '...' : teks;
  }

  /* ============================ kartu ringkasan ============================ */

  function ringkasHtml(model) {
    return '<div class="mon-ringkas">' + ASPESK.map(function (a) {
      var terakhir = nilaiTerakhir(model.seri[a.key]);
      var sebelum = nilaiSebelumnya(model.seri[a.key]);
      var delta = (terakhir === null || sebelum === null) ? null : Math.round((terakhir - sebelum) * 10) / 10;
      var arah = delta === null || delta === 0 ? 'tetap' : delta > 0 ? 'naik' : 'turun';
      var simbol = arah === 'naik' ? '&#9650;' : arah === 'turun' ? '&#9660;' : '&#9644;';
      var teks = delta === null ? 'belum ada pembanding'
        : delta === 0 ? 'tetap dari minggu lalu'
          : (delta > 0 ? '+' : '') + delta + ' dari minggu lalu';
      return '<div class="mon-ringkas-item" style="--mon-warna:' + a.warna + '">' +
        '<div class="k">' + Utils.esc(a.label) + '</div>' +
        '<div class="v" style="color:' + a.warna + '">' + (terakhir === null ? '-' : terakhir) + '</div>' +
        (function () {
          var t = tingkatIntensitas(terakhir);
          return t ? '<div class="mt-1"><span class="int-badge ' + t.kelas + '">' + Utils.esc(t.label) + '</span></div>' : '';
        })() +
        '<div class="mon-delta ' + arah + '">' + simbol + ' ' + Utils.esc(teks) + '</div>' +
        '</div>';
    }).join('') + '</div>';
  }

  /* ============================ penjelasan ============================ */

  function trenDari(arr) {
    var nilai = arr.filter(function (v) {
      return v !== null && v !== undefined;
    });
    if (nilai.length < 2) return null;
    var ambil = nilai.slice(-4);
    var delta = Math.round((ambil[ambil.length - 1] - ambil[0]) * 10) / 10;
    if (delta >= 3) return { label: 'meningkat', arah: 'naik', delta: delta };
    if (delta <= -3) return { label: 'menurun', arah: 'turun', delta: delta };
    return { label: 'cenderung stabil', arah: 'tetap', delta: delta };
  }

  function penjelasan(model) {
    var hasil = [];
    if (!model.minggu.length) return hasil;

    var akhir = {};
    ASPESK.forEach(function (a) {
      akhir[a.key] = nilaiTerakhir(model.seri[a.key]);
    });
    var berisi = ASPESK.filter(function (a) {
      return akhir[a.key] !== null;
    });

    if (!berisi.length) {
      hasil.push('Belum ada intensitas latihan yang tercatat pada periode ini.');
      return hasil;
    }

    var tertinggi = berisi[0];
    var terendah = berisi[0];
    berisi.forEach(function (a) {
      if (akhir[a.key] > akhir[tertinggi.key]) tertinggi = a;
      if (akhir[a.key] < akhir[terendah.key]) terendah = a;
    });
    var tTinggi = tingkatIntensitas(akhir[tertinggi.key]);
    hasil.push('Intensitas tertinggi pekan ini: ' + tertinggi.label + ' (' + akhir[tertinggi.key] +
      ' - ' + (tTinggi ? tTinggi.label : '-') + ').');
    if (terendah.key !== tertinggi.key) {
      var tEndah = tingkatIntensitas(akhir[terendah.key]);
      hasil.push('Intensitas terendah: ' + terendah.label + ' (' + akhir[terendah.key] +
        ' - ' + (tEndah ? tEndah.label : '-') + ').');
    }

    // rata-rata intensitas keseluruhan
    var gabung = [];
    ASPESK.forEach(function (a) {
      model.seri[a.key].forEach(function (v) {
        if (v !== null && v !== undefined) gabung.push(v);
      });
    });
    if (gabung.length) {
      var rata = Math.round((gabung.reduce(function (s, v) {
        return s + v;
      }, 0) / gabung.length) * 10) / 10;
      var tRata = tingkatIntensitas(rata);
      hasil.push('Rata-rata intensitas ' + model.satuanPeriode.toLowerCase() + ': ' + rata +
        (tRata ? ' (' + tRata.label + ')' : '') + '.');
    }

    var trenNaik = [];
    var trenTurun = [];
    ASPESK.forEach(function (a) {
      var t = trenDari(model.seri[a.key]);
      if (!t || t.arah === 'tetap') return;
      if (t.arah === 'naik') trenNaik.push(a.label);
      else trenTurun.push(a.label);
    });
    if (trenNaik.length) hasil.push('Tren naik: ' + trenNaik.join(', ') + '.');
    if (trenTurun.length) hasil.push('Tren turun: ' + trenTurun.join(', ') + '.');

    // peringatan: intensitas tinggi 3 minggu berturut-turut
    var terlaluTinggi = [];
    ASPESK.forEach(function (a) {
      var s = model.seri[a.key];
      if (s.length >= 3) {
        var tiga = s.slice(-3);
        if (tiga.every(function (v) {
          return v !== null && v !== undefined && v >= 8;
        })) terlaluTinggi.push(a.label);
      }
    });
    if (terlaluTinggi.length) {
      hasil.push('Perhatian: intensitas ' + terlaluTinggi.join(', ') +
        ' sudah tinggi (8 ke atas) selama 3 minggu berturut-turut. Pertimbangkan menambah waktu pemulihan.');
    }

    // peringatan: seluruh program rendah terlalu lama
    var rataPerMinggu = model.minggu.map(function (_, i) {
      var v = ASPESK.map(function (a) {
        return model.seri[a.key][i];
      }).filter(function (x) {
        return x !== null && x !== undefined;
      });
      return v.length ? (v.reduce(function (s, x) {
        return s + x;
      }, 0) / v.length) : null;
    });
    var tigaAkhir = rataPerMinggu.slice(-3).filter(function (v) {
      return v !== null;
    });
    if (tigaAkhir.length === 3 && tigaAkhir.every(function (v) {
      return v <= 3;
    })) {
      hasil.push('Perhatikan keseimbangan beban latihan dan waktu pemulihan: seluruh program berintensitas rendah selama 3 minggu terakhir.');
    }

    // program minggu terbaru
    var idxAkhir = model.minggu.length - 1;
    ASPESK.forEach(function (a) {
      var prog = model.program[a.key][idxAkhir] || '';
      var row = model.sumber[model.minggu[idxAkhir]];
      var durasi = '';
      if (!model.rata && row) durasi = bacaAspek(row, a.key).durasi;
      if (!prog) {
        hasil.push('Program ' + a.label + ' minggu ini belum diisi.');
        return;
      }
      hasil.push('Program ' + a.label + ' minggu ini: ' + prog +
        (durasi ? ' (' + durasi + ')' : '') + '.');
    });

    return hasil;
  }

  function penjelasanHtml(model) {
    var daftar = penjelasan(model);
    if (!daftar.length) {
      return UI.emptyState('Belum ada data untuk dirangkum.', 'info');
    }
    return '<ul class="mon-explain">' + daftar.map(function (t) {
      return '<li>' + Utils.esc(t) + '</li>';
    }).join('') + '</ul>';
  }

  /* ============================ grafik ============================ */

  // Pita latar tipis: 1-3 Rendah, 4-6 Sedang, 7-8 Tinggi, 9-10 Sangat Tinggi.
  var pitaIntensitas = {
    id: 'pitaIntensitas',
    beforeDatasetsDraw: function (chart) {
      var y = chart.scales && chart.scales.y;
      var x = chart.scales && chart.scales.x;
      if (!y || !x) return;
      var ctx = chart.ctx;
      var pita = [
        { bawah: 0, atas: 3, warna: 'rgba(22, 163, 74, 0.09)' },
        { bawah: 3, atas: 6, warna: 'rgba(234, 179, 8, 0.09)' },
        { bawah: 6, atas: 8, warna: 'rgba(251, 146, 60, 0.09)' },
        { bawah: 8, atas: 10, warna: 'rgba(239, 68, 68, 0.09)' }
      ];
      ctx.save();
      pita.forEach(function (p) {
        var yAtas = y.getPixelForValue(p.atas);
        var yBawah = y.getPixelForValue(p.bawah);
        ctx.fillStyle = p.warna;
        ctx.fillRect(x.left, yAtas, x.right - x.left, yBawah - yAtas);
      });
      ctx.restore();
    }
  };

  function gambarGrafik(canvas, model) {
    return Charts.load().then(function (Chart) {
      Charts.destroy(canvas);
      canvas.style.display = '';
      var host = canvas.parentElement;
      if (host) {
        var fb = host.querySelector('.chart-fallback');
        if (fb && fb.parentNode) fb.parentNode.removeChild(fb);
        host.style.minWidth = model.labels.length > 8
          ? Math.max(560, model.labels.length * 78) + 'px'
          : '';
      }

      var datasets = ASPESK.map(function (a) {
        return {
          label: a.label,
          data: model.seri[a.key],
          borderColor: a.warna,
          backgroundColor: a.warna + '22',
          tension: 0.3,
          fill: false,
          spanGaps: true,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: a.warna,
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1.5
        };
      });

      canvas._chart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { labels: model.labels, datasets: datasets },
        plugins: [pitaIntensitas],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              position: 'top',
              align: 'start',
              labels: {
                usePointStyle: true, boxWidth: 8, padding: 16,
                color: '#334155', font: { size: 12, family: 'inherit' }
              }
            },
            tooltip: {
              backgroundColor: '#051b42',
              borderColor: 'rgba(214, 40, 57, 0.45)',
              borderWidth: 1,
              padding: 10,
              cornerRadius: 8,
              titleFont: { size: 12 },
              bodyFont: { size: 12 },
              callbacks: {
                title: function (items) {
                  if (!items.length) return '';
                  return model.judul[items[0].dataIndex] || '';
                },
                label: function (ctx) {
                  var i = ctx.dataIndex;
                  var a = ASPESK[ctx.datasetIndex];
                  if (!a) return '';
                  var nilai = model.seri[a.key][i];
                  if (nilai === null || nilai === undefined) return a.label + ': belum diisi';
                  var t = tingkatIntensitas(nilai);
                  var teks = a.label + ': ' + nilai + (t ? ' (' + t.label + ')' : '');
                  var prog = model.program[a.key][i];
                  if (prog) teks += ' - ' + potong(prog, 42);
                  return teks;
                },
                afterBody: function (items) {
                  if (!items.length) return '';
                  var i = items[0].dataIndex;
                  var keluar = ['Rentang: ' + (model.rentang[i] || '')];
                  if (model.rata) keluar.push('Jumlah atlet: ' + (model.jumlahAtlet[i] || 0));
                  return keluar;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: '#64748b', font: { size: 11 }, maxRotation: 0, autoSkipPadding: 12 }
            },
            y: {
              min: 0,
              max: 10,
              beginAtZero: true,
              grid: { color: '#e2e8f0' },
              ticks: { color: '#64748b', font: { size: 11 }, stepSize: 1, precision: 0 },
              title: {
                display: true,
                text: 'Intensitas Latihan (1-10)',
                color: '#64748b',
                font: { size: 11 }
              }
            }
          }
        }
      });
      return canvas._chart;
    }).catch(function (err) {
      canvas.style.display = 'none';
      var host = canvas.parentElement;
      if (!host) return;
      var fb = host.querySelector('.chart-fallback');
      if (!fb) {
        fb = document.createElement('div');
        fb.className = 'chart-fallback';
        host.appendChild(fb);
      }
      fb.textContent = (err && err.message) || 'Grafik tidak dapat dimuat.';
    });
  }

  /* ============================ opsi atlet ============================ */

  function opsiAtlet(termasukSemua) {
    var daftar = [{ value: '', label: '-- Pilih atlet --' }];
    if (termasukSemua) daftar.push({ value: '*', label: 'Semua Atlet' });
    Shared.activeAthletes().forEach(function (a) {
      daftar.push({ value: a.id_atlet, label: a.nama + ' (' + a.id_atlet + ')' });
    });
    return daftar;
  }

  function opsiFilterAtlet() {
    var daftar = [{ value: '*', label: 'Rata-rata Semua Atlet' }];
    Shared.activeAthletes().forEach(function (a) {
      daftar.push({ value: a.id_atlet, label: a.nama + ' (' + a.id_atlet + ')' });
    });
    return daftar;
  }

  function opsiRentang() {
    return [
      { value: '4', label: '4 minggu terakhir' },
      { value: '8', label: '8 minggu terakhir' },
      { value: '13', label: '3 bulan terakhir' },
      { value: 'all', label: 'Semua minggu' }
    ];
  }

  /* ============================ data contoh (demo) ============================ */

  var CONTOH_FLAG = 'mon_demo';
  var CONTOH_MINGGU = 6;

  var CONTOH_PROGRAM = {
    fisik: [
      ['Daya tahan aerobik & lari interval', '3x seminggu, 45 menit'],
      ['Kekuatan kaki & core (squat, plank)', '3x seminggu, 40 menit'],
      ['Kecepatan reaksi & akselerasi', '2x seminggu, 35 menit'],
      ['Kelincahan footwork ladder', '3x seminggu, 30 menit'],
      ['Daya tahan anaerobik (interval shuttle)', '2x seminggu, 50 menit'],
      ['Kekuatan lengan & pergelangan', '2x seminggu, 35 menit']
    ],
    teknik: [
      ['Footwork 6 titik', '4x seminggu, 30 menit'],
      ['Smash & drive dari belakang', '3x seminggu, 40 menit'],
      ['Drop shot & netting depan', '3x seminggu, 35 menit'],
      ['Servis pendek & panjang', '2x seminggu, 25 menit'],
      ['Block & counter depan net', '3x seminggu, 30 menit'],
      ['Kombinasi pukulan belakang lapangan', '3x seminggu, 45 menit']
    ],
    taktik: [
      ['Pola serangan depan-belakang', '2x seminggu, 40 menit'],
      ['Pola bertahan & counter attack', '2x seminggu, 35 menit'],
      ['Rotasi ganda (drive & net)', '2x seminggu, 40 menit'],
      ['Pola tunggal bertahan', '2x seminggu, 35 menit'],
      ['Variasi tempo permainan', '2x seminggu, 30 menit'],
      ['Membaca pola permainan lawan', '2x seminggu, 35 menit']
    ],
    mental: [
      ['Fokus & konsentrasi poin kritis', '2x seminggu, 20 menit'],
      ['Percaya diri sebelum pertandingan', '2x seminggu, 20 menit'],
      ['Mengelola tekanan saat rubber game', '2x seminggu, 25 menit'],
      ['Visualisasi pertandingan', '2x seminggu, 20 menit'],
      ['Pernapasan & relaksasi otot', '2x seminggu, 15 menit'],
      ['Rutinitas persiapan pra-pertandingan', '2x seminggu, 20 menit']
    ]
  };

  var CONTOH_CATATAN_ASPESK = {
    fisik: ['Napas terasa lebih panjang.', 'Daya tahan kaki mulai meningkat.', 'Jaga pola makan dan istirahat.', '', 'Interval shuttle sudah bisa diselesaikan penuh.', ''],
    teknik: ['Footwork sudah lebih rapi.', 'Arah smash masih perlu dijaga.', 'Drop shot mulai konsisten.', '', 'Netting depan lebih percaya diri.', ''],
    taktik: ['Rotasi depan-belakang mulai lancar.', '', 'Pola serangan sudah terbaca.', '', 'Mulai berani mengubah tempo.', ''],
    mental: ['', 'Lebih tenang saat poin ketat.', '', 'Visualisasi sebelum latihan membantu.', '', 'Fokus di akhir set sudah membaik.']
  };

  var CONTOH_CATATAN_PELATIH = [
    'Mulai program baru, sesuaikan beban latihan.',
    '',
    'Kehadiran latihan sudah bagus, pertahankan.',
    'Ada peningkatan di aspek teknik, lanjutkan.',
    'Persiapkan fisik untuk turnamen bulan depan.',
    'Bagus, pertahankan fokus dan jaga kondisi.'
  ];

  function nilaiContoh(aspekIdx, atletIdx, mingguIdx, total) {
    var basis = [6, 7, 5, 6][aspekIdx];
    var bakat = [1, -1, 0][atletIdx % 3];
    var naik = total > 1 ? Math.round((mingguIdx / (total - 1)) * 3) : 0;
    var variasi = ((aspekIdx * 3 + atletIdx * 2 + mingguIdx * 5) % 3) - 1;
    return Math.max(1, Math.min(10, basis + bakat + naik + variasi));
  }

  function contohAspek(nama, aspekIdx, atletIdx, mingguIdx, total, isiKosong) {
    if (isiKosong) return { program: '', durasi: '', intensitas: null, catatan: '' };
    var pilih = CONTOH_PROGRAM[nama][mingguIdx % CONTOH_PROGRAM[nama].length];
    return {
      program: pilih[0],
      durasi: pilih[1],
      intensitas: nilaiContoh(aspekIdx, atletIdx, mingguIdx, total),
      catatan: CONTOH_CATATAN_ASPESK[nama][mingguIdx % CONTOH_CATATAN_ASPESK[nama].length] || ''
    };
  }

  function tandaiContoh() {
    try {
      localStorage.setItem(CONFIG.PREFIX + CONTOH_FLAG, '1');
    } catch (e) {}
  }

  function sudahContoh() {
    try {
      return localStorage.getItem(CONFIG.PREFIX + CONTOH_FLAG) === '1';
    } catch (e) {
      return true;
    }
  }

  // Mengisi data contoh satu kali (bila belum ada data sama sekali) supaya
  // menu Monitoring langsung menampilkan grafik dan penjelasan.
  function isiDataContoh(userId) {
    if (sudahContoh()) return false;
    if (semuaRow().length) {
      tandaiContoh();
      return false;
    }
    var daftar = Shared.activeAthletes();
    if (!daftar.length) {
      tandaiContoh();
      return false;
    }

    var seninIni = seninDari(Utils.todayISO());
    var daftarMinggu = [];
    for (var i = CONTOH_MINGGU - 1; i >= 0; i--) {
      daftarMinggu.push(Utils.addDaysISO(seninIni, -7 * i));
    }

    daftar.forEach(function (a, atletIdx) {
      daftarMinggu.forEach(function (tgl, w) {
        Store.insert(KOLEKSI, {
          idAtlet: a.id_atlet,
          tanggalMulai: tgl,
          mingguKe: w + 1,
          fisik: contohAspek('fisik', 0, atletIdx, w, CONTOH_MINGGU, false),
          teknik: contohAspek('teknik', 1, atletIdx, w, CONTOH_MINGGU, false),
          taktik: contohAspek('taktik', 2, atletIdx, w, CONTOH_MINGGU, w === 2 && atletIdx === 1),
          mental: contohAspek('mental', 3, atletIdx, w, CONTOH_MINGGU, w === 0),
          catatanPelatih: CONTOH_CATATAN_PELATIH[(w + atletIdx) % CONTOH_CATATAN_PELATIH.length] || '',
          dibuatOleh: userId || '',
          diperbarui: Utils.nowISO()
        });
      });
    });

    tandaiContoh();
    return true;
  }

  /* ============================ tab: input program ============================ */

  function kartuAspek(a, data) {
    var isi = (data.aspek && data.aspek[a.key]) || { program: '', durasi: '', intensitas: null, catatan: '', konversi: false };
    var n = isi.intensitas;
    var nTeks = (n === null || n === undefined) ? '' : n;
    var tingkat = tingkatIntensitas(n);
    return '<div class="mon-aspek" style="--mon-warna:' + a.warna + '">' +
      '<div class="mon-aspek-head"><span class="mon-dot"></span><h4>' + Utils.esc(a.judul) + '</h4></div>' +
      '<div class="form-grid cols-2">' +
      UI.field({
        name: a.key + '_program', label: 'Nama / isi program', type: 'textarea', rows: 2,
        value: isi.program, placeholder: 'Contoh: ' + a.contoh
      }) +
      UI.field({
        name: a.key + '_durasi', label: 'Durasi / frekuensi per minggu',
        value: isi.durasi, placeholder: 'Contoh: 3x seminggu, 45 menit'
      }) +
      '</div>' +
      '<div class="field">' +
      '<label class="label" for="f-' + a.key + '_intensitas">Intensitas Latihan</label>' +
      '<div class="mon-nilai-row">' +
      '<input class="mon-slider" type="range" min="1" max="10" step="1"' +
      ' data-slider="' + a.key + '_intensitas" value="' + (n === null || n === undefined ? 5 : n) + '"' +
      ' aria-label="Intensitas latihan ' + Utils.esc(a.label) + '">' +
      '<input class="input" type="number" name="' + a.key + '_intensitas" id="f-' + a.key + '_intensitas"' +
      ' min="1" max="10" step="1" placeholder="1 - 10" value="' + Utils.esc(nTeks) + '"' +
      ' aria-label="Angka intensitas latihan ' + Utils.esc(a.label) + '">' +
      '</div>' +
      '<div class="mon-tingkat"><span class="int-badge ' + (tingkat ? tingkat.kelas : 'int-kosong') + '"' +
      ' data-tingkat="' + a.key + '">' + (tingkat ? Utils.esc(tingkat.label) : 'Belum diisi') + '</span></div>' +
      '<div class="help">Seberapa berat latihan minggu ini? 1 = sangat ringan, 10 = sangat berat.</div>' +
      (isi.konversi ? '<div class="mon-konversi">Hasil konversi dari data lama. Silakan periksa dan ubah bila perlu.</div>' : '') +
      '<div class="field-error" data-error-for="' + a.key + '_intensitas"></div>' +
      '</div>' +
      UI.field({
        name: a.key + '_catatan', label: 'Catatan', type: 'textarea', rows: 2,
        value: isi.catatan, placeholder: 'Opsional'
      }) +
      '</div>';
  }

  function dataKosong() {
    return { id_atlet: '', tanggal: Utils.todayISO(), catatan_pelatih: '', aspek: aspekKosong() };
  }

  function dataDariRow(row) {
    var out = {
      id_atlet: row.idAtlet,
      tanggal: row.tanggalMulai,
      catatan_pelatih: row.catatanPelatih || '',
      aspek: aspekKosong()
    };
    ASPESK.forEach(function (a) {
      out.aspek[a.key] = bacaAspek(row, a.key);
    });
    return out;
  }

  function formHtml(data, editRow) {
    return '<form id="form-mon" novalidate>' +
      '<div class="form-grid cols-2">' +
      UI.field({
        name: 'id_atlet', label: 'Atlet', type: 'select', required: true,
        value: data.id_atlet, options: opsiAtlet(true)
      }) +
      UI.field({
        name: 'tanggal', label: 'Tanggal dalam Minggu Program', type: 'date', required: true,
        value: data.tanggal,
        help: 'Isi tanggal apa pun pada minggu program, otomatis menjadi Senin-Minggu.'
      }) +
      '</div>' +
      '<div class="mon-minggu-info" id="mon-minggu-info"></div>' +
      (editRow ? '<div class="notice mb-2">' + UI.icon('info', 20) +
        '<div>Mode edit: data minggu ini sudah ada. Menyimpan akan memperbarui data tersebut.</div></div>' : '') +
      '<div class="mon-kumpulan">' + ASPESK.map(function (a) {
        return kartuAspek(a, data);
      }).join('') + '</div>' +
      UI.field({
        name: 'catatan_pelatih', label: 'Catatan Pelatih', type: 'textarea', rows: 2,
        value: data.catatan_pelatih,
        placeholder: 'Catatan umum untuk atlet pada minggu ini (opsional).'
      }) +
      '<div class="sticky-save">' +
      '<div class="flex gap-1 flex-wrap">' +
      '<button class="btn" type="submit">' + UI.icon('save', 20) + ' Simpan</button>' +
      '<button class="btn btn-ghost" type="button" data-mon-batal>Batal</button>' +
      '<button class="btn btn-secondary" type="button" data-mon-reset>Reset</button>' +
      '</div>' +
      '</div>' +
      '</form>';
  }

  function isiBarisPil(nilai, warna) {
    if (nilai === null || nilai === undefined) {
      return '<span class="score-pill" style="opacity:.55">-</span>';
    }
    var t = tingkatIntensitas(nilai);
    return '<span class="score-pill" style="border-color:' + warna + ';color:' + warna + '">' +
      Utils.esc(nilai) + (t ? ' <span class="int-mini">' + Utils.esc(t.label) + '</span>' : '') + '</span>';
  }

  function riwayatHtml(rows, peta) {
    if (!rows.length) return UI.emptyState('Belum ada data riwayat monitoring.', 'chart');
    var tampil = rows.slice(0, 60);
    return '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>Atlet</th><th>Minggu</th><th class="align-center">Fisik</th>' +
      '<th class="align-center">Teknik</th><th class="align-center">Taktik</th>' +
      '<th class="align-center">Mental</th><th>Catatan Pelatih</th><th class="align-center">Aksi</th>' +
      '</tr></thead><tbody>' +
      tampil.map(function (r) {
        return '<tr>' +
          '<td><b>' + Utils.esc(namaAtlet(r.idAtlet)) + '</b>' +
          '<div class="small muted">' + Utils.esc(r.idAtlet) + '</div></td>' +
          '<td>Minggu ' + (peta[r.tanggalMulai] || 1) +
          '<div class="small muted">' + Utils.esc(rentangTeks(r.tanggalMulai)) + '</div></td>' +
          '<td class="align-center">' + isiBarisPil(intensitasDari(r, 'fisik'), '#E53935') + '</td>' +
          '<td class="align-center">' + isiBarisPil(intensitasDari(r, 'teknik'), '#43A047') + '</td>' +
          '<td class="align-center">' + isiBarisPil(intensitasDari(r, 'taktik'), '#FB8C00') + '</td>' +
          '<td class="align-center">' + isiBarisPil(intensitasDari(r, 'mental'), '#EC407A') + '</td>' +
          '<td class="small">' + Utils.esc(potong(r.catatanPelatih, 60) || '-') + '</td>' +
          '<td class="align-center"><div class="flex gap-1" style="justify-content:center">' +
          '<button type="button" class="btn btn-sm btn-secondary" data-mon-edit="' + Utils.esc(r.id) + '">Edit</button>' +
          '<button type="button" class="btn btn-sm btn-danger" data-mon-hapus="' + Utils.esc(r.id) + '">Hapus</button>' +
          '</div></td></tr>';
      }).join('') + '</tbody></table></div>' +
      (rows.length > 60 ? '<p class="small muted mt-2">Menampilkan 60 data terbaru dari ' + rows.length + ' data.</p>' : '');
  }

  /* ============================ tab: grafik ============================ */

  function catatanHtml(model) {
    if (model.rata) {
      return '<div class="notice">' + UI.icon('info', 20) +
        '<div>Pilih satu atlet tertentu pada filter di atas untuk mengisi dan menyimpan Catatan Pelatih.</div></div>';
    }
    if (!model.minggu.length) return UI.emptyState('Belum ada minggu untuk diberi catatan.', 'clipboard');
    return '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th style="width:170px">Minggu</th><th>Catatan Pelatih</th>' +
      '</tr></thead><tbody>' +
      model.minggu.map(function (tgl, i) {
        return '<tr>' +
          '<td><b>' + Utils.esc(model.labels[i]) + '</b>' +
          '<div class="small muted">' + Utils.esc(model.rentang[i]) + '</div></td>' +
          '<td>' + (model.rowId[i]
            ? '<textarea class="input" rows="2" data-mon-catatan="' + Utils.esc(model.rowId[i]) +
            '" placeholder="Tulis catatan pelatih untuk minggu ini.">' +
            Utils.esc(model.catatan[i]) + '</textarea>'
            : '<span class="muted small">Belum ada data minggu ini.</span>') + '</td>' +
          '</tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="mt-2"><button type="button" class="btn" data-mon-simpan-catatan>' +
      UI.icon('save', 20) + ' Simpan Catatan</button></div>';
  }

  /* ============================ halaman pelatih ============================ */

  function monitoringCoach(root, user, app) {
    migrasiIntensitasSekali();
    isiDataContoh(user && user.id);

    root.innerHTML =
      '<div class="page">' +
      UI.pageHeader('Monitoring', 'Program latihan mingguan, intensitas latihan, dan grafik perkembangan atlet.') +
      '<div class="card">' +
      UI.tabs([
        { id: 'input', label: 'Input Program' },
        { id: 'grafik', label: 'Grafik Monitoring' }
      ], 'input') +
      '<div id="mon-body"></div>' +
      '</div></div>';

    var page = root.querySelector('.page');
    var body = page.querySelector('#mon-body');
    var tabAktif = 'input';
    var data = dataKosong();
    var editRow = null;
    var simpanLock = 0;
    var filter = { idAtlet: '', rentang: '8' };

    function refreshMingguInfo() {
      var host = body.querySelector('#mon-minggu-info');
      if (!host) return;
      var form = body.querySelector('#form-mon');
      var tgl = form ? form.querySelector('[name="tanggal"]') : null;
      var val = tgl ? tgl.value : '';
      if (!val) {
        host.innerHTML = '<span class="muted small">Pilih tanggal untuk melihat minggu program.</span>';
        return;
      }
      var senin = seninDari(val);
      var rows = semuaRow();
      var nomor = nomorMinggu(senin, rows);
      host.innerHTML = '<b>Minggu ke-' + nomor + '</b> &middot; ' + Utils.esc(rentangTeks(senin)) +
        '<div class="small muted">Tanggal mulai: ' + Utils.fmtDate(senin, true) + ' (Senin) s.d. ' +
        Utils.fmtDate(tglAkhir(senin), true) + ' (Minggu)</div>';
    }

    function muatDariRow(row) {
      editRow = row || null;
      data = row ? dataDariRow(row) : {
        id_atlet: data.id_atlet,
        tanggal: data.tanggal,
        catatan_pelatih: '',
        aspek: aspekKosong()
      };
    }

    function terapkanKeForm() {
      var form = body.querySelector('#form-mon');
      if (!form) return;
      form.querySelector('[name="id_atlet"]').value = data.id_atlet;
      form.querySelector('[name="tanggal"]').value = data.tanggal;
      form.querySelector('[name="catatan_pelatih"]').value = data.catatan_pelatih;
      ASPESK.forEach(function (a) {
        var info = (data.aspek && data.aspek[a.key]) || bacaAspek(data, a.key);
        form.querySelector('[name="' + a.key + '_program"]').value = info.program;
        form.querySelector('[name="' + a.key + '_durasi"]').value = info.durasi;
        form.querySelector('[name="' + a.key + '_intensitas"]').value = info.intensitas === null ? '' : info.intensitas;
        form.querySelector('[name="' + a.key + '_catatan"]').value = info.catatan;
        var slider = form.querySelector('[data-slider="' + a.key + '_intensitas"]');
        if (slider) slider.value = info.intensitas === null ? 5 : info.intensitas;
        perbaruiTingkat(form, a.key + '_intensitas');
      });
      Utils.clearErrors(form);
      refreshMingguInfo();
    }

    function muatOtomatis() {
      var form = body.querySelector('#form-mon');
      if (!form) return;
      var idAtlet = form.querySelector('[name="id_atlet"]').value;
      var tanggal = form.querySelector('[name="tanggal"]').value;
      if (!idAtlet || !tanggal) {
        editRow = null;
        refreshMingguInfo();
        return;
      }
      var senin = seninDari(tanggal);
      var row = null;
      if (idAtlet === '*') {
        var kumpul = rowsUntukMinggu(senin);
        row = kumpul.length ? kumpul[0] : null;
      } else {
        row = rowUntuk(idAtlet, senin);
      }
      if (row) {
        muatDariRow(row);
        terapkanKeForm();
        return;
      }
      editRow = null;
      refreshMingguInfo();
    }

    function renderInputTab() {
      body.innerHTML = formHtml(data, editRow) +
        '<h4 class="mt-3">Riwayat Input Monitoring</h4>' +
        '<div class="filter-bar">' +
        '<select class="input" id="mon-r-filter" style="max-width:260px">' +
        '<option value="">Semua atlet</option>' +
        Shared.activeAthletes().map(function (a) {
          return '<option value="' + Utils.esc(a.id_atlet) + '">' + Utils.esc(a.nama) + ' (' + Utils.esc(a.id_atlet) + ')</option>';
        }).join('') +
        '</select></div>' +
        '<div id="mon-riwayat"></div>';

      terapkanKeForm();
      renderRiwayat();

      var form = body.querySelector('#form-mon');

      form.addEventListener('input', function (e) {
        var slider = e.target.closest ? e.target.closest('[data-slider]') : null;
        if (slider) {
          var num = form.querySelector('[name="' + slider.getAttribute('data-slider') + '"]');
          if (num) num.value = slider.value;
          perbaruiTingkat(form, slider.getAttribute('data-slider'));
          return;
        }
        if (e.target.name && /_intensitas$/.test(e.target.name)) {
          var slider2 = form.querySelector('[data-slider="' + e.target.name + '"]');
          if (slider2) slider2.value = e.target.value === '' ? 5 : e.target.value;
          perbaruiTingkat(form, e.target.name);
        }
      });

      form.addEventListener('change', function (e) {
        if (e.target.name === 'id_atlet' || e.target.name === 'tanggal') muatOtomatis();
      });

      UI.bindSubmit(form, function () {
        Utils.clearErrors(form);
        var sekarang = Date.now();
        if (sekarang - simpanLock < 700) return;
        var isi = Utils.formData(form);
        var errors = {};
        if (!isi.id_atlet) errors.id_atlet = 'Pilih atlet terlebih dahulu.';
        if (!isi.tanggal) errors.tanggal = 'Tanggal wajib diisi.';

        var payload = aspekKosong();
        var adaBagian = false;
        ASPESK.forEach(function (a) {
          var program = isi[a.key + '_program'] || '';
          var durasi = isi[a.key + '_durasi'] || '';
          var catatan = isi[a.key + '_catatan'] || '';
          var intensitasTeks = isi[a.key + '_intensitas'];
          var aktif = !!(program.trim() || durasi.trim() || catatan.trim() || intensitasTeks !== '');
          if (!aktif) return;
          adaBagian = true;
          var n = null;
          if (intensitasTeks !== '' && intensitasTeks !== undefined) {
            n = Number(intensitasTeks);
            if (isNaN(n) || n !== Math.round(n) || n < 1 || n > 10) {
              errors[a.key + '_intensitas'] = 'Intensitas latihan harus berupa angka bulat 1 sampai 10.';
              return;
            }
          }
          payload[a.key] = {
            program: program,
            durasi: durasi,
            intensitas: n,
            catatan: catatan
          };
        });

        if (Object.keys(errors).length) {
          simpanLock = 0;
          Utils.showErrors(form, errors);
          Utils.toast('Periksa kembali isian yang ditandai.', 'danger');
          return;
        }
        if (!adaBagian) {
          simpanLock = 0;
          Utils.toast('Isi minimal satu bagian program (fisik, teknik, taktik, atau mental).', 'danger');
          return;
        }

        simpanLock = sekarang;
        var senin = seninDari(isi.tanggal);
        var target = isi.id_atlet === '*'
          ? Shared.activeAthletes().map(function (a) {
            return a.id_atlet;
          })
          : [isi.id_atlet];

        if (!target.length) {
          simpanLock = 0;
          Utils.toast('Tidak ada atlet aktif untuk disimpan.', 'danger');
          return;
        }

        var rowsSemua = semuaRow();
        target.forEach(function (idAtlet) {
          var ada = rowUntuk(idAtlet, senin);
          var isiRow = {
            idAtlet: idAtlet,
            tanggalMulai: senin,
            fisik: payload.fisik,
            teknik: payload.teknik,
            taktik: payload.taktik,
            mental: payload.mental,
            catatanPelatih: isi.catatan_pelatih || '',
            dibuatOleh: user.id,
            diperbarui: Utils.nowISO()
          };
          isiRow.mingguKe = nomorMinggu(senin, rowsSemua);
          if (ada) Store.update(KOLEKSI, ada.id, isiRow);
          else Store.insert(KOLEKSI, isiRow);
        });

        var jumlah = target.length;
        Utils.toast(
          jumlah > 1
            ? 'Program mingguan disimpan untuk ' + jumlah + ' atlet.'
            : 'Program mingguan berhasil disimpan.',
          'success'
        );

        muatDariRow(null);
        data = dataKosong();
        renderInputTab();
      });
    }

    function renderRiwayat() {
      var host = body.querySelector('#mon-riwayat');
      if (!host) return;
      var filterEl = body.querySelector('#mon-r-filter');
      var nilai = filterEl ? filterEl.value : '';
      var rows = semuaRow();
      if (nilai) {
        rows = rows.filter(function (r) {
          return r.idAtlet === nilai;
        });
      }
      rows = rows.slice().sort(function (a, b) {
        if (a.tanggalMulai !== b.tanggalMulai) return a.tanggalMulai < b.tanggalMulai ? 1 : -1;
        var na = namaAtlet(a.idAtlet);
        var nb = namaAtlet(b.idAtlet);
        return na < nb ? -1 : na > nb ? 1 : 0;
      });
      var peta = petaMinggu(rows);
      host.innerHTML = riwayatHtml(rows, peta);
    }

    function renderGrafikTab() {
      var atletTerpilih = filter.idAtlet;
      if (!atletTerpilih || atletTerpilih === '') {
        var daftar = Shared.activeAthletes();
        atletTerpilih = daftar.length ? daftar[0].id_atlet : '*';
        filter.idAtlet = atletTerpilih;
      }
      body.innerHTML =
        '<div class="filter-bar">' +
        '<select class="input" id="mon-g-atlet" style="max-width:260px" aria-label="Filter atlet">' +
        opsiFilterAtlet().map(function (o) {
          return '<option value="' + Utils.esc(o.value) + '"' +
            (o.value === atletTerpilih ? ' selected' : '') + '>' + Utils.esc(o.label) + '</option>';
        }).join('') +
        '</select>' +
        '<select class="input" id="mon-g-rentang" style="max-width:220px" aria-label="Filter rentang minggu">' +
        opsiRentang().map(function (o) {
          return '<option value="' + Utils.esc(o.value) + '"' +
            (o.value === String(filter.rentang) ? ' selected' : '') + '>' + Utils.esc(o.label) + '</option>';
        }).join('') +
        '</select>' +
        '</div>' +
        '<div id="mon-ringkas"></div>' +
        '<h4>Grafik Monitoring</h4>' +
        '<div id="mon-chart-empty"></div>' +
        '<div class="mon-scroll" id="mon-chart-wrap"><div class="chart-box tall"><canvas id="chart-mon"></canvas></div></div>' +
        '<div class="mon-divider"></div>' +
        '<h4>Penjelasan</h4>' +
        '<div id="mon-explain"></div>' +
        '<div class="mon-divider"></div>' +
        '<h4>Catatan Pelatih</h4>' +
        '<div id="mon-catatan"></div>';

      gambarIsi();
    }

    function gambarIsi() {
      var model = bangunModel(filter);
      var ringkas = body.querySelector('#mon-ringkas');
      if (ringkas) ringkas.innerHTML = ringkasHtml(model);
      var explain = body.querySelector('#mon-explain');
      if (explain) explain.innerHTML = penjelasanHtml(model);
      var catatan = body.querySelector('#mon-catatan');
      if (catatan) catatan.innerHTML = catatanHtml(model);

      var canvas = body.querySelector('#chart-mon');
      var kosong = body.querySelector('#mon-chart-empty');
      var wrap = body.querySelector('#mon-chart-wrap');
      if (!canvas) return;
      if (!model.minggu.length) {
        Charts.destroy(canvas);
        if (wrap) wrap.hidden = true;
        if (kosong) kosong.innerHTML = UI.emptyState('Belum ada data monitoring untuk ditampilkan.', 'chart');
        return;
      }
      if (wrap) wrap.hidden = false;
      if (kosong) kosong.innerHTML = '';
      gambarGrafik(canvas, model);
    }

    function renderBody() {
      if (tabAktif === 'grafik') renderGrafikTab();
      else renderInputTab();
    }

    function gantiTab(id) {
      if (id === tabAktif) return;
      if (App.isDirty()) {
        UI.confirmDialog('Data belum disimpan, yakin kembali?', 'Konfirmasi Pindah Tab').then(function (ok) {
          if (!ok) return;
          App.setDirty(false);
          tabAktif = id;
          renderBody();
        });
        return;
      }
      tabAktif = id;
      renderBody();
    }

    renderBody();

    page.addEventListener('click', function (e) {
      var tab = e.target.closest('[data-tab]');
      if (tab) {
        gantiTab(tab.getAttribute('data-tab'));
        page.querySelectorAll('.tab').forEach(function (t) {
          t.classList.toggle('active', t.getAttribute('data-tab') === tab.getAttribute('data-tab'));
        });
        return;
      }

      if (e.target.closest('[data-mon-batal]')) {
        muatDariRow(null);
        data = dataKosong();
        App.setDirty(false);
        Utils.toast('Perubahan dibatalkan.', 'info');
        renderInputTab();
        return;
      }

      if (e.target.closest('[data-mon-reset]')) {
        var form = body.querySelector('#form-mon');
        if (form) {
          ASPESK.forEach(function (a) {
            form.querySelector('[name="' + a.key + '_program"]').value = '';
            form.querySelector('[name="' + a.key + '_durasi"]').value = '';
            form.querySelector('[name="' + a.key + '_intensitas"]').value = '';
            form.querySelector('[name="' + a.key + '_catatan"]').value = '';
            var slider = form.querySelector('[data-slider="' + a.key + '_intensitas"]');
            if (slider) slider.value = 5;
            perbaruiTingkat(form, a.key + '_intensitas');
          });
          form.querySelector('[name="catatan_pelatih"]').value = '';
          Utils.clearErrors(form);
        }
        editRow = null;
        Utils.toast('Form dikosongkan.', 'info');
        return;
      }

      var edit = e.target.closest('[data-mon-edit]');
      if (edit) {
        var row = Store.find(KOLEKSI, edit.getAttribute('data-mon-edit'));
        if (!row) return;
        muatDariRow(row);
        App.setDirty(false);
        renderInputTab();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      var hapus = e.target.closest('[data-mon-hapus]');
      if (hapus) {
        var id = hapus.getAttribute('data-mon-hapus');
        UI.confirmDialog('Data monitoring minggu ini akan dihapus. Lanjutkan?', 'Konfirmasi Hapus').then(function (ok) {
          if (!ok) return;
          Store.remove(KOLEKSI, id);
          if (editRow && editRow.id === id) {
            muatDariRow(null);
            data = dataKosong();
          }
          Utils.toast('Data monitoring dihapus.', 'success');
          renderInputTab();
        });
        return;
      }

      if (e.target.closest('[data-mon-simpan-catatan]')) {
        var area = body.querySelectorAll('[data-mon-catatan]');
        if (!area.length) return;
        var lock = Date.now();
        if (simpanLock && lock - simpanLock < 700) return;
        simpanLock = lock;
        var jumlah = 0;
        area.forEach(function (el) {
          var r = Store.find(KOLEKSI, el.getAttribute('data-mon-catatan'));
          if (!r) return;
          if ((r.catatanPelatih || '') === el.value.trim()) return;
          Store.update(KOLEKSI, r.id, {
            catatanPelatih: el.value.trim(),
            dibuatOleh: r.dibuatOleh || user.id,
            diperbarui: Utils.nowISO()
          });
          jumlah++;
        });
        Utils.toast(jumlah ? 'Catatan pelatih berhasil disimpan.' : 'Tidak ada perubahan catatan.',
          jumlah ? 'success' : 'info');
      }
    });

    page.addEventListener('input', function (e) {
      if (e.target && e.target.closest && e.target.closest('[data-mon-catatan]')) {
        app.setDirty(true);
      }
    });

    page.addEventListener('change', function (e) {
      if (e.target.id === 'mon-r-filter') {
        renderRiwayat();
        return;
      }
      if (e.target.id === 'mon-g-atlet') {
        filter.idAtlet = e.target.value;
        gambarIsi();
        return;
      }
      if (e.target.id === 'mon-g-rentang') {
        filter.rentang = e.target.value;
        gambarIsi();
      }
    });

    app.subscribe(KOLEKSI, function () {
      if (tabAktif === 'grafik') gambarIsi();
      else renderRiwayat();
    });
  }

  /* ============================ halaman atlet ============================ */

  function monitoringAtlet(root, user, app) {
    migrasiIntensitasSekali();
    var athlete = Store.findOne('athletes', function (a) {
      return a.id_atlet === user.id_atlet || a.user_id === user.id;
    });
    if (!athlete) {
      root.innerHTML = '<div class="page">' + UI.emptyState('Data atlet tidak ditemukan. Hubungi pelatih kepala.', 'alert') + '</div>';
      return;
    }

    root.innerHTML =
      '<div class="page">' +
      UI.pageHeader('Monitoring Saya', 'Grafik intensitas latihan dan catatan pelatih untuk ' + athlete.nama + '.') +
      '<div id="mon-isi"></div>' +
      '</div>';

    var page = root.querySelector('.page');
    var host = page.querySelector('#mon-isi');
    var filter = { idAtlet: athlete.id_atlet, rentang: '8' };

    function kosongHtml() {
      return '<div class="card">' +
        '<div class="empty-state">' +
        '<svg class="mon-ilustrasi" width="140" height="96" viewBox="0 0 140 96" fill="none" aria-hidden="true">' +
        '<rect x="8" y="8" width="124" height="80" rx="14" fill="#e6eefb" stroke="#c7d7f0" stroke-width="2"/>' +
        '<path d="M28 70V34" stroke="#9db6dd" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M28 70h84" stroke="#9db6dd" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M38 62l18-14 16 8 20-22" stroke="#0b3d91" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<circle cx="38" cy="62" r="5" fill="#E53935"/>' +
        '<circle cx="56" cy="48" r="5" fill="#43A047"/>' +
        '<circle cx="72" cy="56" r="5" fill="#FB8C00"/>' +
        '<circle cx="92" cy="34" r="5" fill="#EC407A"/>' +
        '</svg>' +
        '<p class="fw-bold">Belum ada data monitoring</p>' +
        '<p class="small">Program latihan mingguan Anda akan muncul di sini setelah diinput oleh pelatih kepala.</p>' +
        '</div></div>';
    }

    function gambarIsi() {
      var rows = rowsUntukAtlet(athlete.id_atlet);
      if (!rows.length) {
        host.innerHTML = kosongHtml();
        return;
      }
      var model = bangunModel(filter);

      host.innerHTML =
        '<div class="filter-bar">' +
        '<select class="input" id="mon-a-rentang" style="max-width:220px" aria-label="Filter rentang minggu">' +
        opsiRentang().map(function (o) {
          return '<option value="' + Utils.esc(o.value) + '"' +
            (o.value === String(filter.rentang) ? ' selected' : '') + '>' + Utils.esc(o.label) + '</option>';
        }).join('') +
        '</select></div>' +
        '<div id="mon-a-ringkas"></div>' +
        '<div class="card">' +
        '<div class="card-title">' + UI.icon('chart', 20) + 'Grafik Monitoring</div>' +
        '<div class="mon-scroll"><div class="chart-box tall"><canvas id="chart-mon-saya"></canvas></div></div>' +
        '</div>' +
        '<div class="card mt-2">' +
        '<div class="card-title">' + UI.icon('info', 20) + 'Penjelasan</div>' +
        '<div id="mon-a-explain"></div>' +
        '</div>' +
        '<div class="card mt-2">' +
        '<div class="card-title">' + UI.icon('clipboard', 20) + 'Catatan Pelatih</div>' +
        '<div id="mon-a-catatan"></div>' +
        '</div>';

      var ringkas = host.querySelector('#mon-a-ringkas');
      if (ringkas) ringkas.innerHTML = ringkasHtml(model);
      var explain = host.querySelector('#mon-a-explain');
      if (explain) explain.innerHTML = penjelasanHtml(model);
      var catatan = host.querySelector('#mon-a-catatan');
      if (catatan) catatan.innerHTML = catatanBacaHtml(model);

      var canvas = host.querySelector('#chart-mon-saya');
      if (canvas) gambarGrafik(canvas, model);
    }

    gambarIsi();

    page.addEventListener('change', function (e) {
      if (e.target.id === 'mon-a-rentang') {
        filter.rentang = e.target.value;
        gambarIsi();
      }
    });

    app.subscribe(KOLEKSI, gambarIsi);
  }

  function catatanBacaHtml(model) {
    var ada = model.minggu.some(function (_, i) {
      return !!model.catatan[i];
    });
    if (!ada) {
      return UI.emptyState('Belum ada catatan dari pelatih.', 'clipboard');
    }
    return '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th style="width:170px">Minggu</th><th>Catatan Pelatih</th>' +
      '</tr></thead><tbody>' +
      model.minggu.map(function (tgl, i) {
        return '<tr>' +
          '<td><b>' + Utils.esc(model.labels[i]) + '</b>' +
          '<div class="small muted">' + Utils.esc(model.rentang[i]) + '</div></td>' +
          '<td>' + (model.catatan[i]
            ? Utils.esc(model.catatan[i])
            : '<span class="muted small">Belum ada catatan.</span>') + '</td>' +
          '</tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* ============================ registrasi ============================ */

  function register() {
    App.register('monitoring', {
      title: 'Monitoring',
      subtitle: 'Program mingguan dan grafik intensitas latihan',
      render: monitoringCoach
    });
    App.register('monitoring-saya', {
      title: 'Monitoring Saya',
      subtitle: 'Grafik intensitas latihan Anda',
      render: monitoringAtlet
    });
  }

  return {
    register: register,
    ASPESK: ASPESK,
    seninDari: seninDari,
    bangunModel: bangunModel,
    penjelasan: penjelasan,
    tingkatIntensitas: tingkatIntensitas,
    migrasiIntensitas: migrasiIntensitas,
    isiDataContoh: isiDataContoh
  };
})();

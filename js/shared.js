var Shared = (function () {
  function activeAthletes() {
    return Utils.sortBy(Store.all('athletes').filter(function (a) {
      return a.status !== 'nonaktif';
    }), 'nama', 'asc');
  }

  function latestStamp(row) {
    return row.diperbarui_pada || row.dibuat_pada || '';
  }

  function pickLatest(rows) {
    var best = null;
    rows.forEach(function (r) {
      if (!best || latestStamp(r) >= latestStamp(best)) best = r;
    });
    return best;
  }

  function attendanceFor(dateISO, idAtlet) {
    return pickLatest(Store.where('attendance', function (r) {
      return r.tanggal === dateISO && r.id_atlet === idAtlet && r.tipe === 'atlet';
    }));
  }

  function attendanceOn(dateISO) {
    var rows = Store.where('attendance', function (r) {
      return r.tanggal === dateISO && r.tipe === 'atlet';
    });
    var byAthlete = {};
    rows.forEach(function (r) {
      var cur = byAthlete[r.id_atlet];
      if (!cur || latestStamp(r) >= latestStamp(cur)) byAthlete[r.id_atlet] = r;
    });
    return Object.keys(byAthlete).map(function (k) {
      return byAthlete[k];
    });
  }

  function attendanceSummary(dateISO) {
    var rows = attendanceOn(dateISO);
    var out = { total: rows.length, Hadir: 0, Izin: 0, Sakit: 0, 'Tidak Hadir': 0 };
    rows.forEach(function (r) {
      if (out[r.status] !== undefined) out[r.status]++;
    });
    out.persen = Utils.pct(out.Hadir, out.total);
    return out;
  }

  function attendanceRate(idAtlet, days) {
    var from = Utils.daysAgoISO(days);
    var rows = Store.where('attendance', function (r) {
      return r.id_atlet === idAtlet && r.tipe === 'atlet' && r.tanggal >= from;
    });
    var byDate = {};
    rows.forEach(function (r) {
      var cur = byDate[r.tanggal];
      if (!cur || latestStamp(r) >= latestStamp(cur)) byDate[r.tanggal] = r;
    });
    var unique = Object.keys(byDate).map(function (k) {
      return byDate[k];
    });
    if (!unique.length) return null;
    var hadir = unique.filter(function (r) {
      return r.status === 'Hadir';
    }).length;
    return Utils.pct(hadir, unique.length);
  }

  function attendanceSeries(days) {
    var labels = [];
    var hadir = [];
    var tidak = [];
    for (var i = days - 1; i >= 0; i--) {
      var tgl = Utils.daysAgoISO(i);
      var s = attendanceSummary(tgl);
      labels.push(Utils.fmtDate(tgl));
      hadir.push(s.Hadir);
      tidak.push(s.total - s.Hadir);
    }
    return { labels: labels, hadir: hadir, tidak: tidak };
  }

  function entriesFor(idAtlet, opts) {
    opts = opts || {};
    return Store.where('logbook_entries', function (e) {
      if (e.id_atlet !== idAtlet) return false;
      if (opts.kategori && e.kategori !== opts.kategori) return false;
      if (opts.from && e.tanggal < opts.from) return false;
      if (opts.to && e.tanggal > opts.to) return false;
      return true;
    });
  }

  function parameterSeries(idAtlet, kategori, days) {
    var from = Utils.daysAgoISO(days);
    var entries = entriesFor(idAtlet, { kategori: kategori, from: from });
    var byDate = {};
    entries.forEach(function (e) {
      if (!byDate[e.tanggal]) byDate[e.tanggal] = {};
      byDate[e.tanggal][e.nama_parameter] = Number(e.nilai);
    });
    var dates = Object.keys(byDate).sort();
    var params = [];
    entries.forEach(function (e) {
      if (params.indexOf(e.nama_parameter) === -1) params.push(e.nama_parameter);
    });
    var datasets = params.map(function (p) {
      return {
        label: p,
        data: dates.map(function (d) {
          return byDate[d][p] === undefined ? null : byDate[d][p];
        })
      };
    });
    return {
      labels: dates.map(function (d) {
        return Utils.fmtDate(d);
      }),
      datasets: datasets
    };
  }

  function avgParameter(idAtlet, namaParameter, days) {
    var from = Utils.daysAgoISO(days);
    var rows = entriesFor(idAtlet, { from: from }).filter(function (e) {
      return e.nama_parameter === namaParameter;
    });
    if (!rows.length) return null;
    var sum = rows.reduce(function (acc, r) {
      return acc + Number(r.nilai);
    }, 0);
    return Math.round((sum / rows.length) * 10) / 10;
  }

  function trend(idAtlet, days) {
    var from = Utils.daysAgoISO(days);
    var rows = Utils.sortBy(entriesFor(idAtlet, { from: from }), 'tanggal', 'asc');
    if (rows.length < 2) return null;
    var mid = Math.floor(rows.length / 2);
    var first = rows.slice(0, mid);
    var last = rows.slice(mid);
    var avg = function (arr) {
      return arr.reduce(function (a, r) {
        return a + Number(r.nilai);
      }, 0) / arr.length;
    };
    var delta = avg(last) - avg(first);
    if (delta > 0.4) return { label: 'Meningkat', tone: 'ok', delta: delta };
    if (delta < -0.4) return { label: 'Menurun', tone: 'danger', delta: delta };
    return { label: 'Stabil', tone: 'info', delta: delta };
  }

  function latestTests(idAtlet) {
    var rows = Store.where('physical_tests', function (t) {
      return t.id_atlet === idAtlet;
    });
    var byType = {};
    rows.forEach(function (t) {
      var cur = byType[t.id_tes];
      if (!cur || t.tanggal > cur.tanggal) byType[t.id_tes] = t;
    });
    return Object.keys(byType).map(function (k) {
      return byType[k];
    });
  }

  function testHistory(idAtlet, idTes) {
    return Utils.sortBy(Store.where('physical_tests', function (t) {
      return t.id_atlet === idAtlet && (!idTes || t.id_tes === idTes);
    }), 'tanggal', 'asc');
  }

  function matchesFor(idAtlet) {
    return Utils.sortBy(Store.where('matches', function (m) {
      return !idAtlet || m.id_atlet === idAtlet;
    }), 'tanggal', 'desc');
  }

  function attentionList() {
    var result = [];
    activeAthletes().forEach(function (a) {
      var reasons = [];
      var rate = attendanceRate(a.id_atlet, 30);
      if (rate !== null && rate < 75) reasons.push('Kehadiran 30 hari: ' + rate + '%');
      var t = trend(a.id_atlet, 21);
      if (t && t.label === 'Menurun') reasons.push('Nilai latihan menurun');
      if (reasons.length) {
        result.push({ athlete: a, reasons: reasons, rate: rate });
      }
    });
    return result;
  }

  function lastMatch() {
    var all = Utils.sortBy(Store.all('matches'), 'tanggal', 'desc');
    return all[0] || null;
  }

  function activeParameters(kategori) {
    return Store.all('log_parameters').filter(function (p) {
      return p.aktif && (!kategori || p.kategori === kategori);
    });
  }

  // Badge kategori pertandingan dengan warna berbeda.
  // Data lama yang belum punya kategori tetap tampil dengan label
  // "Belum dikategorikan" dan dapat diedit.
  function badgeKategori(kategori) {
    var k = String(kategori || '').trim();
    if (!k) return UI.badge('Belum dikategorikan', 'muted');
    if (k === 'Tournament') return UI.badge('Tournament', 'primary');
    return UI.badge(k, 'ok');
  }

  // Program latihan sebuah entri logbook. Data lama tanpa program tampil "-".
  function programLatihan(entri) {
    var p = entri && entri.program ? String(entri.program).trim() : '';
    return p || '-';
  }

  function parameterById(id) {
    if (!id) return null;
    return Store.find('log_parameters', id) || null;
  }

  // Nama parameter diambil dari master (berdasarkan id_parameter) supaya
  // penggantian nama parameter langsung ikut tampil. Data lama / parameter
  // yang sudah dihapus tetap terbaca lewat nama yang tersimpan di entri.
  function namaParameter(entri) {
    if (!entri) return '-';
    var p = parameterById(entri.id_parameter);
    if (p && p.nama) return p.nama;
    return entri.nama_parameter || '-';
  }

  function satuanParameter(entri) {
    var p = parameterById(entri.id_parameter);
    return (p && p.satuan) || entri.satuan || 'skala 1-10';
  }

  // "Raka Wijaya (Asisten Pelatih)" - nama penginput + perannya.
  function labelPenginput(entri) {
    if (!entri) return '-';
    var u = entri.input_oleh ? Store.find('users', entri.input_oleh) : null;
    var nama = (u && u.nama) || entri.input_nama || '-';
    var peran = entri.input_peran || (u ? (CONFIG.ROLE_LABEL[u.role] || u.role) : '') || '';
    return peran ? nama + ' (' + peran + ')' : nama;
  }

  // Entri logbook milik satu atlet, terbaru di atas.
  function urutTerbaru(rows) {
    return (rows || []).slice().sort(function (a, b) {
      if (a.tanggal !== b.tanggal) return a.tanggal < b.tanggal ? 1 : -1;
      var ka = a.dibuat_pada || '';
      var kb = b.dibuat_pada || '';
      if (ka !== kb) return ka < kb ? 1 : -1;
      return String(a.id) < String(b.id) ? 1 : -1;
    });
  }

  function catatanAtlet(idAtlet) {
    return urutTerbaru(entriesFor(idAtlet).filter(function (e) {
      return !!String(e.catatan || '').trim();
    }));
  }

  // Program latihan milik satu atlet, dikelompokkan per sesi
  // (satu tanggal + satu kategori = satu program). Tampil read-only di
  // halaman atlet. Sesi tanpa program tidak disertakan.
  function programAtlet(idAtlet) {
    var grup = {};
    entriesFor(idAtlet).forEach(function (e) {
      var p = String(e.program || '').trim();
      if (!p) return;
      var k = e.tanggal + '|' + (e.kategori || '');
      if (!grup[k]) {
        grup[k] = {
          tanggal: e.tanggal,
          kategori: e.kategori || '',
          program: p,
          catatan: String(e.catatan || '').trim(),
          penginput: labelPenginput(e),
          dibuat: e.dibuat_pada || ''
        };
      } else {
        if (!grup[k].catatan && e.catatan) grup[k].catatan = String(e.catatan).trim();
      }
    });
    return Object.keys(grup).map(function (k) {
      return grup[k];
    }).sort(function (a, b) {
      if (a.tanggal !== b.tanggal) return a.tanggal < b.tanggal ? 1 : -1;
      return String(a.kategori) < String(b.kategori) ? -1 : 1;
    });
  }

  // Simpan sekelompok entri logbook (satu atlet + satu tanggal + satu kategori).
  // Nilai kosong = entri dihapus, nilai berubah = entri diperbarui,
  // nilai baru = entri ditambah. Mengembalikan jumlah baris yang disimpan.
  function simpanGrupLogbook(konteks) {
    var daftar = Store.all('log_parameters').filter(function (p) {
      return p.kategori === konteks.kategori;
    });
    var n = 0;
    daftar.forEach(function (p) {
      var nilaiBaru = konteks.nilai && konteks.nilai[p.id];
      var sudah = Store.findOne('logbook_entries', function (e) {
        return e.id_atlet === konteks.idAtlet &&
          e.tanggal === konteks.tanggal &&
          e.id_parameter === p.id;
      });
      var terisi = nilaiBaru !== undefined && nilaiBaru !== null && String(nilaiBaru).trim() !== '';
      if (!terisi) {
        if (sudah) Store.remove('logbook_entries', sudah.id);
        return;
      }
      var nilai = Number(nilaiBaru);
      if (isNaN(nilai)) return;
      var payload = {
        id_atlet: konteks.idAtlet,
        tanggal: konteks.tanggal,
        id_parameter: p.id,
        nama_parameter: p.nama,
        satuan: p.satuan,
        kategori: p.kategori,
        nilai: nilai,
        program: konteks.program || '',
        catatan: konteks.catatan || '',
        input_oleh: (konteks.user && konteks.user.id) || '',
        input_peran: (konteks.user && CONFIG.ROLE_LABEL[konteks.user.role]) || ''
      };
      if (sudah) Store.update('logbook_entries', sudah.id, payload);
      else Store.insert('logbook_entries', payload);
      n++;
    });
    return n;
  }

  // Modal edit satu kelompok entri (satu atlet + tanggal + kategori).
  // Nilai kosong = entri dihapus; dipakai bersama oleh pelatih kepala & asisten.
  function bukaEditorLogbook(konteks) {
    var params = Store.all('log_parameters').filter(function (p) {
      return p.kategori === konteks.kategori;
    });
    var nilai = {};
    var catatan = '';
    var program = '';
    Store.where('logbook_entries', function (e) {
      return e.id_atlet === konteks.idAtlet && e.tanggal === konteks.tanggal && e.kategori === konteks.kategori;
    }).forEach(function (e) {
      if (e.id_parameter) nilai[e.id_parameter] = e.nilai;
      if (e.catatan) catatan = e.catatan;
      if (e.program) program = e.program;
    });

    var a = Store.findOne('athletes', function (x) {
      return x.id_atlet === konteks.idAtlet;
    });
    var body =
      '<div class="detail-grid">' +
      '<div class="detail-item"><div class="k">Atlet</div><div class="v">' + Utils.esc(a ? a.nama : konteks.idAtlet) + '</div></div>' +
      '<div class="detail-item"><div class="k">Tanggal</div><div class="v">' + Utils.fmtDate(konteks.tanggal, true) + '</div></div>' +
      '</div>' +
      '<form id="form-log-edit" novalidate>' +
      (params.length
        ? '<div class="param-grid">' + params.map(function (p) {
          return '<div class="param-item">' +
            '<label class="label">' + Utils.esc(p.nama) + ' <span class="small muted">(' + Utils.esc(p.satuan) + ')</span></label>' +
            '<input class="input" type="number" name="p_' + Utils.esc(p.id) + '" min="1" max="10" step="1" placeholder="1 - 10"' +
            ' value="' + Utils.esc(nilai[p.id] === undefined || nilai[p.id] === null ? '' : nilai[p.id]) + '">' +
            '<div class="field-error" data-error-for="p_' + Utils.esc(p.id) + '"></div></div>';
        }).join('') + '</div>'
        : UI.emptyState('Tidak ada parameter ' + konteks.kategori + ' yang terdaftar.', 'settings')) +
      UI.field({
        name: 'program', label: 'Program Latihan', type: 'textarea', rows: 2, required: true,
        value: program, placeholder: 'contoh: Pemanasan, footwork 6 titik, smash, pendinginan'
      }) +
      UI.field({ name: 'catatan', label: 'Catatan untuk atlet', type: 'textarea', rows: 2, value: catatan }) +
      '<p class="small muted mb-0">Kosongkan nilai untuk menghapus penilaian parameter tersebut.</p>' +
      '</form>';

    document.getElementById('modal-host').innerHTML =
      UI.modalShell('m-log-edit', 'Edit Logbook',
        UI.backButton({ closeModal: 'm-log-edit' }) + body,
        '<button type="button" class="btn btn-ghost" data-back-close="m-log-edit">Batal</button>' +
        '<button type="submit" class="btn" form="form-log-edit">Simpan Perubahan</button>');
    UI.openModal('m-log-edit');

    var form = document.getElementById('form-log-edit');
    UI.bindSubmit(form, function () {
      var d = Utils.formData(form);
      var nilaiBaru = {};
      var salah = false;
      params.forEach(function (p) {
        var v = d['p_' + p.id];
        if (v === '' || v === undefined) {
          nilaiBaru[p.id] = '';
          return;
        }
        var n = Number(v);
        if (isNaN(n) || n < 1 || n > 10) {
          salah = true;
          return;
        }
        nilaiBaru[p.id] = n;
      });
      if (salah) {
        Utils.toast('Nilai harus berupa angka 1 - 10.', 'danger');
        return;
      }
      simpanGrupLogbook({
        idAtlet: konteks.idAtlet,
        tanggal: konteks.tanggal,
        kategori: konteks.kategori,
        nilai: nilaiBaru,
        program: d.program || '',
        catatan: d.catatan || '',
        user: konteks.user
      });
      UI.closeModal('m-log-edit');
      Utils.toast('Perubahan logbook berhasil disimpan.', 'success');
      if (typeof konteks.onSelesai === 'function') konteks.onSelesai();
    });
  }

  // Hapus seluruh entri satu kelompok (atlet + tanggal + kategori).
  function hapusGrupLogbook(idAtlet, tanggal, kategori) {
    return Store.removeWhere('logbook_entries', function (e) {
      return e.id_atlet === idAtlet && e.tanggal === tanggal && e.kategori === kategori;
    });
  }

  function testTypes() {
    return Store.all('test_types');
  }

  return {
    activeAthletes: activeAthletes,
    attendanceFor: attendanceFor,
    attendanceOn: attendanceOn,
    pickLatest: pickLatest,
    attendanceSummary: attendanceSummary,
    attendanceRate: attendanceRate,
    attendanceSeries: attendanceSeries,
    entriesFor: entriesFor,
    parameterSeries: parameterSeries,
    avgParameter: avgParameter,
    trend: trend,
    latestTests: latestTests,
    testHistory: testHistory,
    matchesFor: matchesFor,
    attentionList: attentionList,
    lastMatch: lastMatch,
    activeParameters: activeParameters,
    badgeKategori: badgeKategori,
    programLatihan: programLatihan,
    parameterById: parameterById,
    namaParameter: namaParameter,
    satuanParameter: satuanParameter,
    labelPenginput: labelPenginput,
    urutTerbaru: urutTerbaru,
    catatanAtlet: catatanAtlet,
    programAtlet: programAtlet,
    simpanGrupLogbook: simpanGrupLogbook,
    bukaEditorLogbook: bukaEditorLogbook,
    hapusGrupLogbook: hapusGrupLogbook,
    testTypes: testTypes
  };
})();

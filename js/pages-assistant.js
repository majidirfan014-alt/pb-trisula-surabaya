var PagesAssistant = (function () {

  function home(root, user, app) {
    root.innerHTML =
      '<div class="page">' +
      UI.pageHeader('Beranda Asisten Pelatih', 'Ringkasan tugas hari ini.') +
      '<div class="stat-grid" id="as-stats"></div>' +
      '<h3 class="mt-3">Aksi Cepat</h3>' +
      '<div class="quick-actions">' +
      '<button type="button" class="quick-action" data-go="absensi">' + UI.icon('calendar', 28) + '<b>Absensi Kehadiran</b><span>Absen atlet &amp; diri sendiri</span></button>' +
      '<button type="button" class="quick-action alt" data-go="logbook-harian">' + UI.icon('clipboard', 28) + '<b>Logbook Harian</b><span>Input fisik &amp; teknik atlet</span></button>' +
      '<button type="button" class="quick-action warn" data-go="input-pertandingan">' + UI.icon('trophy', 28) + '<b>Input Pertandingan</b><span>Catat hasil &amp; skor per set</span></button>' +
      '</div>' +
      '<div class="grid-2 mt-3">' +
      '<div class="card"><div class="card-title">' + UI.icon('alert', 20) + 'Atlet Belum Diabsen Hari Ini</div><div id="as-pending"></div></div>' +
      '<div class="card"><div class="card-title">' + UI.icon('user', 20) + 'Absen Saya Hari Ini</div><div id="as-self"></div></div>' +
      '</div></div>';

    var page = root.querySelector('.page');

    function refresh() {
      var today = Utils.todayISO();
      var athletes = Shared.activeAthletes();
      var s = Shared.attendanceSummary(today);
      var pending = athletes.filter(function (a) {
        return !Shared.attendanceFor(today, a.id_atlet);
      });
      var selfRec = Store.findOne('attendance', function (r) {
        return r.tanggal === today && r.id_pengguna === user.id && r.tipe === 'asisten';
      });
      var logs = Store.where('logbook_entries', function (e) {
        return e.tanggal === today;
      }).length;
      var matches = Store.where('matches', function (m) {
        return Utils.monthKey(m.tanggal) === Utils.monthKey(today);
      }).length;

      page.querySelector('#as-stats').innerHTML =
        UI.statCard('Atlet Hadir Hari Ini', s.Hadir + '/' + s.total, s.total ? s.persen + '% kehadiran' : 'belum diabsen', 'check', 'ok') +
        UI.statCard('Belum Diabsen', pending.length, pending.length ? 'segera lengkapi' : 'sudah lengkap', 'alert', pending.length ? 'warn' : 'primary') +
        UI.statCard('Entri Logbook Hari Ini', logs, 'nilai terinput', 'clipboard', 'primary') +
        UI.statCard('Pertandingan Bulan Ini', matches, 'hasil tercatat', 'trophy', 'blue');

      var pendingHost = page.querySelector('#as-pending');
      if (!athletes.length) {
        pendingHost.innerHTML = UI.emptyState('Belum ada atlet terdaftar.', 'users');
      } else if (!pending.length) {
        pendingHost.innerHTML = '<div class="notice ok">' + UI.icon('check', 20) + '<div>Semua atlet sudah diabsen hari ini. Kerja bagus!</div></div>';
      } else {
        pendingHost.innerHTML = '<div class="list-rows">' + pending.map(function (a) {
          return '<div class="list-row">' + UI.avatar(a, 38) +
            '<div class="grow"><b>' + Utils.esc(a.nama) + '</b><span>' + Utils.esc(a.id_atlet) + '</span></div>' +
            '<button type="button" class="btn btn-sm btn-secondary" data-go="absensi">Absen</button></div>';
        }).join('') + '</div>';
      }

      var selfHost = page.querySelector('#as-self');
      selfHost.innerHTML = selfRec
        ? '<div class="notice ok">' + UI.icon('check', 20) +
        '<div><b>' + Utils.esc(selfRec.status) + '</b><br>Masuk ' + Utils.esc(selfRec.jam_masuk || '-') +
        ' · Pulang ' + Utils.esc(selfRec.jam_pulang || '-') + '</div></div>'
        : '<div class="notice warn">' + UI.icon('alert', 20) +
        '<div>Anda belum mengabsen diri sendiri hari ini. Buka menu Absensi untuk mengisi jam masuk.</div></div>';
    }

    refresh();

    page.addEventListener('click', function (e) {
      var go = e.target.closest('[data-go]');
      if (go) {
        window.location.hash = '#/' + go.getAttribute('data-go');
      }
    });

    app.subscribe('attendance', refresh);
    app.subscribe('logbook_entries', refresh);
    app.subscribe('matches', refresh);
    app.subscribe('athletes', refresh);
  }

  function absensi(root, user, app) {
    var suppressRender = false;

    root.innerHTML =
      '<div class="page">' +
      UI.pageHeader('Absensi Kehadiran', 'Tap status untuk menyimpan. Tersimpan otomatis.') +
      '<div class="card">' +
      '<div class="filter-bar">' +
      '<input class="input" type="date" id="ab-tanggal" style="max-width:220px">' +
      '<div class="grow" style="display:flex;align-items:flex-end;justify-content:flex-end">' +
      '<button type="button" class="btn btn-sm btn-secondary" data-simpan-semua>' + UI.icon('save', 18) + ' Simpan Semua Catatan</button>' +
      '</div></div>' +
      '<div id="ab-body"></div>' +
      '</div>' +
      '<div class="card mt-2">' +
      '<div class="card-title">' + UI.icon('user', 20) + 'Absen Diri Sendiri</div>' +
      '<form id="form-self"><div class="form-grid cols-2">' +
      UI.field({ name: 'status', label: 'Status', type: 'select', value: 'Hadir', options: CONFIG.STATUS_KEHADIRAN }) +
      UI.field({ name: 'catatan', label: 'Catatan', placeholder: 'Opsional' }) +
      UI.field({ name: 'jam_masuk', label: 'Jam Masuk', type: 'time', value: '' }) +
      UI.field({ name: 'jam_pulang', label: 'Jam Pulang', type: 'time', value: '' }) +
      '</div><button class="btn" type="submit">' + UI.icon('save', 20) + ' Simpan Absen Saya</button></form>' +
      '</div></div>';

    var page = root.querySelector('.page');
    var body = page.querySelector('#ab-body');
    var tanggalInput = page.querySelector('#ab-tanggal');
    tanggalInput.value = Utils.todayISO();

    function currentCatatans() {
      var out = {};
      body.querySelectorAll('[data-catatan]').forEach(function (input) {
        out[input.getAttribute('data-catatan')] = input.value.trim();
      });
      return out;
    }

    function renderBody() {
      var tgl = tanggalInput.value || Utils.todayISO();
      var athletes = Shared.activeAthletes();
      var catatans = currentCatatans();

      if (!athletes.length) {
        body.innerHTML = UI.emptyState('Belum ada atlet terdaftar.', 'users');
        return;
      }

      body.innerHTML = '<div class="attendance-grid">' + athletes.map(function (a) {
        var rec = Shared.attendanceFor(tgl, a.id_atlet);
        var catVal = catatans[a.id_atlet] !== undefined ? catatans[a.id_atlet] : (rec ? rec.catatan || '' : '');
        return '<div class="attendance-item" data-atlet-card="' + Utils.esc(a.id_atlet) + '">' +
          '<div class="attendance-head">' + UI.avatar(a, 44) +
          '<div class="grow"><b>' + Utils.esc(a.nama) + '</b><span>' + Utils.esc(a.id_atlet) + ' · ' + Utils.esc(a.sekolah) + '</span></div>' +
          '<div data-status-badge>' + (rec ? UI.statusBadge(rec.status) : UI.badge('Belum diabsen', 'muted')) + '</div>' +
          '</div>' +
          '<div class="status-picker">' +
          CONFIG.STATUS_KEHADIRAN.map(function (s) {
            return '<button type="button" class="status-btn' + (rec && rec.status === s ? ' active' : '') +
              '" data-status="' + Utils.esc(s) + '" data-id-atlet="' + Utils.esc(a.id_atlet) + '">' + Utils.esc(s) + '</button>';
          }).join('') +
          '</div>' +
          '<div class="field mt-1" style="margin-bottom:0">' +
          '<input class="input" placeholder="Catatan (opsional)" value="' + Utils.esc(catVal) + '" data-catatan="' + Utils.esc(a.id_atlet) + '">' +
          '</div></div>';
      }).join('') + '</div>';
    }

    function saveStatus(idAtlet, status, catatan) {
      var tgl = tanggalInput.value || Utils.todayISO();
      var existing = Shared.attendanceFor(tgl, idAtlet);
      var payload = {
        tanggal: tgl,
        id_pengguna: idAtlet,
        id_atlet: idAtlet,
        tipe: 'atlet',
        status: status,
        catatan: catatan || '',
        jam_masuk: '',
        jam_pulang: '',
        input_oleh: user.id
      };
      suppressRender = true;
      try {
        if (existing) Store.update('attendance', existing.id, payload);
        else Store.insert('attendance', payload);
      } finally {
        suppressRender = false;
      }
      UI.toast('Absensi ' + status + ' tersimpan.', 'success');
    }

    renderBody();

    tanggalInput.addEventListener('change', renderBody);

    body.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-status]');
      if (!btn) return;
      var card = btn.closest('[data-atlet-card]');
      var idAtlet = btn.getAttribute('data-id-atlet');
      var status = btn.getAttribute('data-status');
      var catatan = card.querySelector('[data-catatan]').value.trim();
      saveStatus(idAtlet, status, catatan);
      card.querySelectorAll('.status-btn').forEach(function (b) {
        b.classList.toggle('active', b === btn);
      });
      card.querySelector('[data-status-badge]').innerHTML = UI.statusBadge(status);
    });

    body.addEventListener('change', function (e) {
      var input = e.target.closest('[data-catatan]');
      if (!input) return;
      var idAtlet = input.getAttribute('data-catatan');
      var tgl = tanggalInput.value || Utils.todayISO();
      var rec = Shared.attendanceFor(tgl, idAtlet);
      if (!rec) return;
      suppressRender = true;
      try {
        Store.update('attendance', rec.id, { catatan: input.value.trim() });
      } finally {
        suppressRender = false;
      }
    });

    page.addEventListener('click', function (e) {
      if (!e.target.closest('[data-simpan-semua]')) return;
      var tgl = tanggalInput.value || Utils.todayISO();
      var count = 0;
      body.querySelectorAll('[data-catatan]').forEach(function (input) {
        var idAtlet = input.getAttribute('data-catatan');
        var rec = Shared.attendanceFor(tgl, idAtlet);
        if (!rec) return;
        if ((rec.catatan || '') !== input.value.trim()) {
          Store.update('attendance', rec.id, { catatan: input.value.trim() });
          count++;
        }
      });
      UI.toast(count ? count + ' catatan disimpan.' : 'Tidak ada perubahan catatan.', count ? 'success' : 'info');
    });

    var selfForm = page.querySelector('#form-self');
    function fillSelf() {
      var tgl = tanggalInput.value || Utils.todayISO();
      var rec = Store.findOne('attendance', function (r) {
        return r.tanggal === tgl && r.id_pengguna === user.id && r.tipe === 'asisten';
      });
      selfForm.querySelector('[name="status"]').value = rec ? rec.status : 'Hadir';
      selfForm.querySelector('[name="catatan"]').value = rec ? rec.catatan || '' : '';
      selfForm.querySelector('[name="jam_masuk"]').value = rec && rec.jam_masuk ? rec.jam_masuk : '';
      selfForm.querySelector('[name="jam_pulang"]').value = rec && rec.jam_pulang ? rec.jam_pulang : '';
    }
    fillSelf();
    tanggalInput.addEventListener('change', fillSelf);

    UI.bindSubmit(selfForm, function () {
      var d = Utils.formData(selfForm);
      var tgl = tanggalInput.value || Utils.todayISO();
      var rec = Store.findOne('attendance', function (r) {
        return r.tanggal === tgl && r.id_pengguna === user.id && r.tipe === 'asisten';
      });
      var payload = {
        tanggal: tgl,
        id_pengguna: user.id,
        id_atlet: null,
        tipe: 'asisten',
        status: d.status,
        catatan: d.catatan || '',
        jam_masuk: d.jam_masuk || '',
        jam_pulang: d.jam_pulang || '',
        input_oleh: user.id
      };
      suppressRender = true;
      try {
        if (rec) Store.update('attendance', rec.id, payload);
        else Store.insert('attendance', payload);
      } finally {
        suppressRender = false;
      }
      Utils.toast('Absen diri sendiri berhasil disimpan.', 'success');
      fillSelf();
    });

    app.subscribe('attendance', function () {
      if (suppressRender) return;
      renderBody();
      fillSelf();
    });
    app.subscribe('athletes', renderBody);
  }

  function logbookHarian(root, user, app) {
    root.innerHTML =
      '<div class="page">' +
      UI.pageHeader('Logbook Harian', 'Isi penilaian fisik dan teknik atlet. Parameter disediakan oleh pelatih kepala.') +
      '<div class="card">' +
      UI.tabs([
        { id: 'fisik', label: 'Fisik Harian' },
        { id: 'teknik', label: 'Penilaian Teknik' }
      ], 'fisik') +
      '<div id="lh-body"></div>' +
      '</div>' +
      '<div class="card mt-2">' +
      '<div class="card-title">' + UI.icon('clipboard', 20) + 'Entri Terbaru</div>' +
      '<div id="lh-list"></div>' +
      '</div>' +
      '<div class="card mt-2">' +
      '<div class="card-title">' + UI.icon('star', 20) + 'Perkembangan Atlet Terpilih</div>' +
      '<p class="small muted">Tampilan persentase untuk dipantau bersama orang tua atlet.</p>' +
      '<div id="lh-kemajuan"></div>' +
      '</div></div>';

    var page = root.querySelector('.page');
    var body = page.querySelector('#lh-body');
    var listHost = page.querySelector('#lh-list');
    var mode = 'fisik';

    function renderForm() {
      var params = Shared.activeParameters(mode);
      var html = '<form id="form-lh" novalidate><div class="form-grid cols-2">' +
        UI.selectAthlete('id_atlet', '', { label: 'Atlet' }) +
        UI.field({ name: 'tanggal', label: 'Tanggal', type: 'date', required: true, value: Utils.todayISO() }) +
        '</div>';
      if (!params.length) {
        html += UI.emptyState('Belum ada parameter ' + mode + ' aktif. Hubungi pelatih kepala untuk menambahkannya.', 'settings');
      } else {
        html += '<div class="param-grid">' + params.map(function (p) {
          return '<div class="param-item">' +
            '<label class="label">' + Utils.esc(p.nama) + ' <span class="small muted">(' + Utils.esc(p.satuan) + ')</span></label>' +
            '<input class="input" type="number" name="p_' + Utils.esc(p.id) + '" min="1" max="10" step="1" placeholder="1 - 10">' +
            '<div class="field-error" data-error-for="p_' + Utils.esc(p.id) + '"></div></div>';
        }).join('') + '</div>';
      }
      html += UI.field({ name: 'catatan', label: 'Catatan untuk atlet', type: 'textarea', rows: 2, placeholder: 'Contoh: footwork sudah lebih cepat, pertahankan.' }) +
        '<button class="btn" type="submit">' + UI.icon('save', 20) + ' Simpan Logbook</button></form>';
      body.innerHTML = html;

      var form = body.querySelector('#form-lh');
      UI.bindSubmit(form, function () {
        Utils.clearErrors(form);
        var data = Utils.formData(form);
        var errors = {};
        if (!data.id_atlet) errors.id_atlet = 'Pilih atlet.';
        if (!data.tanggal) errors.tanggal = 'Tanggal wajib diisi.';
        var ps = Shared.activeParameters(mode);
        if (!ps.length) {
          Utils.toast('Tidak ada parameter aktif.', 'danger');
          return;
        }
        var filled = 0;
        ps.forEach(function (p) {
          var val = data['p_' + p.id];
          if (val === '' || val === undefined) return;
          filled++;
          var n = Number(val);
          if (isNaN(n) || n < 1 || n > 10) errors['p_' + p.id] = 'Isi nilai 1 - 10.';
        });
        if (!filled) errors['p_' + ps[0].id] = 'Isi minimal satu nilai parameter.';
        if (Object.keys(errors).length) {
          Utils.showErrors(form, errors);
          Utils.toast('Periksa kembali isian yang ditandai.', 'danger');
          return;
        }
        ps.forEach(function (p) {
          var val = data['p_' + p.id];
          if (val === '' || val === undefined) return;
          Store.insert('logbook_entries', {
            id_atlet: data.id_atlet,
            tanggal: data.tanggal,
            id_parameter: p.id,
            nama_parameter: p.nama,
            satuan: p.satuan,
            kategori: p.kategori,
            nilai: Number(val),
            catatan: data.catatan || '',
            input_oleh: user.id,
            input_peran: CONFIG.ROLE_LABEL[user.role] || ''
          });
        });
        Utils.toast('Logbook berhasil disimpan.', 'success');
        form.reset();
        form.querySelector('[name="tanggal"]').value = Utils.todayISO();
        refreshList();
      });
    }

    function refreshList() {
      var rows = Utils.sortBy(Store.where('logbook_entries', function (e) {
        return e.kategori === mode;
      }), 'tanggal', 'desc');
      if (!rows.length) {
        listHost.innerHTML = UI.emptyState('Belum ada entri ' + mode + '.', 'clipboard');
        return;
      }
      var grouped = {};
      rows.forEach(function (r) {
        var key = r.id_atlet + '|' + r.tanggal;
        if (!grouped[key]) grouped[key] = { id_atlet: r.id_atlet, tanggal: r.tanggal, items: [], catatan: '' };
        grouped[key].items.push(r);
        if (r.catatan) grouped[key].catatan = r.catatan;
      });
      var keys = Object.keys(grouped).sort().reverse();
      listHost.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr>' +
        '<th>Tanggal</th><th>Atlet</th><th>Ringkasan</th><th>Catatan</th><th>Input Oleh</th><th class="align-center">Aksi</th>' +
        '</tr></thead><tbody>' +
        keys.slice(0, 30).map(function (k) {
          var g = grouped[k];
          var a = UI.athleteById(g.id_atlet);
          var kunci = Utils.esc(g.id_atlet) + '|' + Utils.esc(g.tanggal) + '|' + Utils.esc(mode);
          return '<tr>' +
            '<td>' + Utils.fmtDate(g.tanggal) + '</td>' +
            '<td><b>' + Utils.esc(a ? a.nama : '-') + '</b></td>' +
            '<td><div class="score-pills">' + g.items.map(function (i) {
              return '<span class="score-pill">' + Utils.esc(Shared.namaParameter(i)) + ': ' + Utils.esc(i.nilai) + '</span>';
            }).join('') + '</div></td>' +
            '<td class="small">' + Utils.esc(g.catatan || '-') + '</td>' +
            '<td class="small">' + Utils.esc(Shared.labelPenginput(g.items[0])) + '</td>' +
            '<td class="align-center"><div class="flex gap-1" style="justify-content:center">' +
            '<button type="button" class="btn btn-sm btn-secondary" data-log-edit="' + kunci + '">Edit</button>' +
            '<button type="button" class="btn btn-sm btn-danger" data-log-hapus="' + kunci + '">Hapus</button>' +
            '</div></td></tr>';
        }).join('') + '</tbody></table></div>';
    }

    function segarkanKemajuan() {
      var host = page.querySelector('#lh-kemajuan');
      if (!host) return;
      if (typeof Kemajuan === 'undefined' || !Kemajuan || !Kemajuan.render) {
        host.innerHTML = UI.emptyState('Modul perkembangan tidak tersedia.', 'alert');
        return;
      }
      var form = body.querySelector('#form-lh');
      var kolom = form ? form.querySelector('[name="id_atlet"]') : null;
      var idAtlet = kolom ? kolom.value : '';
      if (!idAtlet) {
        host.innerHTML = UI.emptyState('Pilih atlet di atas untuk melihat perkembangannya.', 'users');
        return;
      }
      Kemajuan.render(host, { idAtlet: idAtlet });
    }

    renderForm();
    refreshList();
    segarkanKemajuan();

    page.addEventListener('click', function (e) {
      var editLog = e.target.closest('[data-log-edit]');
      if (editLog) {
        var bagianEdit = editLog.getAttribute('data-log-edit').split('|');
        Shared.bukaEditorLogbook({
          idAtlet: bagianEdit[0],
          tanggal: bagianEdit[1],
          kategori: bagianEdit.slice(2).join('|'),
          user: user,
          onSelesai: function () {
            refreshList();
            segarkanKemajuan();
          }
        });
        return;
      }
      var hapusLog = e.target.closest('[data-log-hapus]');
      if (hapusLog) {
        var bagianHapus = hapusLog.getAttribute('data-log-hapus').split('|');
        UI.confirmDialog('Seluruh penilaian pada tanggal ini untuk atlet terkait akan dihapus. Lanjutkan?', 'Konfirmasi Hapus Logbook').then(function (ok) {
          if (!ok) return;
          Shared.hapusGrupLogbook(bagianHapus[0], bagianHapus[1], bagianHapus.slice(2).join('|'));
          Utils.toast('Entri logbook dihapus.', 'success');
          refreshList();
          segarkanKemajuan();
        });
        return;
      }

      var tab = e.target.closest('[data-tab]');
      if (!tab) return;
      mode = tab.getAttribute('data-tab');
      page.querySelectorAll('.tab').forEach(function (t) {
        t.classList.toggle('active', t === tab);
      });
      renderForm();
      refreshList();
      segarkanKemajuan();
    });

    page.addEventListener('change', function (e) {
      if (e.target && e.target.name === 'id_atlet') segarkanKemajuan();
    });

    app.subscribe('logbook_entries', function () {
      refreshList();
      segarkanKemajuan();
    });
    app.subscribe('log_parameters', function () {
      renderForm();
    });
    app.subscribe('athletes', renderForm);
  }

  function inputPertandingan(root, user, app) {
    root.innerHTML =
      '<div class="page">' +
      UI.pageHeader('Input Pertandingan', 'Catat hasil pertandingan atlet. Data langsung tampil di dashboard pelatih kepala dan atlet.') +
      '<div class="card">' +
      '<div class="card-title">' + UI.icon('plus', 20) + 'Hasil Pertandingan Baru</div>' +
      '<div id="ip-form"></div>' +
      '</div>' +
      '<div class="card mt-2">' +
      '<div class="card-title">' + UI.icon('trophy', 20) + 'Riwayat Input</div>' +
      '<div id="ip-list"></div>' +
      '</div></div>';

    var page = root.querySelector('.page');
    var formHost = page.querySelector('#ip-form');
    var listHost = page.querySelector('#ip-list');

    function renderForm() {
      formHost.innerHTML =
        '<form id="form-ip" novalidate><div class="form-grid cols-2">' +
        UI.selectAthlete('id_atlet', '', { label: 'Atlet' }) +
        UI.field({ name: 'tanggal', label: 'Tanggal', type: 'date', required: true, value: Utils.todayISO() }) +
        UI.field({ name: 'turnamen', label: 'Turnamen', required: true, placeholder: 'contoh: Surabaya Open 2026' }) +
        UI.field({ name: 'lawan', label: 'Lawan', required: true, placeholder: 'contoh: PB Djarum Kudus' }) +
        UI.field({ name: 'hasil', label: 'Hasil', type: 'select', value: 'Menang', options: ['Menang', 'Kalah'] }) +
        UI.field({ name: 'catatan', label: 'Catatan', type: 'textarea', rows: 2, placeholder: 'Opsional' }) +
        '</div>' +
        '<div class="field"><label class="label">Skor per Set <span class="req">*</span></label>' +
        '<div class="help" style="margin:0 0 8px">Format angka-angka, contoh: 21-18</div>' +
        '<div id="ip-set-rows"><div class="set-row"><input class="input" name="set_0" placeholder="contoh: 21-18" inputmode="numeric" aria-label="Skor set 1">' +
        '<button type="button" class="icon-btn" data-remove-set aria-label="Hapus set">' + UI.icon('trash', 18) + '</button></div></div>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-add-set>' + UI.icon('plus', 18) + ' Tambah Set</button>' +
        '<div class="field-error" data-error-for="skor_set"></div></div>' +
        '<button class="btn" type="submit">' + UI.icon('save', 20) + ' Simpan Hasil</button></form>';

      var form = formHost.querySelector('#form-ip');

      form.addEventListener('click', function (e) {
        if (e.target.closest('[data-add-set]')) {
          var rows = form.querySelector('#ip-set-rows');
          var div = document.createElement('div');
          div.className = 'set-row';
          div.innerHTML = '<input class="input" name="set_' + rows.children.length + '" placeholder="contoh: 21-18" inputmode="numeric" aria-label="Skor set ' + (rows.children.length + 1) + '">' +
            '<button type="button" class="icon-btn" data-remove-set aria-label="Hapus set">' + UI.icon('trash', 18) + '</button>';
          rows.appendChild(div);
          div.querySelector('input').focus();
          return;
        }
        var rm = e.target.closest('[data-remove-set]');
        if (rm) {
          var row = rm.parentElement;
          if (row.parentElement.children.length > 1) row.remove();
          else row.querySelector('input').value = '';
        }
      });

      UI.bindSubmit(form, function () {
        Utils.clearErrors(form);
        var data = Utils.formData(form);
        var errors = {};
        if (!data.id_atlet) errors.id_atlet = 'Atlet wajib dipilih.';
        if (!data.tanggal) errors.tanggal = 'Tanggal wajib diisi.';
        if (!data.turnamen) errors.turnamen = 'Turnamen wajib diisi.';
        if (!data.lawan) errors.lawan = 'Lawan wajib diisi.';
        if (!data.hasil) errors.hasil = 'Hasil wajib dipilih.';

        var sets = [];
        var firstBadSet = null;
        form.querySelectorAll('#ip-set-rows input').forEach(function (input) {
          var val = input.value.trim();
          if (!val) return;
          if (!Utils.isSkorValid(val)) {
            if (!firstBadSet) firstBadSet = input;
            return;
          }
          sets.push(val.replace(/\s+/g, ''));
        });
        if (!sets.length) {
          errors.skor_set = 'Isi minimal satu skor set dengan format angka-angka, contoh: 21-18.';
        } else if (firstBadSet) {
          errors.skor_set = 'Format skor harus angka-angka, contoh: 21-18. Periksa set yang masih salah.';
        }
        if (Object.keys(errors).length) {
          Utils.showErrors(form, errors);
          Utils.toast('Periksa kembali isian yang ditandai.', 'danger');
          if (firstBadSet && firstBadSet.focus) firstBadSet.focus();
          return;
        }
        Store.insert('matches', {
          id_atlet: data.id_atlet,
          tanggal: data.tanggal,
          turnamen: data.turnamen,
          lawan: data.lawan,
          skor_set: sets,
          hasil: data.hasil,
          catatan: data.catatan || '',
          input_oleh: user.id
        });
        Utils.toast('Hasil pertandingan berhasil disimpan.', 'success');
        renderForm();
        refreshList();
      });
    }

    function refreshList() {
      var rows = Utils.sortBy(Store.all('matches'), 'tanggal', 'desc');
      if (!rows.length) {
        listHost.innerHTML = UI.emptyState('Belum ada data pertandingan.', 'trophy');
        return;
      }
      listHost.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr>' +
        '<th>Tanggal</th><th>Atlet</th><th>Turnamen</th><th>Lawan</th><th>Skor</th><th>Hasil</th><th>Input Oleh</th>' +
        '</tr></thead><tbody>' +
        rows.slice(0, 30).map(function (m) {
          var a = UI.athleteById(m.id_atlet);
          return '<tr>' +
            '<td>' + Utils.fmtDate(m.tanggal) + '</td>' +
            '<td><b>' + Utils.esc(a ? a.nama : '-') + '</b></td>' +
            '<td>' + Utils.esc(m.turnamen) + '</td>' +
            '<td>' + Utils.esc(m.lawan) + '</td>' +
            '<td><div class="score-pills">' + (m.skor_set || []).map(function (s) {
              return '<span class="score-pill">' + Utils.esc(s) + '</span>';
            }).join('') + '</div></td>' +
            '<td>' + UI.statusBadge(m.hasil) + '</td>' +
            '<td>' + Utils.esc(UI.userName(m.input_oleh)) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }

    renderForm();
    refreshList();

    app.subscribe('matches', refreshList);
    app.subscribe('athletes', renderForm);
  }

  function register() {
    App.register('absensi', {
      title: 'Absensi Kehadiran',
      subtitle: 'Absen atlet dan diri sendiri',
      render: absensi
    });
    App.register('logbook-harian', {
      title: 'Logbook Harian',
      subtitle: 'Fisik harian & penilaian teknik',
      render: logbookHarian
    });
    App.register('input-pertandingan', {
      title: 'Input Pertandingan',
      subtitle: 'Catat hasil pertandingan atlet',
      render: inputPertandingan
    });
  }

  return {
    register: register,
    home: home
  };
})();

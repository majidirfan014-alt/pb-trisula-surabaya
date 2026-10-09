var PagesCoach = (function () {

  function buildAthleteForm(athlete) {
    var a = athlete || {};
    var isEdit = !!athlete;
    var html = '<form id="form-atlet" novalidate>' +
      '<div class="form-grid cols-2">' +
      UI.field({ name: 'nama', label: 'Nama Atlet', required: true, value: a.nama, placeholder: 'Nama lengkap' }) +
      UI.field({ name: 'tgl_lahir', label: 'Tanggal Lahir', type: 'date', required: true, value: a.tgl_lahir }) +
      UI.field({ name: 'nisn', label: 'NISN', required: true, value: a.nisn, placeholder: '10 digit angka', help: 'Tepat 10 digit angka, tidak boleh sama dengan atlet lain.', attrs: ' inputmode="numeric" pattern="[0-9]*" autocomplete="off"' }) +
      UI.field({ name: 'jk', label: 'Jenis Kelamin', type: 'select', required: true, value: a.jk, options: [{ value: '', label: '-- Pilih --' }].concat(CONFIG.GENDER) }) +
      UI.field({ name: 'sekolah', label: 'Asal Sekolah', required: true, value: a.sekolah, placeholder: 'Nama sekolah' }) +
      UI.field({ name: 'tinggi', label: 'Tinggi Badan (cm)', type: 'number', required: true, value: a.tinggi, min: 80, max: 230, step: '0.5' }) +
      UI.field({ name: 'berat', label: 'Berat Badan (kg)', type: 'number', required: true, value: a.berat, min: 20, max: 200, step: '0.5' }) +
      '</div>' +
      '<div class="bmi-preview" id="form-bmi"><b>-</b><div><b class="fs-sm">BMI otomatis</b><div class="small muted">Isi tinggi &amp; berat badan.</div></div></div>' +
      '<div class="form-grid cols-2">' +
      UI.field({ name: 'asal_pb', label: 'Asal PB', value: a.asal_pb, placeholder: 'Opsional' }) +
      UI.field({ name: 'no_hp', label: 'No. HP', required: true, value: a.no_hp, placeholder: '08xxxxxxxxxx' }) +
      '</div>' +
      '<div class="form-grid cols-2">' +
      UI.field({ name: 'username', label: 'ID Login', required: !isEdit, value: a.username || (a.id_atlet ? a.id_atlet.toLowerCase() : ''), help: isEdit ? 'Tidak dapat diubah.' : 'Kosongkan untuk memakai ID atlet otomatis.', disabled: isEdit }) +
      UI.field({ name: 'password', label: isEdit ? 'Kata Sandi Baru (opsional)' : 'Kata Sandi', type: 'password', required: !isEdit, value: '', help: isEdit ? 'Biarkan kosong bila tidak diubah.' : 'Minimal 6 karakter.' }) +
      '</div>' +
      '<div class="field">' +
      '<label class="label">Foto Profil (opsional)</label>' +
      '<div class="photo-upload"><div id="form-photo-preview">' + (a.foto ? UI.avatar({ nama: a.nama, foto: a.foto }, 56) : '') + '</div>' +
      '<input class="input" type="file" name="foto_file" accept="image/*"></div>' +
      '</div>' +
      (isEdit ? UI.field({ name: 'status', label: 'Status', type: 'select', value: a.status || 'aktif', options: [{ value: 'aktif', label: 'Aktif' }, { value: 'nonaktif', label: 'Nonaktif' }] }) : '') +
      Docs.sectionHtml() +
      '</form>';

    return html;
  }

  function bindBmiPreview(form) {
    var t = form.querySelector('[name="tinggi"]');
    var b = form.querySelector('[name="berat"]');
    var box = form.querySelector('#form-bmi');
    function upd() {
      if (!box) return;
      var r = Utils.bmi(t.value, b.value);
      if (r.value === null) {
        box.innerHTML = '<b>-</b><div><b class="fs-sm">BMI otomatis</b><div class="small muted">Isi tinggi &amp; berat badan.</div></div>';
        return;
      }
      box.innerHTML = '<b>' + r.value + '</b><div><b class="fs-sm">BMI ' + Utils.esc(r.category.label) + '</b><div class="small muted">Dihitung otomatis dari tinggi &amp; berat.</div></div>';
    }
    if (t) t.addEventListener('input', upd);
    if (b) b.addEventListener('input', upd);
    upd();
  }

  function openAthleteForm(athlete) {
    var host = document.getElementById('modal-host') || document.body;
    host.innerHTML = UI.modalShell('m-atlet', athlete ? 'Edit Data Atlet' : 'Tambah Atlet Baru',
      UI.backButton({ closeModal: 'm-atlet' }) + buildAthleteForm(athlete),
      '<button type="button" class="btn btn-ghost" data-back-close="m-atlet">Batal</button>' +
      '<button type="submit" class="btn" form="form-atlet">' + (athlete ? 'Simpan Perubahan' : 'Tambah Atlet') + '</button>');
    UI.openModal('m-atlet');

    var form = document.getElementById('form-atlet');
    bindBmiPreview(form);

    function pesanNisn(value) {
      var format = Utils.validasiNisn(value);
      if (format) return format;
      var v = String(value).trim();
      var sama = Store.findOne('athletes', function (row) {
        return String(row.nisn || '').trim() === v && (!athlete || row.id !== athlete.id);
      });
      if (sama) return 'NISN sudah terdaftar';
      return '';
    }

    var nisnInput = form.querySelector('[name="nisn"]');
    if (nisnInput) {
      nisnInput.addEventListener('input', function () {
        var slot = form.querySelector('[data-error-for="nisn"]');
        var pesan = nisnInput.value.trim() ? pesanNisn(nisnInput.value) : '';
        if (slot) slot.textContent = pesan;
        nisnInput.classList.toggle('input-error', !!pesan);
      });
    }

    var docsApi = null;
    var docsHost = form.querySelector('.docs-card');
    if (docsHost) {
      docsApi = Docs.bind(docsHost.parentElement, { dokumen: athlete && athlete.dokumen ? athlete.dokumen : {} });
    }

    var photoInput = form.querySelector('[name="foto_file"]');
    var photoPreview = form.querySelector('#form-photo-preview');
    var photoData = athlete && athlete.foto ? athlete.foto : '';
    if (photoInput) {
      photoInput.addEventListener('change', function () {
        var file = photoInput.files && photoInput.files[0];
        if (!file) return;
        var pesanSalah = (typeof Cloud !== 'undefined' && Cloud && Cloud.validasiGambar)
          ? Cloud.validasiGambar(file, 5 * 1024 * 1024) : '';
        if (pesanSalah) {
          Utils.toast(pesanSalah, 'danger');
          photoInput.value = '';
          return;
        }
        if (photoPreview) photoPreview.innerHTML = '<div class="upload-loading">Mengunggah foto...</div>';
        Utils.readImage(file, 256).then(function (dataUrl) {
          return Utils.keCloud(dataUrl, 'foto/atlet', file.name || 'foto-atlet.jpg');
        }).then(function (hasil) {
          photoData = hasil;
          if (photoPreview) photoPreview.innerHTML = UI.avatar({ nama: 'Foto', foto: hasil }, 56);
          Utils.toast(/^https?:/.test(hasil) ? 'Foto tersimpan di cloud.' : 'Foto siap disimpan.', 'success');
        }).catch(function (err) {
          photoData = athlete && athlete.foto ? athlete.foto : '';
          if (photoPreview) photoPreview.innerHTML = photoData ? UI.avatar({ nama: 'Foto', foto: photoData }, 56) : '';
          Utils.toast(err.message, 'danger');
          photoInput.value = '';
        });
      });
    }

    UI.bindSubmit(form, function () {
      Utils.clearErrors(form);
      var data = Utils.formData(form);
      var errors = {};
      if (!data.nama) errors.nama = 'Nama wajib diisi.';
      if (!data.tgl_lahir) errors.tgl_lahir = 'Tanggal lahir wajib diisi.';
      var pesanNisnSubmit = pesanNisn(data.nisn);
      if (pesanNisnSubmit) errors.nisn = pesanNisnSubmit;
      if (!data.jk) errors.jk = 'Jenis kelamin wajib dipilih.';
      if (!data.sekolah) errors.sekolah = 'Asal sekolah wajib diisi.';
      if (!data.tinggi || Number(data.tinggi) < 80) errors.tinggi = 'Tinggi badan tidak valid.';
      if (!data.berat || Number(data.berat) < 20) errors.berat = 'Berat badan tidak valid.';
      if (!data.no_hp) errors.no_hp = 'No. HP wajib diisi.';
      if (!athlete) {
        if (data.username && data.username.length < 4) errors.username = 'ID login minimal 4 karakter.';
        if (!data.password || data.password.length < 6) errors.password = 'Kata sandi minimal 6 karakter.';
      } else if (data.password && data.password.length < 6) {
        errors.password = 'Kata sandi minimal 6 karakter.';
      }
      if (Object.keys(errors).length) {
        Utils.showErrors(form, errors);
        Utils.toast('Periksa kembali isian yang ditandai.', 'danger');
      }

      var docsOk = true;
      if (docsApi) docsOk = docsApi.validate();
      if (Object.keys(errors).length || !docsOk) {
        if (!docsOk) Utils.toast('Seluruh dokumen pendaftaran wajib diunggah.', 'danger');
        return;
      }
      var dokumen = docsApi ? docsApi.get() : {};

      if (athlete) {
        var bmi = Utils.bmi(data.tinggi, data.berat);
        Store.update('athletes', athlete.id, {
          nama: data.nama,
          nisn: String(data.nisn || '').trim(),
          tgl_lahir: data.tgl_lahir,
          jk: data.jk,
          tinggi: Number(data.tinggi),
          berat: Number(data.berat),
          bmi: bmi.value,
          kategori_bmi: bmi.category.label,
          sekolah: data.sekolah,
          asal_pb: data.asal_pb,
          no_hp: data.no_hp,
          status: data.status || 'aktif',
          foto: photoData,
          dokumen: dokumen
        });
        Store.update('users', athlete.user_id, {
          nama: data.nama,
          no_hp: data.no_hp,
          foto: photoData
        });
        if (data.password) {
          Auth.resetPassword(athlete.user_id, data.password);
        }
        UI.closeModal('m-atlet');
        UI.toast('Data atlet berhasil diperbarui.', 'success');
        return;
      }

      var idAtlet = Store.nextAthleteId();
      var username = (data.username || idAtlet).toLowerCase();
      return Auth.createUser({
        nama: data.nama,
        username: username,
        password: data.password,
        role: 'atlet',
        id_atlet: idAtlet,
        no_hp: data.no_hp,
        foto: photoData
      }).then(function (newUser) {
        var bmi = Utils.bmi(data.tinggi, data.berat);
        var created = Store.insert('athletes', {
          id_atlet: idAtlet,
          user_id: newUser.id,
          nama: data.nama,
          nisn: String(data.nisn || '').trim(),
          tgl_lahir: data.tgl_lahir,
          jk: data.jk,
          tinggi: Number(data.tinggi),
          berat: Number(data.berat),
          bmi: bmi.value,
          kategori_bmi: bmi.category.label,
          sekolah: data.sekolah,
          asal_pb: data.asal_pb,
          no_hp: data.no_hp,
          foto: photoData,
          dokumen: dokumen,
          status: 'aktif'
        });
        Store.update('users', newUser.id, { athlete_id: created.id });
        UI.closeModal('m-atlet');
        UI.toast('Atlet ditambahkan dengan ID ' + created.id_atlet, 'success');
      }).catch(function (err) {
        UI.toast(err.message, 'danger');
      });
    });
  }

  function openAthleteDetail(idAtlet) {
    var a = UI.athleteById(idAtlet);
    if (!a) return;
    var rate = Shared.attendanceRate(a.id_atlet, 30);
    var t = Shared.trend(a.id_atlet, 21);
    var tests = Shared.latestTests(a.id_atlet);
    var matches = Shared.matchesFor(a.id_atlet).slice(0, 3);
    var user = Store.find('users', a.user_id);

    var body =
      '<div class="flex items-center gap-2 mb-2">' + UI.avatar(a, 68) +
      '<div><h3 class="mt-0 mb-0">' + Utils.esc(a.nama) + '</h3>' +
      '<div class="flex items-center gap-1 mt-1">' + UI.badge(a.id_atlet, 'primary') + UI.statusBadge(a.status) + '</div></div></div>' +
      '<div class="detail-grid">' +
      '<div class="detail-item"><div class="k">Tanggal Lahir</div><div class="v">' + Utils.fmtDate(a.tgl_lahir, true) + ' (' + Utils.age(a.tgl_lahir) + ' th)</div></div>' +
      '<div class="detail-item"><div class="k">Jenis Kelamin</div><div class="v">' + Utils.esc(a.jk) + '</div></div>' +
      '<div class="detail-item"><div class="k">Tinggi / Berat</div><div class="v">' + Utils.esc(a.tinggi) + ' cm / ' + Utils.esc(a.berat) + ' kg</div></div>' +
      '<div class="detail-item"><div class="k">BMI</div><div class="v">' + Utils.esc(a.bmi) + ' (' + Utils.esc(a.kategori_bmi) + ')</div></div>' +
      '<div class="detail-item"><div class="k">Asal Sekolah</div><div class="v">' + Utils.esc(a.sekolah) + '</div></div>' +
      '<div class="detail-item"><div class="k">Asal PB</div><div class="v">' + Utils.esc(a.asal_pb || '-') + '</div></div>' +
      '<div class="detail-item"><div class="k">No. HP</div><div class="v">' + Utils.esc(a.no_hp) + '</div></div>' +
      '<div class="detail-item"><div class="k">ID Login</div><div class="v">' + Utils.esc(user ? user.username : '-') + '</div></div>' +
      '<div class="detail-item"><div class="k">Kehadiran 30 Hari</div><div class="v">' + (rate === null ? '-' : rate + '%') + '</div></div>' +
      '<div class="detail-item"><div class="k">Tren Latihan</div><div class="v">' + (t ? UI.badge(t.label, t.tone) : '-') + '</div></div>' +
      '</div>';

    body += '<h4 class="mt-3">Tes Fisik Terakhir</h4>';
    if (tests.length) {
      body += '<div class="chip-row">' + tests.map(function (t2) {
        return UI.badge(t2.jenis_tes + ': ' + t2.hasil + ' ' + t2.satuan, 'primary');
      }).join('') + '</div>';
    } else {
      body += UI.emptyState('Belum ada hasil tes fisik.', 'activity');
    }

    body += '<h4 class="mt-2">Pertandingan Terakhir</h4>';
    if (matches.length) {
      body += '<div class="list-rows">' + matches.map(function (m) {
        return '<div class="list-row"><div class="grow"><b>' + Utils.esc(m.turnamen) + '</b>' +
          '<span>' + Utils.fmtDate(m.tanggal) + ' vs ' + Utils.esc(m.lawan) + '</span></div>' +
          UI.statusBadge(m.hasil) + '</div>';
      }).join('') + '</div>';
    } else {
      body += UI.emptyState('Belum ada catatan pertandingan.', 'trophy');
    }

    body += '<div id="m-detail-kemajuan"></div>';
    body += '<h4 class="mt-3">Dokumen Pendaftaran</h4>' + Docs.viewerHtml(a.dokumen || {});

    document.getElementById('modal-host').innerHTML =
      UI.modalShell('m-detail', 'Detail Atlet',
        UI.backButton({ closeModal: 'm-detail' }) + body,
        '<button type="button" class="btn btn-ghost" data-back-close="m-detail">Tutup</button>' +
        '<button type="button" class="btn" id="m-detail-edit">Edit Data</button>');
    UI.openModal('m-detail');

    if (typeof Kemajuan !== 'undefined' && Kemajuan && Kemajuan.render) {
      Kemajuan.render(document.getElementById('m-detail-kemajuan'), { idAtlet: a.id_atlet });
    }

    Docs.bindViewer(document.getElementById('m-detail-body'), a.dokumen || {});

    var editBtn = document.getElementById('m-detail-edit');
    if (editBtn) {
      editBtn.addEventListener('click', function () {
        UI.closeModal('m-detail');
        openAthleteForm(a);
      });
    }
  }

  // Riwayat pembayaran per atlet: SPP / Pertandingan / Persahabatan.
  // Ditampilkan dalam satu modal: form tambah/edit di atas, daftar di bawah.
  function bukaPembayaran(idAtlet) {
    var a = UI.athleteById(idAtlet);
    if (!a) return;
    var editId = null;

    function totalHtml(rows) {
      var lunas = 0, belum = 0;
      rows.forEach(function (r) {
        var n = Number(r.nominal) || 0;
        if (r.status === 'lunas') lunas += n;
        else belum += n;
      });
      return '<div class="stat-grid" style="grid-template-columns:repeat(3,1fr)">' +
        UI.statCard('Total Entri', rows.length, 'semua kategori', 'clipboard', 'primary') +
        UI.statCard('Sudah Lunas', 'Rp ' + Utils.fmtNumber(lunas, 0), 'pembayaran lunas', 'check', 'ok') +
        UI.statCard('Belum Lunas', 'Rp ' + Utils.fmtNumber(belum, 0), 'perlu ditindaklanjuti', 'alert', 'warn') +
        '</div>';
    }

    function listHtml() {
      var rows = Utils.sortBy(Store.where('pembayaran', function (r) {
        return r.id_atlet === idAtlet;
      }), 'tanggal', 'desc');
      if (!rows.length) return UI.emptyState('Belum ada riwayat pembayaran.', 'save');
      return totalHtml(rows) +
        '<div class="table-wrap"><table class="table"><thead><tr>' +
        '<th>Tanggal</th><th>Kategori</th><th class="align-right">Nominal</th><th>Keterangan</th><th>Status</th><th class="align-center">Aksi</th>' +
        '</tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr>' +
            '<td>' + Utils.fmtDate(r.tanggal, true) + '</td>' +
            '<td>' + UI.badge(r.kategori, 'primary') + '</td>' +
            '<td class="align-right fw-bold">Rp ' + Utils.fmtNumber(Number(r.nominal) || 0, 0) + '</td>' +
            '<td class="small">' + Utils.esc(r.keterangan || '-') + '</td>' +
            '<td>' + (r.status === 'lunas' ? UI.badge('Lunas', 'ok') : UI.badge('Belum Lunas', 'warn')) + '</td>' +
            '<td class="align-center"><div class="flex gap-1" style="justify-content:center">' +
            '<button type="button" class="btn btn-sm btn-secondary" data-bayar-edit="' + Utils.esc(r.id) + '">Edit</button>' +
            '<button type="button" class="btn btn-sm btn-danger" data-bayar-hapus="' + Utils.esc(r.id) + '">Hapus</button>' +
            '</div></td></tr>';
        }).join('') + '</tbody></table></div>';
    }

    function formHtml() {
      return '<form id="form-bayar" novalidate class="mb-2">' +
        '<div class="form-grid cols-2">' +
        UI.field({ name: 'tanggal', label: 'Tanggal', type: 'date', required: true, value: Utils.todayISO() }) +
        UI.field({ name: 'kategori', label: 'Kategori', type: 'select', required: true, value: 'SPP', options: CONFIG.KATEGORI_PEMBAYARAN }) +
        UI.field({ name: 'nominal', label: 'Nominal (Rp)', type: 'number', required: true, min: 0, step: '1000', placeholder: 'contoh: 150000' }) +
        UI.field({ name: 'status', label: 'Status', type: 'select', value: 'lunas', options: CONFIG.STATUS_PEMBAYARAN }) +
        UI.field({ name: 'keterangan', label: 'Keterangan', placeholder: 'Opsional, contoh: SPP Oktober' }) +
        '</div>' +
        '<div class="flex gap-1 flex-wrap">' +
        '<button class="btn" type="submit">' + UI.icon('save', 20) + ' Simpan Pembayaran</button>' +
        '<button type="button" class="btn btn-ghost" data-bayar-batal>Batal</button>' +
        '</div></form>';
    }

    function render() {
      document.getElementById('m-bayar-body').innerHTML = formHtml() +
        '<h4 class="mt-2">Riwayat Pembayaran</h4>' + listHtml();
      var form = document.getElementById('form-bayar');
      if (editId) {
        var r = Store.find('pembayaran', editId);
        if (r) {
          form.querySelector('[name="tanggal"]').value = r.tanggal || '';
          form.querySelector('[name="kategori"]').value = r.kategori || 'SPP';
          form.querySelector('[name="nominal"]').value = r.nominal === undefined ? '' : r.nominal;
          form.querySelector('[name="status"]').value = r.status || 'lunas';
          form.querySelector('[name="keterangan"]').value = r.keterangan || '';
        }
      }
      UI.bindSubmit(form, function () {
        Utils.clearErrors(form);
        var d = Utils.formData(form);
        var errors = {};
        if (!d.tanggal) errors.tanggal = 'Tanggal wajib diisi.';
        if (!d.kategori) errors.kategori = 'Kategori wajib dipilih.';
        if (d.nominal === '' || isNaN(Number(d.nominal)) || Number(d.nominal) < 0) errors.nominal = 'Nominal tidak valid.';
        if (Object.keys(errors).length) {
          Utils.showErrors(form, errors);
          Utils.toast('Mohon lengkapi isian yang ditandai.', 'danger');
          return;
        }
        var payload = {
          id_atlet: idAtlet,
          tanggal: d.tanggal,
          kategori: d.kategori,
          nominal: Number(d.nominal),
          keterangan: d.keterangan || '',
          status: d.status === 'lunas' ? 'lunas' : 'belum'
        };
        if (editId) {
          Store.update('pembayaran', editId, payload);
          Utils.toast('Pembayaran berhasil diperbarui.', 'success');
        } else {
          Store.insert('pembayaran', payload);
          Utils.toast('Pembayaran berhasil ditambahkan.', 'success');
        }
        editId = null;
        render();
      });
    }

    document.getElementById('modal-host').innerHTML =
      UI.modalShell('m-bayar', 'Riwayat Pembayaran - ' + a.nama,
        UI.backButton({ closeModal: 'm-bayar' }) + '<div id="m-bayar-body"></div>',
        '<button type="button" class="btn btn-ghost" data-back-close="m-bayar">Tutup</button>');
    UI.openModal('m-bayar');
    render();

    var host = document.getElementById('m-bayar');
    host.addEventListener('click', function (e) {
      var edit = e.target.closest('[data-bayar-edit]');
      if (edit) {
        editId = edit.getAttribute('data-bayar-edit');
        render();
        return;
      }
      var hapus = e.target.closest('[data-bayar-hapus]');
      if (hapus) {
        UI.confirmDialog('Data pembayaran ini akan dihapus. Lanjutkan?', 'Konfirmasi Hapus').then(function (ok) {
          if (!ok) return;
          Store.remove('pembayaran', hapus.getAttribute('data-bayar-hapus'));
          if (editId === hapus.getAttribute('data-bayar-hapus')) editId = null;
          Utils.toast('Data pembayaran dihapus.', 'success');
          render();
        });
        return;
      }
      if (e.target.closest('[data-bayar-batal]')) {
        editId = null;
        render();
      }
    });
  }

  function daftarAtlet(root, user, app) {
    root.innerHTML =
      '<div class="page">' +
      UI.pageHeader('Daftar Atlet', 'Cari, lihat detail, dan kelola data atlet.',
        '<button type="button" class="btn" data-add-atlet>' + UI.icon('plus', 20) + ' Tambah Atlet</button>') +
      '<div class="card">' +
      '<div class="filter-bar">' +
      '<input class="input" id="filter-cari" placeholder="Cari nama atau ID atlet...">' +
      '<select class="input" id="filter-jk" style="max-width:180px"><option value="">Semua jenis kelamin</option>' +
      CONFIG.GENDER.map(function (g) { return '<option value="' + Utils.esc(g) + '">' + Utils.esc(g) + '</option>'; }).join('') +
      '</select>' +
      '<select class="input" id="filter-sekolah" style="max-width:220px"><option value="">Semua sekolah</option></select>' +
      '<select class="input" id="filter-status" style="max-width:180px" aria-label="Filter status">' +
      '<option value="">Semua status</option>' +
      '<option value="aktif">Aktif</option>' +
      '<option value="nonaktif">Non-Aktif</option>' +
      '</select>' +
      '</div>' +
      '<div id="daftar-atlet-list"></div>' +
      '</div></div>';

    var page = root.querySelector('.page');
    var listBox = page.querySelector('#daftar-atlet-list');

    function fillSchools() {
      var select = page.querySelector('#filter-sekolah');
      var schools = {};
      Store.all('athletes').forEach(function (a) {
        if (a.sekolah) schools[a.sekolah] = true;
      });
      var current = select.value;
      select.innerHTML = '<option value="">Semua sekolah</option>' +
        Object.keys(schools).sort().map(function (s) {
          return '<option value="' + Utils.esc(s) + '">' + Utils.esc(s) + '</option>';
        }).join('');
      select.value = current;
    }

    function buildRows() {
      var q = page.querySelector('#filter-cari').value.trim().toLowerCase();
      var jk = page.querySelector('#filter-jk').value;
      var sekolah = page.querySelector('#filter-sekolah').value;
      var status = page.querySelector('#filter-status').value;
      var rows = Store.all('athletes').filter(function (a) {
        if (jk && a.jk !== jk) return false;
        if (sekolah && a.sekolah !== sekolah) return false;
        if (status && (a.status || 'aktif') !== status) return false;
        if (q && (a.nama || '').toLowerCase().indexOf(q) === -1 && (a.id_atlet || '').toLowerCase().indexOf(q) === -1) return false;
        return true;
      });

      if (!rows.length) return UI.emptyState('Tidak ada atlet yang cocok.', 'users');

      return '<div class="table-wrap"><table class="table"><thead><tr>' +
        '<th>Atlet</th><th>ID</th><th>Usia</th><th>BMI</th><th>Sekolah</th><th>Kehadiran</th><th>Status</th><th class="align-center">Aksi</th>' +
        '</tr></thead><tbody>' +
        rows.map(function (a) {
          var rate = Shared.attendanceRate(a.id_atlet, 30);
          return '<tr>' +
            '<td><div class="flex items-center gap-1">' + UI.avatar(a, 38) + '<div><b>' + Utils.esc(a.nama) + '</b>' +
            '<div class="small muted">' + Utils.esc(a.jk) + '</div></div></div></td>' +
            '<td>' + UI.badge(a.id_atlet, 'primary') + '</td>' +
            '<td>' + Utils.age(a.tgl_lahir) + ' th</td>' +
            '<td>' + Utils.esc(a.bmi) + '<div class="small muted">' + Utils.esc(a.kategori_bmi) + '</div></td>' +
            '<td>' + Utils.esc(a.sekolah) + '</td>' +
            '<td>' + (rate === null ? '-' : rate + '%') + '</td>' +
            '<td><div class="flex items-center gap-1">' +
            '<button type="button" class="switch' + ((a.status || 'aktif') === 'aktif' ? ' on' : '') + '"' +
            ' role="switch" aria-checked="' + ((a.status || 'aktif') === 'aktif') + '"' +
            ' data-toggle-status="' + Utils.esc(a.id_atlet) + '"' +
            ' aria-label="Status atlet ' + Utils.esc(a.nama) + '"><span class="switch-knob"></span></button>' +
            UI.statusBadge(a.status || 'aktif') + '</div></td>' +
            '<td class="align-center"><div class="flex gap-1" style="justify-content:center">' +
            '<button type="button" class="btn btn-sm btn-ghost" data-detail-atlet="' + Utils.esc(a.id_atlet) + '">Detail</button>' +
            '<button type="button" class="btn btn-sm btn-secondary" data-edit-atlet="' + Utils.esc(a.id_atlet) + '">Edit</button>' +
            '<button type="button" class="btn btn-sm" data-bayar-atlet="' + Utils.esc(a.id_atlet) + '">Bayar</button>' +
            '<button type="button" class="btn btn-sm btn-danger" data-delete-atlet="' + Utils.esc(a.id_atlet) + '">Hapus</button>' +
            '</div></td></tr>';
        }).join('') +
        '</tbody></table></div>';
    }

    function refresh() {
      fillSchools();
      listBox.innerHTML = buildRows();
    }

    refresh();

    page.addEventListener('input', Utils.debounce(function (e) {
      if (e.target.id === 'filter-cari') refresh();
    }, 180));
    page.addEventListener('change', function (e) {
      if (e.target.id === 'filter-cari' || e.target.id === 'filter-jk' ||
        e.target.id === 'filter-sekolah' || e.target.id === 'filter-status') refresh();
    });

    page.addEventListener('click', function (e) {
      if (e.target.closest('[data-add-atlet]')) {
        openAthleteForm(null);
        return;
      }
      var toggle = e.target.closest('[data-toggle-status]');
      if (toggle) {
        var idToggle = toggle.getAttribute('data-toggle-status');
        var atletToggle = UI.athleteById(idToggle);
        if (!atletToggle) return;
        var baru = (atletToggle.status || 'aktif') === 'aktif' ? 'nonaktif' : 'aktif';
        Store.update('athletes', atletToggle.id, { status: baru });
        UI.toast('Status atlet diubah menjadi ' + baru + '.', 'success');
        refresh();
        return;
      }
      var bayar = e.target.closest('[data-bayar-atlet]');
      if (bayar) {
        bukaPembayaran(bayar.getAttribute('data-bayar-atlet'));
        return;
      }
      var detail = e.target.closest('[data-detail-atlet]');
      if (detail) {
        openAthleteDetail(detail.getAttribute('data-detail-atlet'));
        return;
      }
      var edit = e.target.closest('[data-edit-atlet]');
      if (edit) {
        var a = UI.athleteById(edit.getAttribute('data-edit-atlet'));
        UI.closeModal('m-detail');
        if (a) openAthleteForm(a);
        return;
      }
      var del = e.target.closest('[data-delete-atlet]');
      if (del) {
        var target = UI.athleteById(del.getAttribute('data-delete-atlet'));
        if (!target) return;
        UI.confirmDialog('Hapus atlet ' + target.nama + ' beserta seluruh data kehadiran, logbook, tes, dan pertandingannya?', 'Hapus Atlet').then(function (ok) {
          if (!ok) return;
          Store.removeWhere('attendance', function (r) { return r.id_atlet === target.id_atlet; });
          Store.removeWhere('logbook_entries', function (r) { return r.id_atlet === target.id_atlet; });
          Store.removeWhere('physical_tests', function (r) { return r.id_atlet === target.id_atlet; });
          Store.removeWhere('matches', function (r) { return r.id_atlet === target.id_atlet; });
          Store.remove('athletes', target.id);
          Store.remove('users', target.user_id);
          UI.toast('Atlet dihapus.', 'success');
          refresh();
        });
      }
    });

    app.subscribe('athletes', refresh);
    app.subscribe('attendance', refresh);
  }

  function kehadiran(root, user, app) {
    root.innerHTML =
      '<div class="page">' +
      UI.pageHeader('Kehadiran', 'Pantau kehadiran atlet dan jurnal asisten pelatih.') +
      '<div class="card">' +
      '<div class="tabs" role="tablist" id="kh-jurnal">' +
      '<button type="button" class="tab active" data-jurnal="atlet" role="tab">Jurnal Kehadiran Atlet</button>' +
      '<button type="button" class="tab" data-jurnal="asisten" role="tab">Jurnal Kehadiran Asisten Pelatih</button>' +
      '</div>' +
      '<div id="kh-jurnal-isi"></div>' +
      '</div></div>';

    var page = root.querySelector('.page');
    var isi = page.querySelector('#kh-jurnal-isi');
    var jurnal = 'atlet';
    var modeAtlet = 'hari';

    /* ---------- JURNAL KEHADIRAN ATLET (fitur lama) ---------- */
    function renderAtlet() {
      return '<div class="filter-bar">' +
        UI.tabs([{ id: 'hari', label: 'Hari Ini' }, { id: 'bulan', label: 'Rekap Bulanan' }], modeAtlet) +
        '<input class="input" type="date" id="kh-tanggal" style="max-width:220px"' + (modeAtlet === 'hari' ? '' : ' hidden') + '>' +
        '<select class="input" id="kh-bulan" style="max-width:220px"' + (modeAtlet === 'bulan' ? '' : ' hidden') + '></select>' +
        '</div>' +
        '<div id="kh-body"></div>';
    }

    function renderHari(tgl) {
      var athletes = Shared.activeAthletes();
      var s = Shared.attendanceSummary(tgl);
      var html = '<div class="stat-grid" style="grid-template-columns:repeat(2,1fr)">' +
        UI.statCard('Total Hadir', s.Hadir + ' / ' + s.total, s.persen + '% kehadiran', 'check', 'ok') +
        UI.statCard('Izin / Sakit / Absen', (s.Izin + s.Sakit + s['Tidak Hadir']) + ' atlet', s.Izin + ' izin / ' + s.Sakit + ' sakit / ' + s['Tidak Hadir'] + ' absen', 'alert', 'warn') +
        '</div>';

      if (!athletes.length) {
        html += UI.emptyState('Belum ada atlet terdaftar.', 'users');
        return html;
      }

      html += '<div class="attendance-grid mt-2">';
      athletes.forEach(function (a) {
        var rec = Shared.attendanceFor(tgl, a.id_atlet);
        html += '<div class="attendance-item">' +
          '<div class="attendance-head">' + UI.avatar(a, 42) +
          '<div class="grow"><b>' + Utils.esc(a.nama) + '</b><span>' + Utils.esc(a.id_atlet) + ' / ' + Utils.esc(a.sekolah) + '</span></div>' +
          (rec ? UI.statusBadge(rec.status) : UI.badge('Belum diabsen', 'muted')) +
          '</div>' +
          (rec ? '<div class="small muted">Diinput oleh ' + Utils.esc(UI.userName(rec.input_oleh)) +
            (rec.catatan ? ' / ' + Utils.esc(rec.catatan) : '') + '</div>' : '<div class="small muted">Belum ada catatan untuk tanggal ini.</div>') +
          '</div>';
      });
      html += '</div>';
      return html;
    }

    function renderBulan(key) {
      var athletes = Shared.activeAthletes();
      if (!athletes.length) return UI.emptyState('Belum ada atlet terdaftar.', 'users');
      var html = '<div class="table-wrap"><table class="table"><thead><tr>' +
        '<th>Atlet</th><th class="align-center">Hadir</th><th class="align-center">Izin</th><th class="align-center">Sakit</th>' +
        '<th class="align-center">Tidak Hadir</th><th class="align-center">Total</th><th class="align-center">Persen</th>' +
        '</tr></thead><tbody>';
      athletes.forEach(function (a) {
        var rows = Store.where('attendance', function (r) {
          return r.id_atlet === a.id_atlet && r.tipe === 'atlet' && Utils.monthKey(r.tanggal) === key;
        });
        var c = { Hadir: 0, Izin: 0, Sakit: 0, 'Tidak Hadir': 0 };
        rows.forEach(function (r) {
          if (c[r.status] !== undefined) c[r.status]++;
        });
        var total = rows.length;
        var pct = Utils.pct(c.Hadir, total);
        html += '<tr>' +
          '<td><div class="flex items-center gap-1">' + UI.avatar(a, 34) + '<b>' + Utils.esc(a.nama) + '</b></div></td>' +
          '<td class="align-center text-ok fw-bold">' + c.Hadir + '</td>' +
          '<td class="align-center">' + c.Izin + '</td>' +
          '<td class="align-center">' + c.Sakit + '</td>' +
          '<td class="align-center text-danger">' + c['Tidak Hadir'] + '</td>' +
          '<td class="align-center">' + total + '</td>' +
          '<td class="align-center">' + (total ? (pct < 75 ? '<span class="text-danger fw-bold">' + pct + '%</span>' : '<span class="text-ok fw-bold">' + pct + '%</span>') : '-') + '</td>' +
          '</tr>';
      });
      html += '</tbody></table></div>';
      return html;
    }

    function fillMonths(selectEl) {
      var current = selectEl.value;
      var map = {};
      Store.all('attendance').forEach(function (r) {
        map[Utils.monthKey(r.tanggal)] = true;
      });
      map[Utils.monthKey(Utils.todayISO())] = true;
      var keys = Object.keys(map).sort().reverse();
      selectEl.innerHTML = keys.map(function (m) {
        return '<option value="' + m + '">' + Utils.esc(Utils.fmtDate(m + '-01', true)) + '</option>';
      }).join('');
      if (current && map[current]) selectEl.value = current;
    }

    function refreshAtlet() {
      var body = isi.querySelector('#kh-body');
      if (!body) return;
      var tanggalInput = isi.querySelector('#kh-tanggal');
      var bulanSelect = isi.querySelector('#kh-bulan');
      if (modeAtlet === 'hari') {
        body.innerHTML = renderHari(tanggalInput.value || Utils.todayISO());
      } else {
        fillMonths(bulanSelect);
        body.innerHTML = renderBulan(bulanSelect.value);
      }
    }

    /* ---------- JURNAL KEHADIRAN ASISTEN PELATIH ---------- */
    function renderAsisten() {
      var namaAsisten = {};
      Store.all('absensi_asisten').forEach(function (r) {
        var u = Store.find('users', r.id_asisten);
        namaAsisten[r.id_asisten] = (u && u.nama) || r.nama_asisten || r.id_asisten;
      });
      var lokasiList = {};
      Store.all('absensi_asisten').forEach(function (r) {
        if (r.lokasi) lokasiList[r.lokasi] = true;
      });

      var fTanggal = isi.querySelector('#ka-tanggal');
      var fAsisten = isi.querySelector('#ka-asisten');
      var fLokasi = isi.querySelector('#ka-lokasi');
      var nilaiTanggal = fTanggal ? fTanggal.value : '';
      var nilaiAsisten = fAsisten ? fAsisten.value : '';
      var nilaiLokasi = fLokasi ? fLokasi.value : '';

      var rows = Store.where('absensi_asisten', function (r) {
        if (nilaiTanggal && r.tanggal !== nilaiTanggal) return false;
        if (nilaiAsisten && r.id_asisten !== nilaiAsisten) return false;
        if (nilaiLokasi && r.lokasi !== nilaiLokasi) return false;
        return true;
      });
      rows = Utils.sortBy(rows, 'tanggal', 'desc');

      var filterHtml = '<div class="filter-bar">' +
        '<input class="input" type="date" id="ka-tanggal" style="max-width:200px" value="' + Utils.esc(nilaiTanggal) + '" aria-label="Filter tanggal">' +
        '<select class="input" id="ka-asisten" style="max-width:220px" aria-label="Filter nama asisten">' +
        '<option value="">Semua asisten</option>' +
        Object.keys(namaAsisten).map(function (id) {
          return '<option value="' + Utils.esc(id) + '"' + (nilaiAsisten === id ? ' selected' : '') + '>' + Utils.esc(namaAsisten[id]) + '</option>';
        }).join('') +
        '</select>' +
        '<select class="input" id="ka-lokasi" style="max-width:220px" aria-label="Filter lokasi">' +
        '<option value="">Semua lokasi</option>' +
        Object.keys(lokasiList).sort().map(function (l) {
          return '<option value="' + Utils.esc(l) + '"' + (nilaiLokasi === l ? ' selected' : '') + '>' + Utils.esc(l) + '</option>';
        }).join('') +
        '</select>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-reset-filter>Reset</button>' +
        '</div>';

      if (!rows.length) {
        return filterHtml + UI.emptyState('Belum ada jurnal kehadiran asisten pelatih.', 'user');
      }

      return filterHtml +
        '<div class="table-wrap"><table class="table"><thead><tr>' +
        '<th>Asisten</th><th>Tanggal</th><th>Lokasi</th><th>Atlet yang Dilatih</th><th>Program</th>' +
        '</tr></thead><tbody>' +
        rows.map(function (r) {
          var atlet = (r.atlet || []).map(function (id) {
            var a = UI.athleteById(id);
            return Utils.esc(a ? a.nama : id);
          }).join(', ');
          var u = Store.find('users', r.id_asisten);
          return '<tr>' +
            '<td><div class="flex items-center gap-1">' + UI.avatar(u || { nama: r.nama_asisten || '-' }, 34) +
            '<b>' + Utils.esc((u && u.nama) || r.nama_asisten || '-') + '</b></div></td>' +
            '<td>' + Utils.fmtDate(r.tanggal, true) + '</td>' +
            '<td>' + Utils.esc(r.lokasi || '-') + '</td>' +
            '<td class="small">' + (atlet || '-') + '</td>' +
            '<td class="small">' + Utils.esc(r.program || '-') + '</td>' +
            '</tr>';
        }).join('') + '</tbody></table></div>';
    }

    function refresh() {
      if (jurnal === 'atlet') {
        isi.innerHTML = renderAtlet();
        refreshAtlet();
      } else {
        isi.innerHTML = renderAsisten();
      }
    }

    refresh();

    page.addEventListener('click', function (e) {
      var tombolJurnal = e.target.closest('[data-jurnal]');
      if (tombolJurnal) {
        jurnal = tombolJurnal.getAttribute('data-jurnal');
        page.querySelectorAll('[data-jurnal]').forEach(function (t) {
          t.classList.toggle('active', t === tombolJurnal);
        });
        refresh();
        return;
      }
      var tabAtlet = e.target.closest('[data-tab]');
      if (tabAtlet && jurnal === 'atlet') {
        modeAtlet = tabAtlet.getAttribute('data-tab');
        refresh();
        return;
      }
      if (e.target.closest('[data-reset-filter]')) {
        refresh();
      }
    });

    page.addEventListener('change', function (e) {
      var id = e.target.id;
      if (id === 'kh-tanggal' || id === 'kh-bulan') {
        refreshAtlet();
        return;
      }
      if (id === 'ka-tanggal' || id === 'ka-asisten' || id === 'ka-lokasi') {
        refresh();
      }
    });

    app.subscribe('attendance', refresh);
    app.subscribe('absensi_asisten', refresh);
    app.subscribe('athletes', refresh);
    app.subscribe('users', refresh);
  }

  function tesFisik(root, user, app) {
    root.innerHTML =
      '<div class="page">' +
      UI.pageHeader('Tes Fisik', 'Input dan pantau hasil tes fisik setiap atlet.',
        '<button type="button" class="btn btn-ghost" data-manage-tes>' + UI.icon('settings', 20) + ' Kelola Jenis Tes</button>') +
      '<div class="card">' +
      '<div class="card-title">' + UI.icon('plus', 20) + 'Input Hasil Tes</div>' +
      '<form id="form-tes" novalidate><div class="form-grid cols-2">' +
      UI.selectAthlete('id_atlet', '', { label: 'Atlet' }) +
      UI.field({ name: 'id_tes', label: 'Jenis Tes', type: 'select', required: true, options: [{ value: '', label: '-- Pilih jenis tes --' }].concat(Shared.testTypes().map(function (t) { return { value: t.id, label: t.nama + ' (' + t.satuan + ')' }; })) }) +
      UI.field({ name: 'tanggal', label: 'Tanggal Tes', type: 'date', required: true, value: Utils.todayISO() }) +
      UI.field({ name: 'hasil', label: 'Hasil', type: 'number', required: true, step: '0.1', placeholder: 'contoh: 8.4' }) +
      '</div>' +
      '<button type="submit" class="btn">' + UI.icon('save', 20) + ' Simpan Hasil</button>' +
      '</form></div>' +
      '<div class="card mt-2">' +
      '<div class="card-title">' + UI.icon('chart', 20) + 'Riwayat &amp; Grafik</div>' +
      '<div class="filter-bar">' +
      '<div class="field" style="flex:1;min-width:200px;margin-bottom:0">' +
      '<label class="label" for="tf-atlet-sel">Atlet</label>' +
      '<select class="input" id="tf-atlet-sel"><option value="">Semua atlet</option>' +
      Shared.activeAthletes().map(function (a) {
        return '<option value="' + Utils.esc(a.id_atlet) + '">' + Utils.esc(a.nama) + ' (' + Utils.esc(a.id_atlet) + ')</option>';
      }).join('') + '</select></div>' +
      '<div class="field" style="flex:1;min-width:200px;margin-bottom:0">' +
      '<label class="label" for="tf-jenis">Jenis Tes</label>' +
      '<select class="input" id="tf-jenis"><option value="">Semua jenis tes</option>' +
      Shared.testTypes().map(function (t) { return '<option value="' + Utils.esc(t.id) + '">' + Utils.esc(t.nama) + '</option>'; }).join('') +
      '</select></div>' +
      '</div>' +
      '<div class="chart-box tall"><canvas id="chart-tes"></canvas><div class="chart-fallback" id="chart-tes-hint" hidden></div></div>' +
      '<div id="tf-riwayat" class="mt-2"></div>' +
      '</div></div>';

    var page = root.querySelector('.page');
    var form = page.querySelector('#form-tes');
    var riwayat = page.querySelector('#tf-riwayat');

    UI.bindSubmit(form, function () {
      Utils.clearErrors(form);
      var data = Utils.formData(form);
      var errors = {};
      if (!data.id_atlet) errors.id_atlet = 'Pilih atlet.';
      if (!data.id_tes) errors.id_tes = 'Pilih jenis tes.';
      if (!data.tanggal) errors.tanggal = 'Tanggal wajib diisi.';
      if (data.hasil === '' || isNaN(Number(data.hasil))) errors.hasil = 'Hasil tidak valid.';
      if (Object.keys(errors).length) {
        Utils.showErrors(form, errors);
        Utils.toast('Periksa kembali isian yang ditandai.', 'danger');
        return;
      }
      var tt = Store.find('test_types', data.id_tes);
      Store.insert('physical_tests', {
        id_atlet: data.id_atlet,
        tanggal: data.tanggal,
        id_tes: data.id_tes,
        jenis_tes: tt ? tt.nama : data.id_tes,
        hasil: Number(data.hasil),
        satuan: tt ? tt.satuan : '',
        lebih_baik: tt ? tt.lebih_baik : 'tinggi',
        input_oleh: user.id
      });
      UI.toast('Hasil tes berhasil disimpan.', 'success');
      form.reset();
      form.querySelector('[name="tanggal"]').value = Utils.todayISO();
      refresh();
    });

    function refresh() {
      var sel = page.querySelector('#tf-atlet-sel');
      var idAtlet = sel ? sel.value : '';
      var idTes = page.querySelector('#tf-jenis').value;
      var rows = Utils.sortBy(Store.where('physical_tests', function (t) {
        if (idAtlet && t.id_atlet !== idAtlet) return false;
        if (idTes && t.id_tes !== idTes) return false;
        return true;
      }), 'tanggal', 'desc');

      riwayat.innerHTML = rows.length ? '<div class="table-wrap"><table class="table"><thead><tr>' +
        '<th>Tanggal</th><th>Atlet</th><th>Jenis Tes</th><th class="align-right">Hasil</th><th>Input Oleh</th>' +
        '</tr></thead><tbody>' +
        rows.slice(0, 60).map(function (t) {
          var a = UI.athleteById(t.id_atlet);
          return '<tr><td>' + Utils.fmtDate(t.tanggal) + '</td>' +
            '<td>' + Utils.esc(a ? a.nama : '-') + '</td>' +
            '<td>' + Utils.esc(t.jenis_tes) + '</td>' +
            '<td class="align-right fw-bold">' + Utils.esc(t.hasil) + ' <span class="small muted">' + Utils.esc(t.satuan) + '</span></td>' +
            '<td>' + Utils.esc(UI.userName(t.input_oleh)) + '</td></tr>';
        }).join('') + '</tbody></table></div>' : UI.emptyState('Belum ada hasil tes fisik.', 'activity');

      var canvas = page.querySelector('#chart-tes');
      var hint = page.querySelector('#chart-tes-hint');
      if (!canvas) return;
      if (!idAtlet) {
        Charts.destroy(canvas);
        canvas.style.display = 'none';
        if (hint) {
          hint.hidden = false;
          hint.textContent = 'Pilih atlet terlebih dahulu untuk melihat grafik perkembangan tes fisik.';
        }
        return;
      }
      canvas.style.display = '';
      if (hint) hint.hidden = true;
      var history = Shared.testHistory(idAtlet, idTes || null);
      var byType = {};
      history.forEach(function (t) {
        if (!byType[t.jenis_tes]) byType[t.jenis_tes] = { labels: [], data: [] };
        byType[t.jenis_tes].labels.push(Utils.fmtDate(t.tanggal));
        byType[t.jenis_tes].data.push(t.hasil);
      });
      var labels = [];
      Object.keys(byType).forEach(function (k) {
        if (byType[k].labels.length > labels.length) labels = byType[k].labels;
      });
      Charts.line(canvas, labels, Object.keys(byType).map(function (k) {
        return { label: k, data: byType[k].data };
      }), { yTitle: 'Hasil' });
    }

    page.addEventListener('change', function (e) {
      if (e.target.id === 'tf-atlet-sel' || e.target.id === 'tf-jenis') refresh();
    });

    page.addEventListener('click', function (e) {
      if (!e.target.closest('[data-manage-tes]')) return;
      var types = Store.all('test_types');
      document.getElementById('modal-host').innerHTML = UI.modalShell('m-tes', 'Kelola Jenis Tes Fisik',
        UI.backButton({ closeModal: 'm-tes' }) +
        '<div class="list-rows">' + types.map(function (t) {
          return '<div class="list-row"><div class="grow"><b>' + Utils.esc(t.nama) + '</b>' +
            '<span>' + Utils.esc(t.satuan) + ' · lebih baik ' + Utils.esc(t.lebih_baik) + '</span></div>' +
            '<button type="button" class="btn btn-sm btn-danger" data-del-tes="' + Utils.esc(t.id) + '">Hapus</button></div>';
        }).join('') + '</div>' +
        '<h4 class="mt-3">Tambah Jenis Tes</h4>' +
        '<form id="form-tes-baru"><div class="form-grid cols-2">' +
        UI.field({ name: 'nama', label: 'Nama Tes', required: true, placeholder: 'contoh: Lari 40m' }) +
        UI.field({ name: 'satuan', label: 'Satuan', required: true, placeholder: 'contoh: detik' }) +
        UI.field({ name: 'lebih_baik', label: 'Nilai Lebih Baik', type: 'select', options: [{ value: 'tinggi', label: 'Semakin tinggi semakin baik' }, { value: 'rendah', label: 'Semakin rendah semakin baik' }] }) +
        '</div></form>',
        '<button type="button" class="btn btn-ghost" data-back-close="m-tes">Tutup</button>' +
        '<button class="btn" type="submit" form="form-tes-baru">Tambah</button>');
      UI.openModal('m-tes');

      var f = document.getElementById('form-tes-baru');
      UI.bindSubmit(f, function () {
        var d = Utils.formData(f);
        if (!d.nama || !d.satuan) {
          Utils.toast('Nama tes dan satuan wajib diisi.', 'danger');
          return;
        }
        Store.insert('test_types', {
          id: 'tt' + Date.now(),
          nama: d.nama,
          satuan: d.satuan,
          lebih_baik: d.lebih_baik
        });
        UI.toast('Jenis tes berhasil ditambahkan.', 'success');
        UI.closeModal('m-tes');
        App.render();
      });

      document.getElementById('m-tes').addEventListener('click', function (ev) {
        var del = ev.target.closest('[data-del-tes]');
        if (!del) return;
        var t = Store.find('test_types', del.getAttribute('data-del-tes'));
        UI.confirmDialog('Hapus jenis tes "' + (t ? t.nama : '') + '"?', 'Hapus Jenis Tes').then(function (ok) {
          if (!ok) return;
          Store.remove('test_types', del.getAttribute('data-del-tes'));
          UI.toast('Jenis tes dihapus.', 'success');
          UI.closeModal('m-tes');
          App.render();
        });
      });
    });

    refresh();
    app.subscribe('physical_tests', refresh);
  }

  function buildParameterForm(p) {
    var v = p || {};
    return '<form id="form-param">' +
      '<div class="form-grid cols-2">' +
      UI.field({ name: 'nama', label: 'Nama Parameter', required: true, value: v.nama, placeholder: 'contoh: Ketahanan Lengan' }) +
      UI.field({ name: 'kategori', label: 'Kategori', type: 'select', value: v.kategori || 'fisik', options: [{ value: 'fisik', label: 'Fisik Harian' }, { value: 'teknik', label: 'Teknik' }] }) +
      UI.field({ name: 'satuan', label: 'Satuan / Skala', required: true, value: v.satuan || 'skala 1-10', placeholder: 'contoh: skala 1-10' }) +
      UI.field({ name: 'aktif', label: 'Status', type: 'select', value: v.aktif === false ? 'false' : 'true', options: [{ value: 'true', label: 'Aktif' }, { value: 'false', label: 'Nonaktif' }] }) +
      '</div>' +
      '</form>';
  }

  function logbook(root, user, app) {
    root.innerHTML =
      '<div class="page">' +
      UI.pageHeader('Logbook', 'Fisik harian, penilaian teknik, dan pengaturan parameter.') +
      '<div class="card">' +
      UI.tabs([
        { id: 'fisik', label: 'Fisik Harian' },
        { id: 'teknik', label: 'Penilaian Teknik' },
        { id: 'parameter', label: 'Pengaturan Parameter' }
      ], 'fisik') +
      '<div id="logbook-body"></div>' +
      '</div></div>';

    var page = root.querySelector('.page');
    var body = page.querySelector('#logbook-body');
    var mode = 'fisik';

    function renderInputTab(kategori) {
      var params = Shared.activeParameters(kategori);
      var html = '<form id="form-log" novalidate>' +
        '<div class="form-grid cols-2">' +
        UI.selectAthlete('id_atlet', '', { label: 'Atlet' }) +
        UI.field({ name: 'tanggal', label: 'Tanggal', type: 'date', required: true, value: Utils.todayISO() }) +
        '</div>';
      if (!params.length) {
        html += UI.emptyState('Belum ada parameter ' + kategori + ' yang aktif. Tambahkan melalui tab Pengaturan Parameter.', 'settings');
      } else {
        html += '<div class="param-grid">' + params.map(function (p) {
          return '<div class="param-item">' +
            '<label class="label">' + Utils.esc(p.nama) + ' <span class="small muted">(' + Utils.esc(p.satuan) + ')</span></label>' +
            '<input class="input" type="number" name="p_' + Utils.esc(p.id) + '" min="1" max="10" step="1" placeholder="1 - 10">' +
            '<div class="field-error" data-error-for="p_' + Utils.esc(p.id) + '"></div>' +
            '</div>';
        }).join('') + '</div>';
      }
      html += UI.field({ name: 'catatan', label: 'Catatan untuk atlet', type: 'textarea', rows: 2, placeholder: 'Opsional. Contoh: servis sudah lebih stabil, pertahankan.' }) +
        '<button class="btn" type="submit">' + UI.icon('save', 20) + ' Simpan Logbook</button>' +
        '</form>';

      html += '<h4 class="mt-3">Entri ' + (kategori === 'fisik' ? 'Fisik Harian' : 'Teknik') + ' Terbaru</h4><div id="log-list"></div>';
      return html;
    }

    function renderParameterTab() {
      var params = Store.all('log_parameters');
      return '<div class="flex items-center justify-between flex-wrap gap-1 mb-2">' +
        '<p class="muted mb-0">Parameter dipakai pada form logbook asisten pelatih. Ubah sesuai kebutuhan tim.</p>' +
        '<button type="button" class="btn btn-sm" data-add-param>' + UI.icon('plus', 18) + ' Tambah Parameter</button>' +
        '</div>' +
        (params.length ? '<div class="table-wrap"><table class="table"><thead><tr>' +
          '<th>Parameter</th><th>Kategori</th><th>Satuan</th><th>Status</th><th class="align-center">Aksi</th>' +
          '</tr></thead><tbody>' +
          params.map(function (p) {
            return '<tr>' +
              '<td><b>' + Utils.esc(p.nama) + '</b></td>' +
              '<td>' + UI.badge(p.kategori === 'fisik' ? 'Fisik Harian' : 'Teknik', 'primary') + '</td>' +
              '<td>' + Utils.esc(p.satuan) + '</td>' +
              '<td>' + UI.statusBadge(p.aktif ? 'aktif' : 'nonaktif') + '</td>' +
              '<td class="align-center"><div class="flex gap-1" style="justify-content:center">' +
              '<button type="button" class="btn btn-sm btn-secondary" data-edit-param="' + Utils.esc(p.id) + '">Edit</button>' +
              '<button type="button" class="btn btn-sm btn-ghost" data-toggle-param="' + Utils.esc(p.id) + '">' + (p.aktif ? 'Nonaktifkan' : 'Aktifkan') + '</button>' +
              '<button type="button" class="btn btn-sm btn-danger" data-del-param="' + Utils.esc(p.id) + '">Hapus</button>' +
              '</div></td></tr>';
          }).join('') + '</tbody></table></div>' : UI.emptyState('Belum ada parameter.', 'settings'));
    }

    function refreshList(kategori) {
      var listHost = body.querySelector('#log-list');
      if (!listHost) return;
      var rows = Store.where('logbook_entries', function (e) {
        return e.kategori === kategori;
      });
      rows = Utils.sortBy(rows, 'tanggal', 'desc');
      if (!rows.length) {
        listHost.innerHTML = UI.emptyState('Belum ada entri.', 'clipboard');
        return;
      }
      var grouped = {};
      rows.forEach(function (r) {
        var key = r.id_atlet + '|' + r.tanggal;
        if (!grouped[key]) grouped[key] = { id_atlet: r.id_atlet, tanggal: r.tanggal, items: [], catatan: '', input_oleh: r.input_oleh };
        grouped[key].items.push(r);
        if (r.catatan) grouped[key].catatan = r.catatan;
      });
      var keys = Object.keys(grouped).sort().reverse();
      listHost.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr>' +
        '<th>Tanggal</th><th>Atlet</th><th>Ringkasan</th><th>Catatan</th><th>Input Oleh</th><th class="align-center">Aksi</th>' +
        '</tr></thead><tbody>' +
        keys.slice(0, 40).map(function (k) {
          var g = grouped[k];
          var a = UI.athleteById(g.id_atlet);
          var pills = g.items.map(function (i) {
            return '<span class="score-pill">' + Utils.esc(Shared.namaParameter(i)) + ': ' + Utils.esc(i.nilai) + '</span>';
          }).join('');
          var kunci = Utils.esc(g.id_atlet) + '|' + Utils.esc(g.tanggal) + '|' + Utils.esc(kategori);
          return '<tr>' +
            '<td>' + Utils.fmtDate(g.tanggal) + '</td>' +
            '<td><b>' + Utils.esc(a ? a.nama : '-') + '</b></td>' +
            '<td><div class="score-pills">' + pills + '</div></td>' +
            '<td class="small">' + Utils.esc(g.catatan || '-') + '</td>' +
            '<td class="small">' + Utils.esc(Shared.labelPenginput(g.items[0])) + '</td>' +
            '<td class="align-center"><div class="flex gap-1" style="justify-content:center">' +
            '<button type="button" class="btn btn-sm btn-secondary" data-log-edit="' + kunci + '">Edit</button>' +
            '<button type="button" class="btn btn-sm btn-danger" data-log-hapus="' + kunci + '">Hapus</button>' +
            '</div></td>' +
            '</tr>';
        }).join('') + '</tbody></table></div>';
    }

    function refresh() {
      if (mode === 'parameter') {
        body.innerHTML = renderParameterTab();
        return;
      }
      body.innerHTML = renderInputTab(mode);
      refreshList(mode);

      var form = body.querySelector('#form-log');
      if (form) {
        UI.bindSubmit(form, function () {
          Utils.clearErrors(form);
          var data = Utils.formData(form);
          var errors = {};
          if (!data.id_atlet) errors.id_atlet = 'Pilih atlet.';
          if (!data.tanggal) errors.tanggal = 'Tanggal wajib diisi.';
          var params = Shared.activeParameters(mode);
          if (!params.length) {
            Utils.toast('Tidak ada parameter aktif. Tambahkan dulu di tab Pengaturan Parameter.', 'danger');
            return;
          }
          var filled = 0;
          params.forEach(function (p) {
            var val = data['p_' + p.id];
            if (val === '' || val === undefined) return;
            filled++;
            var n = Number(val);
            if (isNaN(n) || n < 1 || n > 10) errors['p_' + p.id] = 'Isi nilai 1 - 10.';
          });
          if (!filled) errors['p_' + params[0].id] = 'Isi minimal satu nilai parameter.';
          if (Object.keys(errors).length) {
            Utils.showErrors(form, errors);
            Utils.toast('Periksa kembali isian.', 'danger');
            return;
          }
          params.forEach(function (p) {
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
          UI.toast('Logbook berhasil disimpan.', 'success');
          form.reset();
          form.querySelector('[name="tanggal"]').value = Utils.todayISO();
          refreshList(mode);
        });
      }
    }

    refresh();

    page.addEventListener('click', function (e) {
      var tab = e.target.closest('[data-tab]');
      if (tab) {
        mode = tab.getAttribute('data-tab');
        page.querySelectorAll('.tab').forEach(function (t) {
          t.classList.toggle('active', t === tab);
        });
        refresh();
        return;
      }

      var editLog = e.target.closest('[data-log-edit]');
      if (editLog) {
        var bagianEdit = editLog.getAttribute('data-log-edit').split('|');
        Shared.bukaEditorLogbook({
          idAtlet: bagianEdit[0],
          tanggal: bagianEdit[1],
          kategori: bagianEdit.slice(2).join('|'),
          user: user,
          onSelesai: function () {
            refresh();
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
          refresh();
        });
        return;
      }

      if (e.target.closest('[data-add-param]')) {
        openParamForm(null);
        return;
      }
      var edit = e.target.closest('[data-edit-param]');
      if (edit) {
        openParamForm(Store.find('log_parameters', edit.getAttribute('data-edit-param')));
        return;
      }
      var toggle = e.target.closest('[data-toggle-param]');
      if (toggle) {
        var p = Store.find('log_parameters', toggle.getAttribute('data-toggle-param'));
        if (!p) return;
        Store.update('log_parameters', p.id, { aktif: !p.aktif });
        UI.toast('Status parameter diperbarui.', 'success');
        refresh();
        return;
      }
      var del = e.target.closest('[data-del-param]');
      if (del) {
        var target = Store.find('log_parameters', del.getAttribute('data-del-param'));
        if (!target) return;
        UI.confirmDialog('Hapus parameter "' + target.nama + '"? Entri lama yang memakai parameter ini tetap tersimpan.', 'Hapus Parameter').then(function (ok) {
          if (!ok) return;
          Store.remove('log_parameters', target.id);
          UI.toast('Parameter dihapus.', 'success');
          refresh();
        });
      }
    });

    function openParamForm(p) {
      document.getElementById('modal-host').innerHTML =
        UI.modalShell('m-param', p ? 'Edit Parameter' : 'Tambah Parameter',
          UI.backButton({ closeModal: 'm-param' }) + buildParameterForm(p),
          '<button type="button" class="btn btn-ghost" data-back-close="m-param">Batal</button>' +
          '<button type="submit" class="btn" form="form-param">Simpan Parameter</button>');
      UI.openModal('m-param');
      var form = document.getElementById('form-param');
      UI.bindSubmit(form, function () {
        var d = Utils.formData(form);
        if (!d.nama || !d.satuan) {
          Utils.toast('Nama parameter dan satuan wajib diisi.', 'danger');
          return;
        }
        var payload = {
          nama: d.nama,
          kategori: d.kategori,
          satuan: d.satuan,
          aktif: d.aktif === 'true'
        };
        if (p) Store.update('log_parameters', p.id, payload);
        else Store.insert('log_parameters', Object.assign({ id: 'lp' + Date.now(), skala_min: 1, skala_max: 10 }, payload));
        UI.closeModal('m-param');
        Utils.toast('Parameter berhasil disimpan.', 'success');
        refresh();
      });
    }

    app.subscribe('log_parameters', function () {
      if (mode === 'parameter') refresh();
    });
    app.subscribe('logbook_entries', function () {
      if (mode !== 'parameter') refreshList(mode);
    });
  }

  function isSkorValid(value) {
    return Utils.isSkorValid(value);
  }

  function buildMatchForm(match, presetIdAtlet) {
    var m = match || {};
    var sets = (m.skor_set && m.skor_set.length ? m.skor_set : ['']);
    return '<form id="form-match" novalidate>' +
      '<div class="form-grid cols-2">' +
      UI.selectAthlete('id_atlet', m.id_atlet || presetIdAtlet || '', { label: 'Atlet' }) +
      UI.field({ name: 'tanggal', label: 'Tanggal', type: 'date', required: true, value: m.tanggal || Utils.todayISO() }) +
      UI.field({ name: 'turnamen', label: 'Turnamen', required: true, value: m.turnamen, placeholder: 'contoh: Surabaya Open 2026' }) +
      UI.field({ name: 'lawan', label: 'Lawan', required: true, value: m.lawan, placeholder: 'contoh: PB Jaya Raya' }) +
      UI.field({ name: 'hasil', label: 'Hasil', type: 'select', required: true, value: m.hasil || 'Menang', options: ['Menang', 'Kalah'] }) +
      UI.field({ name: 'catatan', label: 'Catatan', type: 'textarea', value: m.catatan, rows: 2, placeholder: 'Opsional' }) +
      '</div>' +
      '<div class="field">' +
      '<label class="label">Skor per Set <span class="req">*</span></label>' +
      '<div class="help" style="margin:0 0 8px">Format angka-angka, contoh: 21-18</div>' +
      '<div id="set-rows">' +
      sets.map(function (s, i) {
        return '<div class="set-row"><input class="input" name="set_' + i + '" value="' + Utils.esc(s) + '" placeholder="contoh: 21-18" inputmode="numeric" aria-label="Skor set ' + (i + 1) + '">' +
          '<button type="button" class="icon-btn" data-remove-set="' + i + '" aria-label="Hapus set">' + UI.icon('trash', 18) + '</button></div>';
      }).join('') +
      '</div>' +
      '<div class="field-error" data-error-for="set_0"></div>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-add-set>' + UI.icon('plus', 18) + ' Tambah Set</button>' +
      '<div class="field-error" data-error-for="skor_set"></div>' +
      '</div>' +
      '</form>';
  }

  function openMatchForm(match, presetIdAtlet, onSave) {
    var isEdit = !!match;
    document.getElementById('modal-host').innerHTML =
      UI.modalShell('m-match', isEdit ? 'Edit Hasil Pertandingan' : 'Input Hasil Pertandingan',
        UI.backButton({ closeModal: 'm-match' }) + buildMatchForm(match, presetIdAtlet),
        '<button type="button" class="btn btn-ghost" data-back-close="m-match">Batal</button>' +
        '<button type="submit" class="btn" form="form-match">Simpan Hasil</button>');
    UI.openModal('m-match');
    var form = document.getElementById('form-match');

    form.addEventListener('click', function (e) {
      var add = e.target.closest('[data-add-set]');
      if (add) {
        var rows = form.querySelector('#set-rows');
        var idx = rows.children.length;
        var div = document.createElement('div');
        div.className = 'set-row';
        div.innerHTML = '<input class="input" name="set_' + idx + '" placeholder="contoh: 21-18" inputmode="numeric" aria-label="Skor set ' + (idx + 1) + '">' +
          '<button type="button" class="icon-btn" data-remove-set="' + idx + '" aria-label="Hapus set">' + UI.icon('trash', 18) + '</button>';
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
      var inputs = form.querySelectorAll('#set-rows input');
      var firstBadSet = null;
      for (var i = 0; i < inputs.length; i++) {
        var val = inputs[i].value.trim();
        if (!val) continue;
        if (!isSkorValid(val)) {
          if (!firstBadSet) firstBadSet = inputs[i];
          continue;
        }
        sets.push(val.replace(/\s+/g, ''));
      }
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

      var payload = {
        id_atlet: data.id_atlet,
        tanggal: data.tanggal,
        turnamen: data.turnamen,
        lawan: data.lawan,
        skor_set: sets,
        hasil: data.hasil,
        catatan: data.catatan || '',
        input_oleh: (Auth.current() || {}).id
      };
      if (isEdit) Store.update('matches', match.id, payload);
      else Store.insert('matches', payload);
      UI.closeModal('m-match');
      Utils.toast('Hasil pertandingan berhasil disimpan.', 'success');
      if (onSave) onSave();
    });
  }

  function pertandingan(root, user, app) {
    root.innerHTML =
      '<div class="page">' +
      UI.pageHeader('Pertandingan', 'Lihat, edit, dan koreksi hasil pertandingan atlet.',
        '<button type="button" class="btn" data-add-match>' + UI.icon('plus', 20) + ' Input Pertandingan</button>') +
      '<div class="card">' +
      '<div class="filter-bar">' +
      '<select class="input" id="pg-atlet" style="max-width:260px"><option value="">Semua atlet</option>' +
      Shared.activeAthletes().map(function (a) {
        return '<option value="' + Utils.esc(a.id_atlet) + '">' + Utils.esc(a.nama) + '</option>';
      }).join('') + '</select>' +
      '<select class="input" id="pg-hasil" style="max-width:180px"><option value="">Semua hasil</option><option>Menang</option><option>Kalah</option></select>' +
      '</div>' +
      '<div id="pg-list"></div>' +
      '</div></div>';

    var page = root.querySelector('.page');
    var list = page.querySelector('#pg-list');

    function refresh() {
      var idAtlet = page.querySelector('#pg-atlet').value;
      var hasil = page.querySelector('#pg-hasil').value;
      var rows = Shared.matchesFor(idAtlet || null).filter(function (m) {
        return !hasil || m.hasil === hasil;
      });
      if (!rows.length) {
        list.innerHTML = UI.emptyState('Belum ada data pertandingan.', 'trophy');
        return;
      }
      list.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr>' +
        '<th>Tanggal</th><th>Atlet</th><th>Turnamen</th><th>Lawan</th><th>Skor</th><th>Hasil</th><th class="align-center">Aksi</th>' +
        '</tr></thead><tbody>' +
        rows.map(function (m) {
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
            '<td class="align-center"><div class="flex gap-1" style="justify-content:center">' +
            '<button type="button" class="btn btn-sm btn-secondary" data-edit-match="' + Utils.esc(m.id) + '">Edit</button>' +
            '<button type="button" class="btn btn-sm btn-danger" data-del-match="' + Utils.esc(m.id) + '">Hapus</button>' +
            '</div></td></tr>';
        }).join('') + '</tbody></table></div>';
    }

    refresh();

    page.addEventListener('change', function (e) {
      if (e.target.id === 'pg-atlet' || e.target.id === 'pg-hasil') refresh();
    });

    page.addEventListener('click', function (e) {
      if (e.target.closest('[data-add-match]')) {
        openMatchForm(null, null, refresh);
        return;
      }
      var edit = e.target.closest('[data-edit-match]');
      if (edit) {
        openMatchForm(Store.find('matches', edit.getAttribute('data-edit-match')), null, refresh);
        return;
      }
      var del = e.target.closest('[data-del-match]');
      if (del) {
        UI.confirmDialog('Hapus data pertandingan ini?', 'Hapus Pertandingan').then(function (ok) {
          if (!ok) return;
          Store.remove('matches', del.getAttribute('data-del-match'));
          UI.toast('Data pertandingan dihapus.', 'success');
          refresh();
        });
      }
    });

    app.subscribe('matches', refresh);
    app.subscribe('athletes', refresh);
  }

  function pengguna(root, user, app) {
    root.innerHTML =
      '<div class="page">' +
      UI.pageHeader('Pengguna', 'Kelola akun atlet dan asisten pelatih.',
        '<button type="button" class="btn" data-add-user>' + UI.icon('plus', 20) + ' Tambah Pengguna</button>') +
      '<div class="card">' +
      '<div class="filter-bar">' +
      '<input class="input" id="pu-cari" placeholder="Cari nama atau username...">' +
      '<select class="input" id="pu-role" style="max-width:220px"><option value="">Semua peran</option>' +
      Object.keys(CONFIG.ROLE_LABEL).map(function (r) {
        return '<option value="' + r + '">' + CONFIG.ROLE_LABEL[r] + '</option>';
      }).join('') + '</select>' +
      '</div>' +
      '<div id="pu-list"></div>' +
      '</div></div>';

    var page = root.querySelector('.page');
    var list = page.querySelector('#pu-list');

    function refresh() {
      var q = page.querySelector('#pu-cari').value.trim().toLowerCase();
      var role = page.querySelector('#pu-role').value;
      var rows = Utils.sortBy(Store.all('users').filter(function (u) {
        if (role && u.role !== role) return false;
        if (q && (u.nama || '').toLowerCase().indexOf(q) === -1 && (u.username || '').toLowerCase().indexOf(q) === -1) return false;
        return true;
      }), 'nama', 'asc');

      if (!rows.length) {
        list.innerHTML = UI.emptyState('Tidak ada pengguna yang cocok.', 'users');
        return;
      }

      list.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr>' +
        '<th>Pengguna</th><th>Username</th><th>Peran</th><th>ID Atlet</th><th>Status</th><th class="align-center">Aksi</th>' +
        '</tr></thead><tbody>' +
        rows.map(function (u) {
          return '<tr>' +
            '<td><div class="flex items-center gap-1">' + UI.avatar(u, 36) + '<b>' + Utils.esc(u.nama) + '</b></div></td>' +
            '<td>' + Utils.esc(u.username) + '</td>' +
            '<td>' + UI.badge(CONFIG.ROLE_LABEL[u.role] || u.role, u.role === 'pelatih_kepala' ? 'primary' : u.role === 'asisten' ? 'info' : 'muted') + '</td>' +
            '<td>' + Utils.esc(u.id_atlet || '-') + '</td>' +
            '<td>' + UI.statusBadge(u.status) + '</td>' +
            '<td class="align-center"><div class="flex gap-1" style="justify-content:center">' +
            (u.id_atlet ? '<button type="button" class="btn btn-sm btn-ghost" data-detail-user="' + Utils.esc(u.id_atlet) + '">Dokumen</button>' : '') +
            '<button type="button" class="btn btn-sm btn-secondary" data-edit-user="' + Utils.esc(u.id) + '">Edit</button>' +
            '<button type="button" class="btn btn-sm btn-ghost" data-reset-user="' + Utils.esc(u.id) + '">Reset Sandi</button>' +
            '<button type="button" class="btn btn-sm ' + (u.status === 'nonaktif' ? 'btn-secondary' : 'btn-danger') + '" data-toggle-user="' + Utils.esc(u.id) + '">' +
            (u.status === 'nonaktif' ? 'Aktifkan' : 'Nonaktifkan') + '</button>' +
            '</div></td></tr>';
        }).join('') + '</tbody></table></div>';
    }

    refresh();

    page.addEventListener('input', Utils.debounce(function (e) {
      if (e.target.id === 'pu-cari') refresh();
    }, 180));
    page.addEventListener('change', function (e) {
      if (e.target.id === 'pu-cari' || e.target.id === 'pu-role') refresh();
    });

    page.addEventListener('click', function (e) {
      if (e.target.closest('[data-add-user]')) {
        openUserForm(null);
        return;
      }
      var detail = e.target.closest('[data-detail-user]');
      if (detail) {
        openAthleteDetail(detail.getAttribute('data-detail-user'));
        return;
      }
      var edit = e.target.closest('[data-edit-user]');
      if (edit) {
        openUserForm(Store.find('users', edit.getAttribute('data-edit-user')));
        return;
      }
      var reset = e.target.closest('[data-reset-user]');
      if (reset) {
        openResetForm(Store.find('users', reset.getAttribute('data-reset-user')));
        return;
      }
      var toggle = e.target.closest('[data-toggle-user]');
      if (toggle) {
        var u = Store.find('users', toggle.getAttribute('data-toggle-user'));
        if (!u) return;
        if (u.id === user.id) {
          UI.toast('Anda tidak dapat menonaktifkan akun sendiri.', 'danger');
          return;
        }
        var next = u.status === 'nonaktif' ? 'aktif' : 'nonaktif';
        UI.confirmDialog('Ubah status akun ' + u.nama + ' menjadi ' + next + '?', 'Ubah Status').then(function (ok) {
          if (!ok) return;
          Store.update('users', u.id, { status: next });
          UI.toast('Status akun diperbarui.', 'success');
          refresh();
        });
      }
    });

    function openUserForm(u) {
      var isEdit = !!u;
      document.getElementById('modal-host').innerHTML = UI.modalShell('m-user', isEdit ? 'Edit Pengguna' : 'Tambah Pengguna',
        UI.backButton({ closeModal: 'm-user' }) +
        '<form id="form-user">' +
        UI.field({ name: 'nama', label: 'Nama Lengkap', required: true, value: u ? u.nama : '' }) +
        UI.field({ name: 'username', label: 'Username', required: true, value: u ? u.username : '' }) +
        UI.field({ name: 'role', label: 'Peran', type: 'select', required: true, value: u ? u.role : 'asisten', options: Object.keys(CONFIG.ROLE_LABEL).map(function (r) { return { value: r, label: CONFIG.ROLE_LABEL[r] }; }) }) +
        UI.field({ name: 'no_hp', label: 'No. HP', value: u ? u.no_hp : '' }) +
        (isEdit ? '' : UI.field({ name: 'password', label: 'Kata Sandi', type: 'password', required: true, help: 'Minimal 6 karakter.' })) +
        '</form>',
        '<button type="button" class="btn btn-ghost" data-back-close="m-user">Batal</button>' +
        '<button type="submit" class="btn" form="form-user">Simpan</button>');
      UI.openModal('m-user');

      var userForm = document.getElementById('form-user');
      UI.bindSubmit(userForm, function () {
        var d = Utils.formData(userForm);
        var errors = {};
        if (!d.nama) errors.nama = 'Nama wajib diisi.';
        if (!d.username) errors.username = 'Username wajib diisi.';
        if (!isEdit && (!d.password || d.password.length < 6)) errors.password = 'Kata sandi minimal 6 karakter.';
        if (Object.keys(errors).length) {
          Utils.showErrors(userForm, errors);
          Utils.toast('Periksa kembali isian yang ditandai.', 'danger');
          return;
        }
        if (isEdit) {
          var dup = Store.findOne('users', function (x) {
            return x.username === d.username.toLowerCase() && x.id !== u.id;
          });
          if (dup) {
            Utils.showErrors(userForm, { username: 'Username sudah dipakai.' });
            return;
          }
          Store.update('users', u.id, {
            nama: d.nama,
            username: d.username.toLowerCase(),
            role: d.role,
            no_hp: d.no_hp
          });
          UI.closeModal('m-user');
          Utils.toast('Data pengguna berhasil diperbarui.', 'success');
          refresh();
          return;
        }
        return Auth.createUser({
          nama: d.nama,
          username: d.username,
          password: d.password,
          role: d.role,
          no_hp: d.no_hp
        }).then(function () {
          UI.closeModal('m-user');
          Utils.toast('Pengguna berhasil ditambahkan.', 'success');
          refresh();
        }).catch(function (err) {
          Utils.showErrors(userForm, { username: err.message });
        });
      });
    }

    function openResetForm(u) {
      if (!u) return;
      document.getElementById('modal-host').innerHTML = UI.modalShell('m-reset', 'Reset Kata Sandi',
        UI.backButton({ closeModal: 'm-reset' }) +
        '<p class="muted">Atur kata sandi baru untuk <b>' + Utils.esc(u.nama) + '</b> (' + Utils.esc(u.username) + ').</p>' +
        '<form id="form-reset">' +
        UI.field({ name: 'password', label: 'Kata Sandi Baru', type: 'password', required: true, help: 'Minimal 6 karakter.' }) +
        '</form>',
        '<button type="button" class="btn btn-ghost" data-back-close="m-reset">Batal</button>' +
        '<button type="submit" class="btn" form="form-reset">Simpan Kata Sandi</button>');
      UI.openModal('m-reset');

      var resetForm = document.getElementById('form-reset');
      UI.bindSubmit(resetForm, function () {
        var d = Utils.formData(resetForm);
        if (!d.password || d.password.length < 6) {
          Utils.showErrors(resetForm, { password: 'Kata sandi minimal 6 karakter.' });
          return;
        }
        return Auth.resetPassword(u.id, d.password).then(function () {
          UI.closeModal('m-reset');
          Utils.toast('Kata sandi berhasil direset.', 'success');
        });
      });
    }

    app.subscribe('users', refresh);
  }

  function home(root, user, app) {
    root.innerHTML =
      '<div class="page">' +
      UI.pageHeader('Beranda Pelatih Kepala', 'Ringkasan kondisi atlet hari ini.') +
      '<div class="stat-grid" id="home-stats"></div>' +
      '<div class="grid-2 mt-2">' +
      '<div class="card"><div class="card-title">' + UI.icon('calendar', 20) + 'Kehadiran 7 Hari Terakhir</div>' +
      '<div class="chart-box"><canvas id="chart-home-kehadiran"></canvas></div></div>' +
      '<div class="card"><div class="card-title">' + UI.icon('alert', 20) + 'Atlet Perlu Perhatian</div>' +
      '<div id="home-attention"></div></div>' +
      '</div>' +
      '<div class="grid-2 mt-2">' +
      '<div class="card"><div class="card-title">' + UI.icon('trophy', 20) + 'Pertandingan Terbaru</div><div id="home-matches"></div></div>' +
      '<div class="card"><div class="card-title">' + UI.icon('clipboard', 20) + 'Catatan Latihan Terbaru</div><div id="home-notes"></div></div>' +
      '</div></div>';

    var page = root.querySelector('.page');

    function refresh() {
      var athletes = Shared.activeAthletes();
      var today = Shared.attendanceSummary(Utils.todayISO());
      var last = Shared.lastMatch();
      var need = Shared.attentionList();

      page.querySelector('#home-stats').innerHTML =
        UI.statCard('Total Atlet', athletes.length, 'atlet aktif', 'users', 'primary') +
        UI.statCard('Kehadiran Hari Ini', (today.total ? today.persen + '%' : '-'),
          today.Hadir + ' hadir dari ' + today.total + ' diabsen', 'calendar', 'ok') +
        UI.statCard('Perlu Perhatian', need.length, need.length ? 'periksa daftar di samping' : 'semua kondisi baik', 'alert', need.length ? 'warn' : 'primary') +
        UI.statCard('Pertandingan Terakhir', last ? Utils.fmtDate(last.tanggal) : '-', last ? last.hasil + ' vs ' + last.lawan : 'belum ada data', 'trophy', 'blue');

      var att = page.querySelector('#home-attention');
      if (!need.length) {
        att.innerHTML = UI.emptyState('Tidak ada atlet yang perlu perhatian khusus. Kondisi tim terpantau baik.', 'check');
      } else {
        att.innerHTML = '<div class="list-rows">' + need.map(function (n) {
          return '<div class="list-row">' + UI.avatar(n.athlete, 40) +
            '<div class="grow"><b>' + Utils.esc(n.athlete.nama) + '</b>' +
            '<span>' + Utils.esc(n.reasons.join(' · ')) + '</span></div>' +
            UI.badge(n.rate === null ? '-' : n.rate + '%', n.rate !== null && n.rate < 75 ? 'danger' : 'muted') +
            '</div>';
        }).join('') + '</div>';
      }

      var matches = Shared.matchesFor().slice(0, 5);
      var matchHost = page.querySelector('#home-matches');
      matchHost.innerHTML = matches.length ? '<div class="list-rows">' + matches.map(function (m) {
        var a = UI.athleteById(m.id_atlet);
        return '<div class="list-row"><div class="grow"><b>' + Utils.esc(a ? a.nama : '-') + '</b>' +
          '<span>' + Utils.esc(m.turnamen) + ' vs ' + Utils.esc(m.lawan) + ' · ' + Utils.fmtDate(m.tanggal) + '</span></div>' +
          UI.statusBadge(m.hasil) + '</div>';
      }).join('') + '</div>' : UI.emptyState('Belum ada pertandingan.', 'trophy');

      var notes = Utils.sortBy(Store.where('logbook_entries', function (e) {
        return !!e.catatan;
      }), 'tanggal', 'desc').slice(0, 5);
      var noteHost = page.querySelector('#home-notes');
      noteHost.innerHTML = notes.length ? '<div class="list-rows">' + notes.map(function (n) {
        var a = UI.athleteById(n.id_atlet);
        return '<div class="list-row"><div class="grow"><b>' + Utils.esc(a ? a.nama : '-') + '</b>' +
          '<span>' + Utils.esc(n.catatan) + '</span>' +
          '<div class="small muted">' + Utils.fmtDate(n.tanggal) + ' · ' + Utils.esc(n.nama_parameter) + '</div></div></div>';
      }).join('') + '</div>' : UI.emptyState('Belum ada catatan latihan.', 'clipboard');

      var canvas = page.querySelector('#chart-home-kehadiran');
      if (canvas) {
        var series = Shared.attendanceSeries(7);
        Charts.bar(canvas, series.labels, [
          { label: 'Hadir', data: series.hadir, color: '#0b3d91' },
          { label: 'Tidak Hadir', data: series.tidak, color: '#d62839' }
        ], {});
      }
    }

    refresh();
    app.subscribe('attendance', refresh);
    app.subscribe('matches', refresh);
    app.subscribe('athletes', refresh);
    app.subscribe('logbook_entries', refresh);
    app.subscribe('physical_tests', refresh);
  }

  /* ---------- Setting: kelola menu dashboard admin ---------- */
  function muatMenuConfig() {
    var simpan = Store.all('menu_config');
    if (simpan.length) return simpan;
    (CONFIG.MENU_ADMIN_DEFAULT || []).forEach(function (m) {
      Store.insert('menu_config', {
        id: m.id,
        label: m.label,
        short: m.short || m.label,
        icon: m.icon || 'info',
        urutan: m.urutan,
        aktif: m.aktif !== false,
        bottom: !!m.bottom,
        kunci: !!m.kunci
      });
    });
    return Store.all('menu_config');
  }

  function setting(root, user, app) {
    root.innerHTML =
      '<div class="page">' +
      UI.pageHeader('Setting', 'Atur menu yang tampil di sidebar dan navigasi dashboard admin.',
        '<button type="button" class="btn" data-tambah-menu>' + UI.icon('plus', 20) + ' Tambah Menu</button>') +
      '<div class="card">' +
      '<div class="card-title">' + UI.icon('settings', 20) + 'Daftar Menu</div>' +
      '<p class="muted small">Perubahan langsung berlaku di sidebar. Menu <b>Setting</b> tidak dapat dihapus.</p>' +
      '<div id="setting-list"></div>' +
      '</div>' +
      '<div class="card mt-2">' +
      '<div class="card-title">' + UI.icon('save', 20) + 'Penyimpanan Foto</div>' +
      '<p class="muted small">Foto yang diunggah disimpan ke <b>Firebase Storage</b> sehingga tampil di semua perangkat. ' +
      'Foto lama yang masih tersimpan lokal dapat dipindahkan ke cloud lewat tombol di bawah ini.</p>' +
      '<div class="flex gap-1 flex-wrap items-center">' +
      '<button type="button" class="btn btn-secondary" data-migrasi-foto>' + UI.icon('refresh', 20) + ' Pindahkan Foto Lama ke Cloud</button>' +
      '<span class="small muted" id="migrasi-status">' +
      (typeof Cloud !== 'undefined' && Cloud && Cloud.siap && Cloud.siap() ? 'Cloud tersambung.' : 'Cloud belum tersambung.') +
      '</span>' +
      '</div></div>' +
      '</div>';

    var page = root.querySelector('.page');

    function renderList() {
      var host = page.querySelector('#setting-list');
      var rows = Utils.sortBy(muatMenuConfig(), 'urutan', 'asc');
      if (!rows.length) {
        host.innerHTML = UI.emptyState('Belum ada menu.', 'settings');
        return;
      }
      host.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr>' +
        '<th>Urutan</th><th>Nama Menu</th><th>Ikon</th><th>Status Tampil</th><th class="align-center">Aksi</th>' +
        '</tr></thead><tbody>' +
        rows.map(function (m) {
          return '<tr>' +
            '<td class="fw-bold">' + Utils.esc(m.urutan) + '</td>' +
            '<td><b>' + Utils.esc(m.label) + '</b><div class="small muted">' + Utils.esc(m.short || '') + '</div></td>' +
            '<td><div class="flex items-center gap-1">' + UI.icon(m.icon || 'info', 20) + '<span class="small muted">' + Utils.esc(m.icon || '-') + '</span></div></td>' +
            '<td>' + UI.statusBadge(m.aktif ? 'aktif' : 'nonaktif') + '</td>' +
            '<td class="align-center"><div class="flex gap-1" style="justify-content:center;flex-wrap:wrap">' +
            '<button type="button" class="btn btn-sm btn-secondary" data-menu-edit="' + Utils.esc(m.id) + '">Edit</button>' +
            '<button type="button" class="btn btn-sm btn-ghost" data-menu-naik="' + Utils.esc(m.id) + '" aria-label="Naik">Naik</button>' +
            '<button type="button" class="btn btn-sm btn-ghost" data-menu-turun="' + Utils.esc(m.id) + '" aria-label="Turun">Turun</button>' +
            '<button type="button" class="btn btn-sm" data-menu-toggle="' + Utils.esc(m.id) + '">' + (m.aktif ? 'Nonaktifkan' : 'Aktifkan') + '</button>' +
            (m.kunci
              ? '<span class="small muted">Terkunci</span>'
              : '<button type="button" class="btn btn-sm btn-danger" data-menu-hapus="' + Utils.esc(m.id) + '">Hapus</button>') +
            '</div></td></tr>';
        }).join('') + '</tbody></table></div>';
    }

    function bukaForm(menu) {
      var opsi = (CONFIG.ICON_MENU || []).map(function (n) {
        return '<option value="' + Utils.esc(n) + '"' + (menu && menu.icon === n ? ' selected' : '') + '>' + Utils.esc(n) + '</option>';
      }).join('');
      document.getElementById('modal-host').innerHTML =
        UI.modalShell('m-menu', menu ? 'Edit Menu' : 'Tambah Menu',
          UI.backButton({ closeModal: 'm-menu' }) +
          '<form id="form-menu" novalidate>' +
          UI.field({ name: 'label', label: 'Nama Menu', required: true, value: menu ? menu.label : '' }) +
          UI.field({ name: 'short', label: 'Nama Pendek (navigasi HP)', value: menu ? (menu.short || '') : '' }) +
          UI.field({ name: 'icon', label: 'Ikon', type: 'select', value: menu ? (menu.icon || 'info') : 'info', options: (CONFIG.ICON_MENU || []).map(function (n) { return { value: n, label: n }; }) }) +
          UI.field({ name: 'urutan', label: 'Urutan', type: 'number', min: 1, step: 1, value: menu ? menu.urutan : (muatMenuConfig().length + 1) }) +
          UI.field({ name: 'aktif', label: 'Status Tampil', type: 'select', value: menu ? (menu.aktif ? '1' : '0') : '1', options: [{ value: '1', label: 'Tampil' }, { value: '0', label: 'Sembunyi' }] }) +
          '</form>',
          '<button type="button" class="btn btn-ghost" data-back-close="m-menu">Batal</button>' +
          '<button type="submit" class="btn" form="form-menu">Simpan Menu</button>');
      UI.openModal('m-menu');

      var form = document.getElementById('form-menu');
      UI.bindSubmit(form, function () {
        Utils.clearErrors(form);
        var d = Utils.formData(form);
        var errors = {};
        if (!d.label) errors.label = 'Nama menu wajib diisi.';
        if (d.urutan === '' || isNaN(Number(d.urutan))) errors.urutan = 'Urutan harus berupa angka.';
        if (Object.keys(errors).length) {
          Utils.showErrors(form, errors);
          Utils.toast('Mohon lengkapi isian yang ditandai.', 'danger');
          return;
        }
        var payload = {
          label: d.label,
          short: d.short || d.label,
          icon: d.icon || 'info',
          urutan: Number(d.urutan),
          aktif: d.aktif === '1'
        };
        if (menu) {
          Store.update('menu_config', menu.id, payload);
          Utils.toast('Menu berhasil diperbarui.', 'success');
        } else {
          var idBaru = 'menu_' + Date.now().toString(36);
          Store.insert('menu_config', Object.assign({ id: idBaru, kunci: false, bottom: false }, payload));
          Utils.toast('Menu baru berhasil ditambahkan.', 'success');
        }
        UI.closeModal('m-menu');
        renderList();
        if (typeof App !== 'undefined' && App && App.render) App.render();
      });
    }

    renderList();

    page.addEventListener('click', function (e) {
      var migrasi = e.target.closest('[data-migrasi-foto]');
      if (migrasi) {
        if (typeof Cloud === 'undefined' || !Cloud || !Cloud.migrasiFotoLama) {
          Utils.toast('Layanan cloud tidak tersedia.', 'danger');
          return;
        }
        migrasi.disabled = true;
        Utils.toast('Memindahkan foto lama ke cloud...', 'info');
        Cloud.migrasiFotoLama(true).then(function (hasil) {
          migrasi.disabled = false;
          var st = page.querySelector('#migrasi-status');
          if (st) st.textContent = hasil.pesan;
          Utils.toast(hasil.pesan, hasil.total ? 'success' : 'info');
        }, function (err) {
          migrasi.disabled = false;
          Utils.toast(err && err.message ? err.message : 'Migrasi foto gagal.', 'danger');
        });
        return;
      }
      if (e.target.closest('[data-tambah-menu]')) {
        bukaForm(null);
        return;
      }
      var edit = e.target.closest('[data-menu-edit]');
      if (edit) {
        bukaForm(Store.find('menu_config', edit.getAttribute('data-menu-edit')));
        return;
      }
      var naik = e.target.closest('[data-menu-naik]');
      if (naik) {
        geserMenu(naik.getAttribute('data-menu-naik'), -1);
        return;
      }
      var turun = e.target.closest('[data-menu-turun]');
      if (turun) {
        geserMenu(turun.getAttribute('data-menu-turun'), 1);
        return;
      }
      var toggle = e.target.closest('[data-menu-toggle]');
      if (toggle) {
        var m = Store.find('menu_config', toggle.getAttribute('data-menu-toggle'));
        if (!m) return;
        Store.update('menu_config', m.id, { aktif: !m.aktif });
        UI.toast('Menu ' + (m.aktif ? 'dinonaktifkan' : 'diaktifkan') + '.', 'success');
        renderList();
        if (typeof App !== 'undefined' && App && App.render) App.render();
        return;
      }
      var hapus = e.target.closest('[data-menu-hapus]');
      if (hapus) {
        var target = Store.find('menu_config', hapus.getAttribute('data-menu-hapus'));
        if (!target) return;
        if (target.kunci) {
          Utils.toast('Menu Setting tidak dapat dihapus.', 'danger');
          return;
        }
        UI.confirmDialog('Menu "' + target.label + '" akan dihapus dari navigasi. Lanjutkan?', 'Konfirmasi Hapus Menu').then(function (ok) {
          if (!ok) return;
          Store.remove('menu_config', target.id);
          Utils.toast('Menu dihapus.', 'success');
          renderList();
          if (typeof App !== 'undefined' && App && App.render) App.render();
        });
      }
    });

    function geserMenu(id, arah) {
      var rows = Utils.sortBy(muatMenuConfig(), 'urutan', 'asc');
      var idx = -1;
      rows.forEach(function (r, i) {
        if (r.id === id) idx = i;
      });
      var tukar = idx + arah;
      if (idx < 0 || tukar < 0 || tukar >= rows.length) return;
      var urutanA = rows[idx].urutan;
      var urutanB = rows[tukar].urutan;
      Store.update('menu_config', rows[idx].id, { urutan: urutanB });
      Store.update('menu_config', rows[tukar].id, { urutan: urutanA });
      renderList();
      if (typeof App !== 'undefined' && App && App.render) App.render();
    }

    app.subscribe('menu_config', renderList);
  }

  function register() {
    App.register('daftar-atlet', {
      title: 'Daftar Atlet',
      subtitle: 'Kelola data atlet PB Trisula Surabaya',
      render: daftarAtlet
    });
    App.register('kehadiran', {
      title: 'Kehadiran',
      subtitle: 'Monitoring kehadiran harian & bulanan',
      render: kehadiran
    });
    App.register('tes-fisik', {
      title: 'Tes Fisik',
      subtitle: 'Hasil tes fisik per atlet',
      render: tesFisik
    });
    App.register('logbook', {
      title: 'Logbook',
      subtitle: 'Fisik harian, teknik, dan parameter',
      render: logbook
    });
    App.register('pertandingan', {
      title: 'Pertandingan',
      subtitle: 'Hasil pertandingan atlet',
      render: pertandingan
    });
    App.register('pengguna', {
      title: 'Pengguna',
      subtitle: 'Kelola akun pengguna',
      render: pengguna
    });
    App.register('setting', {
      title: 'Setting',
      subtitle: 'Kelola menu navigasi admin',
      render: setting
    });
  }

  return {
    register: register,
    home: home
  };
})();

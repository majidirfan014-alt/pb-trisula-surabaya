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
    root.innerHTML =
      '<div class="page">' +
      UI.pageHeader('Absensi Kehadiran', 'Catat kehadiran Anda beserta program latihan yang dijalankan.') +
      '<div class="card">' +
      '<div class="card-title">' + UI.icon('calendar', 20) + 'Form Absensi Saya</div>' +
      '<form id="form-absen" novalidate>' +
      '<div class="form-grid cols-2">' +
      UI.field({ name: 'tanggal', label: 'Tanggal Latihan', type: 'date', required: true, value: Utils.todayISO() }) +
      '</div>' +
      '<div id="absen-lokasi"></div>' +
      '<div id="absen-atlet"></div>' +
      '<div class="field" id="absen-status-box">' +
      '<label class="label">Status Kehadiran Atlet Terpilih</label>' +
      '<div class="flex gap-1 flex-wrap" id="absen-status-bulk">' +
      (CONFIG.STATUS_KEHADIRAN || []).map(function (s) {
        return '<button type="button" class="btn btn-sm btn-secondary" data-status-semua="' + Utils.esc(s) + '">' + Utils.esc(s) + '</button>';
      }).join('') +
      '</div>' +
      '<div class="help">Tetapkan status untuk semua atlet terpilih, lalu ubah per atlet bila perlu.</div>' +
      '<div id="absen-status-list"></div>' +
      '<div class="field-error" data-error-for="status"></div>' +
      '</div>' +
      UI.field({ name: 'program', label: 'Program yang Dijalankan', type: 'textarea', required: true, rows: 3, placeholder: 'contoh: Pemanasan, footwork, smash, pendinginan' }) +
      '<button class="btn" type="submit">' + UI.icon('save', 20) + ' Simpan Absensi</button>' +
      '</form>' +
      '</div>' +
      '<div class="card mt-2">' +
      '<div class="card-title">' + UI.icon('clipboard', 20) + 'Riwayat Absensi Saya</div>' +
      '<div id="absen-riwayat"></div>' +
      '</div></div>';

    var page = root.querySelector('.page');
    var form = page.querySelector('#form-absen');
    var statusHost = page.querySelector('#absen-status-list');
    var statusPerAtlet = {};
    var pickerApi = null;

    var lokasiApi = Picker.lokasi(page.querySelector('#absen-lokasi'), {
      label: 'Lokasi Latihan',
      required: true,
      help: 'Pilih satu atau beberapa lokasi yang dipakai hari ini.'
    });

    pickerApi = Picker.atlet(page.querySelector('#absen-atlet'), {
      name: 'atlet',
      label: 'Nama Atlet yang Dilatih',
      required: true,
      mode: 'multi',
      help: 'Cari lalu centang satu atau beberapa atlet.',
      onChange: function (ids) {
        var baru = {};
        ids.forEach(function (id) {
          baru[id] = statusPerAtlet[id] || 'Hadir';
        });
        statusPerAtlet = baru;
        renderStatus();
      }
    });

    function renderStatus() {
      var ids = pickerApi.getValue();
      if (!ids.length) {
        statusHost.innerHTML = '<div class="small muted">Centang atlet terlebih dahulu untuk menetapkan status kehadiran.</div>';
        return;
      }
      statusHost.innerHTML = '<div class="list-rows">' + ids.map(function (id) {
        var a = UI.athleteById(id);
        var nilai = statusPerAtlet[id] || 'Hadir';
        return '<div class="list-row">' +
          UI.avatar(a || { nama: id }, 38) +
          '<div class="grow"><b>' + Utils.esc(a ? a.nama : id) + '</b><span>' + Utils.esc(id) + '</span></div>' +
          '<select class="input" name="status_' + Utils.esc(id) + '" data-status-atlet="' + Utils.esc(id) + '" style="max-width:160px" aria-label="Status kehadiran ' + Utils.esc(a ? a.nama : id) + '">' +
          (CONFIG.STATUS_KEHADIRAN || []).map(function (s) {
            return '<option value="' + Utils.esc(s) + '"' + (nilai === s ? ' selected' : '') + '>' + Utils.esc(s) + '</option>';
          }).join('') +
          '</select></div>';
      }).join('') + '</div>';
    }

    renderStatus();

    function renderRiwayat() {
      var host = page.querySelector('#absen-riwayat');
      var rows = Utils.sortBy(Store.where('absensi_asisten', function (r) {
        return r.id_asisten === user.id;
      }), 'tanggal', 'desc');
      if (!rows.length) {
        host.innerHTML = UI.emptyState('Belum ada absensi yang tercatat.', 'clipboard');
        return;
      }
      host.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr>' +
        '<th>Tanggal</th><th>Lokasi</th><th>Atlet yang Dilatih</th><th>Program</th><th class="align-center">Aksi</th>' +
        '</tr></thead><tbody>' +
        rows.map(function (r) {
          var nama = (r.atlet || []).map(function (id) {
            var a = UI.athleteById(id);
            return Utils.esc(a ? a.nama : id);
          }).join(', ');
          return '<tr>' +
            '<td>' + Utils.fmtDate(r.tanggal, true) + '</td>' +
            '<td>' + Picker.chipLokasi(r) + '</td>' +
            '<td class="small">' + (nama || '-') + '</td>' +
            '<td class="small">' + Utils.esc(r.program || '-') + '</td>' +
            '<td class="align-center"><button type="button" class="btn btn-sm btn-danger" data-hapus-absen="' + Utils.esc(r.id) + '">Hapus</button></td>' +
            '</tr>';
        }).join('') + '</tbody></table></div>';
    }

    renderRiwayat();

    page.addEventListener('click', function (e) {
      var semua = e.target.closest('[data-status-semua]');
      if (semua) {
        var nilai = semua.getAttribute('data-status-semua');
        pickerApi.getValue().forEach(function (id) {
          statusPerAtlet[id] = nilai;
        });
        renderStatus();
        return;
      }
      var hapus = e.target.closest('[data-hapus-absen]');
      if (!hapus) return;
      UI.confirmDialog('Data absensi ini akan dihapus. Lanjutkan?', 'Konfirmasi Hapus').then(function (ok) {
        if (!ok) return;
        Store.remove('absensi_asisten', hapus.getAttribute('data-hapus-absen'));
        Utils.toast('Absensi dihapus.', 'success');
        renderRiwayat();
      });
    });

    page.addEventListener('change', function (e) {
      var s = e.target.closest ? e.target.closest('[data-status-atlet]') : null;
      if (s) statusPerAtlet[s.getAttribute('data-status-atlet')] = s.value;
    });

    UI.bindSubmit(form, function () {
      Utils.clearErrors(form);
      var data = Utils.formData(form);
      var errors = {};
      var nilaiLokasi = lokasiApi.getValue();
      var dipilih = pickerApi.getValue();
      if (!data.tanggal) errors.tanggal = 'Tanggal latihan wajib diisi.';
      if (!nilaiLokasi.ids.length && !nilaiLokasi.lainnya) errors.lokasi = 'Lokasi latihan wajib diisi.';
      if (!dipilih.length) errors.atlet = 'Pilih minimal satu atlet yang dilatih.';
      if (!data.program) errors.program = 'Program yang dijalankan wajib diisi.';

      if (Object.keys(errors).length) {
        Utils.showErrors(form, errors);
        Utils.toast('Mohon lengkapi isian yang ditandai.', 'danger');
        return;
      }

      var statusAkhir = {};
      dipilih.forEach(function (id) {
        statusAkhir[id] = statusPerAtlet[id] || 'Hadir';
      });

      var lokasiPayload = Picker.payloadLokasi(nilaiLokasi);
      var sudah = Store.findOne('absensi_asisten', function (r) {
        return r.id_asisten === user.id && r.tanggal === data.tanggal;
      });
      var payload = Object.assign({
        id_asisten: user.id,
        nama_asisten: user.nama,
        tanggal: data.tanggal,
        atlet: dipilih,
        status_atlet: statusAkhir,
        program: data.program
      }, lokasiPayload);
      if (sudah) {
        Store.update('absensi_asisten', sudah.id, payload);
      } else {
        Store.insert('absensi_asisten', payload);
      }

      // Simpan kehadiran per atlet (struktur sama dengan input pelatih kepala)
      // supaya tampil di rekap kehadiran & halaman atlet.
      dipilih.forEach(function (id) {
        var a = UI.athleteById(id);
        var status = statusAkhir[id];
        var lama = Store.findOne('attendance', function (r) {
          return r.id_atlet === id && r.tanggal === data.tanggal && r.tipe === 'atlet';
        });
        var baris = Object.assign({
          tanggal: data.tanggal,
          id_pengguna: a ? a.user_id : null,
          id_atlet: id,
          tipe: 'atlet',
          status: status,
          catatan: status === 'Hadir' ? '' : '',
          jam_masuk: '',
          jam_pulang: '',
          input_oleh: user.id
        }, lokasiPayload);
        if (lama) Store.update('attendance', lama.id, baris);
        else Store.insert('attendance', baris);
      });

      Utils.toast('Berhasil disimpan untuk ' + dipilih.length + ' atlet.', 'success');
      form.reset();
      form.querySelector('[name="tanggal"]').value = Utils.todayISO();
      lokasiApi.setValue({ ids: [], lainnya: '' });
      pickerApi.setValue([]);
      statusPerAtlet = {};
      renderStatus();
      renderRiwayat();
    });

    app.subscribe('absensi_asisten', renderRiwayat);
  }

  function profilAsisten(root, user, app) {
    root.innerHTML =
      '<div class="page">' +
      UI.pageHeader('Profil Saya', 'Data diri dan berkas lisensi pelatih Anda.',
        '<button type="button" class="btn" data-edit-profil>' + UI.icon('edit', 20) + ' Edit Profil</button>') +
      '<div id="profil-isi"></div>' +
      '</div>';

    var page = root.querySelector('.page');

    function render() {
      var host = page.querySelector('#profil-isi');
      var u = Store.find('users', user.id) || user;
      var usia = u.tgl_lahir ? Utils.age(u.tgl_lahir) + ' tahun' : '-';
      var lis = u.lisensi || null;
      var bisaUnduh = !!(lis && lis.data);

      host.innerHTML =
        '<div class="grid-2 equal">' +
        '<div class="card">' +
        '<div class="flex items-center gap-2 mb-2">' + UI.avatar(u, 84) +
        '<div><h3 class="mt-0 mb-0">' + Utils.esc(u.nama) + '</h3>' +
        '<div class="mt-1">' + UI.badge('Asisten Pelatih', 'primary') + '</div></div></div>' +
        '<div class="detail-grid">' +
        '<div class="detail-item"><div class="k">Nama Lengkap</div><div class="v">' + Utils.esc(u.nama) + '</div></div>' +
        '<div class="detail-item"><div class="k">Tanggal Lahir</div><div class="v">' + (u.tgl_lahir ? Utils.fmtDate(u.tgl_lahir, true) : '-') + '</div></div>' +
        '<div class="detail-item"><div class="k">Usia</div><div class="v">' + Utils.esc(usia) + '</div></div>' +
        '<div class="detail-item"><div class="k">No. HP</div><div class="v">' + Utils.esc(u.no_hp || '-') + '</div></div>' +
        '<div class="detail-item"><div class="k">ID Login</div><div class="v">' + Utils.esc(u.username) + '</div></div>' +
        '<div class="detail-item"><div class="k">Status</div><div class="v">' + UI.statusBadge(u.status || 'aktif') + '</div></div>' +
        '</div></div>' +
        '<div class="card">' +
        '<div class="card-title">' + UI.icon('save', 20) + 'Lisensi Pelatih</div>' +
        (bisaUnduh
          ? '<div class="file-chip">' +
            (/^image\//.test(lis.tipe || '') ? '<img src="' + Utils.esc(lis.data) + '" alt="Lisensi pelatih">' : '') +
            '<div><b>' + Utils.esc(lis.nama) + '</b>' +
            '<div class="small muted">' + (/pdf/i.test(lis.tipe || '') ? 'PDF' : 'Gambar') + ' / ' + Math.round((lis.ukuran || 0) / 1024) + ' KB</div></div></div>' +
            '<div class="flex gap-1 mt-2 flex-wrap">' +
            '<a class="btn btn-sm btn-secondary" href="' + Utils.esc(lis.data) + '" target="_blank" rel="noopener">Lihat</a>' +
            '<a class="btn btn-sm" href="' + Utils.esc(lis.data) + '" download="' + Utils.esc(lis.nama || 'lisensi') + '">Unduh</a>' +
            '</div>'
          : UI.emptyState('Lisensi pelatih belum diunggah.', 'alert')) +
        '<div class="notice mt-2">' + UI.icon('info', 20) +
        '<div>Untuk mengganti foto atau lisensi, gunakan tombol <b>Edit Profil</b>.</div></div>' +
        '</div></div>';
    }

    render();

    page.addEventListener('click', function (e) {
      if (!e.target.closest('[data-edit-profil]')) return;
      var u = Store.find('users', user.id) || user;
      document.getElementById('modal-host').innerHTML =
        UI.modalShell('m-profil', 'Edit Profil',
          UI.backButton({ closeModal: 'm-profil' }) +
          '<form id="form-profil" novalidate>' +
          UI.field({ name: 'nama', label: 'Nama Lengkap', required: true, value: u.nama }) +
          UI.field({ name: 'tgl_lahir', label: 'Tanggal Lahir', type: 'date', required: true, value: u.tgl_lahir || '' }) +
          UI.field({ name: 'no_hp', label: 'No. HP', value: u.no_hp || '' }) +
          '<div class="field"><label class="label">Foto Profil (opsional)</label>' +
          '<div class="photo-upload"><div id="profil-foto-preview">' + UI.avatar(u, 56) + '</div>' +
          '<input class="input" type="file" name="foto_file" accept="image/jpeg,image/png,image/jpg"></div></div>' +
          '<div class="field"><label class="label">Lisensi Pelatih (opsional)</label>' +
          '<input class="input" type="file" name="lisensi_file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png">' +
          '<div class="file-preview" id="profil-lisensi-preview"></div>' +
          '<div class="help">Kosongkan bila tidak diganti. Format PDF/JPG/PNG, maksimal 2 MB.</div></div>' +
          '</form>',
          '<button type="button" class="btn btn-ghost" data-back-close="m-profil">Batal</button>' +
          '<button type="submit" class="btn" form="form-profil">Simpan Perubahan</button>');
      UI.openModal('m-profil');

      var form = document.getElementById('form-profil');
      var fotoBaru = null;
      var lisensiBaru = null;
      var fotoInput = form.querySelector('[name="foto_file"]');
      if (fotoInput) {
        fotoInput.addEventListener('change', function () {
          var f = fotoInput.files && fotoInput.files[0];
          if (!f) return;
          var pesanSalah = (typeof Cloud !== 'undefined' && Cloud && Cloud.validasiGambar)
            ? Cloud.validasiGambar(f, 5 * 1024 * 1024) : '';
          if (pesanSalah) {
            Utils.toast(pesanSalah, 'danger');
            fotoInput.value = '';
            return;
          }
          var box = document.getElementById('profil-foto-preview');
          if (box) box.innerHTML = '<div class="upload-loading">Mengunggah foto...</div>';
          Utils.readImage(f, 256).then(function (d) {
            return Utils.keCloud(d, 'foto/profil', f.name || 'foto-asisten.jpg');
          }).then(function (hasil) {
            fotoBaru = hasil;
            var kotak = document.getElementById('profil-foto-preview');
            if (kotak) kotak.innerHTML = UI.avatar({ nama: 'Foto', foto: hasil }, 56);
            Utils.toast(/^https?:/.test(hasil) ? 'Foto tersimpan di cloud.' : 'Foto siap disimpan.', 'success');
          }).catch(function (err) {
            fotoBaru = null;
            var kotak = document.getElementById('profil-foto-preview');
            if (kotak) kotak.innerHTML = '';
            Utils.toast(err.message, 'danger');
            fotoInput.value = '';
          });
        });
      }
      var lisInput = form.querySelector('[name="lisensi_file"]');
      if (lisInput) {
        lisInput.addEventListener('change', function () {
          var f = lisInput.files && lisInput.files[0];
          if (!f) return;
          var pesanSalah = (typeof Cloud !== 'undefined' && Cloud && Cloud.validasiBerkas)
            ? Cloud.validasiBerkas(f, 2 * 1024 * 1024) : '';
          if (pesanSalah) {
            Utils.toast(pesanSalah, 'danger');
            lisInput.value = '';
            return;
          }
          var kotak = document.getElementById('profil-lisensi-preview');
          if (kotak) kotak.innerHTML = '<div class="upload-loading">Mengunggah lisensi...</div>';
          var reader = new FileReader();
          reader.onerror = function () {
            if (kotak) kotak.innerHTML = '';
            Utils.toast('Gagal membaca file lisensi.', 'danger');
          };
          reader.onload = function () {
            Utils.keCloud(reader.result, 'foto/lisensi', f.name || 'lisensi.pdf').then(function (hasil) {
              lisensiBaru = { nama: f.name, tipe: f.type || '', ukuran: f.size, data: hasil };
              if (kotak) {
                kotak.innerHTML = '<div class="file-chip">' +
                  (/^image\//.test(f.type || '') ? '<img src="' + Utils.esc(hasil) + '" alt="Pratinjau lisensi">' : '') +
                  '<div><b>' + Utils.esc(f.name) + '</b><div class="small muted">' +
                  (/pdf/i.test(f.type || '') ? 'PDF' : 'Gambar') + ' / ' + Math.round(f.size / 1024) + ' KB</div></div></div>';
              }
              Utils.toast(/^https?:/.test(hasil) ? 'Lisensi tersimpan di cloud.' : 'Lisensi siap disimpan.', 'success');
            });
          };
          reader.readAsDataURL(f);
        });
      }

      UI.bindSubmit(form, function () {
        Utils.clearErrors(form);
        var d = Utils.formData(form);
        var errors = {};
        if (!d.nama) errors.nama = 'Nama lengkap wajib diisi.';
        if (!d.tgl_lahir) errors.tgl_lahir = 'Tanggal lahir wajib diisi.';
        if (Object.keys(errors).length) {
          Utils.showErrors(form, errors);
          Utils.toast('Mohon lengkapi isian yang ditandai.', 'danger');
          return;
        }
        var patch = {
          nama: d.nama,
          tgl_lahir: d.tgl_lahir,
          no_hp: d.no_hp || ''
        };
        if (fotoBaru) patch.foto = fotoBaru;
        if (lisensiBaru) patch.lisensi = lisensiBaru;
        Store.update('users', user.id, patch);
        UI.closeModal('m-profil');
        Utils.toast('Profil berhasil diperbarui.', 'success');
        render();
      });
    });

    app.subscribe('users', render);
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
      var html = '<form id="form-lh" novalidate>' +
        '<div class="form-grid cols-2">' +
        UI.field({ name: 'tanggal', label: 'Tanggal', type: 'date', required: true, value: Utils.todayISO() }) +
        '</div>' +
        '<div id="lh-atlet"></div>' +
        '<div id="lh-lokasi"></div>' +
        UI.field({
          name: 'program', label: 'Program Latihan', type: 'textarea', rows: 2, required: true,
          placeholder: 'contoh: Pemanasan, footwork 6 titik, smash, pendinginan'
        });
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
      html += '<div class="field" id="lh-override" hidden>' +
        '<label class="label">Penyesuaian Nilai per Atlet <span class="small muted">(opsional)</span></label>' +
        '<div class="help">Kosongkan untuk memakai nilai dasar di atas. Isi hanya yang perlu dibedakan tiap atlet.</div>' +
        '<div id="lh-override-list"></div>' +
        '</div>';
      html += UI.field({ name: 'catatan', label: 'Catatan untuk atlet', type: 'textarea', rows: 2, placeholder: 'Contoh: footwork sudah lebih cepat, pertahankan.' }) +
        '<button class="btn" type="submit">' + UI.icon('save', 20) + ' Simpan Logbook</button></form>';
      body.innerHTML = html;

      var form = body.querySelector('#form-lh');
      var pickerApi = Picker.atlet(body.querySelector('#lh-atlet'), {
        name: 'id_atlet',
        label: 'Atlet',
        required: true,
        mode: 'multi',
        help: 'Pilih satu atau beberapa atlet. Entri disimpan terpisah untuk setiap atlet.',
        onChange: function () {
          renderOverride();
          segarkanKemajuan();
        }
      });
      var lokasiApi = Picker.lokasi(body.querySelector('#lh-lokasi'), {
        label: 'Lokasi Latihan',
        required: true,
        help: 'Pilih satu atau beberapa lokasi yang dipakai hari ini.'
      });

      function renderOverride() {
        var box = body.querySelector('#lh-override');
        var list = body.querySelector('#lh-override-list');
        if (!box || !list) return;
        var ids = pickerApi.getValue();
        var paramsAktif = Shared.activeParameters(mode);
        if (ids.length < 2 || !paramsAktif.length) {
          box.hidden = true;
          list.innerHTML = '';
          return;
        }
        box.hidden = false;
        list.innerHTML = '<div class="list-rows">' + ids.map(function (id) {
          var a = UI.athleteById(id);
          return '<div class="list-row" style="flex-wrap:wrap">' +
            '<div class="grow"><b>' + Utils.esc(a ? a.nama : id) + '</b><span>' + Utils.esc(id) + '</span></div>' +
            '<div class="flex gap-1 flex-wrap">' +
            paramsAktif.map(function (p) {
              return '<div style="min-width:96px">' +
                '<div class="small muted">' + Utils.esc(p.nama) + '</div>' +
                '<input class="input" type="number" min="1" max="10" step="1" name="ov_' + Utils.esc(id) + '_' + Utils.esc(p.id) + '" placeholder="dasar" aria-label="Nilai ' + Utils.esc(p.nama) + ' untuk ' + Utils.esc(a ? a.nama : id) + '">' +
                '</div>';
            }).join('') +
            '</div></div>';
        }).join('') + '</div>';
      }

      renderOverride();

      UI.bindSubmit(form, function () {
        Utils.clearErrors(form);
        var data = Utils.formData(form);
        var errors = {};
        var nilaiLokasi = lokasiApi.getValue();
        var dipilih = pickerApi.getValue();
        if (!dipilih.length) errors.id_atlet = 'Pilih atlet.';
        if (!data.tanggal) errors.tanggal = 'Tanggal wajib diisi.';
        if (!nilaiLokasi.ids.length && !nilaiLokasi.lainnya) errors.lokasi = 'Lokasi latihan wajib diisi.';
        if (!String(data.program || '').trim()) errors.program = 'Program latihan wajib diisi.';
        var ps = Shared.activeParameters(mode);
        if (!ps.length) {
          Utils.toast('Tidak ada parameter aktif.', 'danger');
          return;
        }
        function nilaiUntuk(id, p) {
          var ov = data['ov_' + id + '_' + p.id];
          if (ov !== undefined && ov !== null && String(ov).trim() !== '') return ov;
          return data['p_' + p.id];
        }
        var belumIsi = [];
        dipilih.forEach(function (id) {
          var n = 0;
          ps.forEach(function (p) {
            var val = nilaiUntuk(id, p);
            if (val === '' || val === undefined) return;
            n++;
            var num = Number(val);
            if (isNaN(num) || num < 1 || num > 10) errors['p_' + p.id] = 'Isi nilai 1 - 10.';
          });
          if (!n) belumIsi.push(id);
        });
        if (belumIsi.length) errors['p_' + ps[0].id] = 'Isi minimal satu nilai parameter untuk setiap atlet terpilih.';
        if (Object.keys(errors).length) {
          Utils.showErrors(form, errors);
          Utils.toast('Periksa kembali isian yang ditandai.', 'danger');
          return;
        }
        var lokasiPayload = Picker.payloadLokasi(nilaiLokasi);
        dipilih.forEach(function (id) {
          ps.forEach(function (p) {
            var val = nilaiUntuk(id, p);
            if (val === '' || val === undefined) return;
            Store.insert('logbook_entries', Object.assign({
              id_atlet: id,
              tanggal: data.tanggal,
              id_parameter: p.id,
              nama_parameter: p.nama,
              satuan: p.satuan,
              kategori: p.kategori,
              nilai: Number(val),
              program: data.program || '',
              catatan: data.catatan || '',
              input_oleh: user.id,
              input_peran: CONFIG.ROLE_LABEL[user.role] || ''
            }, lokasiPayload));
          });
        });
        Utils.toast('Berhasil disimpan untuk ' + dipilih.length + ' atlet.', 'success');
        form.reset();
        form.querySelector('[name="tanggal"]').value = Utils.todayISO();
        lokasiApi.setValue({ ids: [], lainnya: '' });
        pickerApi.setValue([]);
        renderOverride();
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
        '<th>Tanggal</th><th>Atlet</th><th>Lokasi</th><th>Program Latihan</th><th>Ringkasan</th><th>Catatan</th><th>Input Oleh</th><th class="align-center">Aksi</th>' +
        '</tr></thead><tbody>' +
        keys.slice(0, 30).map(function (k) {
          var g = grouped[k];
          var a = UI.athleteById(g.id_atlet);
          var kunci = Utils.esc(g.id_atlet) + '|' + Utils.esc(g.tanggal) + '|' + Utils.esc(mode);
          return '<tr>' +
            '<td>' + Utils.fmtDate(g.tanggal) + '</td>' +
            '<td><b>' + Utils.esc(a ? a.nama : '-') + '</b></td>' +
            '<td>' + Picker.chipLokasi(g.items[0]) + '</td>' +
            '<td class="small">' + Utils.esc(Shared.programLatihan(g.items[0])) + '</td>' +
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
      var idAtlet = kolom ? String(kolom.value || '').split(',')[0] : '';
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
      '<div class="filter-bar">' +
      '<select class="input" id="ip-kategori" style="max-width:220px" aria-label="Filter kategori pertandingan">' +
      '<option value="">Semua kategori</option>' +
      '<option value="Tournament">Tournament</option>' +
      '<option value="Friendly Match">Friendly Match</option>' +
      '<option value="__belum">Belum dikategorikan</option>' +
      '</select>' +
      '</div>' +
      '<div id="ip-list"></div>' +
      '</div></div>';

    var page = root.querySelector('.page');
    var formHost = page.querySelector('#ip-form');
    var listHost = page.querySelector('#ip-list');

    function renderForm() {
      formHost.innerHTML =
        '<form id="form-ip" novalidate><div class="form-grid cols-2">' +
        UI.field({
          name: 'nomor', label: 'Nomor', type: 'select', required: true, value: 'Tunggal',
          options: [{ value: 'Tunggal', label: 'Tunggal (1 atlet)' }, { value: 'Ganda', label: 'Ganda (2 atlet / pasangan)' }]
        }) +
        UI.field({ name: 'tanggal', label: 'Tanggal', type: 'date', required: true, value: Utils.todayISO() }) +
        UI.field({ name: 'turnamen', label: 'Turnamen', required: true, placeholder: 'contoh: Surabaya Open 2026' }) +
        UI.field({
          name: 'kategori', label: 'Kategori Pertandingan', type: 'select', required: true, value: '',
          options: [{ value: '', label: '-- Pilih kategori --' }].concat(
            (CONFIG.KATEGORI_PERTANDINGAN || []).map(function (k) {
              return { value: k, label: k };
            }))
        }) +
        UI.field({ name: 'lawan', label: 'Lawan', required: true, placeholder: 'contoh: PB Djarum Kudus' }) +
        UI.field({ name: 'hasil', label: 'Hasil', type: 'select', value: 'Menang', options: ['Menang', 'Kalah'] }) +
        '</div>' +
        '<div id="ip-atlet"></div>' +
        UI.field({ name: 'catatan', label: 'Catatan', type: 'textarea', rows: 2, placeholder: 'Opsional' }) +
        '<div class="field"><label class="label">Skor per Set <span class="req">*</span></label>' +
        '<div class="help" style="margin:0 0 8px">Format angka-angka, contoh: 21-18</div>' +
        '<div id="ip-set-rows"><div class="set-row"><input class="input" name="set_0" placeholder="contoh: 21-18" inputmode="numeric" aria-label="Skor set 1">' +
        '<button type="button" class="icon-btn" data-remove-set aria-label="Hapus set">' + UI.icon('trash', 18) + '</button></div></div>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-add-set>' + UI.icon('plus', 18) + ' Tambah Set</button>' +
        '<div class="field-error" data-error-for="skor_set"></div></div>' +
        '<button class="btn" type="submit">' + UI.icon('save', 20) + ' Simpan Hasil</button></form>';

      var form = formHost.querySelector('#form-ip');
      var atletHost = form.querySelector('#ip-atlet');
      var pickerApi = null;

      function pasangPickerAtlet(nilaiAwal) {
        var nomor = form.querySelector('[name="nomor"]').value;
        pickerApi = Picker.atlet(atletHost, {
          name: 'id_atlet',
          label: 'Atlet',
          required: true,
          mode: nomor === 'Ganda' ? 'pair' : 'single',
          value: nilaiAwal || [],
          help: nomor === 'Ganda'
            ? 'Pilih tepat 2 atlet sebagai pasangan ganda.'
            : 'Pilih 1 atlet untuk nomor tunggal (klik untuk mencari).'
        });
      }

      pasangPickerAtlet([]);

      form.querySelector('[name="nomor"]').addEventListener('change', function () {
        pasangPickerAtlet(pickerApi.getValue());
      });

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
        var dipilih = pickerApi.getValue();
        var nomor = data.nomor || 'Tunggal';
        if (!dipilih.length) errors.id_atlet = 'Atlet wajib dipilih.';
        else if (nomor === 'Ganda' && dipilih.length !== 2) errors.id_atlet = 'Nomor ganda memerlukan tepat 2 atlet sebagai pasangan.';
        else if (nomor === 'Tunggal' && dipilih.length !== 1) errors.id_atlet = 'Nomor tunggal memerlukan tepat 1 atlet.';
        if (!data.tanggal) errors.tanggal = 'Tanggal wajib diisi.';
        if (!data.turnamen) errors.turnamen = 'Turnamen wajib diisi.';
        if (!data.kategori) errors.kategori = 'Kategori pertandingan wajib dipilih.';
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
          id_atlet: dipilih[0],
          id_atlet_2: dipilih[1] || '',
          nomor: nomor,
          tanggal: data.tanggal,
          turnamen: data.turnamen,
          kategori: data.kategori || '',
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
      var filterKat = page.querySelector('#ip-kategori') ? page.querySelector('#ip-kategori').value : '';
      var rows = Utils.sortBy(Store.all('matches').filter(function (m) {
        if (filterKat === '__belum') return !m.kategori;
        if (filterKat) return m.kategori === filterKat;
        return true;
      }), 'tanggal', 'desc');
      if (!rows.length) {
        listHost.innerHTML = UI.emptyState('Belum ada data pertandingan.', 'trophy');
        return;
      }
      listHost.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr>' +
        '<th>Tanggal</th><th>Atlet</th><th>Kategori</th><th>Turnamen</th><th>Lawan</th><th>Skor</th><th>Hasil</th><th>Input Oleh</th>' +
        '</tr></thead><tbody>' +
        rows.slice(0, 30).map(function (m) {
          return '<tr>' +
            '<td>' + Utils.fmtDate(m.tanggal) + '</td>' +
            '<td><b>' + Utils.esc(Shared.labelAtletMatch(m)) + '</b>' +
            (m.nomor === 'Ganda' ? ' <span class="small muted">(Ganda)</span>' : '') + '</td>' +
            '<td>' + Shared.badgeKategori(m.kategori) + '</td>' +
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

    page.addEventListener('change', function (e) {
      if (e.target.id === 'ip-kategori') refreshList();
    });

    app.subscribe('matches', refreshList);
    app.subscribe('athletes', renderForm);
  }

  function register() {
    App.register('profil-asisten', {
      title: 'Profil Saya',
      subtitle: 'Data diri & lisensi pelatih',
      render: profilAsisten
    });
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

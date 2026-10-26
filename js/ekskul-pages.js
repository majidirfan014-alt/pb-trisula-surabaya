/* ==========================================================================
   EKSTRAKURIKULER — daftar halaman dashboard.
   Role Superadmin: Pengguna, Input Penilaian, Input Absensi, Result
   Pertandingan, Dashboard. Role Sekolah & Guru Sekolah: hanya melihat
   data sekolahnya; Role Siswa/Siswi: hanya melihat datanya sendiri
   (hanya-lihat juga dijaga di tingkat logika penyimpanan).
   ========================================================================== */

var EkskulPages = (function () {
  var state = {
    penggunaTab: 'sekolah',
    penilaian: { tanggal: '', sekolah_id: '', siswaIds: [], editingId: null },
    absensi: { tanggal: '', sekolah_id: '', siswaIds: [], statusPerSiswa: {}, jam_mulai: '16:00', jam_selesai: '18:00', alasan: '', catatan: '' },
    pertandingan: { editId: null },
    filterHome: { sekolah_id: '', siswa_id: '', dari: '', sampai: '' },
    filterPenilaian: { siswa_id: '', dari: '', sampai: '' },
    filterAbsensi: { siswa_id: '', dari: '', sampai: '' },
    filterPertandingan: { siswa_id: '', turnamen: '', dari: '', sampai: '' }
  };

  function session() {
    return EkskulAuth.getSession() || {};
  }

  function isSuperadmin() {
    return session().role === 'superadmin';
  }

  function isSiswa() {
    return session().role === 'siswa';
  }

  /* =====================  PEMBATASAN CAKUPAN DATA  ===================== */
  // Sekolah & Guru Sekolah hanya melihat data milik sekolahnya sendiri.
  // Siswa/Siswi hanya melihat datanya sendiri.
  function scopedSchools() {
    var s = session();
    if (s.role === 'superadmin') return EkskulStore.all('schools');
    return EkskulStore.where('schools', function (x) {
      return x.id === s.sekolah_id;
    });
  }

  function scopedTeachers() {
    var s = session();
    if (s.role === 'superadmin') return EkskulStore.all('teachers');
    return EkskulStore.where('teachers', function (x) {
      return x.sekolah_id === s.sekolah_id;
    });
  }

  function scopedStudents() {
    var s = session();
    if (s.role === 'superadmin') {
      return EkskulStore.where('students', function (x) {
        return x.status !== 'nonaktif';
      });
    }
    if (s.role === 'siswa') {
      return EkskulStore.where('students', function (x) {
        return x.id === s.siswa_id;
      });
    }
    return EkskulStore.where('students', function (x) {
      return x.sekolah_id === s.sekolah_id && x.status !== 'nonaktif';
    });
  }

  // Menolak upaya melihat data sekolah lain lewat manipulasi nilai.
  function assertSchoolAccess(sekolahId) {
    var s = session();
    if (s.role === 'superadmin') return true;
    if (!sekolahId || sekolahId === s.sekolah_id) return true;
    throw new Error('Anda tidak memiliki akses ke data sekolah tersebut.');
  }

  function studentsByIds(ids) {
    var out = [];
    (ids || []).forEach(function (id) {
      var s = EkskulStore.find('students', id);
      if (s) out.push(s);
    });
    return out;
  }

  function sekolahOptions(selected, hanyaAktif) {
    var list = EkskulStore.all('schools').filter(function (s) {
      return !hanyaAktif || s.status === 'aktif';
    }).sort(function (a, b) {
      return String(a.nama).localeCompare(String(b.nama));
    });
    var html = '<option value="">-- Semua sekolah --</option>';
    list.forEach(function (s) {
      var status = s.status === 'aktif' ? '' : ' (' + s.status + ')';
      html += '<option value="' + Utils.esc(s.id) + '"' + (s.id === selected ? ' selected' : '') + '>' +
        Utils.esc(s.nama + status) + '</option>';
    });
    return html;
  }

  function siswaOptions(list, selected, placeholder) {
    var html = '<option value="">' + Utils.esc(placeholder || '-- Semua siswa --') + '</option>';
    list.slice().sort(function (a, b) {
      return String(a.nama).localeCompare(String(b.nama));
    }).forEach(function (s) {
      html += '<option value="' + Utils.esc(s.id) + '"' + (s.id === selected ? ' selected' : '') + '>' +
        Utils.esc(s.nama + ' (' + (s.id_siswa || '') + ')') + '</option>';
    });
    return html;
  }

  function periodeHtml(prefix, dari, sampai) {
    return '<div class="field"><label class="label" for="' + prefix + '-dari">Dari Tanggal</label>' +
      '<input class="input" type="date" id="' + prefix + '-dari" data-filter="dari" value="' + Utils.esc(dari || '') + '"></div>' +
      '<div class="field"><label class="label" for="' + prefix + '-sampai">Sampai Tanggal</label>' +
      '<input class="input" type="date" id="' + prefix + '-sampai" data-filter="sampai" value="' + Utils.esc(sampai || '') + '"></div>';
  }

  // Kartu identitas singkat untuk tampilan siswa/siswi (tanpa filter sekolah).
  function identitasSiswaHtml() {
    var s = session();
    var me = EkskulStore.find('students', s.siswa_id) || {};
    return '<div class="card">' +
      '<div class="card-title">' + UI.icon('users', 22) + 'Data Saya</div>' +
      '<div class="list-rows">' +
      '<div class="list-row"><div class="grow"><b>' + Utils.esc(me.nama || s.nama || '-') + '</b>' +
      '<span>' + Utils.esc((me.id_siswa || '') + ' · Kelas ' + (me.kelas || '-') + ' · ' + (s.sekolah_nama || '')) + '</span></div></div>' +
      '</div>' +
      '<div class="filter-ekskul cols-2 mt-2">' + periodeHtml('pv', state.filterPenilaian.dari, state.filterPenilaian.sampai) + '</div>' +
      '</div>';
  }

  function bindFilter(root, onChange) {
    if (!root) return;
    root.addEventListener('change', function (e) {
      if (!e.target.hasAttribute || !e.target.hasAttribute('data-filter')) return;
      onChange(e.target.getAttribute('data-filter'), e.target.value);
    });
  }

  /* =====================  PENILAIAN (SUPERADMIN)  ===================== */

  function pagePenilaian(root) {
    if (!isSuperadmin()) {
      return pagePenilaianView(root);
    }
    var st = state.penilaian;
    if (!st.tanggal) st.tanggal = Utils.todayISO();

    var sekolahList = EkskulStore.where('schools', function (s) {
      return s.status === 'aktif';
    }).sort(function (a, b) {
      return String(a.nama).localeCompare(String(b.nama));
    });

    var siswaList = st.sekolah_id
      ? EkskulStore.where('students', function (s) {
        return s.sekolah_id === st.sekolah_id && s.status !== 'nonaktif';
      })
      : [];

    var paramsTeknik = EkskulData.parameters('teknik', true);
    var paramsFisik = EkskulData.parameters('fisik', true);

    var editing = st.editingId ? EkskulStore.find('assessments', st.editingId) : null;
    var nilaiAwal = editing ? (editing.values || {}) : {};

    var html = UI.pageHeader('Input Penilaian Latihan', 'Nilai skala 1 sampai 10 per siswa per tanggal latihan.') +
      '<div class="card">' +
      '<div class="card-title">' + UI.icon('clipboard', 22) + 'Data Latihan</div>' +
      '<div class="filter-ekskul cols-2">' +
      '<div class="field"><label class="label" for="pnl-tanggal">Tanggal Latihan <span class="req">*</span></label>' +
      '<input class="input" type="date" id="pnl-tanggal" value="' + Utils.esc(st.tanggal) + '"></div>' +
      '<div class="field"><label class="label" for="pnl-sekolah">Sekolah <span class="req">*</span></label>' +
      '<select class="input" id="pnl-sekolah">' +
      '<option value="">-- Pilih sekolah --</option>' +
      sekolahList.map(function (s) {
        return '<option value="' + Utils.esc(s.id) + '"' + (s.id === st.sekolah_id ? ' selected' : '') + '>' + Utils.esc(s.nama) + '</option>';
      }).join('') +
      '</select></div>' +
      '</div>' +
      '<div class="field"><label class="label">Siswa/Siswi <span class="req">*</span></label>' +
      '<p class="hint-kecil">Cari lalu centang satu atau beberapa siswa. Bila siswa sudah punya nilai pada tanggal ini, datanya masuk mode edit.</p>' +
      EkskulUI.pickerHtml({ id: 'pnl-siswa', siswa: siswaList, selected: st.siswaIds, label: 'Pilih siswa/siswi' }) +
      '</div>' +
      (st.siswaIds.length ? '<div class="mt-1" id="pnl-chips">' + EkskulUI.chipsSiswa(st.siswaIds) + '</div>' : '<div class="mt-1" id="pnl-chips"></div>') +
      '</div>';

    if (st.siswaIds.length) {
      var sudahAda = st.siswaIds.filter(function (id) {
        return EkskulStore.findOne('assessments', function (a) {
          return a.siswa_id === id && a.tanggal === st.tanggal;
        });
      });
      html += '<div class="card mt-2">' +
        '<div class="card-title">' + UI.icon('edit', 22) + 'Nilai (skala 1 - 10)</div>' +
        (sudahAda.length ? '<div class="pesan-panel warn"><b>Mode edit untuk ' + sudahAda.length + ' siswa</b>' +
          'Siswa berikut sudah punya penilaian pada tanggal ini dan akan diperbarui: ' +
          Utils.esc(sudahAda.map(function (id) {
            var s = EkskulStore.find('students', id);
            return s ? s.nama : id;
          }).join(', ')) + '.</div>' : '') +
        '<div class="mb-2"><b>Teknik</b></div>' +
        paramsTeknik.map(function (p) {
          return EkskulUI.sliderRow('param_' + p.id, p.nama, nilaiAwal[p.id]);
        }).join('') +
        '<button type="button" class="btn btn-secondary btn-sm mb-3" data-tambah-param="teknik">' + UI.icon('plus', 18) + 'Tambah Parameter Teknik</button>' +
        '<div class="mb-2"><b>Fisik</b></div>' +
        paramsFisik.map(function (p) {
          return EkskulUI.sliderRow('param_' + p.id, p.nama, nilaiAwal[p.id]);
        }).join('') +
        '<button type="button" class="btn btn-secondary btn-sm mb-3" data-tambah-param="fisik">' + UI.icon('plus', 18) + 'Tambah Parameter Fisik</button>' +
        EkskulUI.sliderRow('kedisiplinan', 'Kedisiplinan', editing ? editing.kedisiplinan : 5) +
        '<div class="field"><label class="label" for="pnl-catatan">Catatan (opsional)</label>' +
        '<textarea class="input" id="pnl-catatan" rows="2" placeholder="Catatan latihan, misalnya: fokus latihan netting."></textarea></div>' +
        '<button type="button" class="btn btn-block" id="pnl-simpan">' + UI.icon('save', 18) +
        (st.editingId ? 'Perbarui Penilaian' : 'Simpan Penilaian') + '</button>' +
        (st.editingId ? '<button type="button" class="btn btn-ghost btn-block mt-1" id="pnl-batal-edit">Batalkan Mode Edit</button>' : '') +
        '</div>';
    }

    // Riwayat penilaian
    var riwayat = EkskulStore.all('assessments').sort(function (a, b) {
      return a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : 0;
    });
    var rows = riwayat.map(function (a) {
      var s = EkskulStore.find('students', a.siswa_id);
      var values = a.values || {};
      var persens = [];
      Object.keys(values).forEach(function (pid) {
        var v = Number(values[pid]);
        if (isFinite(v)) persens.push(EkskulHitung.pctNilai(v));
      });
      if (a.kedisiplinan !== undefined && a.kedisiplinan !== null && a.kedisiplinan !== '') {
        var kv = Number(a.kedisiplinan);
        if (isFinite(kv)) persens.push(EkskulHitung.pctNilai(kv));
      }
      var rataPct = EkskulHitung.bulat(EkskulHitung.rata(persens), 1);
      return '<td>' + Utils.esc(Utils.fmtDate(a.tanggal)) + '</td>' +
        '<td>' + Utils.esc(s ? s.nama : '-') + '<div class="small muted">' + Utils.esc(s ? (s.id_siswa || '') : '') + '</div></td>' +
        '<td>' + Utils.esc(s ? EkskulData.namaSekolah(s.sekolah_id) : '-') + '</td>' +
        '<td class="align-center">' + (rataPct === null ? '—' : EkskulUI.pctBadge(rataPct)) + '</td>' +
        '<td class="align-right">' +
        '<button type="button" class="btn btn-sm btn-secondary" data-edit-penilaian="' + Utils.esc(a.id) + '">Edit</button> ' +
        '<button type="button" class="btn btn-sm btn-danger" data-hapus-penilaian="' + Utils.esc(a.id) + '">Hapus</button>' +
        '</td>';
    });

    html += '<div class="card mt-2">' +
      '<div class="card-title">' + UI.icon('calendar', 22) + 'Riwayat Penilaian</div>' +
      UI.table([
        { label: 'Tanggal' }, { label: 'Siswa' }, { label: 'Sekolah' },
        { label: 'Rata-rata', align: 'center' }, { label: 'Aksi', align: 'right' }
      ], rows, { empty: 'Belum ada penilaian.' }) +
      '</div>';

    root.innerHTML = html;

    // Binding
    EkskulUI.bindSliders(root);
    var picker = EkskulUI.bindPicker('pnl-siswa', function (ids) {
      var sebelumKosong = !st.siswaIds.length;
      st.siswaIds = ids;
      // Render ulang hanya saat perubahan kosong <-> terisi agar panel nilai
      // muncul/hilang, kolom pencarian tetap nyaman dipakai.
      if (sebelumKosong !== !ids.length) pagePenilaian(root);
      else {
        var chipHost = root.querySelector('#pnl-chips');
        if (chipHost) chipHost.innerHTML = ids.length ? EkskulUI.chipsSiswa(ids) : '';
      }
    });
    root.querySelector('#pnl-tanggal').addEventListener('change', function (e) {
      st.tanggal = e.target.value;
    });
    root.querySelector('#pnl-sekolah').addEventListener('change', function (e) {
      st.sekolah_id = e.target.value;
      st.siswaIds = [];
      pagePenilaian(root);
    });
    var batalEdit = root.querySelector('#pnl-batal-edit');
    if (batalEdit) {
      batalEdit.addEventListener('click', function () {
        st.editingId = null;
        pagePenilaian(root);
      });
    }
    root.querySelectorAll('[data-tambah-param]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        modalTambahParameter(btn.getAttribute('data-tambah-param'), function () {
          pagePenilaian(root);
        });
      });
    });

    var simpanBtn = root.querySelector('#pnl-simpan');
    if (simpanBtn) {
      simpanBtn.addEventListener('click', UI.preventDouble(function () {
        var ids = picker.getSelected();
        if (!st.tanggal) {
          Utils.toast('Tanggal latihan wajib diisi.', 'danger');
          return;
        }
        if (!ids.length) {
          Utils.toast('Pilih minimal satu siswa terlebih dahulu.', 'danger');
          return;
        }
        var values = {};
        var kedis = null;
        root.querySelectorAll('[data-slider]').forEach(function (slider) {
          var name = slider.getAttribute('data-slider');
          var v = Number(slider.value);
          if (!isFinite(v) || v < 1 || v > 10) v = 1;
          if (name.indexOf('param_') === 0) {
            values[name.slice(6)] = Math.round(v);
          } else if (name === 'kedisiplinan') {
            kedis = Math.round(v);
          }
        });
        var catatan = root.querySelector('#pnl-catatan').value.trim();
        var tersimpan = 0;
        var diperbarui = 0;
        ids.forEach(function (sid) {
          var existing = EkskulStore.findOne('assessments', function (a) {
            return a.siswa_id === sid && a.tanggal === st.tanggal;
          });
          if (existing) {
            EkskulStore.update('assessments', existing.id, {
              values: values,
              kedisiplinan: kedis,
              catatan: catatan
            });
            diperbarui++;
          } else {
            EkskulStore.insert('assessments', {
              siswa_id: sid,
              tanggal: st.tanggal,
              values: values,
              kedisiplinan: kedis,
              catatan: catatan,
              diinput_oleh: session().userId || ''
            });
            tersimpan++;
          }
        });
        Utils.toast('Penilaian tersimpan: ' + tersimpan + ' baru, ' + diperbarui + ' diperbarui.', 'success');
        st.editingId = null;
        pagePenilaian(root);
      }));
    }

    root.querySelectorAll('[data-edit-penilaian]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var a = EkskulStore.find('assessments', btn.getAttribute('data-edit-penilaian'));
        if (!a) return;
        var s = EkskulStore.find('students', a.siswa_id);
        st.editingId = a.id;
        st.tanggal = a.tanggal;
        st.sekolah_id = s ? s.sekolah_id : '';
        st.siswaIds = [a.siswa_id];
        pagePenilaian(root);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    root.querySelectorAll('[data-hapus-penilaian]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        UI.confirmDialog('Hapus penilaian ini? Data yang dihapus tidak bisa dikembalikan.', 'Konfirmasi Hapus').then(function (ok) {
          if (!ok) return;
          EkskulStore.remove('assessments', btn.getAttribute('data-hapus-penilaian'));
          Utils.toast('Penilaian dihapus.', 'success');
          pagePenilaian(root);
        });
      });
    });
  }

  function modalTambahParameter(kategori, onDone) {
    var label = EkskulConfig.KATEGORI_PARAM[kategori] || kategori;
    var daftar = EkskulStore.where('parameters', function (p) {
      return p.kategori === kategori;
    });
    var body = '<p class="hint-kecil">Parameter disimpan dengan ID tetap — mengubah nama tidak menghapus nilai lama. Menonaktifkan membuat parameter hilang dari form baru, tetapi nilai lama tetap tampil di laporan.</p>' +
      '<div class="field"><label class="label" for="prm-nama">Nama Parameter Baru <span class="req">*</span></label>' +
      '<input class="input" type="text" id="prm-nama" placeholder="contoh: Serve" maxlength="40">' +
      '<div class="field-error" id="prm-error"></div></div>' +
      '<button type="button" class="btn btn-block" id="prm-tambah">Tambahkan Parameter</button>' +
      '<h3 class="mt-3 mb-1">Daftar Parameter ' + Utils.esc(label) + '</h3>' +
      daftar.map(function (p) {
        return '<div class="baris-parameter">' +
          '<div class="grow"><b>' + Utils.esc(p.nama) + '</b><span>ID: ' + Utils.esc(p.id) + '</span></div>' +
          (p.aktif ? UI.badge('Aktif', 'ok') : UI.badge('Nonaktif', 'muted')) +
          '<button type="button" class="btn btn-sm btn-secondary" data-edit-param="' + Utils.esc(p.id) + '">Ubah Nama</button>' +
          '<button type="button" class="btn btn-sm ' + (p.aktif ? 'btn-danger' : 'btn-secondary') + '" data-toggle-param="' + Utils.esc(p.id) + '">' +
          (p.aktif ? 'Nonaktifkan' : 'Aktifkan') + '</button>' +
          '</div>';
      }).join('');

    var host = document.getElementById('modal-host');
    host.innerHTML = UI.modalShell('modal-parameter', 'Parameter ' + label, body,
      '<button type="button" class="btn btn-ghost" data-modal-close="modal-parameter">Tutup</button>');
    UI.openModal('modal-parameter');

    host.querySelector('#prm-tambah').addEventListener('click', UI.preventDouble(function () {
      var nama = host.querySelector('#prm-nama').value.trim();
      var err = host.querySelector('#prm-error');
      err.textContent = '';
      if (!nama) {
        err.textContent = 'Nama parameter wajib diisi.';
        return;
      }
      var bentrok = EkskulStore.findOne('parameters', function (p) {
        return p.kategori === kategori && p.nama.toLowerCase() === nama.toLowerCase();
      });
      if (bentrok) {
        err.textContent = 'Nama parameter sudah ada.';
        return;
      }
      EkskulStore.insert('parameters', {
        nama: nama,
        kategori: kategori,
        aktif: true
      });
      Utils.toast('Parameter "' + nama + '" ditambahkan.', 'success');
      UI.closeModal('modal-parameter');
      if (onDone) onDone();
    }));

    host.querySelectorAll('[data-toggle-param]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var p = EkskulStore.find('parameters', btn.getAttribute('data-toggle-param'));
        if (!p) return;
        EkskulStore.update('parameters', p.id, { aktif: !p.aktif });
        Utils.toast('Parameter ' + p.nama + (p.aktif ? ' dinonaktifkan.' : ' diaktifkan.'), 'success');
        UI.closeModal('modal-parameter');
        if (onDone) onDone();
      });
    });

    host.querySelectorAll('[data-edit-param]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var p = EkskulStore.find('parameters', btn.getAttribute('data-edit-param'));
        if (!p) return;
        var namaBaru = window.prompt('Ubah nama parameter "' + p.nama + '":', p.nama);
        if (namaBaru === null) return;
        namaBaru = namaBaru.trim();
        if (!namaBaru) {
          Utils.toast('Nama parameter tidak boleh kosong.', 'danger');
          return;
        }
        EkskulStore.update('parameters', p.id, { nama: namaBaru });
        Utils.toast('Nama parameter diperbarui.', 'success');
        UI.closeModal('modal-parameter');
        if (onDone) onDone();
      });
    });
  }

  /* =====================  ABSENSI (SUPERADMIN)  ===================== */

  function pageAbsensi(root) {
    if (!isSuperadmin()) {
      return pageAbsensiView(root);
    }
    var st = state.absensi;
    if (!st.tanggal) st.tanggal = Utils.todayISO();

    var sekolahList = EkskulStore.where('schools', function (s) {
      return s.status === 'aktif';
    }).sort(function (a, b) {
      return String(a.nama).localeCompare(String(b.nama));
    });

    var siswaList = st.sekolah_id
      ? EkskulStore.where('students', function (s) {
        return s.sekolah_id === st.sekolah_id && s.status !== 'nonaktif';
      })
      : [];

    var html = UI.pageHeader('Input Absensi Siswa/Siswi', 'Tetapkan kehadiran per siswa pada satu tanggal latihan.') +
      '<div class="card">' +
      '<div class="card-title">' + UI.icon('calendar', 22) + 'Data Pertemuan</div>' +
      '<div class="filter-ekskul cols-2">' +
      '<div class="field"><label class="label" for="abs-tanggal">Tanggal <span class="req">*</span></label>' +
      '<input class="input" type="date" id="abs-tanggal" value="' + Utils.esc(st.tanggal) + '"></div>' +
      '<div class="field"><label class="label" for="abs-sekolah">Sekolah <span class="req">*</span></label>' +
      '<select class="input" id="abs-sekolah">' +
      '<option value="">-- Pilih sekolah --</option>' +
      sekolahList.map(function (s) {
        return '<option value="' + Utils.esc(s.id) + '"' + (s.id === st.sekolah_id ? ' selected' : '') + '>' + Utils.esc(s.nama) + '</option>';
      }).join('') +
      '</select></div>' +
      '</div>' +
      '<div class="field"><label class="label">Siswa/Siswi <span class="req">*</span></label>' +
      '<p class="hint-kecil">Cari lalu centang siswa yang akan diabsen. Status awal berlaku untuk semua, lalu bisa diubah per siswa.</p>' +
      EkskulUI.pickerHtml({ id: 'abs-siswa', siswa: siswaList, selected: st.siswaIds, label: 'Pilih siswa/siswi' }) +
      '</div></div>';

    if (st.siswaIds.length) {
      var statusDefault = 'Hadir';
      html += '<div class="card mt-2">' +
        '<div class="card-title">' + UI.icon('check', 22) + 'Status Kehadiran</div>' +
        '<div class="field"><label class="label" for="abs-status-default">Status untuk semua siswa terpilih</label>' +
        '<select class="input" id="abs-status-default">' +
        EkskulConfig.STATUS_KEHADIRAN.map(function (s) {
          return '<option value="' + Utils.esc(s) + '">' + Utils.esc(s) + '</option>';
        }).join('') +
        '</select><div class="help">Pilih status lalu tekan tombol "Terapkan ke Semua" bila perlu, atau atur per siswa di bawah.</div></div>' +
        '<button type="button" class="btn btn-secondary btn-sm mb-2" id="abs-terapkan">Terapkan ke Semua</button>' +
        st.siswaIds.map(function (sid) {
          var s = EkskulStore.find('students', sid);
          if (!s) return '';
          var current = st.statusPerSiswa[sid] || 'Hadir';
          return '<div class="absensi-baris" data-abs-row="' + Utils.esc(sid) + '">' +
            '<span class="nama">' + Utils.esc(s.nama) + ' <span class="muted small">(' + Utils.esc(s.id_siswa || '') + ')</span></span>' +
            '<div class="status-pill-row">' +
            EkskulConfig.STATUS_KEHADIRAN.map(function (status) {
              return '<button type="button" class="status-pill' + (status === current ? ' active' : '') + '" data-status="' + Utils.esc(status) + '">' + Utils.esc(status) + '</button>';
            }).join('') +
            '</div></div>';
        }).join('') +
        '<div class="form-grid cols-2 mt-2">' +
        '<div class="field"><label class="label" for="abs-jam-mulai">Jam Mulai</label>' +
        '<input class="input" type="time" id="abs-jam-mulai" value="' + Utils.esc(st.jam_mulai) + '"></div>' +
        '<div class="field"><label class="label" for="abs-jam-selesai">Jam Selesai</label>' +
        '<input class="input" type="time" id="abs-jam-selesai" value="' + Utils.esc(st.jam_selesai) + '"></div>' +
        '</div>' +
        '<div class="field"><label class="label" for="abs-alasan">Perizinan (alasan izin/sakit)</label>' +
        '<input class="input" type="text" id="abs-alasan" placeholder="contoh: izin mengikuti lomba sekolah" value="' + Utils.esc(st.alasan) + '">' +
        '<div class="help">Diisi bila ada siswa berstatus Izin atau Sakit.</div></div>' +
        '<div class="field"><label class="label" for="abs-catatan">Catatan (opsional)</label>' +
        '<textarea class="input" id="abs-catatan" rows="2">' + Utils.esc(st.catatan) + '</textarea></div>' +
        '<button type="button" class="btn btn-block" id="abs-simpan">' + UI.icon('save', 18) + 'Simpan Absensi</button>' +
        '</div>';
    }

    var riwayat = EkskulStore.all('attendance').sort(function (a, b) {
      return a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : 0;
    });
    var rows = riwayat.map(function (a) {
      var s = EkskulStore.find('students', a.siswa_id);
      return '<td>' + Utils.esc(Utils.fmtDate(a.tanggal)) + '</td>' +
        '<td>' + Utils.esc(s ? s.nama : '-') + '<div class="small muted">' + Utils.esc(s ? (s.id_siswa || '') : '') + '</div></td>' +
        '<td>' + Utils.esc(s ? EkskulData.namaSekolah(s.sekolah_id) : '-') + '</td>' +
        '<td class="align-center">' + UI.statusBadge(a.status) + '</td>' +
        '<td>' + Utils.esc((a.jam_mulai || '-') + ' - ' + (a.jam_selesai || '-')) + '</td>' +
        '<td>' + Utils.esc(a.alasan_izin || '-') + '</td>' +
        '<td class="align-right">' +
        '<button type="button" class="btn btn-sm btn-secondary" data-edit-absensi="' + Utils.esc(a.id) + '">Edit</button> ' +
        '<button type="button" class="btn btn-sm btn-danger" data-hapus-absensi="' + Utils.esc(a.id) + '">Hapus</button>' +
        '</td>';
    });

    html += '<div class="card mt-2">' +
      '<div class="card-title">' + UI.icon('calendar', 22) + 'Riwayat Absensi</div>' +
      UI.table([
        { label: 'Tanggal' }, { label: 'Siswa' }, { label: 'Sekolah' }, { label: 'Status', align: 'center' },
        { label: 'Jam' }, { label: 'Perizinan' }, { label: 'Aksi', align: 'right' }
      ], rows, { empty: 'Belum ada absensi.' }) +
      '</div>';

    root.innerHTML = html;

    var picker = EkskulUI.bindPicker('abs-siswa', function (ids) {
      var lama = st.siswaIds.length;
      st.siswaIds = ids;
      if (lama !== ids.length) pageAbsensi(root);
    });
    root.querySelector('#abs-tanggal').addEventListener('change', function (e) {
      st.tanggal = e.target.value;
    });
    root.querySelector('#abs-sekolah').addEventListener('change', function (e) {
      st.sekolah_id = e.target.value;
      st.siswaIds = [];
      st.statusPerSiswa = {};
      pageAbsensi(root);
    });

    root.querySelectorAll('[data-abs-row]').forEach(function (row) {
      var sid = row.getAttribute('data-abs-row');
      if (!st.statusPerSiswa[sid]) st.statusPerSiswa[sid] = 'Hadir';
      row.querySelectorAll('[data-status]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          st.statusPerSiswa[sid] = btn.getAttribute('data-status');
          row.querySelectorAll('[data-status]').forEach(function (b) {
            b.classList.toggle('active', b === btn);
          });
        });
      });
    });

    var terapkan = root.querySelector('#abs-terapkan');
    if (terapkan) {
      terapkan.addEventListener('click', function () {
        var value = root.querySelector('#abs-status-default').value;
        st.siswaIds.forEach(function (sid) {
          st.statusPerSiswa[sid] = value;
        });
        root.querySelectorAll('[data-abs-row]').forEach(function (row) {
          var sid = row.getAttribute('data-abs-row');
          row.querySelectorAll('[data-status]').forEach(function (b) {
            b.classList.toggle('active', b.getAttribute('data-status') === st.statusPerSiswa[sid]);
          });
        });
        Utils.toast('Status "' + value + '" diterapkan ke semua siswa terpilih.', 'success');
      });
    }

    var jamMulai = root.querySelector('#abs-jam-mulai');
    var jamSelesai = root.querySelector('#abs-jam-selesai');
    var alasan = root.querySelector('#abs-alasan');
    var catatan = root.querySelector('#abs-catatan');
    if (jamMulai) jamMulai.addEventListener('change', function (e) { st.jam_mulai = e.target.value; });
    if (jamSelesai) jamSelesai.addEventListener('change', function (e) { st.jam_selesai = e.target.value; });
    if (alasan) alasan.addEventListener('input', function (e) { st.alasan = e.target.value; });
    if (catatan) catatan.addEventListener('input', function (e) { st.catatan = e.target.value; });

    var simpanBtn = root.querySelector('#abs-simpan');
    if (simpanBtn) {
      simpanBtn.addEventListener('click', UI.preventDouble(function () {
        if (!st.tanggal || !st.siswaIds.length) {
          Utils.toast('Tanggal dan minimal satu siswa wajib diisi.', 'danger');
          return;
        }
        var tersimpan = 0;
        var diperbarui = 0;
        st.siswaIds.forEach(function (sid) {
          var status = st.statusPerSiswa[sid] || 'Hadir';
          var perluAlasan = status === 'Izin' || status === 'Sakit';
          var existing = EkskulStore.findOne('attendance', function (a) {
            return a.siswa_id === sid && a.tanggal === st.tanggal;
          });
          var patch = {
            status: status,
            jam_mulai: st.jam_mulai,
            jam_selesai: st.jam_selesai,
            alasan_izin: perluAlasan ? st.alasan : '',
            catatan: st.catatan
          };
          if (existing) {
            EkskulStore.update('attendance', existing.id, patch);
            diperbarui++;
          } else {
            patch.siswa_id = sid;
            patch.tanggal = st.tanggal;
            patch.diinput_oleh = session().userId || '';
            EkskulStore.insert('attendance', patch);
            tersimpan++;
          }
        });
        Utils.toast('Absensi tersimpan: ' + tersimpan + ' baru, ' + diperbarui + ' diperbarui.', 'success');
        pageAbsensi(root);
      }));
    }

    root.querySelectorAll('[data-edit-absensi]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var a = EkskulStore.find('attendance', btn.getAttribute('data-edit-absensi'));
        if (!a) return;
        var s = EkskulStore.find('students', a.siswa_id);
        st.tanggal = a.tanggal;
        st.sekolah_id = s ? s.sekolah_id : '';
        st.siswaIds = [a.siswa_id];
        st.statusPerSiswa = {};
        st.statusPerSiswa[a.siswa_id] = a.status;
        st.jam_mulai = a.jam_mulai || '16:00';
        st.jam_selesai = a.jam_selesai || '18:00';
        st.alasan = a.alasan_izin || '';
        st.catatan = a.catatan || '';
        pageAbsensi(root);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    root.querySelectorAll('[data-hapus-absensi]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        UI.confirmDialog('Hapus catatan absensi ini?', 'Konfirmasi Hapus').then(function (ok) {
          if (!ok) return;
          EkskulStore.remove('attendance', btn.getAttribute('data-hapus-absensi'));
          Utils.toast('Absensi dihapus.', 'success');
          pageAbsensi(root);
        });
      });
    });
  }

  /* =====================  PERTANDINGAN (SUPERADMIN)  ===================== */

  function skorSetsHtml(sets) {
    var host = document.getElementById('skor-sets');
    if (!host) return;
    host.innerHTML = (sets && sets.length ? sets : ['']).map(function (s, i) {
      return '<div class="set-input-row">' +
        '<input class="input" type="text" inputmode="numeric" data-set-input placeholder="contoh: 21-18" value="' + Utils.esc(s) + '">' +
        '<button type="button" class="icon-btn" data-hapus-set aria-label="Hapus set">' + UI.icon('trash', 18) + '</button>' +
        '</div>';
    }).join('');
    host.querySelectorAll('[data-hapus-set]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var rows = host.querySelectorAll('.set-input-row');
        if (rows.length <= 1) {
          Utils.toast('Minimal satu set skor.', 'info');
          return;
        }
        btn.closest('.set-input-row').parentNode.removeChild(btn.closest('.set-input-row'));
      });
    });
  }

  function pagePertandingan(root) {
    if (!isSuperadmin()) {
      return pagePertandinganView(root);
    }
    var editing = state.pertandingan.editId ? EkskulStore.find('matches', state.pertandingan.editId) : null;
    var kategoriList = EkskulData.categories();
    var siswaList = scopedStudents();

    var html = UI.pageHeader('Result Pertandingan', 'Catat hasil pertandingan siswa/siswi beserta skor per set.') +
      '<div class="card">' +
      '<div class="card-title">' + UI.icon('trophy', 22) + (editing ? 'Edit Result Pertandingan' : 'Tambah Result Pertandingan') + '</div>' +
      '<div class="form-grid cols-2">' +
      '<div class="field"><label class="label" for="ptd-nomor">Nomor Pertandingan <span class="req">*</span></label>' +
      '<input class="input" type="text" id="ptd-nomor" placeholder="contoh: T-01" value="' + Utils.esc(editing ? editing.nomor : '') + '"></div>' +
      '<div class="field"><label class="label" for="ptd-tanggal">Tanggal Pertandingan <span class="req">*</span></label>' +
      '<input class="input" type="date" id="ptd-tanggal" value="' + Utils.esc(editing ? editing.tanggal : Utils.todayISO()) + '"></div>' +
      '<div class="field"><label class="label" for="ptd-turnamen">Turnamen <span class="req">*</span></label>' +
      '<input class="input" type="text" id="ptd-turnamen" placeholder="contoh: Kejuaraan Pelajar Surabaya" value="' + Utils.esc(editing ? editing.turnamen : '') + '"></div>' +
      '<div class="field"><label class="label" for="ptd-kategori">Kategori Pertandingan <span class="req">*</span></label>' +
      '<select class="input" id="ptd-kategori">' +
      '<option value="">-- Pilih kategori --</option>' +
      kategoriList.map(function (k) {
        return '<option value="' + Utils.esc(k.nama) + '"' + (editing && editing.kategori === k.nama ? ' selected' : '') + '>' + Utils.esc(k.nama) + '</option>';
      }).join('') +
      '</select>' +
      '<button type="button" class="btn btn-sm btn-secondary mt-1" id="ptd-tambah-kategori">' + UI.icon('plus', 16) + 'Tambah Kategori</button></div>' +
      '<div class="field"><label class="label" for="ptd-lawan">Lawan <span class="req">*</span></label>' +
      '<input class="input" type="text" id="ptd-lawan" placeholder="Nama lawan / sekolah lawan" value="' + Utils.esc(editing ? editing.lawan : '') + '"></div>' +
      '<div class="field"><label class="label">Hasil <span class="req">*</span></label>' +
      '<select class="input" id="ptd-hasil">' +
      EkskulConfig.HASIL.map(function (h) {
        return '<option value="' + Utils.esc(h) + '"' + (editing && editing.hasil === h ? ' selected' : '') + '>' + Utils.esc(h) + '</option>';
      }).join('') +
      '</select></div>' +
      '</div>' +
      '<div class="field"><label class="label">Atlet (Siswa/Siswi) <span class="req">*</span></label>' +
      '<p class="hint-kecil">Pilih satu siswa untuk tunggal, atau dua siswa untuk ganda.</p>' +
      EkskulUI.pickerHtml({ id: 'ptd-siswa', siswa: siswaList, selected: editing ? editing.siswa_ids : [], label: 'Pilih atlet' }) +
      '</div>' +
      '<div class="field"><label class="label">Skor per Set <span class="req">*</span></label>' +
      '<div id="skor-sets"></div>' +
      '<button type="button" class="btn btn-secondary btn-sm" id="ptd-tambah-set">' + UI.icon('plus', 16) + 'Tambah Set</button>' +
      '<div class="help">Format angka-angka, misalnya 21-18.</div>' +
      '<div class="field-error" id="ptd-skor-error"></div></div>' +
      '<div class="field"><label class="label" for="ptd-catatan">Catatan (opsional)</label>' +
      '<textarea class="input" id="ptd-catatan" rows="2">' + Utils.esc(editing ? (editing.catatan || '') : '') + '</textarea></div>' +
      '<button type="button" class="btn btn-block" id="ptd-simpan">' + UI.icon('save', 18) +
      (editing ? 'Perbarui Result' : 'Simpan Result') + '</button>' +
      (editing ? '<button type="button" class="btn btn-ghost btn-block mt-1" id="ptd-batal">Batalkan Edit</button>' : '') +
      '</div>';

    // Daftar result + filter
    var f = state.filterPertandingan;
    var siswaScope = scopedStudents();
    var siswaIdSet = {};
    siswaScope.forEach(function (s) {
      siswaIdSet[s.id] = true;
    });
    var daftar = EkskulStore.all('matches').filter(function (m) {
      if (f.dari && m.tanggal < f.dari) return false;
      if (f.sampai && m.tanggal > f.sampai) return false;
      if (f.turnamen && String(m.turnamen).toLowerCase().indexOf(f.turnamen.toLowerCase()) === -1) return false;
      if (f.siswa_id) {
        return (m.siswa_ids || []).indexOf(f.siswa_id) !== -1;
      }
      if (!isSuperadmin()) {
        return (m.siswa_ids || []).some(function (id) {
          return siswaIdSet[id];
        });
      }
      return true;
    }).sort(function (a, b) {
      return a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : 0;
    });

    var rows = daftar.map(function (m) {
      var atlet = (m.siswa_ids || []).map(function (id) {
        var s = EkskulStore.find('students', id);
        return s ? s.nama : '-';
      }).join(' & ');
      return '<td>' + Utils.esc(m.nomor) + '</td>' +
        '<td>' + Utils.esc(Utils.fmtDate(m.tanggal)) + '</td>' +
        '<td>' + Utils.esc(m.turnamen) + '</td>' +
        '<td>' + Utils.esc(m.kategori) + '</td>' +
        '<td>' + Utils.esc(m.lawan) + '</td>' +
        '<td class="align-center">' + UI.statusBadge(m.hasil) + '</td>' +
        '<td>' + Utils.esc(atlet) + '</td>' +
        '<td>' + (m.skor_sets || []).map(function (s) {
          return '<span class="set-skor">' + Utils.esc(s) + '</span>';
        }).join('') + '</td>' +
        '<td class="align-right">' +
        '<button type="button" class="btn btn-sm btn-secondary" data-edit-match="' + Utils.esc(m.id) + '">Edit</button> ' +
        '<button type="button" class="btn btn-sm btn-danger" data-hapus-match="' + Utils.esc(m.id) + '">Hapus</button>' +
        '</td>';
    });

    html += '<div class="card mt-2">' +
      '<div class="card-title">' + UI.icon('trophy', 22) + 'Daftar Result Pertandingan</div>' +
      '<div class="filter-ekskul cols-4 mb-2">' +
      '<div class="field"><label class="label" for="ptd-f-siswa">Siswa</label>' +
      '<select class="input" id="ptd-f-siswa" data-filter="siswa_id">' + siswaOptions(siswaScope, f.siswa_id) + '</select></div>' +
      '<div class="field"><label class="label" for="ptd-f-turnamen">Turnamen</label>' +
      '<input class="input" type="search" id="ptd-f-turnamen" data-filter="turnamen" placeholder="Cari turnamen..." value="' + Utils.esc(f.turnamen) + '"></div>' +
      periodeHtml('ptd-f', f.dari, f.sampai) +
      '</div>' +
      UI.table([
        { label: 'No.' }, { label: 'Tanggal' }, { label: 'Turnamen' }, { label: 'Kategori' },
        { label: 'Lawan' }, { label: 'Hasil', align: 'center' }, { label: 'Atlet' }, { label: 'Skor' },
        { label: 'Aksi', align: 'right' }
      ], rows, { empty: 'Belum ada result pertandingan.' }) +
      '</div>';

    root.innerHTML = html;

    var picker = EkskulUI.bindPicker('ptd-siswa', null);
    skorSetsHtml(editing ? (editing.skor_sets || []) : ['']);
    var tambahSet = root.querySelector('#ptd-tambah-set');
    tambahSet.addEventListener('click', function () {
      var host = root.querySelector('#skor-sets');
      var row = document.createElement('div');
      row.className = 'set-input-row';
      row.innerHTML = '<input class="input" type="text" inputmode="numeric" data-set-input placeholder="contoh: 21-18">' +
        '<button type="button" class="icon-btn" data-hapus-set aria-label="Hapus set">' + UI.icon('trash', 18) + '</button>';
      host.appendChild(row);
      row.querySelector('[data-hapus-set]').addEventListener('click', function () {
        if (host.querySelectorAll('.set-input-row').length <= 1) {
          Utils.toast('Minimal satu set skor.', 'info');
          return;
        }
        row.parentNode.removeChild(row);
      });
      row.querySelector('input').focus();
    });

    root.querySelector('#ptd-tambah-kategori').addEventListener('click', function () {
      var nama = window.prompt('Nama kategori baru (misalnya: Ganda Campuran U15):');
      if (!nama || !nama.trim()) return;
      nama = nama.trim();
      var ada = EkskulStore.findOne('categories', function (c) {
        return c.nama.toLowerCase() === nama.toLowerCase();
      });
      if (ada) {
        Utils.toast('Kategori sudah ada.', 'danger');
        return;
      }
      EkskulStore.insert('categories', { nama: nama, aktif: true });
      Utils.toast('Kategori "' + nama + '" ditambahkan.', 'success');
      pagePertandingan(root);
    });

    var batal = root.querySelector('#ptd-batal');
    if (batal) {
      batal.addEventListener('click', function () {
        state.pertandingan.editId = null;
        pagePertandingan(root);
      });
    }

    root.querySelector('#ptd-simpan').addEventListener('click', UI.preventDouble(function () {
      var nomor = root.querySelector('#ptd-nomor').value.trim();
      var tanggal = root.querySelector('#ptd-tanggal').value;
      var turnamen = root.querySelector('#ptd-turnamen').value.trim();
      var kategori = root.querySelector('#ptd-kategori').value;
      var lawan = root.querySelector('#ptd-lawan').value.trim();
      var hasil = root.querySelector('#ptd-hasil').value;
      var catatan = root.querySelector('#ptd-catatan').value.trim();
      var siswaIds = picker.getSelected();
      var skorErr = root.querySelector('#ptd-skor-error');
      skorErr.textContent = '';

      if (!nomor || !tanggal || !turnamen || !kategori || !lawan) {
        Utils.toast('Semua kolom wajib diisi.', 'danger');
        return;
      }
      if (!siswaIds.length) {
        Utils.toast('Pilih minimal satu atlet (siswa).', 'danger');
        return;
      }
      var sets = [];
      var inputs = root.querySelectorAll('[data-set-input]');
      for (var i = 0; i < inputs.length; i++) {
        var val = inputs[i].value.trim();
        if (!val) continue;
        if (!Utils.isSkorValid(val)) {
          skorErr.textContent = 'Format skor set harus angka-angka, contoh: 21-18.';
          inputs[i].focus();
          return;
        }
        sets.push(val.replace(/\s+/g, ''));
      }
      if (!sets.length) {
        skorErr.textContent = 'Isi minimal satu set skor.';
        return;
      }

      var payload = {
        nomor: nomor,
        tanggal: tanggal,
        turnamen: turnamen,
        kategori: kategori,
        lawan: lawan,
        hasil: hasil,
        siswa_ids: siswaIds,
        skor_sets: sets,
        catatan: catatan
      };

      if (state.pertandingan.editId) {
        EkskulStore.update('matches', state.pertandingan.editId, payload);
        Utils.toast('Result pertandingan diperbarui.', 'success');
        state.pertandingan.editId = null;
      } else {
        EkskulStore.insert('matches', payload);
        Utils.toast('Result pertandingan tersimpan.', 'success');
      }
      pagePertandingan(root);
    }));

    root.querySelectorAll('[data-edit-match]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.pertandingan.editId = btn.getAttribute('data-edit-match');
        pagePertandingan(root);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    root.querySelectorAll('[data-hapus-match]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        UI.confirmDialog('Hapus result pertandingan ini?', 'Konfirmasi Hapus').then(function (ok) {
          if (!ok) return;
          EkskulStore.remove('matches', btn.getAttribute('data-hapus-match'));
          Utils.toast('Result pertandingan dihapus.', 'success');
          pagePertandingan(root);
        });
      });
    });

    var filterHost = root.querySelector('.filter-ekskul');
    if (filterHost) {
      bindFilter(filterHost, function (key, value) {
        f[key] = value;
        pagePertandingan(root);
      });
    }
  }

  /* =====================  PENGGUNA (SUPERADMIN)  ===================== */

  function pagePengguna(root) {
    if (!isSuperadmin()) {
      root.innerHTML = UI.pageHeader('Pengguna', 'Menu ini hanya untuk Superadmin.') +
        '<div class="card">' + UI.emptyState('Anda tidak memiliki akses ke menu ini.', 'alert') + '</div>';
      return;
    }
    var tab = state.penggunaTab;
    var html = UI.pageHeader('Pengguna', 'Kelola sekolah, guru sekolah, pelatih ekskul, dan siswa/siswi.') +
      UI.tabs([
        { id: 'sekolah', label: 'Sekolah' },
        { id: 'guru', label: 'Guru Sekolah' },
        { id: 'pelatih', label: 'Pelatih Ekskul' },
        { id: 'siswa', label: 'Siswa/Siswi' }
      ], tab);

    if (tab === 'sekolah') html += tabSekolah();
    else if (tab === 'guru') html += tabGuru();
    else if (tab === 'pelatih') html += tabPelatih();
    else html += tabSiswa();

    root.innerHTML = html;

    root.querySelectorAll('[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.penggunaTab = btn.getAttribute('data-tab');
        pagePengguna(root);
      });
    });

    if (tab === 'sekolah') bindTabSekolah(root);
    else if (tab === 'guru') bindTabGuru(root);
    else if (tab === 'pelatih') bindTabPelatih(root);
    else bindTabSiswa(root);
  }

  function tabSekolah() {
    var rows = EkskulStore.all('schools').map(function (s) {
      var tone = s.status === 'aktif' ? 'ok' : s.status === 'menunggu' ? 'warn' : s.status === 'ditolak' ? 'danger' : 'muted';
      var label = s.status === 'aktif' ? 'Aktif' : s.status === 'menunggu' ? 'Menunggu' : s.status === 'ditolak' ? 'Ditolak' : 'Nonaktif';
      return '<td><b>' + Utils.esc(s.nama) + '</b><div class="small muted">' + Utils.esc(s.alamat || '-') + '</div></td>' +
        '<td>' + Utils.esc(s.username || '-') + '</td>' +
        '<td class="align-center">' + UI.badge(label, tone) + '</td>' +
        '<td class="align-right">' +
        (s.status === 'menunggu'
          ? '<button type="button" class="btn btn-sm btn-secondary" data-setujui="' + Utils.esc(s.id) + '">Setujui</button> ' +
          '<button type="button" class="btn btn-sm btn-danger" data-tolak="' + Utils.esc(s.id) + '">Tolak</button> '
          : '') +
        '<button type="button" class="btn btn-sm btn-secondary" data-edit-sekolah="' + Utils.esc(s.id) + '">Edit</button> ' +
        '<button type="button" class="btn btn-sm btn-secondary" data-toggle-sekolah="' + Utils.esc(s.id) + '">' +
        (s.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan') + '</button> ' +
        '<button type="button" class="btn btn-sm btn-secondary" data-reset-sekolah="' + Utils.esc(s.id) + '">Reset Kata Sandi</button> ' +
        '<button type="button" class="btn btn-sm btn-danger" data-hapus-sekolah="' + Utils.esc(s.id) + '">Hapus</button>' +
        '</td>';
    });

    return '<div class="card mt-2">' +
      '<div class="page-head"><div><h2 class="page-title">Daftar Sekolah</h2>' +
      '<p class="page-subtitle">Pendaftaran sekolah berstatus "Menunggu" sampai disetujui.</p></div>' +
      '<div class="page-actions"><button type="button" class="btn" data-tambah-sekolah>' + UI.icon('plus', 18) + 'Tambah Sekolah</button></div></div>' +
      UI.table([{ label: 'Sekolah' }, { label: 'Nama Pengguna' }, { label: 'Status', align: 'center' }, { label: 'Aksi', align: 'right' }],
        rows, { empty: 'Belum ada sekolah terdaftar.' }) +
      '</div>';
  }

  function bindTabSekolah(root) {
    root.querySelectorAll('[data-setujui]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        EkskulStore.update('schools', btn.getAttribute('data-setujui'), { status: 'aktif' });
        Utils.toast('Sekolah disetujui. Akunnya kini bisa digunakan untuk masuk.', 'success');
        pagePengguna(root);
      });
    });
    root.querySelectorAll('[data-tolak]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        UI.confirmDialog('Tolak pendaftaran sekolah ini?', 'Konfirmasi Penolakan').then(function (ok) {
          if (!ok) return;
          EkskulStore.update('schools', btn.getAttribute('data-tolak'), { status: 'ditolak' });
          Utils.toast('Pendaftaran sekolah ditolak.', 'success');
          pagePengguna(root);
        });
      });
    });
    root.querySelectorAll('[data-toggle-sekolah]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var s = EkskulStore.find('schools', btn.getAttribute('data-toggle-sekolah'));
        if (!s) return;
        EkskulStore.update('schools', s.id, { status: s.status === 'aktif' ? 'nonaktif' : 'aktif' });
        Utils.toast('Status sekolah diperbarui.', 'success');
        pagePengguna(root);
      });
    });
    root.querySelectorAll('[data-edit-sekolah]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var s = EkskulStore.find('schools', btn.getAttribute('data-edit-sekolah'));
        if (!s) return;
        modalEditSekolah(s, function () { pagePengguna(root); });
      });
    });
    root.querySelectorAll('[data-reset-sekolah]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        modalResetPassword('schools', btn.getAttribute('data-reset-sekolah'), function () { pagePengguna(root); });
      });
    });
    root.querySelectorAll('[data-hapus-sekolah]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-hapus-sekolah');
        var nama = EkskulData.namaSekolah(id);
        UI.confirmDialog('Hapus sekolah "' + nama + '" beserta seluruh data siswa, penilaian, absensi, dan result miliknya?', 'Konfirmasi Hapus').then(function (ok) {
          if (!ok) return;
          EkskulStore.removeWhere('students', function (st) {
            return st.sekolah_id === id;
          });
          EkskulStore.removeWhere('teachers', function (t) {
            return t.sekolah_id === id;
          });
          EkskulStore.remove('schools', id);
          Utils.toast('Sekolah dihapus.', 'success');
          pagePengguna(root);
        });
      });
    });
    var tambah = root.querySelector('[data-tambah-sekolah]');
    if (tambah) {
      tambah.addEventListener('click', function () {
        modalFormSekolah(null, function () { pagePengguna(root); });
      });
    }
  }

  function modalEditSekolah(s, onDone) {
    var body = '<div class="field"><label class="label" for="sk-nama">Nama Sekolah</label>' +
      '<input class="input" type="text" id="sk-nama" value="' + Utils.esc(s.nama) + '"></div>' +
      '<div class="field"><label class="label" for="sk-alamat">Alamat Sekolah</label>' +
      '<input class="input" type="text" id="sk-alamat" value="' + Utils.esc(s.alamat || '') + '"></div>';
    var host = document.getElementById('modal-host');
    host.innerHTML = UI.modalShell('modal-edit-sekolah', 'Edit Sekolah', body,
      '<button type="button" class="btn btn-ghost" data-modal-close="modal-edit-sekolah">Batal</button>' +
      '<button type="button" class="btn" id="sk-simpan">Simpan</button>');
    UI.openModal('modal-edit-sekolah');
    host.querySelector('#sk-simpan').addEventListener('click', UI.preventDouble(function () {
      var nama = host.querySelector('#sk-nama').value.trim();
      var alamat = host.querySelector('#sk-alamat').value.trim();
      if (!nama) {
        Utils.toast('Nama sekolah wajib diisi.', 'danger');
        return;
      }
      EkskulStore.update('schools', s.id, { nama: nama, alamat: alamat });
      Utils.toast('Data sekolah diperbarui.', 'success');
      UI.closeModal('modal-edit-sekolah');
      if (onDone) onDone();
    }));
  }

  function modalFormSekolah(existing, onDone) {
    var body = '<div class="field"><label class="label" for="sk2-nama">Nama Sekolah <span class="req">*</span></label>' +
      '<input class="input" type="text" id="sk2-nama" value="' + Utils.esc(existing ? existing.nama : '') + '"></div>' +
      '<div class="field"><label class="label" for="sk2-alamat">Alamat Sekolah</label>' +
      '<input class="input" type="text" id="sk2-alamat" value="' + Utils.esc(existing ? (existing.alamat || '') : '') + '"></div>' +
      '<div class="field"><label class="label" for="sk2-username">Nama Pengguna <span class="req">*</span></label>' +
      '<input class="input" type="text" id="sk2-username" autocomplete="off" value="' + Utils.esc(existing ? existing.username : '') + '"></div>' +
      (existing ? '' :
        '<div class="field"><label class="label" for="sk2-password">Kata Sandi <span class="req">*</span></label>' +
        '<div class="pw-wrap"><input class="input" type="password" id="sk2-password" autocomplete="new-password">' +
        '<button type="button" class="pw-toggle" data-pw-toggle="sk2-password">Lihat</button></div>' +
        '<div class="help">Minimal 6 karakter.</div></div>') +
      '<div class="field-error" id="sk2-error"></div>';
    var host = document.getElementById('modal-host');
    host.innerHTML = UI.modalShell('modal-form-sekolah', existing ? 'Edit Akun Sekolah' : 'Tambah Sekolah', body,
      '<button type="button" class="btn btn-ghost" data-modal-close="modal-form-sekolah">Batal</button>' +
      '<button type="button" class="btn" id="sk2-simpan">Simpan</button>');
    UI.openModal('modal-form-sekolah');
    bindPwToggle(host);

    host.querySelector('#sk2-simpan').addEventListener('click', UI.preventDouble(function () {
      var nama = host.querySelector('#sk2-nama').value.trim();
      var alamat = host.querySelector('#sk2-alamat').value.trim();
      var username = host.querySelector('#sk2-username').value.trim();
      var err = host.querySelector('#sk2-error');
      err.textContent = '';
      if (!nama || !username) {
        err.textContent = 'Nama sekolah dan nama pengguna wajib diisi.';
        return;
      }
      if (!existing) {
        var password = host.querySelector('#sk2-password').value;
        if (password.length < 6) {
          err.textContent = 'Kata sandi minimal 6 karakter.';
          return;
        }
        if (EkskulData.usernameTaken(username)) {
          err.textContent = 'Nama pengguna sudah dipakai.';
          return;
        }
        var salt = EkskulAuth.makeSalt();
        EkskulAuth.hash(password, salt).then(function (hash) {
          EkskulStore.insert('schools', {
            nama: nama, alamat: alamat,
            username: EkskulAuth.normalizeUsername(username),
            password_hash: hash, password_salt: salt,
            status: 'aktif'
          });
          Utils.toast('Sekolah ditambahkan dan langsung aktif.', 'success');
          UI.closeModal('modal-form-sekolah');
          if (onDone) onDone();
        });
      } else {
        if (EkskulAuth.normalizeUsername(username) !== existing.username && EkskulData.usernameTaken(username)) {
          err.textContent = 'Nama pengguna sudah dipakai.';
          return;
        }
        EkskulStore.update('schools', existing.id, {
          nama: nama, alamat: alamat,
          username: EkskulAuth.normalizeUsername(username)
        });
        Utils.toast('Sekolah diperbarui.', 'success');
        UI.closeModal('modal-form-sekolah');
        if (onDone) onDone();
      }
    }));
  }

  function tabGuru() {
    var rows = EkskulStore.all('teachers').map(function (t) {
      return '<td><b>' + Utils.esc(t.nama) + '</b></td>' +
        '<td>' + Utils.esc(EkskulData.namaSekolah(t.sekolah_id)) + '</td>' +
        '<td>' + Utils.esc(t.username || '-') + '</td>' +
        '<td class="align-center">' + (t.status === 'nonaktif' ? UI.badge('Nonaktif', 'muted') : UI.badge('Aktif', 'ok')) + '</td>' +
        '<td class="align-right">' +
        '<button type="button" class="btn btn-sm btn-secondary" data-edit-guru="' + Utils.esc(t.id) + '">Edit</button> ' +
        '<button type="button" class="btn btn-sm btn-secondary" data-toggle-guru="' + Utils.esc(t.id) + '">' +
        (t.status === 'nonaktif' ? 'Aktifkan' : 'Nonaktifkan') + '</button> ' +
        '<button type="button" class="btn btn-sm btn-secondary" data-reset-guru="' + Utils.esc(t.id) + '">Reset Kata Sandi</button> ' +
        '<button type="button" class="btn btn-sm btn-danger" data-hapus-guru="' + Utils.esc(t.id) + '">Hapus</button>' +
        '</td>';
    });
    return '<div class="card mt-2">' +
      '<div class="page-head"><div><h2 class="page-title">Guru Sekolah</h2>' +
      '<p class="page-subtitle">Akun guru hanya dapat melihat data sekolahnya sendiri.</p></div>' +
      '<div class="page-actions"><button type="button" class="btn" data-tambah-guru>' + UI.icon('plus', 18) + 'Tambah Guru</button></div></div>' +
      UI.table([{ label: 'Nama Guru' }, { label: 'Sekolah' }, { label: 'Nama Pengguna' }, { label: 'Status', align: 'center' }, { label: 'Aksi', align: 'right' }],
        rows, { empty: 'Belum ada akun guru.' }) +
      '</div>';
  }

  function bindTabGuru(root) {
    var tambah = root.querySelector('[data-tambah-guru]');
    if (tambah) tambah.addEventListener('click', function () { modalFormGuru(null, function () { pagePengguna(root); }); });
    root.querySelectorAll('[data-edit-guru]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        modalFormGuru(EkskulStore.find('teachers', btn.getAttribute('data-edit-guru')), function () { pagePengguna(root); });
      });
    });
    root.querySelectorAll('[data-toggle-guru]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var t = EkskulStore.find('teachers', btn.getAttribute('data-toggle-guru'));
        if (!t) return;
        EkskulStore.update('teachers', t.id, { status: t.status === 'nonaktif' ? 'aktif' : 'nonaktif' });
        Utils.toast('Status guru diperbarui.', 'success');
        pagePengguna(root);
      });
    });
    root.querySelectorAll('[data-reset-guru]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        modalResetPassword('teachers', btn.getAttribute('data-reset-guru'), function () { pagePengguna(root); });
      });
    });
    root.querySelectorAll('[data-hapus-guru]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        UI.confirmDialog('Hapus akun guru ini?', 'Konfirmasi Hapus').then(function (ok) {
          if (!ok) return;
          EkskulStore.remove('teachers', btn.getAttribute('data-hapus-guru'));
          Utils.toast('Akun guru dihapus.', 'success');
          pagePengguna(root);
        });
      });
    });
  }

  function modalFormGuru(existing, onDone) {
    var sekolahList = EkskulStore.where('schools', function (s) {
      return s.status === 'aktif';
    });
    var body = '<div class="field"><label class="label" for="gr-nama">Nama Guru <span class="req">*</span></label>' +
      '<input class="input" type="text" id="gr-nama" value="' + Utils.esc(existing ? existing.nama : '') + '"></div>' +
      '<div class="field"><label class="label" for="gr-sekolah">Sekolah <span class="req">*</span></label>' +
      '<select class="input" id="gr-sekolah">' +
      '<option value="">-- Pilih sekolah --</option>' +
      sekolahList.map(function (s) {
        return '<option value="' + Utils.esc(s.id) + '"' + (existing && existing.sekolah_id === s.id ? ' selected' : '') + '>' + Utils.esc(s.nama) + '</option>';
      }).join('') +
      '</select></div>' +
      '<div class="field"><label class="label" for="gr-username">Nama Pengguna <span class="req">*</span></label>' +
      '<input class="input" type="text" id="gr-username" autocomplete="off" value="' + Utils.esc(existing ? existing.username : '') + '"></div>' +
      (existing ? '' :
        '<div class="field"><label class="label" for="gr-password">Kata Sandi <span class="req">*</span></label>' +
        '<div class="pw-wrap"><input class="input" type="password" id="gr-password" autocomplete="new-password">' +
        '<button type="button" class="pw-toggle" data-pw-toggle="gr-password">Lihat</button></div>' +
        '<div class="help">Minimal 6 karakter.</div></div>') +
      '<div class="field-error" id="gr-error"></div>';
    var host = document.getElementById('modal-host');
    host.innerHTML = UI.modalShell('modal-form-guru', existing ? 'Edit Guru Sekolah' : 'Tambah Guru Sekolah', body,
      '<button type="button" class="btn btn-ghost" data-modal-close="modal-form-guru">Batal</button>' +
      '<button type="button" class="btn" id="gr-simpan">Simpan</button>');
    UI.openModal('modal-form-guru');
    bindPwToggle(host);

    host.querySelector('#gr-simpan').addEventListener('click', UI.preventDouble(function () {
      var nama = host.querySelector('#gr-nama').value.trim();
      var sekolahId = host.querySelector('#gr-sekolah').value;
      var username = host.querySelector('#gr-username').value.trim();
      var err = host.querySelector('#gr-error');
      err.textContent = '';
      if (!nama || !sekolahId || !username) {
        err.textContent = 'Semua kolom wajib diisi.';
        return;
      }
      if (!existing) {
        var password = host.querySelector('#gr-password').value;
        if (password.length < 6) {
          err.textContent = 'Kata sandi minimal 6 karakter.';
          return;
        }
        if (EkskulData.usernameTaken(username)) {
          err.textContent = 'Nama pengguna sudah dipakai.';
          return;
        }
        var salt = EkskulAuth.makeSalt();
        EkskulAuth.hash(password, salt).then(function (hash) {
          EkskulStore.insert('teachers', {
            nama: nama,
            sekolah_id: sekolahId,
            username: EkskulAuth.normalizeUsername(username),
            password_hash: hash,
            password_salt: salt,
            status: 'aktif'
          });
          Utils.toast('Akun guru dibuat.', 'success');
          UI.closeModal('modal-form-guru');
          if (onDone) onDone();
        });
      } else {
        if (EkskulAuth.normalizeUsername(username) !== existing.username && EkskulData.usernameTaken(username)) {
          err.textContent = 'Nama pengguna sudah dipakai.';
          return;
        }
        EkskulStore.update('teachers', existing.id, {
          nama: nama, sekolah_id: sekolahId,
          username: EkskulAuth.normalizeUsername(username)
        });
        Utils.toast('Akun guru diperbarui.', 'success');
        UI.closeModal('modal-form-guru');
        if (onDone) onDone();
      }
    }));
  }

  function tabPelatih() {
    var rows = EkskulStore.all('coaches').map(function (c) {
      var sekolah = (c.sekolah_ids || []).map(function (id) {
        return EkskulData.namaSekolah(id);
      }).join(', ');
      return '<td><b>' + Utils.esc(c.nama) + '</b></td>' +
        '<td>' + Utils.esc(c.kontak || '-') + '</td>' +
        '<td>' + Utils.esc(sekolah || '-') + '</td>' +
        '<td class="align-right">' +
        '<button type="button" class="btn btn-sm btn-secondary" data-edit-pelatih="' + Utils.esc(c.id) + '">Edit</button> ' +
        '<button type="button" class="btn btn-sm btn-danger" data-hapus-pelatih="' + Utils.esc(c.id) + '">Hapus</button>' +
        '</td>';
    });
    return '<div class="card mt-2">' +
      '<div class="page-head"><div><h2 class="page-title">Pelatih Ekskul</h2>' +
      '<p class="page-subtitle">Data pelatih ekstrakurikuler dan sekolah yang dilatih.</p></div>' +
      '<div class="page-actions"><button type="button" class="btn" data-tambah-pelatih>' + UI.icon('plus', 18) + 'Tambah Pelatih</button></div></div>' +
      UI.table([{ label: 'Nama Pelatih' }, { label: 'Kontak' }, { label: 'Sekolah yang Dilatih' }, { label: 'Aksi', align: 'right' }],
        rows, { empty: 'Belum ada pelatih ekskul.' }) +
      '</div>';
  }

  function bindTabPelatih(root) {
    var tambah = root.querySelector('[data-tambah-pelatih]');
    if (tambah) tambah.addEventListener('click', function () { modalFormPelatih(null, function () { pagePengguna(root); }); });
    root.querySelectorAll('[data-edit-pelatih]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        modalFormPelatih(EkskulStore.find('coaches', btn.getAttribute('data-edit-pelatih')), function () { pagePengguna(root); });
      });
    });
    root.querySelectorAll('[data-hapus-pelatih]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        UI.confirmDialog('Hapus data pelatih ekskul ini?', 'Konfirmasi Hapus').then(function (ok) {
          if (!ok) return;
          EkskulStore.remove('coaches', btn.getAttribute('data-hapus-pelatih'));
          Utils.toast('Pelatih dihapus.', 'success');
          pagePengguna(root);
        });
      });
    });
  }

  function modalFormPelatih(existing, onDone) {
    var sekolahList = EkskulStore.where('schools', function (s) {
      return s.status === 'aktif';
    });
    var body = '<div class="field"><label class="label" for="ch-nama">Nama Pelatih <span class="req">*</span></label>' +
      '<input class="input" type="text" id="ch-nama" value="' + Utils.esc(existing ? existing.nama : '') + '"></div>' +
      '<div class="field"><label class="label" for="ch-kontak">Kontak (No. HP / Email)</label>' +
      '<input class="input" type="text" id="ch-kontak" value="' + Utils.esc(existing ? (existing.kontak || '') : '') + '"></div>' +
      '<div class="field"><label class="label">Sekolah yang Dilatih</label>' +
      sekolahList.map(function (s) {
        var checked = existing && (existing.sekolah_ids || []).indexOf(s.id) !== -1 ? ' checked' : '';
        return '<label class="picker-item" style="border:1px solid var(--line);border-radius:10px;margin-bottom:6px">' +
          '<input type="checkbox" data-ch-sekolah value="' + Utils.esc(s.id) + '"' + checked + '>' +
          '<span class="picker-info"><b>' + Utils.esc(s.nama) + '</b></span></label>';
      }).join('') +
      '</div>' +
      '<div class="field-error" id="ch-error"></div>';
    var host = document.getElementById('modal-host');
    host.innerHTML = UI.modalShell('modal-form-pelatih', existing ? 'Edit Pelatih Ekskul' : 'Tambah Pelatih Ekskul', body,
      '<button type="button" class="btn btn-ghost" data-modal-close="modal-form-pelatih">Batal</button>' +
      '<button type="button" class="btn" id="ch-simpan">Simpan</button>');
    UI.openModal('modal-form-pelatih');

    host.querySelector('#ch-simpan').addEventListener('click', UI.preventDouble(function () {
      var nama = host.querySelector('#ch-nama').value.trim();
      var kontak = host.querySelector('#ch-kontak').value.trim();
      var ids = [];
      host.querySelectorAll('[data-ch-sekolah]:checked').forEach(function (box) {
        ids.push(box.value);
      });
      if (!nama) {
        host.querySelector('#ch-error').textContent = 'Nama pelatih wajib diisi.';
        return;
      }
      if (existing) {
        EkskulStore.update('coaches', existing.id, { nama: nama, kontak: kontak, sekolah_ids: ids });
        Utils.toast('Data pelatih diperbarui.', 'success');
      } else {
        EkskulStore.insert('coaches', { nama: nama, kontak: kontak, sekolah_ids: ids });
        Utils.toast('Pelatih ekskul ditambahkan.', 'success');
      }
      UI.closeModal('modal-form-pelatih');
      if (onDone) onDone();
    }));
  }

  function tabSiswa() {
    var rows = EkskulStore.all('students').sort(function (a, b) {
      return String(a.nama).localeCompare(String(b.nama));
    }).map(function (s) {
      var punyaAkun = !!(s.username && s.password_hash);
      var toneAkun = s.status === 'nonaktif' ? 'muted' : punyaAkun ? 'ok' : 'warn';
      var labelAkun = s.status === 'nonaktif' ? 'Nonaktif' : punyaAkun ? 'Aktif' : 'Belum punya akun';
      return '<td>' + Utils.esc(s.id_siswa || '-') + '</td>' +
        '<td><b>' + Utils.esc(s.nama) + '</b></td>' +
        '<td>' + Utils.esc(s.kelas) + '</td>' +
        '<td>' + Utils.esc(EkskulData.namaSekolah(s.sekolah_id)) + '</td>' +
        '<td>' + Utils.esc(s.jk || '-') + '</td>' +
        '<td class="align-center">' + Utils.esc(s.usia) + '</td>' +
        '<td>' + Utils.esc(punyaAkun ? s.username : '-') + '</td>' +
        '<td class="align-center">' + UI.badge(labelAkun, toneAkun) + '</td>' +
        '<td class="align-right">' +
        (punyaAkun
          ? '<button type="button" class="btn btn-sm btn-secondary" data-edit-akun-siswa="' + Utils.esc(s.id) + '">Edit Akun</button> ' +
          '<button type="button" class="btn btn-sm btn-secondary" data-toggle-siswa="' + Utils.esc(s.id) + '">' +
          (s.status === 'nonaktif' ? 'Aktifkan' : 'Nonaktifkan') + '</button> ' +
          '<button type="button" class="btn btn-sm btn-secondary" data-reset-siswa="' + Utils.esc(s.id) + '">Reset Kata Sandi</button> '
          : '<button type="button" class="btn btn-sm" data-buat-akun-siswa="' + Utils.esc(s.id) + '">Buat Akun</button> ') +
        '<button type="button" class="btn btn-sm btn-secondary" data-edit-siswa="' + Utils.esc(s.id) + '">Edit / Pindah</button> ' +
        '<button type="button" class="btn btn-sm btn-danger" data-hapus-siswa="' + Utils.esc(s.id) + '">Hapus</button>' +
        '</td>';
    });
    return '<div class="card mt-2">' +
      '<div class="page-head"><div><h2 class="page-title">Siswa/Siswi</h2>' +
        '<p class="page-subtitle">Siswa tanpa akun diberi status "Belum punya akun" — Superadmin bisa membuat akun login lewat tombol Buat Akun.</p></div>' +
      '<div class="page-actions"><button type="button" class="btn" data-tambah-siswa>' + UI.icon('plus', 18) + 'Tambah Siswa</button></div></div>' +
      UI.table([
        { label: 'ID' }, { label: 'Nama' }, { label: 'Kelas' }, { label: 'Sekolah' },
        { label: 'JK' }, { label: 'Usia', align: 'center' }, { label: 'Nama Pengguna' },
        { label: 'Akun', align: 'center' }, { label: 'Aksi', align: 'right' }
      ], rows, { empty: 'Belum ada siswa terdaftar.' }) +
      '</div>';
  }

  function bindTabSiswa(root) {
    var tambah = root.querySelector('[data-tambah-siswa]');
    if (tambah) tambah.addEventListener('click', function () { modalFormSiswa(null, function () { pagePengguna(root); }); });
    root.querySelectorAll('[data-edit-siswa]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        modalFormSiswa(EkskulStore.find('students', btn.getAttribute('data-edit-siswa')), function () { pagePengguna(root); });
      });
    });
    root.querySelectorAll('[data-buat-akun-siswa]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        modalAkunSiswa(EkskulStore.find('students', btn.getAttribute('data-buat-akun-siswa')), function () { pagePengguna(root); });
      });
    });
    root.querySelectorAll('[data-edit-akun-siswa]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        modalAkunSiswa(EkskulStore.find('students', btn.getAttribute('data-edit-akun-siswa')), function () { pagePengguna(root); });
      });
    });
    root.querySelectorAll('[data-toggle-siswa]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var st = EkskulStore.find('students', btn.getAttribute('data-toggle-siswa'));
        if (!st) return;
        EkskulStore.update('students', st.id, { status: st.status === 'nonaktif' ? 'aktif' : 'nonaktif' });
        Utils.toast('Status akun siswa diperbarui.', 'success');
        pagePengguna(root);
      });
    });
    root.querySelectorAll('[data-reset-siswa]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        modalResetPassword('students', btn.getAttribute('data-reset-siswa'), function () { pagePengguna(root); });
      });
    });
    root.querySelectorAll('[data-hapus-siswa]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var s = EkskulStore.find('students', btn.getAttribute('data-hapus-siswa'));
        if (!s) return;
        UI.confirmDialog('Hapus siswa "' + s.nama + '" beserta seluruh penilaian, absensi, dan keterangannya di result pertandingan?', 'Konfirmasi Hapus').then(function (ok) {
          if (!ok) return;
          EkskulData.hapusDataSiswa(s.id);
          EkskulStore.removeWhere('matches', function (m) {
            return (m.siswa_ids || []).indexOf(s.id) !== -1;
          });
          EkskulStore.remove('students', s.id);
          Utils.toast('Siswa dihapus.', 'success');
          pagePengguna(root);
        });
      });
    });
  }

  // Buat / edit akun login siswa (nama pengguna + kata sandi) oleh Superadmin.
  function modalAkunSiswa(siswa, onDone) {
    if (!siswa) return;
    var baru = !(siswa.username && siswa.password_hash);
    var body = '<p class="hint-kecil">ID siswa <b>' + Utils.esc(siswa.id_siswa || '-') + '</b> juga bisa dipakai untuk masuk selain nama pengguna.</p>' +
      '<div class="field"><label class="label" for="sa-username">Nama Pengguna <span class="req">*</span></label>' +
      '<input class="input" type="text" id="sa-username" autocomplete="off" value="' + Utils.esc(baru ? '' : siswa.username) + '"></div>' +
      '<div class="field"><label class="label" for="sa-password">Kata Sandi <span class="req">*</span></label>' +
      '<div class="pw-wrap"><input class="input" type="password" id="sa-password" autocomplete="new-password"' + (baru ? '' : ' placeholder="Kosongkan bila tidak diganti"') + '>' +
      '<button type="button" class="pw-toggle" data-pw-toggle="sa-password">Lihat</button></div>' +
      '<div class="help">Minimal 6 karakter' + (baru ? '.' : ', atau kosongkan bila tidak ingin mengganti.') + '</div></div>' +
      (baru
        ? '<div class="field"><label class="label" for="sa-password2">Ulangi Kata Sandi <span class="req">*</span></label>' +
        '<input class="input" type="password" id="sa-password2" autocomplete="new-password"></div>'
        : '') +
      '<div class="field-error" id="sa-error"></div>';
    var host = document.getElementById('modal-host');
    host.innerHTML = UI.modalShell('modal-akun-siswa', baru ? 'Buat Akun Siswa' : 'Edit Akun Siswa', body,
      '<button type="button" class="btn btn-ghost" data-modal-close="modal-akun-siswa">Batal</button>' +
      '<button type="button" class="btn" id="sa-simpan">Simpan</button>');
    UI.openModal('modal-akun-siswa');
    bindPwToggle(host);

    host.querySelector('#sa-simpan').addEventListener('click', UI.preventDouble(function () {
      var username = host.querySelector('#sa-username').value.trim();
      var password = host.querySelector('#sa-password').value;
      var err = host.querySelector('#sa-error');
      err.textContent = '';
      if (!username) {
        err.textContent = 'Nama pengguna wajib diisi.';
        return;
      }
      if (EkskulAuth.normalizeUsername(username) !== siswa.username && EkskulData.usernameTaken(username)) {
        err.textContent = 'Nama pengguna sudah dipakai atau tidak boleh dipakai.';
        return;
      }
      var patch = { username: EkskulAuth.normalizeUsername(username) };
      function simpan() {
        EkskulStore.update('students', siswa.id, patch);
        Utils.toast(baru ? 'Akun siswa dibuat.' : 'Akun siswa diperbarui.', 'success');
        UI.closeModal('modal-akun-siswa');
        if (onDone) onDone();
      }
      if (!password) {
        if (baru) {
          err.textContent = 'Kata sandi wajib diisi.';
          return;
        }
        simpan();
        return;
      }
      if (password.length < 6) {
        err.textContent = 'Kata sandi minimal 6 karakter.';
        return;
      }
      var pass2 = host.querySelector('#sa-password2');
      if (pass2 && pass2.value !== password) {
        err.textContent = 'Ketikan kata sandi tidak sama.';
        return;
      }
      var salt = EkskulAuth.makeSalt();
      EkskulAuth.hash(password, salt).then(function (hash) {
        patch.password_hash = hash;
        patch.password_salt = salt;
        if (baru) patch.status = 'aktif';
        simpan();
      });
    }));
  }

  function modalFormSiswa(existing, onDone) {
    var sekolahList = EkskulStore.where('schools', function (s) {
      return s.status === 'aktif';
    });
    var body = '<div class="form-grid cols-2">' +
      '<div class="field"><label class="label" for="sw-nama">Nama <span class="req">*</span></label>' +
      '<input class="input" type="text" id="sw-nama" value="' + Utils.esc(existing ? existing.nama : '') + '"></div>' +
      '<div class="field"><label class="label" for="sw-kelas">Kelas <span class="req">*</span></label>' +
      '<input class="input" type="text" id="sw-kelas" placeholder="contoh: 8A" value="' + Utils.esc(existing ? existing.kelas : '') + '"></div>' +
      '<div class="field"><label class="label" for="sw-jk">Jenis Kelamin <span class="req">*</span></label>' +
      '<select class="input" id="sw-jk">' +
      '<option value="">-- Pilih --</option>' +
      EkskulConfig.GENDER.map(function (g) {
        return '<option value="' + Utils.esc(g) + '"' + (existing && existing.jk === g ? ' selected' : '') + '>' + Utils.esc(g) + '</option>';
      }).join('') +
      '</select></div>' +
      '<div class="field"><label class="label" for="sw-usia">Usia <span class="req">*</span></label>' +
      '<input class="input" type="number" id="sw-usia" min="' + EkskulConfig.USIA_MIN + '" max="' + EkskulConfig.USIA_MAX + '" step="1" value="' + Utils.esc(existing ? existing.usia : '') + '"></div>' +
      '</div>' +
      '<div class="field"><label class="label" for="sw-sekolah">Sekolah <span class="req">*</span></label>' +
      '<select class="input" id="sw-sekolah">' +
      '<option value="">-- Pilih sekolah --</option>' +
      sekolahList.map(function (s) {
        return '<option value="' + Utils.esc(s.id) + '"' + (existing && existing.sekolah_id === s.id ? ' selected' : '') + '>' + Utils.esc(s.nama) + '</option>';
      }).join('') +
      '</select></div>' +
      '<div class="field-error" id="sw-error"></div>';
    var host = document.getElementById('modal-host');
    host.innerHTML = UI.modalShell('modal-form-siswa', existing ? 'Edit Siswa/Siswi' : 'Tambah Siswa/Siswi', body,
      '<button type="button" class="btn btn-ghost" data-modal-close="modal-form-siswa">Batal</button>' +
      '<button type="button" class="btn" id="sw-simpan">Simpan</button>');
    UI.openModal('modal-form-siswa');

    host.querySelector('#sw-simpan').addEventListener('click', UI.preventDouble(function () {
      var nama = host.querySelector('#sw-nama').value.trim();
      var kelas = host.querySelector('#sw-kelas').value.trim();
      var jk = host.querySelector('#sw-jk').value;
      var usia = Number(host.querySelector('#sw-usia').value);
      var sekolahId = host.querySelector('#sw-sekolah').value;
      var err = host.querySelector('#sw-error');
      err.textContent = '';
      if (!nama || !kelas || !jk || !sekolahId) {
        err.textContent = 'Semua kolom wajib diisi.';
        return;
      }
      if (!isFinite(usia) || Math.floor(usia) !== usia || usia < EkskulConfig.USIA_MIN || usia > EkskulConfig.USIA_MAX) {
        err.textContent = 'Usia harus bilangan bulat antara ' + EkskulConfig.USIA_MIN + ' dan ' + EkskulConfig.USIA_MAX + '.';
        return;
      }
      if (existing) {
        EkskulStore.update('students', existing.id, {
          nama: nama, kelas: kelas, jk: jk, usia: usia, sekolah_id: sekolahId
        });
        Utils.toast('Data siswa diperbarui.', 'success');
        UI.closeModal('modal-form-siswa');
        if (onDone) onDone();
      } else {
        EkskulStore.insert('students', {
          id_siswa: EkskulStore.nextSiswaId(),
          nama: nama, kelas: kelas, jk: jk, usia: usia,
          sekolah_id: sekolahId, status: 'aktif'
        });
        Utils.toast('Siswa ditambahkan.', 'success');
        UI.closeModal('modal-form-siswa');
        if (onDone) onDone();
      }
    }));
  }

  function modalResetPassword(collection, id, onDone) {
    var host = document.getElementById('modal-host');
    var body = '<p class="hint-kecil">Masukkan kata sandi baru (minimal 6 karakter). Kata sandi disimpan dalam bentuk hash.</p>' +
      '<div class="field"><label class="label" for="rp-pass">Kata Sandi Baru <span class="req">*</span></label>' +
      '<div class="pw-wrap"><input class="input" type="password" id="rp-pass" autocomplete="new-password">' +
      '<button type="button" class="pw-toggle" data-pw-toggle="rp-pass">Lihat</button></div></div>' +
      '<div class="field"><label class="label" for="rp-pass2">Ulangi Kata Sandi <span class="req">*</span></label>' +
      '<input class="input" type="password" id="rp-pass2" autocomplete="new-password"></div>' +
      '<div class="field-error" id="rp-error"></div>';
    host.innerHTML = UI.modalShell('modal-reset-password', 'Reset Kata Sandi', body,
      '<button type="button" class="btn btn-ghost" data-modal-close="modal-reset-password">Batal</button>' +
      '<button type="button" class="btn" id="rp-simpan">Simpan</button>');
    UI.openModal('modal-reset-password');
    bindPwToggle(host);

    host.querySelector('#rp-simpan').addEventListener('click', UI.preventDouble(function () {
      var p1 = host.querySelector('#rp-pass').value;
      var p2 = host.querySelector('#rp-pass2').value;
      var err = host.querySelector('#rp-error');
      err.textContent = '';
      if (p1.length < 6) {
        err.textContent = 'Kata sandi minimal 6 karakter.';
        return;
      }
      if (p1 !== p2) {
        err.textContent = 'Ketikan kata sandi tidak sama.';
        return;
      }
      var item = EkskulStore.find(collection, id);
      if (!item) return;
      var salt = item.password_salt || EkskulAuth.makeSalt();
      EkskulAuth.hash(p1, salt).then(function (hash) {
        EkskulStore.update(collection, id, {
          password_hash: hash,
          password_salt: salt
        });
        Utils.toast('Kata sandi berhasil direset.', 'success');
        UI.closeModal('modal-reset-password');
        if (onDone) onDone();
      });
    }));
  }

  function bindPwToggle(scope) {
    (scope || document).querySelectorAll('[data-pw-toggle]').forEach(function (btn) {
      if (btn.getAttribute('data-bound')) return;
      btn.setAttribute('data-bound', '1');
      btn.addEventListener('click', function () {
        var input = document.getElementById(btn.getAttribute('data-pw-toggle'));
        if (!input) return;
        if (input.type === 'password') {
          input.type = 'text';
          btn.textContent = 'Sembunyi';
        } else {
          input.type = 'password';
          btn.textContent = 'Lihat';
        }
      });
    });
  }

  /* =====================  HALAMAN VIEWER (SEKOLAH / GURU)  ============== */

  function pagePenilaianView(root) {
    var f = state.filterPenilaian;
    var siswaList = scopedStudents();
    var dipilih;
    if (isSiswa()) {
      // Siswa/siswi selalu melihat datanya sendiri.
      dipilih = siswaList;
    } else {
      dipilih = f.siswa_id ? studentsByIds([f.siswa_id]) : siswaList;
      // Pastikan siswa yang dipilih benar-benar milik sekolah ini.
      var sekolahId = session().sekolah_id;
      dipilih = dipilih.filter(function (s) {
        return s.sekolah_id === sekolahId;
      });
    }

    var hasil = EkskulHitung.ringkasanPenilaian(dipilih, f.dari, f.sampai);

    var html = UI.pageHeader(isSiswa() ? 'Penilaian Saya' : 'Penilaian Latihan',
      'Nilai ditampilkan dalam persentase (nilai / 10 × 100).') +
      (isSiswa()
        ? identitasSiswaHtml()
        : '<div class="card">' +
      '<div class="card-title">' + UI.icon('search', 22) + 'Filter</div>' +
      '<div class="filter-ekskul cols-3">' +
      '<div class="field"><label class="label" for="pv-siswa">Siswa/Siswi</label>' +
      '<select class="input" id="pv-siswa" data-filter="siswa_id">' + siswaOptions(siswaList, f.siswa_id, '-- Semua siswa --') + '</select></div>' +
      periodeHtml('pv', f.dari, f.sampai) +
      '</div></div>');

    html += '<div class="card mt-2">' +
      '<div class="nilai-besar">' +
      '<div class="angka">' + (hasil.keseluruhan === null ? '—' : hasil.keseluruhan + '%') + '</div>' +
      '<div class="ket">Persentase Keseluruhan (rata-rata Teknik, Fisik, Kedisiplinan)</div>' +
      '</div>' +
      '<h3 class="mb-1">Persentase per Kategori</h3>' +
      hasil.per_kategori.map(function (k) {
        return EkskulUI.barPercent(k.nama, k.persen);
      }).join('') +
      '</div>';

    ['teknik', 'fisik', 'kedisiplinan'].forEach(function (kat) {
      var items = hasil.per_parameter.filter(function (p) {
        return p.kategori === kat;
      });
      if (!items.length) return;
      html += '<div class="card mt-2">' +
        '<div class="card-title">' + UI.icon('activity', 22) + EkskulConfig.KATEGORI_PARAM[kat] + '</div>' +
        items.map(function (p) {
          return EkskulUI.barPercent(p.nama + (p.aktif ? '' : ' (nonaktif)'), p.persen, { kosong: 'Belum ada nilai.' });
        }).join('') +
        '</div>';
    });

    html += '<div class="card mt-2">' +
      '<div class="card-title">' + UI.icon('chart', 22) + 'Tren per Minggu</div>' +
      '<div class="chart-box tall"><canvas id="pv-tren"></canvas></div>' +
      (hasil.tren_mingguan.length ? '' : '<p class="muted small mb-0">Belum ada data untuk ditampilkan.</p>') +
      '</div>';

    var riwayat = [];
    dipilih.forEach(function (s) {
      EkskulData.penilaianSiswa(s.id, f.dari, f.sampai).forEach(function (a) {
        riwayat.push({ a: a, s: s });
      });
    });
    riwayat.sort(function (x, y) {
      return x.a.tanggal < y.a.tanggal ? 1 : x.a.tanggal > y.a.tanggal ? -1 : 0;
    });
    html += '<div class="card mt-2">' +
      '<div class="card-title">' + UI.icon('clipboard', 22) + 'Riwayat Penilaian</div>' +
      UI.table([
        { label: 'Tanggal' }, { label: 'Siswa' }, { label: 'Rata-rata' }
      ], riwayat.map(function (row) {
        var values = row.a.values || {};
        var persens = [];
        Object.keys(values).forEach(function (pid) {
          var v = Number(values[pid]);
          if (isFinite(v)) persens.push(EkskulHitung.pctNilai(v));
        });
        if (row.a.kedisiplinan !== undefined && row.a.kedisiplinan !== null && row.a.kedisiplinan !== '') {
          var kv = Number(row.a.kedisiplinan);
          if (isFinite(kv)) persens.push(EkskulHitung.pctNilai(kv));
        }
        var rataPct = EkskulHitung.bulat(EkskulHitung.rata(persens), 1);
        return '<td>' + Utils.esc(Utils.fmtDate(row.a.tanggal)) + '</td>' +
          '<td>' + Utils.esc(row.s.nama) + '</td>' +
          '<td class="align-center">' + (rataPct === null ? '—' : EkskulUI.pctBadge(rataPct)) + '</td>';
      }), { empty: 'Belum ada penilaian.' }) +
      '</div>';

    root.innerHTML = html;

    bindFilter(root.querySelector('.filter-ekskul'), function (key, value) {
      f[key] = value;
      pagePenilaianView(root);
    });

    if (hasil.tren_mingguan.length) {
      var canvas = root.querySelector('#pv-tren');
      EkskulUI.drawLine(canvas,
        hasil.tren_mingguan.map(function (t) { return t.label; }),
        [{ label: 'Persentase keseluruhan (%)', data: hasil.tren_mingguan.map(function (t) { return t.persen; }), color: '#0b3d91' }],
        { min: 0, max: 100, noLegend: true, yTitle: 'Persentase (%)', xTitle: 'Minggu' });
    }
  }

  function pageAbsensiView(root) {
    var f = state.filterAbsensi;
    var siswaList = scopedStudents();
    var dipilih;
    if (isSiswa()) {
      dipilih = siswaList;
    } else {
      dipilih = f.siswa_id ? studentsByIds([f.siswa_id]) : siswaList;
      var sekolahId = session().sekolah_id;
      dipilih = dipilih.filter(function (s) {
        return s.sekolah_id === sekolahId;
      });
    }

    var hasil = EkskulHitung.ringkasanAbsensi(dipilih, f.dari, f.sampai);

    var html = UI.pageHeader(isSiswa() ? 'Kehadiran Saya' : 'Absensi Siswa/Siswi',
      'Persentase kehadiran = Hadir / total pertemuan × 100.') +
      (isSiswa()
        ? '<div class="card">' +
      '<div class="card-title">' + UI.icon('calendar', 22) + 'Filter Periode</div>' +
      '<div class="filter-ekskul cols-2">' + periodeHtml('av', f.dari, f.sampai) + '</div></div>'
        : '<div class="card">' +
      '<div class="card-title">' + UI.icon('search', 22) + 'Filter</div>' +
      '<div class="filter-ekskul cols-3">' +
      '<div class="field"><label class="label" for="av-siswa">Siswa/Siswi</label>' +
      '<select class="input" id="av-siswa" data-filter="siswa_id">' + siswaOptions(siswaList, f.siswa_id) + '</select></div>' +
      periodeHtml('av', f.dari, f.sampai) +
      '</div></div>');

    html += '<div class="card mt-2">' +
      '<div class="nilai-besar">' +
      '<div class="angka">' + (hasil.keseluruhan === null ? '—' : hasil.keseluruhan + '%') + '</div>' +
      '<div class="ket">Persentase Kehadiran Keseluruhan</div>' +
      '</div>' +
      '<div class="kpi-grid">' +
      '<div class="kpi-card"><div class="kpi-angka">' + hasil.rekap.Hadir + '</div><div class="kpi-label">Hadir</div></div>' +
      '<div class="kpi-card"><div class="kpi-angka">' + hasil.rekap.Izin + '</div><div class="kpi-label">Izin</div></div>' +
      '<div class="kpi-card"><div class="kpi-angka">' + hasil.rekap.Sakit + '</div><div class="kpi-label">Sakit</div></div>' +
      '<div class="kpi-card accent"><div class="kpi-angka">' + hasil.rekap['Tidak Hadir'] + '</div><div class="kpi-label">Tidak Hadir</div></div>' +
      '</div></div>';

    html += '<div class="card mt-2">' +
      '<div class="card-title">' + UI.icon('users', 22) + 'Kehadiran per Siswa</div>' +
      UI.table([
        { label: 'Siswa' }, { label: 'Kelas' }, { label: 'Hadir', align: 'center' },
        { label: 'Izin', align: 'center' }, { label: 'Sakit', align: 'center' },
        { label: 'Tidak Hadir', align: 'center' }, { label: 'Persentase', align: 'center' }
      ], hasil.per_siswa.map(function (row) {
        if (!row.total) {
          return '<td>' + Utils.esc(row.siswa.nama) + '</td><td>' + Utils.esc(row.siswa.kelas) + '</td>' +
            '<td colspan="5" class="align-center muted">Belum ada data absensi</td>';
        }
        return '<td>' + Utils.esc(row.siswa.nama) + '</td>' +
          '<td>' + Utils.esc(row.siswa.kelas) + '</td>' +
          '<td class="align-center">' + row.Hadir + '</td>' +
          '<td class="align-center">' + row.Izin + '</td>' +
          '<td class="align-center">' + row.Sakit + '</td>' +
          '<td class="align-center">' + row['Tidak Hadir'] + '</td>' +
          '<td class="align-center">' + EkskulUI.pctBadge(row.persen) + '</td>';
      }), { empty: 'Belum ada data absensi.' }) +
      '</div>';

    root.innerHTML = html;

    bindFilter(root.querySelector('.filter-ekskul'), function (key, value) {
      f[key] = value;
      pageAbsensiView(root);
    });
  }

  function pagePertandinganView(root) {
    var f = state.filterPertandingan;
    var siswaList = scopedStudents();
    var sekolahId = session().sekolah_id;
    var siswaIdSet = {};
    siswaList.forEach(function (s) {
      if (s.sekolah_id === sekolahId) siswaIdSet[s.id] = true;
    });

    var daftar = EkskulStore.where('matches', function (m) {
      if (f.dari && m.tanggal < f.dari) return false;
      if (f.sampai && m.tanggal > f.sampai) return false;
      if (f.turnamen && String(m.turnamen).toLowerCase().indexOf(f.turnamen.toLowerCase()) === -1) return false;
      if (f.siswa_id) return (m.siswa_ids || []).indexOf(f.siswa_id) !== -1;
      return (m.siswa_ids || []).some(function (id) {
        return siswaIdSet[id];
      });
    }).sort(function (a, b) {
      return a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : 0;
    });

    var menang = 0;
    var kalah = 0;
    daftar.forEach(function (m) {
      if (m.hasil === 'Menang') menang++;
      else if (m.hasil === 'Kalah') kalah++;
    });

    var html = UI.pageHeader(isSiswa() ? 'Pertandingan Saya' : 'Result Pertandingan',
      isSiswa() ? 'Daftar hasil pertandingan Anda.' : 'Daftar hasil pertandingan siswa/siswi sekolah ini.') +
      '<div class="card">' +
      '<div class="card-title">' + UI.icon('search', 22) + 'Filter</div>' +
      '<div class="filter-ekskul ' + (isSiswa() ? 'cols-3' : 'cols-4') + '">' +
      (isSiswa() ? '' :
        '<div class="field"><label class="label" for="pvv-siswa">Siswa</label>' +
        '<select class="input" id="pvv-siswa" data-filter="siswa_id">' + siswaOptions(siswaList, f.siswa_id) + '</select></div>') +
      '<div class="field"><label class="label" for="pvv-turnamen">Turnamen</label>' +
      '<input class="input" type="search" id="pvv-turnamen" data-filter="turnamen" placeholder="Cari turnamen..." value="' + Utils.esc(f.turnamen) + '"></div>' +
      periodeHtml('pvv', f.dari, f.sampai) +
      '</div></div>';

    html += '<div class="card mt-2">' +
      '<div class="kpi-grid">' +
      '<div class="kpi-card"><div class="kpi-angka">' + daftar.length + '</div><div class="kpi-label">Total Pertandingan</div></div>' +
      '<div class="kpi-card"><div class="kpi-angka">' + menang + '</div><div class="kpi-label">Menang</div></div>' +
      '<div class="kpi-card accent"><div class="kpi-angka">' + kalah + '</div><div class="kpi-label">Kalah</div></div>' +
      '</div></div>';

    var rows = daftar.map(function (m) {
      var atlet = (m.siswa_ids || []).map(function (id) {
        var s = EkskulStore.find('students', id);
        return s ? s.nama : '-';
      }).join(' & ');
      return '<td>' + Utils.esc(m.nomor) + '</td>' +
        '<td>' + Utils.esc(Utils.fmtDate(m.tanggal)) + '</td>' +
        '<td>' + Utils.esc(m.turnamen) + '</td>' +
        '<td>' + Utils.esc(m.kategori) + '</td>' +
        '<td>' + Utils.esc(m.lawan) + '</td>' +
        '<td class="align-center">' + UI.statusBadge(m.hasil) + '</td>' +
        '<td>' + Utils.esc(atlet) + '</td>' +
        '<td class="align-right"><button type="button" class="btn btn-sm btn-secondary" data-detail-match="' + Utils.esc(m.id) + '">Detail</button></td>';
    });

    html += '<div class="card mt-2">' +
      '<div class="card-title">' + UI.icon('trophy', 22) + 'Daftar Pertandingan</div>' +
      UI.table([
        { label: 'No.' }, { label: 'Tanggal' }, { label: 'Turnamen' }, { label: 'Kategori' },
        { label: 'Lawan' }, { label: 'Hasil', align: 'center' }, { label: 'Atlet' }, { label: 'Detail', align: 'right' }
      ], rows, { empty: 'Belum ada result pertandingan.' }) +
      '</div>';

    root.innerHTML = html;

    bindFilter(root.querySelector('.filter-ekskul'), function (key, value) {
      f[key] = value;
      pagePertandinganView(root);
    });

    root.querySelectorAll('[data-detail-match]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var m = EkskulStore.find('matches', btn.getAttribute('data-detail-match'));
        if (!m) return;
        var atlet = (m.siswa_ids || []).map(function (id) {
          var s = EkskulStore.find('students', id);
          return s ? s.nama + ' (' + (s.id_siswa || '') + ')' : '-';
        }).join(', ');
        var body = '<div class="list-rows">' +
          '<div class="list-row"><div class="grow"><b>Nomor</b><span>' + Utils.esc(m.nomor) + '</span></div></div>' +
          '<div class="list-row"><div class="grow"><b>Tanggal</b><span>' + Utils.esc(Utils.fmtDate(m.tanggal, true)) + '</span></div></div>' +
          '<div class="list-row"><div class="grow"><b>Turnamen</b><span>' + Utils.esc(m.turnamen) + '</span></div></div>' +
          '<div class="list-row"><div class="grow"><b>Kategori</b><span>' + Utils.esc(m.kategori) + '</span></div></div>' +
          '<div class="list-row"><div class="grow"><b>Lawan</b><span>' + Utils.esc(m.lawan) + '</span></div></div>' +
          '<div class="list-row"><div class="grow"><b>Hasil</b><span>' + Utils.esc(m.hasil) + '</span></div></div>' +
          '<div class="list-row"><div class="grow"><b>Atlet</b><span>' + Utils.esc(atlet) + '</span></div></div>' +
          '<div class="list-row"><div class="grow"><b>Skor per Set</b><span>' +
          (m.skor_sets || []).map(function (s) {
            return '<span class="set-skor">' + Utils.esc(s) + '</span>';
          }).join('') + '</span></div></div>' +
          (m.catatan ? '<div class="list-row"><div class="grow"><b>Catatan</b><span>' + Utils.esc(m.catatan) + '</span></div></div>' : '') +
          '</div>';
        var host = document.getElementById('modal-host');
        host.innerHTML = UI.modalShell('modal-detail-match', 'Detail Pertandingan', body,
          '<button type="button" class="btn" data-modal-close="modal-detail-match">Tutup</button>');
        UI.openModal('modal-detail-match');
      });
    });
  }

  /* =====================  BERANDA / DASHBOARD  ===================== */

  function pageHome(root) {
    if (isSuperadmin()) return pageHomeSuperadmin(root);
    return pageHomeViewer(root);
  }

  function pageHomeSuperadmin(root) {
    var f = state.filterHome;
    var semuaSekolah = EkskulStore.all('schools');
    var sekolahAktif = semuaSekolah.filter(function (s) {
      return s.status === 'aktif';
    });
    var totalGuru = EkskulStore.where('teachers', function (t) {
      return t.status !== 'nonaktif';
    }).length;
    var semuaSiswa = EkskulStore.where('students', function (s) {
      return s.status !== 'nonaktif';
    });

    var siswaScope = f.siswa_id
      ? studentsByIds([f.siswa_id])
      : (f.sekolah_id
        ? semuaSiswa.filter(function (s) { return s.sekolah_id === f.sekolah_id; })
        : semuaSiswa);
    var sekolahScope = f.sekolah_id ? semuaSekolah.filter(function (s) { return s.id === f.sekolah_id; }) : sekolahAktif;

    var penilaian = EkskulHitung.ringkasanPenilaian(siswaScope, f.dari, f.sampai);
    var absensi = EkskulHitung.ringkasanAbsensi(siswaScope, f.dari, f.sampai);
    var pertandingan = EkskulHitung.ringkasanPertandingan(siswaScope, f.dari, f.sampai);

    var html = UI.pageHeader('Dashboard Superadmin', 'Ringkasan seluruh sekolah binaan ekstrakurikuler.') +
      '<div class="card">' +
      '<div class="card-title">' + UI.icon('search', 22) + 'Filter</div>' +
      '<div class="filter-ekskul cols-4">' +
      '<div class="field"><label class="label" for="hs-sekolah">Sekolah</label>' +
      '<select class="input" id="hs-sekolah" data-filter="sekolah_id">' + sekolahOptions(f.sekolah_id, true) + '</select></div>' +
      '<div class="field"><label class="label" for="hs-siswa">Siswa</label>' +
      '<select class="input" id="hs-siswa" data-filter="siswa_id">' + siswaOptions(siswaScope, f.siswa_id) + '</select></div>' +
      periodeHtml('hs', f.dari, f.sampai) +
      '</div></div>';

    html += '<div class="kpi-grid mt-2">' +
      '<div class="kpi-card"><div class="kpi-angka">' + sekolahScope.length + '</div><div class="kpi-label">Sekolah' + (f.sekolah_id ? ' Terpilih' : ' Aktif') + '</div></div>' +
      '<div class="kpi-card"><div class="kpi-angka">' + totalGuru + '</div><div class="kpi-label">Guru Sekolah</div></div>' +
      '<div class="kpi-card"><div class="kpi-angka">' + siswaScope.length + '</div><div class="kpi-label">Siswa/Siswi</div></div>' +
      '<div class="kpi-card"><div class="kpi-angka">' + (penilaian.keseluruhan === null ? '—' : penilaian.keseluruhan + '%') + '</div><div class="kpi-label">Rata-rata Nilai Keseluruhan</div></div>' +
      '<div class="kpi-card"><div class="kpi-angka">' + (absensi.keseluruhan === null ? '—' : absensi.keseluruhan + '%') + '</div><div class="kpi-label">Persentase Kehadiran</div></div>' +
      '<div class="kpi-card accent"><div class="kpi-angka">' + pertandingan.jumlah + '</div><div class="kpi-label">Pertandingan (' +
      (pertandingan.rasio_menang === null ? '—' : pertandingan.rasio_menang + '% menang') + ')</div></div>' +
      '</div>';

    html += '<div class="card mt-2">' +
      '<div class="card-title">' + UI.icon('chart', 22) + 'Penilaian per Kategori</div>' +
      penilaian.per_kategori.map(function (k) {
        return EkskulUI.barPercent(k.nama, k.persen);
      }).join('') +
      '</div>';

    var paramAktif = penilaian.per_parameter.filter(function (p) {
      return p.kategori === 'teknik' || p.kategori === 'fisik' || p.kategori === 'kedisiplinan';
    });
    html += '<div class="card mt-2">' +
      '<div class="card-title">' + UI.icon('activity', 22) + 'Rincian per Parameter</div>' +
      '<div class="chart-box tall"><canvas id="hs-param"></canvas></div>' +
      (paramAktif.length ? '' : '<p class="muted small mb-0">Belum ada data penilaian.</p>') +
      '</div>';

    html += '<div class="card mt-2">' +
      '<div class="card-title">' + UI.icon('chart', 22) + 'Tren Penilaian per Minggu</div>' +
      '<div class="chart-box tall"><canvas id="hs-tren"></canvas></div>' +
      (penilaian.tren_mingguan.length ? '' : '<p class="muted small mb-0">Belum ada data untuk tren.</p>') +
      '</div>';

    // Absensi per sekolah
    var absPerSekolah = sekolahScope.map(function (s) {
      var siswa = semuaSiswa.filter(function (x) {
        return x.sekolah_id === s.id;
      });
      var r = EkskulHitung.ringkasanAbsensi(siswa, f.dari, f.sampai);
      return { nama: s.nama, persen: r.keseluruhan, rekap: r.rekap, jumlah: r.jumlah_pertemuan };
    });

    var absPerSekolahHtml = absPerSekolah.map(function (row) {
      return EkskulUI.barPercent(row.nama, row.persen);
    }).join('');
    if (!absPerSekolahHtml) absPerSekolahHtml = '<p class="muted mb-0">Belum ada sekolah.</p>';

    html += '<div class="card mt-2">' +
      '<div class="card-title">' + UI.icon('calendar', 22) + 'Absensi</div>' +
      '<h3 class="mb-1">Kehadiran per Sekolah</h3>' +
      absPerSekolahHtml +
      '<h3 class="mt-3 mb-1">Rekap Status Kehadiran</h3>' +
      '<div class="kpi-grid">' +
      '<div class="kpi-card"><div class="kpi-angka">' + absensi.rekap.Hadir + '</div><div class="kpi-label">Hadir</div></div>' +
      '<div class="kpi-card"><div class="kpi-angka">' + absensi.rekap.Izin + '</div><div class="kpi-label">Izin</div></div>' +
      '<div class="kpi-card"><div class="kpi-angka">' + absensi.rekap.Sakit + '</div><div class="kpi-label">Sakit</div></div>' +
      '<div class="kpi-card accent"><div class="kpi-angka">' + absensi.rekap['Tidak Hadir'] + '</div><div class="kpi-label">Tidak Hadir</div></div>' +
      '</div>' +
      '<div class="chart-box mt-2"><canvas id="hs-abs-donut"></canvas></div>' +
      '</div>';

    var absPerSiswa = absensi.per_siswa.filter(function (row) {
      return row.total > 0;
    }).sort(function (a, b) {
      return b.persen - a.persen;
    });
    var absPerSiswaHtml = absPerSiswa.slice(0, 12).map(function (row) {
      return EkskulUI.barPercent(row.siswa.nama + ' (' + (row.siswa.id_siswa || '') + ')', row.persen);
    }).join('');
    if (!absPerSiswaHtml) absPerSiswaHtml = '<p class="muted mb-0">Belum ada data absensi.</p>';
    html += '<div class="card mt-2">' +
      '<div class="card-title">' + UI.icon('users', 22) + 'Kehadiran per Siswa</div>' +
      absPerSiswaHtml +
      '</div>';

    var terbaru = pertandingan.daftar.slice(0, 5);
    html += '<div class="card mt-2">' +
      '<div class="card-title">' + UI.icon('trophy', 22) + 'Pertandingan Terbaru</div>' +
      UI.table([
        { label: 'Tanggal' }, { label: 'Turnamen' }, { label: 'Atlet' }, { label: 'Hasil', align: 'center' }
      ], terbaru.map(function (m) {
        var atlet = (m.siswa_ids || []).map(function (id) {
          var s = EkskulStore.find('students', id);
          return s ? s.nama : '-';
        }).join(' & ');
        return '<td>' + Utils.esc(Utils.fmtDate(m.tanggal)) + '</td>' +
          '<td>' + Utils.esc(m.turnamen) + '</td>' +
          '<td>' + Utils.esc(atlet) + '</td>' +
          '<td class="align-center">' + UI.statusBadge(m.hasil) + '</td>';
      }), { empty: 'Belum ada pertandingan.' }) +
      '</div>';

    root.innerHTML = html;

    bindFilter(root.querySelector('.filter-ekskul'), function (key, value) {
      f[key] = value;
      if (key === 'sekolah_id') f.siswa_id = '';
      pageHomeSuperadmin(root);
    });

    if (paramAktif.length) {
      EkskulUI.drawBar(root.querySelector('#hs-param'),
        paramAktif.map(function (p) { return p.nama; }),
        [{ label: 'Persentase (%)', data: paramAktif.map(function (p) { return p.persen === null ? 0 : p.persen; }), color: '#0b3d91' }],
        { horizontal: true, min: 0, max: 100, noLegend: true, xTitle: 'Persentase (%)' });
    }
    if (penilaian.tren_mingguan.length) {
      EkskulUI.drawLine(root.querySelector('#hs-tren'),
        penilaian.tren_mingguan.map(function (t) { return t.label; }),
        [{ label: 'Persentase (%)', data: penilaian.tren_mingguan.map(function (t) { return t.persen; }), color: '#d62839' }],
        { min: 0, max: 100, noLegend: true, yTitle: 'Persentase (%)', xTitle: 'Minggu' });
    }
    if (absensi.jumlah_pertemuan) {
      EkskulUI.drawDoughnut(root.querySelector('#hs-abs-donut'),
        ['Hadir', 'Izin', 'Sakit', 'Tidak Hadir'],
        [absensi.rekap.Hadir, absensi.rekap.Izin, absensi.rekap.Sakit, absensi.rekap['Tidak Hadir']]);
    }
  }

  function pageHomeViewer(root) {
    var s = session();
    var siswaList = scopedStudents();
    var penilaian = EkskulHitung.ringkasanPenilaian(siswaList, '', '');
    var absensi = EkskulHitung.ringkasanAbsensi(siswaList, '', '');
    var pertandingan = EkskulHitung.ringkasanPertandingan(siswaList, '', '');

    var judul;
    var sub;
    var kartuPertama;
    if (s.role === 'siswa') {
      var me = EkskulStore.find('students', s.siswa_id) || {};
      judul = 'Halo, ' + (me.nama || s.nama || 'Siswa') + '!';
      sub = (me.id_siswa ? me.id_siswa + ' · ' : '') + (me.kelas ? 'Kelas ' + me.kelas + ' · ' : '') + (s.sekolah_nama || '');
      kartuPertama = '<div class="kpi-card"><div class="kpi-angka">' + penilaian.jumlah_penilaian + '</div><div class="kpi-label">Sesi Latihan Dinilai</div></div>';
    } else {
      judul = s.role === 'guru' ? 'Beranda Guru Sekolah' : 'Beranda Sekolah';
      sub = s.sekolah_nama || '';
      kartuPertama = '<div class="kpi-card"><div class="kpi-angka">' + siswaList.length + '</div><div class="kpi-label">Siswa/Siswi</div></div>';
    }

    var html = UI.pageHeader(judul, sub) +
      '<div class="kpi-grid">' +
      kartuPertama +
      '<div class="kpi-card"><div class="kpi-angka">' + (penilaian.keseluruhan === null ? '—' : penilaian.keseluruhan + '%') + '</div><div class="kpi-label">Rata-rata Nilai</div></div>' +
      '<div class="kpi-card"><div class="kpi-angka">' + (absensi.keseluruhan === null ? '—' : absensi.keseluruhan + '%') + '</div><div class="kpi-label">Kehadiran</div></div>' +
      '<div class="kpi-card accent"><div class="kpi-angka">' + pertandingan.menang + ' / ' + pertandingan.kalah + '</div><div class="kpi-label">Menang / Kalah</div></div>' +
      '</div>';

    html += '<div class="card mt-2">' +
      '<div class="card-title">' + UI.icon('chart', 22) + 'Penilaian per Kategori</div>' +
      penilaian.per_kategori.map(function (k) {
        return EkskulUI.barPercent(k.nama, k.persen);
      }).join('') +
      '</div>';

    html += '<div class="card mt-2">' +
      '<div class="card-title">' + UI.icon('chart', 22) + 'Tren per Minggu</div>' +
      '<div class="chart-box tall"><canvas id="hv-tren"></canvas></div>' +
      (penilaian.tren_mingguan.length ? '' : '<p class="muted small mb-0">Belum ada data untuk tren.</p>') +
      '</div>';

    html += '<div class="card mt-2">' +
      '<div class="card-title">' + UI.icon('trophy', 22) + 'Pertandingan Terbaru</div>' +
      UI.table([
        { label: 'Tanggal' }, { label: 'Turnamen' }, { label: 'Hasil', align: 'center' }
      ], pertandingan.daftar.slice(0, 5).map(function (m) {
        return '<td>' + Utils.esc(Utils.fmtDate(m.tanggal)) + '</td>' +
          '<td>' + Utils.esc(m.turnamen) + '</td>' +
          '<td class="align-center">' + UI.statusBadge(m.hasil) + '</td>';
      }), { empty: 'Belum ada pertandingan.' }) +
      '</div>';

    root.innerHTML = html;

    if (penilaian.tren_mingguan.length) {
      EkskulUI.drawLine(root.querySelector('#hv-tren'),
        penilaian.tren_mingguan.map(function (t) { return t.label; }),
        [{ label: 'Persentase (%)', data: penilaian.tren_mingguan.map(function (t) { return t.persen; }), color: '#0b3d91' }],
        { min: 0, max: 100, noLegend: true, yTitle: 'Persentase (%)', xTitle: 'Minggu' });
    }
  }

  /* =====================  PROFIL SISWA  =================================== */

  function pageProfil(root) {
    var s = session();
    if (!isSiswa()) {
      root.innerHTML = UI.pageHeader('Profil', 'Halaman ini khusus untuk siswa/siswi.') +
        '<div class="card">' + UI.emptyState('Anda tidak memiliki akses ke halaman ini.', 'alert') + '</div>';
      return;
    }
    var me = EkskulStore.find('students', s.siswa_id) || {};
    var punyaAkun = !!(me.username && me.password_hash);

    var html = UI.pageHeader('Profil Saya', 'Biodata dan pengaturan akun Anda.') +
      '<div class="card">' +
      '<div class="card-title">' + UI.icon('user', 22) + 'Biodata</div>' +
      '<div class="profil-grid">' +
      '<div class="profil-baris"><span class="muted">ID Siswa</span><b>' + Utils.esc(me.id_siswa || '-') + '</b></div>' +
      '<div class="profil-baris"><span class="muted">Nama</span><b>' + Utils.esc(me.nama || '-') + '</b></div>' +
      '<div class="profil-baris"><span class="muted">Kelas</span><b>' + Utils.esc(me.kelas || '-') + '</b></div>' +
      '<div class="profil-baris"><span class="muted">Asal Sekolah</span><b>' + Utils.esc(s.sekolah_nama || EkskulData.namaSekolah(me.sekolah_id)) + '</b></div>' +
      '<div class="profil-baris"><span class="muted">Jenis Kelamin</span><b>' + Utils.esc(me.jk || '-') + '</b></div>' +
      '<div class="profil-baris"><span class="muted">Usia</span><b>' + Utils.esc(me.usia != null ? me.usia + ' tahun' : '-') + '</b></div>' +
      '<div class="profil-baris"><span class="muted">Nama Pengguna</span><b>' + Utils.esc(punyaAkun ? me.username : me.id_siswa || '-') + '</b></div>' +
      '</div>' +
      '</div>';

    html += '<div class="card mt-2">' +
      '<div class="card-title">' + UI.icon('settings', 22) + 'Ganti Kata Sandi</div>' +
      (punyaAkun
        ? '<form id="profil-form-ganti" data-no-dirty>' +
        '<div class="field"><label class="label" for="pf-lama">Kata Sandi Lama <span class="req">*</span></label>' +
        '<div class="pw-wrap"><input class="input" type="password" id="pf-lama" autocomplete="current-password">' +
        '<button type="button" class="pw-toggle" data-pw-toggle="pf-lama">Lihat</button></div></div>' +
        '<div class="field"><label class="label" for="pf-baru">Kata Sandi Baru <span class="req">*</span></label>' +
        '<div class="pw-wrap"><input class="input" type="password" id="pf-baru" autocomplete="new-password">' +
        '<button type="button" class="pw-toggle" data-pw-toggle="pf-baru">Lihat</button></div>' +
        '<div class="help">Minimal 6 karakter.</div></div>' +
        '<div class="field"><label class="label" for="pf-baru2">Ulangi Kata Sandi Baru <span class="req">*</span></label>' +
        '<input class="input" type="password" id="pf-baru2" autocomplete="new-password"></div>' +
        '<div class="field-error" id="pf-error"></div>' +
        '<button class="btn" type="submit">Simpan Kata Sandi Baru</button>' +
        '</form>'
        : '<p class="muted mb-0">Akun Anda belum memiliki kata sandi. Hubungi Superadmin sekolah untuk membuat kata sandi.</p>') +
      '</div>';

    html += '<div class="card mt-2">' +
      '<button type="button" class="btn btn-danger btn-block" data-eks-logout>Keluar dari Akun</button>' +
      '</div>';

    root.innerHTML = html;

    bindPwToggle(root);
    var form = root.querySelector('#profil-form-ganti');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var lama = root.querySelector('#pf-lama').value;
      var baru = root.querySelector('#pf-baru').value;
      var baru2 = root.querySelector('#pf-baru2').value;
      var err = root.querySelector('#pf-error');
      err.textContent = '';
      if (!lama) { err.textContent = 'Kata sandi lama wajib diisi.'; return; }
      if (baru.length < 6) { err.textContent = 'Kata sandi baru minimal 6 karakter.'; return; }
      if (baru !== baru2) { err.textContent = 'Ketikan kata sandi baru tidak sama.'; return; }
      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      EkskulAuth.gantiPasswordSendiri(lama, baru).then(function () {
        form.reset();
        Utils.toast('Kata sandi berhasil diganti.', 'success');
      }, function (ex) {
        err.textContent = ex && ex.message ? ex.message : 'Gagal mengganti kata sandi.';
      }).then(function () {
        btn.disabled = false;
      });
    });
  }

  return {
    home: pageHome,
    pengguna: pagePengguna,
    penilaian: pagePenilaian,
    absensi: pageAbsensi,
    pertandingan: pagePertandingan,
    profil: pageProfil,
    state: state
  };
})();

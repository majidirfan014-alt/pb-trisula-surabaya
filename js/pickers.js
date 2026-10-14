var Picker = (function () {
  var KOLEKSI_LOKASI = 'lokasi_latihan';
  var DEFAULT_LOKASI = ['Lapangan Utama', 'Lapangan 2', 'GOR Surabaya'];
  var KOLEKSI_PENGGUNA_LOKASI = ['absensi_asisten', 'logbook_entries'];

  /* ==================== MASTER LOKASI LATIHAN ==================== */

  function masterSemua() {
    return Utils.sortBy(Store.all(KOLEKSI_LOKASI), 'nama', 'asc');
  }

  function masterAktif() {
    return masterSemua().filter(function (l) {
      return l.aktif !== false;
    });
  }

  function masterById(id) {
    return Store.findOne(KOLEKSI_LOKASI, function (l) {
      return l.id === id;
    });
  }

  function masterCariNama(nama) {
    var n = String(nama || '').trim().toLowerCase();
    if (!n) return null;
    return Store.findOne(KOLEKSI_LOKASI, function (l) {
      return String(l.nama || '').trim().toLowerCase() === n;
    });
  }

  function masterSimpan(payload, id) {
    if (id) {
      Store.update(KOLEKSI_LOKASI, id, payload);
      return masterById(id);
    }
    return Store.insert(KOLEKSI_LOKASI, Object.assign({
      id: 'lok_' + Date.now().toString(36) + Math.floor(Math.random() * 1000),
      aktif: true
    }, payload));
  }

  function masterToggle(id) {
    var l = masterById(id);
    if (!l) return null;
    return Store.update(KOLEKSI_LOKASI, id, { aktif: l.aktif === false });
  }

  function masterHapus(id) {
    return Store.remove(KOLEKSI_LOKASI, id);
  }

  // Isi lokasi default sekali saja saat aplikasi pertama dijalankan.
  function initMaster() {
    try {
      if (localStorage.getItem(CONFIG.PREFIX + KOLEKSI_LOKASI) === null) {
        DEFAULT_LOKASI.forEach(function (nama, i) {
          Store.insert(KOLEKSI_LOKASI, {
            id: 'lok_default_' + (i + 1),
            nama: nama,
            aktif: true
          });
        });
      }
    } catch (e) {}
  }

  /* ==================== NILAI LOKASI PADA RECORD ==================== */

  // Membaca nilai lokasi dari sebuah record (data baru maupun data lama).
  function nilaiLokasi(rec) {
    var out = { ids: [], nama: [], lainnya: '', teks: '' };
    if (!rec) return out;
    if (Array.isArray(rec.lokasi_ids)) out.ids = rec.lokasi_ids.slice();
    if (Array.isArray(rec.lokasi_nama)) out.nama = rec.lokasi_nama.slice();
    out.lainnya = rec.lokasi_lainnya ? String(rec.lokasi_lainnya) : '';
    if (!out.nama.length && !out.lainnya && rec.lokasi) {
      out.teks = String(rec.lokasi);
    } else {
      var bagian = out.nama.slice();
      if (out.lainnya) bagian.push(out.lainnya);
      out.teks = bagian.join(', ');
    }
    return out;
  }

  function labelLokasi(rec) {
    var n = nilaiLokasi(rec);
    return n.teks || (rec && rec.lokasi ? String(rec.lokasi) : '');
  }

  // Chip kecil untuk tabel riwayat / rekap.
  function chipLokasi(rec) {
    var n = nilaiLokasi(rec);
    var daftar = n.nama.slice();
    if (n.lainnya) daftar.push(n.lainnya);
    if (!daftar.length && n.teks) daftar.push(n.teks);
    if (!daftar.length && rec && rec.lokasi) daftar.push(String(rec.lokasi));
    if (!daftar.length) return '<span class="muted">-</span>';
    return '<div class="lokasi-chips">' + daftar.map(function (t) {
      return '<span class="lokasi-chip">' + Utils.esc(t) + '</span>';
    }).join('') + '</div>';
  }

  // Susun field lokasi untuk disimpan ke record (teks lama tetap diisi
  // agar data lama & tampilan lama tidak rusak).
  function payloadLokasi(nilai) {
    var n = nilai || { ids: [], nama: [], lainnya: '' };
    var bagian = (n.nama || []).slice();
    var lainnya = n.lainnya ? String(n.lainnya) : '';
    if (lainnya) bagian.push(lainnya);
    return {
      lokasi: bagian.join(', '),
      lokasi_ids: (n.ids || []).slice(),
      lokasi_nama: (n.nama || []).slice(),
      lokasi_lainnya: lainnya
    };
  }

  // Migrasi aman untuk data lama (lokasi masih berupa teks).
  // Menambahkan lokasi_ids/lokasi_nama bila nama bisa dicocokkan dengan
  // master; sisanya masuk lokasi_lainnya. Field lama tidak dihapus.
  function migrasiLokasi() {
    var total = 0;
    KOLEKSI_PENGGUNA_LOKASI.forEach(function (koleksi) {
      Store.all(koleksi).forEach(function (rec) {
        if (!rec || rec.lokasi_ids !== undefined) return;
        var teks = rec.lokasi ? String(rec.lokasi) : '';
        if (!teks) {
          Store.update(koleksi, rec.id, { lokasi_ids: [], lokasi_nama: [], lokasi_lainnya: '' });
          total++;
          return;
        }
        var ids = [];
        var nama = [];
        var sisa = [];
        teks.split(',').forEach(function (bagian) {
          var t = bagian.trim();
          if (!t) return;
          var cocok = masterCariNama(t);
          if (cocok) {
            if (ids.indexOf(cocok.id) === -1) {
              ids.push(cocok.id);
              nama.push(cocok.nama);
            }
          } else {
            sisa.push(t);
          }
        });
        Store.update(koleksi, rec.id, {
          lokasi_ids: ids,
          lokasi_nama: nama,
          lokasi_lainnya: sisa.join(', ')
        });
        total++;
      });
    });
    return total;
  }

  function init() {
    initMaster();
    migrasiLokasi();
  }

  /* ==================== KOMPONEN: PILIH LOKASI ==================== */

  // Checkbox kartu/chip besar untuk lokasi latihan (bisa pilih lebih dari satu).
  // host: elemen tujuan, opts: { name, label, required, help, value: {ids, lainnya}, onChange }
  function lokasi(host, opts) {
    opts = opts || {};
    var name = opts.name || 'lokasi_ids';
    var value = opts.value || { ids: [], lainnya: '' };
    var dipilih = {};
    (value.ids || []).forEach(function (id) {
      dipilih[id] = true;
    });
    var lainnyaAktif = !!value.lainnya;
    var teksLainnya = value.lainnya || '';

    host.className = (host.className ? host.className + ' ' : '') + 'picker-lokasi-host';
    host.innerHTML =
      '<div class="field lokasi-field">' +
      '<label class="label">' + Utils.esc(opts.label || 'Lokasi Latihan') +
      (opts.required ? ' <span class="req">*</span>' : '') + '</label>' +
      '<div class="lokasi-toolbar">' +
      '<button type="button" class="btn btn-sm btn-ghost" data-lokasi-semua>' + UI.icon('check', 16) + ' Pilih semua</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-lokasi-reset>' + UI.icon('x', 16) + ' Hapus pilihan</button>' +
      '<span class="picker-counter" data-lokasi-counter></span>' +
      '</div>' +
      '<div class="lokasi-grid" data-lokasi-grid></div>' +
      '<div class="lokasi-lainnya-box" data-lokasi-lainnya-box hidden>' +
      '<input class="input" type="text" name="lokasi_lainnya" data-lokasi-lainnya placeholder="Tulis lokasi lain..." value="' + Utils.esc(teksLainnya) + '">' +
      '</div>' +
      (opts.help ? '<div class="help">' + Utils.esc(opts.help) + '</div>' : '') +
      '<div class="field-error" data-error-for="lokasi"></div>' +
      '<input type="hidden" name="' + Utils.esc(name) + '" value="">' +
      '</div>';

    var grid = host.querySelector('[data-lokasi-grid]');
    var boxLainnya = host.querySelector('[data-lokasi-lainnya-box]');
    var inputLainnya = host.querySelector('[data-lokasi-lainnya]');
    var counter = host.querySelector('[data-lokasi-counter]');

    function daftarTampil() {
      return masterAktif();
    }

    function renderGrid() {
      var daftar = daftarTampil();
      if (!daftar.length) {
        grid.innerHTML = UI.emptyState('Belum ada lokasi latihan. Tambahkan lewat menu Kelola Lokasi Latihan.', 'settings');
      } else {
        grid.innerHTML = daftar.map(function (l) {
          var aktif = !!dipilih[l.id];
          return '<label class="lokasi-card' + (aktif ? ' active' : '') + '" data-lokasi-card="' + Utils.esc(l.id) + '">' +
            '<input type="checkbox" value="' + Utils.esc(l.id) + '"' + (aktif ? ' checked' : '') + '>' +
            '<span class="lokasi-check">' + UI.icon('check', 16) + '</span>' +
            '<span class="lokasi-nama">' + Utils.esc(l.nama) + '</span>' +
            '</label>';
        }).join('');
      }
      var kartuLainnya = '<label class="lokasi-card lokasi-card-lainnya' + (lainnyaAktif ? ' active' : '') + '" data-lokasi-lainnya-kartu>' +
        '<input type="checkbox" data-lokasi-lainnya-toggle' + (lainnyaAktif ? ' checked' : '') + '>' +
        '<span class="lokasi-check">' + UI.icon('plus', 16) + '</span>' +
        '<span class="lokasi-nama">Lainnya</span></label>';
      grid.insertAdjacentHTML('beforeend', kartuLainnya);
      boxLainnya.hidden = !lainnyaAktif;
      perbaruiCounter();
    }

    function perbaruiCounter() {
      var n = Object.keys(dipilih).length + (lainnyaAktif ? 1 : 0);
      counter.textContent = n ? (n + ' lokasi dipilih') : 'Belum ada lokasi dipilih';
      var hidden = host.querySelector('input[type="hidden"][name="' + name + '"]');
      if (hidden) hidden.value = Object.keys(dipilih).join(',');
    }

    function beriSinyal() {
      perbaruiCounter();
      if (typeof opts.onChange === 'function') opts.onChange(getValue());
      var hidden = host.querySelector('input[type="hidden"][name="' + name + '"]');
      if (hidden && hidden.dispatchEvent) {
        try {
          hidden.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e) {}
      }
    }

    function getValue() {
      var ids = Object.keys(dipilih);
      var nama = ids.map(function (id) {
        var l = masterById(id);
        return l ? l.nama : id;
      });
      return {
        ids: ids,
        nama: nama,
        lainnya: lainnyaAktif ? String(inputLainnya.value || '').trim() : '',
        teks: payloadLokasi({ ids: ids, nama: nama, lainnya: lainnyaAktif ? String(inputLainnya.value || '').trim() : '' }).lokasi
      };
    }

    function setValue(v) {
      dipilih = {};
      (v && v.ids ? v.ids : []).forEach(function (id) {
        dipilih[id] = true;
      });
      lainnyaAktif = !!(v && v.lainnya);
      teksLainnya = (v && v.lainnya) || '';
      if (inputLainnya) inputLainnya.value = teksLainnya;
      renderGrid();
    }

    host.addEventListener('change', function (e) {
      var t = e.target;
      if (t && t.hasAttribute && t.hasAttribute('data-lokasi-lainnya-toggle')) {
        lainnyaAktif = t.checked;
        var kartuLain = host.querySelector('[data-lokasi-lainnya-kartu]');
        if (kartuLain) kartuLain.classList.toggle('active', lainnyaAktif);
        boxLainnya.hidden = !lainnyaAktif;
        if (!lainnyaAktif) {
          inputLainnya.value = '';
        } else {
          setTimeout(function () {
            inputLainnya.focus();
          }, 30);
        }
        beriSinyal();
        return;
      }
      if (t && t.type === 'checkbox' && t.value && t.closest && t.closest('[data-lokasi-card]')) {
        if (t.checked) dipilih[t.value] = true;
        else delete dipilih[t.value];
        var kartu = t.closest('[data-lokasi-card]');
        if (kartu) kartu.classList.toggle('active', t.checked);
        beriSinyal();
      }
    });

    host.addEventListener('input', function (e) {
      if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-lokasi-lainnya')) {
        teksLainnya = e.target.value;
        beriSinyal();
      }
    });

    host.addEventListener('click', function (e) {
      if (e.target.closest('[data-lokasi-semua]')) {
        daftarTampil().forEach(function (l) {
          dipilih[l.id] = true;
        });
        renderGrid();
        beriSinyal();
        return;
      }
      if (e.target.closest('[data-lokasi-reset]')) {
        dipilih = {};
        lainnyaAktif = false;
        inputLainnya.value = '';
        renderGrid();
        beriSinyal();
      }
    });

    renderGrid();
    return {
      getValue: getValue,
      setValue: setValue,
      el: host
    };
  }

  /* ==================== KOMPONEN: PILIH ATLET ==================== */

  var panelAktif = null;

  function tutupPanel() {
    if (!panelAktif) return;
    if (panelAktif.onResize) window.removeEventListener('resize', panelAktif.onResize);
    if (panelAktif.overlay && panelAktif.overlay.parentNode) {
      panelAktif.overlay.parentNode.removeChild(panelAktif.overlay);
    }
    document.body.classList.remove('picker-open');
    panelAktif = null;
  }

  function bukaPanel(api) {
    tutupPanel();
    var daftar = Shared.activeAthletes();
    var dipilih = {};
    api.getValue().forEach(function (id) {
      dipilih[id] = true;
    });
    var kueri = '';
    var mode = api.mode;

    var overlay = document.createElement('div');
    overlay.className = 'picker-overlay';
    overlay.innerHTML =
      '<div class="picker-pop" role="dialog" aria-modal="true" aria-label="Pilih atlet">' +
      '<div class="picker-pop-head">' +
      '<div class="picker-search">' + UI.icon('search', 18) +
      '<input type="search" data-picker-cari placeholder="Cari nama atau ID atlet..." aria-label="Cari atlet">' +
      '</div>' +
      '<button type="button" class="icon-btn" data-picker-tutup aria-label="Tutup">' + UI.icon('close', 20) + '</button>' +
      '</div>' +
      '<div class="picker-pop-chips" data-picker-chips></div>' +
      '<div class="picker-pop-tools">' +
      (mode === 'multi' ? '<button type="button" class="btn btn-sm btn-secondary" data-picker-semua>Pilih semua hasil pencarian</button>' : '') +
      '<button type="button" class="btn btn-sm btn-ghost" data-picker-reset>Hapus semua pilihan</button>' +
      '<span class="picker-counter" data-picker-counter></span>' +
      '</div>' +
      '<div class="picker-pop-list" data-picker-list></div>' +
      '<div class="picker-pop-foot">' +
      '<button type="button" class="btn picker-done" data-picker-selesai>Selesai</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    document.body.classList.add('picker-open');

    var pop = overlay.querySelector('.picker-pop');
    var listHost = overlay.querySelector('[data-picker-list]');
    var chipsHost = overlay.querySelector('[data-picker-chips]');
    var counter = overlay.querySelector('[data-picker-counter]');
    var cari = overlay.querySelector('[data-picker-cari]');

    // Posisi panel: bottom sheet penuh di HP, dropdown di desktop.
    function posisikan() {
      var kecil = window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
      pop.classList.toggle('sheet', kecil);
      if (kecil) {
        pop.style.top = '';
        pop.style.left = '';
        return;
      }
      var rect = api.trigger.getBoundingClientRect();
      var lebar = Math.min(420, window.innerWidth - 24);
      pop.style.width = lebar + 'px';
      var kiri = Math.max(12, Math.min(rect.left, window.innerWidth - lebar - 12));
      var bawah = rect.bottom + 8;
      var tinggiMaks = Math.max(280, window.innerHeight - bawah - 16);
      pop.style.left = kiri + 'px';
      pop.style.top = bawah + 'px';
      pop.style.maxHeight = Math.min(560, tinggiMaks) + 'px';
    }
    posisikan();

    function hasilFilter() {
      var q = kueri.trim().toLowerCase();
      if (!q) return daftar;
      return daftar.filter(function (a) {
        return String(a.nama || '').toLowerCase().indexOf(q) !== -1 ||
          String(a.id_atlet || '').toLowerCase().indexOf(q) !== -1;
      });
    }

    function renderChips() {
      var ids = Object.keys(dipilih);
      if (!ids.length) {
        chipsHost.innerHTML = '<span class="small muted">Belum ada atlet dipilih.</span>';
        return;
      }
      chipsHost.innerHTML = ids.map(function (id) {
        var a = cariAtlet(daftar, id);
        var nama = a ? a.nama : id;
        return '<span class="picker-chip">' + Utils.esc(nama) +
          '<button type="button" class="picker-chip-x" data-chip-hapus="' + Utils.esc(id) + '" aria-label="Hapus ' + Utils.esc(nama) + '">' +
          UI.icon('x', 14) + '</button></span>';
      }).join('');
    }

    function renderCounter() {
      var n = Object.keys(dipilih).length;
      counter.textContent = n + ' atlet dipilih';
    }

    function renderList() {
      var hasil = hasilFilter();
      if (!hasil.length) {
        listHost.innerHTML = '<div class="picker-kosong">Atlet tidak ditemukan</div>';
        return;
      }
      listHost.innerHTML = hasil.map(function (a) {
        var on = !!dipilih[a.id_atlet];
        return '<label class="picker-row' + (on ? ' active' : '') + '" data-row-atlet="' + Utils.esc(a.id_atlet) + '">' +
          '<input type="' + (mode === 'single' ? 'radio' : 'checkbox') + '"' +
          (mode === 'single' ? ' name="picker-atlet-satu"' : '') +
          ' value="' + Utils.esc(a.id_atlet) + '"' + (on ? ' checked' : '') + '>' +
          UI.avatar(a, 36) +
          '<span class="picker-row-teks"><b>' + Utils.esc(a.nama) + '</b>' +
          '<span class="small muted">' + Utils.esc(a.id_atlet) + '</span></span>' +
          '<span class="picker-row-check">' + UI.icon('check', 16) + '</span>' +
          '</label>';
      }).join('');
    }

    function render() {
      renderChips();
      renderCounter();
      renderList();
    }

    // Perbarui status centang tanpa membangun ulang daftar, supaya fokus
    // keyboard (Tab/Spasi) tidak hilang setiap kali mencentang.
    function perbaruiBaris() {
      renderChips();
      renderCounter();
      var rows = listHost.querySelectorAll('[data-row-atlet]');
      for (var i = 0; i < rows.length; i++) {
        var id = rows[i].getAttribute('data-row-atlet');
        var on = !!dipilih[id];
        rows[i].classList.toggle('active', on);
        var input = rows[i].querySelector('input');
        if (input) input.checked = on;
      }
    }

    function cariAtlet(daftarAtlet, id) {
      for (var i = 0; i < daftarAtlet.length; i++) {
        if (daftarAtlet[i].id_atlet === id) return daftarAtlet[i];
      }
      return null;
    }

    function terapkan() {
      var ids = Object.keys(dipilih);
      if (mode === 'single' && ids.length > 1) ids = ids.slice(0, 1);
      if (mode === 'pair' && ids.length > 2) ids = ids.slice(0, 2);
      api.setValue(ids);
    }

    function toggle(id, on) {
      if (mode === 'single') {
        dipilih = {};
        if (on) dipilih[id] = true;
        terapkan();
        render();
        tutupPanel();
        return;
      }
      if (on) {
        if (mode === 'pair' && Object.keys(dipilih).length >= 2 && !dipilih[id]) {
          Utils.toast('Pasangan ganda maksimal 2 atlet.', 'danger');
          perbaruiBaris();
          return;
        }
        dipilih[id] = true;
      } else {
        delete dipilih[id];
      }
      terapkan();
      perbaruiBaris();
    }

    render();

    panelAktif = { overlay: overlay, api: api, onResize: posisikan };
    window.addEventListener('resize', posisikan);

    setTimeout(function () {
      if (cari && cari.focus) cari.focus();
    }, 30);

    overlay.addEventListener('mousedown', function (e) {
      if (e.target === overlay) tutupPanel();
    });

    overlay.addEventListener('click', function (e) {
      if (e.target.closest('[data-picker-tutup]') || e.target.closest('[data-picker-selesai]')) {
        tutupPanel();
        return;
      }
      var chipX = e.target.closest('[data-chip-hapus]');
      if (chipX) {
        delete dipilih[chipX.getAttribute('data-chip-hapus')];
        terapkan();
        perbaruiBaris();
        return;
      }
      if (e.target.closest('[data-picker-semua]')) {
        hasilFilter().forEach(function (a) {
          dipilih[a.id_atlet] = true;
        });
        terapkan();
        perbaruiBaris();
        return;
      }
      if (e.target.closest('[data-picker-reset]')) {
        dipilih = {};
        terapkan();
        perbaruiBaris();
        return;
      }
      var row = e.target.closest('[data-row-atlet]');
      if (row && e.target.tagName !== 'INPUT') {
        var id = row.getAttribute('data-row-atlet');
        toggle(id, mode === 'single' ? true : !dipilih[id]);
      }
    });

    overlay.addEventListener('change', function (e) {
      var t = e.target;
      if (t && t.value && t.closest && t.closest('[data-row-atlet]')) {
        toggle(t.value, t.checked || t.type === 'radio');
      }
    });

    cari.addEventListener('input', function () {
      kueri = cari.value;
      renderList();
    });

    document.addEventListener('keydown', function onEsc(e) {
      if (!panelAktif || panelAktif.overlay !== overlay) {
        document.removeEventListener('keydown', onEsc, true);
        return;
      }
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        e.stopPropagation();
        tutupPanel();
      }
    }, true);
  }

  // Komponen pilihan atlet dengan pencarian lalu centang.
  // host: elemen tujuan, opts: {
  //   mode: 'multi' | 'single' | 'pair', name, label, required, help,
  //   value: [idAtlet, ...], onChange
  // }
  function atlet(host, opts) {
    opts = opts || {};
    var mode = opts.mode || 'multi';
    var name = opts.name || 'id_atlet';
    var dipilih = [];
    (opts.value || []).forEach(function (id) {
      if (id && dipilih.indexOf(id) === -1) dipilih.push(id);
    });

    host.className = (host.className ? host.className + ' ' : '') + 'picker-atlet-host';
    host.innerHTML =
      '<div class="field">' +
      '<label class="label">' + Utils.esc(opts.label || 'Atlet') +
      (opts.required ? ' <span class="req">*</span>' : '') + '</label>' +
      '<button type="button" class="picker-trigger" data-picker-buka aria-haspopup="dialog">' +
      UI.icon('users', 20) +
      '<span class="picker-trigger-teks" data-picker-ringkas></span>' +
      '<span class="picker-trigger-panah"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></span>' +
      '</button>' +
      '<div class="picker-ringkas" data-picker-ringkas-kecil></div>' +
      (opts.help ? '<div class="help">' + Utils.esc(opts.help) + '</div>' : '') +
      '<div class="field-error" data-error-for="' + Utils.esc(name) + '"></div>' +
      '<input type="hidden" name="' + Utils.esc(name) + '" value="">' +
      '</div>';

    var trigger = host.querySelector('[data-picker-buka]');
    var ringkas = host.querySelector('[data-picker-ringkas]');
    var ringkasKecil = host.querySelector('[data-picker-ringkas-kecil]');
    var hidden = host.querySelector('input[type="hidden"][name="' + name + '"]');

    function namaAtlet(id) {
      var a = Store.findOne('athletes', function (x) {
        return x.id_atlet === id;
      });
      return a ? a.nama : id;
    }

    function renderRingkas() {
      hidden.value = dipilih.join(',');
      if (!dipilih.length) {
        ringkas.textContent = mode === 'single' ? 'Pilih atlet' : 'Pilih atlet (bisa lebih dari satu)';
        ringkasKecil.innerHTML = '';
        trigger.classList.remove('ada');
        return;
      }
      trigger.classList.add('ada');
      if (mode === 'single') {
        ringkas.textContent = namaAtlet(dipilih[0]) + ' (' + dipilih[0] + ')';
      } else {
        ringkas.textContent = dipilih.length + ' atlet dipilih';
      }
      ringkasKecil.innerHTML = dipilih.map(function (id) {
        return '<span class="picker-chip picker-chip-static">' + Utils.esc(namaAtlet(id)) +
          ' <b class="small muted">' + Utils.esc(id) + '</b>' +
          '<button type="button" class="picker-chip-x" data-ringkas-hapus="' + Utils.esc(id) + '" aria-label="Hapus ' + Utils.esc(namaAtlet(id)) + '">' +
          UI.icon('x', 14) + '</button></span>';
      }).join('');
    }

    function setValue(ids) {
      var sebelum = dipilih.join(',');
      dipilih = [];
      (ids || []).forEach(function (id) {
        if (id && dipilih.indexOf(id) === -1) dipilih.push(id);
      });
      if (mode === 'single' && dipilih.length > 1) dipilih = dipilih.slice(0, 1);
      if (mode === 'pair' && dipilih.length > 2) dipilih = dipilih.slice(0, 2);
      renderRingkas();
      if (dipilih.join(',') === sebelum) return;
      if (typeof opts.onChange === 'function') opts.onChange(dipilih.slice());
      try {
        hidden.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) {}
    }

    function getValue() {
      return dipilih.slice();
    }

    var api = {
      getValue: getValue,
      setValue: setValue,
      mode: mode,
      trigger: trigger,
      el: host
    };

    trigger.addEventListener('click', function () {
      bukaPanel(api);
    });

    host.addEventListener('click', function (e) {
      var x = e.target.closest('[data-ringkas-hapus]');
      if (!x) return;
      e.preventDefault();
      var id = x.getAttribute('data-ringkas-hapus');
      setValue(dipilih.filter(function (v) {
        return v !== id;
      }));
    });

    host.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'Esc') {
        if (panelAktif) {
          e.preventDefault();
          tutupPanel();
        }
      }
    });

    renderRingkas();
    return api;
  }

  /* ==================== KELOLA LOKASI LATIHAN ==================== */

  // Kartu "Kelola Lokasi Latihan" untuk halaman Setting (Pelatih Kepala/Admin).
  function kelolaLokasi(host) {
    function render() {
      var daftar = masterSemua();
      host.innerHTML =
        '<p class="muted small">Daftar lokasi latihan untuk form absensi, logbook, dan menu lainnya. ' +
        'Lokasi yang dinonaktifkan tidak muncul di form isian baru, tetapi data lama tetap tampil.</p>' +
        '<div class="flex items-center justify-between flex-wrap gap-1 mb-2">' +
        '<span class="small muted">' + daftar.length + ' lokasi terdaftar</span>' +
        '<button type="button" class="btn btn-sm" data-lokasi-tambah>' + UI.icon('plus', 18) + ' Tambah Lokasi</button>' +
        '</div>' +
        (daftar.length ? '<div class="table-wrap"><table class="table"><thead><tr>' +
          '<th>Nama Lokasi</th><th>Status</th><th class="align-center">Aksi</th>' +
          '</tr></thead><tbody>' +
          daftar.map(function (l) {
            return '<tr>' +
              '<td><b>' + Utils.esc(l.nama) + '</b></td>' +
              '<td>' + UI.statusBadge(l.aktif === false ? 'nonaktif' : 'aktif') + '</td>' +
              '<td class="align-center"><div class="flex gap-1" style="justify-content:center;flex-wrap:wrap">' +
              '<button type="button" class="btn btn-sm btn-secondary" data-lokasi-edit="' + Utils.esc(l.id) + '">Edit</button>' +
              '<button type="button" class="btn btn-sm btn-ghost" data-lokasi-toggle="' + Utils.esc(l.id) + '">' +
              (l.aktif === false ? 'Aktifkan' : 'Nonaktifkan') + '</button>' +
              '<button type="button" class="btn btn-sm btn-danger" data-lokasi-hapus="' + Utils.esc(l.id) + '">Hapus</button>' +
              '</div></td></tr>';
          }).join('') + '</tbody></table></div>'
          : UI.emptyState('Belum ada lokasi latihan.', 'settings'));
    }

    function bukaForm(lok) {
      document.getElementById('modal-host').innerHTML =
        UI.modalShell('m-lokasi', lok ? 'Edit Lokasi Latihan' : 'Tambah Lokasi Latihan',
          UI.backButton({ closeModal: 'm-lokasi' }) +
          '<form id="form-lokasi" novalidate>' +
          UI.field({ name: 'nama', label: 'Nama Lokasi', required: true, value: lok ? lok.nama : '', placeholder: 'contoh: Lapangan Utama' }) +
          UI.field({
            name: 'aktif', label: 'Status', type: 'select', value: !lok || lok.aktif !== false ? '1' : '0',
            options: [{ value: '1', label: 'Aktif' }, { value: '0', label: 'Nonaktif' }]
          }) +
          '</form>',
          '<button type="button" class="btn btn-ghost" data-back-close="m-lokasi">Batal</button>' +
          '<button type="submit" class="btn" form="form-lokasi">Simpan Lokasi</button>');
      UI.openModal('m-lokasi');
      var form = document.getElementById('form-lokasi');
      UI.bindSubmit(form, function () {
        Utils.clearErrors(form);
        var d = Utils.formData(form);
        var errors = {};
        if (!d.nama || !String(d.nama).trim()) errors.nama = 'Nama lokasi wajib diisi.';
        var kembar = masterCariNama(d.nama);
        if (kembar && (!lok || kembar.id !== lok.id)) errors.nama = 'Nama lokasi sudah dipakai.';
        if (Object.keys(errors).length) {
          Utils.showErrors(form, errors);
          Utils.toast('Periksa kembali isian yang ditandai.', 'danger');
          return;
        }
        masterSimpan({
          nama: String(d.nama).trim(),
          aktif: d.aktif === '1'
        }, lok ? lok.id : null);
        UI.closeModal('m-lokasi');
        Utils.toast('Lokasi latihan berhasil disimpan.', 'success');
        render();
      });
    }

    render();

    host.addEventListener('click', function (e) {
      if (e.target.closest('[data-lokasi-tambah]')) {
        bukaForm(null);
        return;
      }
      var edit = e.target.closest('[data-lokasi-edit]');
      if (edit) {
        bukaForm(masterById(edit.getAttribute('data-lokasi-edit')));
        return;
      }
      var toggle = e.target.closest('[data-lokasi-toggle]');
      if (toggle) {
        var l = masterToggle(toggle.getAttribute('data-lokasi-toggle'));
        if (l) Utils.toast('Status lokasi diperbarui.', 'success');
        render();
        return;
      }
      var hapus = e.target.closest('[data-lokasi-hapus]');
      if (hapus) {
        var target = masterById(hapus.getAttribute('data-lokasi-hapus'));
        if (!target) return;
        UI.confirmDialog('Hapus lokasi "' + target.nama + '"? Data lama yang memakai lokasi ini tetap tersimpan.', 'Hapus Lokasi').then(function (ok) {
          if (!ok) return;
          masterHapus(target.id);
          Utils.toast('Lokasi latihan dihapus.', 'success');
          render();
        });
      }
    });
  }

  return {
    init: init,
    atlet: atlet,
    lokasi: lokasi,
    kelolaLokasi: kelolaLokasi,
    masterSemua: masterSemua,
    masterAktif: masterAktif,
    masterById: masterById,
    masterSimpan: masterSimpan,
    masterToggle: masterToggle,
    masterHapus: masterHapus,
    nilaiLokasi: nilaiLokasi,
    labelLokasi: labelLokasi,
    chipLokasi: chipLokasi,
    payloadLokasi: payloadLokasi,
    migrasiLokasi: migrasiLokasi
  };
})();
